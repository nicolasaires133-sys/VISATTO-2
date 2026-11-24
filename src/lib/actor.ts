// Quem está fazendo a requisição: o dono logado (cookie) ou o celular com um link de escaneamento (x-scan-token).
import { NextResponse } from "next/server";
import { getRestaurantId } from "./auth";
import { getDB } from "./db";
import { fail } from "./http";

export type Actor = { restaurantId: string; via: "dono" | "escaneamento"; itemId?: string };

export async function scanSession(token: string) {
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(token)) return null;
  const db = await getDB();
  const [row] = await db.query<{ restaurant_id: string; item_id: string }>(
    `SELECT restaurant_id, item_id FROM scan_sessions WHERE token=$1 AND expires_at > NOW()`,
    [token]
  );
  return row ?? null;
}

/** Autoriza o dono ou um link de escaneamento válido. Se itemId for informado, o link precisa ser desse prato. */
export async function actor(req: Request, itemId?: string): Promise<Actor | NextResponse> {
  const rid = await getRestaurantId();
  if (rid) return { restaurantId: rid, via: "dono" };
  const token = req.headers.get("x-scan-token") || "";
  if (token) {
    const s = await scanSession(token);
    if (!s) return fail("Este link de escaneamento expirou. Gere um novo no painel.", 401);
    if (itemId && s.item_id !== itemId) return fail("Link de escaneamento de outro prato.", 403);
    return { restaurantId: s.restaurant_id, via: "escaneamento", itemId: s.item_id };
  }
  return fail("Faça login para continuar.", 401);
}
