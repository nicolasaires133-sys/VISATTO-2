// Cartão fidelidade por WhatsApp: cada pedido entregue (acima do valor mínimo) vale um selo.
// Ao juntar a meta, o prêmio fica liberado; a equipe entrega e marca no painel, e o cartão recomeça.
import { getDB, newId } from "./db";

export type Loyalty = { on: boolean; goal: number; min_cents: number; reward: string };

export function readLoyalty(raw: unknown): Loyalty {
  const o = (typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {}) as Partial<Loyalty>;
  return {
    on: Boolean(o.on) && Boolean(String(o.reward || "").trim()),
    goal: Math.min(30, Math.max(3, Number(o.goal) || 10)),
    min_cents: Math.max(0, Number(o.min_cents) || 0),
    reward: String(o.reward || "").trim().slice(0, 80),
  };
}

/** Só os dígitos, com DDD e sem o 55 do país. */
export const cleanPhone = (s: string) => {
  const d = String(s || "").replace(/\D/g, "");
  return (d.length >= 12 && d.startsWith("55") ? d.slice(2) : d).slice(0, 11);
};

/** Selos do telefone desde o último prêmio entregue. */
export async function stampsOf(restaurantId: string, phone: string, l: Loyalty) {
  const p = cleanPhone(phone);
  if (p.length < 10) return { stamps: 0, ready: false, lastReward: null as string | null };
  const db = await getDB();
  const [last] = await db.query<{ created_at: string }>(
    `SELECT created_at FROM loyalty_redemptions WHERE restaurant_id=$1 AND phone=$2 ORDER BY created_at DESC LIMIT 1`,
    [restaurantId, p]
  );
  const [row] = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders
      WHERE restaurant_id=$1 AND customer_phone IN ($2, $3) AND status='entregue' AND total_cents >= $4
        AND created_at > COALESCE($5::timestamptz, 'epoch'::timestamptz)`,
    [restaurantId, p, `55${p}`, l.min_cents, last?.created_at ?? null]
  );
  const stamps = Math.min(l.goal, row?.n ?? 0);
  return { stamps, ready: stamps >= l.goal, lastReward: last?.created_at ?? null };
}

export async function redeem(restaurantId: string, phone: string, orderId = "") {
  const db = await getDB();
  await db.query(`INSERT INTO loyalty_redemptions (id, restaurant_id, phone, order_id) VALUES ($1,$2,$3,$4)`, [newId(), restaurantId, cleanPhone(phone), orderId]);
}
