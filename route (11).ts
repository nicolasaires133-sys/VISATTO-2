import { NextResponse } from "next/server";
import { getDB, newId } from "@/lib/db";
import { owner, ok, fail } from "@/lib/http";

export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 60);
  if (!name) return fail("Informe o nome da categoria.");
  const db = await getDB();
  const [{ max }] = await db.query<{ max: number }>(
    `SELECT COALESCE(MAX(position), -1)::int AS max FROM categories WHERE restaurant_id=$1`,
    [r.id]
  );
  const id = newId();
  await db.query(`INSERT INTO categories (id, restaurant_id, name, position) VALUES ($1,$2,$3,$4)`, [
    id,
    r.id,
    name,
    Number(max) + 1,
  ]);
  return ok({ id });
}
