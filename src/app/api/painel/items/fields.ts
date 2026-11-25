import { toCents } from "@/lib/http";
import { isOwnFileUrl } from "@/lib/storage";
import { ALLERGEN_IDS, DAYPART_IDS } from "@/lib/sell";
import { normalizeOptions, normalizePromo } from "@/lib/options";

function validImage(v: unknown) {
  if (typeof v !== "string" || !v) return "";
  if (v.startsWith("data:image/") || isOwnFileUrl(v) || /^\/demo\/[a-z0-9_-]+\.(jpg|png|webp)$/i.test(v)) return v;
  return "";
}

export function itemFields(b: any) {
  return {
    category_id: b.category_id ? String(b.category_id) : null,
    name: String(b.name || "").trim().slice(0, 100),
    description: String(b.description || "").slice(0, 500),
    price_cents: typeof b.price_cents === "number" ? Math.max(0, Math.round(b.price_cents)) : toCents(b.price),
    image: validImage(b.image),
    serves: Math.min(20, Math.max(1, Number(b.serves) || 1)),
    tags: Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).slice(0, 30)).slice(0, 8) : [],
    available: b.available !== false,
    featured: Boolean(b.featured),
    allergens: Array.isArray(b.allergens) ? [...new Set<string>(b.allergens.map(String))].filter((a) => ALLERGEN_IDS.includes(a)) : [],
    allergens_known: Boolean(b.allergens_known),
    pairs: Array.isArray(b.pairs) ? [...new Set<string>(b.pairs.map((x: unknown) => String(x).slice(0, 64)))].slice(0, 4) : [],
    promote: Boolean(b.promote),
    substitute_id: typeof b.substitute_id === "string" ? b.substitute_id.slice(0, 64) : "",
    dayparts: Array.isArray(b.dayparts) ? [...new Set<string>(b.dayparts.map(String))].filter((d) => DAYPART_IDS.includes(d)) : [],
    cost_cents: b.cost != null ? toCents(b.cost) : typeof b.cost_cents === "number" ? Math.max(0, Math.round(b.cost_cents)) : 0,
    options: normalizeOptions(b.options),
    promo: b.promo && typeof b.promo === "object" ? normalizePromo({ ...b.promo, price_cents: b.promo.price != null ? toCents(b.promo.price) : b.promo.price_cents }) : null,
  };
}
