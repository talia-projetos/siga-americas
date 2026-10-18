-- Garante que presença informada no relatório corresponda à equipe registrada.
begin;
create or replace function siga_private.employee_in_daily_team(report uuid,employee uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select exists(
  select 1 from public.field_daily_reports r
  join public.employees e on e.id=employee and e.team_id=r.team_id
  where r.id=report
 );
$fn$;
revoke all on function siga_private.employee_in_daily_team(uuid,uuid) from public,anon;
grant execute on function siga_private.employee_in_daily_team(uuid,uuid) to authenticated;
drop policy if exists field_attendance_insert on public.field_daily_attendance;
create policy field_attendance_insert on public.field_daily_attendance
for insert to authenticated with check(
 siga_private.can_edit_field_draft(report_id) and
 siga_private.employee_in_daily_team(report_id,employee_id)
);
drop policy if exists field_attendance_update on public.field_daily_attendance;
create policy field_attendance_update on public.field_daily_attendance
for update to authenticated
using(siga_private.can_edit_field_draft(report_id))
with check(
 siga_private.can_edit_field_draft(report_id) and
 siga_private.employee_in_daily_team(report_id,employee_id)
);
commit;