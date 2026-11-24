# Visatto

**Veja o prato na sua mesa antes de pedir.** Cardápio digital (SaaS por mensalidade) em que o cliente vê o prato em
tamanho real pela câmera do celular e um garçom de IA tira dúvidas, recomenda e recebe o pedido, na mesa e no delivery.

Para colocar no ar sem programar, veja **[COMO-COLOCAR-NO-AR.md](./COMO-COLOCAR-NO-AR.md)**.

## O que tem

**Cliente** (`/r/[slug]`, `?mesa=N`, `?modo=delivery`, `?prato=<id>`)
- Cardápio no navegador, sem app, já renderizado no servidor (abre rápido e aparece com prévia ao compartilhar o link).
  Busca, categorias fixas no topo, destaques, etiquetas e pratos esgotados.
- Visualizador 3D (gira com o dedo) + realidade aumentada em tamanho real e travado:
  Android via WebXR/Scene Viewer, iPhone via AR Quick Look (USDZ). Aviso para sair de navegadores internos (Instagram etc.).
- Pedido na mesa ou entrega (forma de pagamento, troco, chave Pix com botão de copiar) e acompanhamento do status.
- Na mesa: chamar atendente e pedir a conta. O chamado aparece no painel com o número da mesa.
- Garçom de IA (Claude com ferramentas), **só aparece quando há `ANTHROPIC_API_KEY`**: recomenda, responde dúvidas,
  adiciona ao pedido e convida a ver o prato na mesa.

**Dono** (`/painel`, instalável como app pelo navegador)
- Pedidos ao vivo (Novos → Em preparo → Prontos) com aviso sonoro em qualquer tela do painel, contador na aba,
  chamados das mesas, comanda para imprimir, recusar pedido, pausar pedidos com um botão.
- Cardápio: categorias (criar, renomear, ordenar), pratos com foto, busca, esgotado/destaque com um toque,
  e o 3D de cada prato. No celular, o botão de escanear abre o escâner direto, sem QR.
- Resultados (faturamento, ticket médio, quem viu cada prato na mesa), QR codes por mesa, configurações
  (dados, cor da marca, mesa/entrega, taxa, pedido mínimo, chave Pix). "Primeiros passos" para contas novas.
- Importação do cardápio por foto e ajustes do garçom: só com a chave da Anthropic.
- **Escâner próprio com captura guiada (`/escanear/[token]`, aberto pelo QR do painel, sem login, sem app e sem custo)**:
  o dono põe a folha do marcador (`/marcador`) ao lado do prato, toca em **Começar** e dá uma volta. A câmera fica aberta
  dentro do site (`LiveCapture.tsx` + `live.ts`): a cada quadro o Visatto acha a folha, calcula de que lado o celular
  está, guarda sozinho a foto mais nítida de cada ângulo (24 fatias de 15°) e orienta na tela ("chegue mais perto",
  "mais devagar", "levante o celular"). Um anel vai fechando e, quando fecha, o 3D é montado sem apertar mais nada.
  O **tamanho da impressão é conferido sozinho** pela folha A4 (`sheetscale.ts`: mede a largura e a altura do papel em
  unidades do quadrado; se a impressora reduziu para 94%, a conta já sai certa), então não há mais passo de régua.
  **Estilo detalhado (padrão)**: malha fina (quadrados de ~4 mm, dezenas de milhares de polígonos) com normais
  suaves, pintura das fotos em 1280 px, sombreado dos encaixes pintado na textura (oclusão de ambiente, calculada no
  próprio volume) e sombra de contato da comida no prato (`shadePlate`). Cor de louça que "vaza" no pé da comida é
  trocada pela cor da própria comida.
  **IA que entende o prato (grátis, roda no próprio servidor)**: `src/lib/clip.ts` usa o modelo de visão OpenCLIP
  ViT-B/32 (pesos abertos, laion2b) convertido para ONNX e reduzido para 8 bits (89 MB, em `modelos/clip/`, dividido
  em partes de 23 MB por causa do limite de envio pelo site do GitHub). Roda com `onnxruntime-web` em WebAssembly
  (sem binário nativo) na rota `/api/scan/[token]/reconhecer`, ~0,25 s por imagem. Durante a montagem do 3D o celular
  manda 3 recortes do prato (reconhece o prato, entre os ~90 de `src/lib/scan/pratos.ts`, usando o nome do item como
  pista) e um recorte de cada pedaço (arroz, feijão, morango...; separados pela cor em `understand.ts`). O que foi
  reconhecido muda o 3D: feijão (e farofa/purê em pratos) vira um monte que escorre, morango inteiro é redesenhado
  com ~4 mil triângulos, sementes e folhinhas (`garnish.ts`). Se a IA não tiver certeza (ou o nome do item não bater
  com a imagem), a tela de conferência pergunta qual é o prato; o dono escolhe ou digita, e `/api/scan/[token]/pesquisar`
  procura na lista própria (aceita apelidos e erros de digitação) e depois na Wikipédia em português (`src/lib/pesquisa.ts`).
  "Refazer o 3D com isso" reaproveita as imagens já capturadas. Para ensinar pratos novos: edite `pratos.ts` e rode
  `tools/clip/prompts.mts` + `tools/clip/rotulos.py` (gera `modelos/clip/rotulos.json`).
  **Comida esculpida contra a louça** (`carveAgainstPlate` em `plate.ts`): a reconstrução só trata a mesa como
  fundo, e em cima de um prato grande quase não consegue esculpir (a comida saía "derretida"). Detectado o prato, a
  cor dele também vira fundo: um cubinho por onde várias fotos enxergam louça lisa é esvaziado; sobras soltas saem.
  Comida clara com textura (arroz, purê) é poupada pelo teste de "liso em volta"; o que sobra de claro com volume
  conta como comida, tem as covas fechadas (mancha fechada vista de cima + altura nivelada pelas vizinhas) e não tem
  a pintura confundida com louça. Ponto com cor de louça no pé de comida colorida fica sem pintura e herda a cor
  da comida em volta.
  **Estilo polígonos (opcional, `lowpoly.ts`, `style = "poligonos"`)**: versão low-poly. Cada pedaço de comida vira anéis de faces
  planas em volta do seu eixo (topologia limpa, como modelo desenhado à mão), fechado em cima (topo plano sai plano,
  cúpula acompanha a forma). A cor de cada face vem da malha pintada com as fotos e é arredondada para uma paleta
  curta. O prato também sai facetado e o molho vira faces coloridas. Arquivos ficam ~10× menores (GLB ~80 KB).
  
  **Acabamento do 3D** (`plate.ts` + `volume.ts`): quando há um prato redondo, ele deixa de ser esculpido pelas fotos
  e passa a ser desenhado (círculo perfeito no raio e no perfil medidos, material de porcelana); molho e comida rasa
  viram pintura no prato e só a comida com volume vem das fotos. A malha é alisada (Taubin) e sai com normais suaves,
  a pintura usa a melhor foto de cada ponto (menos borrão), ganha um leve realce de cor e as partes não vistas são
  preenchidas em degradê. Sem prato redondo (copo, cupcake, tábua), vale o caminho geral com os mesmos acabamentos.
  Se a câmera não abrir dentro do site, cai para o vídeo comum; vídeo pronto, 10–30 fotos e o modo manual continuam em
  "Ajustes e outros jeitos de escanear". Tudo roda no celular: quadros → marcador em cada um → pose da câmera em cm → **casco visual**
  (o que não é mesa em todas as vistas) + **consistência de cor multivista** com visibilidade (superfícies lisas, onde
  a cor não decide a altura, são preenchidas a partir das bordas bem medidas) → mapa de altura em escala
  real + **volume 3D completo** (casco visual em voxels, limitado pelo topo) → malha fechada por *surface nets*
  (pega partes suspensas: cupcake transbordando da forminha, taça, pão em pé) → textura em atlas pintada com os quadros
  que enxergam cada ponto → GLB + USDZ.
  **Qualquer produto**: pratos, sobremesas (fatia de bolo, taça, pote), bebidas, porções, pizzas. O produto é reconhecido de graça pelo nome, pela descrição do cardápio e pelo que o dono escreve
  e pela IA de visão gratuita do próprio site (ver abaixo; opcional: com `SCAN_IA_PAGA=1`, a IA da Anthropic também
  olha o recorte do prato e dá a palavra final) e vira a ficha do produto (tipo, recipiente, vidro,
  topo reto ou arredondado, tamanho típico). A ficha ajusta a reconstrução (altura máxima, área, simetria de itens
  redondos, topo nivelado de bolos e copos) e confere as medidas, avisando o dono quando algo parece errado. Sem a
  chave, a ficha sai só pelo nome. O dono pode corrigir largura/altura com a régua antes de salvar (ex.: borda de copo
  de vidro, que a câmera às vezes não enxerga). Nos testes sintéticos: altura com erro < 0,5 cm,
  largura/profundidade em ±2 cm, forma da comida com erro médio de 0,1–0,7 cm; 7–17 s num computador.
  Modo manual (2 fotos, marcador ou cartão de banco, contorno e altura marcados com o dedo) continua disponível.
  Opcional: versão detalhada por IA, forçada às mesmas medidas.
- **Prato em 3D (outras formas)**: gerar com IA a partir de 1 a 4 fotos (Meshy) **ou** enviar um scan `.glb` (Polycam, Scaniverse, KIRI).
  O servidor prepara o modelo (Draco/Meshopt/WebP aceitos, limpeza, até 120 mil triângulos, texturas até 2048 px, base na mesa,
  **escala real pela largura informada**). O navegador do dono gera o USDZ do iPhone. Revisão das medidas, ajuste e publicação,
  com QR para testar no celular.
- Resultados: receita vendida pela IA, ticket com e sem IA, visualizações na mesa e conversão de quem viu vs. quem não viu.

## Stack

Next.js 16 + React 19 + Tailwind 4 · Postgres (Neon; PGlite local) · Vercel Blob (pasta local em dev) ·
Claude (`@anthropic-ai/sdk`) · Meshy Multi-Image to 3D · `@google/model-viewer` · glTF-Transform + sharp + meshoptimizer + draco · three.js (USDZExporter)

## Rodar localmente

```bash
npm install
npm run dev
# demonstração: http://localhost:3000/api/setup-demo?chave=dev
```

## Estrutura

```
src/components/DishViewer.tsx   visualizador 3D + "ver na mesa" (model-viewer)
src/lib/model3d.ts              preparo do GLB (escala real, base na mesa, otimização)
src/lib/modelPipeline.ts        geração por IA → preparo → armazenamento
src/lib/meshy.ts                cliente da API Meshy
src/lib/storage.ts              Vercel Blob / pasta local
src/lib/ai.ts                   garçom, leitura de cardápio por foto, resumo de perguntas
src/app/painel/cardapio/ModelStudio.tsx   tela do dono para criar/revisar o 3D
src/app/escanear/[token]/ScanApp.tsx      escâner no celular (início, conferência, salvar, modo manual)
src/app/escanear/[token]/LiveCapture.tsx  câmera guiada ao vivo (anel de progresso, dicas, termina sozinha)
src/lib/scan/geometry.ts        homografia, foco, pose da câmera, medida de altura
src/lib/scan/video.ts           quadros (ao vivo, vídeo ou fotos) → marcador → 3D (orquestra tudo)
src/lib/scan/live.ts            lógica da captura guiada: ângulo de cada quadro, cobertura, dicas
src/lib/scan/sheetscale.ts      confere a escala da impressão pela folha A4
src/lib/clip.ts                 IA de visão (OpenCLIP em ONNX/WebAssembly): imagem → vetor → prato/parte
src/lib/reconhecer.ts           junta imagem + nome do item e decide o prato e as partes
src/lib/pesquisa.ts             pesquisa o nome digitado (lista própria + Wikipédia)
src/lib/scan/pratos.ts          ~90 pratos e ~26 partes: descrições, apelidos, formato
src/lib/scan/understand.ts      recortes para a IA, separação por cor, feijão em monte, medidas do morango
src/lib/scan/garnish.ts         morango redesenhado (forma, sementes, folhinhas)
modelos/clip/                   modelo da IA (partes de 23 MB) + vetores dos pratos (rotulos.json)
tools/clip/                     scripts para gerar o rotulos.json e testar o reconhecimento em fotos
src/lib/scan/lowpoly.ts         estilo polígonos: anéis de faces planas, cor por face, paleta curta
src/lib/scan/plate.ts           louça limpa: acha o prato redondo e o desenha liso e brilhante; a comida vai por cima
src/lib/scan/profile.ts         ficha do produto (tipos, regras pelo nome, parâmetros, conferência das medidas)
src/app/api/scan/[token]/reconhecer    IA de visão (grátis) + IA paga opcional (SCAN_IA_PAGA=1); "aquecer" carrega o modelo
src/app/api/scan/[token]/pesquisar     pesquisa o nome digitado pelo dono (lista própria + Wikipédia)
src/lib/scan/recon.ts           reconstrução: casco visual + cores multivista → mapa de altura
src/lib/scan/volume.ts          volume 3D → malha fechada (surface nets) + atlas de textura
src/lib/scan/heightmesh.ts      exportação GLB (e a malha antiga, só de relevo)
src/lib/scan/builder.ts         modo manual: monta o 3D de 2 fotos e projeta as fotos
src/lib/scan/marker.ts          marcador ArUco (geração e detecção)
tools/scantest/accuracy.mts     teste de precisão do modo manual (fotos sintéticas)
tools/scantest/recon-test.mts   teste de precisão do escâner (quadros sintéticos)
tools/scantest/live-test.mts    teste da captura guiada (uma volta sintética, quadro a quadro)
tools/scantest/scale-test.mts   teste da conferência de escala pela folha A4
public/demo/                    pratos 3D de demonstração (GLB + USDZ + foto)
tools/build-demo-models.mjs     gera os pratos de demonstração por código
```

## Próximos passos sugeridos

0. Recuperação de senha por e-mail (hoje não existe: precisa de um serviço de e-mail, ex.: Resend)
1. Cobrança da mensalidade (Asaas ou Mercado Pago, com Pix e boleto), bloqueio ao fim do teste e limites por plano (conversas, pratos 3D)
2. Painel "super admin" (todos os restaurantes, uso, faturamento)
3. Garçom no WhatsApp
4. Pagamento online no pedido (Pix)
5. Integração com iFood e sistemas de caixa (PDV)
