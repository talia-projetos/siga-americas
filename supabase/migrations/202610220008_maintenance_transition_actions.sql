-- Cadastro de ações para estruturação da manutenção global (sem atestar execução).
CREATE TABLE public.maintenance_action_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code text NOT NULL UNIQUE,
  title text NOT NULL,
  workstream text NOT NULL,
  cadence text NOT NULL CHECK(cadence IN ('transicao','diaria','semanal','mensal','eventual')),
  priority text NOT NULL CHECK(priority IN ('alta','normal','condicionada')),
  phase text NOT NULL,
  condition_for_execution text NOT NULL,
  status text NOT NULL DEFAULT 'a_verificar' CHECK(status IN ('a_verificar','planejada','aguardando_insumo','em_andamento','concluida','impedida')),
  evidence_reference text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.maintenance_action_register ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.maintenance_action_register TO authenticated;
CREATE POLICY maintenance_actions_read ON public.maintenance_action_register
FOR SELECT TO authenticated USING(siga_private.is_active_member());
CREATE POLICY maintenance_actions_write ON public.maintenance_action_register
FOR ALL TO authenticated USING(siga_private.can_write()) WITH CHECK(siga_private.can_write());
INSERT INTO public.maintenance_action_register
(action_code,title,workstream,cadence,priority,phase,condition_for_execution) VALUES
('MAN-01','Conferência de guarda-corpo e acesso da ponte do Portinho','Segurança e estruturas','transicao','alta','Novembro · primeira semana','Inspeção de estabilidade, materiais disponíveis, isolamento necessário e autorização de intervenção.'),
('MAN-02','Drenagem e orifícios de descarga nas calhas do Viveiro Florestal','Drenagem pluvial','transicao','alta','Novembro · semanas 1 a 2','Avaliar tecnicamente o percurso da água e segurança de acesso; serviço em altura somente com habilitação e liberação.'),
('MAN-03','Desobstrução e solução de drenagem provisória no entorno dos viveiros','Drenagem e efluentes','transicao','alta','Novembro · semanas 1 a 3','Diagnosticar condição da obra e os pontos existentes; correção definitiva depende de responsável técnico, acesso e materiais.'),
('MAN-04','Limpeza e conferência de calhas e pontos de água em edificações','Drenagem pluvial','semanal','alta','Novembro e recorrente','Selecionar trechos acessíveis e seguros; registrar locais atendidos e impedimentos por chuva/altura.'),
('MAN-05','Remoção e destinação adequada de resíduos da oficina','Limpeza e resíduos','transicao','alta','Novembro · semanas 1 a 3','Conferir classificação, quantidades, destino autorizado e disponibilidade de transporte.'),
('MAN-06','Manutenção preventiva de vegetação na Barreira do Refúgio','Conservação de áreas','semanal','normal','Novembro e recorrente','Conferir trechos remanescentes, acesso e condições de máquina, solo e vegetação.'),
('MAN-07','Limpeza e conservação do entorno de edificações','Limpeza e conservação','diaria','normal','Novembro e recorrente','Definir roteiro de unidades, frequência de recolhimento e evidência por local.'),
('MAN-08','Guarda-corpos e pintura preventiva na área do Biotério/Nutrição','Segurança e estruturas','mensal','condicionada','Novembro · semanas 2 a 4','Liberar intervenção somente após conferir superfície, material, acesso e isolamento adequado.'),
('MAN-09','Manutenção do entorno e inspeção dos Lagos da Administração','Conservação de áreas','semanal','normal','Novembro e recorrente','Verificar condições de segurança, margens, resíduos e eventual necessidade de equipe especializada.'),
('MAN-10','Sinalização de identificação do Viveiro Florestal','Sinalização e estruturas','eventual','condicionada','Novembro · semanas 2 a 4','A instalação e acabamento dependem da disponibilização das madeiras e liberação de materiais.'),
('MAN-11','Organização e conferência de recursos e operadores de máquina','Apoio operacional','semanal','normal','Novembro e recorrente','Validar programação e disponibilidade real de pessoal, veículos e equipamentos.'),
('MAN-12','Conservação das calhas e controle de erosão no entorno do viveiro','Drenagem pluvial','semanal','alta','Novembro e recorrente','Verificar escoamento, pontos de acúmulo e inspeção pós-chuva; sem presumir conclusão de correções especializadas.'),
('MAN-13','Conferência do Horto de Plantas Medicinais e conservação semanal','Apoio Viveiro','semanal','normal','Novembro e recorrente','Articular com o Viveiro: remoção de galhos, limpeza e recolhimento de resíduos conforme necessidade.');
