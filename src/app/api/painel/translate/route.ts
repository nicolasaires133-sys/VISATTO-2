// Traduz o cardápio (pratos e categorias) para os idiomas ligados em Configurações. Só traduz o que ainda não tem tradução.
import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { loadMenu } from "@/lib/menu";
import { translateMenu } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const langs = (Array.isArray(b.langs) ? b.langs : []).filter((l: string) => l === "en" || l === "es") as ("en" | "es")[];
  if (!langs.length) return fail("Escolha pelo menos um idioma.");
  const db = await getDB();
  await db.query(`UPDATE restaurants SET languages=$2::jsonb WHERE id=$1`, [r.id, JSON.stringify(langs)]);
  const { categories, items } = await loadMenu(r.id, { withImages: false });
  const need = <T extends { translations?: any }>(x: T) => langs.some((l) => !x.translations?.[l]?.name);
  const entries = [
    ...items.filter(need).map((i) => ({ id: `i:${i.id}`, name: i.name, description: i.description || "" })),
    ...categories.filter(need).map((c) => ({ id: `c:${c.id}`, name: c.name, description: "" })),
  ];
  if (!entries.length) return ok({ translated: 0, total: items.length });
  let out;
  try {
    out = await translateMenu(entries, langs);
  } catch (e: any) {
    return fail(e?.message || "Não foi possível traduzir agora. Tente de novo.", 502);
  }
  let n = 0;
  for (const [key, tr] of Object.entries(out)) {
    const [kind, id] = [key.slice(0, 1), key.slice(2)];
    const table = kind === "i" ? "items" : "categories";
    await db.query(`UPDATE ${table} SET translations = COALESCE(translations,'{}'::jsonb) || $3::jsonb WHERE id=$1 AND restaurant_id=$2`, [id, r.id, JSON.stringify(tr)]);
    n++;
  }
  return ok({ translated: n, total: entries.length });
}

/** Desliga os idiomas (o cardápio volta a ser só em português). */
export async function DELETE() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const db = await getDB();
  await db.query(`UPDATE restaurants SET languages='[]'::jsonb WHERE id=$1`, [r.id]);
  return ok({ ok: true });
}
