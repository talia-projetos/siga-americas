-- Hardening: funções SECURITY DEFINER fora do schema exposto pela API.
-- Não remove registros; preserva as políticas e triggers existentes.
begin;

create schema if not exists siga_private;
revoke all on schema siga_private from public, anon;
grant usage on schema siga_private to authenticated;

do $
declare fname text;
begin
  foreach fname in array array[
    'is_active_member','can_write','can_read_sensitive',
    'is_app_admin','audit_row_change'
  ] loop
    if to_regprocedure(format('public.%I()',fname)) is not null then
      execute format('alter function public.%I() set schema siga_private',fname);
    end if;
  end loop;
end $;

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
