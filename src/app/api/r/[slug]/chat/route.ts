import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { loadMenu, restaurantBySlug } from "@/lib/menu";
import { waiterEnabled, waiterReply, type ChatMsg } from "@/lib/ai";
import type { CartLine } from "@/lib/format";

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

  const { categories, items } = await loadMenu(r.id, { withImages: false });
  let reply;
  try {
    reply = await waiterReply({ restaurant: r as any, categories, items, messages, cart, channel });
  } catch (e: any) {
    console.error("chat error", e?.message);
    return fail("O garçom está ocupado agora. Tente de novo em instantes.", 502);
  }

  const db = await getDB();
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
