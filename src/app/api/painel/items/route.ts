import { NextResponse } from "next/server";
import { getDB, newId } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { loadMenu } from "@/lib/menu";
import { storeImage } from "@/lib/images";
import { itemFields } from "./fields";

export async function GET() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  return ok(await loadMenu(r.id));
}

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const f = itemFields(b);
  if (!f.name) return fail("Informe o nome do prato.");
  if (f.image.length > 3_000_000) return fail("Imagem muito grande.");
  if (f.image.startsWith("data:")) {
    try {
      f.image = await storeImage(r.id, f.image);
    } catch {
      return fail("Não foi possível ler essa imagem. Tente outra foto (JPG ou PNG).");
    }
  }
  const db = await getDB();
  const [{ max }] = await db.query<{ max: number }>(
    `SELECT COALESCE(MAX(position), -1)::int AS max FROM items WHERE restaurant_id=$1`,
    [r.id]
  );
  const id = newId();
  await db.query(
    `INSERT INTO items (id, restaurant_id, category_id, name, description, price_cents, image, serves, tags, available, featured, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [id, r.id, f.category_id, f.name, f.description, f.price_cents, f.image, f.serves, JSON.stringify(f.tags), f.available, f.featured, Number(max) + 1]
  );
  return ok({ id });
}
