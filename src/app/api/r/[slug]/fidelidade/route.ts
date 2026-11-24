// Cartão fidelidade: quantos selos este WhatsApp já juntou (só o número; nenhum dado pessoal volta).
import { ok, fail } from "@/lib/http";
import { restaurantBySlug } from "@/lib/menu";
import { allow, clientIp } from "@/lib/limit";
import { cleanPhone, readLoyalty, stampsOf } from "@/lib/loyalty";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await restaurantBySlug(slug);
  if (!r) return fail("Restaurante não encontrado.", 404);
  const l = readLoyalty(r.loyalty);
  if (!l.on) return fail("Este restaurante não tem cartão fidelidade.", 404);
  const phone = cleanPhone(new URL(req.url).searchParams.get("tel") || "");
  if (phone.length < 10) return fail("Informe o WhatsApp com DDD.");
  if (!(await allow(`fid:${r.id}:${clientIp(req)}`, 40, 600))) return fail("Muitas consultas seguidas. Aguarde um instante.", 429);
  const s = await stampsOf(r.id, phone, l);
  return ok({ stamps: s.stamps, ready: s.ready, goal: l.goal, reward: l.reward, min_cents: l.min_cents });
}
