import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/http";
import { actor } from "@/lib/actor";
import { putFile, storageMode, contentTypeFor } from "@/lib/storage";

export const maxDuration = 60;

const MAX_BYTES = 80 * 1024 * 1024;
const ALLOWED = /\.(jpe?g|png|webp|glb|usdz)$/i;

// Como o navegador deve enviar arquivos: direto para o Vercel Blob (produção) ou para este servidor (local)
export async function GET(req: Request) {
  const a = await actor(req);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  try {
    return ok({ mode: storageMode(), prefix: `uploads/${r.id}/` });
  } catch (e: any) {
    return fail(e.message, 500);
  }
}

export async function POST(req: Request) {
  const a = await actor(req);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  let mode: "blob" | "local";
  try {
    mode = storageMode();
  } catch (e: any) {
    return fail(e.message, 500);
  }

  if (mode === "blob") {
    // Gera um token de envio direto navegador → Vercel Blob (sem passar pelo limite de 4,5 MB da função)
    const { handleUpload } = await import("@vercel/blob/client");
    const body = await req.json();
    try {
      const result = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith(`uploads/${r.id}/`) || !ALLOWED.test(pathname)) throw new Error("Arquivo não permitido.");
          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "model/gltf-binary", "model/vnd.usdz+zip", "application/octet-stream"],
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: true,
          };
        },
      });
      return NextResponse.json(result);
    } catch (e: any) {
      return fail(e?.message || "Falha no envio.", 400);
    }
  }

  // Modo local: corpo bruto do arquivo
  const name = new URL(req.url).searchParams.get("name") || "";
  if (!ALLOWED.test(name)) return fail("Tipo de arquivo não permitido.");
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return fail("Arquivo vazio.");
  if (buf.length > MAX_BYTES) return fail("Arquivo maior que 80 MB.");
  const url = await putFile(`uploads/${r.id}/${name}`, buf, contentTypeFor(name));
  return ok({ url });
}
