import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { scanSession } from "@/lib/actor";
import { meshyEnabled } from "@/lib/meshy";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await scanSession(token);
  if (!s) return fail("Este link expirou ou não existe. Gere um novo QR no painel do Visatto.", 404);
  const db = await getDB();
  const [item] = await db.query(`SELECT id, name, image, model_status, model_published FROM items WHERE id=$1`, [s.item_id]);
  const [rest] = await db.query(`SELECT name, slug, primary_color FROM restaurants WHERE id=$1`, [s.restaurant_id]);
  if (!item || !rest) return fail("Prato não encontrado.", 404);
  return ok({ item, restaurant: rest, meshyEnabled: meshyEnabled() });
}
