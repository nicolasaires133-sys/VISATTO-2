// O cliente da mesa chama um atendente ou pede a conta. Aparece na hora no painel de pedidos.
import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  if (!r.dine_in_enabled) return fail("Atendimento na mesa desativado.");
  const b = await req.json().catch(() => ({}));
  const type = b.type === "conta" ? "conta" : "atendente";
  const table = String(b.table || "").trim().slice(0, 20);
  if (!table) return fail("Informe o número da mesa.");
  const db = await getDB();
  // já existe um chamado igual aberto para essa mesa? não duplica
  const [open] = await db.query<{ id: string }>(
    `SELECT id FROM calls WHERE restaurant_id=$1 AND table_label=$2 AND type=$3 AND status='aberto' AND created_at > NOW() - INTERVAL '20 minutes'`,
    [r.id, table, type]
  );
  if (open) return ok({ id: open.id, repeated: true });
  if (!(await allow(`call:${r.id}:${clientIp(req)}`, 30, 600))) return fail("Muitos chamados seguidos. Aguarde um instante.", 429);
  const id = newId();
  await db.query(`INSERT INTO calls (id, restaurant_id, table_label, type) VALUES ($1,$2,$3,$4)`, [id, r.id, table, type]);
  return ok({ id });
}
