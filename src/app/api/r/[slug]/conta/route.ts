// Conta da mesa: tudo o que a mesa pediu desde que foi aberta, para conferir, dividir e pagar.
// GET mostra a conta; POST avisa a equipe como a pessoa vai pagar (Pix já feito, cartão ou dinheiro).
import { getDB, newId } from "@/lib/db";
import { ok, fail, toCents } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";
import { cityFrom, pixPayload } from "@/lib/pix";
import { brl } from "@/lib/format";
import { DEMO_SLUG } from "@/lib/demo";

// No cardápio de exemplo o Pix é só demonstração: a chave "zerada" não existe em banco nenhum
const DEMO_KEY = "00000000-0000-0000-0000-000000000000";

async function openOrders(restaurantId: string, table: string) {
  const db = await getDB();
  // a mesa "abre" no primeiro pedido ainda não fechado das últimas 12 horas
  return db.query<{ id: string; number: number; status: string; total_cents: number; created_at: string }>(
    `SELECT id, number, status, total_cents, created_at FROM orders
      WHERE restaurant_id=$1 AND channel='mesa' AND lower(table_label)=lower($2) AND closed_at IS NULL
        AND status <> 'cancelado' AND created_at > NOW() - INTERVAL '12 hours'
      ORDER BY created_at`,
    [restaurantId, table]
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const table = (new URL(req.url).searchParams.get("mesa") || "").trim().slice(0, 20);
  if (!table) return fail("Informe o número da mesa.");
  if (!(await allow(`conta:${r.id}:${clientIp(req)}`, 120, 600))) return fail("Muitas consultas seguidas. Aguarde um instante.", 429);
  const orders = await openOrders(r.id, table);
  const db = await getDB();
  const items = orders.length
    ? await db.query<{ id: string; order_id: string; name: string; qty: number; price_cents: number; notes: string }>(
        `SELECT id, order_id, name, qty, price_cents, notes FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY order_id, id`,
        [orders.map((o) => o.id)]
      )
    : [];
  const [pending] = await db.query<{ amount_cents: number; method: string; created_at: string }>(
    `SELECT amount_cents, method, created_at FROM calls WHERE restaurant_id=$1 AND lower(table_label)=lower($2) AND type='conta' AND status='aberto' AND created_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 1`,
    [r.id, table]
  );
  const subtotal = orders.reduce((s, o) => s + o.total_cents, 0);
  return ok({
    table,
    orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, created_at: o.created_at })),
    items,
    subtotal_cents: subtotal,
    service_pct: Math.min(20, Math.max(0, Number(r.service_pct ?? 10))),
    pix: Boolean(r.pix_key) || slug === DEMO_SLUG,
    demo: slug === DEMO_SLUG && !r.pix_key,
    pending: pending ?? null,
    restaurant: { name: r.name, primary_color: r.primary_color, google_review_url: r.google_review_url || "" },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const b = await req.json().catch(() => ({}));
  const table = String(b.table || "").trim().slice(0, 20);
  if (!table) return fail("Informe o número da mesa.");
  if (!(await allow(`contapay:${r.id}:${clientIp(req)}`, 20, 600))) return fail("Muitos avisos seguidos. Aguarde um instante.", 429);
  const orders = await openOrders(r.id, table);
  if (!orders.length) return fail("Não achamos pedidos abertos nesta mesa. Chame um atendente.");
  const amount = Math.max(0, Math.min(100_000_00, toCents(b.amount ?? 0)));
  if (!amount) return fail("Valor inválido.");
  const method = ["pix", "pix-feito", "cartao", "dinheiro"].includes(b.method) ? String(b.method) : "";
  if (!method) return fail("Escolha como vai pagar.");

  // Pix: só gera o código (com o valor já preenchido); a equipe é avisada quando a pessoa diz que pagou
  if (method === "pix") {
    const key = r.pix_key || (slug === DEMO_SLUG ? DEMO_KEY : "");
    if (!key) return fail("Este restaurante ainda não recebe Pix pela mesa. Chame um atendente.");
    const code = pixPayload({ key, name: r.name, city: cityFrom(r.address || ""), amountCents: amount, txid: `MESA${table}` });
    return ok({ code, amount_cents: amount });
  }
  const people = Math.min(30, Math.max(1, Number(b.people) || 1));
  const part = b.part === true;
  const reason =
    method === "pix-feito"
      ? `Pagou ${brl(amount)} no Pix${part ? " (parte da conta)" : ""}. Confira no banco.`
      : method === "cartao"
        ? `Vai pagar ${brl(amount)} no cartão${part ? " (parte da conta)" : ""}: levar a maquininha.`
        : `Vai pagar ${brl(amount)} em dinheiro${part ? " (parte da conta)" : ""}.`;
  const db = await getDB();
  const id = newId();
  await db.query(
    `INSERT INTO calls (id, restaurant_id, table_label, type, reason, amount_cents, method) VALUES ($1,$2,$3,'conta',$4,$5,$6)`,
    [id, r.id, table, people > 1 ? `${reason} Mesa dividindo em ${people}.` : reason, amount, method]
  );
  return ok({ id, last_order: orders[orders.length - 1].id });
}
