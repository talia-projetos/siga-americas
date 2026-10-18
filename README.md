# SIGA Américas
**Sistema Integrado de Gestão Ambiental e Operacional — PROERG / Itaipu Binacional**

Nova fundação de um ERP contratual: gestão de obrigações, equipes, serviços, frota, combustível, ferramentas, manutenção, fardamentos, EPIs, suprimentos e aquisições.

> **Estado: implantação orientada à conferência (MVP)**. Interface, autenticação e integração Supabase estão configuradas; cadastros documentais foram importados e precisam de revisão operacional. Não equivale a um ERP/SAP completo e não substitui medição fiscalizada, contabilidade ou RH.

## Arquitetura
- **GitHub Pages**: interface estática em HTML, CSS e JavaScript nativos, sem bundler.
- **Supabase/PostgreSQL**: banco relacional, autenticação e segurança RLS.
- **Modelo relacional**: contratos, 73 atividades de matriz interna, 53 itens de preços, obrigações, recursos exigidos, rotinas, colaboradores, frota e indicadores, com auditoria.
- **Dados iniciais**: 110 colaboradores a conferir, 6 equipes cadastradas, 8 frentes, 6 postos, 21 obrigações, 109 requisitos, 32 programações, 73 oportunidades candidatas e 36 modelos de rotinas. Cadastro não comprova disponibilidade nem execução.

## Acesso e identidade visual
- Site: https://talia-projetos.github.io/siga-americas/
- **A tela inicial exige login.** Visitantes não devem acessar menus nem dados operacionais.
- Identidade visual aprovada publicada em `assets/siga-logo-horizontal.png`, `assets/siga-logo-monochrome.png`, `assets/siga-app-icon.png` e `assets/favicon.png`.
- A sessão é autenticada com Supabase Auth; perfis e RLS limitam consultas e alterações.

## Configuração inicial
1. Abra [Supabase Dashboard](https://supabase.com/dashboard) e crie ou selecione o projeto destinado ao SIGA.
2. Em **SQL Editor**, execute o conteúdo de `supabase/migrations/202610180001_init.sql`. Se a integração GitHub/Supabase já tiver aplicado a migração, **não execute novamente sem conferir o histórico**.
3. Em **Authentication → Users**, crie o primeiro usuário de acesso. O sistema não permite cadastro aberto.
4. No SQL Editor, execute (substitua o e-mail pelo cadastrado):
   ```sql
   insert into public.app_memberships(user_id,role)
   select id,'admin' from auth.users where email='SEU_EMAIL';
   ```
5. Em **Project Settings → API Keys**, obtenha a **publishable key** (ou a chave pública legacy anon) e a **Project URL** em Project Settings/API.
6. Edite `assets/config.js`, preenchendo apenas:
   ```js
   export const SUPABASE_URL = "https://ID_DO_PROJETO.supabase.co";
   export const SUPABASE_PUBLISHABLE_KEY = "SUA_CHAVE_PUBLICA";
   ```
   A URL e a publishable/anon key são públicas. **NUNCA** inclua service_role, secret key, senha, JWT privado ou credencial de administração.
7. Em **GitHub → Settings → Pages**, publique a branch `main`, pasta `/(root)`. O endereço, após publicado, será normalmente `https://talia-projetos.github.io/siga-americas/`.
8. Abra o site, autentique-se e comece pelos cadastros de contrato, equipes reais e responsáveis.

> O vínculo Supabase ↔ GitHub **não** conecta automaticamente a interface web ao banco. A integração do site depende do passo 6 e das políticas RLS.

## Perfis de acesso
- `admin`: leitura e edição, inclusive gestão de perfis no banco.
- `gestao`: leitura e edição dos módulos.
- `supervisao`: leitura e edição dos módulos.
- `consulta`: leitura das informações não classificadas como restritas.

Os perfis são geridos em `app_memberships`. Os módulos de pessoas, custos, EPIs individuais, fardamentos, manutenção, termos e compras são restritos a usuários autorizados. A autenticação não dispensa avaliação da LGPD, do tratamento dos documentos e de acesso institucional.

## Planejamento de campo
A lógica adotada é `Matriz 73 → Cobertura → Planejamento mensal → Ações programadas → OS → Registros e evidências`. Os 73 itens foram mantidos com códigos próprios, responsáveis PROERG e interlocutores Itaipu a validar. Os 53 itens de preços constituem **catálogo diferente**, sem ligação automática por número.

- `Matriz técnica · 73 atividades`: consulta e conferência do catálogo completo.
- `Cobertura dos 73 itens`: triagem do que é aplicável, candidato, programado ou executado. *Candidata* não conta para 100% de cobertura validada.
- `Planejamento mensal de campo`: 8 frentes × 4 competências (out/2026–jan/2027), a validar.
- `Ações programadas`: 73 oportunidades iniciais a quantificar e qualificar; nenhuma foi marcada como realizada.
- `Rotinas periódicas dos postos`: 36 templates nos seis postos (diárias, semanais e mensais), sem gerar execução fictícia.
- `Registro das rotinas de campo`: registros reais, por dia e situação, que devem ser vinculados a evidências quando disponíveis.

Método completo: [`docs/PLANEJAMENTO_CAMPO.md`](docs/PLANEJAMENTO_CAMPO.md).

## Navegação gerencial (outubro/2026)
A navegação foi reorganizada em seis áreas recolhíveis, mantendo todos os cadastros:
- **Planejamento:** Cobertura, planejamento mensal e ações programadas.
- **Campo e execução:** ordens de serviço e rotinas periódicas.
- **Contrato e obrigações:** obrigações por parte responsável, matriz de atividades técnicas e postos.
- **Financeiro:** **Tabela de preços**, abastecimentos, manutenções e solicitações de compras.
- **Patrimônio e materiais:** exigências de recursos, bens, movimentações e estoque.
- **Pessoas e segurança:** colaboradores, EPIs e uniformes.

**Dois catálogos diferentes:** `Matriz técnica · 73 atividades` contém as atividades para programação de campo; `Tabela de preços` contém **apenas 53 itens remunerados**, suas quantidades previstas, unidades, preços unitários e valores estimados. A simples coincidência de numeração entre os catálogos não configura correspondência contratual.

Na página inicial, seis gráficos mostram o estado atual de cada área, sem misturar metas, execução e despesas. Os gráficos consultam os dados do Supabase com controle de acesso; quantidades de recursos exigidos não significam estoque disponível.

### Responsabilidades contratuais
O cadastro `contract_obligations` inclui **parte responsável** (`PROERG`, `Itaipu`, `Compartilhada`, `A confirmar`) e **assunto** (campo, pessoal, segurança, frota, máquinas, materiais, ambiental ou documentação).

O cadastro `contract_resource_requirements` inclui **parte fornecedora**, categoria e quantidades previstas/observadas, com validação documental. A referência específica do item 3.9 (trilhas RBV) foi registrada como fornecimento Itaipu **a confirmar documentalmente**; as demais exigências inicialmente atribuídas à PROERG devem ser conferidas contra a íntegra do contrato e suas exceções.

O status `pendente` indica **verificação em aberto** e não comprova descumprimento. Valores de itens de preços são **estimativas contratuais**, não desembolsos, medições aprovadas ou custos realizados.

## Módulos
| Grupo | Cadastros e registros |
| --- | --- |
| Gestão contratual | Contratos, itens, obrigações, frentes, equipes e ordens de serviço |
| Recursos e custos | Veículos, abastecimentos, equipamentos, termos e manutenções |
| Pessoas e segurança | Colaboradores, catálogo e entregas de EPIs, fardamento |
| Suprimentos | Itens e movimentações de estoque, solicitações de compra |

**Importante:** itens da *especificação técnica* e itens da *planilha de preços* ficam em séries separadas (`source_type`). Os códigos não devem ser reconciliados automaticamente por número.

## Dados e regras
- Não há exclusão operacional pela interface: retificações ficam na auditoria.
- Abastecimentos distinguem combustível fornecido pela PROERG, pela Itaipu ou outra origem.
- Termos de responsabilidade associam **um veículo ou um equipamento**, profissional e situação documental; não pressupõem culpa por avaria ou desgaste.
- Estoque é registrado por movimentos de entrada e saída. O cálculo de saldo e alertas automáticos será uma evolução.
- Valores financeiros registrados são dados operacionais; não substituem a contabilidade nem as medições contratuais aprovadas.
- A listagem carrega até **200 registros** e o CSV exporta apenas os registros visíveis/carregados: não usar como exportação integral ou backup.
- As oito frentes EQ01–EQ08 são **áreas de acompanhamento**, não oito equipes físicas.

## Segurança / implantação
1. Confirmar com a PROERG a autorização para armazenar dados contratuais e funcionais em serviços externos.
2. Verificar RLS em cada tabela antes de cadastrar dados reais.
3. Proteger a conta Supabase com MFA; limitar administradores.
4. Configurar backup periódico fora do plano Free, que não é uma solução de backup empresarial.
5. Não usar o repositório GitHub público como arquivo de fichas individuais, notas fiscais ou termos assinados.
6. O repositório foi reconstruído em novo commit **sem excluir o histórico Git**. Arquivos retirados da versão ativa podem permanecer acessíveis em commits anteriores; dados confidenciais exigem saneamento próprio.

## Pendências documentais e de verificação
- Conferir fonte das 12 funções que vieram repetidas como nomes de empregados.
- Validar o vínculo entre matriz interna de 73 atividades e catálogo de preços de 53 itens.
- Validar quantidades reais e condições dos veículos, máquinas e EPIs. **Requisito contratado não significa bem recebido.**
- Conferir cada uma das 73 oportunidades e registrar somente serviços necessários e autorizados.
- A relação de 21 obrigações inclui os pontos inicialmente transcritos da especificação; ainda exige revisão sistemática de **todas** as cláusulas do instrumento completo e anexos.
- Manter em rotina de campo as 36 frequências propostas, verificando aplicabilidade local.

## Próximas entregas
Conferência do cadastro contratual contra o instrumento assinado; controle de saldos e mínimos do almoxarifado; fluxo de solicitações e aprovações; geração/assinatura de termos; alertas de manutenção e EPIs; anexos protegidos; relatórios com filtros e exportação paginada; governança das métricas e validação com a direção.

Documentos iniciais: `docs/OPERACAO.md` e `docs/TERMO_RESPONSABILIDADE.md`.
