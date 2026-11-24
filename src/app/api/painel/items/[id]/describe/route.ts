// Sugere uma descrição mais apetitosa para o prato. O dono revisa antes de salvar.
import { NextResponse } from "next/server";
import { owner, ok, fail } from "@/lib/http";
import { improveDescription } from "@/lib/ai";
import { allow } from "@/lib/limit";

export const maxDuration = 30;

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 100);
  if (!name) return fail("Informe o nome do prato primeiro.");
  if (!(await allow(`describe:${r.id}`, 60, 3600))) return fail("Muitas sugestões em pouco tempo. Tente daqui a pouco.", 429);
  try {
    const text = await improveDescription({ name, description: String(b.description || "").slice(0, 500), category: String(b.category || "").slice(0, 60), restaurant: r.name });
    return ok({ description: text });
  } catch (e: any) {
    return fail(e?.message || "Não foi possível sugerir agora.", 502);
  }
}
