-- SIGA Américas · Fardamentos em lote, sem criar entregas fictícias.
-- Operações RPC transacionais; validação pelo perfil gestor e auditoria por gatilhos.
begin;

create table if not exists public.uniform_delivery_batches (
  id uuid primary key default gen_random_uuid(),
  request_token uuid not null unique,
  cycle_start date not null,
  delivered_on date not null,
  receipt_ref text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint uniform_batches_month_start check (extract(day from cycle_start)=1),
  constraint uniform_batches_delivery_window check
   (delivered_on >= cycle_start and delivered_on < (cycle_start + interval '6 months')::date)
);
create table if not exists public.uniform_delivery_batch_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.uniform_delivery_batches(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  cycle_start date not null,
  shirt_size text not null,
  pants_size text not null,
  created_at timestamptz not null default now(),
  unique(batch_id, employee_id),
  unique(employee_id, cycle_start),
  constraint uniform_recipient_shirt_size check(length(btrim(shirt_size)) between 1 and 12),
  constraint uniform_recipient_pants_size check(length(btrim(pants_size)) between 1 and 12)
);
alter table public.uniform_deliveries
 add column if not exists batch_id uuid references public.uniform_delivery_batches(id) on delete restrict;
create unique index if not exists uniform_batch_employee_item_unique
 on public.uniform_deliveries(batch_id,employee_id,item_type)
 where batch_id is not null;
create index if not exists uniform_batch_recipients_employee
 on public.uniform_delivery_batch_recipients(employee_id,cycle_start);
create index if not exists uniform_batches_delivered_at
 on public.uniform_delivery_batches(delivered_on desc);

alter table public.uniform_delivery_batches enable row level security;
alter table public.uniform_delivery_batch_recipients enable row level security;
drop policy if exists uniform_batches_read on public.uniform_delivery_batches;
create policy uniform_batches_read on public.uniform_delivery_batches
 for select to authenticated using(siga_private.can_read_sensitive());
drop policy if exists uniform_batch_recipients_read on public.uniform_delivery_batch_recipients;
create policy uniform_batch_recipients_read on public.uniform_delivery_batch_recipients
 for select to authenticated using(siga_private.can_read_sensitive());
grant select on public.uniform_delivery_batches,public.uniform_delivery_batch_recipients to authenticated;

drop trigger if exists uniform_batch_audit on public.uniform_delivery_batches;
create trigger uniform_batch_audit after insert or update or delete
 on public.uniform_delivery_batches for each row execute function siga_private.audit_row_change();
drop trigger if exists uniform_batch_recipient_audit on public.uniform_delivery_batch_recipients;
create trigger uniform_batch_recipient_audit after insert or update or delete
 on public.uniform_delivery_batch_recipients for each row execute function siga_private.audit_row_change();

-- Valida e atualiza tamanhos de vários colaboradores sem registrar nenhuma entrega.
create or replace function public.save_uniform_sizes(p_workers jsonb)
returns integer language plpgsql security definer set search_path=''
as $fn$
declare entry jsonb; emp uuid; shirt text; pants text; count_updated integer:=0; n integer;
begin
 if not siga_private.can_write() then raise exception 'Sem permissão para atualizar tamanhos.' using errcode='42501'; end if;
 if jsonb_typeof(p_workers) is distinct from 'array' then raise exception 'Lista inválida.' using errcode='22023'; end if;
 n=jsonb_array_length(p_workers);
 if n<1 or n>150 then raise exception 'Selecione de 1 a 150 colaboradores.' using errcode='22023'; end if;
 if (select count(distinct e->>'employee_id') from jsonb_array_elements(p_workers) e)<>n
 then raise exception 'Colaborador repetido na lista.' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_workers)
 loop
   emp=(entry->>'employee_id')::uuid;
   shirt=upper(btrim(coalesce(entry->>'shirt_size','')));
   pants=upper(btrim(coalesce(entry->>'pants_size','')));
   if length(shirt) not between 1 and 12 or length(pants) not between 1 and 12
   then raise exception 'Informe os tamanhos de camisa e calça.' using errcode='22023'; end if;
   update public.employees set shirt_size=shirt,pants_size=pants
   where id=emp and active=true;
   if not found then raise exception 'Colaborador ativo não encontrado.' using errcode='22023'; end if;
   count_updated=count_updated+1;
 end loop;
 return count_updated;
end
$fn$;

-- Gera em UMA transação três itens por trabalhador: 4 camisa UV + 1 polo + 4 calças.
-- Request token torna repetições de rede idempotentes, sem duplicar registros.
create or replace function public.create_uniform_bulk_delivery(
 p_request_token uuid,
 p_cycle_start date,
 p_delivered_on date,
 p_receipt_ref text,
 p_notes text,
 p_workers jsonb
)
returns table(batch_id uuid,recipient_count integer,piece_count integer)
language plpgsql security definer set search_path=''
as $fn$
declare
  entry jsonb; emp uuid; shirt text; pants text;
  batch_key uuid; total integer; item text; supplied integer;
  existing uuid;
begin
 if not siga_private.can_write() then raise exception 'Sem permissão para registrar entregas.' using errcode='42501'; end if;
 if p_request_token is null then raise exception 'Identificador de envio obrigatório.' using errcode='22023'; end if;

 select b.id into existing from public.uniform_delivery_batches b where b.request_token=p_request_token;
 if existing is not null then
   return query select existing,count(distinct r.employee_id)::integer,(count(distinct r.employee_id)*9)::integer
   from public.uniform_delivery_batch_recipients r where r.batch_id=existing;
   return;
 end if;

 if p_cycle_start is null or extract(day from p_cycle_start)<>1 or
    p_delivered_on is null or p_delivered_on>current_date or
    p_delivered_on<p_cycle_start or p_delivered_on>=(p_cycle_start+interval '6 months')::date
 then raise exception 'Informe um ciclo mensal válido e uma entrega efetivamente realizada dentro do semestre.' using errcode='22023'; end if;
 if length(coalesce(p_receipt_ref,''))>240 or length(coalesce(p_notes,''))>1500 then
   raise exception 'Comprovante ou observação muito extensos.' using errcode='22023'; end if;
 if jsonb_typeof(p_workers) is distinct from 'array' then raise exception 'Lista inválida.' using errcode='22023'; end if;
 total=jsonb_array_length(p_workers);
 if total<1 or total>150 then raise exception 'Selecione de 1 a 150 trabalhadores.' using errcode='22023'; end if;
 if (select count(distinct e->>'employee_id') from jsonb_array_elements(p_workers) e)<>total then
   raise exception 'Trabalhador repetido na seleção.' using errcode='22023'; end if;

 -- Trava os registros ativos antes de conferir sobreposições de ciclos.
 perform 1 from public.employees e
 where e.id in (select (entry->>'employee_id')::uuid from jsonb_array_elements(p_workers) entry)
 and e.active=true order by e.id for update;
 if (select count(*) from public.employees e where e.id in
   (select (entry->>'employee_id')::uuid from jsonb_array_elements(p_workers) entry) and e.active=true)<>total
 then raise exception 'Há trabalhadores não encontrados ou inativos.' using errcode='22023'; end if;

 -- Bloqueia kits duplicados e entregas individuais existentes na janela.
 if exists(
 select 1 from public.uniform_delivery_batch_recipients r
 where r.employee_id in (select (entry->>'employee_id')::uuid from jsonb_array_elements(p_workers) entry)
 and p_cycle_start < (r.cycle_start+interval '6 months')::date
 and r.cycle_start < (p_cycle_start+interval '6 months')::date
 ) then raise exception 'Um ou mais trabalhadores já têm um kit deste semestre. Retire-os da seleção.' using errcode='23505'; end if;
 if exists (
 select 1 from public.uniform_deliveries d
 where d.employee_id in (select (entry->>'employee_id')::uuid from jsonb_array_elements(p_workers) entry)
 and d.item_type in ('camisa_uv','camisa_polo','calca_tatica')
 and d.delivered_on >= p_cycle_start
 and d.delivered_on < (p_cycle_start+interval '6 months')::date
 ) then raise exception 'Há entregas individuais no ciclo para um ou mais trabalhadores. Confira o histórico antes de lançar o kit.' using errcode='23505'; end if;

 insert into public.uniform_delivery_batches(request_token,cycle_start,delivered_on,receipt_ref,notes)
 values(p_request_token,p_cycle_start,p_delivered_on,nullif(btrim(coalesce(p_receipt_ref,'')),''),nullif(btrim(coalesce(p_notes,'')),''))
 on conflict(request_token) do nothing returning id into batch_key;
 if batch_key is null then
   select b.id into batch_key from public.uniform_delivery_batches b where b.request_token=p_request_token;
   return query select batch_key,count(distinct r.employee_id)::integer,(count(distinct r.employee_id)*9)::integer
   from public.uniform_delivery_batch_recipients r where r.batch_id=batch_key;
   return;
 end if;

 for entry in select value from jsonb_array_elements(p_workers) loop
   emp=(entry->>'employee_id')::uuid;
   shirt=upper(btrim(coalesce(entry->>'shirt_size','')));
   pants=upper(btrim(coalesce(entry->>'pants_size','')));
   if length(shirt) not between 1 and 12 or length(pants) not between 1 and 12
   then raise exception 'Verifique tamanhos de camisa e calça de todos os selecionados.' using errcode='22023'; end if;
   update public.employees set shirt_size=shirt,pants_size=pants where id=emp and active=true;
   insert into public.uniform_delivery_batch_recipients(batch_id,employee_id,cycle_start,shirt_size,pants_size)
   values(batch_key,emp,p_cycle_start,shirt,pants);
   insert into public.uniform_deliveries(batch_id,employee_id,item_type,size,quantity,delivered_on,receipt_ref,notes)
   values
    (batch_key,emp,'camisa_uv',shirt,4,p_delivered_on,nullif(btrim(coalesce(p_receipt_ref,'')),''),nullif(btrim(coalesce(p_notes,'')),'')),
    (batch_key,emp,'camisa_polo',shirt,1,p_delivered_on,nullif(btrim(coalesce(p_receipt_ref,'')),''),nullif(btrim(coalesce(p_notes,'')),'')),
    (batch_key,emp,'calca_tatica',pants,4,p_delivered_on,nullif(btrim(coalesce(p_receipt_ref,'')),''),nullif(btrim(coalesce(p_notes,'')),''));
 end loop;

 return query select batch_key,total,(total*9)::integer;
end
$fn$;

revoke all on function public.save_uniform_sizes(jsonb) from public,anon;
revoke all on function public.create_uniform_bulk_delivery(uuid,date,date,text,text,jsonb) from public,anon;
grant execute on function public.save_uniform_sizes(jsonb) to authenticated;
grant execute on function public.create_uniform_bulk_delivery(uuid,date,date,text,text,jsonb) to authenticated;

commit;
