-- Identificação individual e conferência documental de veículos/equipamentos.
-- Migração aditiva; nenhuma placa/chassi/lacre é presumido.
BEGIN;
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS chassis text,
  ADD COLUMN IF NOT EXISTS seal_number text,
  ADD COLUMN IF NOT EXISTS contract_resource_requirement_id uuid REFERENCES public.contract_resource_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'a_conferir',
  ADD COLUMN IF NOT EXISTS verification_ref text,
  ADD COLUMN IF NOT EXISTS verified_on date;
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS seal_number text,
  ADD COLUMN IF NOT EXISTS contract_resource_requirement_id uuid REFERENCES public.contract_resource_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'a_conferir',
  ADD COLUMN IF NOT EXISTS verification_ref text,
  ADD COLUMN IF NOT EXISTS verified_on date;
ALTER TABLE public.vehicles ALTER COLUMN plate DROP NOT NULL;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_identification_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_identification_check
  CHECK (NULLIF(BTRIM(plate),'') IS NOT NULL OR NULLIF(BTRIM(chassis),'') IS NOT NULL OR NULLIF(BTRIM(asset_tag),'') IS NOT NULL);
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('a_conferir','disponivel','em_manutencao','indisponivel','desativado'));
ALTER TABLE public.vehicles ALTER COLUMN status SET DEFAULT 'a_conferir';
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_condition_check;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_condition_check
  CHECK (condition IN ('a_conferir','bom','requer_atencao','em_manutencao','inutilizavel'));
ALTER TABLE public.equipment ALTER COLUMN condition SET DEFAULT 'a_conferir';
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_verification_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_verification_status_check
  CHECK (verification_status IN ('a_conferir','conferido','divergente'));
ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_verification_status_check;
ALTER TABLE public.equipment ADD CONSTRAINT equipment_verification_status_check
  CHECK (verification_status IN ('a_conferir','conferido','divergente'));
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_chassis_unique_present
  ON public.vehicles (UPPER(BTRIM(chassis)))
  WHERE chassis IS NOT NULL AND BTRIM(chassis)<>'';
CREATE INDEX IF NOT EXISTS vehicles_contract_requirement_idx ON public.vehicles(contract_resource_requirement_id);
CREATE INDEX IF NOT EXISTS equipment_contract_requirement_idx ON public.equipment(contract_resource_requirement_id);
COMMIT;