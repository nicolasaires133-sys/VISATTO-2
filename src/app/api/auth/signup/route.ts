import bcrypt from "bcryptjs";
import { getDB, newId } from "@/lib/db";
import { createSession, passwordProblem } from "@/lib/auth";
import { ok, fail, slugify } from "@/lib/http";
import { allow, clientIp } from "@/lib/limit";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
  if (name.length < 2) return fail("Informe o nome do restaurante.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("E-mail inválido.");
  const pwErr = passwordProblem(password, email);
  if (pwErr) return fail(pwErr);
  if (!body.acceptTerms) return fail("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");

  if (password.length > 200 || name.length > 80) return fail("Dados inválidos.");
  if (!(await allow(`signup:${clientIp(req)}`, 6, 3600))) return fail("Muitos cadastros seguidos. Tente de novo mais tarde.", 429);

  const db = await getDB();
  const exists = await db.query(`SELECT 1 FROM restaurants WHERE email = $1`, [email]);
  if (exists.length) return fail("Já existe uma conta com esse e-mail.");

  let slug = slugify(name);
  const taken = await db.query<{ slug: string }>(`SELECT slug FROM restaurants WHERE slug LIKE $1`, [`${slug}%`]);
  if (taken.some((t) => t.slug === slug)) {
    let n = 2;
    while (taken.some((t) => t.slug === `${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const id = newId();
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO restaurants (id, slug, name, email, password_hash, whatsapp, trial_ends_at, terms_accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW() + INTERVAL '14 days', NOW())`,
    [id, slug, name, email, hash, whatsapp]
  );
  await createSession(id);
  return ok({ id, slug });
}
