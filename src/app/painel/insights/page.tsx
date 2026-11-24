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
        <Stat label="Faturamento" value={brl(t.revenue)} hint={`${t.orders} ${t.orders === 1 ? "pedido" : "pedidos"} · ${t.dine_in} na mesa, ${t.delivery} entrega`} accent />
        <Stat label="Ticket médio" value={brl(t.avg_ticket)} hint={waiter && d.ticketAi.orders_with_ai && d.ticketAi.without_ai ? `${lift >= 0 ? "+" : ""}${lift}% quando a IA ajuda` : "valor médio por pedido"} />
        <Stat label="Vendido por sugestões" value={brl(t.suggest_revenue)} hint={t.orders_with_suggest ? `${t.orders_with_suggest} ${t.orders_with_suggest === 1 ? "pedido aceitou" : "pedidos aceitaram"} um “combina com”` : "o que o cliente adicionou pelo “combina com”"} />
        {waiter && <Stat label="Vendido pela IA" value={brl(t.ai_revenue)} hint={`${aiShare}% do faturamento · ${d.chats.conversations} conversas`} />}
      </div>

      {d.week?.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="flex items-center gap-2 text-[17px] font-bold"><Icon name="sparkle" size={18} className="text-brand" /> Resumo da semana</h2>
          <ul className="mt-3 space-y-2.5">
            {d.week.map((l: any, i: number) => (
              <li key={i} className="flex gap-3 text-[14.5px] leading-snug">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.tone === "good" ? "bg-leaf" : l.tone === "bad" ? "bg-brand" : "bg-black/30"}`} />
                {l.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Engineering e={d.engineering} />

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

      <Feedback f={d.feedback} optins={t.optins} />

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

const ENG: Record<string, { title: string; text: string; cls: string; dot: string }> = {
  estrela: { title: "Estrelas", text: "vendem muito e dão lucro", cls: "bg-emerald-50 ring-emerald-200", dot: "bg-leaf" },
  burro: { title: "Burros de carga", text: "vendem muito, mas sobra pouco", cls: "bg-amber-50 ring-amber-200", dot: "bg-amber-500" },
  quebra: { title: "Quebra-cabeças", text: "dão lucro, mas vendem pouco", cls: "bg-sky-50 ring-sky-200", dot: "bg-sky-500" },
  abacaxi: { title: "Abacaxis", text: "vendem pouco e sobra pouco", cls: "bg-red-50 ring-red-200", dot: "bg-red-500" },
};

/** Engenharia de cardápio: o quadro 2x2 com a ação de cada prato. */
function Engineering({ e }: { e: any }) {
  if (!e) return null;
  return (
    <div className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold">Lucro de cada prato</h2>
          <p className="mt-0.5 text-[13.5px] text-black/55">Cruza quanto cada prato vende com quanto sobra depois do custo, e diz o que fazer com ele. Pratos são comparados com pratos, bebidas com bebidas e sobremesas com sobremesas.</p>
        </div>
        {e.ready && <p className="text-[13px] text-black/55">Lucro médio por prato: <b className="text-ink">{brl(e.avgMargin)}</b></p>}
      </div>
      {!e.ready ? (
        <div className="mt-4 rounded-2xl bg-cream p-4 text-[14px] text-black/70">
          {e.missingCost > 0 ? (
            <>Falta o custo de <b>{e.missingCost} {e.missingCost === 1 ? "prato" : "pratos"}</b>. Abra cada prato em Cardápio, aba <b>Vender mais</b>, e preencha <b>Custo para fazer</b>. Com pelo menos 3 pratos com custo e 10 vendas, o quadro aparece aqui.</>
          ) : (
            <>O quadro aparece quando houver pelo menos 10 pratos vendidos no período.</>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["estrela", "quebra", "burro", "abacaxi"] as const).map((k) => {
              const list = e.items.filter((x: any) => x.cls === k);
              const m = ENG[k];
              return (
                <section key={k} className={`rounded-2xl p-4 ring-1 ${m.cls}`}>
                  <h3 className="flex items-center gap-2 text-[15px] font-bold"><span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />{m.title} <span className="font-normal text-black/55">· {m.text}</span></h3>
                  {list.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-black/45">Nenhum prato aqui.</p>
                  ) : (
                    <ul className="mt-2 space-y-2.5">
                      {list.map((x: any) => (
                        <li key={x.id} className="text-[13.5px]">
                          <p className="flex justify-between gap-2 font-semibold"><span className="truncate">{x.name}</span><span className="tnum shrink-0 text-black/60">{x.qty} vendidos · sobra {brl(x.margin_cents)}</span></p>
                          <p className="mt-0.5 text-black/65">{x.action}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {e.missingCost > 0 && <p className="mt-3 text-[13px] text-black/50">{e.missingCost} {e.missingCost === 1 ? "prato ficou" : "pratos ficaram"} de fora por não ter custo cadastrado.</p>}
        </>
      )}
    </div>
  );
}

function Feedback({ f, optins }: { f: any; optins: number }) {
  if (!f) return null;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="card p-5">
        <h2 className="text-[17px] font-bold">Avaliações</h2>
        {f.n === 0 ? (
          <p className="mt-2 text-[14px] text-black/55">Depois de cada pedido, o cliente dá uma nota. Quem gostou é levado para avaliar no Google (cadastre o link em Configurações); quem não gostou fala só com você.</p>
        ) : (
          <>
            <p className="tnum mt-2 font-display text-[34px] font-extrabold leading-none">{Number(f.avg).toFixed(1).replace(".", ",")}<span className="text-[16px] font-semibold text-black/45"> de 5</span></p>
            <p className="mt-1 text-[13.5px] text-black/55">{f.n} {f.n === 1 ? "avaliação" : "avaliações"} no período · {f.low} com nota 3 ou menos</p>
          </>
        )}
        <p className="mt-4 border-t border-line pt-3 text-[13.5px] text-black/60">
          <b className="text-ink">{optins}</b> {optins === 1 ? "cliente aceitou" : "clientes aceitaram"} receber novidades pelo WhatsApp.{" "}
          {optins > 0 && <a className="font-semibold underline" href="/api/painel/clientes">Baixar lista</a>}
        </p>
      </div>
      <div className="card p-5">
        <h2 className="text-[17px] font-bold">O que os clientes disseram</h2>
        {f.comments.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-black/45">Os comentários das avaliações aparecem aqui. Só você vê.</p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-[14px]">
            {f.comments.map((c: any, i: number) => (
              <li key={i} className="rounded-xl bg-black/[0.03] px-3 py-2">
                <span className={`mr-2 font-bold ${c.stars <= 3 ? "text-red-700" : "text-leaf"}`}>{c.stars}★</span>“{c.comment}”
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
