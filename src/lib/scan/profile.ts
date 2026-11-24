// "Ficha" do produto escaneado: o que é, em que recipiente vem e o tamanho esperado.
// Vem da IA (foto + nome dado pelo dono) ou, sem IA, só do nome. Serve para:
// - ajustar a reconstrução (altura máxima procurada, tamanho da área, simetria de itens redondos);
// - conferir se as medidas fazem sentido e avisar o dono antes de publicar.

export const KINDS = {
  prato_raso: { label: "prato", zMax: 16, half: 26 },
  prato_alto: { label: "lanche ou prato alto", zMax: 26, half: 24 },
  fatia: { label: "fatia de bolo ou torta", zMax: 18, half: 22 },
  bolo: { label: "bolo ou torta inteira", zMax: 26, half: 26 },
  tigela: { label: "prato em tigela ou cumbuca", zMax: 20, half: 24 },
  taca_copo: { label: "sobremesa em taça ou copo", zMax: 30, half: 20 },
  bebida: { label: "bebida", zMax: 36, half: 20 },
  sorvete: { label: "sorvete", zMax: 26, half: 20 },
  pizza_tabua: { label: "pizza ou tábua", zMax: 12, half: 34 },
  porcao: { label: "porção", zMax: 20, half: 26 },
  outro: { label: "produto", zMax: 30, half: 28 },
} as const;

export type Kind = keyof typeof KINDS;

export type ProductProfile = {
  produto: string; // ex.: "Petit gâteau com sorvete de creme"
  kind: Kind;
  formato: "redondo" | "retangular" | "irregular";
  topo: "reto" | "arredondado" | "irregular"; // reto: bolo, copo, pizza; arredondado: pão de hambúrguer, bola de sorvete
  recipiente: string; // ex.: "prato raso branco", "taça de vidro"
  transparente: boolean; // recipiente de vidro/acrílico
  altura_cm: [number, number]; // faixa típica para este produto (com o recipiente)
  largura_cm: [number, number];
  dica?: string; // conselho de gravação específico
  /** de onde veio: IA paga (foto + nome), só o nome, a IA de imagem do próprio site, ou a pesquisa do nome digitado */
  fonte: "ia" | "nome" | "foto" | "pesquisa";
  /** prato reconhecido (id da lista em pratos.ts) */
  id?: string;
  /** partes típicas do prato (ids de PARTS em pratos.ts) */
  partes?: string[];
  /** certeza do reconhecimento (0 a 1) */
  confianca?: number;
};

// faixas típicas (com o recipiente), usadas quando a IA não está disponível
export const RANGES: Record<Kind, { h: [number, number]; w: [number, number] }> = {
  prato_raso: { h: [2, 9], w: [18, 34] },
  prato_alto: { h: [6, 18], w: [10, 30] },
  fatia: { h: [5, 13], w: [8, 22] },
  bolo: { h: [7, 22], w: [15, 35] },
  tigela: { h: [5, 14], w: [12, 28] },
  taca_copo: { h: [7, 22], w: [6, 14] },
  bebida: { h: [8, 32], w: [5, 14] },
  sorvete: { h: [6, 20], w: [6, 18] },
  pizza_tabua: { h: [1, 7], w: [22, 50] },
  porcao: { h: [3, 12], w: [12, 32] },
  outro: { h: [1, 30], w: [4, 50] },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// palavras-chave → tipo (a ordem importa: o primeiro que bater vence)
const RULES: [Kind, RegExp][] = [
  ["bebida", /\b(suco|refri|refrigerante|coca|guarana|cerveja|chopp?|vinho|drinks?|caipirinha|caipiroska|coquetel|gin|tonica|agua|cha gelado|limonada|soda|energetico|whisky|dose|cafe gelado|frappe|smoothie|vitamina)\b/],
  ["sorvete", /\b(sorvete|gelato|picole|casquinha|sundae|banana split)\b/],
  ["taca_copo", /\b(taca|copo|pote|verrine|mousse|pave|tiramisu|milk ?shake|frozen|parfait|banoffee no pote|sobremesa no pote|acai no copo|pudim no pote)\b/],
  ["fatia", /\b(fatia|pedaco|slice)\b/],
  ["bolo", /\b(bolo|torta|cheesecake|naked cake|pudim|quiche)\b/],
  ["pizza_tabua", /\b(pizza|tabua|frios|esfiha aberta|focaccia)\b/],
  ["prato_alto", /\b(hamburguer|burger|x-?\w+|sanduiche|lanche|wrap|kebab|cachorro[- ]quente|hot ?dog|beirute|torre|cupcake|muffin|donut|sonho|croissant)\b/],
  ["tigela", /\b(acai|tigela|bowl|poke|cumbuca|sopa|caldo|salada|ramen|lamen|moqueca|feijoada|bobo|yakisoba|risoto)\b/],
  ["porcao", /\b(porcao|fritas|batata frita|petisco|isca|calabresa acebolada|bolinho|pastel|coxinha|nuggets|onion rings|aneis|camarao empanado|tabua de petiscos)\b/],
  ["prato_raso", /\b(file|picanha|frango|peixe|salmao|bife|parmegiana|macarrao|espaguete|penne|nhoque|lasanha|strogonoff|prato|executivo|omelete|panqueca|crepe|tapioca|brownie|petit gateau|waffle|churros|bruschetta|burrata|carpaccio|panna cotta|flan|creme brulee|petit gateau)\b/],
];

/** Sem IA: deduz o tipo pelo nome (e pela observação do dono). */
export function profileFromName(name: string, note = ""): ProductProfile {
  const text = norm(`${note} ${name}`);
  let kind: Kind = "outro";
  for (const [k, re] of RULES)
    if (re.test(text)) {
      kind = k;
      break;
    }
  const round = !/\b(retangular|quadrad|travessa|tabua|fatia|wrap|sanduiche|lasanha|brownie)\b/.test(text);
  const glass = /\b(taca|copo|vidro|pote de vidro|drink|caipirinha|vinho|chopp?|cerveja|suco|agua)\b/.test(text);
  const flat: Kind[] = ["fatia", "bolo", "taca_copo", "bebida", "pizza_tabua"];
  const dome: Kind[] = ["prato_alto", "sorvete"];
  return {
    produto: (note || name).trim() || "Produto",
    kind,
    formato: kind === "fatia" ? "irregular" : round ? "redondo" : "retangular",
    topo: flat.includes(kind) ? "reto" : dome.includes(kind) ? "arredondado" : "irregular",
    recipiente: "",
    transparente: glass,
    altura_cm: RANGES[kind].h,
    largura_cm: RANGES[kind].w,
    fonte: "nome",
  };
}

/** Garante uma ficha válida a partir do que a IA respondeu. */
export function sanitizeProfile(raw: any, fallback: ProductProfile): ProductProfile {
  const kind: Kind = raw && raw.kind in KINDS ? raw.kind : fallback.kind;
  const range = (v: any, d: [number, number]): [number, number] => {
    const a = Number(v?.[0]), b = Number(v?.[1]);
    return isFinite(a) && isFinite(b) && a > 0 && b >= a && b < 120 ? [a, b] : d;
  };
  return {
    produto: String(raw?.produto || fallback.produto).slice(0, 80),
    kind,
    formato: ["redondo", "retangular", "irregular"].includes(raw?.formato) ? raw.formato : fallback.formato,
    topo: ["reto", "arredondado", "irregular"].includes(raw?.topo) ? raw.topo : fallback.topo,
    recipiente: String(raw?.recipiente || "").slice(0, 60),
    transparente: Boolean(raw?.transparente),
    altura_cm: range(raw?.altura_cm, RANGES[kind].h),
    largura_cm: range(raw?.largura_cm, RANGES[kind].w),
    dica: raw?.dica ? String(raw.dica).slice(0, 200) : undefined,
    fonte: "ia",
  };
}

/** Parâmetros da reconstrução para este tipo de produto. */
export function reconParams(p: ProductProfile) {
  const k = KINDS[p.kind];
  // a altura máxima procurada nunca fica abaixo do que a ficha diz ser possível (+ folga)
  const zMax = Math.min(40, Math.max(k.zMax, p.altura_cm[1] * 1.4 + 2));
  const half = Math.min(36, Math.max(k.half, p.largura_cm[1] * 0.5 + 10));
  // simetria em volta do centro só vale para o que é redondo por inteiro (bolo, pizza, copo). Num prato com várias
  // coisas (arroz de um lado, feijão do outro, batata ao lado do lanche), "achataria" o que não está no meio.
  const roundKinds: Kind[] = ["bolo", "pizza_tabua", "taca_copo", "bebida", "sorvete"];
  return { zMax, half, round: p.formato === "redondo" && roundKinds.includes(p.kind), flatTop: p.topo === "reto" };
}

/** Confere as medidas com o esperado para o produto. Devolve avisos em português simples. */
export function checkDims(p: ProductProfile, dims: { w: number; d: number; h: number }): string[] {
  const out: string[] = [];
  const nome = p.produto || KINDS[p.kind].label;
  const fmt = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
  const [hMin, hMax] = p.altura_cm, [wMin, wMax] = p.largura_cm;
  if (dims.h < hMin * 0.7)
    out.push(`A altura ficou ${fmt(dims.h)} cm, mas ${nome} costuma ter de ${fmt(hMin)} a ${fmt(hMax)} cm. Escaneie de novo passando o celular mais de lado.`);
  else if (dims.h > hMax * 1.35)
    out.push(`A altura ficou ${fmt(dims.h)} cm, mais do que o normal para ${nome} (${fmt(hMin)}–${fmt(hMax)} cm). Confira se nada além do produto apareceu ao lado dele.`);
  if (dims.w > wMax * 1.35)
    out.push(`A largura ficou ${fmt(dims.w)} cm, mais do que o normal para ${nome} (${fmt(wMin)}–${fmt(wMax)} cm). Afaste talheres, copos e guardanapos e escaneie de novo.`);
  else if (dims.w < wMin * 0.65)
    out.push(`A largura ficou ${fmt(dims.w)} cm, menos do que o normal para ${nome} (${fmt(wMin)}–${fmt(wMax)} cm). Confira se o produto inteiro apareceu no vídeo.`);
  return out;
}

/** Ficha a partir de um prato conhecido (lista em pratos.ts). */
export function profileFromDish(
  d: { id: string; nome: string; kind: Kind; formato?: ProductProfile["formato"]; topo?: ProductProfile["topo"]; partes?: string[]; recipiente?: string; transparente?: boolean },
  fonte: ProductProfile["fonte"],
  confianca?: number,
): ProductProfile {
  const flat: Kind[] = ["fatia", "bolo", "taca_copo", "bebida", "pizza_tabua"];
  const dome: Kind[] = ["prato_alto", "sorvete"];
  return {
    produto: d.nome,
    kind: d.kind,
    formato: d.formato ?? (d.kind === "fatia" ? "irregular" : "redondo"),
    topo: d.topo ?? (flat.includes(d.kind) ? "reto" : dome.includes(d.kind) ? "arredondado" : "irregular"),
    recipiente: d.recipiente ?? "",
    transparente: d.transparente ?? false,
    altura_cm: RANGES[d.kind].h,
    largura_cm: RANGES[d.kind].w,
    fonte,
    id: d.id,
    partes: d.partes ?? [],
    confianca,
  };
}
