import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { loadMenu, restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";
import { toCents } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const b = await req.json().catch(() => ({}));

  if (r.accepting_orders === false) return fail("O restaurante não está recebendo pedidos pelo celular agora. Chame um atendente.");
  // freio contra envio em massa (o limite é folgado: o Wi-Fi do salão é compartilhado por todas as mesas)
  if (!(await allow(`order:${r.id}:${clientIp(req)}`, 60, 600))) return fail("Muitos pedidos seguidos deste aparelho. Aguarde um pouco e tente de novo.", 429);

  const channel = b.channel === "delivery" ? "delivery" : "mesa";
  if (channel === "delivery" && !r.delivery_enabled) return fail("Este restaurante não está fazendo entregas agora.");
  if (channel === "mesa" && !r.dine_in_enabled) return fail("Pedidos na mesa estão desativados.");

  const name = String(b.name || "").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/\D/g, "").slice(0, 15);
  const address = String(b.address || "").trim().slice(0, 300);
  const table = String(b.table || "").trim().slice(0, 20);
  const notes = String(b.notes || "").trim().slice(0, 300);
  const sessionId = String(b.sessionId || "").slice(0, 64);
  if (channel === "delivery" && (!name || phone.length < 10 || address.length < 8))
    return fail("Para entrega, informe nome, telefone com DDD e endereço completo.");
  if (channel === "mesa" && !table) return fail("Informe o número da mesa.");
  const payment = channel === "delivery" && ["pix", "cartao", "dinheiro"].includes(b.payment) ? String(b.payment) : "";
  if (channel === "delivery" && !payment) return fail("Escolha a forma de pagamento.");
  const changeFor = payment === "dinheiro" ? Math.min(100_000_00, toCents(b.changeFor ?? 0)) : 0;

  // Preços sempre recalculados no servidor
  const { items } = await loadMenu(r.id, { withImages: false });
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines = (Array.isArray(b.items) ? b.items : [])
    .slice(0, 50)
    .map((l: any) => ({ item: byId.get(String(l.itemId)), qty: Math.min(50, Math.max(1, Number(l.qty) || 1)), notes: String(l.notes || "").slice(0, 200), viaAi: Boolean(l.viaAi) }))
    .filter((l: any) => l.item);
  if (!lines.length) return fail("Seu carrinho está vazio.");
  const unavailable = lines.filter((l: any) => !l.item.available);
  if (unavailable.length) return fail(`Esgotado no momento: ${unavailable.map((l: any) => l.item.name).join(", ")}.`);

  const subtotal = lines.reduce((s: number, l: any) => s + l.item.price_cents * l.qty, 0);
  const aiCents = lines.filter((l: any) => l.viaAi).reduce((s: number, l: any) => s + l.item.price_cents * l.qty, 0);
  if (changeFor && changeFor < subtotal) return fail("O valor do troco precisa ser maior que o total do pedido.");
  if (channel === "delivery" && r.min_order_cents && subtotal < r.min_order_cents)
    return fail(`Pedido mínimo para entrega: R$ ${(r.min_order_cents / 100).toFixed(2).replace(".", ",")}.`);
  const fee = channel === "delivery" ? r.delivery_fee_cents : 0;

  const db = await getDB();
  const id = newId();
  // Número sequencial por restaurante; se dois pedidos chegarem juntos, o índice único força nova tentativa
  let n = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.query<{ n: number }>(
      `INSERT INTO orders (id, restaurant_id, number, channel, table_label, customer_name, customer_phone, address, notes,
                           subtotal_cents, delivery_fee_cents, total_cents, ai_cents, session_id, payment, change_for_cents)
       SELECT $1,$2, COALESCE(MAX(number),0) + 1, $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15 FROM orders WHERE restaurant_id=$2
       RETURNING number AS n`,
      [id, r.id, channel, table, name, phone, address, notes, subtotal, fee, subtotal + fee, aiCents, sessionId, payment, changeFor]
    ).catch((e: any) => {
      if (e?.code === "23505" || /duplicate key|unique/i.test(String(e?.message))) return [] as { n: number }[];
      throw e;
    });
    if (row) {
      n = row.n;
      break;
    }
    await new Promise((res) => setTimeout(res, 40 + Math.random() * 120));
  }
  if (!n) return fail("Muitos pedidos ao mesmo tempo. Tente enviar de novo.", 503);

  const values: unknown[] = [];
  const rows = lines.map((l: any, i: number) => {
    values.push(newId(), id, l.item.id, l.item.name, l.item.price_cents, l.qty, l.notes, l.viaAi);
    const b = i * 8;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
  });
  await db.query(`INSERT INTO order_items (id, order_id, item_id, name, price_cents, qty, notes, via_ai) VALUES ${rows.join(",")}`, values);
  return ok({ id, number: n });
}
