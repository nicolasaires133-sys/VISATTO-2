import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";

const TYPES = ["visit", "view3d", "ar"];
const seen = new Map<string, number>();

// Registra quando o cliente abre o prato em 3D ou na câmera (AR). Usado nos Resultados do dono.
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const type = String(b.type || "");
  if (!TYPES.includes(type)) return fail("Evento inválido.");
  const session = String(b.sessionId || "").slice(0, 64);
  const itemId = String(b.itemId || "").slice(0, 64);
  // no máximo 1 evento igual por sessão a cada 30 s
  if (!session) return fail("Sessão inválida.");
  const key = `${slug}:${session}:${itemId}:${type}`;
  const now = Date.now();
  if ((seen.get(key) || 0) > now - (type === "visit" ? 6 * 3600_000 : 30_000)) return ok({ ok: true });
  seen.set(key, now);
  if (seen.size > 5000) seen.clear();

  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const db = await getDB();
  if (type !== "visit") {
    const [item] = await db.query(`SELECT id FROM items WHERE id=$1 AND restaurant_id=$2`, [itemId, r.id]);
    if (!item) return fail("Prato não encontrado.", 404);
  }
  await db.query(`INSERT INTO events (id, restaurant_id, item_id, session_id, type) VALUES ($1,$2,$3,$4,$5)`, [
    newId(),
    r.id,
    type === "visit" ? null : itemId,
    session,
    type,
  ]);
  return ok({ ok: true });
}
