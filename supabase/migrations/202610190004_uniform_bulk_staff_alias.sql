-- Alinha referências JSONB em subconsultas, sem colisão com variáveis PL/pgSQL.
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
 where e.id in (select (staff.value->>'employee_id')::uuid from jsonb_array_elements(p_workers) as staff(value))
 and e.active=true order by e.id for update;
 if (select count(*) from public.employees e where e.id in
   (select (staff.value->>'employee_id')::uuid from jsonb_array_elements(p_workers) as staff(value)) and e.active=true)<>total
 then raise exception 'Há trabalhadores não encontrados ou inativos.' using errcode='22023'; end if;

 -- Bloqueia kits duplicados e entregas individuais existentes na janela.
 if exists(
 select 1 from public.uniform_delivery_batch_recipients r
 where r.employee_id in (select (staff.value->>'employee_id')::uuid from jsonb_array_elements(p_workers) as staff(value))
 and p_cycle_start < (r.cycle_start+interval '6 months')::date
 and r.cycle_start < (p_cycle_start+interval '6 months')::date
 ) then raise exception 'Um ou mais trabalhadores já têm um kit deste semestre. Retire-os da seleção.' using errcode='23505'; end if;
 if exists (
 select 1 from public.uniform_deliveries d
 where d.employee_id in (select (staff.value->>'employee_id')::uuid from jsonb_array_elements(p_workers) as staff(value))
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

