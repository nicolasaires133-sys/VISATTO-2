import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";
import { storeImage } from "@/lib/images";
import { itemFields } from "../fields";
import { deleteFile } from "@/lib/storage";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const db = await getDB();

  // Atualização rápida (ex.: marcar esgotado) sem mandar o item inteiro
  if (b.quick) {
    if (b.available != null)
      await db.query(`UPDATE items SET available=$3 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, Boolean(b.available)]);
    if (b.featured != null)
      await db.query(`UPDATE items SET featured=$3 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, Boolean(b.featured)]);
    if (b.promote != null)
      await db.query(`UPDATE items SET promote=$3 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, Boolean(b.promote)]);
    return ok({ ok: true });
  }

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
  const [prev] = await db.query<{ image: string; name: string; description: string }>(
    `SELECT image, name, description FROM items WHERE id=$1 AND restaurant_id=$2`,
    [id, r.id]
  );
  if (!prev) return fail("Prato não encontrado.", 404);
  // texto mudou: a tradução antiga deixa de valer (é refeita no botão "Traduzir")
  const textChanged = prev.name !== f.name || (prev.description || "") !== f.description;
  await db.query(
    `UPDATE items SET category_id=$3, name=$4, description=$5, price_cents=$6, image=$7, serves=$8, tags=$9::jsonb,
            available=$10, featured=$11, allergens=$12::jsonb, allergens_known=$13, pairs=$14::jsonb, promote=$15,
            substitute_id=$16, dayparts=$17::jsonb, cost_cents=$18
            ${textChanged ? ", translations='{}'::jsonb" : ""}
      WHERE id=$1 AND restaurant_id=$2`,
    [id, r.id, f.category_id, f.name, f.description, f.price_cents, f.image, f.serves, JSON.stringify(f.tags), f.available, f.featured,
     JSON.stringify(f.allergens), f.allergens_known, JSON.stringify(f.pairs.filter((x) => x !== id)), f.promote,
     f.substitute_id === id ? "" : f.substitute_id, JSON.stringify(f.dayparts), f.cost_cents]
  );
  await db.query(`UPDATE items SET options=$3::jsonb, promo=$4::jsonb, caption=$5, photo_mode=$6 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, JSON.stringify(f.options), JSON.stringify(f.promo ?? {}), f.caption, f.photo_mode]);
  if (prev.image && prev.image !== f.image) await deleteFile(prev.image);
  return ok({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const db = await getDB();
  const [row] = await db.query(
    `DELETE FROM items WHERE id=$1 AND restaurant_id=$2 RETURNING image, model_glb_url, model_usdz_url, model_src_url`,
    [id, r.id]
  );
  if (row) await Promise.all([deleteFile(row.image), deleteFile(row.model_glb_url), deleteFile(row.model_usdz_url), deleteFile(row.model_src_url)]);
  return ok({ ok: true });
}
