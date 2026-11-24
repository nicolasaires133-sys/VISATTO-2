import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";

// Pedidos das últimas 24h (ou ativos), com itens. O painel consulta a cada poucos segundos.
export async function GET() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const db = await getDB();
  const orders = await db.query(
    `SELECT id, number, channel, table_label, customer_name, customer_phone, address, notes, status,
            subtotal_cents, delivery_fee_cents, total_cents, ai_cents, created_at, updated_at, payment, change_for_cents
       FROM orders
      WHERE restaurant_id=$1
        AND (created_at > NOW() - INTERVAL '24 hours' OR status IN ('novo','preparo','pronto','saiu'))
      ORDER BY created_at DESC
      LIMIT 200`,
    [r.id]
  );
  const ids = orders.map((o) => o.id);
  const items = ids.length
    ? await db.query(
        `SELECT order_id, name, qty, notes, price_cents, via_ai FROM order_items WHERE order_id = ANY($1::text[])`,
        [ids]
      )
    : [];
  const byOrder = new Map<string, any[]>();
  for (const it of items) {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id)!.push(it);
  }
  // chamados das mesas ("chamar atendente" / "pedir a conta") ainda abertos
  const calls = await db.query(
    `SELECT id, table_label, type, reason, created_at FROM calls
      WHERE restaurant_id=$1 AND status='aberto' AND created_at > NOW() - INTERVAL '6 hours'
      ORDER BY created_at`,
    [r.id]
  );
  return ok({ orders: orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] })), calls });
}
