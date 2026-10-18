-- SIGA Américas: estrutura para exploração e cobertura do contrato.
-- Cadastros documentais e metas de execução são entidades distintas.
begin;
alter table public.employees
 add column if not exists source_group text,
 add column if not exists assignment_location text,
 add column if not exists operational_role text,
 add column if not exists review_status text not null default 'a_conferir',
 add column if not exists source_note text;
alter table public.contract_items
 add column if not exists estimated_quantity numeric(16,3),
 add column if not exists unit_price numeric(16,2),
 add column if not exists estimated_total numeric(17,2),
 add column if not exists reference_status text not null default 'documental';
create table if not exists public.activity_catalog(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 technical_lead text,
 itaipu_technical_contact text,
 contact_validation text not null default 'a_conferir',
 category text,
 notes text,
 source_reference text not null default 'Matriz interna de distribuição de atividades',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.service_posts(
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 name text not null,
 contractual_reference text not null,
 fixed_positions integer,
 area_id uuid references public.operational_areas(id) on delete set null,
 notes text,
 verification_status text not null default 'a_conferir',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.field_programs(
 id uuid primary key default gen_random_uuid(),
 area_id uuid not null references public.operational_areas(id) on delete restrict,
 team_id uuid references public.teams(id) on delete set null,
 period_month date not null,
 main_activity text not null,
 safe_alternative text,
 climate_context text,
 status text not null default 'a_validar'
 check(status in ('a_validar','aprovado','em_execucao','concluido','suspenso')),
 notes text,
 source_reference text not null default 'Planejamento_ITAIPU_Out2026_Jan2027.tsv',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(area_id,period_month)
);
create table if not exists public.field_plan_items(
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.field_programs(id) on delete restrict,
 contract_item_id uuid references public.contract_items(id) on delete set null,
 activity_id uuid references public.activity_catalog(id) on delete set null,
 planned_for date,
 priority text not null default 'normal' check(priority in ('normal','alta','critica')),
 opportunity text,
 climate_trigger text,
 action_status text not null default 'candidata'
 check(action_status in ('candidata','a_validar','programada','em_execucao','executada','inviavel','nao_aplicavel')),
 planned_quantity numeric(14,3) check(planned_quantity>=0),
 executed_quantity numeric(14,3) check(executed_quantity>=0),
 unit text, evidence_ref text, notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint field_plan_item_has_reference check(contract_item_id is not null or activity_id is not null)
);
alter table public.work_orders add column if not exists activity_id uuid references public.activity_catalog(id) on delete set null;
alter table public.work_orders add column if not exists field_program_id uuid references public.field_programs(id) on delete set null;

do $mig$
declare t text;
begin
 foreach t in array array['activity_catalog','service_posts','field_programs','field_plan_items']
 loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists siga_read on public.%I',t);
 execute format('drop policy if exists siga_insert on public.%I',t);
 execute format('drop policy if exists siga_update on public.%I',t);
 execute format('create policy siga_read on public.%I for select to authenticated using (siga_private.is_active_member())',t);
 execute format('create policy siga_insert on public.%I for insert to authenticated with check(siga_private.can_write())',t);
 execute format('create policy siga_update on public.%I for update to authenticated using(siga_private.can_write()) with check(siga_private.can_write())',t);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('drop trigger if exists touch_row on public.%I',t);
 execute format('drop trigger if exists audit_row on public.%I',t);
 execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated_at()',t);
 execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function siga_private.audit_row_change()',t);
 end loop;
end $mig$;
create index if not exists idx_fpi_program_period on public.field_programs(period_month);
create index if not exists idx_fpi_item_catalog on public.field_plan_items(contract_item_id,action_status);
create index if not exists idx_fpi_item_activity on public.field_plan_items(activity_id,action_status);
commit;