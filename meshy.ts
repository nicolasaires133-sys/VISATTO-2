// Geração de modelo 3D a partir de fotos do prato (Meshy Multi-Image to 3D).
// Docs: https://docs.meshy.ai/api/multi-image-to-3d
const BASE = process.env.MESHY_BASE_URL || "https://api.meshy.ai";

export const meshyEnabled = () => Boolean(process.env.MESHY_API_KEY);

function headers() {
  return { Authorization: `Bearer ${process.env.MESHY_API_KEY}`, "Content-Type": "application/json" };
}

async function parseError(res: Response) {
  const body = await res.json().catch(() => ({}) as any);
  const msg = body?.message || body?.error || "";
  if (res.status === 401) return "Chave da Meshy inválida (MESHY_API_KEY).";
  if (res.status === 402) return "Sem créditos na Meshy. Recarregue a conta para gerar modelos 3D.";
  if (res.status === 403) return "A Meshy bloqueou as imagens enviadas.";
  if (res.status === 429) return "Muitas gerações ao mesmo tempo. Tente novamente em 1 minuto.";
  return `Falha ao gerar o 3D (${res.status}) ${msg}`.trim();
}

/** Cria a tarefa de geração. images: data URLs (jpeg/png/webp), a primeira é a foto principal. */
export async function createMeshyTask(images: string[]): Promise<string> {
  const res = await fetch(`${BASE}/openapi/v1/multi-image-to-3d`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      image_urls: images.slice(0, 4),
      ai_model: "latest",
      should_texture: true,
      enable_pbr: false,
      texture_resolution: "2k",
      should_remesh: true,
      topology: "triangle",
      target_polycount: 80000,
      image_enhancement: false, // manter a aparência real do prato
      remove_lighting: true, // a iluminação do AR vem do ambiente
      target_formats: ["glb"],
      moderation: false,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.result) throw new Error("Resposta inesperada da Meshy.");
  return String(data.result);
}

export type MeshyTask = {
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  glbUrl?: string;
  thumbnailUrl?: string;
  error?: string;
};

export async function getMeshyTask(id: string): Promise<MeshyTask> {
  const res = await fetch(`${BASE}/openapi/v1/multi-image-to-3d/${encodeURIComponent(id)}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const t = await res.json();
  return {
    status: t.status,
    progress: Number(t.progress) || 0,
    glbUrl: t.model_urls?.glb,
    thumbnailUrl: t.thumbnail_url,
    error: t.task_error?.message || (t.status === "FAILED" ? "A geração falhou. Tente fotos mais nítidas, com o prato inteiro e fundo limpo." : undefined),
  };
}
