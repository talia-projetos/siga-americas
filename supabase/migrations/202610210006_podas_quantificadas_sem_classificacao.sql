-- Permite importar quantitativos documentados sem inventar uma modalidade de poda.
-- Atividade de matriz e preço só podem ficar ausentes para transcrições ainda não validadas.
ALTER TABLE public.field_execution_entries ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE public.field_execution_entries DROP CONSTRAINT IF EXISTS field_execution_entries_pending_activity_only;
ALTER TABLE public.field_execution_entries ADD CONSTRAINT field_execution_entries_pending_activity_only
CHECK (activity_id IS NOT NULL OR (
 source_type='caderno_revisado'
 AND validation_status='a_conferir'
 AND contract_item_id IS NULL
 AND unit_price IS NULL
 AND estimated_amount IS NULL
));
-- A chave de origem impede duplicar linhas já importadas.
WITH eligible AS (
 SELECT l.*,s.photo_refs FROM public.field_execution_note_locations l
 JOIN public.field_execution_source_notes s ON s.source_key=l.source_key
 LEFT JOIN public.field_execution_entries e ON e.source_key='revisao-caderno-'||l.line_key
 WHERE l.performed_on IS NOT NULL
 AND l.quantity_reported>0
 AND l.contract_unit='un'
 AND l.service_name ILIKE '%poda%'
 AND l.candidate_price_codes @> ARRAY['3.25']::text[]
 AND e.id IS NULL
)
INSERT INTO public.field_execution_entries (
 source_key,performed_on,activity_id,contract_item_id,activity_label,location,quantity,unit,unit_price,
 execution_status,validation_status,source_type,source_reference,evidence_ref,pricing_notes,notes
)
SELECT 'revisao-caderno-'||l.line_key,l.performed_on,NULL,NULL,
 'Podas de árvores · modalidade técnica a definir',l.location_name,CEIL(l.quantity_reported),'un',NULL,
 'executada','a_conferir','caderno_revisado',l.source_key,l.photo_refs,
 'Quantidade registrada sem classificação técnica de poda; não atribuir rubrica ou valor contratual até conferência.',
 'Transcrição preliminar, não medição aprovada. Original: '||l.quantity_reported::text||' un; '||COALESCE(l.original_quantity_note,'')||' · '||COALESCE(l.review_note,'')
FROM eligible l ON CONFLICT (source_key) DO NOTHING;
