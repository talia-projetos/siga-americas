-- Cadastro de referência: cláusula 6.5, Contrato Emergencial IBCE2026.
-- A relação reúne EPI, EPC, acessórios e apoio. CA e estoque não são presumidos.
ALTER TABLE public.ppe_items
 ADD COLUMN IF NOT EXISTS contract_resource_requirement_id uuid REFERENCES public.contract_resource_requirements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ppe_items_contract_requirement_unique
 ON public.ppe_items(contract_resource_requirement_id)
 WHERE contract_resource_requirement_id IS NOT NULL;
WITH source AS (
 SELECT r.*,
 CASE
 WHEN r.item_name IN ('Cone de sinalização de 75 cm','Placa de sinalização/cavalete') THEN 'EPC e sinalização'
 WHEN r.item_name IN ('Corda estática 50 m','Mosquetões com trava de segurança','Par de esporas de metal','Cinto estrangulador','Cinto passa-galho','Talabarte com 4 mosquetões') THEN 'Acessório de trabalho em altura'
 WHEN r.item_name IN ('Kit de primeiros socorros','Kit protetor e repelente','Boné árabe de algodão tratado','Boné árabe com protetor facial') THEN 'Proteção complementar / apoio'
 WHEN r.item_name IN ('Conjunto motosserrista','Kit EPI de aplicação de defensivos') THEN 'Conjunto de proteção (avaliar componentes)'
 ELSE 'EPI / vestimenta protetiva' END AS catalog_category
 FROM public.contract_resource_requirements r
 JOIN public.contracts c ON c.id=r.contract_id
 WHERE c.code='IBCE2026' AND c.status='vigente' AND r.category='epi' AND r.source_ref='6.5'
)
INSERT INTO public.ppe_items
(name,category,ca_number,ca_expires_on,replacement_guidance,active,contract_resource_requirement_id)
SELECT item_name,catalog_category,NULL,NULL,
 'Contrato Emergencial IBCE2026, cláusula 6.5 (lista orientativa). Verificar enquadramento como EPI, CA quando exigível, risco/atividade, disponibilidade e reposição com SST. Quantidade contratual não definida quando campo vazio.',
 true,id FROM source
ON CONFLICT (contract_resource_requirement_id) WHERE contract_resource_requirement_id IS NOT NULL
DO UPDATE SET name=EXCLUDED.name;
