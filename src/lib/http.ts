import { NextResponse } from "next/server";
import { currentRestaurant } from "./auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ...extra, error: message }, { status });
}

/** Garante que há um dono logado. Uso: const r = await owner(); if (r instanceof NextResponse) return r; */
export async function owner() {
  const r = await currentRestaurant();
  if (!r) return fail("Faça login para continuar.", 401);
  return r;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "restaurante";
}

export function toCents(v: unknown): number {
  if (typeof v === "number") return Math.max(0, Math.round(v));
  if (typeof v === "string") {
    let t = v.replace(/[^0-9.,]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
    const n = Number(t);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
  }
  return 0;
}
