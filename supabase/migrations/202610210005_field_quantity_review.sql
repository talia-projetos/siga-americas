-- Leitura preliminar de volumes manuscritos; não constitui medição nem recebimento.
-- A origem continua em field_execution_source_notes e a situação permanece a conferir.
UPDATE public.field_execution_note_locations
SET candidate_price_codes=ARRAY['3.37']::text[],contract_unit='ha',
 review_note=concat_ws(' · ',nullif(review_note,''),'Roçada exige medição em ha; equipe e horas não representam hectares.'),
 updated_at=now()
WHERE line_key='sep-img4548-section2-ciclovia-rocada' AND verification_status='a_conferir'
 AND candidate_price_codes<>ARRAY['3.37']::text[];
UPDATE public.field_execution_note_locations
SET quantity_reported=CASE line_key WHEN 'sep-img4548-section6-volume-10' THEN 10
 WHEN 'sep-img4548-section6-volume-20' THEN 20 WHEN 'sep-img4548-section6-volume-6' THEN 6 END,
 location_name=CASE line_key
 WHEN 'sep-img4548-section6-volume-10' THEN 'Almoxarifado (leitura de local a confirmar)'
 WHEN 'sep-img4548-section6-volume-20' THEN 'Usina (trecho do local a confirmar)'
 WHEN 'sep-img4548-section6-volume-6' THEN 'Coordenação (trecho do local a confirmar)' END,
 updated_at=now()
WHERE line_key IN ('sep-img4548-section6-volume-10','sep-img4548-section6-volume-20','sep-img4548-section6-volume-6')
 AND verification_status='a_conferir'
 AND quantity_reported IS NULL;
INSERT INTO public.field_execution_note_locations
(line_key,source_key,performed_on,location_name,service_name,quantity_reported,contract_unit,candidate_price_codes,original_quantity_note,allocation_status,verification_status,review_note)
VALUES
('sep-img4548-section5-entulho-usina-40','20261020-preposto-img4548-section5',NULL,'Usina / CRV / Gramadão (local exato a conferir)','Remoção manual de entulho',40,'m³',ARRAY['3.11']::text[],'40 m³ anotados, leitura e associação ao local a confirmar','local_a_confirmar','a_conferir','Não somar à medição até confirmar local, data e cubagem.'),
('sep-img4548-section5-entulho-treinamento-30','20261020-preposto-img4548-section5',NULL,'Área de treinamento da Usina (a confirmar)','Remoção manual de entulho',30,'m³',ARRAY['3.11']::text[],'30 m³ anotados, leitura e associação ao local a confirmar','local_a_confirmar','a_conferir','Não somar à medição até confirmar local, data e cubagem.')
ON CONFLICT (line_key) DO NOTHING;
