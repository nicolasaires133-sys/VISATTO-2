// "Esqueci minha senha": manda um link que vale por 1 hora e funciona uma vez só.
// A resposta é sempre a mesma, exista ou não a conta (assim ninguém descobre quais e-mails têm cadastro).
import { createHash, randomBytes } from "node:crypto";
import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { allow, clientIp } from "@/lib/limit";
import { emailEnabled, sendEmail, simpleEmail } from "@/lib/email";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Digite o e-mail da conta.");
  if (!emailEnabled() && process.env.NODE_ENV === "production")
    return fail("A recuperação por e-mail ainda não foi ligada neste site. Fale com o suporte do Visatto.", 503);
  if (!(await allow(`forgot:ip:${clientIp(req)}`, 10, 3600)) || !(await allow(`forgot:e:${email}`, 3, 3600)))
    return fail("Muitos pedidos seguidos. Confira sua caixa de entrada (e o spam) e tente de novo mais tarde.", 429);

  const db = await getDB();
  const [r] = await db.query<{ id: string; name: string }>(`SELECT id, name FROM restaurants WHERE email=$1`, [email]);
  if (r) {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await db.query(`DELETE FROM password_resets WHERE restaurant_id=$1 AND (used_at IS NOT NULL OR expires_at < NOW())`, [r.id]);
    await db.query(`INSERT INTO password_resets (token_hash, restaurant_id, expires_at) VALUES ($1,$2, NOW() + INTERVAL '1 hour')`, [hash, r.id]);
    const origin = process.env.APP_URL || new URL(req.url).origin;
    const link = `${origin}/redefinir-senha?token=${token}`;
    const mail = simpleEmail(
      "Crie uma senha nova",
      [`Recebemos um pedido para trocar a senha do painel do ${r.name} no Visatto.`, "O link vale por 1 hora e funciona uma vez só. Se não foi você, ignore este e-mail: sua senha continua a mesma."],
      { label: "Criar senha nova", url: link }
    );
    await sendEmail(email, "Sua senha do Visatto", mail.html, mail.text);
  }
  return ok({ ok: true });
}
