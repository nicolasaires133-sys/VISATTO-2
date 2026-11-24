"use client";
// Ajuda dentro do painel: o botão "Como usar" de cada tela e o tour guiado do primeiro acesso.
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Icon from "@/components/Icon";
import { GUIAS, TELA_TITULO, type Guia } from "./guias";
import { Dialog } from "./ui";

/** Lista de passos numerados (é uma sequência de verdade, então leva número). */
export function Passos({ passos }: { passos: string[] }) {
  return (
    <ol className="space-y-3">
      {passos.map((p, i) => (
        <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
          <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
          <span className="text-ink/85">{p}</span>
        </li>
      ))}
    </ol>
  );
}

/** Botão "Como usar" do cabeçalho de cada tela: abre os guias daquela tela. */
export function ComoUsar({ tela }: { tela: Guia["tela"] }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Guia | null>(null);
  const guias = GUIAS.filter((g) => g.tela === tela);
  if (!guias.length) return null;
  return (
    <>
      <button onClick={() => { setSel(guias.length === 1 ? guias[0] : null); setOpen(true); }} className="btn-ghost h-10 px-3 text-[13.5px]" data-tour="como-usar">
        <Icon name="help" size={17} /> Como usar
      </button>
      {open && (
        <Dialog label={`Como usar: ${TELA_TITULO[tela]}`} onClose={() => setOpen(false)} wide>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="min-w-0">
              {sel && guias.length > 1 && (
                <button onClick={() => setSel(null)} className="mb-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-slate hover:text-ink">
                  <Icon name="left" size={14} /> {TELA_TITULO[tela]}
                </button>
              )}
              <h2 className="truncate text-[19px] font-extrabold">{sel ? sel.titulo : `Como usar: ${TELA_TITULO[tela]}`}</h2>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5"><Icon name="close" size={19} /></button>
          </div>
          <div className="overflow-y-auto p-5">
            {sel ? (
              <div key={sel.id} className="animate-enter">
                <p className="text-[14.5px] text-slate">{sel.resumo}</p>
                <div className="mt-5"><Passos passos={sel.passos} /></div>
              </div>
            ) : (
              <ul className="animate-enter divide-y divide-line">
                {guias.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => setSel(g)} className="group flex w-full items-center gap-3 py-3.5 text-left">
                      <span className="min-w-0 flex-1">
                        <b className="block text-[15.5px]">{g.titulo}</b>
                        <span className="block text-[13.5px] text-slate">{g.resumo}</span>
                      </span>
                      <span className="tnum shrink-0 text-[12.5px] text-slate">{g.minutos} min</span>
                      <Icon name="right" size={17} className="shrink-0 text-black/30 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
            <Link href="/painel/ajuda" onClick={() => setOpen(false)} className="text-[13.5px] font-semibold text-slate underline-offset-2 hover:text-ink hover:underline">Ver todos os guias</Link>
            <button onClick={() => { setOpen(false); window.dispatchEvent(new Event("visatto-tour")); }} className="btn-ghost h-10 px-3.5 text-[13.5px]">
              <Icon name="sparkle" size={16} /> Fazer o tour do painel
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

// ---------------------------------------------------------------- tour guiado

type Step = { target: string; title: string; text: string };
const STEPS: Step[] = [
  { target: "nav-/painel", title: "Pedidos", text: "Aqui chegam os pedidos das mesas e da entrega, com aviso sonoro. Você toca em Aceitar, depois Está pronto e Entregue. Os avisos de conta da mesa também aparecem aqui." },
  { target: "nav-/painel/cardapio", title: "Cardápio", text: "Seus pratos, preços e fotos. Mudou aqui, o cliente vê na hora. É aqui também que você coloca um prato em 3D." },
  { target: "nav-/painel/qrcodes", title: "QR codes", text: "Imprima um QR por mesa e cole na mesa. O cliente lê com a câmera e o pedido chega com o número da mesa." },
  { target: "nav-/painel/insights", title: "Resultados", text: "Quanto você vendeu, o que mais sai, o que veio das sugestões e o lucro de cada prato." },
  { target: "nav-/painel/config", title: "Configurações", text: "Chave Pix, taxa de serviço, cartão fidelidade, entrega e avaliações no Google." },
  { target: "ver-cardapio", title: "Veja como o cliente vê", text: "Abre o seu cardápio do jeito que aparece no celular do cliente. Bom para conferir depois de mudar algo." },
  { target: "nav-/painel/ajuda", title: "Ajuda", text: "Passo a passo de cada tarefa, de receber um pedido a pôr um prato em 3D. Toda tela também tem o botão Como usar." },
];
const TOUR_KEY = "visatto-tour-v2";

function visible(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

export function Tour() {
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps = useCallback(() => STEPS.filter((s) => document.querySelectorAll(`[data-tour="${s.target}"]`).length), []);

  useEffect(() => {
    const start = () => setI(0);
    window.addEventListener("visatto-tour", start);
    let seen = "1";
    try { seen = localStorage.getItem(TOUR_KEY) || ""; } catch {}
    // navegador controlado por robô (testes automáticos): não abre o tour sozinho
    if (navigator.webdriver) seen = "1";
    const t = !seen ? setTimeout(start, 900) : null;
    return () => {
      window.removeEventListener("visatto-tour", start);
      if (t) clearTimeout(t);
    };
  }, []);

  const list = i == null ? [] : steps();
  const step = i == null ? null : list[i];

  useLayoutEffect(() => {
    if (!step) return;
    const find = () => {
      const els = Array.from(document.querySelectorAll(`[data-tour="${step.target}"]`));
      const r = els.map(visible).find(Boolean) ?? null;
      setRect(r);
    };
    find();
    window.addEventListener("resize", find);
    window.addEventListener("scroll", find, true);
    return () => {
      window.removeEventListener("resize", find);
      window.removeEventListener("scroll", find, true);
    };
  }, [step]);

  function end() {
    setI(null);
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
  }
  useEffect(() => {
    if (i == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      if (e.key === "ArrowRight") setI((n) => (n == null ? n : Math.min(n + 1, list.length - 1)));
      if (e.key === "ArrowLeft") setI((n) => (n == null ? n : Math.max(n - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, list.length]);

  if (!step || !rect) return null;
  const pad = 6;
  const box = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // o balão fica ao lado do item (computador) ou acima da barra (celular)
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const side = box.left + box.width + 340 < vw;
  const tipW = Math.min(330, vw - 24);
  const tip = side
    ? { left: box.left + box.width + 14, top: Math.min(Math.max(12, box.top - 8), vh - 230), width: tipW }
    : box.top > vh / 2
      ? { left: Math.min(Math.max(12, box.left + box.width / 2 - tipW / 2), vw - tipW - 12), top: Math.max(12, box.top - 214), width: tipW }
      : { left: Math.min(Math.max(12, box.left), vw - tipW - 12), top: box.top + box.height + 12, width: tipW };
  const last = i === list.length - 1;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Tour do painel: ${step.title}`}>
      <div className="absolute inset-0" onClick={end} />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl ring-2 ring-brand transition-all duration-300 ease-out"
        style={{ ...box, boxShadow: "0 0 0 9999px rgba(15, 21, 34, 0.62)" }}
      />
      <div key={step.target} className="animate-enter absolute rounded-2xl bg-white p-4 shadow-[0_24px_60px_-20px_rgba(15,21,34,0.6)]" style={tip}>
        <p className="tnum text-[12.5px] font-semibold text-slate">{(i ?? 0) + 1} de {list.length}</p>
        <h3 className="mt-0.5 text-[18px] font-extrabold">{step.title}</h3>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink/80">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={end} className="mr-auto text-[13.5px] font-semibold text-slate hover:text-ink">{last ? "Fechar" : "Pular tour"}</button>
          {(i ?? 0) > 0 && <button onClick={() => setI((n) => (n ?? 1) - 1)} className="btn-ghost h-10 px-3.5">Voltar</button>}
          <button onClick={() => (last ? end() : setI((n) => (n ?? 0) + 1))} className="btn-dark h-10 px-4">{last ? "Começar a usar" : "Próximo"}</button>
        </div>
      </div>
    </div>
  );
}
