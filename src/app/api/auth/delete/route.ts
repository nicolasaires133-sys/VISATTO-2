// Exclui a conta e tudo dela: cardápio, fotos, modelos 3D, pedidos e dados dos clientes (LGPD).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { clearSession } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 60;

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  if (String(b.confirm || "").trim().toUpperCase() !== "EXCLUIR") return fail("Digite EXCLUIR para confirmar.");
  const db = await getDB();
  const [row] = await db.query<{ password_hash: string }>(`SELECT password_hash FROM restaurants WHERE id=$1`, [r.id]);
  if (!row || !(await bcrypt.compare(String(b.password || ""), row.password_hash))) return fail("A senha está errada.");
  const files = await db.query<{ image: string; model_glb: string; model_usdz: string }>(
    `SELECT image, model_glb_url AS model_glb, model_usdz_url AS model_usdz FROM items WHERE restaurant_id=$1`,
    [r.id]
  );
  for (const f of files) for (const url of [f.image, f.model_glb, f.model_usdz]) await deleteFile(url).catch(() => {});
  await db.query(`DELETE FROM restaurants WHERE id=$1`, [r.id]);
  await clearSession();
  return ok({ ok: true });
}
