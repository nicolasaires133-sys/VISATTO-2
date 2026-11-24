import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";
import { estimateMinutes } from "@/lib/eta";
import { readLoyalty, stampsOf } from "@/lib/loyalty";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const db = await getDB();
  const [order] = await db.query(
    `SELECT id, number, channel, table_label, status, subtotal_cents, delivery_fee_cents, total_cents, created_at, updated_at,
            payment, change_for_cents, customer_phone
       FROM orders WHERE id=$1 AND restaurant_id=$2`,
    [id, r.id]
  );
  if (!order) return fail("Pedido não encontrado.", 404);
  const items = await db.query(`SELECT name, qty, notes, price_cents FROM order_items WHERE order_id=$1`, [id]);
  const [fb] = await db.query<{ stars: number }>(`SELECT stars FROM feedback WHERE order_id=$1`, [id]);
  const { customer_phone: phone, ...pub } = order;
  const eta = ["novo", "preparo"].includes(order.status) ? await estimateMinutes(r.id, order.channel === "delivery" ? "delivery" : "mesa", order.created_at) : null;
  const l = readLoyalty(r.loyalty);
  const loyalty = l.on && phone ? { ...(await stampsOf(r.id, phone, l)), goal: l.goal, reward: l.reward } : null;
  return ok({
    order: { ...pub, items, stars: fb?.stars ?? 0 },
    eta,
    loyalty,
    restaurant: {
      name: r.name,
      whatsapp: r.whatsapp,
      primary_color: r.primary_color,
      pix_key: order.payment === "pix" ? r.pix_key || "" : "",
      google_review_url: r.google_review_url || "",
    },
  });
}
