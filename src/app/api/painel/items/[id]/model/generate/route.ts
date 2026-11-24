import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { actor } from "@/lib/actor";
import { getItemModel } from "@/lib/modelPipeline";
import { createMeshyTask, meshyEnabled } from "@/lib/meshy";

export const maxDuration = 60;

// Começa a gerar o 3D do prato a partir de 1 a 4 fotos (IA).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const a = await actor(req, id);
  if (a instanceof NextResponse) return a;
  const r = { id: a.restaurantId };
  if (!meshyEnabled()) return fail("A geração de 3D por IA não está ativada (falta a chave MESHY_API_KEY).");
  const row = await getItemModel(r.id, id);
  if (!row) return fail("Prato não encontrado.", 404);
  if (row.model_status === "gerando" || row.model_status === "processando") return fail("Já existe uma geração em andamento para este prato.");

  const b = await req.json().catch(() => ({}));
  const t = b.target_dims && typeof b.target_dims === "object" ? b.target_dims : null;
  const targetDims = t && [t.w, t.d, t.h].every((v: unknown) => Number(v) > 0 && Number(v) <= 150) ? { w: Number(t.w), d: Number(t.d), h: Number(t.h) } : null;
  const width = targetDims ? Math.max(targetDims.w, targetDims.d) : Number(b.width_cm);
  if (!(width >= 3 && width <= 150)) return fail("Informe a largura real do prato (de 3 a 150 cm).");
  const images: string[] = (Array.isArray(b.images) ? b.images : [])
    .filter((x: unknown) => typeof x === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x))
    .slice(0, 4);
  if (!images.length) return fail("Envie de 1 a 4 fotos do prato.");
  if (images.some((x) => x.length > 8_000_000)) return fail("Foto grande demais.");

  // Evita gerações em excesso (custam créditos): no máximo 30 por restaurante por dia
  const db = await getDB();
  const [{ n }] = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM events WHERE restaurant_id=$1 AND type='gerar3d' AND created_at > NOW() - INTERVAL '1 day'`,
    [r.id]
  );
  if (n >= 30) return fail("Limite diário de gerações 3D atingido. Tente amanhã.");

  let taskId: string;
  try {
    taskId = await createMeshyTask(images);
  } catch (e: any) {
    return fail(e?.message || "Não foi possível iniciar a geração.", 502);
  }
  await db.query(
    `UPDATE items SET model_status='gerando', model_task_id=$2, model_width_cm=$3, model_target_dims=$4::jsonb, model_source='ia',
            model_progress=0, model_error='', model_updated_at=NOW()
      WHERE id=$1`,
    [id, taskId, width, JSON.stringify(targetDims ?? {})]
  );
  await db.query(`INSERT INTO events (id, restaurant_id, item_id, type) VALUES ($1,$2,$3,'gerar3d')`, [crypto.randomUUID(), r.id, id]);
  return ok({ ok: true });
}
