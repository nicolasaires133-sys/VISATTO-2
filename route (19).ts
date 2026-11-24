import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";

// Cria um link (QR) para escanear este prato pelo celular sem precisar fazer login nele. Vale 3 horas.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const db = await getDB();
  const [item] = await db.query(`SELECT id FROM items WHERE id=$1 AND restaurant_id=$2`, [id, r.id]);
  if (!item) return fail("Prato não encontrado.", 404);
  await db.query(`DELETE FROM scan_sessions WHERE expires_at < NOW()`);
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Buffer.from(bytes).toString("base64url");
  await db.query(`INSERT INTO scan_sessions (token, restaurant_id, item_id, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '3 hours')`, [token, r.id, id]);
  return ok({ token, path: `/escanear/${token}` });
}
