"use client";
// Pedidos ao vivo: chamados das mesas no topo, depois Novos → Em preparo → Prontos.
import { ComoUsar } from "./ajuda-ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { brl, PAYMENT_LABEL, STATUS_LABEL } from "@/lib/format";
import { usePainel, type Call, type Order } from "./ctx";
import Cozinha from "./Cozinha";

const NEXT: Record<string, { mesa: string; delivery: string; label: { mesa: string; delivery: string } }> = {
  novo: { mesa: "preparo", delivery: "preparo", label: { mesa: "Aceitar", delivery: "Aceitar" } },
  preparo: { mesa: "pronto", delivery: "saiu", label: { mesa: "Está pronto", delivery: "Saiu para entrega" } },
  pronto: { mesa: "entregue", delivery: "entregue", label: { mesa: "Entregue na mesa", delivery: "Confirmar entrega" } },
  saiu: { mesa: "entregue", delivery: "entregue", label: { mesa: "Entregue na mesa", delivery: "Confirmar entrega" } },
};

const COLS = [
  { key: "novo", title: "Novos", match: ["novo"], empty: "Nenhum pedido novo" },
  { key: "preparo", title: "Em preparo", match: ["preparo"], empty: "Nada na cozinha agora" },
  { key: "pronto", title: "Prontos", match: ["pronto", "saiu"], empty: "Nenhum pedido pronto" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const mins = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
const ago = (d: string) => {
  const m = mins(d);
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

export default function Pedidos() {
  const { restaurant: r, waiter, counts, orders, calls, offline, setOrders, setCalls, refreshOrders, reload, sound, setSound, toast } = usePainel();
  const [tab, setTab] = useState("novo");
  const [ticket, setTicket] = useState<Order | null>(null);
  const [refuse, setRefuse] = useState<Order | null>(null);
  const [kitchen, setKitchen] = useState(false);
  const [, tick] = useState(0);

  // os "há X min" andam sozinhos
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ticket) return;
    document.body.classList.add("printing-ticket");
    const done = () => {
      document.body.classList.remove("printing-ticket");
      setTicket(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-ticket");
    };
  }, [ticket]);

  async function move(o: Order, status: string) {
    setOrders((os) => os && os.map((x) => (x.id === o.id ? { ...x, status } : x)));
    await api(`/api/painel/orders/${o.id}`, { method: "PUT", body: { status } }).catch(refreshOrders);
  }
  async function attend(c: Call) {
    setCalls((cs) => cs.filter((x) => x.id !== c.id));
    await api(`/api/painel/calls/${c.id}`, { method: "PUT" }).catch(refreshOrders);
  }
  async function closeTable(c: Call) {
    setCalls((cs) => cs.filter((x) => !(x.type === "conta" && x.table_label.toLowerCase() === c.table_label.toLowerCase())));
    await api("/api/painel/mesas", { body: { table: c.table_label } }).then(() => toast(`Mesa ${c.table_label} fechada`), refreshOrders);
    refreshOrders();
  }
  async function giveReward(o: Order) {
    setOrders((os) => os && os.map((x) => (x.customer_phone === o.customer_phone ? { ...x, reward: "" } : x)));
    await api("/api/painel/fidelidade", { body: { phone: o.customer_phone, orderId: o.id } }).then(() => toast("Prêmio entregue"), refreshOrders);
  }
  async function togglePause() {
    await api("/api/painel/restaurant", { method: "PUT", body: { accepting_orders: r.accepting_orders === false } }).catch(() => {});
    await reload();
  }

  if (!orders)
    return (
      <div aria-busy="true">
        <div className="skeleton h-9 w-40 rounded-lg" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      </div>
    );

  const paused = r.accepting_orders === false;
  const live = orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
  const done = orders.filter((o) => o.status === "entregue" || o.status === "cancelado");
  const revenue = orders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.total_cents, 0);
  const aiRevenue = orders.filter((o) => o.status !== "cancelado").reduce((s, o) => s + o.ai_cents, 0);
  const lists = COLS.map((c) => ({ ...c, list: live.filter((o) => c.match.includes(o.status)).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)) }));
  const firstRun = counts && counts.orders === 0 && orders.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold leading-tight">Pedidos</h1>
          <p className="text-[14px] text-black/55">
            {offline ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800"><Icon name="alert" size={15} /> Sem conexão. Tentando de novo...</span>
            ) : (
              <>Hoje: <b className="tnum text-ink">{brl(revenue)}</b> em {plural(orders.filter((o) => o.status !== "cancelado").length, "pedido", "pedidos")}{waiter && aiRevenue > 0 ? <> · <b className="tnum text-leaf">{brl(aiRevenue)}</b> pelo garçom de IA</> : null}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ComoUsar tela="pedidos" />
          <button onClick={() => setKitchen(true)} className="btn-ghost" title="Tela cheia para tablet ou TV na cozinha">
            <Icon name="chef" size={17} />
            Modo cozinha
          </button>
          <button onClick={() => setSound(!sound)} aria-pressed={sound} className={sound ? "btn-dark" : "btn-ghost"}>
            <Icon name={sound ? "sound" : "mute"} size={17} />
            {sound ? "Som ligado" : "Ligar som de aviso"}
          </button>
          <button onClick={togglePause} aria-pressed={paused} className={paused ? "btn bg-amber-500 text-white hover:bg-amber-600" : "btn-ghost"}>
            <Icon name={paused ? "right" : "pause"} size={17} />
            {paused ? "Voltar a receber pedidos" : "Pausar pedidos"}
          </button>
        </div>
      </div>

      {paused && (
        <p className="mt-4 flex gap-2.5 rounded-2xl bg-amber-50 p-4 text-[14.5px] text-amber-950 ring-1 ring-amber-200">
          <Icon name="pause" size={19} className="mt-0.5" />
          <span><b>Pedidos pausados.</b> Os clientes continuam vendo o cardápio e os pratos em 3D, mas não conseguem enviar pedidos pelo celular.</span>
        </p>
      )}

      {calls.length > 0 && (
        <section className="mt-5" aria-label="Chamados das mesas">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {calls.map((c) => (
              <div key={c.id} className="animate-pop flex flex-wrap items-center gap-3 rounded-2xl bg-ink p-3.5 text-white">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
                  <Icon name={c.type === "conta" ? "receipt" : "bell"} size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block font-display text-[17px] leading-tight">Mesa {c.table_label}</b>
                  <span className="text-[13.5px] text-white/75">{c.type === "conta" ? c.reason || "Pediu a conta" : c.reason ? `Garçom de IA: ${c.reason}` : "Chamou um atendente"} · {ago(c.created_at)}</span>
                </span>
                <span className={`flex shrink-0 gap-1.5 ${c.type === "conta" ? "w-full [&>button]:flex-1" : "flex-col"}`}>
                  <button onClick={() => attend(c)} className="btn h-10 bg-white px-3.5 text-ink hover:bg-white/90">
                    <Icon name="check" size={16} stroke={2.4} />
                    Atendido
                  </button>
                  {c.type === "conta" && (
                    <button onClick={() => closeTable(c)} title="A conta foi paga: limpa a conta desta mesa para os próximos clientes" className="btn h-10 bg-white/15 px-3 text-[14px] text-white hover:bg-white/25">
                      Fechar mesa
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {firstRun && <FirstSteps counts={counts!} slug={r.slug} />}

      {/* Celular: uma coluna por vez */}
      <div className="mt-5 flex rounded-2xl bg-black/[0.05] p-1 text-[14px] font-semibold lg:hidden" role="tablist">
        {lists.map((c) => (
          <button key={c.key} role="tab" aria-selected={tab === c.key} onClick={() => setTab(c.key)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all duration-200 ${tab === c.key ? "bg-white shadow-sm" : "text-black/55"}`}>
            {c.title}
            <span className={`tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] ${c.list.length ? (c.key === "novo" ? "bg-brand text-white" : "bg-ink text-white") : "bg-black/10 text-black/60"}`}>{c.list.length}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-3">
        {lists.map((c) => (
          <section key={c.key} className={`rounded-3xl lg:bg-white/60 lg:p-3 lg:ring-1 lg:ring-black/[0.06] ${tab === c.key ? "" : "hidden lg:block"}`} aria-label={c.title}>
            <h2 className="mb-3 hidden items-center justify-between px-1.5 pt-1 text-[16px] font-bold lg:flex">
              <span className="flex items-center gap-2">
                <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${c.key === "novo" ? "bg-brand" : c.key === "preparo" ? "bg-amber-500" : "bg-leaf"}`} />
                {c.title}
              </span>
              <span className={`tnum grid h-6 min-w-6 place-items-center rounded-full px-2 text-[12.5px] ${c.list.length && c.key === "novo" ? "bg-brand text-white" : "bg-white ring-1 ring-black/10"}`}>{c.list.length}</span>
            </h2>
            <div className="space-y-3">
              {c.list.length === 0 && <p className="rounded-2xl border border-dashed border-black/15 px-3 py-8 text-center text-[14px] text-black/60">{c.empty}</p>}
              {c.list.map((o) => (
                <OrderCard key={o.id} o={o} onMove={move} onPrint={() => setTicket(o)} onRefuse={() => setRefuse(o)} onReward={() => giveReward(o)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* dicas depois dos pedidos: no celular, o que importa (os pedidos) aparece primeiro */}
      {!firstRun && <Tips />}

      {done.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-3 text-[16px] font-bold">Finalizados nas últimas 24 horas</h2>
          <div className="card divide-y divide-line">
            {done.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[14px]">
                <span>
                  <b className="tnum">#{o.number}</b> · {o.channel === "mesa" ? `Mesa ${o.table_label}` : o.customer_name} · {plural(o.items.reduce((s, i) => s + i.qty, 0), "item", "itens")}
                </span>
                <span className={`tnum ${o.status === "cancelado" ? "font-semibold text-red-700" : "text-black/60"}`}>
                  {o.status === "cancelado" ? "Recusado" : STATUS_LABEL[o.status]} · {brl(o.total_cents)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {refuse && <RefuseDialog o={refuse} onCancel={() => setRefuse(null)} onConfirm={() => { move(refuse, "cancelado"); setRefuse(null); }} />}

      {ticket && <Ticket o={ticket} name={r.name} />}
      {kitchen && <Cozinha orders={orders} onMove={move} onClose={() => setKitchen(false)} />}
    </div>
  );
}

function OrderCard({ o, onMove, onPrint, onRefuse, onReward }: { o: Order; onMove: (o: Order, s: string) => void; onPrint: () => void; onRefuse: () => void; onReward: () => void }) {
  const next = NEXT[o.status];
  const waited = mins(o.status === "novo" ? o.created_at : o.updated_at || o.created_at);
  const late = (o.status === "novo" && waited >= 4) || (o.status === "preparo" && waited >= 30);
  return (
    <article className={`card p-4 ${o.status === "novo" ? "animate-arrive ring-2 ring-brand" : "animate-fade"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="tnum font-display text-[20px] font-extrabold leading-none">#{o.number}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[12.5px] font-bold text-white">
              <Icon name={o.channel === "mesa" ? "table" : "bike"} size={13} stroke={2} />
              {o.channel === "mesa" ? `Mesa ${o.table_label}` : "Entrega"}
            </span>
          </p>
          <p className={`mt-1.5 flex items-center gap-1 text-[13px] ${late ? "font-bold text-red-700" : "text-black/55"}`}>
            <Icon name="clock" size={13} stroke={2} />
            {o.status === "novo" ? `chegou ${ago(o.created_at)}` : o.status === "preparo" ? `na cozinha ${ago(o.updated_at || o.created_at)}` : `pronto ${ago(o.updated_at || o.created_at)}`}
          </p>
        </div>
        <p className="tnum shrink-0 font-display text-[17px] font-bold">{brl(o.total_cents)}</p>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-[15px]">
        {o.items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <b className="tnum w-7 shrink-0">{it.qty}x</b>
            <span className="min-w-0">
              {it.name}
              {it.via_ai && <span title="Item vendido pelo garçom de IA" className="ml-1.5 rounded bg-emerald-100 px-1 text-[10.5px] font-bold text-emerald-800">IA</span>}
              {it.notes && <span className="block text-[13.5px] font-semibold text-amber-800">{it.notes}</span>}
            </span>
          </li>
        ))}
      </ul>
      {o.notes && <p className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2 text-[13.5px] text-amber-950"><b>Obs.:</b> {o.notes}</p>}
      {o.reward && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13.5px] text-emerald-950 ring-1 ring-emerald-200">
          <Icon name="gift" size={17} className="shrink-0" />
          <span className="min-w-0 flex-1"><b>Prêmio de fidelidade:</b> {o.reward}</span>
          <button onClick={onReward} className="btn h-8 shrink-0 bg-emerald-700 px-2.5 text-[12.5px] text-white hover:bg-emerald-800">Entreguei</button>
        </div>
      )}

      {o.channel === "delivery" && (
        <div className="mt-2.5 space-y-0.5 rounded-xl bg-cream px-3 py-2.5 text-[13.5px]">
          <p className="font-semibold">{o.customer_name} · {o.customer_phone}</p>
          <p className="text-black/65">{o.address}</p>
          {o.payment && (
            <p className="pt-0.5 font-semibold">
              Pagamento: {PAYMENT_LABEL[o.payment] ?? o.payment}
              {o.payment === "dinheiro" && (o.change_for_cents ?? 0) > 0 ? ` · troco para ${brl(o.change_for_cents!)}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        {next && (
          <button onClick={() => onMove(o, next[o.channel])} className={`h-11 flex-1 ${o.status === "novo" ? "btn-primary" : "btn-dark"}`}>
            {next.label[o.channel]}
          </button>
        )}
        {o.status === "novo" && (
          <button onClick={onRefuse} className="btn-ghost h-11 text-red-700">Recusar</button>
        )}
        <button onClick={onPrint} aria-label={`Imprimir o pedido ${o.number}`} title="Imprimir comanda" className="btn-ghost h-11 w-11 px-0">
          <Icon name="printer" size={18} />
        </button>
        {o.channel === "delivery" && o.customer_phone && (
          <a
            className="btn-ghost h-11 w-11 px-0"
            aria-label="Falar com o cliente no WhatsApp"
            title="Falar com o cliente no WhatsApp"
            href={`https://wa.me/55${o.customer_phone.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(`Olá, ${o.customer_name}! Aqui é do restaurante, sobre o seu pedido #${o.number}.`)}`}
            target="_blank"
          >
            <Icon name="chat" size={18} />
          </a>
        )}
      </div>
    </article>
  );
}

/** Próximos passos para vender mais (do próprio restaurante); cada um some quando a pessoa dispensa. */
function Tips() {
  const [tips, setTips] = useState<{ id: string; title: string; text: string; href: string; action: string }[]>([]);
  useEffect(() => {
    let hidden: string[] = [];
    try { hidden = JSON.parse(localStorage.getItem("gia:dicas-ok") || "[]"); } catch {}
    api<{ tips: typeof tips }>("/api/painel/dicas").then((r) => setTips(r.tips.filter((t) => !hidden.includes(t.id)))).catch(() => {});
  }, []);
  function dismiss(id: string) {
    setTips((t) => t.filter((x) => x.id !== id));
    try {
      const h = JSON.parse(localStorage.getItem("gia:dicas-ok") || "[]");
      localStorage.setItem("gia:dicas-ok", JSON.stringify([...h, id].slice(-30)));
    } catch {}
  }
  if (!tips.length) return null;
  return (
    <section className="mt-9" aria-label="Para vender mais">
      <h2 className="mb-2.5 flex items-center gap-2 text-[16px] font-bold"><Icon name="sparkle" size={17} /> Para vender mais</h2>
      <div className="grid gap-2.5 md:grid-cols-3">
        {tips.map((t) => (
          <article key={t.id} className="animate-fade relative flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/[0.07]">
            <button onClick={() => dismiss(t.id)} aria-label={`Dispensar: ${t.title}`} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-black/60 hover:bg-black/5"><Icon name="close" size={15} /></button>
            <h3 className="pr-7 text-[15px] font-bold leading-snug">{t.title}</h3>
            <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-black/60">{t.text}</p>
            <Link href={t.href} className="btn-dark mt-3 h-10 self-start px-3.5 text-[13.5px]">{t.action}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Para quem acabou de criar a conta: o caminho até o primeiro pedido. */
function FirstSteps({ counts, slug }: { counts: { items: number; models: number; orders: number }; slug: string }) {
  const steps = [
    { done: counts.items > 0, title: "Monte o cardápio", text: "Cadastre as categorias e os pratos, com preço e foto.", href: "/painel/cardapio", cta: "Abrir o cardápio" },
    { done: counts.models > 0, title: "Escaneie um prato em 3D", text: "Aponte o celular e dê uma volta no prato: leva uns 20 segundos. O cliente vê o prato na mesa, em tamanho real.", href: "/painel/cardapio", cta: "Escolher um prato" },
    { done: false, title: "Coloque os QR codes nas mesas", text: "Imprima um QR por mesa. O pedido já chega aqui com o número da mesa.", href: "/painel/qrcodes", cta: "Ver os QR codes" },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <section className="card mt-5 p-5">
      <h2 className="text-[19px] font-extrabold">Primeiros passos</h2>
      <p className="mt-0.5 text-[14px] text-black/60">Três coisas para o seu cardápio começar a receber pedidos.</p>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex flex-col rounded-2xl p-4 ${i === current ? "bg-ink text-white" : "bg-cream"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${s.done ? "bg-leaf text-white" : i === current ? "bg-white text-ink" : "bg-black/10"}`}>
              {s.done ? <Icon name="check" size={15} stroke={2.6} /> : i + 1}
            </span>
            <b className="mt-3 font-display text-[16.5px]">{s.title}</b>
            <span className={`mt-1 flex-1 text-[13.5px] ${i === current ? "text-white/75" : "text-black/60"}`}>{s.text}</span>
            {!s.done && (
              <Link href={s.href} className={`mt-3 inline-flex items-center gap-1 text-[14px] font-bold ${i === current ? "text-white" : "text-ink"}`}>
                {s.cta} <Icon name="right" size={15} stroke={2.2} />
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13.5px] text-black/55">
        Quer ver como o cliente enxerga? <a className="font-semibold text-ink underline" href={`/r/${slug}?mesa=1`} target="_blank">Abra o seu cardápio</a> e faça um pedido de teste.
      </p>
    </section>
  );
}

/** Comanda para a cozinha (só aparece na impressão). */
function Ticket({ o, name }: { o: Order; name: string }) {
  return (
    <div className="print-ticket">
      <p style={{ fontSize: 13 }}>{name}</p>
      <p style={{ fontSize: 30, fontWeight: 800, margin: "4px 0" }}>
        #{o.number} · {o.channel === "mesa" ? `MESA ${o.table_label}` : "ENTREGA"}
      </p>
      <p style={{ fontSize: 13 }}>{new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
      <hr />
      {o.items.map((it, i) => (
        <p key={i} style={{ fontSize: 18, margin: "8px 0" }}>
          <b>{it.qty}x</b> {it.name}
          {it.notes ? <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>&gt;&gt; {it.notes}</span> : null}
        </p>
      ))}
      {o.notes ? <p style={{ fontSize: 15, fontWeight: 700 }}>OBS.: {o.notes}</p> : null}
      <hr />
      {o.channel === "delivery" && (
        <p style={{ fontSize: 14 }}>
          {o.customer_name} · {o.customer_phone}
          <br />
          {o.address}
          <br />
          {o.payment ? `Pagamento: ${PAYMENT_LABEL[o.payment] ?? o.payment}` : ""}
          {o.payment === "dinheiro" && (o.change_for_cents ?? 0) > 0 ? ` (troco para ${brl(o.change_for_cents!)})` : ""}
        </p>
      )}
      <p style={{ fontSize: 16, fontWeight: 800 }}>Total: {brl(o.total_cents)}</p>
    </div>
  );
}

/** Confirmação para recusar um pedido (o foco fica na janela e Esc cancela). */
function RefuseDialog({ o, onCancel, onConfirm }: { o: Order; onCancel: () => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 sm:place-items-center" onClick={onCancel}>
      <div ref={box} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label="Recusar pedido" onClick={(e) => e.stopPropagation()} className="animate-sheet w-full max-w-sm rounded-t-3xl bg-white p-6 outline-none sm:rounded-3xl">
        <h3 className="text-[21px] font-extrabold">Recusar o pedido #{o.number}?</h3>
        <p className="mt-2 text-[14.5px] text-black/65">
          {o.channel === "mesa" ? `A mesa ${o.table_label}` : o.customer_name || "O cliente"} vai ver na tela que o restaurante não pôde aceitar o pedido.
        </p>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost h-12 flex-1" onClick={onCancel}>Manter pedido</button>
          <button className="btn h-12 flex-1 bg-red-700 text-white hover:bg-red-800" onClick={onConfirm}>Recusar</button>
        </div>
      </div>
    </div>
  );
}
