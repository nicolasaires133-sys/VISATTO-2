// Horário de funcionamento: o cardápio mostra "Aberto até 23h" ou "Fechado, abre às 18h"
// e, se o dono quiser, os pedidos pelo celular só entram dentro do horário.
import { brNow } from "./options";

export type DayHours = { from: string; to: string } | null; // null = fechado nesse dia
export type Hours = { on: boolean; days: DayHours[] }; // days[0] = domingo ... days[6] = sábado

export const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DEFAULT_HOURS: Hours = { on: false, days: [null, ...Array(6).fill({ from: "11:00", to: "23:00" })] };

const hm = (s: unknown) => (typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : "");
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export const fmtHour = (s: string) => (s.endsWith(":00") ? `${Number(s.slice(0, 2))}h` : `${Number(s.slice(0, 2))}h${s.slice(3)}`);

export function readHours(raw: unknown): Hours {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (!v || typeof v !== "object" || !Array.isArray((v as any).days)) return DEFAULT_HOURS;
  const days: DayHours[] = [];
  for (let i = 0; i < 7; i++) {
    const d = (v as any).days[i];
    const from = hm(d?.from), to = hm(d?.to);
    days.push(from && to && from !== to ? { from, to } : null);
  }
  return { on: Boolean((v as any).on) && days.some(Boolean), days };
}

/** Está aberto agora? E o texto curto para mostrar ao cliente. */
export function openState(h: Hours, at: Date = new Date()): { open: boolean; label: string } {
  if (!h.on) return { open: true, label: "" };
  const { day, min } = brNow(at);
  const inDay = (d: number, m: number) => {
    const x = h.days[d];
    if (!x) return false;
    const a = toMin(x.from), b = toMin(x.to);
    return a < b ? m >= a && m < b : m >= a; // vira a noite: a parte depois da meia-noite é do dia anterior
  };
  // ontem, se o horário de ontem passou da meia-noite
  const y = h.days[(day + 6) % 7];
  const fromYesterday = y && toMin(y.from) > toMin(y.to) && min < toMin(y.to);
  if (inDay(day, min) || fromYesterday) {
    const closes = fromYesterday ? y!.to : h.days[day]!.to;
    return { open: true, label: `Aberto até ${fmtHour(closes)}` };
  }
  // próxima abertura
  for (let k = 0; k < 8; k++) {
    const d = (day + k) % 7, x = h.days[d];
    if (!x) continue;
    if (k === 0 && toMin(x.from) <= min) continue;
    const when = k === 0 ? "hoje" : k === 1 ? "amanhã" : DAY_NAMES[d];
    return { open: false, label: `Fechado agora · abre ${when} às ${fmtHour(x.from)}` };
  }
  return { open: false, label: "Fechado agora" };
}
