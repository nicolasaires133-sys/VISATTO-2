// Legenda com ajuda da IA: cria ou melhora a frase curta que vai abaixo do nome do prato. O dono revisa antes de salvar.
import { NextResponse } from "next/server";
import { owner, ok, fail } from "@/lib/http";
import { improveCaption } from "@/lib/ai";
import { allow } from "@/lib/limit";

export const maxDuration = 30;

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 100);
  if (!name) return fail("Informe o nome do prato primeiro.");
  if (!(await allow(`caption:${r.id}`, 80, 3600))) return fail("Muitas sugestões em pouco tempo. Tente daqui a pouco.", 429);
  try {
    const caption = await improveCaption({
      name,
      caption: String(b.caption || "").slice(0, 300),
      description: String(b.description || "").slice(0, 500),
      category: String(b.category || "").slice(0, 60),
      restaurant: r.name,
    });
    return ok({ caption });
  } catch (e: any) {
    return fail(e?.message || "Não foi possível sugerir agora.", 502);
  }
}
