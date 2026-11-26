// Modelos prontos em 3D: em vez de escanear, o dono escolhe o modelo e informa a medida da embalagem.
// Os arquivos base ficam em /public/templates, já em tamanho real; aqui só se calcula a escala.

export type TemplateKind = "pizza-caixa" | "hamburguer" | "acai" | "marmita";

export const TEMPLATES: Record<TemplateKind, { label: string; desc: string; file: string; image: string }> = {
  "pizza-caixa": { label: "Pizza na caixa", desc: "Escolha o sabor e informe a medida da caixa. A pizza aparece dentro dela, no tamanho certo.", file: "/templates/pizza-caixa.glb", image: "/templates/pizza-caixa.jpg" },
  hamburguer: { label: "Hambúrguer", desc: "Escolha o lanche e informe a largura do pão. O hambúrguer sai no tamanho certo.", file: "/demo/burger-x-salada.glb", image: "/demo/burger-x-salada.jpg" },
  acai: { label: "Açaí no copo", desc: "Escolha o tamanho do copo. O açaí enche o copo numa animação.", file: "/templates/acai.glb", image: "/templates/acai.jpg" },
  marmita: { label: "Marmita", desc: "Informe a medida da embalagem. A marmita sai com arroz, feijão, carne e salada.", file: "/templates/marmita.glb", image: "/templates/marmita.jpg" },
};

// sabores de pizza com modelo pronto (o arquivo de cada um fica em /templates/pizza-caixa-<id>.glb)
export const PIZZA_FLAVORS: { id: string; label: string; match: RegExp }[] = [
  { id: "calabresa", label: "Calabresa", match: /calabres/ },
  { id: "mussarela", label: "Mussarela", match: /mussarela|mucarela|muzzarela|queijo/ },
  { id: "margherita", label: "Margherita", match: /margh?erit|marguerit/ },
  { id: "frango-catupiry", label: "Frango com Catupiry", match: /frango.*(catupiry|requeij)/ },
  { id: "frango-bacon", label: "Frango com Bacon", match: /frango.*bacon/ },
  { id: "bacon-cheddar", label: "Bacon com Cheddar", match: /cheddar|bacon/ },
  { id: "portuguesa", label: "Portuguesa", match: /portugues/ },
  { id: "quatro-queijos", label: "Quatro Queijos", match: /(4|quatro) queijos/ },
  { id: "pepperoni", label: "Pepperoni", match: /pepperoni|peperoni/ },
  { id: "brigadeiro", label: "Brigadeiro (doce)", match: /brigadeiro|chocolate|doce/ },
];
// lanches com modelo pronto (/demo/burger-<id>.glb, pão de 11 cm)
export const BURGER_TYPES: { id: string; label: string; match: RegExp }[] = [
  { id: "x-burger", label: "X-Burger", match: /x.?burg|cheese.?burg|x.?queijo/ },
  { id: "x-salada", label: "X-Salada", match: /salada/ },
  { id: "x-egg", label: "X-Egg", match: /x.?egg|ovo/ },
  { id: "x-bacon", label: "X-Bacon", match: /bacon/ },
  { id: "x-tudo", label: "X-Tudo", match: /x.?tudo|completo/ },
];
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Adivinha o sabor/lanche pelo nome do prato (ex.: "Pizza Frango c/ Catupiry G" → frango-catupiry). */
export function guessVariant(kind: TemplateKind, name: string): string {
  const n = plain(name);
  if (kind === "pizza-caixa") return (PIZZA_FLAVORS.find((f) => f.id === "quatro-queijos" && f.match.test(n)) ?? PIZZA_FLAVORS.find((f) => f.match.test(n)) ?? PIZZA_FLAVORS[0]).id;
  if (kind === "hamburguer") return (BURGER_TYPES.find((b) => b.id === "x-tudo" && b.match.test(n)) ?? BURGER_TYPES.find((b) => b.match.test(n)) ?? BURGER_TYPES[1]).id;
  return "";
}
/** Arquivo base do modelo escolhido (com o sabor). */
export function templateFile(kind: TemplateKind, input: Record<string, unknown>): string {
  const v = String(input.sabor ?? "");
  if (kind === "pizza-caixa") { const f = PIZZA_FLAVORS.find((x) => x.id === v); return !f || f.id === "calabresa" ? TEMPLATES["pizza-caixa"].file : `/templates/pizza-caixa-${f.id}.glb`; }
  if (kind === "hamburguer") { const b = BURGER_TYPES.find((x) => x.id === v) ?? BURGER_TYPES[1]; return `/demo/burger-${b.id}.glb`; }
  return TEMPLATES[kind].file;
}
export function variantImage(kind: TemplateKind, id: string): string {
  if (kind === "pizza-caixa") return id === "calabresa" ? TEMPLATES["pizza-caixa"].image : `/templates/pizza-caixa-${id}.jpg`;
  if (kind === "hamburguer") return `/demo/burger-${id}.jpg`;
  return TEMPLATES[kind].image;
}

// medidas do modelo base (cm)
const PIZZA_BOX = 40; // caixa quadrada 40 × 40
const ACAI_ML = 500;
const BUN_CM = 11; // pão do modelo base
const MARMITA = { w: 21.6, d: 15.6, h: 5.4 }; // medida por fora do modelo base (com a aba)

export const ACAI_SIZES = [300, 400, 500, 700];

const num = (v: unknown) => Number(String(v ?? "").replace(",", "."));

/** Confere as medidas e devolve a escala de cada eixo e um resumo para mostrar ao dono. */
export function templateScale(kind: string, input: Record<string, unknown>): { ok: true; scale: [number, number, number]; summary: string } | { ok: false; error: string } {
  if (kind === "pizza-caixa") {
    const w = num(input.w), d = input.d ? num(input.d) : w;
    if (!(w >= 20 && w <= 60) || !(d >= 20 && d <= 60)) return { ok: false, error: "Informe a medida da caixa entre 20 e 60 cm." };
    const sx = w / PIZZA_BOX, sz = d / PIZZA_BOX;
    const f = PIZZA_FLAVORS.find((x) => x.id === input.sabor);
    return { ok: true, scale: [sx, (sx + sz) / 2, sz], summary: `${f ? `Pizza ${f.label.replace(" (doce)", "")}, caixa` : "Caixa"} de ${fmt(w)} × ${fmt(w === d ? w : d)} cm` };
  }
  if (kind === "hamburguer") {
    const w = num(input.w) || BUN_CM;
    if (!(w >= 6 && w <= 20)) return { ok: false, error: "Informe a largura do pão entre 6 e 20 cm." };
    const k = w / BUN_CM, b = BURGER_TYPES.find((x) => x.id === input.sabor) ?? BURGER_TYPES[1];
    return { ok: true, scale: [k, k, k], summary: `${b.label} com pão de ${fmt(w)} cm` };
  }
  if (kind === "acai") {
    const ml = num(input.ml);
    if (!(ml >= 150 && ml <= 1000)) return { ok: false, error: "Escolha um copo entre 150 e 1000 ml." };
    const k = Math.cbrt(ml / ACAI_ML);
    return { ok: true, scale: [k, k, k], summary: `Copo de ${Math.round(ml)} ml` };
  }
  if (kind === "marmita") {
    const w = num(input.w), d = num(input.d), h = num(input.h);
    if (!(w >= 8 && w <= 40) || !(d >= 8 && d <= 40)) return { ok: false, error: "Informe largura e comprimento da embalagem entre 8 e 40 cm." };
    if (!(h >= 2 && h <= 12)) return { ok: false, error: "Informe a altura da embalagem entre 2 e 12 cm." };
    const [a, b] = w >= d ? [w, d] : [d, w]; // a maior medida fica na largura
    return { ok: true, scale: [a / MARMITA.w, h / MARMITA.h, b / MARMITA.d], summary: `Embalagem de ${fmt(a)} × ${fmt(b)} × ${fmt(h)} cm` };
  }
  return { ok: false, error: "Modelo desconhecido." };
}
const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
