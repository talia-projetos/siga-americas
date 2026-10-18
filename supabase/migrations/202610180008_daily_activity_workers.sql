-- Vincula cada atividade realizada aos trabalhadores que participaram.
begin;
create table if not exists public.field_daily_item_workers(
 id uuid primary key default gen_random_uuid(),
 report_item_id uuid not null references public.field_daily_report_items(id) on delete cascade,
 employee_id uuid not null references public.employees(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(report_item_id,employee_id)
);
alter table public.field_daily_item_workers enable row level security;
create or replace function siga_private.can_read_field_item(item uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(select 1 from public.field_daily_report_items i
 where i.id=item and siga_private.can_read_field_report(i.report_id));
$fn$;
create or replace function siga_private.can_edit_field_item(item uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(select 1 from public.field_daily_report_items i
 where i.id=item and siga_private.can_edit_field_draft(i.report_id));
$fn$;
create or replace function siga_private.employee_in_report_team(item uuid,employee uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(
 select 1 from public.field_daily_report_items i
 join public.field_daily_reports r on r.id=i.report_id
 join public.employees e on e.id=employee and e.team_id=r.team_id
 where i.id=item);
$fn$;
revoke all on function siga_private.can_read_field_item(uuid) from public,anon;
revoke all on function siga_private.can_edit_field_item(uuid) from public,anon;
revoke all on function siga_private.employee_in_report_team(uuid,uuid) from public,anon;
grant execute on function siga_private.can_read_field_item(uuid) to authenticated;
grant execute on function siga_private.can_edit_field_item(uuid) to authenticated;
grant execute on function siga_private.employee_in_report_team(uuid,uuid) to authenticated;

drop policy if exists field_item_workers_read on public.field_daily_item_workers;
create policy field_item_workers_read on public.field_daily_item_workers
for select to authenticated using(siga_private.can_read_field_item(report_item_id));
drop policy if exists field_item_workers_insert on public.field_daily_item_workers;
create policy field_item_workers_insert on public.field_daily_item_workers
for insert to authenticated with check(siga_private.can_edit_field_item(report_item_id) and siga_private.employee_in_report_team(report_item_id,employee_id));
drop policy if exists field_item_workers_delete on public.field_daily_item_workers;
create policy field_item_workers_delete on public.field_daily_item_workers
for delete to authenticated using(siga_private.can_edit_field_item(report_item_id));
grant select,insert,delete on public.field_daily_item_workers to authenticated;
drop trigger if exists audit_row on public.field_daily_item_workers;
create trigger audit_row after insert or update or delete on public.field_daily_item_workers
for each row execute function siga_private.audit_row_change();
create index if not exists idx_field_item_workers_employee on public.field_daily_item_workers(employee_id);
commit;