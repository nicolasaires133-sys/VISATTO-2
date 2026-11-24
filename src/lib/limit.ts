// Limite de tentativas guardado no banco (funciona na Vercel, onde cada requisição pode cair numa máquina diferente).
import { getDB } from "./db";

export function clientIp(req: Request) {
  const f = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  return f.split(",")[0].trim().slice(0, 60) || "local";
}

/** Quantas vezes essa chave foi usada na janela (sem registrar). */
export async function countRecent(key: string, windowSec: number) {
  const db = await getDB();
  const [row] = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM rate_limits WHERE key=$1 AND at > NOW() - ($2::int * INTERVAL '1 second')`,
    [key, windowSec]
  );
  return Number(row?.n || 0);
}

export async function hit(key: string) {
  const db = await getDB();
  await db.query(`INSERT INTO rate_limits (key) VALUES ($1)`, [key]);
  // limpeza ocasional do que já venceu
  if (Math.random() < 0.02) db.query(`DELETE FROM rate_limits WHERE at < NOW() - INTERVAL '1 day'`).catch(() => {});
}

/** true = pode seguir (e conta o uso); false = passou do limite. */
export async function allow(key: string, max: number, windowSec: number) {
  if ((await countRecent(key, windowSec)) >= max) return false;
  await hit(key);
  return true;
}
