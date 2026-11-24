// Quando a IA não reconhece o prato pela imagem, o dono digita o nome e o Visatto pesquisa o que ele é:
// primeiro na própria lista de pratos (com apelidos e erros de digitação), depois na Wikipédia em português.
// Do texto encontrado saem o tipo de prato e as partes (arroz, feijão, queijo...), que ajustam o 3D.
import { describeParts, matchName, type Dish } from "./scan/pratos";
import { KINDS, profileFromDish, profileFromName, RANGES, type Kind, type ProductProfile } from "./scan/profile";

export type Research = { profile: ProductProfile; entendi: string; fonte: "lista" | "wikipedia" | "nome"; titulo?: string; link?: string };

const API = () => process.env.WIKIPEDIA_API || "https://pt.wikipedia.org/w/api.php";
const FOOD = /\b(prato|culinaria|comida|receita|iguaria|alimento|sobremesa|doce|bebida|lanche|petisco|salgado|ensopado|sopa|massa|guisado|gastronomia|cozinha)\b/;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function wiki(params: Record<string, string>, timeoutMs = 5000) {
  const url = `${API()}?${new URLSearchParams({ format: "json", utf8: "1", ...params })}`;
  const r = await fetch(url, { headers: { "User-Agent": "Visatto/1.0 (cardapio 3D para restaurantes)" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`wikipedia ${r.status}`);
  return r.json();
}

function kindFromText(t: string): Kind {
  if (/\b(bebida|drinque|coquetel|suco|refresco|licor|cerveja|vinho|cha)\b/.test(t)) return "bebida";
  if (/\bsorvete\b/.test(t)) return "sorvete";
  if (/\b(sopa|caldo|ensopado|guisado|cozido|mingau|creme)\b/.test(t)) return "tigela";
  if (/\b(sanduiche|lanche|hamburguer)\b/.test(t)) return "prato_alto";
  if (/\b(bolo|torta|pudim)\b/.test(t)) return "fatia";
  if (/\b(salgadinho|salgado|petisco|bolinho|frito|fritura|empanado|aperitivo)\b/.test(t)) return "porcao";
  return "prato_raso";
}

function summary(p: ProductProfile) {
  const partes = describeParts(p.partes ?? []);
  return `Vou tratar como ${KINDS[p.kind].label}${partes ? `, com ${partes}` : ""}.`;
}

function firstSentence(t: string) {
  const s = t.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const m = /^(.{40,220}?[.!?])(\s|$)/.exec(s);
  return (m ? m[1] : s.slice(0, 200)).trim();
}

export async function researchName(nome: string): Promise<Research> {
  const clean = nome.trim().slice(0, 80);
  const nm = matchName(clean);
  const fromList = (d: Dish) => {
    const profile = profileFromDish(d, "pesquisa", 1);
    profile.produto = clean || d.nome;
    profile.partes = [...new Set([...(profile.partes ?? []), ...nm.parts.map((p) => p.id)])];
    return profile;
  };
  if (nm.dish && nm.score >= 14) {
    const profile = fromList(nm.dish);
    return { profile, fonte: "lista", entendi: `Conheço: ${nm.dish.nome}. ${summary(profile)}` };
  }
  try {
    // no máximo 2 consultas (busca + resumos de uma vez só) e 9 segundos no total
    const deadline = Date.now() + 9000, left = () => Math.max(1500, deadline - Date.now());
    const found = await wiki({ action: "query", list: "search", srsearch: clean, srlimit: "4" }, left());
    const titles: string[] = (found?.query?.search ?? []).map((r: any) => String(r.title)).slice(0, 4);
    const pg = titles.length
      ? await wiki({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "max", redirects: "1", titles: titles.join("|") }, left())
      : null;
    const pages: any[] = Object.values(pg?.query?.pages ?? {});
    const alias = new Map<string, string>();
    for (const r of [...(pg?.query?.normalized ?? []), ...(pg?.query?.redirects ?? [])]) alias.set(String(r.from), String(r.to));
    const byTitle = new Map(pages.map((pp) => [String(pp.title), pp]));
    for (const title of titles) {
      let t = title;
      for (let k = 0; k < 3 && alias.has(t); k++) t = alias.get(t)!;
      const page = byTitle.get(t);
      const text = String(page?.extract || "").slice(0, 1200);
      const tn = norm(text);
      if (!text || !FOOD.test(tn)) continue; // achou outra coisa com o mesmo nome (cidade, pessoa...)
      const mm = matchName(text);
      let profile: ProductProfile;
      // o texto cita um prato conhecido pelo nome (não só uma palavra solta como "carne"): usa a forma dele
      if (mm.dish && mm.score >= 18) profile = { ...fromList(mm.dish), partes: [] };
      else {
        const kind = kindFromText(tn);
        profile = { ...profileFromName(clean, ""), kind, altura_cm: RANGES[kind].h, largura_cm: RANGES[kind].w, fonte: "pesquisa", confianca: 1 };
        profile.produto = clean;
      }
      // partes: só as que o texto (ou o nome digitado) realmente cita
      profile.partes = [...new Set([...mm.parts.map((p) => p.id), ...nm.parts.map((p) => p.id)])];
      const link = `https://pt.wikipedia.org/wiki/${encodeURIComponent(String(page.title || title).replace(/ /g, "_"))}`;
      return { profile, fonte: "wikipedia", titulo: String(page.title || title), link, entendi: `Pesquisei na Wikipédia: ${firstSentence(text)} ${summary(profile)}` };
    }
  } catch {
    // sem internet ou Wikipédia fora do ar: segue com as pistas do nome
  }
  const profile = { ...profileFromName(clean, ""), fonte: "pesquisa" as const, confianca: 1 };
  profile.partes = nm.parts.map((p) => p.id);
  return { profile, fonte: "nome", entendi: `Não achei "${clean}" na minha lista nem na Wikipédia. Vou usar as pistas do próprio nome. ${summary(profile)}` };
}
