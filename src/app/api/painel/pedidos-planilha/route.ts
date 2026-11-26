// Planilha (CSV, abre no Excel e no Google Planilhas) com os pedidos de um período, item por item.
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner } from "@/lib/http";

export async function GET(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 30));
  const db = await getDB();
  const rows = await db.query<any>(
    `SELECT o.number, to_char(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS dia, to_char(o.created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS hora,
            o.channel, o.table_label, o.customer_name, o.status, o.payment, o.total_cents, o.delivery_fee_cents,
            oi.name AS item, oi.qty, oi.price_cents, oi.notes
       FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.restaurant_id=$1 AND o.created_at > NOW() - ($2 || ' days')::interval
      ORDER BY o.created_at DESC, oi.name`,
    [r.id, String(days)]
  );
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const money = (c: number) => ((c || 0) / 100).toFixed(2).replace(".", ",");
  const STATUS: Record<string, string> = { novo: "Novo", preparo: "Preparando", pronto: "Pronto", saiu: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };
  const PAY: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };
  const head = "Pedido;Data;Hora;Onde;Mesa;Cliente;Situação;Pagamento;Total do pedido (R$);Taxa de entrega (R$);Item;Qtd;Preço unitário (R$);Escolhas e observações";
  const body = rows.map((x) =>
    [x.number, x.dia, x.hora, x.channel === "mesa" ? "Mesa" : "Entrega", esc(x.table_label), esc(x.customer_name), STATUS[x.status] ?? x.status, PAY[x.payment] ?? "", money(x.total_cents), money(x.delivery_fee_cents), esc(x.item), x.qty ?? "", x.price_cents != null ? money(x.price_cents) : "", esc(x.notes)].join(";")
  );
  return new NextResponse("﻿" + [head, ...body].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pedidos-${days}-dias.csv"`, "Cache-Control": "no-store" },
  });
}
