-- Permite salvar rascunhos sem declarar execução artificialmente.
alter table public.field_daily_report_items drop constraint if exists field_daily_report_items_result_check;
alter table public.field_daily_report_items add constraint field_daily_report_items_result_check
check(result in ('nao_informado','executada','parcial','impedida','nao_aplicavel'));
create or replace function public.validate_weekly_item_report_result()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare status_report text;
begin
 select r.status into status_report from public.field_daily_reports r where r.id=new.report_id;
 if status_report in ('enviado','validado') and new.result='nao_informado' then
  raise exception 'Resultado precisa ser informado antes de enviar relatório';
 end if;
 return new;
end; $$;
drop trigger if exists validate_weekly_item_report_result on public.field_daily_report_items;
create trigger validate_weekly_item_report_result before insert or update of result,report_id
on public.field_daily_report_items for each row execute function public.validate_weekly_item_report_result();
