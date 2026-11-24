import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";

// Fecha a mesa: a conta foi paga, os pedidos saem da "conta aberta" e os avisos de pagamento somem.
export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const table = String(b.table || "").trim().slice(0, 20);
  if (!table) return fail("Informe a mesa.");
  const db = await getDB();
  const rows = await db.query(
    `UPDATE orders SET closed_at=NOW() WHERE restaurant_id=$1 AND channel='mesa' AND lower(table_label)=lower($2) AND closed_at IS NULL RETURNING id`,
    [r.id, table]
  );
  await db.query(
    `UPDATE calls SET status='atendido', done_at=NOW() WHERE restaurant_id=$1 AND lower(table_label)=lower($2) AND type='conta' AND status='aberto'`,
    [r.id, table]
  );
  return ok({ closed: rows.length });
}
