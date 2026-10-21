-- Propostas por competência e frente. Não são serviço executado ou receita.
CREATE TABLE IF NOT EXISTS public.monthly_operational_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_key text UNIQUE NOT NULL,
 period_month date NOT NULL, planned_for date NOT NULL,
 area_id uuid REFERENCES public.operational_areas(id) ON DELETE SET NULL,
 contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE RESTRICT,
 location_description text NOT NULL, justification text NOT NULL, climate_alternative text,
 proposed_quantity numeric CHECK(proposed_quantity>0),
 proposal_status text NOT NULL DEFAULT 'candidata' CHECK(proposal_status IN ('candidata','aprovada','os_gerada','suspensa')),
 work_order_id uuid UNIQUE REFERENCES public.work_orders(id) ON DELETE SET NULL,
 approved_by uuid,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT proposal_month_check CHECK(date_trunc('month',planned_for::timestamp)::date=period_month)
);
CREATE INDEX IF NOT EXISTS monthly_proposals_month_idx ON public.monthly_operational_proposals(period_month,planned_for);
ALTER TABLE public.monthly_operational_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS monthly_proposals_read ON public.monthly_operational_proposals;
CREATE POLICY monthly_proposals_read ON public.monthly_operational_proposals FOR SELECT TO authenticated USING(siga_private.is_active_member());
DROP POLICY IF EXISTS monthly_proposals_write ON public.monthly_operational_proposals;
CREATE POLICY monthly_proposals_write ON public.monthly_operational_proposals FOR ALL TO authenticated USING(siga_private.can_write()) WITH CHECK(siga_private.can_write());
GRANT SELECT,INSERT,UPDATE ON public.monthly_operational_proposals TO authenticated;
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

REVOKE ALL ON FUNCTION public.issue_planned_work_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_planned_work_order(uuid) TO authenticated;
