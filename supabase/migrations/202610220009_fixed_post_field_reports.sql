-- SIGA Américas: identificar posto fixo em cada execução semanal sem duplicar posto/equipe.
alter table public.field_daily_report_items add column if not exists service_post_id uuid references public.service_posts(id) on delete set null;
create index if not exists field_daily_items_service_post_idx on public.field_daily_report_items(service_post_id);
-- Mirante: posto contratual existente, mas ainda sem frente própria na base.
insert into public.operational_areas(code,name,active)
select 'EQ09','Mirante Central e Coordenação',true
where not exists(select 1 from public.operational_areas where code='EQ09');
update public.service_posts set area_id=(select id from public.operational_areas where code='EQ09')
where code='05' and area_id is null;
-- Postos 01-06 são atendidos por Jardinagem (EQ06), inclusive o posto no RBV.
create or replace function public.validate_field_item_service_post()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare post_area uuid; team_code text;
begin
 if new.service_post_id is null then return new; end if;
 select p.area_id into post_area from public.service_posts p where p.id=new.service_post_id;
 if not found then raise exception 'Posto fixo não encontrado'; end if;
 select t.code into team_code from public.field_daily_reports r join public.teams t on t.id=r.team_id where r.id=new.report_id;
 if team_code<>'EQ06' then raise exception 'Postos fixos devem constar da equipe de Jardinagem'; end if;
 if post_area is not null and new.area_id is distinct from post_area then
   raise exception 'Frente do registro não corresponde ao posto selecionado';
 end if;
 if new.work_order_id is not null and exists(
    select 1 from public.daily_plan_order_links l
    where l.work_order_id=new.work_order_id and l.service_post_id is not null
      and l.service_post_id<>new.service_post_id
 ) then raise exception 'OS de posto fixo pertence a outro posto'; end if;
 return new;
end;
$$;
drop trigger if exists validate_field_item_service_post on public.field_daily_report_items;
create trigger validate_field_item_service_post
before insert or update of service_post_id,report_id,area_id,work_order_id on public.field_daily_report_items
for each row execute function public.validate_field_item_service_post();
-- Técnicos da Jardinagem precisam visualizar OS operacionais de postos sem team_id,
-- exclusivamente quando emitidas e vinculadas a um dos postos fixos.
drop policy if exists siga_read on public.work_orders;
create policy siga_read on public.work_orders for select to authenticated using (
 siga_private.can_read_sensitive()
 or siga_private.is_own_field_team(team_id)
 or (
   exists (select 1 from public.daily_plan_order_links l where l.work_order_id=work_orders.id and l.service_post_id is not null)
   and exists(select 1 from public.teams t where t.code='EQ06' and siga_private.is_own_field_team(t.id))
 )
);
