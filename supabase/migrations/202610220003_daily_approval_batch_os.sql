-- SIGA Américas: aprovação documental e emissão transacional de OS em lote.
-- Uma OS por equipe/dia e uma OS operacional por posto/dia, ambos contendo manhã e tarde.
-- Postos fixos (item 3.40, mensal) não geram quantidade/medição diária adicional.
create table public.daily_plan_approvals (
 id uuid primary key default gen_random_uuid(),
 work_date date not null unique,
 manager_name text not null check (length(btrim(manager_name))>=3),
 approval_reference text not null check (length(btrim(approval_reference))>=5),
 approved_on date not null,
 recorded_by uuid not null default auth.uid(),
 team_count integer not null check (team_count>0),
 post_count integer not null check (post_count>0),
 created_at timestamptz not null default now()
);
create table public.daily_plan_order_links (
 id uuid primary key default gen_random_uuid(),
 approval_id uuid not null references public.daily_plan_approvals(id) on delete restrict,
 work_order_id uuid not null unique references public.work_orders(id) on delete restrict,
 work_date date not null,
 team_assignment_id uuid references public.daily_team_assignments(id) on delete restrict,
 service_post_id uuid references public.service_posts(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint daily_plan_link_one_origin check ((team_assignment_id is null) <> (service_post_id is null))
);
create unique index daily_plan_order_team_unique on public.daily_plan_order_links(team_assignment_id) where team_assignment_id is not null;
create unique index daily_plan_order_post_unique on public.daily_plan_order_links(service_post_id,work_date) where service_post_id is not null;
create index daily_plan_links_date_idx on public.daily_plan_order_links(work_date);
alter table public.daily_plan_approvals enable row level security;
alter table public.daily_plan_order_links enable row level security;
revoke all on public.daily_plan_approvals,public.daily_plan_order_links from public,anon,authenticated;
grant select on public.daily_plan_approvals,public.daily_plan_order_links to authenticated;
create policy "daily_plan_approvals_read" on public.daily_plan_approvals
 for select to authenticated using (siga_private.is_active_member());
create policy "daily_plan_order_links_read" on public.daily_plan_order_links
 for select to authenticated using (siga_private.is_active_member());

create or replace function public.guard_approved_daily_shift()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare date_before date;date_after date;
begin
 date_before:=case when TG_OP='INSERT' then null else old.work_date end;
 date_after:=case when TG_OP='DELETE' then null else new.work_date end;
 if exists(select 1 from public.daily_plan_approvals
  where work_date=date_before or work_date=date_after) then
   raise exception 'Programação já aprovada formalmente. Não altere turnos; regularize primeiro a aprovação com a gestão.';
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
create trigger prevent_approved_shift_changes before insert or update or delete
 on public.daily_shift_plans for each row execute function public.guard_approved_daily_shift();

create or replace function public.guard_approved_daily_assignment()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare date_before date;date_after date;
begin
 date_before:=case when TG_OP='INSERT' then null else old.work_date end;
 date_after:=case when TG_OP='DELETE' then null else new.work_date end;
 if exists(select 1 from public.daily_plan_approvals
  where work_date=date_before or work_date=date_after) then
  -- Only the authorized issue function may attach the OS to an approved assignment.
  if TG_OP='UPDATE' and
     new.id=old.id and new.work_date=old.work_date and
     new.team_id=old.team_id and new.area_id=old.area_id and
     new.contract_item_id=old.contract_item_id and
     new.planned_service=old.planned_service and
     new.planned_location=old.planned_location and
     new.climate_alternative=old.climate_alternative and
     new.block_status=old.block_status and
     new.blocker_reason is not distinct from old.blocker_reason and
     new.verified_quantity is not distinct from old.verified_quantity and
     new.supervisor_notes is not distinct from old.supervisor_notes and
     (new.work_order_id is distinct from old.work_order_id) and
     pg_trigger_depth()>1
  then return new; end if;
  raise exception 'Programação aprovada: alterações de equipe/dia exigem revisão formal.';
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
create trigger prevent_approved_assignment_changes before insert or update or delete
 on public.daily_team_assignments for each row execute function public.guard_approved_daily_assignment();

create or replace function public.register_daily_plan_approval(
 p_work_date date,p_manager_name text,p_approval_reference text,p_approved_on date
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare id_approval uuid;num_teams int;num_posts int;num_shifts int;
begin
 if auth.uid() is null or not exists (
  select 1 from public.app_memberships m where m.user_id=auth.uid()
  and m.enabled and m.role in ('admin','gestao','supervisao')
 ) then raise exception 'Acesso não autorizado para registrar aprovação externa';end if;
 if p_work_date is null or p_approved_on is null or p_approved_on>current_date
    or length(btrim(coalesce(p_manager_name,'')))<3
    or length(btrim(coalesce(p_approval_reference,'')))<5
 then raise exception 'Informe data, gestor, referência documental e data válida da aprovação';end if;
 perform pg_advisory_xact_lock(hashtextextended('siga-approval-'||p_work_date::text,0));
 if exists(select 1 from public.daily_plan_approvals where work_date=p_work_date) then
   raise exception 'Programação desta data já possui aprovação formal registrada';end if;
 select count(*) into num_teams from public.daily_team_assignments where work_date=p_work_date;
 select count(*) into num_posts from public.service_posts;
 if num_teams<>(select count(*) from public.teams where active)
   or num_posts=0 then raise exception 'Nem todas as equipes ativas e postos estão presentes na escala';end if;
 if exists(select 1 from public.daily_team_assignments
  where work_date=p_work_date and block_status='impedida') then
  raise exception 'Há equipes impedidas: regularize a programação antes da aprovação';end if;
 select count(*) into num_shifts from public.daily_shift_plans s
 where s.work_date=p_work_date and s.shift in ('manha','tarde')
 and length(btrim(s.planned_activity))>=3 and length(btrim(coalesce(s.planned_location,'')))>=3;
 if num_shifts<>2*(num_teams+num_posts) then
  raise exception 'Preencha manhã e tarde, com atividade e local, para todas as equipes e todos os postos (% de % turnos)',num_shifts,2*(num_teams+num_posts);
 end if;
 insert into public.daily_plan_approvals(work_date,manager_name,approval_reference,approved_on,recorded_by,team_count,post_count)
 values(p_work_date,btrim(p_manager_name),btrim(p_approval_reference),p_approved_on,auth.uid(),num_teams,num_posts)
 returning id into id_approval;
 return id_approval;
end;
$$;
revoke all on function public.register_daily_plan_approval(date,text,text,date) from public,anon;
grant execute on function public.register_daily_plan_approval(date,text,text,date) to authenticated;

create or replace function public.issue_approved_daily_work_orders(p_work_date date)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ap public.daily_plan_approvals%rowtype;
a public.daily_team_assignments%rowtype;post public.service_posts%rowtype;
morning public.daily_shift_plans%rowtype;afternoon public.daily_shift_plans%rowtype;
os_id uuid;new_orders int:=0;existing_orders int:=0;total_teams int;total_posts int;
descr text;site text;
begin
 if auth.uid() is null or not exists (
  select 1 from public.app_memberships m where m.user_id=auth.uid()
   and m.enabled and m.role in ('admin','gestao','supervisao')
 ) then raise exception 'Sem permissão para emitir OS em lote';end if;
 select * into ap from public.daily_plan_approvals where work_date=p_work_date for update;
 if not found then raise exception 'Registre primeiro a aprovação formal documentada do gestor';end if;
 select count(*) into total_teams from public.daily_team_assignments where work_date=p_work_date;
 select count(*) into total_posts from public.service_posts;
 if total_teams<>ap.team_count or total_posts<>ap.post_count then
  raise exception 'Equipe/postos alterados desde a aprovação; reavaliar o lote';end if;
 for a in select * from public.daily_team_assignments where work_date=p_work_date order by team_id loop
  if exists(select 1 from public.daily_plan_order_links where team_assignment_id=a.id) then
   existing_orders:=existing_orders+1;continue;end if;
  if a.work_order_id is not null then
    raise exception 'Equipe já possui OS fora deste lote. Reconciliar antes de emitir novamente';end if;
  if a.block_status='impedida' then raise exception 'Equipe impedida: lote não pode ser emitido';end if;
  select * into morning from public.daily_shift_plans where team_assignment_id=a.id and shift='manha';
  select * into afternoon from public.daily_shift_plans where team_assignment_id=a.id and shift='tarde';
  if morning.id is null or afternoon.id is null or length(btrim(coalesce(morning.planned_location,'')))<3 or length(btrim(coalesce(afternoon.planned_location,'')))<3
   then raise exception 'Programação de equipe com turno incompleto';end if;
  descr:='Proposta aprovada por '||ap.manager_name||' em '||ap.approved_on||
   '. Referência documental: '||ap.approval_reference||'. '||
   'MANHÃ: '||morning.planned_activity||'. TARDE: '||afternoon.planned_activity||
   '. Planejamento não comprova execução ou medição.';
  site:='Manhã: '||morning.planned_location||' | Tarde: '||afternoon.planned_location;
  insert into public.work_orders(reference,description,contract_item_id,area_id,team_id,location,status,priority,due_on,quantity,unit)
  values('',descr,a.contract_item_id,a.area_id,a.team_id,site,'programada','normal',p_work_date,null,null)
  returning id into os_id;
  insert into public.daily_plan_order_links(approval_id,work_order_id,work_date,team_assignment_id)
  values(ap.id,os_id,p_work_date,a.id);
  update public.daily_team_assignments set work_order_id=os_id,updated_at=now() where id=a.id;
  new_orders:=new_orders+1;
 end loop;
 for post in select * from public.service_posts order by code loop
  if exists(select 1 from public.daily_plan_order_links where service_post_id=post.id and work_date=p_work_date) then
   existing_orders:=existing_orders+1;continue;end if;
  select * into morning from public.daily_shift_plans where service_post_id=post.id and work_date=p_work_date and shift='manha';
  select * into afternoon from public.daily_shift_plans where service_post_id=post.id and work_date=p_work_date and shift='tarde';
  if morning.id is null or afternoon.id is null or length(btrim(coalesce(morning.planned_location,'')))<3 or length(btrim(coalesce(afternoon.planned_location,'')))<3
  then raise exception 'Posto fixo com turno incompleto';end if;
  descr:='ORIENTAÇÃO OPERACIONAL - Posto fixo '||post.code||' - '||post.name||
   ' (item 3.40, remuneração mensal). MANHÃ: '||morning.planned_activity||
   '. TARDE: '||afternoon.planned_activity||'. Aprovação: '||ap.manager_name||
   ' ('||ap.approval_reference||'). NÃO GERAR MEDIÇÃO DIÁRIA ADICIONAL.';
  site:='Manhã: '||morning.planned_location||' | Tarde: '||afternoon.planned_location;
  insert into public.work_orders(reference,description,contract_item_id,area_id,team_id,location,status,priority,due_on,quantity,unit)
  values('',descr,null,post.area_id,null,site,'programada','normal',p_work_date,null,null)
  returning id into os_id;
  insert into public.daily_plan_order_links(approval_id,work_order_id,work_date,service_post_id)
  values(ap.id,os_id,p_work_date,post.id);
  new_orders:=new_orders+1;
 end loop;
 return jsonb_build_object('created',new_orders,'already_existing',existing_orders,
  'total',new_orders+existing_orders,'approval_reference',ap.approval_reference,'work_date',p_work_date);
end;
$$;
revoke all on function public.issue_approved_daily_work_orders(date) from public,anon;
grant execute on function public.issue_approved_daily_work_orders(date) to authenticated;
