// Entrega e retirada: taxa (fixa ou por bairro), entrega grátis acima de um valor, pedido mínimo e endereço do cliente.
// Usado igual no celular do cliente (para mostrar) e no servidor (que é quem decide o valor de verdade).

export type Zone = { name: string; fee_cents: number };
export type DeliveryMode = "fixa" | "bairro";
export type Address = { cep: string; street: string; number: string; complement: string; district: string; city: string; reference: string };

export const EMPTY_ADDRESS: Address = { cep: "", street: "", number: "", complement: "", district: "", city: "", reference: "" };

const cents = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100_000_00, Math.max(0, n)) : 0;
};
/** Compara nomes de bairro sem acento, maiúscula ou espaço sobrando ("Bela  Vista" = "bela vista"). */
export const zoneKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function readZones(raw: unknown): Zone[] {
  let v = raw;
  if (typeof v === "string") try { v = JSON.parse(v); } catch { v = []; }
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Zone[] = [];
  for (const z of v) {
    const name = String((z as any)?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name || seen.has(zoneKey(name))) continue;
    seen.add(zoneKey(name));
    out.push({ name, fee_cents: cents((z as any)?.fee_cents) });
    if (out.length >= 150) break;
  }
  return out;
}

export function readMode(raw: unknown): DeliveryMode {
  return raw === "bairro" ? "bairro" : "fixa";
}

export const PAY_METHODS = ["pix", "cartao", "dinheiro"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export function readPayMethods(raw: unknown): PayMethod[] {
  let v = raw;
  if (typeof v === "string") try { v = JSON.parse(v); } catch { v = null; }
  const list = Array.isArray(v) ? PAY_METHODS.filter((m) => v.includes(m)) : [...PAY_METHODS];
  return list.length ? list : [...PAY_METHODS];
}

type R = { delivery_fee_cents?: number; delivery_mode?: unknown; delivery_zones?: unknown; free_delivery_cents?: number; min_order_cents?: number };

/**
 * Quanto custa a entrega.
 * - retirada: sempre grátis
 * - fixa: o mesmo valor para todo mundo
 * - bairro: o valor do bairro escolhido; bairro fora da lista não é atendido
 * - entrega grátis quando o subtotal passa do valor que a loja definiu
 */
export function deliveryQuote(r: R, o: { pickup: boolean; zone?: string; subtotal: number }): { ok: true; fee: number; free: boolean } | { ok: false; error: string } {
  if (o.pickup) return { ok: true, fee: 0, free: false };
  const freeAbove = cents(r.free_delivery_cents);
  let fee = cents(r.delivery_fee_cents);
  if (readMode(r.delivery_mode) === "bairro") {
    const zones = readZones(r.delivery_zones);
    if (zones.length) {
      const z = zones.find((x) => zoneKey(x.name) === zoneKey(o.zone || ""));
      if (!o.zone?.trim()) return { ok: false, error: "Escolha o seu bairro para calcular a entrega." };
      if (!z) return { ok: false, error: "Ainda não entregamos neste bairro." };
      fee = z.fee_cents;
    }
  }
  if (freeAbove > 0 && o.subtotal >= freeAbove) return { ok: true, fee: 0, free: true };
  return { ok: true, fee, free: false };
}

export function readAddress(raw: unknown): Address {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (k: keyof Address, max: number) => String(a[k] ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return {
    cep: String(a.cep ?? "").replace(/\D/g, "").slice(0, 8),
    street: s("street", 120),
    number: s("number", 12),
    complement: s("complement", 60),
    district: s("district", 60),
    city: s("city", 60),
    reference: s("reference", 120),
  };
}

/** O que falta no endereço (vazio = está completo). */
export function addressProblem(a: Address): string {
  if (a.street.length < 3) return "Informe a rua.";
  if (!a.number) return "Informe o número (ou escreva S/N).";
  if (a.district.length < 2) return "Informe o bairro.";
  if (a.cep && a.cep.length !== 8) return "O CEP tem 8 números.";
  return "";
}

/** Uma linha para a comanda, o WhatsApp e o motoboy. */
export function formatAddress(a: Address): string {
  return [
    [a.street, a.number].filter(Boolean).join(", "),
    a.complement,
    a.district,
    a.city,
    a.cep ? `CEP ${a.cep.slice(0, 5)}-${a.cep.slice(5)}` : "",
    a.reference ? `Ref.: ${a.reference}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
