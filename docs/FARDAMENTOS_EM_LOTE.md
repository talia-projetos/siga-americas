# SIGA Américas · Fardamentos em lote

## Objetivo
A rotina evita registrar manualmente cada peça por trabalhador. Os 110 colaboradores ativos estão cadastrados, mas seus tamanhos de camisa e calça **ainda precisam ser conferidos**, pois não há preenchimento automático com dados fictícios.

## Como funciona
Acesse **Pessoas e segurança → Fardamentos → Registrar em lote**.

1. Selecione a equipe, o mês de início do ciclo semestral e a **data efetiva da entrega**. A data não pode estar no futuro nem fora do período selecionado.
2. Marque somente os colaboradores que **receberam** o kit. É possível selecionar todos os nomes exibidos pelo filtro.
3. Confira os tamanhos de camisa e calça de cada colaborador. O sistema reutiliza os tamanhos cadastrados, quando existentes. Os campos são editáveis e há preenchimento conjunto para selecionados.
4. Caso queira apenas levantar os tamanhos, clique em **Salvar somente tamanhos**. Isso atualiza as fichas de colaboradores e **não registra entrega**.
5. Se os kits completos já foram efetivamente entregues, confira o número/referência do comprovante, assinale a confirmação explícita e clique em **Registrar entregas em lote**.

Cada kit é registrado como **3 linhas individuais por colaborador** na tabela histórica: **4 camisas de manga longa UV, 1 camisa polo e 4 calças táticas**, ou seja, 9 peças por trabalhador. A quantidade contratual é um **padrão sugerido de composição**, não uma afirmação de recebimento.

A tela também mantém a opção **Entrega individual**, destinada a trocas, complementos ou entregas parciais, de modo que essas situações não gerem um kit completo fictício.

## Rastreabilidade e proteção contra duplicidade
A operação utiliza a função transacional `public.create_uniform_bulk_delivery` do Supabase:
- exige uma conta ativa com permissão de escrita;
- verifica que todos os colaboradores estão ativos;
- exige tamanho de camisa e calça para cada escolhido;
- não aceita uma segunda entrega de kit no mesmo intervalo semestral nem uma entrega individual já existente no ciclo para o mesmo trabalhador;
- cria todas as linhas do lote **em uma única transação**, com `batch_id`, autor, data e token de idempotência para evitar duplicações por reenvio;
- mantém auditoria em tabelas de lotes e destinatários.

A UI fornece uma pré-conferência, mas a última validação acontece no próprio banco.

## Cuidados
- Não use **Registrar em lote** para simular uma compra, reservar estoque ou prever entrega futura.
- Não há integração automática com estoque nesta rotina. O lançamento atesta **entrega documental**, não baixa física verificada em almoxarifado.
- O texto de comprovante é uma **referência**; não equivale a arquivo assinado. A incorporação de assinatura digital pode ser feita depois.
- Para contratos cujo ciclo semestral não começa no primeiro dia de janeiro/julho, selecione explicitamente a competência de início correta.
- Nunca registre um kit completo se a pessoa recebeu apenas parte das peças: use **Entrega individual**.
