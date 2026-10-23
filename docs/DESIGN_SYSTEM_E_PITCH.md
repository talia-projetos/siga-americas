# SIGA Américas · Design, experiência e apresentação executiva

## Intenção de produto
O SIGA Américas organiza contrato, operação de campo, equipes, recursos e conformidade de forma intuitiva, mantendo o detalhamento técnico acessível quando necessário. **A ferramenta não deve exigir conhecimento de banco de dados, módulos internos ou códigos de implementação de quem a utiliza.**

## Identidade visual
- **Marcas:** exclusivamente os SVGs originais enviados, preservados no login, na barra lateral e no favicon.
- **Tipografia:** **Manrope** para hierarquia editorial (títulos, indicadores e seções) e **Inter** para controles, registros, números e corpo do texto. Fallbacks locais asseguram leitura mesmo sem acesso ao serviço de fontes.
- **Paleta:** verdes sóbrios e superfícies brancas, com alertas em âmbar, erro em vermelho discreto e informações em azul suave. Cor é apoio, nunca único significado de um status.
- **Componentes:** cantos de 9 a 18 px, bordas leves, sombras contidas, contraste alto em textos e espaçamentos consistentes.

## Estrutura da navegação
**Seis áreas recolhíveis**, com busca por módulo e ícones SVG padronizados, mantendo os nomes e todos os registros já existentes:
1. Planejamento
2. Campo e execução
3. Contrato e obrigações
4. Financeiro
5. Patrimônio e materiais
6. Pessoas e segurança

**Visão geral** fica isolada no início. O cabeçalho apresenta o ambiente e o usuário, com **Sair da conta** dentro do menu do perfil, sem ações espremidas na borda. No celular, a navegação se transforma em painel lateral com fechamento por toque na área externa.

## Página inicial
A Visão geral responde imediatamente a quatro perguntas:
- **Relatórios para validar:** quantos relatórios aguardam revisão da supervisão?
- **Ordens em aberto:** quantas OS continuam abertas?
- **Recursos a conferir:** quantos requisitos ainda não tiveram a conformidade verificada?
- **Obrigações a verificar:** quantas obrigações ainda exigem conferência documental?

Os cartões levam diretamente à respectiva tela. Há quatro atalhos de uso frequente, movimentação recente das ordens e gráficos por área. **Não há explicações sobre a arquitetura do sistema na página inicial.**

**Interpretação correta dos indicadores:** pendente significa verificação em aberto, não violação constatada; requisito contratual não é patrimônio recebido; planejamento não é execução; relatório enviado não é execução validada.

## Padrão de interação
- **Primário:** confirmar ações como salvar, enviar e criar.
- **Secundário:** abrir filtro, adicionar item e navegar entre etapas.
- **Discreto/ghost:** voltar, cancelar, exportar, fechar e consultar.
- **Crítico:** exclusões e ações irreversíveis, com linguagem e aparência próprias.

Todos os controles devem ter estados de foco, hover, desabilitado e carregamento, com alvos de toque maiores em celulares. Botões apresentam rótulos que descrevem a ação; ícones a reforçam, não a substituem.

## Tabelas e formulários
As tabelas oferecem pesquisa, filtros, ordenação por coluna e exportação da consulta carregada, respeitando as permissões do usuário. Totais e unidades financeiras ficam separados da matriz técnica de 73 atividades. Campos de status usam nomes legíveis e cores semânticas discretas.

Formulários exibem o essencial primeiro; dados complementares aparecem sob expansão voluntária. **Registro diário de campo** mantém data e equipe preenchidas, com escolha de frente e atividade, resultado e envio rápido; presença, quantidade, horas, fotos e observações podem ser complementados conforme a necessidade. A supervisão continua responsável por validar os relatos.

## Avanços em relação à solução anterior
| Antes (formulário/planilha) | SIGA Américas |
|---|---|
| Apontamento centrado na planilha | Registro conectado a equipes, frentes, atividades e OS |
| Registro operacional isolado | Planejamento, relato, supervisão e consulta em um sistema |
| Conferência em arquivos dispersos | Quantidades previstas e observadas de ferramentas, veículos e equipamentos |
| Menor distinção entre informação e validação | Estados próprios para relato, análise e validação |
| Poucos indicadores integrados | Visão executiva com métricas e gráficos por área |
| Interface de formulário relativamente extensa | Fluxo rápido no celular, campos progressivos |

## Slide executivo · de prestação de contas à inteligência de gestão

**Título:** SIGA Américas | Da informação operacional à decisão gerencial

**Mensagem central:** O registro das execuções é o ponto de partida; a finalidade é identificar antecipadamente gargalos, riscos e decisões necessárias.

| Dimensão de gestão | Pergunta que o SIGA deve responder | Ação gerencial possível |
|---|---|---|
| Planejamento e capacidade | O trabalho programado cabe nas equipes, turnos, veículos e equipamentos disponíveis? | Redistribuir frentes e ajustar prioridades |
| Produtividade e impedimentos | Onde há atividades parciais, impedidas ou acumuladas? | Atacar causas de paralisação e reprogramar |
| Frota, máquinas e manutenção | Que recursos estão indisponíveis ou aguardando conferência? | Priorizar manutenção e reposição |
| Materiais, EPI e fardamento | Existe risco de desabastecimento ou pendências de entrega? | Antecipar compras e regularizações |
| Qualidade e rastreabilidade | O que foi apenas informado, conferido ou efetivamente validado? | Corrigir evidências e reduzir glosas |
| Execução financeira | Qual o valor potencial da produção registrada e sua distância da meta? | Reavaliar composição das frentes e ritmo de produção |

**Cuidados de leitura:** As perguntas representam capacidades gerenciais e hipóteses de atenção, não diagnóstico comprovado de descumprimento. Valor potencial não é faturamento aprovado. A identificação de matrizes foi retirada das execuções registradas em 23/10/2026; permanece como atividade contratual no catálogo.

## Discurso de apresentação (aproximadamente um minuto)
> O SIGA Américas não foi pensado apenas para demonstrar o que foi feito. Registrar a execução é só uma etapa. O sistema precisa ajudar a identificar por que o planejado não aconteceu, quais equipes estão sobrecarregadas, onde faltam recursos e quais decisões não podem esperar.
>
> Com planejamento, relatos de campo, conferência de equipamentos, manutenção, estoque e indicadores financeiros no mesmo ambiente, podemos transformar dados dispersos em prioridades de gestão. O objetivo é antecipar problemas, corrigir gargalos e melhorar a tomada de decisão, mantendo clara a diferença entre produção informada, conferência técnica e valor aprovado.

## Evidências e limites de confiabilidade
O frontend está publicado no GitHub Pages, utiliza HTML/CSS/JavaScript modular e autenticação com Supabase. A navegação, as verificações estáticas e as simulações locais de layout e consulta fazem parte da validação técnica. **A aprovação operacional exige testes com usuários reais em diferentes celulares, confirmação de permissões/RLS por perfil e conferência final dos cadastros, quantitativos, relatórios e fluxos de ponta a ponta.**

Não usar o pitch para afirmar que uma execução foi homologada, um saldo auditado ou uma redução de custos mensurada sem evidências correspondentes.
