import { getDB } from "./db";
import { prepareModel, type PrepareOptions } from "./model3d";
import { putFile, readFile, deleteFile } from "./storage";
import { getMeshyTask } from "./meshy";

type ItemModelRow = {
  id: string;
  restaurant_id: string;
  model_status: string;
  model_task_id: string;
  model_glb_url: string;
  model_usdz_url: string;
  model_src_url: string;
  model_width_cm: number;
  model_target_dims?: { w: number; d: number; h: number } | string | null;
  model_updated_at: string | Date | null;
};

export async function getItemModel(restaurantId: string, itemId: string): Promise<ItemModelRow | null> {
  const db = await getDB();
  const [row] = await db.query<ItemModelRow>(
    `SELECT id, restaurant_id, model_status, model_task_id, model_glb_url, model_usdz_url, model_src_url, model_width_cm, model_target_dims, model_updated_at
       FROM items WHERE id=$1 AND restaurant_id=$2`,
    [itemId, restaurantId]
  );
  return row ?? null;
}

export async function setModelError(itemId: string, message: string) {
  const db = await getDB();
  await db.query(`UPDATE items SET model_status='erro', model_error=$2, model_updated_at=NOW() WHERE id=$1`, [itemId, message.slice(0, 300)]);
}

/** Normaliza um GLB (escala real, base na mesa), salva e deixa o item em "revisar". */
export async function processAndStore(
  row: ItemModelRow,
  srcBuffer: Uint8Array,
  srcUrl: string,
  widthCm: number | null,
  targetDims?: { w: number; d: number; h: number } | null,
  extra?: Partial<PrepareOptions>
) {
  const { glb, dims } = await prepareModel(srcBuffer, { widthCm, targetDims, ...extra });
  const glbUrl = await putFile(`modelos/${row.restaurant_id}/${row.id}.glb`, glb, "model/gltf-binary");
  const db = await getDB();
  const oldGlb = row.model_glb_url;
  const oldUsdz = row.model_usdz_url;
  await db.query(
    `UPDATE items SET model_status='revisar', model_glb_url=$2, model_usdz_url='', model_src_url=$3, model_width_cm=$4,
            model_dims=$5::jsonb, model_error='', model_progress=100, model_published=FALSE, model_updated_at=NOW()
      WHERE id=$1`,
    [row.id, glbUrl, srcUrl, widthCm ?? Math.max(dims.w, dims.d), JSON.stringify(dims)]
  );
  if (oldGlb && oldGlb !== glbUrl && oldGlb !== srcUrl) await deleteFile(oldGlb);
  if (oldUsdz) await deleteFile(oldUsdz);
  if (row.model_src_url && row.model_src_url !== srcUrl) await deleteFile(row.model_src_url);
  return { glbUrl, dims };
}

/**
 * Avança a geração por IA: consulta a Meshy e, quando o modelo fica pronto, baixa, prepara e salva.
 * Chamado pelo painel a cada poucos segundos enquanto o status for "gerando".
 */
export async function advanceGeneration(row: ItemModelRow) {
  const db = await getDB();

  // Se um processamento anterior travou (ex.: tempo esgotado), libera para tentar de novo
  if (row.model_status === "processando") {
    const age = row.model_updated_at ? Date.now() - new Date(row.model_updated_at).getTime() : Infinity;
    if (age > 3 * 60_000) {
      await db.query(`UPDATE items SET model_status='gerando' WHERE id=$1 AND model_status='processando'`, [row.id]);
    }
    return;
  }
  if (row.model_status !== "gerando" || !row.model_task_id) return;

  const task = await getMeshyTask(row.model_task_id);
  if (task.status === "PENDING" || task.status === "IN_PROGRESS") {
    await db.query(`UPDATE items SET model_progress=$2 WHERE id=$1`, [row.id, Math.min(95, task.progress)]);
    return;
  }
  if (task.status !== "SUCCEEDED" || !task.glbUrl) {
    await setModelError(row.id, task.error || "A geração do 3D falhou.");
    return;
  }

  // Garante que só uma requisição processa o resultado
  const claimed = await db.query(
    `UPDATE items SET model_status='processando', model_updated_at=NOW() WHERE id=$1 AND model_status='gerando' RETURNING id`,
    [row.id]
  );
  if (!claimed.length) return;

  try {
    let raw: Buffer;
    try {
      raw = await readFile(task.glbUrl);
    } catch {
      throw new Error("Não foi possível baixar o modelo gerado. Tente gerar de novo.");
    }
    // Guarda o original (os links da Meshy expiram) para permitir reajustar o tamanho depois
    const srcUrl = await putFile(`modelos/${row.restaurant_id}/${row.id}-original.glb`, raw, "model/gltf-binary");
    let target = row.model_target_dims as any;
    if (typeof target === "string") target = JSON.parse(target);
    await processAndStore(row, raw, srcUrl, row.model_width_cm || null, target && target.w ? target : null);
  } catch (e: any) {
    await setModelError(row.id, e?.message || "Não foi possível preparar o modelo 3D.");
  }
}
