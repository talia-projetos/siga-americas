-- Titularidade não deve ser inferida de um termo de responsabilidade histórico.
-- A inclusão da opção não altera titularidades de registros existentes.
BEGIN;
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_owner_type_check;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_owner_type_check
  CHECK (owner_type IN ('proerg','itaipu','a_confirmar'));
ALTER TABLE public.equipment ALTER COLUMN owner_type SET DEFAULT 'a_confirmar';
COMMIT;
