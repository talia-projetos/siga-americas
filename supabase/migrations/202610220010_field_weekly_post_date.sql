-- Data efetiva da atividade e posto principal do relatório semanal.
-- Não presume serviço concluído nem quantidade executada.
alter table public.field_daily_reports add column if not exists service_post_id uuid references public.service_posts(id) on delete set null;
alter table public.field_daily_report_items add column if not exists performed_on date;
create index if not exists field_daily_items_performed_on_idx on public.field_daily_report_items(performed_on);
create or replace function public.check_weekly_report_post()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare post_area uuid; code text;
begin
 if new.service_post_id is null then return new; end if;
 select p.area_id into post_area from public.service_posts p where p.id=new.service_post_id;
 if not found then raise exception 'Posto de referência inexistente'; end if;
 select t.code into code from public.teams t where t.id=new.team_id;
 if code<>'EQ06' then raise exception 'Posto principal somente para Jardinagem'; end if;
 if post_area is not null and new.area_id is distinct from post_area then
  raise exception 'Frente principal diferente do posto'; end if;
 return new;
end; $$;
drop trigger if exists check_weekly_report_post on public.field_daily_reports;
create trigger check_weekly_report_post
before insert or update of team_id,area_id,service_post_id on public.field_daily_reports
for each row execute function public.check_weekly_report_post();

create or replace function public.check_weekly_item_day()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare start_date date; end_date date;
begin
 if new.performed_on is null then return new; end if;
 select coalesce(r.period_start,r.report_date),coalesce(r.period_end,r.report_date) into start_date,end_date
 from public.field_daily_reports r where r.id=new.report_id;
 if new.performed_on<start_date or new.performed_on>end_date then
  raise exception 'Data do serviço fora do período do relatório'; end if;
 if new.work_order_id is not null and exists (
  select 1 from public.work_orders w where w.id=new.work_order_id
  and w.due_on is not null and w.due_on<>new.performed_on
 ) then
  raise exception 'OS selecionada possui data diferente da execução informada'; end if;
 return new;
end; $$;
drop trigger if exists check_weekly_item_day on public.field_daily_report_items;
create trigger check_weekly_item_day
before insert or update of performed_on,report_id,work_order_id on public.field_daily_report_items
for each row execute function public.check_weekly_item_day();
