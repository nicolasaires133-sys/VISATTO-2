// Trocar a senha estando logado. Os outros aparelhos saem; este continua conectado.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { bumpSessions, createSession, passwordProblem } from "@/lib/auth";
import { allow } from "@/lib/limit";

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  if (!(await allow(`pw:${r.id}`, 10, 3600))) return fail("Muitas tentativas. Tente mais tarde.", 429);
  const db = await getDB();
  const [row] = await db.query<{ password_hash: string }>(`SELECT password_hash FROM restaurants WHERE id=$1`, [r.id]);
  if (!row || !(await bcrypt.compare(String(b.current || ""), row.password_hash))) return fail("A senha atual está errada.");
  const next = String(b.next || "");
  const problem = passwordProblem(next, r.email);
  if (problem) return fail(problem);
  await db.query(`UPDATE restaurants SET password_hash=$2 WHERE id=$1`, [r.id, await bcrypt.hash(next, 10)]);
  await bumpSessions(r.id);
  await createSession(r.id);
  return ok({ ok: true });
}
