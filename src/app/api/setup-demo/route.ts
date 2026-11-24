import { ok, fail } from "@/lib/http";
import { ensureDemo, DEMO_EMAIL } from "@/lib/demo";

// Cria o restaurante de demonstração "Cantina da Nonna" com a senha conhecida (para testes).
// Em produção não é preciso: o cardápio de exemplo se cria sozinho na primeira visita.
export async function GET(req: Request) {
  const key = process.env.SETUP_KEY || (process.env.NODE_ENV !== "production" ? "dev" : "");
  const given = new URL(req.url).searchParams.get("chave");
  if (!key || given !== key) return fail("Acesso negado.", 403);
  const r = await ensureDemo(false);
  if (!r.created) return ok({ ok: true, message: "A demonstração já existe.", url: "/r/cantina-da-nonna?mesa=7" });
  return ok({ ok: true, message: "Demonstração criada.", url: "/r/cantina-da-nonna?mesa=7", painel: { email: DEMO_EMAIL, senha: r.password } });
}
