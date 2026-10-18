begin;
create table if not exists public.contract_resource_requirements(
 id uuid primary key default gen_random_uuid(),
 contract_id uuid references public.contracts(id) on delete restrict,
 source_ref text not null,
 category text not null check(category in ('mao_de_obra','veiculo','equipamento','ferramenta','epi','uniforme','capacitação','outro')),
 item_name text not null,
 required_quantity numeric(14,3),
 unit text not null default 'un',
 periodicity text,
 applicability text,
 validation_status text not null default 'a_conferir' check(validation_status in ('a_conferir','conforme','faltante','nao_aplicavel')),
 observed_quantity numeric(14,3) check(observed_quantity>=0),
 remarks text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(source_ref,category,item_name)
);
alter table public.contract_resource_requirements enable row level security;
drop policy if exists siga_read on public.contract_resource_requirements;
create policy siga_read on public.contract_resource_requirements for select to authenticated using(siga_private.is_active_member());
drop policy if exists siga_insert on public.contract_resource_requirements;
create policy siga_insert on public.contract_resource_requirements for insert to authenticated with check(siga_private.can_write());
drop policy if exists siga_update on public.contract_resource_requirements;
create policy siga_update on public.contract_resource_requirements for update to authenticated using(siga_private.can_write()) with check(siga_private.can_write());
grant select,insert,update on public.contract_resource_requirements to authenticated;
drop trigger if exists touch_row on public.contract_resource_requirements;
create trigger touch_row before update on public.contract_resource_requirements for each row execute function public.touch_updated_at();
drop trigger if exists audit_row on public.contract_resource_requirements;
create trigger audit_row after insert or update or delete on public.contract_resource_requirements for each row execute function siga_private.audit_row_change();
commit;