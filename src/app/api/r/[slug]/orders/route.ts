// Recebe o pedido do cliente. Regras para nunca dar prejuízo à loja:
// - preço, promoção, opções, taxa de entrega e total são sempre calculados aqui (o celular só mostra)
// - pedido e itens são gravados juntos (tudo ou nada): nunca existe pedido sem itens
// - o número do pedido é dado em fila (trava por restaurante): nunca repete, nem com muitos pedidos ao mesmo tempo
// - cada envio tem uma chave: clique duplo ou internet que caiu e voltou devolvem o MESMO pedido, sem duplicar
// - se o preço mudou desde que o cliente abriu o cardápio, o pedido não entra e o cliente vê o valor novo
import { getDB, newId } from "@/lib/db";
import { ok, fail, toCents } from "@/lib/http";
import { loadMenu, restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";
import { priceWith } from "@/lib/options";
import { addressProblem, deliveryQuote, formatAddress, readAddress, readMode, readPayMethods } from "@/lib/delivery";

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
type Line = { item: any; qty: number; notes: string; viaAi: boolean; viaSuggest: boolean; opts?: any; unit: number; summary: string };

async function existing(restaurantId: string, key: string) {
  if (!key) return null;
  const db = await getDB();
  const [o] = await db.query<{ id: string; number: number }>(`SELECT id, number FROM orders WHERE restaurant_id=$1 AND client_key=$2`, [restaurantId, key]);
  return o ?? null;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return fail("Não deu para ler o pedido. Tente de novo.");

  // mesmo envio chegando de novo (clique duplo, reenvio depois de a internet cair): devolve o pedido que já entrou
  const clientKey = String(b.clientKey ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  const again = await existing(r.id, clientKey);
  if (again) return ok({ ...again, repeated: true });

  if (r.accepting_orders === false) return fail("O restaurante não está recebendo pedidos pelo celular agora. Chame um atendente.");
  {
    const { readHours, openState } = await import("@/lib/hours");
    const st = openState(readHours(r.hours));
    if (!st.open) return fail(`${st.label}. Os pedidos pelo celular entram só no horário de funcionamento.`);
  }
  // freio contra envio em massa (o limite é folgado: o Wi-Fi do salão é compartilhado por todas as mesas)
  if (!(await allow(`order:${r.id}:${clientIp(req)}`, 60, 600))) return fail("Muitos pedidos seguidos deste aparelho. Aguarde um pouco e tente de novo.", 429);

  const channel = b.channel === "delivery" ? "delivery" : "mesa";
  const pickup = channel === "delivery" && b.pickup === true;
  if (pickup && !r.pickup_enabled) return fail("Este restaurante não está fazendo pedidos para retirar no local agora.");
  if (channel === "delivery" && !pickup && !r.delivery_enabled) return fail("Este restaurante não está fazendo entregas agora.");
  if (channel === "mesa" && !r.dine_in_enabled) return fail("Pedidos na mesa estão desativados.");

  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/\D/g, "").slice(0, 15);
  const table = String(b.table || "").trim().slice(0, 20);
  const notes = String(b.notes || "").trim().slice(0, 300);
  const sessionId = String(b.sessionId || "").slice(0, 64);

  // endereço: o celular manda separado (rua, número, bairro...); versões antigas mandavam uma linha só
  let address = "";
  let addr: ReturnType<typeof readAddress> | null = null;
  let zone = "";
  if (channel === "delivery") {
    if (!name) return fail(pickup ? "Informe seu nome para a loja chamar na retirada." : "Informe seu nome para a entrega.");
    if (phone.length < 10 || phone.length > 13) return fail("Informe um telefone com DDD.");
    if (!pickup) {
      if (b.addr && typeof b.addr === "object") {
        addr = readAddress(b.addr);
        const p = addressProblem(addr);
        if (p) return fail(p);
        address = formatAddress(addr);
      } else {
        address = String(b.address || "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (address.length < 8) return fail("Informe o endereço completo para a entrega.");
      }
      zone = String(b.zone || addr?.district || "").replace(/\s+/g, " ").trim().slice(0, 60);
    }
  } else if (!table) return fail("Informe o número da mesa.");

  const methods = readPayMethods(r.pay_methods);
  const payment = channel === "delivery" && (methods as string[]).includes(b.payment) ? String(b.payment) : "";
  if (channel === "delivery" && !payment) return fail("Escolha a forma de pagamento.");
  const changeFor = payment === "dinheiro" ? Math.min(100_000_00, toCents(b.changeFor ?? 0)) : 0;

  // Itens: preço sempre do cardápio atual
  const { items } = await loadMenu(r.id, { withImages: false });
  const byId = new Map(items.map((i) => [i.id, i]));
  const raw = Array.isArray(b.items) ? b.items : [];
  if (!raw.length) return fail("Seu carrinho está vazio.");
  if (raw.length > 60) return fail("Pedido grande demais para um envio só. Divida em dois pedidos.");
  const lines: Line[] = [];
  const gone: string[] = [];
  for (const l of raw) {
    const item = byId.get(String(l?.itemId ?? ""));
    if (!item) { gone.push(String(l?.name || "um prato")); continue; }
    const q = Math.floor(Number(l.qty));
    if (!Number.isFinite(q) || q < 1) continue;
    lines.push({ item, qty: Math.min(50, q), notes: String(l.notes || "").slice(0, 200), viaAi: Boolean(l.viaAi), viaSuggest: !l.viaAi && Boolean(l.viaSuggest), opts: l.opts && typeof l.opts === "object" ? l.opts : undefined, unit: 0, summary: "" });
  }
  // prato que saiu do cardápio: avisa em vez de mandar o pedido sem ele
  if (gone.length) return fail("Um prato do seu pedido não está mais no cardápio. Atualize a página e confira a sacola.", 409, { code: "menu_changed" });
  if (!lines.length) return fail("Seu carrinho está vazio.");
  const unavailable = lines.filter((l) => !l.item.available);
  if (unavailable.length) return fail(`Esgotado no momento: ${[...new Set(unavailable.map((l) => l.item.name))].join(", ")}. Tire da sacola para continuar.`, 409, { code: "sold_out" });
  const now = new Date();
  for (const l of lines) {
    const p = priceWith(l.item, l.opts, now);
    if (!p.ok) return fail(`${l.item.name}: ${p.error}`);
    l.unit = p.unit;
    l.summary = p.summary;
  }

  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  const aiCents = lines.filter((l) => l.viaAi).reduce((s, l) => s + l.unit * l.qty, 0);
  const suggestCents = lines.filter((l) => l.viaSuggest).reduce((s, l) => s + l.unit * l.qty, 0);
  const lang = ["en", "es"].includes(b.lang) ? String(b.lang) : "pt";
  const optin = channel === "delivery" && Boolean(b.marketingOptin);

  let fee = 0;
  if (channel === "delivery") {
    if (!pickup && r.min_order_cents && subtotal < r.min_order_cents) return fail(`Pedido mínimo para entrega: ${brl(r.min_order_cents)}.`);
    const q = deliveryQuote(r, { pickup, zone, subtotal });
    if (!q.ok) return fail(q.error);
    fee = q.fee;
    if (readMode(r.delivery_mode) !== "bairro") zone = "";
  }
  const total = subtotal + fee;
  if (changeFor && changeFor < total) return fail(`O troco precisa ser para um valor maior que o total (${brl(total)}).`);

  // o cliente viu um total; se mudou (preço, promoção que acabou, taxa), confirma de novo antes de cobrar diferente
  if (b.expectedTotal != null) {
    const seen = Math.round(Number(b.expectedTotal));
    if (Number.isFinite(seen) && seen !== total) return fail(`O valor do pedido mudou para ${brl(total)} (preço ou taxa atualizados). Confira e envie de novo.`, 409, { code: "price_changed", total });
  }

  const db = await getDB();
  const id = newId();
  const saved = await db.tx(async (t) => {
    // fila por restaurante: um pedido de cada vez pega o próximo número
    await t.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`orders:${r.id}`]);
    if (clientKey) {
      const [o] = await t.query<{ id: string; number: number }>(`SELECT id, number FROM orders WHERE restaurant_id=$1 AND client_key=$2`, [r.id, clientKey]);
      if (o) return { ...o, repeated: true };
    }
    const [{ n }] = await t.query<{ n: number }>(`SELECT COALESCE(MAX(number),0)::int + 1 AS n FROM orders WHERE restaurant_id=$1`, [r.id]);
    await t.query(
      `INSERT INTO orders (id, restaurant_id, number, channel, table_label, customer_name, customer_phone, address, notes,
                           subtotal_cents, delivery_fee_cents, total_cents, ai_cents, session_id, payment, change_for_cents,
                           suggest_cents, lang, marketing_optin, pickup, client_key, address_json, zone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23)`,
      [id, r.id, n, channel, table, name, phone, address, notes, subtotal, fee, total, aiCents, sessionId, payment, changeFor, suggestCents, lang, optin, pickup, clientKey, addr ? JSON.stringify(addr) : null, zone]
    );
    const values: unknown[] = [];
    const rows = lines.map((l, i) => {
      // as escolhas vão junto da observação, para aparecerem na cozinha, na comanda e na conta
      const n2 = (l.summary ? [l.summary, l.notes ? `Obs: ${l.notes}` : ""].filter(Boolean).join(" · ") : l.notes).slice(0, 400);
      values.push(newId(), id, l.item.id, l.item.name, l.unit, l.qty, n2, l.viaAi, l.viaSuggest, l.summary);
      const k = i * 10;
      return `($${k + 1},$${k + 2},$${k + 3},$${k + 4},$${k + 5},$${k + 6},$${k + 7},$${k + 8},$${k + 9},$${k + 10})`;
    });
    await t.query(`INSERT INTO order_items (id, order_id, item_id, name, price_cents, qty, notes, via_ai, via_suggestion, options) VALUES ${rows.join(",")}`, values);
    return { id, number: n, repeated: false };
  }).catch(async (e: any) => {
    // corrida rara entre duas instâncias com a mesma chave: devolve o pedido que ganhou
    if (clientKey && (e?.code === "23505" || /duplicate key|unique/i.test(String(e?.message)))) {
      const o = await existing(r.id, clientKey);
      if (o) return { ...o, repeated: true };
    }
    console.error("[pedido] falhou ao gravar", e);
    return null;
  });
  if (!saved) return fail("Não conseguimos registrar o pedido agora. Nada foi cobrado. Tente enviar de novo.", 503);
  return ok({ id: saved.id, number: saved.number, total, fee, repeated: saved.repeated || undefined });
}
