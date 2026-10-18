-- SIGA Américas: registros de campo por técnico e conferência de quantitativos
-- Não altera quantidades contratuais nem importa execução presumida.
begin;

alter table public.app_memberships drop constraint if exists app_memberships_role_check;
alter table public.app_memberships add constraint app_memberships_role_check
 check(role in ('admin','gestao','supervisao','consulta','tecnico'));
alter table public.app_memberships
 add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.contract_resource_requirements
 add column if not exists inventory_note text,
 add column if not exists quantity_checked_at timestamptz,
 add column if not exists quantity_checked_by uuid references auth.users(id) on delete set null;

create or replace function siga_private.is_own_field_team(target_team uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
  select exists(
    select 1 from public.app_memberships m
    where m.user_id=auth.uid() and m.enabled=true
      and m.role='tecnico' and m.team_id=target_team
  );
$fn$;
revoke all on function siga_private.is_own_field_team(uuid) from public, anon;
grant execute on function siga_private.is_own_field_team(uuid) to authenticated;

create table if not exists public.field_daily_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  area_id uuid not null references public.operational_areas(id) on delete restrict,
  report_date date not null,
  shift text not null default 'integral' check(shift in ('manha','tarde','integral','outro')),
  reported_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  team_leader text,
  weather text check(weather in ('ensolarado','nublado','chuva','temporal','variavel','nao_informado')),
  field_conditions text,
  equipment_used text,
  team_size integer check(team_size>=0),
  general_notes text,
  impediments text,
  status text not null default 'rascunho' check(status in ('rascunho','enviado','validado','devolvido')),
  supervisor_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.field_daily_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.field_daily_reports(id) on delete cascade,
  activity_id uuid not null references public.activity_catalog(id) on delete restrict,
  work_order_id uuid references public.work_orders(id) on delete set null,
  field_plan_item_id uuid references public.field_plan_items(id) on delete set null,
  location text,
  result text not null default 'executada' check(result in ('executada','parcial','impedida','nao_aplicavel')),
  hours_worked numeric(7,2) check(hours_worked>=0 and hours_worked<=24),
  quantity numeric(14,3) check(quantity>=0),
  unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.field_daily_attendance (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.field_daily_reports(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  presence_status text not null default 'presente'
    check(presence_status in ('presente','ausente','folga','outro')),
  hours_worked numeric(7,2) check(hours_worked>=0 and hours_worked<=24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_id,employee_id)
);

alter table public.field_daily_reports enable row level security;
alter table public.field_daily_report_items enable row level security;
alter table public.field_daily_attendance enable row level security;

create or replace function siga_private.can_read_field_report(report uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select siga_private.can_read_sensitive() or exists(
    select 1 from public.field_daily_reports r
    where r.id=report and siga_private.is_own_field_team(r.team_id)
 );
$fn$;
create or replace function siga_private.can_edit_field_draft(report uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select siga_private.can_write() or exists(
   select 1 from public.field_daily_reports r
   where r.id=report and r.status='rascunho'
     and r.reported_by=auth.uid()
     and siga_private.is_own_field_team(r.team_id)
 );
$fn$;
revoke all on function siga_private.can_read_field_report(uuid) from public,anon;
revoke all on function siga_private.can_edit_field_draft(uuid) from public,anon;
grant execute on function siga_private.can_read_field_report(uuid) to authenticated;
grant execute on function siga_private.can_edit_field_draft(uuid) to authenticated;

drop policy if exists field_reports_read on public.field_daily_reports;
create policy field_reports_read on public.field_daily_reports for select to authenticated
 using(siga_private.can_read_sensitive() or siga_private.is_own_field_team(team_id));
drop policy if exists field_reports_insert on public.field_daily_reports;
create policy field_reports_insert on public.field_daily_reports for insert to authenticated
 with check((siga_private.can_write() and reported_by=auth.uid())
 or (siga_private.is_own_field_team(team_id) and reported_by=auth.uid() and status='rascunho'));
drop policy if exists field_reports_update on public.field_daily_reports;
create policy field_reports_update on public.field_daily_reports for update to authenticated
 using(siga_private.can_write() or
      (reported_by=auth.uid() and status in ('rascunho','devolvido') and siga_private.is_own_field_team(team_id)))
 with check(siga_private.can_write() or
      (reported_by=auth.uid() and status in ('rascunho','enviado') and siga_private.is_own_field_team(team_id)));
drop policy if exists field_items_read on public.field_daily_report_items;
create policy field_items_read on public.field_daily_report_items for select to authenticated
 using(siga_private.can_read_field_report(report_id));
drop policy if exists field_items_insert on public.field_daily_report_items;
create policy field_items_insert on public.field_daily_report_items for insert to authenticated
 with check(siga_private.can_edit_field_draft(report_id));
drop policy if exists field_items_update on public.field_daily_report_items;
create policy field_items_update on public.field_daily_report_items for update to authenticated
 using(siga_private.can_edit_field_draft(report_id))
 with check(siga_private.can_edit_field_draft(report_id));
drop policy if exists field_items_delete on public.field_daily_report_items;
create policy field_items_delete on public.field_daily_report_items for delete to authenticated
 using(siga_private.can_edit_field_draft(report_id));
drop policy if exists field_attendance_read on public.field_daily_attendance;
create policy field_attendance_read on public.field_daily_attendance for select to authenticated
 using(siga_private.can_read_field_report(report_id));
drop policy if exists field_attendance_insert on public.field_daily_attendance;
create policy field_attendance_insert on public.field_daily_attendance for insert to authenticated
 with check(siga_private.can_edit_field_draft(report_id));
drop policy if exists field_attendance_update on public.field_daily_attendance;
create policy field_attendance_update on public.field_daily_attendance for update to authenticated
 using(siga_private.can_edit_field_draft(report_id))
 with check(siga_private.can_edit_field_draft(report_id));
drop policy if exists field_attendance_delete on public.field_daily_attendance;
create policy field_attendance_delete on public.field_daily_attendance for delete to authenticated
 using(siga_private.can_edit_field_draft(report_id));

-- Uma pessoa de equipe vê apenas os trabalhadores vinculados à sua própria equipe.
drop policy if exists employees_team_read on public.employees;
create policy employees_team_read on public.employees for select to authenticated
 using(siga_private.is_own_field_team(team_id));

-- Ordens de serviço são filtradas por equipe para o perfil de técnico.
drop policy if exists siga_read on public.work_orders;
create policy siga_read on public.work_orders for select to authenticated
 using(siga_private.can_read_sensitive() or siga_private.is_own_field_team(team_id));

grant select,insert,update on public.field_daily_reports,public.field_daily_report_items,public.field_daily_attendance to authenticated;
grant delete on public.field_daily_report_items,public.field_daily_attendance to authenticated;
do $do$
declare t text;
begin
 foreach t in array array['field_daily_reports','field_daily_report_items','field_daily_attendance'] loop
  execute format('drop trigger if exists touch_row on public.%I',t);
  execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated_at()',t);
  execute format('drop trigger if exists audit_row on public.%I',t);
  execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function siga_private.audit_row_change()',t);
 end loop;
end $do$;

create index if not exists idx_field_reports_team_date on public.field_daily_reports(team_id,report_date desc);
create index if not exists idx_field_reports_status on public.field_daily_reports(status,report_date desc);
create index if not exists idx_field_items_activity on public.field_daily_report_items(activity_id);
create index if not exists idx_field_attendance_employee on public.field_daily_attendance(employee_id);

commit;