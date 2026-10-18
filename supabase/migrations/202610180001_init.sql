-- SIGA Américas · Fundação relacional PostgreSQL / Supabase
-- Migração inicial aditiva. Não apaga nem substitui tabelas preexistentes.
-- Revisar no Supabase SQL Editor antes de executar em ambiente de produção.
begin;

create extension if not exists pgcrypto;

create table if not exists public.app_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','gestao','supervisao','consulta')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_memberships where user_id=auth.uid() and enabled=true) $$;
create or replace function public.can_write()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_memberships where user_id=auth.uid() and enabled=true and role in ('admin','gestao','supervisao')) $$;
create or replace function public.can_read_sensitive()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_memberships where user_id=auth.uid() and enabled=true and role in ('admin','gestao','supervisao')) $$;
create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.app_memberships where user_id=auth.uid() and enabled=true and role='admin') $$;

create table if not exists public.contracts (
 id uuid primary key default gen_random_uuid(),
 code text not null unique, title text not null,
 contractor text, client text, status text not null default 'vigente',
 starts_on date, ends_on date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.teams (
 id uuid primary key default gen_random_uuid(),
 code text not null unique, name text not null, lead text,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.operational_areas (
 id uuid primary key default gen_random_uuid(),
 code text not null unique, name text not null, location text,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contract_items (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 code text not null, name text not null,
 source_type text not null check (source_type in ('especificacao','precos')),
 unit text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(contract_id,source_type,code)
);
create table if not exists public.contract_obligations (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.contracts(id) on delete restrict,
 source_ref text not null, title text not null, description text, responsible text,
 status text not null default 'pendente' check (status in ('pendente','em_adequacao','conforme','nao_aplicavel')),
 due_on date, evidence_ref text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.employees (
 id uuid primary key default gen_random_uuid(),
 name text not null, job_title text not null, team_id uuid references public.teams(id) on delete set null,
 shirt_size text, pants_size text, shoe_size text,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.vehicles (
 id uuid primary key default gen_random_uuid(),
 plate text not null unique, description text not null, asset_tag text,
 team_id uuid references public.teams(id) on delete set null,
 keeper_id uuid references public.employees(id) on delete set null,
 fuel_type text check (fuel_type in ('diesel','gasolina','etanol','outro')),
 odometer numeric(13,1) check (odometer>=0),
 status text not null default 'disponivel' check (status in ('disponivel','em_manutencao','indisponivel','desativado')),
 notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fuel_logs (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid not null references public.vehicles(id) on delete restrict,
 driver_id uuid references public.employees(id) on delete set null,
 filled_on date not null, liters numeric(12,3) not null check (liters>0),
 total_cost numeric(14,2) not null check (total_cost>=0),
 odometer numeric(13,1) check (odometer>=0),
 supplier_type text not null check (supplier_type in ('proerg','itaipu','outro')),
 receipt_ref text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.equipment (
 id uuid primary key default gen_random_uuid(),
 asset_tag text not null unique, name text not null,
 category text not null check(category in ('ferramenta_manual','maquina_motorizada','equipamento','outro')),
 brand text, model text, serial_number text,
 team_id uuid references public.teams(id) on delete set null,
 keeper_id uuid references public.employees(id) on delete set null,
 owner_type text not null check(owner_type in ('proerg','itaipu')),
 condition text not null default 'bom' check(condition in ('bom','requer_atencao','em_manutencao','inutilizavel')),
 next_service_on date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.responsibility_terms (
 id uuid primary key default gen_random_uuid(),
 term_code text not null unique,
 employee_id uuid not null references public.employees(id) on delete restrict,
 vehicle_id uuid references public.vehicles(id) on delete restrict,
 equipment_id uuid references public.equipment(id) on delete restrict,
 assigned_on date not null, returned_on date,
 status text not null default 'pendente_assinatura' check (status in ('ativo','encerrado','pendente_assinatura')),
 condition_report text, document_ref text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint one_subject_term check (num_nonnulls(vehicle_id,equipment_id)=1),
 constraint valid_term_period check (returned_on is null or returned_on>=assigned_on)
);
create table if not exists public.maintenance_events (
 id uuid primary key default gen_random_uuid(),
 vehicle_id uuid references public.vehicles(id) on delete restrict,
 equipment_id uuid references public.equipment(id) on delete restrict,
 opened_on date not null, closed_on date,
 service_type text not null check(service_type in ('preventiva','corretiva')),
 status text not null default 'aberta' check(status in ('aberta','em_execucao','concluida','cancelada')),
 description text not null, supplier text, cost numeric(14,2) check(cost>=0),
 document_ref text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint one_maintenance_subject check (num_nonnulls(vehicle_id,equipment_id)=1),
 constraint valid_maintenance_period check (closed_on is null or closed_on>=opened_on)
);
create table if not exists public.ppe_items (
 id uuid primary key default gen_random_uuid(),
 name text not null, category text, ca_number text, ca_expires_on date,
 replacement_guidance text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ppe_deliveries (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id) on delete restrict,
 ppe_item_id uuid not null references public.ppe_items(id) on delete restrict,
 delivered_on date not null, quantity integer not null check(quantity>0),
 receipt_ref text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.uniform_deliveries (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id) on delete restrict,
 item_type text not null check(item_type in ('camisa_uv','camisa_polo','calca_tatica','outro')),
 size text not null, quantity integer not null check(quantity>0),
 delivered_on date not null, receipt_ref text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.stock_items (
 id uuid primary key default gen_random_uuid(),
 sku text not null unique, name text not null,
 unit text not null, min_quantity numeric(14,3) not null default 0 check(min_quantity>=0),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 stock_item_id uuid not null references public.stock_items(id) on delete restrict,
 occurred_on date not null, movement_type text not null check(movement_type in ('entrada','saida')),
 quantity numeric(14,3) not null check(quantity>0),
 team_id uuid references public.teams(id) on delete set null,
 document_ref text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.purchase_requests (
 id uuid primary key default gen_random_uuid(),
 requested_on date not null, description text not null,
 quantity numeric(14,3) not null check(quantity>0), unit text,
 priority text not null default 'normal' check(priority in ('normal','alta','critica')),
 status text not null default 'solicitada' check(status in ('solicitada','em_cotacao','aprovada','comprada','recebida','cancelada')),
 estimated_cost numeric(14,2) check(estimated_cost>=0),
 team_id uuid references public.teams(id) on delete set null,
 reason text, document_ref text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.work_orders (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique, description text not null,
 contract_item_id uuid references public.contract_items(id) on delete restrict,
 area_id uuid references public.operational_areas(id) on delete set null,
 team_id uuid references public.teams(id) on delete set null,
 location text,
 status text not null default 'aberta' check(status in ('aberta','programada','em_execucao','impedida','concluida','cancelada')),
 priority text not null default 'normal' check(priority in ('normal','alta','critica')),
 due_on date, quantity numeric(14,3) check(quantity>=0), unit text,
 impediment text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,
 table_name text not null, row_id uuid, action text not null,
 actor_id uuid, changed_at timestamptz not null default now(),
 old_data jsonb, new_data jsonb
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP = 'INSERT' then
   insert into public.audit_logs(table_name,row_id,action,actor_id,old_data,new_data)
   values(TG_TABLE_NAME,new.id,TG_OP,auth.uid(),null,to_jsonb(new));
   return new;
 elsif TG_OP = 'UPDATE' then
   insert into public.audit_logs(table_name,row_id,action,actor_id,old_data,new_data)
   values(TG_TABLE_NAME,new.id,TG_OP,auth.uid(),to_jsonb(old),to_jsonb(new));
   return new;
 else
   insert into public.audit_logs(table_name,row_id,action,actor_id,old_data,new_data)
   values(TG_TABLE_NAME,old.id,TG_OP,auth.uid(),to_jsonb(old),null);
   return old;
 end if;
end $$;

do $$
declare t text;
begin
 foreach t in array array[
 'contracts','contract_items','contract_obligations','teams','operational_areas',
 'employees','vehicles','fuel_logs','equipment','responsibility_terms','maintenance_events',
 'ppe_items','ppe_deliveries','uniform_deliveries','stock_items','stock_movements',
 'purchase_requests','work_orders'
 ] loop
 execute format('drop trigger if exists touch_row on public.%I',t);
 execute format('create trigger touch_row before update on public.%I for each row execute function public.touch_updated_at()',t);
 execute format('drop trigger if exists audit_row on public.%I',t);
 execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t);
 end loop;
end $$;

-- Regra de leitura/escrita para cada entidade. A aplicação NÃO é pública.
alter table public.app_memberships enable row level security;
drop policy if exists membership_read on public.app_memberships;
create policy membership_read on public.app_memberships for select to authenticated
using (user_id=auth.uid() or public.is_app_admin());
drop policy if exists membership_admin_insert on public.app_memberships;
create policy membership_admin_insert on public.app_memberships for insert to authenticated
with check (public.is_app_admin());
drop policy if exists membership_admin_update on public.app_memberships;
create policy membership_admin_update on public.app_memberships for update to authenticated
using (public.is_app_admin()) with check (public.is_app_admin());

do $$
declare t text;
begin
 foreach t in array array[
 'contracts','contract_items','contract_obligations','teams','operational_areas',
 'employees','vehicles','fuel_logs','equipment','responsibility_terms','maintenance_events',
 'ppe_items','ppe_deliveries','uniform_deliveries','stock_items','stock_movements',
 'purchase_requests','work_orders'
 ] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists siga_read on public.%I',t);
 execute format('drop policy if exists siga_insert on public.%I',t);
 execute format('drop policy if exists siga_update on public.%I',t);
 if t=any(array['employees','fuel_logs','responsibility_terms','maintenance_events','ppe_deliveries','uniform_deliveries','stock_movements','purchase_requests']) then
   execute format('create policy siga_read on public.%I for select to authenticated using (public.can_read_sensitive())',t);
 else
   execute format('create policy siga_read on public.%I for select to authenticated using (public.is_active_member())',t);
 end if;
 execute format('create policy siga_insert on public.%I for insert to authenticated with check (public.can_write())',t);
 execute format('create policy siga_update on public.%I for update to authenticated using (public.can_write()) with check (public.can_write())',t);
 end loop;
end $$;

alter table public.audit_logs enable row level security;
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
using (public.can_read_sensitive());

-- SELECT, INSERT e UPDATE explícitos; nenhuma exclusão operacional via aplicativo.
grant select,insert,update on public.app_memberships to authenticated;
do $$
declare t text;
begin
 foreach t in array array[
 'contracts','contract_items','contract_obligations','teams','operational_areas','employees',
 'vehicles','fuel_logs','equipment','responsibility_terms','maintenance_events',
 'ppe_items','ppe_deliveries','uniform_deliveries','stock_items','stock_movements',
 'purchase_requests','work_orders'
 ] loop
 execute format('grant select,insert,update on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.audit_logs to authenticated;
revoke insert,update,delete on public.audit_logs from authenticated,anon;
revoke all on public.app_memberships from anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.can_write() to authenticated;
grant execute on function public.can_read_sensitive() to authenticated;
grant execute on function public.is_app_admin() to authenticated;

-- Cadastro de frentes, NÃO representa criação de novas equipes.
insert into public.operational_areas(code,name,location) values
 ('EQ01','UHI A: Global','Usina / apoio geral'),
 ('EQ02','UHI B: Vilas','Vilas'),
 ('EQ03','UHI C: Usina','Usina'),
 ('EQ04','RBV: Viveiro','Refúgio Biológico Bela Vista'),
 ('EQ05','RBV: Manutenção','Refúgio Biológico Bela Vista'),
 ('EQ06','Centro Executivo / Gramadão','Centro Executivo e Gramadão'),
 ('EQ07','Ecomuseu','Ecomuseu'),
 ('EQ08','CRV','Centro de Recepção de Visitantes')
on conflict (code) do nothing;

create index if not exists idx_work_orders_status on public.work_orders(status,due_on);
create index if not exists idx_contract_items_source on public.contract_items(source_type,code);
create index if not exists idx_fuel_vehicle_date on public.fuel_logs(vehicle_id,filled_on desc);
create index if not exists idx_maintenance_vehicle on public.maintenance_events(vehicle_id,opened_on desc);
create index if not exists idx_maintenance_equipment on public.maintenance_events(equipment_id,opened_on desc);
create index if not exists idx_ppe_deliveries_employee on public.ppe_deliveries(employee_id,delivered_on desc);
create index if not exists idx_uniform_deliveries_employee on public.uniform_deliveries(employee_id,delivered_on desc);
create index if not exists idx_stock_movement_item on public.stock_movements(stock_item_id,occurred_on desc);
create index if not exists idx_audit_logs_time on public.audit_logs(changed_at desc);

commit;

-- PRIMEIRO USUÁRIO (executar separadamente, substituindo o e-mail):
-- 1. Criar usuário no Supabase > Authentication > Users.
-- 2. Executar como administrador do banco:
-- insert into public.app_memberships(user_id,role)
-- select id,'admin' from auth.users where email='EMAIL_DO_ADMINISTRADOR';
-- A senha nunca deve ser incluída no SQL ou no repositório.
