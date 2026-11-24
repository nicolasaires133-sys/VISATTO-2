import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDB } from "./db";

const COOKIE = "gia_session";

function secret() {
  if (!process.env.AUTH_SECRET && process.env.VERCEL) {
    throw new Error("Configure a variável AUTH_SECRET no projeto da Vercel.");
  }
  const s = process.env.AUTH_SECRET || "dev-secret-troque-em-producao-0123456789";
  return new TextEncoder().encode(s);
}

export async function createSession(restaurantId: string) {
  const token = await new SignJWT({ rid: restaurantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
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
    const { payload } = await jwtVerify(token, secret());
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
            accepting_orders, pix_key
       FROM restaurants WHERE id = $1`,
    [rid]
  );
  return rows[0] ?? null;
}
