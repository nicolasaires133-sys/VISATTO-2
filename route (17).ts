import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/http";
import { actor } from "@/lib/actor";
import { getItemModel, processAndStore } from "@/lib/modelPipeline";
import { deleteFile, isOwnFileUrl, readFile } from "@/lib/storage";

export const maxDuration = 60;

// Usa um arquivo 3D enviado pelo dono (escaneado com Polycam, KIRI, Scaniverse etc.)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  const row = await getItemModel(r.id, id);
  if (!row) return fail("Prato não encontrado.", 404);
  if (row.model_status === "gerando" || row.model_status === "processando") return fail("Espere a geração em andamento terminar.");

  const b = await req.json().catch(() => ({}));
  const url = String(b.url || "");
  if (!isOwnFileUrl(url) || !url.toLowerCase().includes(".glb")) return fail("Envie um arquivo .glb.");
  const keepScale = b.keep_scale === true;
  const width = Number(b.width_cm);
  if (!keepScale && !(width >= 3 && width <= 150)) return fail("Informe a largura real do prato (de 3 a 150 cm).");

  try {
    const buf = await readFile(url);
    // medidas corrigidas pelo dono na revisão do escâner (ex.: a borda de um copo de vidro que a câmera não pegou)
    const t = b.target_dims;
    const target =
      t && [t.w, t.d, t.h].every((v: any) => Number(v) > 0.5 && Number(v) < 150) ? { w: Number(t.w), d: Number(t.d), h: Number(t.h) } : null;
    const res = await processAndStore(row, buf, url, keepScale ? null : width, target);
    const { getDB } = await import("@/lib/db");
    const scanned = b.source === "escaner";
    // escâner: o arquivo enviado pelo celular já está em escala real; depois de processado, o original não serve
    // para mais nada. Apaga para economizar o espaço grátis (o modelo processado passa a ser a "fonte").
    await (await getDB()).query(
      scanned ? `UPDATE items SET model_source='escaner', model_src_url=$2 WHERE id=$1` : `UPDATE items SET model_source='arquivo' WHERE id=$1`,
      scanned ? [id, res.glbUrl] : [id],
    );
    if (scanned && url !== res.glbUrl) await deleteFile(url);
    return ok({ ok: true, dims: res.dims });
  } catch (e: any) {
    return fail(e?.message || "Não foi possível usar este arquivo.", 400);
  }
}
