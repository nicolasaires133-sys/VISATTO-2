# Como colocar o Visatto no ar (sem programar)

Tempo estimado: 40 minutos. Você vai usar 5 serviços. Todos têm plano grátis para começar, menos as duas IAs, que cobram por uso.

| Serviço | Para quê | Obrigatório? |
|---|---|---|
| GitHub | guardar o código | sim |
| Vercel | hospedar o site + banco (Neon) + arquivos (Blob) | sim |
| Anthropic | o garçom de IA e o reconhecimento do produto no escâner | sim (sem ela o garçom fica em "modo demonstração" e o escâner reconhece o produto só pelo nome) |
| Meshy | opção extra paga “IA por fotos” | **não precisa** (o escâner do Visatto é grátis) |

---

## 1. GitHub: guardar o código

O site do GitHub tem dois limites: **100 arquivos por envio** e **25 MB por arquivo**. Por isso o código vem dividido
em **três partes**, cada uma dentro desses limites. Faça no computador (pelo celular o GitHub não deixa arrastar
pastas), de preferência no Chrome ou no Edge.

1. Crie uma conta em **github.com**.
2. Clique em **New repository**, dê o nome `visatto`, deixe **Private** e clique em **Create repository**.
3. Descompacte os três arquivos: `visatto-github-parte-1.zip`, `visatto-github-parte-2.zip` e
   `visatto-github-parte-3-ia.zip` (no Windows: botão direito → **Extrair tudo**). Cada um vira uma pasta. Abrindo
   cada pasta, você deve ver exatamente isto:
   - parte 1: só a pasta `src`
   - parte 2: as pastas `public`, `src` e `tools` e vários arquivos (`package.json`, `README.md`...)
   - parte 3: só a pasta `modelos`
4. **Parte 1:** na página do repositório vazio, clique em **uploading an existing file**. Abra a pasta da parte 1,
   selecione **tudo o que está dentro dela** (Ctrl+A, ou Cmd+A no Mac; é só a pasta `src`) e arraste para a página do
   GitHub. Espere a lista terminar de carregar e clique em **Commit changes**.
5. **Parte 2:** de volta na página do repositório, clique em **Add file → Upload files**. Abra a pasta da parte 2,
   selecione tudo o que está dentro, arraste e clique em **Commit changes**.
6. **Parte 3 (a IA que reconhece os pratos):** de novo **Add file → Upload files**, com o que está dentro da pasta
   da parte 3 (a pasta `modelos`). São 5 arquivos grandes (cerca de 90 MB no total): espere a barra de cada um chegar
   ao fim antes de clicar em **Commit changes**. Pode levar alguns minutos.
7. Confira: na página do repositório têm que aparecer, **logo na primeira tela**, as pastas `modelos`, `public`,
   `src` e `tools` e o arquivo `package.json`. Clique em `src`: dentro têm que estar `app`, `components` e `lib`.
   Se aparecer uma pasta chamada `visatto-github-parte-...`, algo foi arrastado no nível errado (veja "Problemas
   comuns" no fim deste guia).

Importante: arraste **o que está dentro** de cada pasta, não a pasta em si. A pasta `src` aparece nas partes 1 e 2 de
propósito: o GitHub junta sozinho.

Se pular a parte 3, o site funciona do mesmo jeito, só que o escâner não reconhece o prato pela imagem (usa só o
nome do item no cardápio e o que o dono digitar).

**Para atualizar depois** (quando eu mandar uma versão nova): repita os passos 4 a 6 no mesmo repositório, sempre
por **Add file → Upload files**. Os arquivos novos substituem os antigos e a Vercel publica a versão nova sozinha.
A parte 3 só precisa ser enviada de novo quando eu avisar que a IA mudou.

> Alternativa sem arrastar nada: conecte o seu GitHub nas configurações do Claude e me peça. Aí eu mesmo envio o código
> para o seu repositório a cada versão.

## 2. Chaves das IAs

**Anthropic (garçom de IA): PULE no lançamento.** Sem essa chave o site funciona completo (cardápio, 3D na mesa, escâner, pedidos) e o garçom simplesmente não aparece. Quando quiser ligar o garçom: crie conta em **console.anthropic.com**, adicione crédito em **Billing** (US$ 5 já dão para começar), vá em **API Keys** → **Create Key** e copie a chave (`sk-ant-...`).

**Meshy: NÃO precisa.** O escâner do Visatto é grátis e não usa a Meshy. Só configure se um dia quiser a opção extra “IA por fotos” (paga). Sem a chave, essa opção nem aparece no painel. Se quiser mesmo: crie conta em **meshy.ai**. O acesso à API exige um plano pago (Pro ou superior). Depois vá em **API** → **Create API Key** e copie a chave (`msy_...`). Cada prato gerado consome cerca de 30 créditos.

## 3. Vercel: hospedar o site

1. Crie uma conta em **vercel.com** com **Continue with GitHub**.
2. **Add New… → Project**, escolha o repositório `visatto` e clique em **Import**.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | deixe sem no lançamento (só quando for ligar o garçom) |
   | `MESHY_API_KEY` | deixe sem (só se quiser a opção paga “IA por fotos”) |
   | `AUTH_SECRET` | opcional: se não criar, o site gera uma chave forte sozinho e guarda no banco |
   | `SETUP_KEY` | opcional: só para criar a demonstração com a senha de teste (passo 5) |

4. Clique em **Deploy**. O primeiro deploy vai dar erro de banco de dados. É normal: os próximos passos resolvem.

## 4. Banco de dados e arquivos (dentro da própria Vercel)

No projeto da Vercel, abra a aba **Storage**:

1. **Create Database → Neon (Postgres)** → região **São Paulo (sa-east-1)** se aparecer → plano **Free** → **Connect**. A variável `DATABASE_URL` é criada sozinha.
2. **Create → Blob** → dê o nome `visatto-arquivos` → **Connect**. A variável `BLOB_READ_WRITE_TOKEN` é criada sozinha. É onde ficam as fotos e os modelos 3D.
3. Vá em **Deployments** → três pontinhos no último deploy → **Redeploy**.

O site está no ar no endereço que a Vercel mostrar (ex.: `visatto.vercel.app`). As tabelas do banco são criadas na primeira visita.

## 5. Demonstração (Cantina da Nonna)

O cardápio de exemplo se cria sozinho na primeira vez que alguém abre `/r/cantina-da-nonna` (o botão "Ver um cardápio de exemplo" da página inicial). Nesse caso o painel dele fica com uma senha aleatória, para ninguém mexer.

Se você quiser entrar no painel da demonstração com a senha de teste, crie antes a variável `SETUP_KEY` e abra no navegador, trocando pelo seu endereço e pela sua `SETUP_KEY`:

```
https://SEU-ENDERECO.vercel.app/api/setup-demo?chave=SUA_SETUP_KEY
```

- Cardápio: `/r/cantina-da-nonna?mesa=7` (pizza, lasanha e tiramisù com "Ver na mesa")
- Painel: `/entrar` com `demo@cantinadanonna.com.br` / `demo1234`

## 6. Teste no celular ANTES de vender (obrigatório)

A realidade aumentada só funciona em celular de verdade, então este teste só pode ser feito depois do deploy. Faça com pelo menos um iPhone e um Android:

- [ ] **iPhone (Safari):** abra o cardápio de exemplo → Pizza Calabresa → "Ver na minha mesa" → "Abrir câmera". Deve abrir a câmera da Apple com a pizza em cima da mesa. Meça com uma régua: a tábua tem que ter 40 cm.
- [ ] **iPhone:** tente "aumentar" a pizza com dois dedos. Ela **não pode** mudar de tamanho.
- [ ] **Android (Chrome):** mesmo teste. Abre dentro do navegador ou no app do Google. Deve aparecer na mesa com 40 cm.
- [ ] **Instagram:** abra o link do cardápio pelo Instagram. Deve aparecer o aviso para abrir no navegador. Abra e repita o teste.
- [ ] **Escâner (o teste mais importante):** imprima o marcador em `/marcador`. No painel, abra um prato → "Ver na mesa (3D)" → "Escanear com o celular" e leia o QR. Coloque a folha ao lado de um prato de verdade, toque em **Começar**, permita a câmera e dê uma volta devagar até o anel fechar. O 3D sai sozinho. Confira com uma régua se a largura e a altura mostradas batem com o prato (diferença de até 1 cm é esperada).
- [ ] **Sobremesas e bebidas:** escaneie também uma fatia de bolo, uma sobremesa em taça ou copo e uma bebida. Se quiser ajudar a medição, escreva o que é o produto em "Ajustes e outros jeitos de escanear". Confira as medidas com a régua. Em copos de vidro transparente a borda costuma sair mais baixa: corrija a altura na tela de conferência.
- [ ] **Reconhecimento do prato:** depois de escanear, a tela de conferência mostra "A IA reconheceu: ...". Confira se
  acertou. Se não, toque em "Não é isso?", escolha uma das opções ou digite o nome do prato: o Visatto pesquisa o que
  ele é e oferece "Refazer o 3D com isso", sem precisar escanear de novo. A primeira vez depois de publicar pode
  demorar uns segundos a mais (a IA está "acordando" no servidor).
- [ ] **Teste em iPhone e Android:** faça a volta nos dois. Se a câmera não abrir dentro do site (acontece em navegadores de dentro do Instagram/WhatsApp), o Visatto oferece "Gravar um vídeo" no lugar. Em "Ajustes e outros jeitos de escanear" também dá para usar um vídeo já gravado ou 10 a 30 fotos.
- [ ] **Escâner sem impressora:** em "Ajustes e outros jeitos de escanear", use o "Modo manual com 2 fotos" com um cartão de banco como referência.
- [ ] **Painel no computador:** confira o tamanho, clique em "mostrar para os clientes" e escaneie o QR "Teste no seu celular".
- [ ] **Pedido completo:** no painel, toque em "Ligar som de aviso". Faça um pedido pelo celular (QR de uma mesa) e veja-o chegar com o som. Aceite, marque como pronto e entregue: a tela do cliente acompanha sozinha.
- [ ] **Chamar atendente:** no cardápio aberto pelo QR de uma mesa, toque no sino e peça a conta. O chamado aparece no topo do painel.
- [ ] **Entrega com Pix:** em Configurações, preencha a chave Pix. Faça um pedido de entrega escolhendo Pix e confira se a chave aparece para o cliente.
- [ ] **Comanda:** no pedido, toque no ícone da impressora e confira como a comanda sai na sua impressora (o formato é o de bobina térmica de 80 mm; ainda não foi testado numa impressora real).
- [ ] **Pausar pedidos:** toque em "Pausar pedidos" e confira no celular que o cardápio continua abrindo, mas sem o botão de pedir.

Se algo falhar, me mande o modelo do celular e um print, que eu corrijo.

## 7. Painel como app no celular (grátis, sem loja)

No celular do dono, abra o painel (`/painel`). Aparece o cartão **“Visatto no seu celular”**:
- **Android:** toque em **Instalar o app**.
- **iPhone:** abra no **Safari** → **Compartilhar** → **Adicionar à Tela de Início**.

Fica um ícone do Visatto na tela inicial e o painel abre em tela cheia, como app.

## 8. Domínio próprio (opcional)

Registre o domínio (ex.: `visatto.com.br` no registro.br) e, na Vercel, vá em **Settings → Domains → Add**.

---

## Custos para começar

**O escâner é grátis.** Todo o trabalho pesado (achar a folha, medir, montar o 3D, pintar) roda no celular do dono
do restaurante. O servidor só guarda o arquivo pronto. O escâner **não chama nenhuma IA paga**: o produto é
reconhecido pelo nome, pela descrição do cardápio e pelo que o dono escreve no campo “O que é este produto?”.

| Serviço | Para quê | Custo |
|---|---|---|
| Vercel (Hobby) | o site | grátis. No plano grátis a Vercel **nunca cobra**: se passar do limite, ela pausa até o mês seguinte. Atenção: o plano grátis é para uso não comercial; quando começar a cobrar dos restaurantes, a Vercel pede o Pro (US$ 20/mês) |
| Neon (grátis) | banco de dados | grátis até 0,5 GB (dá para milhares de pedidos e pratos) e 100 horas de processamento por mês. O painel aberto consulta os pedidos o tempo todo: isso dá para cerca de 13 horas de painel aberto por dia. Passando disso, o Neon pausa até o mês seguinte ou pede o plano pago |
| Vercel Blob (grátis) | arquivos 3D | grátis até 1 GB guardado e 10 GB baixados por mês. Cada prato escaneado ocupa uns 1,5 a 3 MB → cabem centenas de pratos. Cada vez que um cliente abre o 3D baixa ~0,3 MB (Android) ou ~2 MB (iPhone, na mesa) |
| Anthropic | **só o garçom de IA** | por uso: frações de centavo por mensagem. Sem chave, o garçom fica em modo demonstração |
| Meshy | opcional, “IA por fotos” | não precisa |

**IA no escâner:** o reconhecimento do prato pela imagem já vem de graça, rodando no próprio site (parte 3 do
GitHub). Se um dia quiser uma segunda opinião paga, mais precisa, coloque `SCAN_IA_PAGA=1` nas variáveis da Vercel
(usa a mesma chave da Anthropic, uma consulta pequena por escaneamento). Sem isso, o escâner continua 100% grátis.

## Problemas comuns

**A Vercel diz "Couldn't find any `pages` or `app` directory".** A pasta `src/app` (parte 1) não está no lugar certo
no GitHub. Abra o repositório e confira:
1. Se na primeira tela existe uma pasta `visatto-github-parte-1` (ou `-2`, `-3-ia`): entre nela, clique nos **três
   pontinhos (...)** no canto superior direito, escolha **Delete directory** e confirme com **Commit changes**.
2. Clique em **Add file → Upload files** e arraste de novo **o que está dentro** da pasta da parte 1 (a pasta `src`).
   Faça o mesmo com as outras partes que estavam no lugar errado.
3. A Vercel publica de novo sozinha a cada envio. Se não publicar, em **Deployments** clique nos três pontinhos da
   última publicação e escolha **Redeploy**.

- **"Banco de dados não configurado"**: falta o Neon (passo 4.1) ou o Redeploy.
- **"Armazenamento não configurado"**: falta o Blob (passo 4.2) ou o Redeploy.
- **"Configure a variável AUTH_SECRET"**: falta a variável do passo 3. Adicione e faça Redeploy.
- **O garçom não aparece no cardápio**: é o esperado sem a `ANTHROPIC_API_KEY`. Coloque a chave e faça Redeploy para ligar.
- **"Sem créditos na Meshy"**: recarregue a conta da Meshy.
- **O 3D ficou do tamanho errado**: no painel, abra o prato → "Ver na mesa (3D)" → "Ajustar" com a largura medida na régua.
