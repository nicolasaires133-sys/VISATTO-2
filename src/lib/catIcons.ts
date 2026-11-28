// Símbolo de cada categoria do cardápio (bebidas, combos, pizzas...). O dono pode escolher no painel;
// se não escolher, o símbolo vem do nome da categoria.
export const CATEGORY_ICONS = [
  { id: "ofertas", label: "Ofertas" },
  { id: "combo", label: "Combos" },
  { id: "entrada", label: "Entradas" },
  { id: "prato", label: "Pratos" },
  { id: "massa", label: "Massas" },
  { id: "pizza", label: "Pizzas" },
  { id: "burger", label: "Lanches" },
  { id: "carne", label: "Carnes" },
  { id: "peixe", label: "Peixes" },
  { id: "salada", label: "Saladas" },
  { id: "kids", label: "Kids" },
  { id: "sobremesa", label: "Sobremesas" },
  { id: "bebida", label: "Bebidas" },
  { id: "drink", label: "Drinks" },
  { id: "cafe", label: "Cafés" },
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number]["id"];

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GUESS: [RegExp, CategoryIcon][] = [
  [/oferta|promo|desconto/, "ofertas"],
  [/combo|kit|promocao/, "combo"],
  [/drink|coquetel|cerveja|chopp|vinho|caipirinha|bar\b/, "drink"],
  [/bebida|suco|refri|agua/, "bebida"],
  [/cafe|cafeteria|cha\b/, "cafe"],
  [/sobremesa|doce|torta|sorvete|acai/, "sobremesa"],
  [/pizza/, "pizza"],
  [/hamburg|burger|lanche|sanduiche/, "burger"],
  [/massa|macarr|lasanha|risoto/, "massa"],
  [/entrada|petisco|porc|aperitivo/, "entrada"],
  [/carne|churras|grelhad|parrilla/, "carne"],
  [/peixe|frutos do mar|sushi|japones/, "peixe"],
  [/salada|vegano|vegetarian|natural/, "salada"],
  [/kids|infantil|crianca/, "kids"],
];
export function categoryIcon(name: string, chosen?: string | null): CategoryIcon {
  if (chosen && CATEGORY_ICONS.some((c) => c.id === chosen)) return chosen as CategoryIcon;
  const n = plain(name);
  return GUESS.find(([re]) => re.test(n))?.[1] ?? "prato";
}

/** Desenho (ícone da interface) de cada símbolo. */
export const CAT_ICON: Record<string, string> = {
  ofertas: "tag", combo: "layers", entrada: "starter", prato: "bowl", massa: "pasta", pizza: "pizza", burger: "burger",
  carne: "meat", peixe: "fish", salada: "leaf", kids: "kid", sobremesa: "cake", bebida: "cup", drink: "cocktail", cafe: "coffee",
};
