// Nota do cliente depois do pedido. Uma por pedido; devolve o link de avaliação do Google (para qualquer nota).
import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const b = await req.json().catch(() => ({}));
  const stars = Math.round(Number(b.stars));
  if (!(stars >= 1 && stars <= 5)) return fail("Escolha de 1 a 5 estrelas.");
  const comment = String(b.comment || "").trim().slice(0, 600);
  if (!(await allow(`fb:${r.id}:${clientIp(req)}`, 20, 3600))) return fail("Muitas avaliações seguidas. Tente mais tarde.", 429);
  const db = await getDB();
  const [order] = await db.query<{ id: string }>(`SELECT id FROM orders WHERE id=$1 AND restaurant_id=$2`, [id, r.id]);
  if (!order) return fail("Pedido não encontrado.", 404);
  await db.query(
    `INSERT INTO feedback (id, restaurant_id, order_id, stars, comment) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (order_id) DO UPDATE SET stars = EXCLUDED.stars, comment = CASE WHEN EXCLUDED.comment <> '' THEN EXCLUDED.comment ELSE feedback.comment END`,
    [newId(), r.id, id, stars, comment]
  );
  // o convite para o Google vai para todo mundo, com qualquer nota (filtrar só as boas é proibido pelo Google)
  return ok({ ok: true, review: r.google_review_url || "" });
}
