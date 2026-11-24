import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";
import { engineer } from "@/lib/menu-engineering";
import { brl } from "@/lib/format";
import { categoryKind } from "@/lib/sell";

export async function GET(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 30));
  const db = await getDB();
  const since = `NOW() - INTERVAL '${days} days'`;
  const TZ = (process.env.APP_TIMEZONE || "America/Sao_Paulo").replace(/[^A-Za-z_/]/g, "");

  const [totals] = await db.query(
    `SELECT COUNT(*)::int AS orders,
            COALESCE(SUM(total_cents),0)::int AS revenue,
            COALESCE(SUM(ai_cents),0)::int AS ai_revenue,
            COALESCE(SUM(suggest_cents),0)::int AS suggest_revenue,
            COUNT(*) FILTER (WHERE suggest_cents > 0)::int AS orders_with_suggest,
            COUNT(*) FILTER (WHERE marketing_optin)::int AS optins,
            COALESCE(AVG(total_cents),0)::int AS avg_ticket,
            COUNT(*) FILTER (WHERE channel='mesa')::int AS dine_in,
            COUNT(*) FILTER (WHERE channel='delivery')::int AS delivery
       FROM orders WHERE restaurant_id=$1 AND status <> 'cancelado' AND created_at > ${since}`,
    [r.id]
  );
  const [ticketAi] = await db.query(
    `SELECT COALESCE(AVG(total_cents) FILTER (WHERE ai_cents > 0),0)::int AS with_ai,
            COALESCE(AVG(total_cents) FILTER (WHERE ai_cents = 0),0)::int AS without_ai,
            COUNT(*) FILTER (WHERE ai_cents > 0)::int AS orders_with_ai
       FROM orders WHERE restaurant_id=$1 AND status <> 'cancelado' AND created_at > ${since}`,
    [r.id]
  );
  const [chats] = await db.query(
    `SELECT COUNT(*)::int AS questions, COUNT(DISTINCT session_id)::int AS conversations
       FROM chat_events WHERE restaurant_id=$1 AND created_at > ${since}`,
    [r.id]
  );
  const topItems = await db.query(
    `SELECT oi.name, SUM(oi.qty)::int AS qty, SUM(oi.qty*oi.price_cents)::int AS revenue,
            SUM(CASE WHEN oi.via_ai THEN oi.qty ELSE 0 END)::int AS via_ai
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id=$1 AND o.status <> 'cancelado' AND o.created_at > ${since}
      GROUP BY oi.name ORDER BY qty DESC LIMIT 8`,
    [r.id]
  );
  const daily = await db.query(
    `SELECT to_char(date_trunc('day', created_at AT TIME ZONE '${TZ}'), 'DD/MM') AS day,
            COUNT(*)::int AS orders, COALESCE(SUM(total_cents),0)::int AS revenue, COALESCE(SUM(ai_cents),0)::int AS ai_revenue
       FROM orders WHERE restaurant_id=$1 AND status <> 'cancelado' AND created_at > NOW() - INTERVAL '14 days'
      GROUP BY date_trunc('day', created_at AT TIME ZONE '${TZ}') ORDER BY date_trunc('day', created_at AT TIME ZONE '${TZ}')`,
    [r.id]
  );
  const [arStats] = await db.query(
    `WITH ev AS (SELECT DISTINCT session_id, type FROM events WHERE restaurant_id=$1 AND created_at > ${since} AND session_id <> ''),
          ord AS (SELECT DISTINCT session_id FROM orders WHERE restaurant_id=$1 AND status <> 'cancelado' AND created_at > ${since} AND session_id <> ''),
          visits AS (SELECT DISTINCT session_id FROM ev),
          ar AS (SELECT session_id FROM ev WHERE type='ar')
     SELECT (SELECT COUNT(*) FROM visits)::int AS visits,
            (SELECT COUNT(*) FROM ar)::int AS ar_sessions,
            (SELECT COUNT(*) FROM ar WHERE session_id IN (SELECT session_id FROM ord))::int AS ar_ordered,
            (SELECT COUNT(*) FROM visits WHERE session_id NOT IN (SELECT session_id FROM ar))::int AS noar_sessions,
            (SELECT COUNT(*) FROM visits WHERE session_id NOT IN (SELECT session_id FROM ar) AND session_id IN (SELECT session_id FROM ord))::int AS noar_ordered,
            (SELECT COUNT(*) FROM events WHERE restaurant_id=$1 AND type='ar' AND created_at > ${since})::int AS ar_opens,
            (SELECT COUNT(*) FROM events WHERE restaurant_id=$1 AND type='view3d' AND created_at > ${since})::int AS views3d`,
    [r.id]
  );
  const arItems = await db.query(
    `SELECT i.name, COUNT(*)::int AS ar_opens
       FROM events e JOIN items i ON i.id = e.item_id
      WHERE e.restaurant_id=$1 AND e.type='ar' AND e.created_at > ${since}
      GROUP BY i.name ORDER BY ar_opens DESC LIMIT 6`,
    [r.id]
  );
  const recentQuestions = await db.query(
    `SELECT question, created_at FROM chat_events WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 30`,
    [r.id]
  );
  // Engenharia de cardápio: vendas do período x custo de cada prato
  const engRows = await db.query<{ id: string; name: string; qty: number; price_cents: number; cost_cents: number }>(
    `SELECT i.id, i.name, i.price_cents, COALESCE(i.cost_cents,0)::int AS cost_cents,
            COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.item_id = i.id AND o.status <> 'cancelado' AND o.created_at > ${since}),0)::int AS qty
       FROM items i WHERE i.restaurant_id=$1`,
    [r.id]
  );
  const cats = await db.query<{ id: string; name: string }>(`SELECT c.id, c.name FROM categories c WHERE c.restaurant_id=$1`, [r.id]);
  const itemCat = new Map((await db.query<{ id: string; category_id: string }>(`SELECT id, category_id FROM items WHERE restaurant_id=$1`, [r.id])).map((x) => [x.id, x.category_id]));
  const catKind = new Map(cats.map((c) => [c.id, categoryKind(c.name)]));
  const engineering = engineer(engRows.map((x) => ({ ...x, kind: catKind.get(itemCat.get(x.id) ?? "") })));

  // Avaliações dos clientes
  const [fb] = await db.query(
    `SELECT COUNT(*)::int AS n, COALESCE(AVG(stars),0)::float AS avg,
            COUNT(*) FILTER (WHERE stars <= 3)::int AS low
       FROM feedback WHERE restaurant_id=$1 AND created_at > ${since}`,
    [r.id]
  );
  const comments = await db.query(
    `SELECT stars, comment, created_at FROM feedback WHERE restaurant_id=$1 AND comment <> '' ORDER BY created_at DESC LIMIT 12`,
    [r.id]
  );

  const week = await weekly(db, r.id, engRows);
  return ok({ days, totals, ticketAi, chats, topItems, daily, recentQuestions, arStats, arItems, engineering, feedback: { ...fb, comments }, week });
}

/** Resumo da semana em frases curtas, cada uma com uma ação. Feito por regras: não custa IA. */
async function weekly(db: any, rid: string, engRows: { id: string; name: string; qty: number }[]) {
  const [w] = await db.query(
    `SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS orders_now,
            COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days')::int AS orders_prev,
            COALESCE(SUM(total_cents) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),0)::int AS rev_now,
            COALESCE(SUM(total_cents) FILTER (WHERE created_at <= NOW() - INTERVAL '7 days'),0)::int AS rev_prev,
            COALESCE(SUM(suggest_cents + ai_cents) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),0)::int AS extra_now
       FROM orders WHERE restaurant_id=$1 AND status <> 'cancelado' AND created_at > NOW() - INTERVAL '14 days'`,
    [rid]
  );
  const lines: { text: string; tone: "good" | "bad" | "info" }[] = [];
  if (!w || w.orders_now + w.orders_prev === 0) return lines;
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
  if (w.orders_prev > 0) {
    const d = pct(w.rev_now, w.rev_prev);
    lines.push({
      text: `Faturamento de ${brl(w.rev_now)} em 7 dias, ${d >= 0 ? `${d}% a mais` : `${-d}% a menos`} que a semana anterior (${w.orders_now} pedidos).`,
      tone: d >= 0 ? "good" : "bad",
    });
  } else {
    lines.push({ text: `Primeira semana com pedidos: ${w.orders_now} pedidos e ${brl(w.rev_now)} de faturamento.`, tone: "good" });
  }
  if (w.extra_now > 0) lines.push({ text: `As sugestões do cardápio e o garçom de IA trouxeram ${brl(w.extra_now)} a mais nesta semana.`, tone: "good" });

  // visto muito e pedido pouco
  const views = await db.query(
    `SELECT e.item_id, COUNT(*)::int AS n FROM events e
      WHERE e.restaurant_id=$1 AND e.type IN ('view3d','ar') AND e.created_at > NOW() - INTERVAL '7 days' AND e.item_id IS NOT NULL
      GROUP BY e.item_id ORDER BY n DESC LIMIT 20`,
    [rid]
  );
  const sold = new Map<string, number>(
    (
      await db.query(
        `SELECT oi.item_id, SUM(oi.qty)::int AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.restaurant_id=$1 AND o.status <> 'cancelado' AND o.created_at > NOW() - INTERVAL '7 days' GROUP BY oi.item_id`,
        [rid]
      )
    ).map((x: any) => [x.item_id, x.q])
  );
  const nameOf = new Map(engRows.map((r) => [r.id, r.name]));
  const looked = views.find((v: any) => v.n >= 15 && (sold.get(v.item_id) ?? 0) / v.n < 0.08 && nameOf.has(v.item_id));
  if (looked) {
    lines.push({
      text: `${nameOf.get(looked.item_id)} foi visto ${looked.n} vezes em 3D e pedido ${sold.get(looked.item_id) ?? 0}. Confira se o preço e a descrição ajudam, ou combine com outro prato.`,
      tone: "bad",
    });
  }
  // prato que mais cresceu
  const prev = new Map<string, number>(
    (
      await db.query(
        `SELECT oi.item_id, SUM(oi.qty)::int AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.restaurant_id=$1 AND o.status <> 'cancelado' AND o.created_at <= NOW() - INTERVAL '7 days' AND o.created_at > NOW() - INTERVAL '14 days'
          GROUP BY oi.item_id`,
        [rid]
      )
    ).map((x: any) => [x.item_id, x.q])
  );
  let best: { id: string; diff: number } | null = null;
  for (const [id, q] of sold) {
    const diff = (q as number) - ((prev.get(id) as number) ?? 0);
    if (diff >= 5 && (!best || diff > best.diff)) best = { id: id as string, diff };
  }
  if (best && nameOf.has(best.id)) lines.push({ text: `${nameOf.get(best.id)} vendeu ${best.diff} a mais que na semana anterior. Vale deixar em destaque.`, tone: "good" });

  const [q] = await db.query(`SELECT COUNT(*)::int AS n FROM chat_events WHERE restaurant_id=$1 AND created_at > NOW() - INTERVAL '7 days'`, [rid]);
  if (q?.n >= 5) lines.push({ text: `Clientes fizeram ${q.n} perguntas ao garçom de IA. Use “Analisar com IA” para ver o que eles procuram e não encontram.`, tone: "info" });
  const [fb] = await db.query(`SELECT COUNT(*)::int AS n FROM feedback WHERE restaurant_id=$1 AND stars <= 3 AND created_at > NOW() - INTERVAL '7 days'`, [rid]);
  if (fb?.n > 0) lines.push({ text: `${fb.n} ${fb.n === 1 ? "cliente deu" : "clientes deram"} nota baixa nesta semana. Os comentários estão em Avaliações, logo abaixo.`, tone: "bad" });
  return lines.slice(0, 5);
}
