-- Evita atualização de lançamento diário após sua aprovação formal.
-- A ligação da OS é registrada em daily_plan_order_links.
CREATE OR REPLACE FUNCTION public.issue_approved_daily_work_orders(p_work_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- Vínculo de OS preservado exclusivamente na tabela de rastreabilidade.
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
$function$
;
