import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const db = await getDB();
  if (b.name != null) {
    await db.query(`UPDATE categories SET name=$3 WHERE id=$1 AND restaurant_id=$2`, [
      id,
      r.id,
      String(b.name).trim().slice(0, 60),
    ]);
  }
  if (b.icon != null) {
    const { CATEGORY_ICONS } = await import("@/lib/catIcons");
    const icon = CATEGORY_ICONS.some((c) => c.id === b.icon) ? String(b.icon) : "";
    await db.query(`UPDATE categories SET icon=$3 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, icon]);
  }
  if (b.position != null) {
    await db.query(`UPDATE categories SET position=$3 WHERE id=$1 AND restaurant_id=$2`, [id, r.id, Number(b.position)]);
  }
  return ok({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const { id } = await ctx.params;
  const db = await getDB();
  await db.query(`DELETE FROM categories WHERE id=$1 AND restaurant_id=$2`, [id, r.id]);
  return ok({ ok: true });
}
