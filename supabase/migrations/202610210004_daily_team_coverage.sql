-- Escala de referência para as seis equipes ativas, sem execução ou faturamento presumidos.
CREATE TABLE IF NOT EXISTS public.daily_team_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_key text NOT NULL UNIQUE,work_date date NOT NULL,
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
 area_id uuid NOT NULL REFERENCES public.operational_areas(id) ON DELETE RESTRICT,
 contract_item_id uuid NOT NULL REFERENCES public.contract_items(id) ON DELETE RESTRICT,
 planned_service text NOT NULL,planned_location text NOT NULL,
 climate_alternative text NOT NULL,
 block_status text NOT NULL DEFAULT 'programada'
  CHECK(block_status IN ('programada','remanejada','impedida','informada','validada')),
 blocker_reason text,verified_quantity numeric,
 work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
 supervisor_notes text,
 created_at timestamptz DEFAULT now() NOT NULL,
 updated_at timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT unique_team_daily UNIQUE(work_date,team_id),
 CONSTRAINT blocker_reason_required CHECK(block_status<>'impedida' OR length(btrim(coalesce(blocker_reason,'')))>=6),
 CONSTRAINT verified_quantity_positive CHECK(verified_quantity IS NULL OR verified_quantity>0)
);
CREATE INDEX IF NOT EXISTS daily_team_assignments_date_idx ON public.daily_team_assignments(work_date,block_status);
CREATE INDEX IF NOT EXISTS daily_team_assignments_team_idx ON public.daily_team_assignments(team_id,work_date);
ALTER TABLE public.daily_team_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_assignments_read ON public.daily_team_assignments;
CREATE POLICY daily_assignments_read ON public.daily_team_assignments FOR SELECT TO authenticated USING(siga_private.is_active_member());
DROP POLICY IF EXISTS daily_assignments_write ON public.daily_team_assignments;
CREATE POLICY daily_assignments_write ON public.daily_team_assignments FOR ALL TO authenticated
 USING(siga_private.can_write()) WITH CHECK(siga_private.can_write());
GRANT SELECT,INSERT,UPDATE ON public.daily_team_assignments TO authenticated;
-- Geração inicial de referência: segunda a sexta, exceto os feriados nacionais
-- de 02/11, 20/11, 25/12 e 01/01; requer conferência da escala aprovada.
WITH dates AS (
 SELECT day::date work_date,extract(isodow FROM day)::int dow
 FROM generate_series('2026-11-01'::date,'2027-01-31'::date,interval '1 day') day
 WHERE extract(isodow FROM day) BETWEEN 1 AND 5
 AND day::date NOT IN ('2026-11-02','2026-11-20','2026-12-25','2027-01-01')
), rotation AS (
 SELECT d.*,t.id team_id,t.code team_code,a.id area_id,
 CASE t.code
 WHEN 'EQ01' THEN (ARRAY['3.35','3.37','3.35','3.11','3.41'])[d.dow]
 WHEN 'EQ02' THEN (ARRAY['3.37','3.35','3.37','3.25','3.11'])[d.dow]
 WHEN 'EQ03' THEN (ARRAY['3.37','3.33','3.37','3.35','3.41'])[d.dow]
 WHEN 'EQ04' THEN (ARRAY['3.7','3.5','3.7','3.16','3.7'])[d.dow]
 WHEN 'EQ05' THEN (ARRAY['3.9','3.10','3.9','3.11','3.9'])[d.dow]
 WHEN 'EQ06' THEN '3.39' END price_code
 FROM dates d CROSS JOIN public.teams t JOIN public.operational_areas a ON a.code=t.code
 WHERE t.active AND t.code IN ('EQ01','EQ02','EQ03','EQ04','EQ05','EQ06')
), allocations AS (
 SELECT r.*,p.id contract_item_id,p.name price_name,p.unit,
 CASE r.team_code
 WHEN 'EQ01' THEN (ARRAY['UHI A: gramados com rebrota, talhões a definir','UHI A: roçada, área a definir','UHI A: gramado complementar sem sobrepor ciclo','UHI A: entulho em locais confirmados','UHI A: serviço eventual autorizado'])[r.dow]
 WHEN 'EQ02' THEN (ARRAY['Vilas A/B/C: roçada da rebrota','Vilas A/B/C: gramados das praças','Vilas A/B/C: roçada remanescente','Vilas A/B/C: árvores liberadas para poda','Vilas A/B/C: entulho manual com cubagem'])[r.dow]
 WHEN 'EQ03' THEN (ARRAY['UHI C: corredores de roçada','UHI C: controle manual de daninhas','UHI C: vegetação de rebrota','UHI C: gramados ainda não medidos','UHI C: serviços eventuais autorizados'])[r.dow]
 WHEN 'EQ04' THEN CASE WHEN r.dow=4 THEN 'RBV Viveiro: preparo do solo' ELSE 'RBV Viveiro: produção e manutenção de estufas' END
 WHEN 'EQ05' THEN CASE WHEN r.dow=4 THEN 'RBV: remoção manual de entulho em trilhas' ELSE 'RBV: manutenção de trilhas e instalações' END
 WHEN 'EQ06' THEN (ARRAY['Centro Executivo e Parque Gramadão','Ecomuseu','Centro de Recepção de Visitantes (CRV)','Mirante Central e Coordenação','Centro Executivo e jardinagem dos postos'])[r.dow]
 END location,
 CASE r.team_code
 WHEN 'EQ01' THEN 'Inspeção protegida e serviço seguro sob cobertura, se possível; do contrário registrar bloqueador'
 WHEN 'EQ02' THEN 'Vistoria de rotina sem trabalho em altura e organização de materiais em área segura'
 WHEN 'EQ03' THEN 'Verificação de equipamentos e rotina segura em instalação protegida'
 WHEN 'EQ04' THEN 'Cuidados de viveiro, estufa e produção em cobertura quando seguro'
 WHEN 'EQ05' THEN 'Manutenção protegida de instalações do RBV, se o acesso estiver seguro'
 WHEN 'EQ06' THEN 'Jardinagem em áreas cobertas ou postos seguros; registrar remanejamento se aplicável'
 END alternative
 FROM rotation r JOIN public.contract_items p ON p.code=r.price_code AND p.source_type='precos'
)
INSERT INTO public.daily_team_assignments
 (assignment_key,work_date,team_id,area_id,contract_item_id,planned_service,planned_location,climate_alternative)
SELECT 'rotina-20261021-'||to_char(work_date,'YYYYMMDD')||'-'||team_code,
work_date,team_id,area_id,contract_item_id,
price_name||' · programação sujeita à medição '+unit,
location,alternative FROM allocations
ON CONFLICT(assignment_key) DO NOTHING;
