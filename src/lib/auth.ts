import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDB } from "./db";

const COOKIE = "gia_session";

const g = globalThis as unknown as { __gia_secret?: Promise<Uint8Array> };

/**
 * Chave que assina os logins. Se AUTH_SECRET estiver na Vercel, usa ela.
 * Senão, em produção, o próprio site gera uma chave aleatória forte na primeira vez
 * e guarda no banco (assim ninguém precisa criar senha à mão).
 */
async function loadSecret(): Promise<Uint8Array> {
  if (process.env.AUTH_SECRET) return new TextEncoder().encode(process.env.AUTH_SECRET);
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode("dev-secret-troque-em-producao-0123456789");
  }
  const db = await getDB();
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const fresh = Buffer.from(bytes).toString("base64url");
  await db.query(`INSERT INTO app_settings (key, value) VALUES ('auth_secret', $1) ON CONFLICT (key) DO NOTHING`, [fresh]);
  const rows = await db.query<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'auth_secret'`);
  return new TextEncoder().encode(rows[0].value);
}

function secret(): Promise<Uint8Array> {
  if (!g.__gia_secret) {
    g.__gia_secret = loadSecret().catch((e) => {
      g.__gia_secret = undefined;
      throw e;
    });
  }
  return g.__gia_secret;
}

/** Cria o login neste aparelho. A "versão da sessão" muda quando o dono troca a senha ou sai de todos os aparelhos. */
export async function createSession(restaurantId: string) {
  const db = await getDB();
  const [row] = await db.query<{ session_version: number }>(`SELECT session_version FROM restaurants WHERE id=$1`, [restaurantId]);
  const token = await new SignJWT({ rid: restaurantId, sv: row?.session_version ?? 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(await secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getRestaurantId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret());
    if (typeof payload.rid !== "string") return null;
    // login antigo (de antes de trocar a senha ou de "sair de todos os aparelhos") deixa de valer
    const db = await getDB();
    const [row] = await db.query<{ session_version: number }>(`SELECT session_version FROM restaurants WHERE id=$1`, [payload.rid]);
    if (!row || (Number(payload.sv) || 1) !== row.session_version) return null;
    return payload.rid;
  } catch {
    return null;
  }
}

/** Derruba todos os logins da conta (o aparelho atual entra de novo em seguida, se quiser). */
export async function bumpSessions(restaurantId: string) {
  const db = await getDB();
  await db.query(`UPDATE restaurants SET session_version = session_version + 1 WHERE id=$1`, [restaurantId]);
}

const COMMON = new Set(["12345678", "123456789", "1234567890", "senha123", "senha1234", "password", "password1", "qwerty123", "abc12345", "11111111", "00000000", "12341234", "87654321", "iloveyou", "restaurante", "cardapio"]);
/** Regra única de senha: 8 caracteres ou mais e nada óbvio. Devolve a mensagem de erro, ou "" se está boa. */
export function passwordProblem(pw: string, email = ""): string {
  if (pw.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (pw.length > 200) return "Senha longa demais.";
  const low = pw.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(pw) || (email && low.includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4))
    return "Essa senha é fácil de adivinhar. Misture palavras, números e símbolos.";
  return "";
}

/** Para rotas do painel: devolve o restaurante logado ou null. */
export async function currentRestaurant() {
  const rid = await getRestaurantId();
  if (!rid) return null;
  const db = await getDB();
  const rows = await db.query(
    `SELECT id, slug, name, email, whatsapp, address, primary_color, delivery_enabled, dine_in_enabled,
            delivery_fee_cents, min_order_cents, ai_name, ai_tone, ai_instructions, plan, trial_ends_at,
            accepting_orders, pix_key, google_review_url, languages, ai_preset, service_pct, loyalty, hours,
            logo_url, cover_url, pickup_enabled, pickup_eta, delivery_eta, delivery_mode, delivery_zones, free_delivery_cents, pix_name, pix_city, pay_methods
       FROM restaurants WHERE id = $1`,
    [rid]
  );
  return rows[0] ?? null;
}
