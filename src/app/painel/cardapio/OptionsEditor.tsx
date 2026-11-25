"use client";
// Opções e adicionais (tamanho, ponto da carne, adicionais...) e preço promocional com horário.
import Icon from "@/components/Icon";
import { OPTION_TEMPLATES, type OptionGroup, type Promo } from "@/lib/options";

export type EditChoice = { id: string; name: string; price: string };
export type EditGroup = { id: string; name: string; required: boolean; max: number; choices: EditChoice[] };
export type EditPromo = { on: boolean; price: string; days: number[]; hours: boolean; from: string; to: string };

const money = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
const rid = () => Math.random().toString(36).slice(2, 9);
/** "12,50" ou "12.50" -> centavos */
const cents = (s: string) => {
  const n = Number(String(s || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

export const toEditGroups = (g?: OptionGroup[]): EditGroup[] =>
  (g ?? []).map((x) => ({ id: x.id, name: x.name, required: x.min > 0, max: x.max, choices: x.choices.map((c) => ({ id: c.id, name: c.name, price: money(c.price_cents) })) }));
export const fromEditGroups = (g: EditGroup[]) =>
  g
    .map((x) => {
      const choices = x.choices.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name.trim(), price_cents: cents(c.price) }));
      const max = Math.max(1, Math.min(x.max, choices.length || 1));
      return { id: x.id, name: x.name.trim(), min: x.required ? 1 : 0, max, choices };
    })
    .filter((x) => x.name && x.choices.length);

export const toEditPromo = (p?: Promo): EditPromo =>
  p ? { on: true, price: money(p.price_cents), days: p.days, hours: !!(p.from && p.to), from: p.from || "17:00", to: p.to || "19:00" } : { on: false, price: "", days: [], hours: false, from: "17:00", to: "19:00" };
export const fromEditPromo = (p: EditPromo) =>
  p.on && cents(p.price) ? { price_cents: cents(p.price), days: p.days, from: p.hours ? p.from : "", to: p.hours ? p.to : "" } : null;

export function OptionsEditor({ groups, onChange }: { groups: EditGroup[]; onChange: (g: EditGroup[]) => void }) {
  const set = (i: number, patch: Partial<EditGroup>) => onChange(groups.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  const setChoice = (i: number, j: number, patch: Partial<EditChoice>) => set(i, { choices: groups[i].choices.map((c, k) => (k === j ? { ...c, ...patch } : c)) });
  return (
    <section className="rounded-2xl p-4 ring-1 ring-black/10">
      <h3 className="text-[16px] font-bold">Opções e adicionais</h3>
      <p className="mt-0.5 text-[13.5px] text-black/55">Tamanho, ponto da carne, acompanhamento, adicionais pagos. O cliente escolhe na tela do prato e o preço muda sozinho.</p>

      <div className="mt-3 space-y-3">
        {groups.map((g, i) => (
          <div key={g.id} className="rounded-xl bg-cream p-3">
            <div className="flex items-center gap-2">
              <input aria-label="Nome do grupo" className="input h-10 flex-1 font-semibold" maxLength={40} value={g.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Ex.: Tamanho" />
              <button type="button" aria-label={`Apagar ${g.name || "grupo"}`} onClick={() => onChange(groups.filter((_, k) => k !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-red-700 ring-1 ring-black/10">
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
              <div className="flex rounded-lg bg-white p-0.5 font-semibold ring-1 ring-black/10">
                <button type="button" aria-pressed={g.required} onClick={() => set(i, { required: true })} className={`rounded-md px-2.5 py-1.5 ${g.required ? "bg-ink text-white" : "text-black/60"}`}>Obrigatório</button>
                <button type="button" aria-pressed={!g.required} onClick={() => set(i, { required: false })} className={`rounded-md px-2.5 py-1.5 ${!g.required ? "bg-ink text-white" : "text-black/60"}`}>Opcional</button>
              </div>
              <label className="flex items-center gap-1.5 text-black/70">
                Pode escolher
                <select className="input h-9 w-auto py-1" value={g.max} onChange={(e) => set(i, { max: Number(e.target.value) })}>
                  {Array.from({ length: Math.max(1, g.choices.length) }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? "só 1" : `até ${n}`}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 space-y-1.5">
              {g.choices.map((c, j) => (
                <div key={c.id} className="flex items-center gap-2">
                  <input aria-label="Opção" className="input h-10 flex-1" maxLength={50} value={c.name} onChange={(e) => setChoice(i, j, { name: e.target.value })} placeholder="Ex.: Grande" />
                  <div className="relative w-28 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-black/60">+ R$</span>
                    <input aria-label={`Preço a mais de ${c.name || "opção"}`} className="input h-10 pl-11" inputMode="decimal" value={c.price} onChange={(e) => setChoice(i, j, { price: e.target.value })} placeholder="0" />
                  </div>
                  <button type="button" aria-label={`Tirar ${c.name || "opção"}`} onClick={() => set(i, { choices: g.choices.filter((_, k) => k !== j), max: Math.min(g.max, Math.max(1, g.choices.length - 1)) })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-black/60 hover:bg-black/5">
                    <Icon name="close" size={15} />
                  </button>
                </div>
              ))}
              {g.choices.length < 20 && (
                <button type="button" onClick={() => set(i, { choices: [...g.choices, { id: rid(), name: "", price: "" }] })} className="mt-1 inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand">
                  <Icon name="plus" size={15} /> Adicionar opção
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {groups.length < 8 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[13px] font-semibold text-black/60">{groups.length ? "Adicionar outro grupo" : "Comece com um modelo pronto"}</p>
          <div className="flex flex-wrap gap-1.5">
            {OPTION_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => onChange([...groups, { ...toEditGroups([{ ...t.group, id: rid() }])[0] }])}
                className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[13.5px] font-semibold text-black/75 hover:bg-black/10"
              >
                + {t.label}
              </button>
            ))}
            <button type="button" onClick={() => onChange([...groups, { id: rid(), name: "", required: false, max: 1, choices: [{ id: rid(), name: "", price: "" }] }])} className="rounded-full bg-black/[0.06] px-3 py-1.5 text-[13.5px] font-semibold text-black/75 hover:bg-black/10">
              + Em branco
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PromoEditor({ p, onChange, price }: { p: EditPromo; onChange: (p: EditPromo) => void; price: string }) {
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${on ? "bg-ink text-white" : "bg-black/[0.06] text-black/70 hover:bg-black/10"}`;
  const normal = cents(price);
  const promo = cents(p.price);
  const bad = p.on && promo > 0 && normal > 0 && promo >= normal;
  return (
    <section className="rounded-2xl bg-cream p-4">
      <label className="flex items-start justify-between gap-3">
        <span>
          <b className="block text-[15px]">Preço promocional</b>
          <span className="text-[13.5px] text-black/60">O cliente vê o preço normal riscado. Dá para valer só em alguns dias e horários (happy hour).</span>
        </span>
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#172033]" checked={p.on} onChange={(e) => onChange({ ...p, on: e.target.checked })} />
      </label>
      {p.on && (
        <div className="mt-3 space-y-3">
          <div className="max-w-40">
            <label className="label" htmlFor="promo-preco">Preço na promoção (R$)</label>
            <input id="promo-preco" className="input" inputMode="decimal" value={p.price} onChange={(e) => onChange({ ...p, price: e.target.value })} placeholder="29,90" />
          </div>
          {bad && <p className="text-[13px] font-semibold text-red-700">O preço da promoção precisa ser menor que o preço normal.</p>}
          <div>
            <p className="label">Dias</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={!p.days.length} onClick={() => onChange({ ...p, days: [] })} className={chip(!p.days.length)}>Todos</button>
              {DAYS.map((d, i) => (
                <button key={d} type="button" aria-pressed={p.days.includes(i)} onClick={() => onChange({ ...p, days: p.days.includes(i) ? p.days.filter((x) => x !== i) : [...p.days, i].sort() })} className={chip(p.days.includes(i))}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-[14px]">
            <input type="checkbox" className="h-5 w-5 accent-[#172033]" checked={p.hours} onChange={(e) => onChange({ ...p, hours: e.target.checked })} />
            Só em um horário
          </label>
          {p.hours && (
            <div className="flex items-center gap-2 text-[14px]">
              das <input aria-label="Começa às" type="time" className="input h-10 w-auto" value={p.from} onChange={(e) => onChange({ ...p, from: e.target.value })} />
              às <input aria-label="Termina às" type="time" className="input h-10 w-auto" value={p.to} onChange={(e) => onChange({ ...p, to: e.target.value })} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
