-- Desmembramento documental por data, local, serviço e unidade da tabela de custeio vigente.
-- Não gera medição, valores financeiros ou vínculo automático com a matriz de 73 atividades.
CREATE TABLE IF NOT EXISTS public.field_execution_note_locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 line_key text NOT NULL UNIQUE,
 source_key text NOT NULL REFERENCES public.field_execution_source_notes(source_key) ON DELETE CASCADE,
 performed_on date,
 location_name text NOT NULL,
 service_name text NOT NULL,
 quantity_reported numeric CHECK(quantity_reported > 0),
 contract_unit text,
 candidate_price_codes text[] NOT NULL DEFAULT '{}'::text[],
 original_quantity_note text,
 allocation_status text NOT NULL DEFAULT 'a_conferir'
  CHECK(allocation_status IN ('local_e_quantidade_indicados','local_citado_sem_quantidade','local_a_confirmar','quantidade_agregada')),
 verification_status text NOT NULL DEFAULT 'a_conferir'
  CHECK(verification_status IN ('a_conferir','conferido','descartado')),
 review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS field_execution_note_locations_source_idx
 ON public.field_execution_note_locations(source_key);
CREATE INDEX IF NOT EXISTS field_execution_note_locations_date_idx
 ON public.field_execution_note_locations(performed_on DESC NULLS LAST);
ALTER TABLE public.field_execution_note_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS field_execution_note_locations_read ON public.field_execution_note_locations;
CREATE POLICY field_execution_note_locations_read ON public.field_execution_note_locations
 FOR SELECT TO authenticated USING (siga_private.is_active_member());
DROP POLICY IF EXISTS field_execution_note_locations_write ON public.field_execution_note_locations;
CREATE POLICY field_execution_note_locations_write ON public.field_execution_note_locations
 FOR ALL TO authenticated USING (siga_private.can_write()) WITH CHECK (siga_private.can_write());
GRANT SELECT,INSERT,UPDATE ON public.field_execution_note_locations TO authenticated;
