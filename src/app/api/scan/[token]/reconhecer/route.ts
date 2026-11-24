// O celular manda recortes do prato (e de cada pedaço dele); a IA de visão do próprio site diz o que é.
// Grátis: o modelo roda aqui mesmo, sem serviço pago. Sem o modelo, segue só com o nome do item.
// Opcional (SCAN_IA_PAGA=1 + chave da Anthropic): a IA paga também olha o prato e dá a palavra final.
import { getDB } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { scanSession } from "@/lib/actor";
import { allow } from "@/lib/limit";
import { clipAvailable, getClip } from "@/lib/clip";
import { identifyProduct, scanAIEnabled } from "@/lib/ai";
import { decodeImages, recognizeDish, recognizeParts } from "@/lib/reconhecer";
import { dishById, matchName } from "@/lib/scan/pratos";
import { profileFromDish } from "@/lib/scan/profile";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await scanSession(token);
  if (!s) return fail("Este link expirou. Gere um novo QR no painel.", 404);
  const body = await req.json().catch(() => ({}));
  // "acordar" a IA (carrega o modelo) enquanto o celular ainda está capturando
  if (body.aquecer) {
    if (clipAvailable()) await getClip().catch(() => {});
    return ok({ ok: true });
  }
  if (!(await allow(`reconhecer:${token}`, 40, 600))) return fail("Muitas tentativas seguidas. Espere alguns minutos.", 429);
  const db = await getDB();
  const [item] = await db.query<{ name: string; description: string }>(`SELECT name, description FROM items WHERE id=$1`, [s.item_id]);
  const name = String(item?.name || ""), desc = String(item?.description || "").slice(0, 300);
  const note = String(body.note || "").slice(0, 200);
  const fotos = decodeImages(body.fotos, 4), partes = decodeImages(body.partes, 12);
  try {
    let out: any = {};
    if (fotos.length || !partes.length) out = await recognizeDish(fotos, name, note);
    // IA paga (só se ligada de propósito): olha o primeiro recorte e decide o que é
    const first = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.fotos?.[0] || ""));
    if (first && scanAIEnabled()) {
      try {
        const paid = await identifyProduct({ image: { mediaType: first[1], data: first[2] }, name, note });
        if (paid.fonte === "ia") {
          const known = matchName(paid.produto);
          const dish = known.dish && known.score >= 14 ? known.dish : null;
          out.profile = { ...paid, id: dish?.id, partes: dish?.partes ?? [], confianca: 0.97 };
          out.rec = {
            escolha: { id: dish?.id ?? "ia", nome: paid.produto, p: 0.97 },
            alternativas: (out.rec?.alternativas ?? []).filter((a: any) => a.id !== dish?.id),
            conflito: false,
            fonte: "ia",
          };
        }
      } catch {
        // a IA paga falhou: fica a resposta da IA grátis
      }
    }
    // o dono já disse o que é (ou o prato já foi reconhecido): usa como contexto para as partes
    const dishId = String(body.prato || out.profile?.id || "");
    if (!out.profile && dishById(dishId)) out.profile = profileFromDish(dishById(dishId)!, "foto");
    if (partes.length) out.partes = await recognizeParts(partes, dishId, `${name} ${desc} ${note}`);
    return ok(out);
  } catch (e) {
    console.error("reconhecer", e);
    return fail("Não consegui reconhecer agora.", 503);
  }
}
