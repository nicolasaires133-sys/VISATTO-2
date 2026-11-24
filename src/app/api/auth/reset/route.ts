// Troca a senha com o link do e-mail. Derruba todos os logins antigos e já entra neste aparelho.
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { bumpSessions, createSession, passwordProblem } from "@/lib/auth";
import { allow, clientIp } from "@/lib/limit";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").slice(0, 100);
  const password = String(b.password || "");
  if (!(await allow(`reset:${clientIp(req)}`, 20, 3600))) return fail("Muitas tentativas. Tente mais tarde.", 429);
  const db = await getDB();
  const hash = createHash("sha256").update(token).digest("hex");
  const [row] = await db.query<{ restaurant_id: string; email: string }>(
    `SELECT p.restaurant_id, r.email FROM password_resets p JOIN restaurants r ON r.id = p.restaurant_id
      WHERE p.token_hash=$1 AND p.used_at IS NULL AND p.expires_at > NOW()`,
    [hash]
  );
  if (!row) return fail("Este link venceu ou já foi usado. Peça um novo em “Esqueci minha senha”.", 400);
  const problem = passwordProblem(password, row.email);
  if (problem) return fail(problem);
  await db.query(`UPDATE restaurants SET password_hash=$2 WHERE id=$1`, [row.restaurant_id, await bcrypt.hash(password, 10)]);
  await db.query(`UPDATE password_resets SET used_at=NOW() WHERE restaurant_id=$1 AND used_at IS NULL`, [row.restaurant_id]);
  await bumpSessions(row.restaurant_id);
  await createSession(row.restaurant_id);
  return ok({ ok: true });
}
