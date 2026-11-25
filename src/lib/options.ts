// Opções e adicionais de um prato (tamanho, ponto da carne, adicionais...) e preço promocional com horário.
// Usado no cardápio (para mostrar o preço) e no servidor (que sempre recalcula o preço do pedido).

export type OptionChoice = { id: string; name: string; price_cents: number };
/** min = quantas escolhas são obrigatórias (0 = opcional); max = quantas no máximo (1 = escolha uma) */
export type OptionGroup = { id: string; name: string; min: number; max: number; choices: OptionChoice[] };
/** escolhas da pessoa: id do grupo -> ids das opções */
export type Picks = Record<string, string[]>;

/** Preço promocional. days: 0=domingo ... 6=sábado (vazio = todos os dias). from/to "HH:MM" (vazio = o dia todo). */
export type Promo = { price_cents: number; days: number[]; from: string; to: string } | null;

const rid = () => Math.random().toString(36).slice(2, 9);
const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const cents = (v: unknown) => clampInt(v, 0, 1_000_000, 0);

/** Limpa o que vem do painel (ou do banco): nomes curtos, preços válidos, limites coerentes. */
export function normalizeOptions(raw: unknown): OptionGroup[] {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: OptionGroup[] = [];
  for (const g of v.slice(0, 8)) {
    if (!g || typeof g !== "object") continue;
    const name = String((g as any).name || "").trim().slice(0, 40);
    const seen = new Set<string>();
    const choices: OptionChoice[] = [];
    for (const c of Array.isArray((g as any).choices) ? (g as any).choices.slice(0, 20) : []) {
      const cn = String(c?.name || "").trim().slice(0, 50);
      if (!cn) continue;
      let id = String(c?.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 16) || rid();
      while (seen.has(id)) id = rid();
      seen.add(id);
      choices.push({ id, name: cn, price_cents: cents(c?.price_cents) });
    }
    if (!name || !choices.length) continue;
    const max = clampInt((g as any).max, 1, choices.length, 1);
    const min = clampInt((g as any).min, 0, max, 0);
    const id = String((g as any).id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 16) || rid();
    out.push({ id: out.some((o) => o.id === id) ? rid() : id, name, min, max, choices });
  }
  return out;
}

export function normalizePromo(raw: unknown): Promo {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const p = cents((v as any).price_cents);
  if (!p) return null;
  const hm = (s: unknown) => (typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : "");
  const days = Array.isArray((v as any).days) ? [...new Set<number>((v as any).days.map(Number))].filter((d) => d >= 0 && d <= 6).sort() : [];
  let from = hm((v as any).from);
  let to = hm((v as any).to);
  if (!from || !to) from = to = "";
  return { price_cents: p, days: days.length === 7 ? [] : days, from, to };
}

/** Dia da semana e minutos do dia no horário de Brasília. */
export function brNow(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, min: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export function promoActive(promo: Promo, basePrice: number, at: Date = new Date()) {
  if (!promo || promo.price_cents <= 0 || promo.price_cents >= basePrice) return false;
  const { day, min } = brNow(at);
  if (promo.from && promo.to) {
    const a = toMin(promo.from);
    const b = toMin(promo.to);
    // horário que vira a noite (ex.: 22:00 às 02:00): depois da meia-noite conta o dia anterior
    if (a <= b) {
      if (min < a || min >= b) return false;
      if (promo.days.length && !promo.days.includes(day)) return false;
    } else {
      if (min >= a) {
        if (promo.days.length && !promo.days.includes(day)) return false;
      } else if (min < b) {
        if (promo.days.length && !promo.days.includes((day + 6) % 7)) return false;
      } else return false;
    }
    return true;
  }
  return !promo.days.length || promo.days.includes(day);
}

/** Preço base do prato agora (promocional, se a promoção estiver valendo). */
export function basePrice(item: { price_cents: number; promo?: Promo }, at?: Date) {
  return promoActive(item.promo ?? null, item.price_cents, at) ? item.promo!.price_cents : item.price_cents;
}

export const hasRequired = (groups?: OptionGroup[]) => (groups ?? []).some((g) => g.min > 0);

/**
 * Confere as escolhas e devolve o preço de uma unidade e o resumo ("Grande · Bacon, Cheddar").
 * Escolhas que não existem são ignoradas; faltar uma escolha obrigatória dá erro.
 */
export function priceWith(item: { name: string; price_cents: number; promo?: Promo; options?: OptionGroup[] }, picks: Picks | undefined, at?: Date):
  | { ok: true; unit: number; summary: string; picks: Picks }
  | { ok: false; error: string } {
  let unit = basePrice(item, at);
  const clean: Picks = {};
  const parts: string[] = [];
  for (const g of item.options ?? []) {
    const want = Array.isArray(picks?.[g.id]) ? [...new Set(picks![g.id].map(String))] : [];
    const chosen = g.choices.filter((c) => want.includes(c.id)).slice(0, g.max);
    if (chosen.length < g.min) return { ok: false, error: `Escolha ${g.name.toLowerCase()} em "${item.name}".` };
    if (!chosen.length) continue;
    clean[g.id] = chosen.map((c) => c.id);
    unit += chosen.reduce((s, c) => s + c.price_cents, 0);
    parts.push(g.max === 1 ? chosen[0].name : `${g.name}: ${chosen.map((c) => c.name).join(", ")}`);
  }
  return { ok: true, unit, summary: parts.join(" · "), picks: clean };
}

/** Chave para juntar no carrinho o mesmo prato com as mesmas escolhas. */
export function picksKey(picks?: Picks) {
  if (!picks) return "";
  return Object.keys(picks)
    .sort()
    .map((k) => `${k}=${[...picks[k]].sort().join(",")}`)
    .join(";");
}

/** Modelos prontos para o dono começar rápido no painel. */
export const OPTION_TEMPLATES: { label: string; group: Omit<OptionGroup, "id"> }[] = [
  { label: "Tamanho", group: { name: "Tamanho", min: 1, max: 1, choices: [{ id: "p", name: "Pequeno", price_cents: 0 }, { id: "m", name: "Médio", price_cents: 800 }, { id: "g", name: "Grande", price_cents: 1500 }] } },
  { label: "Ponto da carne", group: { name: "Ponto da carne", min: 1, max: 1, choices: [{ id: "mal", name: "Mal passada", price_cents: 0 }, { id: "ao", name: "Ao ponto", price_cents: 0 }, { id: "bem", name: "Bem passada", price_cents: 0 }] } },
  { label: "Adicionais", group: { name: "Adicionais", min: 0, max: 3, choices: [{ id: "bacon", name: "Bacon", price_cents: 600 }, { id: "queijo", name: "Queijo extra", price_cents: 500 }, { id: "ovo", name: "Ovo", price_cents: 300 }] } },
  { label: "Acompanhamento", group: { name: "Acompanhamento", min: 1, max: 1, choices: [{ id: "arroz", name: "Arroz", price_cents: 0 }, { id: "fritas", name: "Batata frita", price_cents: 0 }, { id: "salada", name: "Salada", price_cents: 0 }] } },
];
