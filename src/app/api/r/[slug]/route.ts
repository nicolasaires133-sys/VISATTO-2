import { ok, fail } from "@/lib/http";
import { publicMenu } from "@/lib/menu";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const menu = await publicMenu(slug);
  if (!menu) return fail("Restaurante não encontrado.", 404);
  return ok(menu);
}
