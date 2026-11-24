import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { summarizeQuestions } from "@/lib/ai";

export const maxDuration = 60;

export async function POST() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const db = await getDB();
  const rows = await db.query<{ question: string }>(
    `SELECT question FROM chat_events WHERE restaurant_id=$1 AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC LIMIT 400`,
    [r.id]
  );
  if (rows.length < 3) return fail("Ainda há poucas conversas para resumir. Volte quando os clientes tiverem usado mais o garçom.");
  try {
    const summary = await summarizeQuestions(r.name, rows.map((x) => x.question));
    return ok({ summary });
  } catch (e: any) {
    return fail(e?.message || "Não foi possível gerar o resumo.", 500);
  }
}
