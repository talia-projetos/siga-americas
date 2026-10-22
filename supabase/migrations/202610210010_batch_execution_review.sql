-- Aprovação documental em lote, separada de OS emitida e medição/faturamento.
CREATE TABLE IF NOT EXISTS public.execution_validation_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 execution_entry_id uuid NOT NULL REFERENCES public.field_execution_entries(id) ON DELETE RESTRICT,
 previous_status text NOT NULL,
 new_status text NOT NULL,
 reviewed_by uuid NOT NULL,
 review_note text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exec_validation_audit_item ON public.execution_validation_audit(execution_entry_id,reviewed_at DESC);
ALTER TABLE public.execution_validation_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS validation_audit_read ON public.execution_validation_audit;
CREATE POLICY validation_audit_read ON public.execution_validation_audit FOR SELECT TO authenticated USING(siga_private.can_write());
GRANT SELECT ON public.execution_validation_audit TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.execution_validation_audit FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.validate_execution_batch(entry_ids uuid[],review_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
 uid uuid := auth.uid();
 entry_id uuid;
 item record;
 checked uuid[] := '{}'::uuid[];
 processed_count int := 0;
 validated_count int := 0;
 skipped jsonb := '[]'::jsonb;
 reason text;
BEGIN
 IF uid IS NULL OR NOT siga_private.can_write() THEN
  RAISE EXCEPTION 'Sem permissão para validação técnica.';
 END IF;
 IF entry_ids IS NULL OR cardinality(entry_ids) = 0 OR cardinality(entry_ids) > 100 THEN
  RAISE EXCEPTION 'Selecione entre 1 e 100 registros.';
 END IF;
 IF length(btrim(coalesce(review_note,''))) < 10 OR length(review_note) > 1500 THEN
  RAISE EXCEPTION 'Descreva a base da conferência em pelo menos 10 caracteres (máximo 1500).';
 END IF;
 FOREACH entry_id IN ARRAY entry_ids LOOP
  IF entry_id IS NULL OR entry_id = ANY(checked) THEN CONTINUE; END IF;
  checked := array_append(checked,entry_id);
  processed_count := processed_count+1;
  SELECT e.*, c.unit AS price_unit,c.unit_price AS price_unit_price,
    c.source_type AS price_source
  INTO item FROM public.field_execution_entries e
  LEFT JOIN public.contract_items c ON c.id=e.contract_item_id
  WHERE e.id=entry_id FOR UPDATE OF e;
  reason := NULL;
  IF NOT FOUND THEN reason:='Registro inexistente';
  ELSIF item.validation_status <> 'a_conferir' THEN reason:='Registro não está pendente';
  ELSIF item.execution_status NOT IN ('executada','parcial') THEN reason:='Execução não realizada';
  ELSIF item.activity_id IS NULL OR item.contract_item_id IS NULL OR item.performed_on IS NULL THEN reason:='Atividade, rubrica ou data ausente';
  ELSIF item.quantity IS NULL OR item.quantity <= 0 OR item.unit_price IS NULL OR item.estimated_amount IS NULL THEN reason:='Quantificação ou cálculo incompleto';
  ELSIF item.price_source IS DISTINCT FROM 'precos' OR item.price_unit_price IS DISTINCT FROM item.unit_price OR item.price_unit IS DISTINCT FROM item.unit
    OR abs(item.estimated_amount - round(item.quantity*item.unit_price,2))>0.02
    THEN reason:='Divergência com tabela de custeio';
  ELSIF nullif(btrim(coalesce(item.source_reference,'')),'') IS NULL
    AND nullif(btrim(coalesce(item.evidence_ref,'')),'') IS NULL
    AND item.work_order_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.field_execution_photos p WHERE p.execution_entry_id=entry_id)
    THEN reason:='Sem OS ou referência de evidência';
  END IF;
  IF reason IS NOT NULL THEN
   skipped:=skipped||jsonb_build_array(jsonb_build_object('id',entry_id,'reason',reason));
   CONTINUE;
  END IF;
  UPDATE public.field_execution_entries SET validation_status='validada',updated_at=now()
   WHERE id=entry_id AND validation_status='a_conferir';
  INSERT INTO public.execution_validation_audit
   (execution_entry_id,previous_status,new_status,reviewed_by,review_note)
  VALUES(entry_id,'a_conferir','validada',uid,btrim(review_note));
  validated_count:=validated_count+1;
 END LOOP;
 RETURN jsonb_build_object('requested',processed_count,'validated',validated_count,
 'skipped',jsonb_array_length(skipped),'skipped_items',skipped,
 'notice','Conferência documental concluída: não constitui medição aceita ou faturamento.');
END;
$$;
REVOKE ALL ON FUNCTION public.validate_execution_batch(uuid[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_execution_batch(uuid[],text) TO authenticated;