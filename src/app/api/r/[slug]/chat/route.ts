import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { loadMenu, restaurantBySlug } from "@/lib/menu";
import { waiterEnabled, waiterReply, type ChatMsg } from "@/lib/ai";
import type { CartLine } from "@/lib/format";
import { daypartAt, hourIn } from "@/lib/sell";

export const maxDuration = 60;

// Limite simples por sessão para evitar abuso (em memória; suficiente para o MVP)
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 12;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!waiterEnabled()) return fail("O garçom de IA não está disponível neste cardápio.", 404);
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);

  const b = await req.json().catch(() => ({}));
  const sessionId = String(b.sessionId || "").slice(0, 64) || "anon";
  if (limited(`${slug}:${sessionId}`)) return fail("Muitas mensagens seguidas. Espere um pouquinho.", 429);

  const messages: ChatMsg[] = (Array.isArray(b.messages) ? b.messages : [])
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 600) }))
    .slice(-20);
  // A conversa precisa começar com o cliente e terminar com ele
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return fail("Mensagem vazia.");

  const cart: CartLine[] = (Array.isArray(b.cart) ? b.cart : []).slice(0, 50).map((l: any) => ({
    itemId: String(l.itemId),
    qty: Math.max(1, Number(l.qty) || 1),
    notes: String(l.notes || "").slice(0, 200),
    viaAi: Boolean(l.viaAi),
  }));
  const channel = b.channel === "delivery" ? "delivery" : "mesa";
  const table = String(b.table || "").trim().slice(0, 20);
  const db = await getDB();

  // teto mensal de mensagens por restaurante (protege a conta de IA contra abuso)
  const cap = Number(process.env.AI_MAX_MENSAGENS_MES) || 6000;
  const [{ n: used }] = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM chat_events WHERE restaurant_id=$1 AND created_at > date_trunc('month', NOW())`,
    [r.id]
  );
  if (used >= cap) return fail("O garçom de IA atingiu o limite do mês. Chame um atendente, por favor.", 429);

  // o que esta mesa (este celular) já pediu nas últimas 4 horas
  const ordered =
    sessionId !== "anon"
      ? await db.query<{ name: string; qty: number; minutesAgo: number }>(
          `SELECT oi.name, SUM(oi.qty)::int AS qty, MIN(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60)::int AS "minutesAgo"
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.restaurant_id=$1 AND o.session_id=$2 AND o.status <> 'cancelado' AND o.created_at > NOW() - INTERVAL '4 hours'
            GROUP BY oi.name ORDER BY 3`,
          [r.id, sessionId]
        )
      : [];

  const { categories, items } = await loadMenu(r.id, { withImages: false });
  let reply;
  try {
    reply = await waiterReply({ restaurant: r as any, categories, items, messages, cart, channel, ordered, daypart: daypartAt(hourIn(process.env.APP_TIMEZONE || undefined)) });
  } catch (e: any) {
    console.error("chat error", e?.message);
    return fail("O garçom está ocupado agora. Tente de novo em instantes.", 502);
  }

  // a IA chamou alguém da equipe: vira um chamado no painel, com o motivo
  const call = reply.actions.find((a) => a.type === "call");
  if (call && call.type === "call" && channel === "mesa" && table && r.dine_in_enabled) {
    const [open] = await db.query(
      `SELECT id FROM calls WHERE restaurant_id=$1 AND table_label=$2 AND type='atendente' AND status='aberto' AND created_at > NOW() - INTERVAL '20 minutes'`,
      [r.id, table]
    );
    if (open) await db.query(`UPDATE calls SET reason=$2 WHERE id=$1`, [open.id, call.reason]);
    else await db.query(`INSERT INTO calls (id, restaurant_id, table_label, type, reason) VALUES ($1,$2,$3,'atendente',$4)`, [newId(), r.id, table, call.reason]);
  }
  await db
    .query(
      `INSERT INTO chat_events (id, restaurant_id, session_id, channel, question, answer, added_items) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        newId(),
        r.id,
        sessionId,
        channel,
        messages[messages.length - 1].content,
        reply.text.slice(0, 2000),
        reply.actions.filter((a) => a.type === "add").length,
      ]
    )
    .catch(() => {});

  return ok(reply);
}
