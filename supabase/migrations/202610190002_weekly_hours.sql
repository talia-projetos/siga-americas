begin;
-- Uma atividade semanal pode acumular mais de 24 horas; limite máximo = 7 dias x 24 horas.
alter table public.field_daily_report_items
 drop constraint if exists field_daily_report_items_hours_worked_check;
alter table public.field_daily_report_items
 add constraint field_daily_report_items_hours_worked_check
 check (hours_worked>=0 and hours_worked<=168);
alter table public.field_daily_attendance
 drop constraint if exists field_daily_attendance_hours_worked_check;
alter table public.field_daily_attendance
 add constraint field_daily_attendance_hours_worked_check
 check (hours_worked>=0 and hours_worked<=168);
commit;