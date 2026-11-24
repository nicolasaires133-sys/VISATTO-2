"use client";
// Conta da mesa pelo celular: confere tudo o que a mesa pediu, divide (igual ou "só o que eu comi"),
// escolhe se paga a taxa de serviço e paga com Pix já com o valor, ou chama a equipe com a maquininha.
// Nenhuma taxa é cobrada do cliente, e nada vem marcado sem ele escolher.
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { brl } from "@/lib/format";
import Rate from "../Rate";

type Line = { id: string; order_id: string; name: string; qty: number; price_cents: number; notes: string };
type Bill = {
  table: string;
  orders: { id: string; number: number; status: string; created_at: string }[];
  items: Line[];
  subtotal_cents: number;
  service_pct: number;
  pix: boolean;
  demo?: boolean;
  pending: { amount_cents: number; method: string; created_at: string } | null;
  restaurant: { name: string; primary_color: string; google_review_url: string };
};
type Mode = "tudo" | "dividir" | "itens";

export default function Conta({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> }) {
  const { slug } = use(params);
  const { mesa = "" } = use(searchParams);
  const [table, setTable] = useState(mesa);
  const [typed, setTyped] = useState(mesa);
  const [bill, setBill] = useState<Bill | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<Mode>("tudo");
  const [people, setPeople] = useState(2);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [service, setService] = useState(true);
  const [pix, setPix] = useState<{ code: string; img: string; amount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState<{ method: string; amount: number; order: string } | null>(null);

  async function load(t = table) {
    if (!t.trim()) return;
    setErr("");
    try {
      setBill(await api<Bill>(`/api/r/${slug}/conta?mesa=${encodeURIComponent(t.trim())}`));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load(); // eslint-disable-line react-hooks/exhaustive-deps
  }, [table]);

  const color = bill?.restaurant.primary_color || "#E4572E";
  const pct = bill?.service_pct ?? 0;
  const base = useMemo(() => {
    if (!bill) return 0;
    if (mode === "dividir") return Math.ceil(bill.subtotal_cents / people);
    if (mode === "itens") return bill.items.filter((l) => mine.has(l.id)).reduce((s, l) => s + l.price_cents * l.qty, 0);
    return bill.subtotal_cents;
  }, [bill, mode, people, mine]);
  const serviceCents = service && pct > 0 ? Math.round((base * pct) / 100) : 0;
  const total = base + serviceCents;
  const part = mode !== "tudo";

  // a conta mudou de valor: o Pix gerado antes não vale mais
  useEffect(() => setPix(null), [total]);

  async function pay(method: "pix" | "pix-feito" | "cartao" | "dinheiro") {
    if (!bill || !total) return;
    setBusy(method);
    setErr("");
    try {
      if (method === "pix") {
        const res = await api<{ code: string; amount_cents: number }>(`/api/r/${slug}/conta`, { body: { table: bill.table, amount: total, method } });
        const img = await QRCode.toDataURL(res.code, { margin: 1, width: 520, errorCorrectionLevel: "M" });
        setPix({ code: res.code, img, amount: res.amount_cents });
      } else {
        const res = await api<{ last_order: string }>(`/api/r/${slug}/conta`, {
          body: { table: bill.table, amount: total, method, people: mode === "dividir" ? people : 1, part },
        });
        setSent({ method, amount: total, order: res.last_order });
        setPix(null);
      }
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy("");
  }
  async function copy() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  if (!table)
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-white px-5 pt-10">
        <h1 className="text-[28px] font-extrabold">Conta da mesa</h1>
        <form onSubmit={(e) => { e.preventDefault(); setTable(typed.trim()); }} className="mt-5">
          <label className="label" htmlFor="mesa">Número da sua mesa</label>
          <div className="flex gap-2">
            <input id="mesa" className="input h-12 max-w-32 text-lg font-bold" inputMode="numeric" maxLength={20} value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button className="btn-dark h-12 px-5">Ver a conta</button>
          </div>
        </form>
      </main>
    );

  if (!bill)
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-white px-5 py-10" aria-busy={!err}>
        {err ? (
          <>
            <h1 className="text-2xl font-extrabold">{err}</h1>
            <button onClick={() => load()} className="btn-ghost mt-5">Tentar de novo</button>
          </>
        ) : (
          <>
            <div className="skeleton h-8 w-48 rounded-lg" />
            <div className="skeleton mt-4 h-28 rounded-2xl" />
            <div className="skeleton mt-4 h-48 rounded-2xl" />
          </>
        )}
      </main>
    );

  const back = `/r/${slug}?mesa=${encodeURIComponent(bill.table)}`;
  const empty = bill.orders.length === 0;
  const cooking = bill.orders.some((o) => ["novo", "preparo", "pronto"].includes(o.status));

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-5 pb-12 pt-8">
      <p className="text-[13.5px] font-semibold text-black/55">{bill.restaurant.name} · Mesa {bill.table}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h1 className="text-[30px] font-extrabold leading-tight">Conta da mesa</h1>
        <button onClick={() => load()} aria-label="Atualizar a conta" className="btn-ghost h-10 w-10 px-0"><Icon name="refresh" size={18} /></button>
      </div>

      {empty ? (
        <section className="mt-6 rounded-2xl bg-[#efefeb] p-5">
          <p className="text-[16px] font-bold">Nenhum pedido aberto nesta mesa.</p>
          <p className="mt-1 text-[14.5px] text-black/60">Se você pediu com o garçom, a conta está com a equipe. Confira também se o número da mesa está certo.</p>
          <Link href={back} className="btn-dark mt-4 h-11 px-4">Ver o cardápio</Link>
        </section>
      ) : (
        <>
          {bill.pending && !sent && (
            <p role="status" className="mt-4 flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[14px] text-emerald-950 ring-1 ring-emerald-200">
              <Icon name="check" size={18} className="mt-0.5 shrink-0" />
              A equipe já foi avisada de um pagamento de {brl(bill.pending.amount_cents)}. Se outra pessoa da mesa vai pagar a parte dela, pode seguir.
            </p>
          )}
          {cooking && (
            <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-950">
              <Icon name="clock" size={18} className="mt-0.5 shrink-0" />
              Ainda tem pedido saindo da cozinha. Se pedirem mais alguma coisa, ela entra nesta conta.
            </p>
          )}

          <section className="mt-5" aria-label="O que a mesa pediu">
            <ul className="divide-y divide-line text-[15px]">
              {bill.items.map((l) => {
                const on = mine.has(l.id);
                const row = (
                  <>
                    <span className="min-w-0">
                      <b className="tnum">{l.qty}x</b> {l.name}
                      {l.notes ? <span className="block text-[13px] text-black/50">{l.notes}</span> : null}
                    </span>
                    <span className="tnum shrink-0">{brl(l.price_cents * l.qty)}</span>
                  </>
                );
                return mode === "itens" ? (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        style={{ accentColor: color }}
                        checked={on}
                        onChange={() => setMine((m) => { const n = new Set(m); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}
                      />
                      <span className="flex min-w-0 flex-1 justify-between gap-3">{row}</span>
                    </label>
                  </li>
                ) : (
                  <li key={l.id} className="flex justify-between gap-3 py-2.5">{row}</li>
                );
              })}
            </ul>
            <div className="flex justify-between border-t border-line pt-3 text-[15px] font-semibold">
              <span>Total da mesa</span>
              <span className="tnum">{brl(bill.subtotal_cents)}</span>
            </div>
          </section>

          <section className="mt-6" aria-label="Como dividir">
            <h2 className="text-[16px] font-bold">Quem vai pagar?</h2>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#efefeb] p-1 text-[14px] font-semibold" role="tablist">
              {([["tudo", "A conta toda"], ["dividir", "Dividir igual"], ["itens", "Só o que pedi"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`rounded-lg px-1 py-2.5 transition-colors ${mode === k ? "bg-white shadow-sm" : "text-black/55"}`}>
                  {label}
                </button>
              ))}
            </div>
            {mode === "dividir" && (
              <div className="mt-3 flex items-center justify-between rounded-xl px-1">
                <span className="text-[15px]">Dividir entre</span>
                <span className="flex items-center gap-2">
                  <button aria-label="Menos uma pessoa" onClick={() => setPeople((p) => Math.max(2, p - 1))} className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-black/15"><Icon name="minus" size={16} /></button>
                  <b className="tnum w-20 text-center text-[16px]">{people} pessoas</b>
                  <button aria-label="Mais uma pessoa" onClick={() => setPeople((p) => Math.min(30, p + 1))} className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-black/15"><Icon name="plus" size={16} /></button>
                </span>
              </div>
            )}
            {mode === "itens" && mine.size === 0 && <p className="mt-2 text-[13.5px] text-black/55">Marque na lista acima o que é seu.</p>}
          </section>

          <section className="mt-5 space-y-2 rounded-2xl bg-[#efefeb] p-4 text-[15px]" aria-label="Resumo">
            <div className="flex justify-between"><span>{mode === "tudo" ? "Consumo" : "Sua parte"}</span><span className="tnum">{brl(base)}</span></div>
            {pct > 0 && (
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <input type="checkbox" className="h-5 w-5" style={{ accentColor: color }} checked={service} onChange={(e) => setService(e.target.checked)} />
                  Taxa de serviço {pct}% <span className="text-black/50">(opcional)</span>
                </span>
                <span className="tnum">{brl(serviceCents)}</span>
              </label>
            )}
            <div className="flex justify-between border-t border-black/10 pt-2 font-display text-[21px] font-bold">
              <span>Você paga</span>
              <span className="tnum" aria-live="polite">{brl(total)}</span>
            </div>
          </section>

          {sent ? (
            <section className="animate-enter mt-6 rounded-2xl p-4 text-white" style={{ background: "#1d1a16" }} role="status">
              <p className="flex items-center gap-2 text-[17px] font-bold"><Icon name="check" size={20} stroke={2.6} /> Equipe avisada</p>
              <p className="mt-1 text-[14.5px] text-white/75">
                {sent.method === "pix-feito"
                  ? `Avisamos que você pagou ${brl(sent.amount)} no Pix. A equipe confere e fecha a mesa.`
                  : sent.method === "cartao"
                    ? `Já vão levar a maquininha para você pagar ${brl(sent.amount)}.`
                    : `Já vão até a mesa receber ${brl(sent.amount)} em dinheiro.`}
              </p>
            </section>
          ) : pix ? (
            <section className="animate-enter mt-6 rounded-2xl p-4 ring-1 ring-black/10" aria-label="Pagar com Pix">
              <h2 className="text-[17px] font-bold">Pix de {brl(pix.amount)}</h2>
              <p className="mt-1 text-[14px] text-black/60">Copie o código e cole no app do seu banco, em <b>Pix copia e cola</b>. O valor já vem preenchido.</p>
              {bill.demo && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13.5px] text-amber-950">Cardápio de exemplo: este código é só demonstração e o banco vai recusar. No seu restaurante, ele usa a sua chave Pix.</p>}
              <button onClick={copy} className="btn mt-3 h-12 w-full text-[15.5px] text-white" style={{ background: color }}>
                <Icon name={copied ? "check" : "copy"} size={18} /> {copied ? "Código copiado" : "Copiar código Pix"}
              </button>
              <details className="mt-3">
                <summary className="cursor-pointer text-[14px] font-semibold text-black/60">Pagar lendo o QR em outro celular</summary>
                <img src={pix.img} alt="QR do Pix com o valor da conta" className="mx-auto mt-3 w-56 rounded-xl ring-1 ring-black/10" />
              </details>
              <button onClick={() => pay("pix-feito")} disabled={!!busy} className="btn-dark mt-4 h-12 w-full">
                {busy === "pix-feito" ? "Avisando..." : "Já paguei, avisar a equipe"}
              </button>
              <button onClick={() => setPix(null)} className="mt-2 h-10 w-full text-[14px] font-semibold text-black/55">Pagar de outro jeito</button>
            </section>
          ) : (
            <section className="mt-6 space-y-2.5" aria-label="Como pagar">
              <h2 className="text-[16px] font-bold">Como você quer pagar?</h2>
              {bill.pix && (
                <button onClick={() => pay("pix")} disabled={!!busy || !total} className="btn h-[52px] w-full justify-between px-5 text-[16px] text-white disabled:opacity-40" style={{ background: color }}>
                  <span className="flex items-center gap-2"><Icon name="pix" size={19} /> {busy === "pix" ? "Gerando o Pix..." : "Pagar com Pix agora"}</span>
                  <span className="tnum">{brl(total)}</span>
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => pay("cartao")} disabled={!!busy || !total} className="btn-ghost h-12 disabled:opacity-40">
                  <Icon name="card" size={18} /> {busy === "cartao" ? "Avisando..." : "Cartão"}
                </button>
                <button onClick={() => pay("dinheiro")} disabled={!!busy || !total} className="btn-ghost h-12 disabled:opacity-40">
                  <Icon name="cash" size={18} /> {busy === "dinheiro" ? "Avisando..." : "Dinheiro"}
                </button>
              </div>
              <p className="text-[13px] text-black/50">Cartão ou dinheiro: a equipe vem até a mesa. Sem nenhuma taxa a mais pelo app.</p>
            </section>
          )}
          {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">{err}</p>}

          {sent && <Rate slug={slug} id={sent.order} color={color} name={bill.restaurant.name} title="Como foi a sua visita?" />}

          <Link href={back} className="btn-ghost mt-6 h-12 w-full">Voltar ao cardápio</Link>
        </>
      )}
    </main>
  );
}
