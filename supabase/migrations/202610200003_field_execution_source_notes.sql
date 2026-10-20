-- Registro documental separado de execução medida ou valorada.
-- A classificação financeira continua exclusivamente pela tabela de custeio vigente.
CREATE TABLE IF NOT EXISTS public.field_execution_source_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_key text UNIQUE NOT NULL,
 performed_on date,
 activity_text text NOT NULL,
 location_text text,
 quantity_text text,
 raw_excerpt text,
 photo_refs text NOT NULL,
 legibility text NOT NULL DEFAULT 'parcial'
  CHECK (legibility IN ('legivel','parcial','incerta')),
 review_status text NOT NULL DEFAULT 'a_conferir'
  CHECK (review_status IN ('a_conferir','classificado','descartado')),
 review_notes text,
 converted_execution_id uuid REFERENCES public.field_execution_entries(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS field_execution_source_notes_date_idx
 ON public.field_execution_source_notes(performed_on DESC NULLS LAST);
ALTER TABLE public.field_execution_source_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS execution_source_read ON public.field_execution_source_notes;
CREATE POLICY execution_source_read ON public.field_execution_source_notes
 FOR SELECT TO authenticated USING (siga_private.is_active_member());
DROP POLICY IF EXISTS execution_source_write ON public.field_execution_source_notes;
CREATE POLICY execution_source_write ON public.field_execution_source_notes
 FOR ALL TO authenticated USING (siga_private.can_write())
 WITH CHECK (siga_private.can_write());
GRANT SELECT,INSERT,UPDATE ON public.field_execution_source_notes TO authenticated;
