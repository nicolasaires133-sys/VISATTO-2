"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { brl } from "@/lib/format";
import { usePainel } from "../ctx";
import Icon from "@/components/Icon";
import { Notice, PageHead } from "../ui";

export default function Insights() {
  const { aiEnabled, waiter } = usePainel();
  const [days, setDays] = useState(30);
  const [d, setD] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [sumBusy, setSumBusy] = useState(false);
  const [sumErr, setSumErr] = useState("");

  useEffect(() => {
    setD(null);
    api(`/api/painel/insights?dias=${days}`).then(setD);
  }, [days]);

  async function summarize() {
    setSumBusy(true);
    setSumErr("");
    try {
      setSummary((await api("/api/painel/insights/summary", { method: "POST" })).summary);
    } catch (e: any) {
      setSumErr(e.message);
    }
    setSumBusy(false);
  }

  if (!d)
    return (
      <div aria-busy="true">
        <div className="skeleton h-9 w-44 rounded-lg" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="skeleton mt-6 h-48 rounded-2xl" />
      </div>
    );
  const t = d.totals;
  const aiShare = t.revenue ? Math.round((t.ai_revenue / t.revenue) * 100) : 0;
  const lift = d.ticketAi.without_ai ? Math.round(((d.ticketAi.with_ai - d.ticketAi.without_ai) / d.ticketAi.without_ai) * 100) : 0;
  const maxDay = Math.max(1, ...d.daily.map((x: any) => x.revenue));

  return (
    <div>
      <PageHead title="Resultados" sub={waiter ? "Quanto o garçom de IA está trazendo para o seu caixa." : "Seus pedidos e quantos clientes viram os pratos na mesa."}>
        <div className="flex rounded-xl bg-black/[0.05] p-1 text-[14px] font-semibold" role="tablist" aria-label="Período">
          {[7, 30, 90].map((n) => (
            <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)} className={`rounded-lg px-3.5 py-2 ${days === n ? "bg-white shadow-sm" : "text-black/55"}`}>
              {n} dias
            </button>
          ))}
        </div>
      </PageHead>

      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${waiter ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {waiter && <Stat label="Vendido pela IA" value={brl(t.ai_revenue)} hint={`${aiShare}% do faturamento`} accent />}
        <Stat label="Faturamento" value={brl(t.revenue)} hint={`${t.orders} ${t.orders === 1 ? "pedido" : "pedidos"} · ${t.dine_in} na mesa, ${t.delivery} entrega`} accent={!waiter} />
        <Stat label="Ticket médio" value={brl(t.avg_ticket)} hint={waiter && d.ticketAi.orders_with_ai && d.ticketAi.without_ai ? `${lift >= 0 ? "+" : ""}${lift}% quando a IA ajuda` : "valor médio por pedido"} />
        {waiter ? (
          <Stat label="Conversas com a IA" value={String(d.chats.conversations)} hint={`${d.chats.questions} perguntas respondidas`} />
        ) : (
          <Stat label="Pedidos" value={String(t.orders)} hint={`${t.dine_in} na mesa · ${t.delivery} entrega`} />
        )}
      </div>

      <ArCard a={d.arStats} items={d.arItems} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[17px] font-bold">Últimos 14 dias</h2>
          {d.daily.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-black/45">Os pedidos dos últimos 14 dias aparecem aqui.</p>
          ) : (
            <div className="mt-4 flex h-48 items-end gap-1 sm:gap-1.5">
              {timeline(d.daily).map((x, i) => (
                <div key={x.day} className="flex h-full flex-1 flex-col items-center gap-1" title={`${x.day}: ${brl(x.revenue)}`}>
                  <div className="flex w-full flex-1 flex-col justify-end">
                    {x.revenue > 0 ? (
                      <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-ink/80" style={{ height: `${(x.revenue / maxDay) * 100}%`, minHeight: 4 }}>
                        <div className="w-full bg-leaf" style={{ height: `${waiter ? (x.ai_revenue / x.revenue) * 100 : 0}%` }} />
                      </div>
                    ) : (
                      <div className="h-[3px] w-full rounded-full bg-black/10" />
                    )}
                  </div>
                  <span className={`tnum text-[10px] text-black/45 ${i % 2 ? "hidden sm:inline" : ""}`}>{x.day}</span>
                </div>
              ))}
            </div>
          )}
          {waiter && <p className="mt-3 flex gap-4 text-xs text-black/55">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-leaf" />Vendido pela IA</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-ink/80" />Demais vendas</span>
          </p>}
        </div>

        <div className="card p-5">
          <h2 className="text-[17px] font-bold">Mais vendidos</h2>
          {d.topItems.length === 0 && <p className="py-10 text-center text-[14px] text-black/45">Sem vendas no período.</p>}
          <ul className="mt-3 space-y-2.5 text-[14.5px]">
            {d.topItems.map((x: any) => (
              <li key={x.name} className="flex items-center justify-between gap-2">
                <span className="truncate">{x.name}</span>
                <span className="tnum shrink-0 font-semibold">
                  {x.qty} un.{x.via_ai > 0 && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-800">{x.via_ai} IA</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {waiter && <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">O que seus clientes querem</h2>
            <button onClick={summarize} disabled={sumBusy || !aiEnabled} className="btn-dark py-2 text-xs">
              {sumBusy ? "Analisando..." : "Analisar com IA"}
            </button>
          </div>
          {sumErr && <div className="mt-3"><Notice tone="warn">{sumErr}</Notice></div>}
          {summary ? (
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
          ) : (
            <p className="mt-3 text-sm text-black/55">
              A IA lê as perguntas dos clientes e aponta o que eles procuram e não encontram no seu cardápio, com sugestões para vender mais.
            </p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-bold">Perguntas recentes</h2>
          {d.recentQuestions.length === 0 && <p className="py-6 text-center text-sm text-black/40">Ninguém conversou com o garçom ainda.</p>}
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {d.recentQuestions.map((q: any, i: number) => (
              <li key={i} className="rounded-lg bg-black/[0.03] px-3 py-2">“{q.question}”</li>
            ))}
          </ul>
        </div>
      </div>}
    </div>
  );
}

/** Sempre 14 colunas, uma por dia, mesmo nos dias sem pedido (o gráfico lê como uma linha do tempo). */
function timeline(daily: { day: string; revenue: number; ai_revenue: number }[]) {
  const by = new Map(daily.map((x) => [x.day, x]));
  return Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(Date.now() - (13 - i) * 86400000);
    const day = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return by.get(day) ?? { day, revenue: 0, ai_revenue: 0 };
  });
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "bg-ink text-white ring-0" : ""}`}>
      <p className={`text-[13px] font-semibold ${accent ? "text-white/70" : "text-black/55"}`}>{label}</p>
      <p className="tnum mt-1 font-display text-[28px] font-extrabold leading-tight">{value}</p>
      <p className={`mt-1 text-[13px] ${accent ? "text-white/75" : "text-black/55"}`}>{hint}</p>
    </div>
  );
}

function ArCard({ a, items }: { a: any; items: { name: string; ar_opens: number }[] }) {
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const conv = pct(a.ar_ordered, a.ar_sessions);
  const base = pct(a.noar_ordered, a.noar_sessions);
  return (
    <div className="card mt-6 grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold"><Icon name="scan" size={19} /> Prato na mesa (3D pela câmera)</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-cream p-3">
            <p className="tnum font-display text-[26px] font-extrabold">{a.ar_opens}</p>
            <p className="text-xs text-black/55">vezes que viram na mesa</p>
          </div>
          <div className="rounded-xl bg-cream p-3">
            <p className="tnum font-display text-[26px] font-extrabold">{a.views3d}</p>
            <p className="text-xs text-black/55">pratos girados em 3D</p>
          </div>
          <div className="rounded-xl bg-cream p-3">
            <p className="tnum font-display text-[26px] font-extrabold">{a.visits}</p>
            <p className="text-xs text-black/55">visitas ao cardápio</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-black/65">
          {a.ar_sessions >= 5 && a.noar_sessions >= 5 ? (
            <>
              Quem viu o prato na mesa fez pedido <b className="text-leaf">{conv}%</b> das vezes, contra <b>{base}%</b> de quem não viu.
            </>
          ) : (
            "Quando mais clientes usarem, você vê aqui quanto ver o prato na mesa aumenta os pedidos."
          )}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-black/60">Mais vistos na mesa</h3>
        {items.length === 0 ? (
          <p className="mt-3 text-[14px] text-black/50">Ninguém abriu a câmera ainda. Escaneie em 3D os pratos mais pedidos, na tela Cardápio.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {items.map((x) => (
              <li key={x.name} className="flex justify-between gap-2">
                <span className="truncate">{x.name}</span>
                <span className="text-black/55">{x.ar_opens}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
