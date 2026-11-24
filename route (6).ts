import bcrypt from "bcryptjs";
import { getDB } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { clientIp, countRecent, hit } from "@/lib/limit";

// Proteção contra tentativas repetidas de senha: por e-mail e por aparelho/rede
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(body.password || "").slice(0, 200);
  const kEmail = `login:e:${email}`, kIp = `login:ip:${clientIp(req)}`;
  if ((await countRecent(kEmail, 600)) >= 8 || (await countRecent(kIp, 600)) >= 40)
    return fail("Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);
  const db = await getDB();
  const rows = await db.query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM restaurants WHERE email = $1`,
    [email]
  );
  const r = rows[0];
  if (!r || !(await bcrypt.compare(password, r.password_hash))) {
    await hit(kEmail);
    await hit(kIp);
    return fail("E-mail ou senha incorretos.", 401);
  }
  await createSession(r.id);
  return ok({ ok: true });
}
