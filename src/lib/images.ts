// Fotos do cardápio: o painel manda a foto já reduzida; aqui ela vira um arquivo WebP leve no armazenamento.
// (Guardar a foto dentro do banco deixava o cardápio pesado: todas as fotos vinham juntas a cada abertura.)
import { getDB } from "./db";
import { dataUrlToBuffer, putFile } from "./storage";

export async function storeImage(restaurantId: string, dataUrl: string): Promise<string> {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed || !/^image\/(jpeg|png|webp)$/.test(parsed.type)) throw new Error("Imagem inválida.");
  const sharp = (await import("sharp")).default;
  const out = await sharp(parsed.buf, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(900, 900, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return putFile(`uploads/${restaurantId}/foto.webp`, out, "image/webp");
}

/** Converte fotos antigas que ainda estão dentro do banco (uma vez só por foto). */
export async function migrateInlineImages(restaurantId: string) {
  const db = await getDB();
  const rows = await db.query<{ id: string; image: string }>(
    `SELECT id, image FROM items WHERE restaurant_id=$1 AND image LIKE 'data:%' LIMIT 40`,
    [restaurantId]
  );
  for (const r of rows) {
    try {
      const url = await storeImage(restaurantId, r.image);
      await db.query(`UPDATE items SET image=$2 WHERE id=$1`, [r.id, url]);
    } catch {
      await db.query(`UPDATE items SET image='' WHERE id=$1`, [r.id]);
    }
  }
  return rows.length;
}
