# Mapa interativo de cobertura e matrizes — SIGA Américas
Atualização: 22/10/2026

## Cartografia
O mapa continua navegável (Leaflet, Esri Satellite e OpenStreetMap, com opção Google Maps configurada).
- Polígonos de cobertura: contorno fino por setor e hachura SVG diagonal com opacidade de 20% nas linhas e fundo leve; apenas geometrias reais.
- Linhas e rotas: traço interrompido (9/6), espessura aproximada de 3 px e contraste com ortoimagem.
- Pontos e matrizes: marcadores circulares sólidos com raio aproximado de 5 px, contorno branco discreto, nomes e coordenadas WGS84 consultáveis por clique.
- Google Maps opcional: círculos sólidos e rotas pontilhadas; polígonos com preenchimento translúcido simples, pois a API de dados não dispõe de hachura vetorial nativa. Para hachura QGIS, utilizar Esri Satellite ou OSM.

## Dados e ressalvas
Há 10 polígonos institucionais, um traçado de matrizes/coleta e **31 pontos de árvores matrizes** registrados na base, provenientes de `arvores_matrizes_31_pontos.kml`. Estes 31 pontos ainda possuem nomes provisórios P01–P31 «A identificar». O atributo `reference_scope` da camada foi alterado para `matrizes`, sem mudança das coordenadas.

O arquivo fornecido no ChatGPT, `quarta-feira_Morning_Research-Field_Work.kmz`, possui aproximadamente 377 MB. **Seu conteúdo não foi extraído diretamente no ambiente de edição**. Portanto, não se deve afirmar que ele foi importado, que possui 31 matrizes ou que os nomes científicos estejam identificados. Nenhuma coordenada foi inventada e os pontos existentes não foram substituídos.

## Conferência e importação
O próprio SIGA fornece o botão **Importar matrizes KMZ**, disponível para perfis autorizados na aba **Mapa de cobertura**:
1. Escolher o KMZ/KML e a categoria «Árvores matrizes (KMZ)».
2. O importador ZIP lê o diretório central do arquivo e extrai apenas o KML interno (preferencialmente `doc.kml`). Fotografias embutidas não são carregadas na memória.
3. O sistema identifica os pontos georreferenciados, informa quantos apresentam nomes temáticos, mostra nomes e coordenadas em WGS84 e conta sobreposições a menos de 3 metros com as matrizes já cadastradas.
4. **Substituir os 31 pontos provisórios** é uma escolha explícita, após conferência das feições; sem essa escolha, uma importação potencialmente duplicada é bloqueada.
5. A camada importada permanece com status `geometria_importada`, não `validado_contrato`. A identificação botânica, os vínculos operacionais e a comprovação contratual devem ser confirmados pela equipe responsável.

Limites técnicos: KML interno de até 24 MB, no máximo 800 geometrias por camada e 50 mil vértices; coordenadas em EPSG:4326, na área de Foz do Iguaçu. O arquivo KMZ externo pode exceder essas dimensões por conter mídias, sem que o sistema precise lê-las.

Este procedimento não cria ordens de serviço, medições nem atividades executadas.
