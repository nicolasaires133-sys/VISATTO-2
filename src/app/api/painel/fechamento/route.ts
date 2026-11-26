// Fechamento do dia: pedidos, faturamento, ticket médio, formas de pagamento e pratos mais vendidos.
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";

export async function GET(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const q = new URL(req.url).searchParams.get("dia") || "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const db = await getDB();
  const where = `restaurant_id=$1 AND status <> 'cancelado' AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date`;
  const [t] = await db.query<{ orders: number; revenue: number; fees: number; mesa: number; entrega: number; canceled: number }>(
    `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_cents),0)::int AS revenue, COALESCE(SUM(delivery_fee_cents),0)::int AS fees,
            COUNT(*) FILTER (WHERE channel='mesa')::int AS mesa, COUNT(*) FILTER (WHERE channel<>'mesa')::int AS entrega,
            (SELECT COUNT(*)::int FROM orders WHERE restaurant_id=$1 AND status='cancelado' AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date) AS canceled
       FROM orders WHERE ${where}`,
    [r.id, day]
  );
  const pay = await db.query<{ payment: string; n: number; total: number }>(
    `SELECT COALESCE(NULLIF(payment,''), CASE WHEN channel='mesa' THEN 'mesa' ELSE 'outro' END) AS payment, COUNT(*)::int AS n, COALESCE(SUM(total_cents),0)::int AS total
       FROM orders WHERE ${where} GROUP BY 1 ORDER BY 3 DESC`,
    [r.id, day]
  );
  const top = await db.query<{ name: string; qty: number; total: number }>(
    `SELECT oi.name, SUM(oi.qty)::int AS qty, SUM(oi.qty * oi.price_cents)::int AS total
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id=$1 AND o.status <> 'cancelado' AND (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date = $2::date
      GROUP BY oi.name ORDER BY 2 DESC, 3 DESC LIMIT 5`,
    [r.id, day]
  );
  const [peak] = await db.query<{ h: number; n: number }>(
    `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int AS h, COUNT(*)::int AS n FROM orders WHERE ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
    [r.id, day]
  );
  return ok({ day, ...t, avg: t.orders ? Math.round(t.revenue / t.orders) : 0, payments: pay, top, peak: peak ?? null, name: r.name });
}
