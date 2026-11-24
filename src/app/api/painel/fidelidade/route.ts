import { NextResponse } from "next/server";
import { owner, ok, fail } from "@/lib/http";
import { cleanPhone, readLoyalty, redeem, stampsOf } from "@/lib/loyalty";

// A equipe entregou o prêmio do cartão fidelidade: o cartão desse WhatsApp recomeça do zero.
export async function POST(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const phone = cleanPhone(b.phone);
  const l = readLoyalty(r.loyalty);
  if (!l.on) return fail("O cartão fidelidade está desligado.");
  const s = await stampsOf(r.id, phone, l);
  if (!s.ready) return fail("Este cliente ainda não completou o cartão.");
  await redeem(r.id, phone, String(b.orderId || "").slice(0, 40));
  return ok({ ok: true });
}
