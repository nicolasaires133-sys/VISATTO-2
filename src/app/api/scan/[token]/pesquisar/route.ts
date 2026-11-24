// O dono digitou o nome do prato: o Visatto pesquisa o que ele é (lista própria e Wikipédia).
import { ok, fail } from "@/lib/http";
import { scanSession } from "@/lib/actor";
import { researchName } from "@/lib/pesquisa";
import { allow } from "@/lib/limit";

export const maxDuration = 30;

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const s = await scanSession(token);
  if (!s) return fail("Este link expirou. Gere um novo QR no painel.", 404);
  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome || "").trim();
  if (nome.length < 2) return fail("Digite o nome do prato.", 400);
  if (!(await allow(`pesquisar:${token}`, 30, 600))) return fail("Muitas pesquisas seguidas. Espere alguns minutos.", 429);
  return ok(await researchName(nome));
}
