import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const db = await getDB();
  const [order] = await db.query(
    `SELECT id, number, channel, table_label, status, subtotal_cents, delivery_fee_cents, total_cents, created_at, updated_at,
            payment, change_for_cents
       FROM orders WHERE id=$1 AND restaurant_id=$2`,
    [id, r.id]
  );
  if (!order) return fail("Pedido não encontrado.", 404);
  const items = await db.query(`SELECT name, qty, notes, price_cents FROM order_items WHERE order_id=$1`, [id]);
  const [fb] = await db.query<{ stars: number }>(`SELECT stars FROM feedback WHERE order_id=$1`, [id]);
  return ok({
    order: { ...order, items, stars: fb?.stars ?? 0 },
    restaurant: { name: r.name, whatsapp: r.whatsapp, primary_color: r.primary_color, pix_key: order.payment === "pix" ? r.pix_key || "" : "" },
  });
}
