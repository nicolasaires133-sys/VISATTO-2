import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";

// Marca o chamado da mesa como atendido
export async function PUT(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  await (await getDB()).query(`UPDATE calls SET status='atendido', done_at=NOW() WHERE id=$1 AND restaurant_id=$2`, [id, r.id]);
  return ok({ ok: true });
}
