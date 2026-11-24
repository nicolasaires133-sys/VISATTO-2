import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";

const VALID = ["novo", "preparo", "pronto", "saiu", "entregue", "cancelado"];

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  if (!VALID.includes(b.status)) return fail("Status inválido.");
  const db = await getDB();
  // guarda a hora de cada etapa: é com isso que o cardápio prevê quando o próximo pedido fica pronto
  const stamp =
    b.status === "preparo" ? ", accepted_at=COALESCE(accepted_at, NOW())" :
    b.status === "pronto" || b.status === "saiu" ? ", accepted_at=COALESCE(accepted_at, NOW()), ready_at=COALESCE(ready_at, NOW())" :
    b.status === "entregue" ? ", ready_at=COALESCE(ready_at, NOW()), done_at=COALESCE(done_at, NOW())" : "";
  await db.query(`UPDATE orders SET status=$3, updated_at=NOW()${stamp} WHERE id=$1 AND restaurant_id=$2`, [id, r.id, b.status]);
  return ok({ ok: true });
}
