// Previsão de quando o pedido fica pronto, com o histórico do próprio restaurante.
// Sem histórico ainda, usa um tempo padrão; com a cozinha cheia, soma um pouco por pedido na frente.
import { getDB } from "./db";

const DEFAULT_MIN = { mesa: 20, delivery: 45 };

export async function estimateMinutes(restaurantId: string, channel: "mesa" | "delivery", createdAt: string) {
  const db = await getDB();
  const end = channel === "delivery" ? "done_at" : "ready_at";
  const rows = await db.query<{ m: number }>(
    `SELECT EXTRACT(EPOCH FROM (${end} - created_at)) / 60 AS m FROM orders
      WHERE restaurant_id=$1 AND channel=$2 AND ${end} IS NOT NULL AND created_at > NOW() - INTERVAL '45 days'
      ORDER BY created_at DESC LIMIT 60`,
    [restaurantId, channel]
  );
  const mins = rows.map((r) => Number(r.m)).filter((m) => m > 1 && m < 180).sort((a, b) => a - b);
  // mediana (não deixa um pedido esquecido aberto puxar a média)
  const base = mins.length >= 5 ? mins[Math.floor(mins.length / 2)] : DEFAULT_MIN[channel];
  const [q] = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM orders WHERE restaurant_id=$1 AND status IN ('novo','preparo') AND created_at < $2::timestamptz AND created_at > NOW() - INTERVAL '6 hours'`,
    [restaurantId, createdAt]
  );
  const ahead = Math.max(0, (q?.n ?? 0) - 2);
  return { minutes: Math.round(base + Math.min(25, ahead * 2)), learned: mins.length >= 5 };
}
