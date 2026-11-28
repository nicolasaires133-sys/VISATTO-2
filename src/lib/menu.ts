import { readMode, readPayMethods, readZones } from "@/lib/delivery";
import { getDB } from "./db";
import type { Category, MenuItem } from "./format";
import { normalizeOptions, normalizePromo } from "./options";

export async function loadMenu(restaurantId: string, opts: { withImages?: boolean } = {}) {
  const db = await getDB();
  const categories = await db.query<Category>(
    `SELECT id, name, position, translations, icon FROM categories WHERE restaurant_id = $1 ORDER BY position, name`,
    [restaurantId]
  );
  const items = await db.query<MenuItem>(
    `SELECT id, category_id, name, description, price_cents, ${opts.withImages === false ? "''" : "image"} AS image,
            serves, tags, available, featured, position,
            model_status, model_glb_url, model_usdz_url, model_width_cm, model_dims, model_progress,
            model_published, model_error, allergens, allergens_known, pairs, promote, substitute_id, dayparts,
            cost_cents, translations, options, promo, caption, photo_mode
       FROM items WHERE restaurant_id = $1 ORDER BY position, name`,
    [restaurantId]
  );
  const json = (v: any, fallback: any) => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    }
    return v ?? fallback;
  };
  const ids = new Set(items.map((i) => i.id));
  for (const i of items) {
    i.tags = json(i.tags, []);
    if (!Array.isArray(i.tags)) i.tags = [];
    (i as any).model_dims = json((i as any).model_dims, null);
    i.allergens = (json(i.allergens, []) as string[]).filter((a) => typeof a === "string");
    i.pairs = (json(i.pairs, []) as string[]).filter((id) => ids.has(id) && id !== i.id);
    i.dayparts = json(i.dayparts, []);
    i.translations = json(i.translations, {});
    i.cost_cents = Number(i.cost_cents) || 0;
    if (i.substitute_id && !ids.has(i.substitute_id)) i.substitute_id = "";
    i.options = normalizeOptions(i.options);
    i.promo = normalizePromo(i.promo);
  }
  for (const c of categories) c.translations = json(c.translations, {});
  return { categories, items };
}

export async function restaurantBySlug(slug: string) {
  const db = await getDB();
  const rows = await db.query(
    `SELECT id, slug, name, primary_color, whatsapp, address, delivery_enabled, dine_in_enabled,
            delivery_fee_cents, min_order_cents, ai_name, ai_tone, ai_instructions, accepting_orders, pix_key,
            google_review_url, languages, ai_preset, service_pct, loyalty, hours,
            logo_url, cover_url, pickup_enabled, pickup_eta, delivery_eta, delivery_mode, delivery_zones,
            free_delivery_cents, pix_name, pix_city, pay_methods
       FROM restaurants WHERE slug = $1`,
    [slug]
  );
  return rows[0] ?? null;
}

/** Pratos que saem juntos nos pedidos dos últimos 120 dias (guardado por 10 minutos). */
const boughtCache = new Map<string, { at: number; map: Map<string, string[]> }>();
export async function boughtTogether(restaurantId: string): Promise<Map<string, string[]>> {
  const hit = boughtCache.get(restaurantId);
  if (hit && Date.now() - hit.at < 600_000) return hit.map;
  const db = await getDB();
  const rows = await db
    .query<{ x: string; y: string; n: number }>(
      `SELECT a.item_id AS x, b.item_id AS y, COUNT(DISTINCT a.order_id)::int AS n
         FROM order_items a
         JOIN order_items b ON b.order_id = a.order_id AND b.item_id <> a.item_id
         JOIN orders o ON o.id = a.order_id
        WHERE o.restaurant_id = $1 AND o.status <> 'cancelado' AND o.created_at > NOW() - INTERVAL '120 days'
          AND a.item_id IS NOT NULL AND b.item_id IS NOT NULL
        GROUP BY a.item_id, b.item_id
       HAVING COUNT(DISTINCT a.order_id) >= 2
        ORDER BY n DESC
        LIMIT 3000`,
      [restaurantId]
    )
    .catch(() => []);
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.x) ?? [];
    if (list.length < 5) list.push(r.y);
    map.set(r.x, list);
  }
  boughtCache.set(restaurantId, { at: Date.now(), map });
  return map;
}

/** Os 3 pratos mais pedidos nos últimos 30 dias (pelo menos 5 unidades), guardado por 10 minutos. */
const popularCache = new Map<string, { at: number; set: Set<string> }>();
export async function popularItems(restaurantId: string): Promise<Set<string>> {
  const hit = popularCache.get(restaurantId);
  if (hit && Date.now() - hit.at < 600_000) return hit.set;
  const db = await getDB();
  const rows = await db
    .query<{ item_id: string }>(
      `SELECT oi.item_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id = $1 AND o.status <> 'cancelado' AND o.created_at > NOW() - INTERVAL '30 days' AND oi.item_id IS NOT NULL
        GROUP BY oi.item_id HAVING SUM(oi.qty) >= 5 ORDER BY SUM(oi.qty) DESC LIMIT 3`,
      [restaurantId]
    )
    .catch(() => []);
  const set = new Set(rows.map((r) => r.item_id));
  popularCache.set(restaurantId, { at: Date.now(), set });
  return set;
}

/** Versão pública do cardápio: só expõe o 3D de pratos com modelo publicado. */
export function publicItems(items: MenuItem[], bought?: Map<string, string[]>, popular?: Set<string>) {
  return items.map((i) => {
    const has3d = i.model_published && i.model_status === "pronto" && !!i.model_glb_url;
    return {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      caption: i.caption || "",
      price_cents: i.price_cents,
      // o dono escolheu "sem foto": o cliente não vê foto nem desenho
      image: i.photo_mode === "none" ? "" : i.image,
      photo_mode: i.photo_mode === "none" ? "none" : "auto",
      serves: i.serves,
      tags: i.tags,
      available: i.available,
      featured: i.featured,
      position: i.position,
      allergens: i.allergens ?? [],
      allergens_known: Boolean(i.allergens_known),
      pairs: i.pairs ?? [],
      promote: Boolean(i.promote),
      substitute_id: i.substitute_id || "",
      dayparts: i.dayparts ?? [],
      translations: i.translations ?? {},
      bought: bought?.get(i.id) ?? [],
      options: i.options ?? [],
      promo: i.promo ?? null,
      popular: popular?.has(i.id) ?? false,
      // as medidas (cm) ficam só no painel: o cliente vê o prato em tamanho real, sem números
      model: has3d ? { glb: i.model_glb_url, usdz: i.model_usdz_url || "", dims: null } : null,
    };
  });
}

/** Tudo que o cardápio público precisa (usado pela página e pela API). */
export async function publicMenu(slug: string) {
  const r = await restaurantBySlug(slug);
  if (!r) return null;
  let { categories, items } = await loadMenu(r.id);
  if (items.some((i) => typeof i.image === "string" && i.image.startsWith("data:"))) {
    const { migrateInlineImages } = await import("./images");
    await migrateInlineImages(r.id);
    ({ categories, items } = await loadMenu(r.id));
  }
  const { id: _id, ai_tone: _t, ai_instructions: _i, ai_preset: _p, ...pub } = r;
  pub.languages = Array.isArray(pub.languages) ? pub.languages : JSON.parse(pub.languages || "[]");
  const { readLoyalty } = await import("./loyalty");
  pub.loyalty = readLoyalty(pub.loyalty);
  const { readHours } = await import("./hours");
  pub.hours = readHours(pub.hours);
  pub.delivery_zones = readZones(pub.delivery_zones);
  pub.delivery_mode = readMode(pub.delivery_mode);
  pub.pay_methods = readPayMethods(pub.pay_methods);
  const { waiterEnabled } = await import("./ai");
  const [bought, popular] = await Promise.all([boughtTogether(r.id), popularItems(r.id)]);
  const { categoryIcon } = await import("./catIcons");
  return { restaurant: pub, categories: categories.map((c) => ({ ...c, icon: categoryIcon(c.name, c.icon) })), items: publicItems(items, bought, popular), waiter: waiterEnabled() };
}
