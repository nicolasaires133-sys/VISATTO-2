// Inteligência de venda do Visatto: alergênicos, horários do dia, tipos de categoria e as sugestões
// "combina com o seu pedido". Tudo aqui roda tanto no celular do cliente quanto no servidor
// (sem banco e sem IA paga), para a sugestão aparecer na hora e de graça.

export type Lang = "pt" | "en" | "es";

export const ALLERGENS: { id: string; pt: string; en: string; es: string }[] = [
  { id: "gluten", pt: "Glúten", en: "Gluten", es: "Gluten" },
  { id: "leite", pt: "Leite", en: "Milk", es: "Leche" },
  { id: "ovo", pt: "Ovo", en: "Egg", es: "Huevo" },
  { id: "amendoim", pt: "Amendoim", en: "Peanuts", es: "Cacahuete" },
  { id: "castanhas", pt: "Castanhas e nozes", en: "Tree nuts", es: "Frutos secos" },
  { id: "soja", pt: "Soja", en: "Soy", es: "Soja" },
  { id: "peixe", pt: "Peixe", en: "Fish", es: "Pescado" },
  { id: "frutos_mar", pt: "Frutos do mar", en: "Shellfish", es: "Mariscos" },
  { id: "gergelim", pt: "Gergelim", en: "Sesame", es: "Sésamo" },
];
export const ALLERGEN_IDS = ALLERGENS.map((a) => a.id);
export const allergenLabel = (id: string, lang: Lang = "pt") => ALLERGENS.find((a) => a.id === id)?.[lang] ?? id;

/** Partes do dia. A noite vai até as 6 da manhã (bares e madrugada). */
export const DAYPARTS: { id: string; label: string; from: number; to: number }[] = [
  { id: "manha", label: "Café da manhã", from: 6, to: 11 },
  { id: "almoco", label: "Almoço", from: 11, to: 15 },
  { id: "tarde", label: "Tarde", from: 15, to: 18 },
  { id: "noite", label: "Noite", from: 18, to: 30 },
];
export const DAYPART_IDS = DAYPARTS.map((d) => d.id);

export function hourIn(tz = "America/Sao_Paulo", d = new Date()) {
  try {
    const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(d);
    return Number(h) % 24;
  } catch {
    return d.getHours();
  }
}
export function daypartAt(hour: number) {
  const h = hour < 6 ? hour + 24 : hour;
  return DAYPARTS.find((p) => h >= p.from && h < p.to)?.id ?? "noite";
}

export type Kind = "bebida" | "sobremesa" | "entrada" | "principal";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Descobre o tipo de uma categoria pelo nome (Bebidas, Sobremesas, Entradas...). */
export function categoryKind(name: string): Kind {
  const n = norm(name);
  if (/bebid|drink|suco|refri|cervej|chope|vinho|cafe|caf[eé]s|cha[s]?\b|coquet|agua|soda|milk ?shake|smoothie|dose/.test(n)) return "bebida";
  if (/sobremesa|doce|dessert|sorvete|gelato|torta|bolo|acai/.test(n)) return "sobremesa";
  if (/entrad|petisc|porc|aperitiv|antepast|tira.?gost|salada|sopa|caldo|starter/.test(n)) return "entrada";
  return "principal";
}

export type SellItem = {
  id: string;
  category_id: string | null;
  available: boolean;
  featured: boolean;
  promote?: boolean;
  pairs?: string[];
  bought?: string[];
  dayparts?: string[];
};

/**
 * Sugestões para o carrinho atual, da melhor para a pior:
 * 1) combinações que o dono escolheu, 2) o que os clientes costumam pedir junto,
 * 3) o tipo que falta no pedido (bebida, sobremesa), com peso para pratos que o dono quer vender e para a hora do dia.
 * Nunca sugere o que já está no carrinho, o que está esgotado nem outro prato da mesma categoria (a não ser que o dono tenha combinado).
 */
export function suggest(cartIds: string[], items: SellItem[], kindOfCategory: (catId: string | null) => Kind, opts: { daypart?: string; limit?: number; exclude?: string[] } = {}) {
  const limit = opts.limit ?? 3;
  if (!cartIds.length) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const inCart = new Set(cartIds);
  const skip = new Set([...(opts.exclude ?? []), ...cartIds]);
  const cartItems = cartIds.map((id) => byId.get(id)).filter(Boolean) as SellItem[];
  const cartCats = new Set(cartItems.map((i) => i.category_id));
  const cartKinds = new Set(cartItems.map((i) => kindOfCategory(i.category_id)));
  const hasFood = [...cartKinds].some((k) => k === "principal" || k === "entrada");

  const score = new Map<string, number>();
  const add = (id: string, v: number) => score.set(id, (score.get(id) ?? 0) + v);

  for (const c of cartItems) {
    (c.pairs ?? []).forEach((id, k) => add(id, 100 - k * 5));
    const bought = c.bought ?? [];
    bought.forEach((id, k) => add(id, 45 * (1 - k / Math.max(bought.length, 1)) + 10));
  }
  for (const it of items) {
    if (skip.has(it.id) || !it.available) continue;
    const kind = kindOfCategory(it.category_id);
    if (hasFood && kind === "bebida" && !cartKinds.has("bebida")) add(it.id, 24);
    if (hasFood && kind === "sobremesa" && !cartKinds.has("sobremesa")) add(it.id, 16);
    if (score.has(it.id)) {
      if (it.promote) add(it.id, 12);
      if (it.featured) add(it.id, 4);
      if (opts.daypart && it.dayparts?.includes(opts.daypart)) add(it.id, 8);
    }
  }
  const ownerPaired = new Set(cartItems.flatMap((c) => c.pairs ?? []));
  return [...score.entries()]
    .filter(([id, s]) => {
      const it = byId.get(id);
      if (!it || !it.available || inCart.has(id) || skip.has(id) || s < 20) return false;
      return ownerPaired.has(id) || !cartCats.has(it.category_id);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/** Traduções guardadas por prato e por categoria: { en: { name, description }, es: {...} } */
export type Translations = Partial<Record<"en" | "es", { name?: string; description?: string }>>;
export function tr<T extends { name: string; description?: string; translations?: Translations }>(x: T, lang: Lang) {
  if (lang === "pt") return { name: x.name, description: x.description ?? "" };
  const t = x.translations?.[lang];
  return { name: t?.name || x.name, description: t?.description || x.description || "" };
}
