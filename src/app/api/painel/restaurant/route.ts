import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok, fail, toCents } from "@/lib/http";
import { aiEnabled, waiterEnabled } from "@/lib/ai";
import { readLoyalty } from "@/lib/loyalty";
import { readMode, readPayMethods, readZones } from "@/lib/delivery";
import { normalizePixKey } from "@/lib/pix";

export async function GET() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  // números para o "primeiros passos" do painel
  const db = await getDB();
  const [c] = await db.query<{ items: number; models: number; orders: number }>(
    `SELECT (SELECT COUNT(*)::int FROM items WHERE restaurant_id=$1) AS items,
            (SELECT COUNT(*)::int FROM items WHERE restaurant_id=$1 AND model_status='pronto' AND model_published) AS models,
            (SELECT COUNT(*)::int FROM orders WHERE restaurant_id=$1) AS orders`,
    [r.id]
  );
  const { readHours } = await import("@/lib/hours");
  return ok({ restaurant: { ...r, loyalty: readLoyalty(r.loyalty), hours: readHours(r.hours), delivery_zones: readZones(r.delivery_zones), delivery_mode: readMode(r.delivery_mode), pay_methods: readPayMethods(r.pay_methods) }, aiEnabled: aiEnabled(), waiter: waiterEnabled(), counts: c });
}

export async function PUT(req: Request) {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? r.name).trim();
  if (name.length < 2) return fail("Nome inválido.");
  const color = /^#[0-9a-fA-F]{6}$/.test(b.primary_color) ? b.primary_color : r.primary_color;
  const review = String(b.google_review_url ?? "").trim();
  if (review && !reviewUrl(review)) return fail("O link de avaliação precisa ser do Google (começa com https://g.page, https://maps.app.goo.gl ou https://www.google.com).");
  const prevL = readLoyalty(r.loyalty);
  const bl = b.loyalty && typeof b.loyalty === "object" ? b.loyalty : null;
  if (bl?.on && !String(bl.reward || "").trim()) return fail("Escreva qual é o prêmio do cartão fidelidade.");
  const loyalty = bl
    ? readLoyalty({ on: Boolean(bl.on), goal: bl.goal, min_cents: bl.min_cents != null ? toCents(bl.min_cents) : prevL.min_cents, reward: bl.reward })
    : prevL;
  const { readHours } = await import("@/lib/hours");
  const hours = b.hours && typeof b.hours === "object" ? readHours(b.hours) : readHours(r.hours);
  // entrega, retirada e Pix
  const mode = b.delivery_mode != null ? readMode(b.delivery_mode) : readMode(r.delivery_mode);
  const zones = b.delivery_zones != null ? readZones((Array.isArray(b.delivery_zones) ? b.delivery_zones : []).map((z: any) => ({ name: z?.name, fee_cents: typeof z?.fee_cents === "number" ? z.fee_cents : toCents(z?.fee ?? z?.fee_cents ?? 0) }))) : readZones(r.delivery_zones);
  if (mode === "bairro" && !zones.length) return fail("Cadastre pelo menos um bairro com a taxa de entrega (ou use taxa fixa).");
  const payMethods = b.pay_methods != null ? readPayMethods(b.pay_methods) : readPayMethods(r.pay_methods);
  // o painel diz o tipo da chave: assim um celular digitado sem parênteses não vira CPF
  let pixKey = String(b.pix_key ?? r.pix_key ?? "").trim().slice(0, 120);
  let pt = String(b.pix_key_type ?? "");
  if (pixKey.includes("@")) pt = "email";
  else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pixKey)) pt = "aleatoria";
  else if (pixKey === r.pix_key) pt = ""; // não mexeu na chave: fica como está
  if (pixKey && pt === "celular") pixKey = `+55${pixKey.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`;
  else if (pixKey && pt === "documento") pixKey = pixKey.replace(/\D/g, "");
  else if (pixKey && (pt === "email" || pt === "aleatoria")) pixKey = pixKey.toLowerCase();
  if (pixKey && pixKey !== r.pix_key && !validPixKey(pixKey)) return fail("A chave Pix parece incompleta. Use CPF, CNPJ, celular com DDD, e-mail ou a chave aleatória.");
  const img = (v: unknown, prev: string) => { if (v == null) return prev || ""; const s = String(v).trim(); return s === "" || /^https:\/\//.test(s) || /^\/[a-z0-9/_.-]+$/i.test(s) ? s.slice(0, 500) : prev || ""; };
  const eta = (v: unknown, prev: string) => String(v ?? prev ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const service = b.service_pct != null ? Math.min(20, Math.max(0, Math.round(Number(b.service_pct) || 0))) : (r.service_pct ?? 10);
  const db = await getDB();
  await db.query(
    `UPDATE restaurants SET service_pct=$16, loyalty=$17::jsonb, name=$2, whatsapp=$3, address=$4, primary_color=$5, delivery_enabled=$6,
       dine_in_enabled=$7, delivery_fee_cents=$8, min_order_cents=$9, ai_name=$10, ai_tone=$11, ai_instructions=$12,
       accepting_orders=$13, pix_key=$14, google_review_url=$15, hours=$18::jsonb,
       logo_url=$19, cover_url=$20, pickup_enabled=$21, pickup_eta=$22, delivery_eta=$23, delivery_mode=$24,
       delivery_zones=$25::jsonb, free_delivery_cents=$26, pix_name=$27, pix_city=$28, pay_methods=$29::jsonb,
       menu_theme=$30
     WHERE id=$1`,
    [
      r.id,
      name,
      String(b.whatsapp ?? r.whatsapp).replace(/\D/g, ""),
      String(b.address ?? r.address).slice(0, 200),
      color,
      Boolean(b.delivery_enabled ?? r.delivery_enabled),
      Boolean(b.dine_in_enabled ?? r.dine_in_enabled),
      b.delivery_fee_cents != null ? toCents(b.delivery_fee_cents) : r.delivery_fee_cents,
      b.min_order_cents != null ? toCents(b.min_order_cents) : r.min_order_cents,
      String(b.ai_name ?? r.ai_name).slice(0, 40) || "Garçom",
      String(b.ai_tone ?? r.ai_tone).slice(0, 120),
      String(b.ai_instructions ?? r.ai_instructions).slice(0, 2000),
      Boolean(b.accepting_orders ?? r.accepting_orders ?? true),
      pixKey,
      reviewUrl(b.google_review_url ?? r.google_review_url),
      service,
      JSON.stringify(loyalty),
      JSON.stringify(hours),
      img(b.logo_url, r.logo_url),
      img(b.cover_url, r.cover_url),
      Boolean(b.pickup_enabled ?? r.pickup_enabled ?? false),
      eta(b.pickup_eta, r.pickup_eta),
      eta(b.delivery_eta, r.delivery_eta),
      mode,
      JSON.stringify(zones),
      b.free_delivery_cents != null ? toCents(b.free_delivery_cents) : (r.free_delivery_cents ?? 0),
      String(b.pix_name ?? r.pix_name ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
      String(b.pix_city ?? r.pix_city ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
      JSON.stringify(payMethods),
      ["claro", "escuro", "auto"].includes(b.menu_theme) ? b.menu_theme : r.menu_theme || "claro",
    ]
  );
  return ok({ ok: true });
}

/** Só aceita links do Google (perfil ou "pedir avaliações"), para o cliente não ser mandado a outro lugar. */
function reviewUrl(v: unknown) {
  const s = String(v ?? "").trim().slice(0, 300);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && /(^|\.)(google\.[a-z.]+|g\.page|goo\.gl|maps\.app\.goo\.gl)$/i.test(u.hostname)) return u.toString();
  } catch {}
  return "";
}

/** Confere o formato da chave Pix (o banco recusaria o código se estiver errada). */
function validPixKey(raw: string) {
  const k = normalizePixKey(raw);
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(k)) return true; // e-mail
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return true; // aleatória
  if (/^\+55\d{10,11}$/.test(k)) return true; // celular
  if (/^\d{11}$/.test(k) || /^\d{14}$/.test(k)) return true; // CPF ou CNPJ
  return false;
}
