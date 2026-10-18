begin;
alter table public.contract_items drop constraint if exists contract_items_source_type_check;
alter table public.contract_items add constraint contract_items_source_type_check
 check(source_type in ('especificacao','precos','matriz_interna'));
update public.contract_items
set source_type='matriz_interna',
 notes='Matriz interna de 73 atividades (códigos próprios); conferir correspondência com o Anexo I e com a planilha de preços.'
where source_type='especificacao' and notes like 'Matriz interna de 73 atividades%';

create table if not exists public.field_routine_templates(
 id uuid primary key default gen_random_uuid(),
 service_post_id uuid not null references public.service_posts(id) on delete restrict,
 routine_code text not null,
 title text not null,
 frequency text not null check(frequency in ('diaria','semanal','mensal')),
 contract_ref text not null default '3.40',
 execution_guidance text,
 safety_notes text,
 active boolean not null default true,
 validation_status text not null default 'a_conferir'
 check(validation_status in ('a_conferir','validada','ajustar')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(service_post_id,routine_code)
);
create table if not exists public.field_routine_records(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.field_routine_templates(id) on delete restrict,
 performed_on date not null,
 employee_id uuid references public.employees(id) on delete set null,
 work_order_id uuid references public.work_orders(id) on delete set null,
 status text not null default 'pendente'
 check(status in ('pendente','realizada','impedida','nao_aplicavel')),
 quantity numeric(14,3) check(quantity>=0),
 notes text,evidence_ref text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.field_routine_templates enable row level security;
alter table public.field_routine_records enable row level security;
drop policy if exists siga_read on public.field_routine_templates;
create policy siga_read on public.field_routine_templates for select to authenticated using(siga_private.is_active_member());
drop policy if exists siga_read on public.field_routine_records;
create policy siga_read on public.field_routine_records for select to authenticated using(siga_private.can_read_sensitive());
drop policy if exists siga_insert on public.field_routine_templates;
create policy siga_insert on public.field_routine_templates for insert to authenticated with check(siga_private.can_write());
drop policy if exists siga_insert on public.field_routine_records;
create policy siga_insert on public.field_routine_records for insert to authenticated with check(siga_private.can_write());
drop policy if exists siga_update on public.field_routine_templates;
create policy siga_update on public.field_routine_templates for update to authenticated using(siga_private.can_write()) with check(siga_private.can_write());
drop policy if exists siga_update on public.field_routine_records;
create policy siga_update on public.field_routine_records for update to authenticated using(siga_private.can_write()) with check(siga_private.can_write());
grant select,insert,update on public.field_routine_templates,public.field_routine_records to authenticated;
drop trigger if exists touch_row on public.field_routine_templates;
create trigger touch_row before update on public.field_routine_templates for each row execute function public.touch_updated_at();
drop trigger if exists audit_row on public.field_routine_templates;
create trigger audit_row after insert or update or delete on public.field_routine_templates for each row execute function siga_private.audit_row_change();
drop trigger if exists touch_row on public.field_routine_records;
create trigger touch_row before update on public.field_routine_records for each row execute function public.touch_updated_at();
drop trigger if exists audit_row on public.field_routine_records;
create trigger audit_row after insert or update or delete on public.field_routine_records for each row execute function siga_private.audit_row_change();
create index if not exists field_routines_date on public.field_routine_records(performed_on);
create index if not exists field_routines_post on public.field_routine_templates(service_post_id,frequency);
commit;