import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { actor } from "@/lib/actor";
import { advanceGeneration, getItemModel, processAndStore } from "@/lib/modelPipeline";
import { deleteFile, isOwnFileUrl, readFile } from "@/lib/storage";
import { meshyEnabled } from "@/lib/meshy";

export const maxDuration = 60;

async function current(itemId: string) {
  const db = await getDB();
  const [row] = await db.query(
    `SELECT model_status, model_glb_url, model_usdz_url, model_width_cm, model_dims, model_progress, model_published, model_error
       FROM items WHERE id=$1`,
    [itemId]
  );
  if (row && typeof row.model_dims === "string") row.model_dims = JSON.parse(row.model_dims);
  return { ...row, meshyEnabled: meshyEnabled() };
}

// Status do 3D do prato (e avança a geração por IA quando houver)
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  const row = await getItemModel(r.id, id);
  if (!row) return fail("Prato não encontrado.", 404);
  if (row.model_status === "gerando" || row.model_status === "processando") {
    try {
      await advanceGeneration(row);
    } catch (e: any) {
      // erro de rede momentâneo: não derruba a geração, só informa
      return ok({ ...(await current(id)), warning: e?.message || "Falha ao consultar a geração." });
    }
  }
  return ok(await current(id));
}

// Ações: usdz (arquivo do iPhone gerado no navegador), publicar/ocultar, reajustar tamanho
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  const row = await getItemModel(r.id, id);
  if (!row) return fail("Prato não encontrado.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await getDB();

  if (b.action === "usdz") {
    const url = String(b.url || "");
    if (!isOwnFileUrl(url) || !url.toLowerCase().includes(".usdz")) return fail("Arquivo inválido.");
    if (!row.model_glb_url) return fail("Este prato não tem modelo 3D.");
    const old = row.model_usdz_url;
    await db.query(`UPDATE items SET model_usdz_url=$2, model_updated_at=NOW() WHERE id=$1`, [id, url]);
    if (old && old !== url) await deleteFile(old);
    return ok(await current(id));
  }

  if (b.action === "publish") {
    if (!row.model_glb_url) return fail("Este prato não tem modelo 3D.");
    const publish = b.published !== false;
    await db.query(
      `UPDATE items SET model_published=$2, model_status=CASE WHEN $2 THEN 'pronto' ELSE 'revisar' END, model_updated_at=NOW() WHERE id=$1`,
      [id, publish]
    );
    return ok(await current(id));
  }

  if (b.action === "resize") {
    const width = Number(b.width_cm);
    if (!(width >= 3 && width <= 150)) return fail("Informe a largura entre 3 e 150 cm.");
    const src = row.model_src_url || row.model_glb_url;
    if (!src) return fail("Este prato não tem modelo 3D.");
    try {
      const buf = await readFile(src);
      await processAndStore(row, buf, src, width);
    } catch (e: any) {
      return fail(e?.message || "Não foi possível reajustar.", 500);
    }
    return ok(await current(id));
  }

  return fail("Ação inválida.");
}

// Remove o 3D do prato
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  const row = await getItemModel(r.id, id);
  if (!row) return fail("Prato não encontrado.", 404);
  const db = await getDB();
  await db.query(
    `UPDATE items SET model_status='nenhum', model_glb_url='', model_usdz_url='', model_src_url='', model_task_id='',
            model_error='', model_progress=0, model_published=FALSE, model_dims='{}'::jsonb, model_updated_at=NOW()
      WHERE id=$1`,
    [id]
  );
  await Promise.all([deleteFile(row.model_glb_url), deleteFile(row.model_usdz_url), deleteFile(row.model_src_url)]);
  return ok(await current(id));
}

