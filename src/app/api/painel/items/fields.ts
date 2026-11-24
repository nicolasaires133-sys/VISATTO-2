import { toCents } from "@/lib/http";
import { isOwnFileUrl } from "@/lib/storage";

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
  };
}
