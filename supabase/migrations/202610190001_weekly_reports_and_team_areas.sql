-- SIGA Américas · Relatórios semanais e frentes por equipe.
-- Preserva os registros antigos de tipo diário, sem conversão presumida.
begin;

create table if not exists public.team_operational_areas (
  team_id uuid not null references public.teams(id) on delete cascade,
  area_id uuid not null references public.operational_areas(id) on delete restrict,
  active boolean not null default true,
  assignment_note text,
  created_at timestamptz not null default now(),
  primary key (team_id, area_id)
);
alter table public.team_operational_areas enable row level security;
drop policy if exists team_area_read on public.team_operational_areas;
create policy team_area_read on public.team_operational_areas for select to authenticated
  using (siga_private.is_active_member());
drop policy if exists team_area_insert on public.team_operational_areas;
create policy team_area_insert on public.team_operational_areas for insert to authenticated
  with check (siga_private.can_write());
drop policy if exists team_area_update on public.team_operational_areas;
create policy team_area_update on public.team_operational_areas for update to authenticated
  using (siga_private.can_write()) with check (siga_private.can_write());
grant select,insert,update on public.team_operational_areas to authenticated;

-- EQ01 a EQ05 possuem uma frente de referência, EQ06 cobre os três postos descentralizados.
insert into public.team_operational_areas(team_id,area_id,assignment_note)
select t.id,a.id,case when t.code='EQ06' then 'Postos descentralizados atendidos pela EQ06' else 'Frente principal da equipe' end
from (values
 ('EQ01','EQ01'),('EQ02','EQ02'),('EQ03','EQ03'),('EQ04','EQ04'),('EQ05','EQ05'),
 ('EQ06','EQ06'),('EQ06','EQ07'),('EQ06','EQ08')
) as assignment(team_code,area_code)
join public.teams t on t.code=assignment.team_code
join public.operational_areas a on a.code=assignment.area_code
on conflict (team_id,area_id) do update set active=true;

alter table public.field_daily_reports
  add column if not exists report_period text not null default 'diario',
  add column if not exists period_start date,
  add column if not exists period_end date;
alter table public.field_daily_reports drop constraint if exists siga_field_report_period_check;
alter table public.field_daily_reports add constraint siga_field_report_period_check check (
 report_period='diario' and period_start is null and period_end is null
 or report_period='semanal' and period_start is not null and period_end is not null
   and period_end=period_start+6
   and extract(isodow from period_start)=1
   and report_date=period_start
);
alter table public.field_daily_report_items
  add column if not exists area_id uuid references public.operational_areas(id) on delete restrict;

create unique index if not exists idx_field_report_one_week_per_team
  on public.field_daily_reports (team_id,period_start) where report_period='semanal';
create index if not exists idx_field_reports_week_review
  on public.field_daily_reports(report_period,period_start desc,status);
create index if not exists idx_field_items_area on public.field_daily_report_items(area_id);

-- Impede que a API registre frentes fora da associação equipe-frente.
create or replace function siga_private.validate_weekly_team_area()
returns trigger language plpgsql security definer set search_path='' as $body$
begin
 if new.report_period='semanal' and not exists (
   select 1 from public.team_operational_areas ta
   where ta.team_id=new.team_id and ta.area_id=new.area_id and ta.active
 ) then
   raise exception 'A frente principal não está vinculada à equipe selecionada.'
   using errcode='23514';
 end if;
 return new;
end;
$body$;
drop trigger if exists validate_weekly_team_area on public.field_daily_reports;
create trigger validate_weekly_team_area
before insert or update of team_id,area_id,report_period on public.field_daily_reports
for each row execute function siga_private.validate_weekly_team_area();

create or replace function siga_private.validate_weekly_item_area()
returns trigger language plpgsql security definer set search_path='' as $body$
declare parent_team uuid; parent_area uuid; parent_period text;
begin
 select r.team_id,r.area_id,r.report_period
 into parent_team,parent_area,parent_period
 from public.field_daily_reports r where r.id=new.report_id;
 if parent_team is null then return new; end if;
 if parent_period='semanal' then
   new.area_id=coalesce(new.area_id,parent_area);
   if not exists (
     select 1 from public.team_operational_areas ta
     where ta.team_id=parent_team and ta.area_id=new.area_id and ta.active
   ) then
     raise exception 'Esta frente não está associada à equipe deste relatório.'
     using errcode='23514';
   end if;
 end if;
 return new;
end;
$body$;
drop trigger if exists validate_weekly_item_area on public.field_daily_report_items;
create trigger validate_weekly_item_area before insert or update of area_id,report_id
on public.field_daily_report_items
for each row execute function siga_private.validate_weekly_item_area();

commit;