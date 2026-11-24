// Engenharia de cardápio (método de Kasavana e Smith): cada prato vira Estrela, Burro de carga,
// Quebra-cabeça ou Abacaxi, cruzando quanto vende com quanto sobra de lucro por unidade.
// A comparação é feita dentro do mesmo tipo de item (pratos com pratos, bebidas com bebidas,
// sobremesas com sobremesas): comparar a margem de um refrigerante com a de uma pizza não ajuda o dono.
import { brl } from "./format";

export type EngRow = { id: string; name: string; qty: number; price_cents: number; cost_cents: number; kind?: string };
export type EngClass = "estrela" | "burro" | "quebra" | "abacaxi";
export type EngItem = EngRow & { margin_cents: number; share: number; cls: EngClass; action: string };

function classify(group: EngRow[]): EngItem[] {
  const totalQty = group.reduce((s, r) => s + r.qty, 0);
  const popLine = (1 / group.length) * 0.7; // 70% da participação média (regra clássica)
  const avgMargin = totalQty
    ? group.reduce((s, r) => s + (r.price_cents - r.cost_cents) * r.qty, 0) / totalQty
    : group.reduce((s, r) => s + (r.price_cents - r.cost_cents), 0) / group.length;
  return group.map((r) => {
    const margin = r.price_cents - r.cost_cents;
    const share = totalQty ? r.qty / totalQty : 0;
    const popular = totalQty > 0 && share >= popLine;
    const profitable = margin >= avgMargin;
    const cls: EngClass = popular && profitable ? "estrela" : popular ? "burro" : profitable ? "quebra" : "abacaxi";
    const foodCost = Math.round((r.cost_cents / r.price_cents) * 100);
    // aumento sugerido: metade da diferença para a margem média, no máximo 10% do preço, de 50 em 50 centavos
    const raise = Math.max(50, Math.round(Math.min((avgMargin - margin) / 2, r.price_cents * 0.1) / 50) * 50);
    const action =
      cls === "estrela"
        ? "Mantenha a receita e o preço. Deixe em destaque e escaneie em 3D se ainda não tiver."
        : cls === "burro"
          ? `Vende bem, mas sobra pouco (custo de ${foodCost}% do preço). Teste subir ${brl(raise)} ou vender junto com algo de margem alta.`
          : cls === "quebra"
            ? "Dá bom lucro, mas pouca gente pede. Ligue “Quero vender mais este prato”, melhore a foto e a descrição e coloque em 3D."
            : `Vende pouco e sobra pouco (custo de ${foodCost}% do preço). Pense em mudar a receita, subir o preço ou tirar do cardápio.`;
    return { ...r, margin_cents: margin, share, cls, action };
  });
}

export function engineer(rows: EngRow[]) {
  const withCost = rows.filter((r) => r.cost_cents > 0 && r.price_cents > 0);
  const missingCost = rows.filter((r) => !(r.cost_cents > 0)).length;
  const totalQty = withCost.reduce((s, r) => s + r.qty, 0);
  if (withCost.length < 3 || totalQty < 10) return { items: [] as EngItem[], missingCost, ready: false, avgMargin: 0 };
  // pratos (principal + entrada), bebidas e sobremesas são comparados entre si
  const groupOf = (k?: string) => (k === "bebida" ? "bebida" : k === "sobremesa" ? "sobremesa" : "comida");
  const groups = new Map<string, EngRow[]>();
  for (const r of withCost) groups.set(groupOf(r.kind), [...(groups.get(groupOf(r.kind)) ?? []), r]);
  const items: EngItem[] = [];
  const leftovers: EngRow[] = [];
  for (const g of groups.values()) (g.length >= 2 ? items.push(...classify(g)) : leftovers.push(...g));
  if (leftovers.length) items.push(...classify(leftovers));
  const avgMargin = withCost.reduce((s, r) => s + (r.price_cents - r.cost_cents) * r.qty, 0) / Math.max(totalQty, 1);
  const order: EngClass[] = ["estrela", "burro", "quebra", "abacaxi"];
  items.sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || b.qty - a.qty);
  return { items, missingCost, ready: true, avgMargin: Math.round(avgMargin) };
}
