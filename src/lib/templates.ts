// Modelos prontos em 3D: em vez de escanear, o dono escolhe o modelo e informa a medida da embalagem.
// Os arquivos base ficam em /public/templates, já em tamanho real; aqui só se calcula a escala.

export type TemplateKind = "pizza-caixa" | "acai" | "marmita";

export const TEMPLATES: Record<TemplateKind, { label: string; desc: string; file: string; image: string }> = {
  "pizza-caixa": { label: "Pizza na caixa", desc: "Informe a medida da caixa. A pizza aparece dentro dela, no tamanho certo.", file: "/templates/pizza-caixa.glb", image: "/templates/pizza-caixa.jpg" },
  acai: { label: "Açaí no copo", desc: "Escolha o tamanho do copo. O açaí enche o copo numa animação.", file: "/templates/acai.glb", image: "/templates/acai.jpg" },
  marmita: { label: "Marmita", desc: "Informe a medida da embalagem. A marmita sai com arroz, feijão, carne e salada.", file: "/templates/marmita.glb", image: "/templates/marmita.jpg" },
};

// medidas do modelo base (cm)
const PIZZA_BOX = 40; // caixa quadrada 40 × 40
const ACAI_ML = 500;
const MARMITA = { w: 21.6, d: 15.6, h: 5.4 }; // medida por fora do modelo base (com a aba)

export const ACAI_SIZES = [300, 400, 500, 700];

const num = (v: unknown) => Number(String(v ?? "").replace(",", "."));

/** Confere as medidas e devolve a escala de cada eixo e um resumo para mostrar ao dono. */
export function templateScale(kind: string, input: Record<string, unknown>): { ok: true; scale: [number, number, number]; summary: string } | { ok: false; error: string } {
  if (kind === "pizza-caixa") {
    const w = num(input.w), d = input.d ? num(input.d) : w;
    if (!(w >= 20 && w <= 60) || !(d >= 20 && d <= 60)) return { ok: false, error: "Informe a medida da caixa entre 20 e 60 cm." };
    const sx = w / PIZZA_BOX, sz = d / PIZZA_BOX;
    return { ok: true, scale: [sx, (sx + sz) / 2, sz], summary: w === d ? `Caixa de ${fmt(w)} × ${fmt(w)} cm` : `Caixa de ${fmt(w)} × ${fmt(d)} cm` };
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
