"use client";
// Modo cozinha: tela cheia para um tablet ou TV na cozinha. Letras grandes, só o que precisa ser feito,
// o relógio de cada pedido muda de cor quando atrasa e a tela não apaga sozinha.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import type { Order } from "./ctx";

const mins = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

export default function Cozinha({ orders, onMove, onClose }: { orders: Order[]; onMove: (o: Order, status: string) => void; onClose: () => void }) {
  const [, tick] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  // tela cheia e tela sempre acesa (quando o navegador deixa)
  useEffect(() => {
    let lock: any = null;
    const el = document.documentElement as any;
    el.requestFullscreen?.().catch(() => {});
    const keep = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {}
    };
    keep();
    const vis = () => document.visibilityState === "visible" && keep();
    document.addEventListener("visibilitychange", vis);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("keydown", esc);
      lock?.release?.().catch?.(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const list = orders
    .filter((o) => o.status === "novo" || o.status === "preparo")
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  // vai direto no <body>: assim cobre a tela toda, mesmo dentro do painel animado
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#101418] text-white" role="dialog" aria-label="Modo cozinha">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <Icon name="chef" size={22} />
        <h2 className="text-[20px] font-bold">Cozinha</h2>
        <span className="tnum rounded-full bg-white/10 px-2.5 py-0.5 text-[14px] font-semibold">{list.length} {list.length === 1 ? "pedido" : "pedidos"}</span>
        <span className="flex-1" />
        <span className="hidden text-[13px] text-white/50 sm:inline">Verde: no tempo · Amarelo: 15 min · Vermelho: 25 min</span>
        <button onClick={onClose} className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[15px] font-semibold hover:bg-white/20">
          <Icon name="close" size={18} /> Sair
        </button>
      </header>

      {list.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <Icon name="check" size={56} className="mx-auto text-emerald-400" />
            <p className="mt-3 text-[26px] font-bold">Tudo em dia</p>
            <p className="mt-1 text-[16px] text-white/60">Os pedidos novos aparecem aqui sozinhos, com som.</p>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-max grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((o) => {
            const m = mins(o.created_at);
            const tone = m >= 25 ? "bg-red-500" : m >= 15 ? "bg-amber-400 text-black" : "bg-emerald-500";
            const isNew = o.status === "novo";
            return (
              <article key={o.id} className={`flex flex-col overflow-hidden rounded-2xl bg-[#1b2128] ring-2 ${isNew ? "ring-white" : "ring-transparent"}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="tnum text-[28px] font-extrabold leading-none">#{o.number}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[16px] font-bold">{o.channel === "mesa" ? `Mesa ${o.table_label}` : o.pickup ? "Retirada" : "Entrega"}</span>
                  <span className="flex-1" />
                  <span className={`tnum rounded-full px-3 py-1 text-[16px] font-bold ${tone}`}>{m} min</span>
                </div>
                {isNew && <p className="bg-white px-4 py-1 text-[13px] font-bold uppercase tracking-wide text-black">Novo</p>}
                <ul className="flex-1 space-y-2.5 px-4 py-3">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex gap-3 text-[20px] leading-snug">
                      <b className="tnum w-10 shrink-0 text-right">{it.qty}x</b>
                      <span className="min-w-0">
                        <span className="font-semibold">{it.name}</span>
                        {it.notes && <span className="mt-0.5 block text-[16px] font-bold text-amber-300">{it.notes}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="mx-4 mb-3 rounded-xl bg-amber-300 px-3 py-2 text-[16px] font-bold text-black">Obs.: {o.notes}</p>}
                <button
                  onClick={() => onMove(o, isNew ? "preparo" : o.channel === "mesa" || o.pickup ? "pronto" : "saiu")}
                  className={`h-16 text-[20px] font-extrabold transition-colors ${isNew ? "bg-white text-black hover:bg-white/90" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                >
                  {isNew ? "Começar a preparar" : "Pronto"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
}
