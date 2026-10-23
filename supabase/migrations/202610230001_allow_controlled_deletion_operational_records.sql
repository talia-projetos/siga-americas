-- Permite excluir cadastros por perfis com permissao de escrita.
-- Chaves estrangeiras permanecem protegidas pelo banco: sem cascata automatica.
do $$
declare t text;
begin
 foreach t in array array[
  'activity_catalog','contract_items','contract_obligations','contract_resource_requirements',
  'contracts','employees','equipment','field_execution_entries','field_plan_items',
  'field_programs','field_routine_records','field_routine_templates','finance_goals',
  'fuel_logs','maintenance_events','operational_areas','ppe_deliveries','ppe_items',
  'purchase_requests','responsibility_terms','service_posts','stock_items','stock_movements',
  'teams','uniform_deliveries','vehicles','work_orders'
 ] loop
  execute format('create policy siga_delete on public.%I for delete to authenticated using (siga_private.can_write())',t);
  execute format('grant delete on public.%I to authenticated',t);
 end loop;
end $$;
