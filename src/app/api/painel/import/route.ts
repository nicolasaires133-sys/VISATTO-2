import { NextResponse } from "next/server";
import { owner, ok, fail } from "@/lib/http";
import { importMenuFromImages } from "@/lib/ai";

export const maxDuration = 60;

// Recebe até 4 fotos (data URLs) do cardápio impresso e devolve uma prévia estruturada.
export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const images: string[] = Array.isArray(b.images) ? b.images.slice(0, 4) : [];
  if (!images.length) return fail("Envie pelo menos uma foto do cardápio.");
  const parsed = [];
  for (const d of images) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(d));
    if (!m) return fail("Formato de imagem não suportado. Use JPG ou PNG.");
    parsed.push({ mediaType: m[1], data: m[2] });
  }
  try {
    const menu = await importMenuFromImages(parsed);
    return ok(menu);
  } catch (e: any) {
    return fail(e?.message || "Não foi possível ler o cardápio.", 500);
  }
}
