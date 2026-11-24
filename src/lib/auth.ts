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

export async function createSession(restaurantId: string) {
  const token = await new SignJWT({ rid: restaurantId })
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
    return typeof payload.rid === "string" ? payload.rid : null;
  } catch {
    return null;
  }
}

/** Para rotas do painel: devolve o restaurante logado ou null. */
export async function currentRestaurant() {
  const rid = await getRestaurantId();
  if (!rid) return null;
  const db = await getDB();
  const rows = await db.query(
    `SELECT id, slug, name, email, whatsapp, address, primary_color, delivery_enabled, dine_in_enabled,
            delivery_fee_cents, min_order_cents, ai_name, ai_tone, ai_instructions, plan, trial_ends_at,
            accepting_orders, pix_key, google_review_url, languages, ai_preset
       FROM restaurants WHERE id = $1`,
    [rid]
  );
  return rows[0] ?? null;
}
