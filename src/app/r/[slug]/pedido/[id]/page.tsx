"use client";
// Acompanhamento do pedido: o cliente vê em que etapa está, sem precisar perguntar ao garçom.
import { use, useEffect, useRef, useState } from "react";
import { readable } from "@/lib/color";
import Link from "next/link";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { brl, PAYMENT_LABEL } from "@/lib/format";
import Rate from "../../Rate";
import Stamps from "../../Stamps";
import { save } from "../../parts";

const STEPS = {
  mesa: [
    { key: "novo", label: "Recebido" },
    { key: "preparo", label: "Em preparo" },
    { key: "pronto", label: "Pronto" },
    { key: "entregue", label: "Na mesa" },
  ],
  delivery: [
    { key: "novo", label: "Recebido" },
    { key: "preparo", label: "Em preparo" },
    { key: "saiu", label: "A caminho" },
    { key: "entregue", label: "Entregue" },
  ],
};

const HEADLINE: Record<string, { mesa: string; delivery: string; sub: { mesa: string; delivery: string } }> = {
  novo: {
    mesa: "Pedido enviado para a cozinha",
    delivery: "Pedido enviado",
    sub: { mesa: "O restaurante já recebeu. Assim que aceitarem, você vê aqui.", delivery: "O restaurante já recebeu. Assim que aceitarem, você vê aqui." },
  },
  preparo: {
    mesa: "Estamos preparando",
    delivery: "Estamos preparando",
    sub: { mesa: "Seu pedido está na cozinha.", delivery: "Seu pedido está na cozinha. Avisamos quando sair para entrega." },
  },
  pronto: { mesa: "Pronto! Já vai para a sua mesa", delivery: "Pronto", sub: { mesa: "Está saindo da cozinha agora.", delivery: "Está saindo da cozinha agora." } },
  saiu: { mesa: "A caminho", delivery: "Saiu para entrega", sub: { mesa: "", delivery: "O entregador está a caminho do seu endereço." } },
  entregue: { mesa: "Bom apetite!", delivery: "Pedido entregue. Bom apetite!", sub: { mesa: "Seu pedido foi entregue na mesa.", delivery: "" } },
  cancelado: {
    mesa: "O restaurante não pôde aceitar este pedido",
    delivery: "O restaurante não pôde aceitar este pedido",
    sub: { mesa: "Chame um atendente para saber o que houve ou faça um novo pedido.", delivery: "Fale com o restaurante para saber o que houve ou faça um novo pedido." },
  },
};

/** Aviso de "pedido pronto": vibra o celular e toca dois toques curtos (se o navegador deixar). */
function readyAlert() {
  try {
    navigator.vibrate?.([220, 120, 220]);
  } catch {}
  try {
    const A = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new A();
    [0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

const hhmm = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Pedido({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = use(params);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const lastStatus = useRef("");

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setInterval>;
    const load = () =>
      api(`/api/r/${slug}/orders/${id}`)
        .then((x) => {
          if (stop) return;
          setD(x);
          setErr("");
          const st = x.order.status;
          if (lastStatus.current && lastStatus.current !== st && (st === "pronto" || st === "saiu")) readyAlert();
          lastStatus.current = st;
          document.title = st === "pronto" || st === "saiu" ? `✓ Pedido #${x.order.number} pronto` : `Pedido #${x.order.number}`;
          if (["entregue", "cancelado"].includes(x.order.status)) clearInterval(t);
        })
        .catch((e) => !stop && setErr(e.status === 404 ? "Pedido não encontrado." : "sem-conexao"));
    load();
    t = setInterval(() => !document.hidden && load(), 6000);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, id]);

  if (!d && err && err !== "sem-conexao")
    return (
      <main className="grid min-h-dvh place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">{err}</h1>
          <Link href={`/r/${slug}`} className="btn-ghost mt-5">Voltar ao cardápio</Link>
        </div>
      </main>
    );
  if (!d)
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-white px-5 py-10" aria-busy="true">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton mt-4 h-24 rounded-2xl" />
        <div className="skeleton mt-4 h-40 rounded-2xl" />
      </main>
    );

  const { order: o, restaurant: r, eta, loyalty } = d;
  const ch: "mesa" | "delivery" = o.channel === "delivery" ? "delivery" : "mesa";
  const steps = STEPS[ch];
  const current = steps.findIndex((s) => s.key === o.status);
  const color = readable(r.primary_color);
  const cancelled = o.status === "cancelado";
  const done = o.status === "entregue";
  const h = HEADLINE[o.status] ?? HEADLINE.novo;
  const back = `/r/${slug}${ch === "mesa" && o.table_label ? `?mesa=${encodeURIComponent(o.table_label)}` : ch === "delivery" ? "?modo=delivery" : ""}`;

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(r.pix_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-5 pb-10 pt-8">
      <p className="text-[13.5px] font-semibold text-black/55">
        {r.name} · {ch === "mesa" ? `Mesa ${o.table_label}` : "Entrega"}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h1 className="text-[15px] font-bold text-black/70">Pedido #{o.number}</h1>
        <span className="tnum text-[13.5px] text-black/60">enviado às {hhmm(o.created_at)}</span>
      </div>

      <section aria-live="polite" className="mt-5">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-white"
          style={{ background: cancelled ? "#7f1d1d" : done ? "#2f7d4f" : "#172033" }}
        >
          <Icon name={cancelled ? "close" : done ? "check" : o.status === "saiu" ? "bike" : "clock"} size={28} stroke={2} />
        </span>
        <h2 className="mt-4 text-[28px] font-extrabold leading-[1.1]">{h[ch]}</h2>
        {h.sub[ch] && <p className="mt-2 text-[15.5px] leading-relaxed text-black/65">{h.sub[ch]}</p>}
        {eta && !cancelled && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#efefeb] px-3.5 py-2 text-[14.5px]">
            <Icon name="clock" size={16} />
            <span>
              {ch === "delivery" ? "Chega" : "Fica pronto"} por volta das <b className="tnum">{hhmm(new Date(new Date(o.created_at).getTime() + eta.minutes * 60000).toISOString())}</b>
              <span className="text-black/60"> · previsão</span>
            </span>
          </p>
        )}
      </section>

      {!cancelled && (
        <ol className="mt-7 grid grid-cols-4" aria-label="Etapas do pedido">
          {steps.map((s, i) => {
            const reached = i <= current;
            return (
              <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={i === current ? "step" : undefined}>
                {i > 0 && <span className="absolute right-1/2 top-[11px] h-[3px] w-full rounded-full" style={{ background: reached ? color : "#e6e4de" }} />}
                <span
                  className="relative z-[1] grid h-6 w-6 place-items-center rounded-full text-white ring-4 ring-white"
                  style={{ background: reached ? color : "#d9d6cf" }}
                >
                  {i < current || done ? <Icon name="check" size={13} stroke={3} /> : i === current ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : null}
                </span>
                <span className={`mt-2 text-[12.5px] font-semibold ${reached ? "text-ink" : "text-black/60"}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      {err === "sem-conexao" && (
        <p role="status" className="mt-5 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-950">
          <Icon name="alert" size={18} className="mt-0.5" />
          Sem conexão agora. Assim que voltar, esta tela se atualiza sozinha.
        </p>
      )}

      {o.payment === "pix" && r.pix_key && !cancelled && (
        <section className="mt-7 rounded-2xl bg-[#efefeb] p-4">
          <h3 className="text-[16px] font-bold">Pague com Pix</h3>
          <p className="mt-1 text-[14px] text-black/65">
            Copie a chave, pague <b className="tnum text-ink">{brl(o.total_cents)}</b> no app do seu banco e mostre o comprovante na entrega.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-2 pl-3.5 ring-1 ring-black/10">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.pix_key}</span>
            <button onClick={copyPix} className="btn-dark h-10 shrink-0 px-3.5 text-[14px]">
              <Icon name={copied ? "check" : "copy"} size={16} />
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
        </section>
      )}

      <section className="mt-7">
        <h3 className="text-[16px] font-bold">Seu pedido</h3>
        <ul className="mt-2 divide-y divide-line text-[15px]">
          {o.items.map((it: any, i: number) => (
            <li key={i} className="flex justify-between gap-3 py-2.5">
              <span>
                <b className="tnum">{it.qty}x</b> {it.name}
                {it.notes ? <span className="block text-[13.5px] text-black/55">{it.notes}</span> : null}
              </span>
              <span className="tnum shrink-0">{brl(it.price_cents * it.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 space-y-1.5 border-t border-line pt-3 text-[15px]">
          {ch === "delivery" && (
            <div className="flex justify-between text-black/65"><span>Entrega</span><span className="tnum">{o.delivery_fee_cents ? brl(o.delivery_fee_cents) : "Grátis"}</span></div>
          )}
          <div className="flex justify-between font-display text-[19px] font-bold"><span>Total</span><span className="tnum">{brl(o.total_cents)}</span></div>
          {o.payment && (
            <p className="text-[14px] text-black/60">
              Pagamento: {PAYMENT_LABEL[o.payment] ?? o.payment}
              {o.payment === "dinheiro" && o.change_for_cents > 0 ? ` (troco para ${brl(o.change_for_cents)})` : ""}
            </p>
          )}
          {ch === "mesa" && <p className="text-[14px] text-black/60">Você paga ao fechar a conta, pelo celular ou com a equipe.</p>}
        </div>
      </section>

      {loyalty && (
        <section className="mt-7 rounded-2xl p-4 ring-1 ring-black/10" aria-label="Cartão fidelidade">
          <h3 className="text-[16px] font-bold">{loyalty.ready ? "Cartão completo! Seu prêmio está liberado" : "Cartão fidelidade"}</h3>
          <p className="mt-1 text-[14px] text-black/60">
            {loyalty.ready ? `Peça à equipe: ${loyalty.reward}.` : `Este pedido vira selo quando for entregue. Com ${loyalty.goal} selos você ganha ${loyalty.reward}.`}
          </p>
          <Stamps n={loyalty.stamps} goal={loyalty.goal} color={color} />
        </section>
      )}

      {(o.status === "pronto" || o.status === "saiu" || done) && <Rate slug={slug} id={id} initial={o.stars} color={color} name={r.name} />}

      <div className="mt-8 flex flex-col gap-2.5">
        {(done || cancelled) && o.items.some((it: any) => it.item_id) ? (
          <button
            onClick={() => {
              // "Pedir de novo": põe os mesmos pratos na sacola (escolhas obrigatórias são pedidas de novo no cardápio)
              const lines = o.items
                .filter((it: any) => it.item_id)
                .map((it: any) => ({
                  itemId: it.item_id,
                  qty: it.qty,
                  notes: it.options ? (String(it.notes || "").match(/Obs: (.*)$/)?.[1] ?? "") : String(it.notes || ""),
                  viaAi: false,
                }));
              save(`gia:${slug}:cart`, lines);
              window.location.href = `${back}${back.includes("?") ? "&" : "?"}sacola=1`;
            }}
            className="btn h-[52px] w-full text-[16px] text-white"
            style={{ background: color }}
          >
            <Icon name="bag" size={19} /> Pedir de novo
          </button>
        ) : null}
        <Link href={back} className={done || cancelled ? "btn-ghost h-12" : "btn h-[52px] w-full text-[16px] text-white"} style={done || cancelled ? undefined : { background: color }}>
          {done || cancelled ? "Ver o cardápio" : "Pedir mais alguma coisa"}
        </Link>
        {ch === "mesa" && o.table_label && !cancelled && (
          <Link href={`/r/${slug}/conta?mesa=${encodeURIComponent(o.table_label)}`} className="btn-ghost h-12">
            <Icon name="receipt" size={18} /> Ver a conta e pagar
          </Link>
        )}
        {r.whatsapp && (
          <a className="btn-ghost h-12" href={`https://wa.me/55${r.whatsapp.replace(/^55/, "")}?text=${encodeURIComponent(`Olá! Sobre meu pedido #${o.number}`)}`}>
            Falar com o restaurante no WhatsApp
          </a>
        )}
      </div>
      {!done && !cancelled && <p className="mt-5 text-center text-[12.5px] text-black/60">Esta tela se atualiza sozinha. Pode deixar aberta.</p>}
    </main>
  );
}

