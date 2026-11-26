import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ok, fail } from "@/lib/http";
import { actor } from "@/lib/actor";
import { getItemModel, processAndStore } from "@/lib/modelPipeline";
import { TEMPLATES, templateFile, templateScale, type TemplateKind } from "@/lib/templates";

export const maxDuration = 60;

// Cria o 3D a partir de um modelo pronto (pizza na caixa, açaí no copo, marmita) com as medidas do dono
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const row = await getItemModel(a.restaurantId, id);
  if (!row) return fail("Prato não encontrado.", 404);
  if (row.model_status === "gerando" || row.model_status === "processando") return fail("Espere a geração em andamento terminar.");

  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind || "") as TemplateKind;
  const t = TEMPLATES[kind];
  if (!t) return fail("Escolha um dos modelos prontos.");
  const s = templateScale(kind, b);
  if (!s.ok) return fail(s.error);

  try {
    // arquivo base: do disco (no computador) ou do próprio site (na Vercel)
    const file = templateFile(kind, b);
    let buf: Uint8Array;
    try {
      buf = await fs.readFile(path.join(process.cwd(), "public", file));
    } catch {
      const r = await fetch(new URL(file, req.url));
      if (!r.ok) throw new Error("Não foi possível abrir o modelo pronto.");
      buf = new Uint8Array(await r.arrayBuffer());
    }
    const res = await processAndStore(row, buf, "", null, null, { scale: s.scale, keepAnimations: kind === "acai" });
    const { getDB } = await import("@/lib/db");
    await (await getDB()).query(`UPDATE items SET model_source='modelo', model_src_url='' WHERE id=$1`, [id]);
    return ok({ ok: true, dims: res.dims, summary: s.summary });
  } catch (e: any) {
    return fail(e?.message || "Não foi possível criar o 3D.", 400);
  }
}
