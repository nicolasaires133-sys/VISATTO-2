// Junta o que a imagem mostra (IA de visão) com o que o nome do item diz, e decide o que é o prato.
import { clipAvailable, embedImages, getClip, meanVec, rank, type Score } from "./clip";
import { DISHES, PARTS, dishById, isSweet, matchName, partById, describeParts, type Dish } from "./scan/pratos";
import { profileFromDish, profileFromName, type ProductProfile } from "./scan/profile";

export type Recognition = {
  escolha: { id: string; nome: string; p: number } | null;
  alternativas: { id: string; nome: string; p: number }[];
  /** o nome do item no cardápio diz uma coisa e a imagem mostra outra, com bastante certeza */
  conflito: boolean;
  fonte: "foto" | "foto+nome" | "nome";
};

export type PartGuess = { id: string; nome: string; p: number }[];

const named = (s: Score) => ({ id: s.id, nome: dishById(s.id)?.nome ?? s.id, p: Math.round(s.p * 1000) / 1000 });
const namedPart = (s: Score) => ({ id: s.id, nome: partById(s.id)?.nome ?? s.id, p: Math.round(s.p * 1000) / 1000 });

/** Data URL de imagem → bytes (só JPEG/PNG/WebP, até ~600 KB cada). */
export function decodeImages(list: unknown, max: number): Buffer[] {
  if (!Array.isArray(list)) return [];
  const out: Buffer[] = [];
  for (const s of list.slice(0, max)) {
    const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ""));
    if (m && m[1].length < 800_000) out.push(Buffer.from(m[1], "base64"));
  }
  return out;
}

/** Reconhece o prato pelas fotos (recortes do prato de ângulos diferentes), usando o nome do item como pista. */
export async function recognizeDish(imgs: Buffer[], itemName: string, note: string): Promise<{ profile: ProductProfile; rec: Recognition }> {
  const nm = matchName(`${itemName} ${note}`);
  const byName = nm.dish && nm.score >= 14 ? nm.dish : null;
  if (!imgs.length || !clipAvailable()) {
    const profile = byName ? profileFromDish(byName, "nome") : profileFromName(itemName, note);
    return { profile, rec: { escolha: byName ? { id: byName.id, nome: byName.nome, p: 0 } : null, alternativas: [], conflito: false, fonte: "nome" } };
  }
  const clip = await getClip();
  const e = meanVec(await embedImages(imgs));
  const pure = rank(e, clip.pratos, clip.logit);
  // o nome do item é uma pista forte (o restaurante sabe o que vende), mas a imagem pode corrigir
  const prior: Record<string, number> = byName ? { [byName.id]: 5 } : {};
  const both = byName ? rank(e, clip.pratos, clip.logit, prior) : pure;
  const top = both[0];
  const conflito = !!byName && pure[0].p >= 0.55 && (pure.find((s) => s.id === byName.id)?.p ?? 0) < 0.03 && pure[0].id !== byName.id;
  const dish = dishById(top.id) as Dish;
  const profile = profileFromDish(dish, "foto", Math.round(top.p * 1000) / 1000);
  return {
    profile,
    rec: { escolha: named(top), alternativas: both.slice(1, 4).map(named), conflito, fonte: byName ? "foto+nome" : "foto" },
  };
}

/** Reconhece cada pedaço do prato (arroz, feijão, morango...). As partes típicas do prato ganham preferência. */
export async function recognizeParts(imgs: Buffer[], dishId: string | undefined, extraText = ""): Promise<PartGuess[]> {
  if (!imgs.length || !clipAvailable()) return [];
  const clip = await getClip();
  const prior: Record<string, number> = {};
  const dish = dishById(dishId || "");
  // num prato salgado, sorvete e morango são improváveis (e vice-versa): a IA erra menos sabendo o contexto
  if (dish) {
    const sweet = isSweet(dish);
    for (const p of PARTS) if (p.doce !== undefined && p.doce !== sweet) prior[p.id] = 0.12;
  }
  // o prato já é conhecido: as partes dele são as mais prováveis; pratos inteiros (pizza, sushi) como "parte", menos
  if (dish) for (const id of ["pizza", "hamburguer", "sushi"]) if (!dish.partes?.includes(id) && prior[id] === undefined) prior[id] = 0.4;
  for (const id of dish?.partes ?? []) prior[id] = 3;
  for (const p of matchName(extraText).parts) prior[p.id] = 3;
  const es = await embedImages(imgs);
  return es.map((e) => rank(e, clip.partes, clip.logit, prior).slice(0, 3).map(namedPart));
}

export { DISHES, PARTS, describeParts };
