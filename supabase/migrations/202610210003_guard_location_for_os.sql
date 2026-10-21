-- Impede emissão de OS antes da definição do local exato da intervenção.
CREATE OR REPLACE FUNCTION public.issue_planned_work_order(p_proposal_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'siga_private'
AS $function$
DECLARE p public.monthly_operational_proposals%ROWTYPE;
DECLARE item public.contract_items%ROWTYPE;
DECLARE area_program uuid;
DECLARE id_os uuid;
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.app_memberships m
  WHERE m.user_id=auth.uid() AND m.enabled AND m.role IN ('supervisao','gestao','admin')
 ) THEN RAISE EXCEPTION 'Sem permissão para autorizar a emissão de OS'; END IF;
 SELECT * INTO p FROM public.monthly_operational_proposals WHERE id=p_proposal_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta inexistente'; END IF;
 IF p.work_order_id IS NOT NULL THEN RETURN p.work_order_id; END IF;
 IF p.proposed_quantity IS NULL OR p.proposed_quantity<=0 OR p.area_id IS NULL OR p.planned_for IS NULL
    OR length(btrim(p.location_description))<3 OR length(btrim(p.justification))<10
 THEN RAISE EXCEPTION 'Completar quantidade, frente, data, local e justificativa antes da OS'; END IF;
 IF p.location_description ~* '(a confirmar|a definir|local exato)' THEN RAISE EXCEPTION 'Identifique o local exato antes de emitir a OS'; END IF;
 SELECT * INTO item FROM public.contract_items WHERE id=p.contract_item_id AND source_type='precos';
 IF NOT FOUND OR item.unit IS NULL OR item.unit_price IS NULL THEN
  RAISE EXCEPTION 'Rubrica não encontrada na tabela de custeio'; END IF;
 -- Aprovação não dispensa conferência dos saldos: liberar apenas quantidades condicionadas.
 SELECT id INTO area_program FROM public.field_programs
 WHERE period_month=p.period_month AND area_id=p.area_id ORDER BY created_at DESC LIMIT 1;
 INSERT INTO public.work_orders
  (reference,description,contract_item_id,field_program_id,area_id,location,status,priority,due_on,quantity,unit)
 VALUES
  ('',p.justification,item.id,area_program,p.area_id,p.location_description,'programada','normal',
   p.planned_for,p.proposed_quantity,item.unit)
 RETURNING id INTO id_os;
 UPDATE public.monthly_operational_proposals SET proposal_status='os_gerada',work_order_id=id_os,
 approved_by=auth.uid(),approved_at=now(),updated_at=now() WHERE id=p.id;
 RETURN id_os;
END;$function$
