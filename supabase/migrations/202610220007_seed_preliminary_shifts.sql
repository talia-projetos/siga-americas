-- Programação indicativa com dois turnos, sujeita à revisão técnica e ao aceite do gestor.
-- Novembro é fase de transição da manutenção do RBV; dez/jan adotam rotinas recorrentes.
-- "rascunho" impede a aprovação até que a supervisão confira atividade e local.
WITH dias AS (
 SELECT d.id, d.team_id, d.work_date, d.planned_location, d.planned_service, t.code team_code,
        extract(isodow from d.work_date)::int as weekday, extract(day from d.work_date)::int as monthday
 FROM public.daily_team_assignments d JOIN public.teams t ON t.id=d.team_id
 WHERE d.work_date BETWEEN DATE '2026-11-01' AND DATE '2027-01-31'
), turnos AS (
 SELECT unnest(ARRAY['manha','tarde']::text[]) AS shift
)
INSERT INTO public.daily_shift_plans
(work_date,shift,team_assignment_id,planned_activity,planned_location,supervisor_note,review_status)
SELECT d.work_date, s.shift, d.id,
 CASE d.team_code
  WHEN 'EQ01' THEN CASE WHEN s.shift='manha'
     THEN CASE d.weekday WHEN 1 THEN 'Conferir rotas e delimitar áreas de roçada/corte de gramados antes da mobilização.'
         WHEN 2 THEN 'Executar roçada ou corte de gramados nos trechos definidos e liberados, conforme necessidade verificada.'
         WHEN 3 THEN 'Controle manual seletivo de plantas invasoras e manutenção dos limites de vegetação, sob vistoria.'
         WHEN 4 THEN 'Reforço da manutenção vegetativa por prioridades e condições seguras de solo e máquinas.'
         ELSE 'Vistoria da cobertura semanal, frentes pendentes e eventual execução de serviços já autorizados.' END
     ELSE CASE d.weekday WHEN 1 THEN 'Organizar recursos, equipamentos, EPIs e registros de áreas/quantidades a serem medidos.'
         WHEN 2 THEN 'Recolher aparas, conferir acabamento, limpeza e destino adequado dos materiais.'
         WHEN 3 THEN 'Conferir limites, remover resíduos da operação e registrar resultados da frente.'
         WHEN 4 THEN 'Aplicar atividades leves alternativas autorizadas diante de chuva; registrar bloqueio quando inseguro.'
         ELSE 'Consolidar volumes, evidências e programação da semana seguinte sem presumir execução.' END END
  WHEN 'EQ02' THEN CASE WHEN s.shift='manha'
     THEN CASE d.weekday WHEN 1 THEN 'Vistoriar gramados, canteiros, praças e arborização das vilas, ordenando as frentes por necessidade.'
         WHEN 2 THEN 'Corte de gramados por trechos delimitados na rota das vilas, quando o solo permitir.'
         WHEN 3 THEN 'Limpeza manual de canteiros, plantas invasoras e bordas de jardins nas áreas priorizadas.'
         WHEN 4 THEN 'Serviços vegetativos por demanda validada: roçada e conservação de praças e acessos.'
         ELSE 'Vistoria técnica de arborização e serviços eventuais autorizados; poda somente após liberação.' END
     ELSE CASE d.weekday WHEN 1 THEN 'Preparar roteiro de serviços e validar disponibilidade de equipamentos e pontos de descarga.'
         WHEN 2 THEN 'Recolher aparas, verificar acabamento e documentar as áreas efetivamente atendidas.'
         WHEN 3 THEN 'Rastelar, conservar bordas e recolher resíduos dos locais atendidos.'
         WHEN 4 THEN 'Executar alternativa segura autorizada ou formalizar impedimentos por chuva e segurança.'
         ELSE 'Encerrar pendências, consolidar registros e preparar demandas da próxima semana.' END END
  WHEN 'EQ03' THEN CASE WHEN s.shift='manha'
     THEN CASE d.weekday WHEN 1 THEN 'Vistoria e identificação de talhões com plantas daninhas, gramados e demandas de roçada.'
         WHEN 2 THEN 'Controle manual de plantas daninhas em área previamente vistoriada e delimitada.'
         WHEN 3 THEN 'Corte de gramados ou roçada nos trechos liberados conforme condição climática.'
         WHEN 4 THEN 'Manejo vegetativo de manutenção em trechos pendentes, sujeito à necessidade e segurança.'
         ELSE 'Atendimento de demandas eventuais autorizadas e rechecagem de áreas críticas.' END
     ELSE CASE d.weekday WHEN 1 THEN 'Conferir condições de acesso, ferramentas, EPIs e unidades de medição.'
         WHEN 2 THEN 'Finalizar controle manual, rastelamento e separação de resíduos vegetais.'
         WHEN 3 THEN 'Recolher aparas e comprovar medidas de área, sem duplicidade de rubricas.'
         WHEN 4 THEN 'Rotinas auxiliares seguras diante de chuva ou remanejamento formal da atividade.'
         ELSE 'Revisar registros de execução e lista de prioridades semanais.' END END
  WHEN 'EQ04' THEN CASE WHEN s.shift='manha'
     THEN CASE d.weekday WHEN 1 THEN 'Inspecionar canteiros, mudas, estufas e disponibilidade de insumos; definir prioridades da semana.'
         WHEN 2 THEN 'Conduzir produção e manutenção de mudas florestais de acordo com etapas do viveiro.'
         WHEN 3 THEN 'Inspecionar sanidade de mudas, substratos e necessidades hídricas reais.'
         WHEN 4 THEN 'Preparo de solo e manejo de plantas ornamentais, quando houver demanda comprovada.'
         ELSE 'Horto de Plantas Medicinais: revisão semanal de galhos, limpeza e conservação de canteiros.' END
     ELSE CASE d.weekday WHEN 1 THEN 'Organizar bancada, materiais e registros de entrada/saída de insumos e mudas.'
         WHEN 2 THEN 'Continuar manejo e expedição de mudas conforme solicitações e disponibilidade real.'
         WHEN 3 THEN 'Executar cuidados de viveiro em ambiente protegido, adaptando irrigação à chuva observada.'
         WHEN 4 THEN 'Organizar forrações, ferramentas, insumos e registros de produção do dia.'
         ELSE 'Conferir Horto, recolhimento vegetal, condições de drenagem e manutenção leve compatível.' END END
  WHEN 'EQ05' THEN CASE
   WHEN d.work_date<DATE '2026-12-01' THEN CASE
    WHEN d.monthday<=6 THEN CASE WHEN s.shift='manha'
      THEN CASE d.weekday WHEN 2 THEN 'Ponte do Portinho: vistoriar guarda-corpo, estabilidade, materiais e liberação de acesso; tratar prioridade conforme agenda institucional.'
       WHEN 3 THEN 'Diagnosticar drenagem e pontos de esgoto provisórios próximos ao Viveiro; identificar intervenção tecnicamente responsável.'
       WHEN 4 THEN 'Inspecionar calhas e drenagem do Viveiro/edificações, com plano seguro para limpeza e correções.'
       ELSE 'Inspecionar guarda-corpos, passagens, acessos e necessidades imediatas de segurança.' END
      ELSE CASE d.weekday WHEN 2 THEN 'Oficina: organizar triagem de entulhos, limpeza e documentação de destinação dos resíduos.'
       WHEN 3 THEN 'Barreira do Refúgio: vistoriar vegetação, concluir acabamento de limpeza quando liberado.'
       WHEN 4 THEN 'Verificar calhas e entorno do Biotério/Nutrição; registrar materiais e riscos de acesso.'
       ELSE 'Consolidar prioridades, dependências e demandas eventuais com registros verificáveis.' END END
    WHEN d.monthday<=13 THEN CASE WHEN s.shift='manha'
       THEN CASE d.weekday WHEN 1 THEN 'Organização e limpeza de entorno de edificações, segundo rota de manutenção prioritária.'
        WHEN 2 THEN 'Avaliar desobstrução e necessidade de solução definitiva da drenagem/efluentes do Viveiro.'
        WHEN 3 THEN 'Conferência técnica de calhas do Viveiro Florestal, incluindo saídas pluviais e medidas corretivas.'
        WHEN 4 THEN 'Lagos da Administração: avaliar acessos, resíduos e ações de manutenção permitidas.'
        ELSE 'Vistoria de guarda-corpos, passagens e materiais para intervenções de conservação.' END
       ELSE CASE d.weekday WHEN 1 THEN 'Limpeza e segregação de resíduos da oficina, com transporte/destinação autorizados.'
        WHEN 2 THEN 'Documentar pontos de drenagem e comunicar dependências de serviços especializados.'
        WHEN 3 THEN 'Executar somente limpeza acessível e segura de calhas liberadas; registrar trechos pendentes.'
        WHEN 4 THEN 'Serviços leves e limpeza de entorno dos lagos, apenas onde houver condição segura.'
        ELSE 'Reserva para serviço global eventual autorizado e atualização da lista de materiais.' END END
    WHEN d.monthday<=20 THEN CASE WHEN s.shift='manha'
      THEN CASE d.weekday WHEN 1 THEN 'Revisão de estruturas e sinalização do Viveiro Florestal; verificar pendência de madeiras.'
       WHEN 2 THEN 'Verificação de pintura e proteção de guarda-corpos do Biotério/Nutrição.'
       WHEN 3 THEN 'Conservação e limpeza do entorno das edificações com foco em pontos de acesso.'
       WHEN 4 THEN 'Barreira do Refúgio e acessos: conferência da limpeza e da vegetação remanescente.'
       ELSE 'Avaliar pendências de drenagem e de segurança ainda abertas no Refúgio.' END
      ELSE CASE d.weekday WHEN 1 THEN 'Preparar documentação de materiais e etapas condicionadas à entrega; sem presumir fornecimento.'
       WHEN 2 THEN 'Executar preparo superficial e acabamento quando autorizados, com EPI e isolamento adequados.'
       WHEN 3 THEN 'Remover resíduos, fotografar pontos de atendimento e checar segurança de circulação.'
       WHEN 4 THEN 'Conferir resultado, destinação de resíduos e demandas eventuais autorizadas.'
       ELSE 'Consolidar o controle de pendências e o avanço documentado do período.' END END
    WHEN d.monthday<=27 THEN CASE WHEN s.shift='manha'
      THEN CASE d.weekday WHEN 1 THEN 'Rechecagem da drenagem do Viveiro, calhas e limpeza pós-chuva.'
       WHEN 2 THEN 'Conferir entulho da oficina, áreas de apoio e pendências de destinação.'
       WHEN 3 THEN 'Lagos da Administração: manutenção de entorno e revisão de pontos de segurança.'
       WHEN 4 THEN 'Verificar guarda-corpos, pintura e estruturas com materiais já disponíveis.'
       ELSE 'Reavaliar condições de acesso e pontos provisórios de drenagem/efluentes.' END
      ELSE CASE d.weekday WHEN 1 THEN 'Atualizar mapa de pontos de manutenção com localização e evidência.'
       WHEN 2 THEN 'Serviço eventual autorizado de menor mobilização ou complementação da triagem.'
       WHEN 3 THEN 'Registrar manutenção realizada, necessidades especializadas e comunicação de pendências.'
       WHEN 4 THEN 'Ajustes finais compatíveis com materiais disponíveis e autorização de acesso.'
       ELSE 'Conferência de materiais e preparação do ciclo preventivo de dezembro.' END END
    ELSE CASE WHEN s.shift='manha'
      THEN 'Inspecionar pendências da transição e conferir segurança, acessos, drenagem, calhas, estruturas e entorno.'
      ELSE 'Consolidar relatório de conservação, indicadores de pendências e programa diário/semanal/mensal de dezembro.' END END
   ELSE CASE WHEN s.shift='manha' THEN CASE d.weekday
      WHEN 1 THEN 'ROTINA SEMANAL: inspeção e limpeza segura de drenagem pluvial, calhas acessíveis e pontos críticos de acesso.'
      WHEN 2 THEN 'ROTINA DIÁRIA: limpeza global preventiva de edificações, oficina e áreas de circulação; destinação regular de resíduos.'
      WHEN 3 THEN 'ROTINA SEMANAL: estruturas, guarda-corpos, cercamentos e sinalização; reparos condicionados a materiais/autorização.'
      WHEN 4 THEN 'ROTINA SEMANAL: manutenção do entorno de lagos, vegetação da barreira e caminhos do Refúgio, conforme demanda.'
      ELSE 'ROTINA DIÁRIA: ronda de segurança, conferência das frentes executadas e registro de impedimentos.' END
    ELSE CASE d.weekday
      WHEN 1 THEN 'Registrar inspeções; serviços eventuais autorizados e acompanhamento das correções de drenagem.'
      WHEN 2 THEN 'Limpeza complementar, rastelamento e recolhimento de resíduos nas áreas liberadas.'
      WHEN 3 THEN 'ROTINA MENSAL: na primeira semana verificar placa/guarda-corpos; depois acompanhar manutenções preventivas.'
      WHEN 4 THEN 'Atendimento global eventual com OS aprovada; sem demanda, conservar pontos de maior risco.'
      ELSE 'Encerrar checklist semanal, evidências, materiais e prioridades; revisar plano do mês.' END END
   END
  WHEN 'EQ06' THEN CASE WHEN s.shift='manha'
   THEN 'Coordenação e conferência de atendimento nos seis postos fixos; execução conforme escala dos próprios postos, sem alocar pessoas adicionais.'
   ELSE 'Verificar conservação, segurança e fechamento dos serviços dos postos; registrar pendências, materiais e demanda eventual sem duplicar mão de obra.' END
  ELSE 'Revisar demanda contratual e condições de segurança antes de qualquer atividade.'
 END,
 CASE WHEN d.team_code='EQ06' THEN 'Postos fixos descentralizados: conforme roteiro de cada posto'
      ELSE d.planned_location END,
 CASE WHEN d.team_code='EQ05' THEN 'Proposta de manutenção global: rotina diária, semanal e mensal; serviços eventuais apenas com demanda, materiais e autorização. Novembro: fase de estruturação; dezembro/janeiro: ciclo recorrente. Validar acesso, segurança e clima.'
      WHEN d.team_code='EQ06' THEN 'Equipe de jardinagem integrada à escala dos seis postos; não contabilizar adicional de pessoal nem medição diária do item 3.40.'
      ELSE 'Proposta operacional sujeita a vistoria local, EPI/equipamentos, previsão atual, liberação e medição pelo item correto, sem duplicar serviços.' END,
 'rascunho'
FROM dias d CROSS JOIN turnos s
ON CONFLICT (team_assignment_id,shift) DO NOTHING;

-- A equipe de jardinagem dos postos não é pessoal adicional aos postos do item 3.40.
WITH dias AS (
 SELECT DISTINCT work_date,extract(isodow from work_date)::int as weekday,
        extract(day from work_date)::int as monthday
 FROM public.daily_team_assignments WHERE work_date BETWEEN DATE '2026-11-01' AND DATE '2027-01-31'
), turnos AS (
 SELECT unnest(ARRAY['manha','tarde']::text[]) AS shift
), propostas AS (
 SELECT d.work_date,s.shift,p.id post_id,p.name post_name,d.weekday,d.monthday,
 CASE WHEN s.shift='manha'
   THEN 'ROTINA DIÁRIA: ' ||
      'Conservação dos jardins e canteiros (D1); limpeza manual, monda e cuidados de plantas conforme necessidade e segurança.'
   ELSE 'ROTINA DIÁRIA: rastelamento, recolhimento e destinação regular de folhas/resíduos (D2), conservação de vasos e acessos.' END
 || CASE WHEN d.weekday=2 AND s.shift='tarde' THEN ' ROTINA SEMANAL S1: inspecionar vasos e jardineiras, irrigar somente se necessário.'
     WHEN d.monthday BETWEEN 1 AND 7 AND d.weekday=3 AND s.shift='tarde' THEN ' ROTINA MENSAL M1: vistoria de coroamento e recortes de bordas.'
     WHEN d.monthday BETWEEN 8 AND 14 AND d.weekday=3 AND s.shift='tarde' THEN ' ROTINA MENSAL M2: verificar cobertura morta e solo.'
     WHEN d.monthday BETWEEN 15 AND 21 AND d.weekday=3 AND s.shift='tarde' THEN ' ROTINA MENSAL M3: avaliar adubação e podas leves somente com liberação técnica.'
     ELSE '' END AS activity
 FROM dias d CROSS JOIN public.service_posts p CROSS JOIN turnos s
)
INSERT INTO public.daily_shift_plans
(work_date,shift,service_post_id,planned_activity,planned_location,supervisor_note,review_status)
SELECT work_date,shift,post_id,activity,post_name,
 'Proposta da escala de postos (item 3.40): confirmar jardineiro disponível, acesso e necessidade; sem contabilizar equipe EQ06 como pessoal adicional ou gerar cobrança diária separada.','rascunho'
FROM propostas ON CONFLICT (service_post_id,work_date,shift) DO NOTHING;
