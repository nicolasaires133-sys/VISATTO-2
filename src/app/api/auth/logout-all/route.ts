// Sai de todos os aparelhos (celular perdido, funcionário que saiu). Este aparelho continua conectado.
import { NextResponse } from "next/server";
import { owner, ok } from "@/lib/http";
import { bumpSessions, createSession } from "@/lib/auth";

export async function POST() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  await bumpSessions(r.id);
  await createSession(r.id);
  return ok({ ok: true });
}
