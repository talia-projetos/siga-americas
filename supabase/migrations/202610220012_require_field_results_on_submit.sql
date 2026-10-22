-- Não deixar relatório semanal ser enviado com atividades em estado indefinido.
-- Rascunhos podem permanecer incompletos.
create or replace function public.require_field_results_before_submit()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.status in ('enviado','validado') and old.status is distinct from new.status then
  if not exists (select 1 from public.field_daily_report_items i where i.report_id=new.id) then
   raise exception 'Inclua pelo menos uma atividade antes de enviar';
  end if;
  if exists(select 1 from public.field_daily_report_items i
   where i.report_id=new.id and i.result='nao_informado') then
   raise exception 'Defina o resultado de todas as atividades antes de enviar';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists require_field_results_before_submit on public.field_daily_reports;
create trigger require_field_results_before_submit before update of status
on public.field_daily_reports for each row execute function public.require_field_results_before_submit();
