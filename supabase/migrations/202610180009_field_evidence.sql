begin;
alter table public.field_daily_report_items
 add column if not exists evidence_ref text;
create index if not exists idx_field_report_user_status on public.field_daily_reports(reported_by,status,report_date desc);
commit;