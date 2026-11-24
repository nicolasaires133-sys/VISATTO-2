import { NextResponse } from "next/server";
import { getDB, newId } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";

// Salva a prévia (já revisada pelo dono) como categorias + itens.
export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const cats = Array.isArray(b.categories) ? b.categories : [];
  if (!cats.length) return fail("Nada para salvar.");
  const db = await getDB();
  const [{ cmax }] = await db.query<{ cmax: number }>(
    `SELECT COALESCE(MAX(position), -1)::int AS cmax FROM categories WHERE restaurant_id=$1`,
    [r.id]
  );
  const [{ imax }] = await db.query<{ imax: number }>(
    `SELECT COALESCE(MAX(position), -1)::int AS imax FROM items WHERE restaurant_id=$1`,
    [r.id]
  );
  let cpos = Number(cmax) + 1;
  let ipos = Number(imax) + 1;
  let count = 0;
  for (const c of cats.slice(0, 40)) {
    const name = String(c.name || "Outros").trim().slice(0, 60);
    const existing = await db.query<{ id: string }>(
      `SELECT id FROM categories WHERE restaurant_id=$1 AND lower(name)=lower($2)`,
      [r.id, name]
    );
    const cid = existing[0]?.id ?? newId();
    if (!existing[0]) {
      await db.query(`INSERT INTO categories (id, restaurant_id, name, position) VALUES ($1,$2,$3,$4)`, [cid, r.id, name, cpos++]);
    }
    for (const i of (Array.isArray(c.items) ? c.items : []).slice(0, 200)) {
      const iname = String(i.name || "").trim().slice(0, 100);
      if (!iname) continue;
      await db.query(
        `INSERT INTO items (id, restaurant_id, category_id, name, description, price_cents, serves, tags, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          newId(),
          r.id,
          cid,
          iname,
          String(i.description || "").slice(0, 500),
          Math.max(0, Math.round(Number(i.price_cents) || 0)),
          Math.max(1, Number(i.serves) || 1),
          JSON.stringify(Array.isArray(i.tags) ? i.tags.slice(0, 8) : []),
          ipos++,
        ]
      );
      count++;
    }
  }
  return ok({ count });
}
