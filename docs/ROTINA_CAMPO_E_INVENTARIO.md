# SIGA Américas · Registro diário de campo e conferência de quantitativos

## Preenchimento rápido (versão simplificada)

Com login de técnico associado à equipe, o formulário exige normalmente **duas escolhas**: confirmar a **frente de trabalho** e escolher uma atividade entre os **73 itens técnicos**. A data já vem preenchida, a equipe é reconhecida pelo login e o resultado inicial é **Feito**, com alternativas **Parcial**, **Impedido** e **Não se aplica**. Para outras atividades, há **Adicionar outra atividade**, seguido de **Enviar relatório**.

Em **Detalhes desta atividade** ficam quantidade, unidade, horas, ordem de serviço, local específico, evidência e trabalhadores participantes. Em **Mais detalhes do dia** ficam presença, clima, veículos, segurança e observações. Esses campos são opcionais.

A ausência de presença preenchida significa **não informada**, nunca zero trabalhadores. Atividade feita sem quantidade é um relato qualitativo, não uma medição contratual. O envio não valida execução nem conclui automaticamente uma OS; a supervisão deve conferir.

## O que mudou em relação ao formulário anterior
O formulário legado do Google Apps Script gravava em `05_Execucao`: **equipe, data, atividade realizada, horas, responsável, observações, dias de campo, quantidade e unidade**, alterando automaticamente o status do planejamento.

No SIGA atual, o módulo **Campo e execução → Registro diário de campo** é ligado diretamente ao PostgreSQL/Supabase, com histórico protegido, e passa a registrar:
- Data, equipe real (6 equipes) e frente operacional (8 frentes);
- Técnico responsável, período, condições climáticas, veículos/equipamentos usados;
- Trabalhadores cadastrados, com condição de presença e sem dados de saúde ou motivo médico;
- Um ou mais itens da **matriz técnica de 73 atividades**, local/setor, OS opcional, horas, quantidade, unidade, resultado e evidência;
- Quais **trabalhadores participaram de cada atividade**, vinculados ao próprio cadastro;
- Impedimentos e observações gerais;
- `rascunho` → `enviado` → `validado` ou `devolvido`.

**O envio não marca uma OS como concluída, não comprova uma medição, não gera faturamento e não altera os itens contratados.** A confirmação é feita pela supervisão em **Campo e execução → Acompanhamento das equipes**.

## Fluxo operacional recomendado

1. **Antes do campo:** supervisão compartilha a programação por frente e as OS autorizadas. Técnico e equipe recebem orientação e verificam recursos, clima e condições de segurança.
2. **Ao longo do dia:** técnico registra a participação dos trabalhadores e as atividades realizadas, parciais ou impedidas. Não é necessário preencher todos os campos opcionais; registrar quantidade e unidade sempre que aplicável.
3. **Ao encerrar o trabalho:** técnico envia o relatório. Registros não enviados permanecem como rascunho.
4. **Na supervisão:** verificar relatórios recebidos por equipe/data, participantes, quantidades, impedimentos e evidências. Validar ou devolver para complementação.
5. **Semanalmente:** confrontar planos, OS, relatórios validados e execução medida. A ausência de relatório não significa automaticamente ausência ao trabalho.
6. **Mensalmente:** consolidar os indicadores de execução sem misturar previsão, execução reportada, execução validada e medição da Itaipu.

A migração preserva o cadastro atual. **Relatórios históricos do formulário Apps Script não foram importados automaticamente**; poderão ser migrados em etapa separada após conferência.

## Como conceder acesso a um técnico

Um administrador da PROERG deve criar o usuário em **Supabase → Authentication → Users**, sem compartilhar senha ou credenciais administrativas.

Em seguida, no SQL Editor, associar o perfil ao usuário e à equipe correta, substituindo o e-mail e o código conforme os dados verificados:

```sql
insert into public.app_memberships(user_id,role,team_id,enabled)
select u.id,'tecnico',t.id,true
from auth.users u
join public.teams t on t.code='EQ01'
where lower(u.email)=lower('EMAIL_DO_TECNICO')
on conflict (user_id) do update set
 role='tecnico',
 team_id=excluded.team_id,
 enabled=true;
```

Os técnicos acessam somente **Visão geral** e **Registro diário de campo**; o formulário e as políticas de segurança restringem os relatórios e os dados de colaboradores à equipe atribuída. A gestão e a supervisão continuam com acesso ao painel de todas as equipes.

A implantação deve considerar autorização institucional para tratamento dos dados de empregados, retenção, treinamento de usuários, backups e verificação de permissões.

## Conferência de ferramentas e frota

Em **Patrimônio e materiais → Conferência de quantitativos**, existem três abas:
- **Ferramentas:** 39 tipos e 252 unidades indicativas da **Tabela 05** (item 6.4).
- **Veículos:** 11 tipos e 16 unidades indicativas do **item 6.1**.
- **Equipamentos:** 10 tipos regulares do **item 6.2** e 1 fornecimento específico da Itaipu relacionado às trilhas RBV, ainda pendente de validação documental.

Os quantitativos contratuais são apresentados como **somente leitura**. Digite a **quantidade encontrada** para cada linha; o sistema calcula a diferença. O campo observação é opcional.

**Não preenchido** não é o mesmo que **zero disponível**. Quando o recurso foi conferido e nenhum exemplar encontrado, registrar `0`. Quantidade igual à referência não comprova regularidade documental, conservação, identificação patrimonial ou adequação à operação.

A distinção entre `quantidade prevista`, `quantidade encontrada` e `qualidade/conformidade` é mantida para permitir uma vistoria em etapas. A avaliação qualitativa continua no módulo **Recursos exigidos pelo contrato**, com anexação/documentação complementar a implementar.

## Identidade visual
Foram restaurados **os arquivos SVG originais enviados**:
- `assets/siga-logo-original-1.svg`: marca horizontal na tela de login;
- `assets/siga-marca-original-2.svg`: símbolo no menu e favicon;
- `assets/siga-logo-original-3.svg`: variante original preservada.

Sem redesenho, exportação rasterizada ou alteração dos vetores de origem.
