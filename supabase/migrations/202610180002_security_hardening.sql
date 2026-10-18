-- Hardening: funções SECURITY DEFINER fora do schema exposto pela API.
-- Não remove registros; preserva as políticas e triggers existentes.
begin;

create schema if not exists siga_private;
revoke all on schema siga_private from public, anon;
grant usage on schema siga_private to authenticated;

alter function public.is_active_member() set schema siga_private;
alter function public.can_write() set schema siga_private;
alter function public.can_read_sensitive() set schema siga_private;
alter function public.is_app_admin() set schema siga_private;
alter function public.audit_row_change() set schema siga_private;

revoke execute on function siga_private.is_active_member() from public, anon;
revoke execute on function siga_private.can_write() from public, anon;
revoke execute on function siga_private.can_read_sensitive() from public, anon;
revoke execute on function siga_private.is_app_admin() from public, anon;
revoke execute on function siga_private.audit_row_change() from public, anon, authenticated;

grant execute on function siga_private.is_active_member() to authenticated;
grant execute on function siga_private.can_write() to authenticated;
grant execute on function siga_private.can_read_sensitive() to authenticated;
grant execute on function siga_private.is_app_admin() to authenticated;

-- Dados operacionais sensíveis: consulta restrita também a frota e patrimônio.
drop policy if exists siga_read on public.vehicles;
create policy siga_read on public.vehicles
  for select to authenticated using (siga_private.can_read_sensitive());
drop policy if exists siga_read on public.equipment;
create policy siga_read on public.equipment
  for select to authenticated using (siga_private.can_read_sensitive());

commit;
