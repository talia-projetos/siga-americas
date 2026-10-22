-- SIGA Américas: programação por turno para equipes e postos fixos.
-- Não insere atividades fictícias nem marca programação como aprovada.
create table if not exists public.daily_shift_plans (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  shift text not null check (shift in ('manha','tarde')),
  team_assignment_id uuid references public.daily_team_assignments(id) on delete cascade,
  service_post_id uuid references public.service_posts(id) on delete cascade,
  planned_activity text not null check (length(trim(planned_activity)) between 3 and 600),
  planned_location text check (length(planned_location) <= 300),
  supervisor_note text check (length(supervisor_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_shift_plan_one_origin check (
    (team_assignment_id is not null and service_post_id is null) or
    (team_assignment_id is null and service_post_id is not null)
  ),
  constraint daily_shift_team_unique unique(team_assignment_id,shift),
  constraint daily_shift_post_unique unique(service_post_id,work_date,shift)
);
create index if not exists daily_shift_plans_date_idx on public.daily_shift_plans(work_date,shift);
alter table public.daily_shift_plans enable row level security;
grant select,insert,update,delete on public.daily_shift_plans to authenticated;
create policy "daily_shift_read" on public.daily_shift_plans
  for select to authenticated using (siga_private.is_active_member());
create policy "daily_shift_write" on public.daily_shift_plans
  for all to authenticated using (siga_private.can_write())
  with check (siga_private.can_write());
-- A data de um turno de equipe deve ser a mesma do lançamento diário original.
create or replace function public.check_daily_shift_team_date()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.team_assignment_id is not null and not exists (
    select 1 from public.daily_team_assignments a
    where a.id=new.team_assignment_id and a.work_date=new.work_date
  ) then
    raise exception 'A data do turno não corresponde à programação diária da equipe.';
  end if;
  return new;
end;
$$;
create trigger daily_shift_team_date_check
 before insert or update of work_date,team_assignment_id
 on public.daily_shift_plans
 for each row execute function public.check_daily_shift_team_date();
comment on table public.daily_shift_plans is 'Rascunhos por manhã/tarde para revisão do gestor. Sem comprovação de execução ou aceite contratual.';