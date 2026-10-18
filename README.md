# SIGA Américas
**Sistema Integrado de Gestão Ambiental e Operacional — PROERG / Itaipu Binacional**

Nova fundação de um ERP contratual: gestão de obrigações, equipes, serviços, frota, combustível, ferramentas, manutenção, fardamentos, EPIs, suprimentos e aquisições.

> **Estado: fundação funcional (MVP)**. Interface, cadastros, consultas e edição de registros foram implementados. A utilização depende de configurar o Supabase, executar a migração e autorizar os usuários. Não equivale a um ERP/SAP completo, não inclui medições financeiras homologadas nem integrações com RH.

## Arquitetura
- **GitHub Pages**: interface estática em HTML, CSS e JavaScript nativos, sem bundler.
- **Supabase/PostgreSQL**: banco relacional, autenticação e segurança RLS.
- **Modelo de dados**: 18 tabelas operacionais, tabela de usuários autorizados e auditoria.
- **Sem dados fictícios**: banco inicial com somente oito frentes operacionais identificadas, distintas das seis equipes reais.

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

## Próximas entregas
Conferência do cadastro contratual contra o instrumento assinado; controle de saldos e mínimos do almoxarifado; fluxo de solicitações e aprovações; geração/assinatura de termos; alertas de manutenção e EPIs; anexos protegidos; relatórios com filtros e exportação paginada; governança das métricas e validação com a direção.

Documentos iniciais: `docs/OPERACAO.md` e `docs/TERMO_RESPONSABILIDADE.md`.
