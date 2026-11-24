// Lista (CSV) dos clientes que aceitaram receber novidades pelo WhatsApp. Só quem marcou a caixa entra.
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner } from "@/lib/http";

export async function GET() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const db = await getDB();
  const rows = await db.query<{ name: string; phone: string; orders: number; last: string; spent: number }>(
    `SELECT MAX(customer_name) AS name, customer_phone AS phone, COUNT(*)::int AS orders,
            to_char(MAX(created_at), 'DD/MM/YYYY') AS last, COALESCE(SUM(total_cents),0)::int AS spent
       FROM orders
      WHERE restaurant_id=$1 AND marketing_optin AND customer_phone <> '' AND status <> 'cancelado'
      GROUP BY customer_phone ORDER BY MAX(created_at) DESC`,
    [r.id]
  );
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["Nome;WhatsApp;Pedidos;Último pedido;Total gasto (R$)", ...rows.map((x) => [esc(x.name), esc(x.phone), x.orders, x.last, (x.spent / 100).toFixed(2).replace(".", ",")].join(";"))].join("\r\n");
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clientes-${r.slug}.csv"` },
  });
}
