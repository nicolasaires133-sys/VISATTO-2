// Passo a passo de cada tarefa do painel. É o mesmo texto da tela "Ajuda" e do botão "Como usar" de cada tela,
// para quem está aprendendo (e para quem está ensinando) seguir sempre o mesmo caminho.

export type Guia = {
  id: string;
  titulo: string;
  resumo: string;
  passos: string[];
  /** onde fazer */
  href: string;
  acao: string;
  /** em que tela o guia aparece no botão "Como usar" */
  tela: "pedidos" | "cardapio" | "qrcodes" | "resultados" | "config";
  minutos: number;
};

export const GUIAS: Guia[] = [
  {
    id: "receber-pedido",
    titulo: "Receber e entregar um pedido",
    resumo: "O pedido chega sozinho, com o número da mesa. Você só vai tocando no botão de cada etapa.",
    passos: [
      "Deixe a tela Pedidos aberta no computador ou no celular do caixa e toque em Ligar som de aviso.",
      "Quando chegar um pedido, ele aparece em Novos com borda colorida. Toque em Aceitar: o cliente vê \"Estamos preparando\".",
      "Quando a cozinha terminar, toque em Está pronto (ou Saiu para entrega).",
      "Ao servir, toque em Entregue na mesa. O pedido vai para Finalizados e conta selo no cartão fidelidade.",
      "Precisa da comanda em papel? Toque no ícone da impressora no pedido.",
    ],
    href: "/painel",
    acao: "Abrir Pedidos",
    tela: "pedidos",
    minutos: 1,
  },
  {
    id: "modo-cozinha",
    titulo: "Usar uma tela só para a cozinha",
    resumo: "Um tablet ou TV na cozinha mostra os pedidos em letra grande, com um relógio que fica vermelho quando atrasa.",
    passos: [
      "No tablet da cozinha, entre no painel e abra a tela Pedidos.",
      "Toque em Modo cozinha. A tela fica cheia e não apaga sozinha.",
      "Pedido novo chega com som e a faixa NOVO. Toque em Começar a preparar.",
      "Terminou? Toque em Pronto. O garçom vê no painel que pode levar.",
      "O relógio de cada pedido fica amarelo com 15 minutos e vermelho com 25. Para sair, toque em Sair.",
    ],
    href: "/painel",
    acao: "Abrir Pedidos",
    tela: "pedidos",
    minutos: 1,
  },
  {
    id: "opcoes-promocao",
    titulo: "Pôr tamanhos, adicionais e promoção num prato",
    resumo: "O cliente escolhe tamanho, ponto da carne ou adicionais e o preço muda sozinho. Promoção pode valer só no happy hour.",
    passos: [
      "Em Cardápio, toque no prato.",
      "Em Opções e adicionais, toque num modelo pronto (Tamanho, Ponto da carne, Adicionais) e ajuste nomes e preços. O preço é o que soma ao preço do prato.",
      "Obrigatório: o cliente precisa escolher antes de pedir. Opcional: ele escolhe se quiser.",
      "Para promoção, abra a aba Vender mais, ligue Preço promocional e coloque o preço. Se quiser, escolha os dias e o horário.",
      "Toque em Salvar alterações. A cozinha recebe o pedido já com as escolhas escritas.",
    ],
    href: "/painel/cardapio",
    acao: "Abrir Cardápio",
    tela: "cardapio",
    minutos: 2,
  },
  {
    id: "conta-mesa",
    titulo: "Receber a conta da mesa",
    resumo: "O cliente confere a conta e divide pelo celular. Você recebe um aviso de como ele vai pagar.",
    passos: [
      "Em Configurações, coloque a sua chave Pix (só uma vez). Sem chave, o cliente ainda pode chamar a maquininha.",
      "Na mesa, o cliente toca no sino e em Ver a conta. Ele escolhe pagar tudo, dividir igual ou só o que pediu.",
      "Se pagar no Pix, chega um aviso \"Pagou R$ ... no Pix\". Confira no app do seu banco.",
      "Se escolher cartão ou dinheiro, o aviso pede para levar a maquininha ou o troco.",
      "Recebeu tudo? Toque em Fechar mesa no aviso. A conta da mesa zera para os próximos clientes.",
    ],
    href: "/painel/config",
    acao: "Pôr a chave Pix",
    tela: "pedidos",
    minutos: 2,
  },
  {
    id: "novo-prato",
    titulo: "Cadastrar um prato",
    resumo: "Nome, preço, foto e categoria. O cliente vê na hora, sem precisar publicar nada.",
    passos: [
      "Em Cardápio, toque em Novo prato.",
      "Escreva o nome, o preço e uma descrição curta do que vem no prato.",
      "Toque na foto para tirar uma com o celular ou escolher da galeria.",
      "Escolha a categoria (Pizzas, Bebidas...) e salve. Já aparece no cardápio do cliente.",
      "Acabou o ingrediente? Desligue o botão Disponível: o prato some do pedido até você ligar de novo.",
    ],
    href: "/painel/cardapio",
    acao: "Abrir Cardápio",
    tela: "cardapio",
    minutos: 2,
  },
  {
    id: "prato-3d",
    titulo: "Colocar um prato em 3D",
    resumo: "Com o celular e uma folha A4 em branco. O cliente vê o prato na mesa, no tamanho real.",
    passos: [
      "Em Cardápio, toque em Pôr em 3D no prato e depois em Escanear com o celular.",
      "Leia o QR com o celular (ou toque em Abrir neste aparelho, se já estiver no celular).",
      "Ponha o prato montado na mesa e uma folha A4 em branco a um palmo dele. Em mesa branca, um pano escuro embaixo da folha.",
      "Toque em Começar e dê uma volta devagar em torno do prato. O celular tira as fotos sozinho.",
      "Confira o 3D e toque em Mostrar aos clientes. Pronto: aparece Ver na mesa no cardápio.",
    ],
    href: "/painel/cardapio",
    acao: "Escolher um prato",
    tela: "cardapio",
    minutos: 5,
  },
  {
    id: "vender-mais",
    titulo: "Fazer o cardápio vender mais",
    resumo: "Combinações, prato em destaque e horários. O cardápio sugere sozinho na hora certa.",
    passos: [
      "Abra um prato em Cardápio e vá na aba Vender mais.",
      "Em Combina com, escolha o que oferecer junto (ex.: pizza → refrigerante). O que os clientes pedem juntos entra sozinho com o tempo.",
      "Ligue Quero vender mais este prato para ele ganhar prioridade nas sugestões.",
      "Escolha os horários (Almoço, Noite...) em que ele aparece no topo do cardápio, na seção daquele horário.",
      "Toque na estrela para pôr o prato em Destaques da casa.",
    ],
    href: "/painel/cardapio",
    acao: "Abrir Cardápio",
    tela: "cardapio",
    minutos: 3,
  },
  {
    id: "qr-mesas",
    titulo: "Imprimir os QR codes das mesas",
    resumo: "Um QR por mesa. O pedido já chega com o número certo.",
    passos: [
      "Em QR codes e links, preencha quantas mesas o salão tem.",
      "Toque em Imprimir os QR codes. Sai uma folha com um QR por mesa, já com o número.",
      "Recorte e cole em cada mesa (um display de acrílico deixa mais bonito).",
      "Para delivery, toque em Copiar no link de entrega e mande no WhatsApp e no Instagram.",
    ],
    href: "/painel/qrcodes",
    acao: "Abrir QR codes",
    tela: "qrcodes",
    minutos: 3,
  },
  {
    id: "fidelidade",
    titulo: "Ligar o cartão fidelidade",
    resumo: "Um selo por pedido entregue. Ao completar, o pedido chega com o aviso do prêmio.",
    passos: [
      "Em Configurações, na parte Cartão fidelidade, ligue Dar selos a cada pedido.",
      "Escreva o prêmio (ex.: uma sobremesa da casa), quantos selos e o valor mínimo do pedido. Salve.",
      "O cliente informa o WhatsApp ao pedir e vê os selos no topo do cardápio.",
      "Quando o cartão completar, o pedido chega com \"Prêmio de fidelidade\". Entregue e toque em Entreguei.",
    ],
    href: "/painel/config",
    acao: "Ligar o cartão",
    tela: "config",
    minutos: 2,
  },
  {
    id: "resultados",
    titulo: "Entender os resultados",
    resumo: "Quanto vendeu, quanto veio das sugestões e o lucro de cada prato.",
    passos: [
      "Em Resultados, escolha o período: 7, 30 ou 90 dias.",
      "Faturamento e Ticket médio mostram quanto entrou e quanto cada pedido vale.",
      "Vendido por sugestões é o que o cliente adicionou pelo \"combina com\".",
      "Em Lucro de cada prato (depois de 10 pratos vendidos), o Visatto diz o que fazer com cada um: destacar, subir o preço ou rever.",
    ],
    href: "/painel/insights",
    acao: "Abrir Resultados",
    tela: "resultados",
    minutos: 2,
  },
  {
    id: "pausar",
    titulo: "Pausar os pedidos num dia cheio",
    resumo: "O cliente continua vendo o cardápio e o 3D, mas não envia pedido pelo celular.",
    passos: [
      "Em Pedidos, toque em Pausar pedidos.",
      "Aparece um aviso no cardápio do cliente pedindo para chamar um atendente.",
      "Quando acalmar, toque em Voltar a receber pedidos.",
    ],
    href: "/painel",
    acao: "Abrir Pedidos",
    tela: "pedidos",
    minutos: 1,
  },
];

export const TELA_TITULO: Record<Guia["tela"], string> = {
  pedidos: "Pedidos",
  cardapio: "Cardápio",
  qrcodes: "QR codes e links",
  resultados: "Resultados",
  config: "Configurações",
};
