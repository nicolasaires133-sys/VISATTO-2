import { getDB } from "./db";
import type { Category, MenuItem } from "./format";

export async function loadMenu(restaurantId: string, opts: { withImages?: boolean } = {}) {
  const db = await getDB();
  const categories = await db.query<Category>(
    `SELECT id, name, position FROM categories WHERE restaurant_id = $1 ORDER BY position, name`,
    [restaurantId]
  );
  const items = await db.query<MenuItem>(
    `SELECT id, category_id, name, description, price_cents, ${opts.withImages === false ? "''" : "image"} AS image,
            serves, tags, available, featured, position,
            model_status, model_glb_url, model_usdz_url, model_width_cm, model_dims, model_progress,
            model_published, model_error
       FROM items WHERE restaurant_id = $1 ORDER BY position, name`,
    [restaurantId]
  );
  for (const i of items) {
    if (typeof i.tags === "string") i.tags = JSON.parse(i.tags as any);
    if (!Array.isArray(i.tags)) i.tags = [];
    if (typeof (i as any).model_dims === "string") (i as any).model_dims = JSON.parse((i as any).model_dims);
  }
  return { categories, items };
}

export async function restaurantBySlug(slug: string) {
  const db = await getDB();
  const rows = await db.query(
    `SELECT id, slug, name, primary_color, whatsapp, address, delivery_enabled, dine_in_enabled,
            delivery_fee_cents, min_order_cents, ai_name, ai_tone, ai_instructions, accepting_orders, pix_key
       FROM restaurants WHERE slug = $1`,
    [slug]
  );
  return rows[0] ?? null;
}

/** Versão pública do cardápio: só expõe o 3D de pratos com modelo publicado. */
export function publicItems(items: MenuItem[]) {
  return items.map((i) => {
    const has3d = i.model_published && i.model_status === "pronto" && !!i.model_glb_url;
    return {
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      description: i.description,
      price_cents: i.price_cents,
      image: i.image,
      serves: i.serves,
      tags: i.tags,
      available: i.available,
      featured: i.featured,
      position: i.position,
      model: has3d ? { glb: i.model_glb_url, usdz: i.model_usdz_url || "", dims: i.model_dims || null } : null,
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
  const { id: _id, ai_tone: _t, ai_instructions: _i, ...pub } = r;
  const { waiterEnabled } = await import("./ai");
  return { restaurant: pub, categories, items: publicItems(items), waiter: waiterEnabled() };
}
