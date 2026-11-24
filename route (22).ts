import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";

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
  return ok({ days, totals, ticketAi, chats, topItems, daily, recentQuestions, arStats, arItems });
}
