"use client";
// Central de ajuda do painel: primeiros passos com progresso e o passo a passo de cada tarefa.
// Feita para quem está aprendendo sozinho e para quem vai ensinar a equipe.
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { usePainel } from "../ctx";
import { GUIAS, TELA_TITULO, type Guia } from "../guias";
import { Passos } from "../ajuda-ui";
import { PageHead } from "../ui";

export default function Ajuda() {
  const { restaurant: r, counts } = usePainel();
  const [open, setOpen] = useState<string | null>(null);
  const [photos, setPhotos] = useState<number | null>(null);
  useEffect(() => {
    api<{ items: { image?: string }[] }>("/api/painel/items").then((d) => setPhotos(d.items.filter((i) => i.image).length)).catch(() => {});
  }, []);

  const steps = [
    { done: (counts?.items ?? 0) > 0, title: "Cadastre os pratos", text: "Nome, preço e foto. Dá para importar de uma foto do cardápio impresso.", href: "/painel/cardapio", guia: "novo-prato" },
    { done: (photos ?? 0) >= 3, title: "Ponha foto em pelo menos 3 pratos", text: "Prato com foto chama mais atenção no celular.", href: "/painel/cardapio", guia: "novo-prato" },
    { done: (counts?.models ?? 0) > 0, title: "Coloque o primeiro prato em 3D", text: "Comece pelo que mais vende. Leva uns 5 minutos.", href: "/painel/cardapio", guia: "prato-3d" },
    { done: Boolean(r.pix_key), title: "Ponha a chave Pix", text: "O cliente paga a conta da mesa pelo celular.", href: "/painel/config", guia: "conta-mesa" },
    { done: Boolean(r.loyalty?.on), title: "Ligue o cartão fidelidade", text: "Motivo para o cliente voltar.", href: "/painel/config", guia: "fidelidade" },
    { done: (counts?.orders ?? 0) > 0, title: "Receba o primeiro pedido", text: "Imprima os QR codes e cole nas mesas. Faça um pedido de teste você mesmo.", href: "/painel/qrcodes", guia: "qr-mesas" },
  ];
  const done = steps.filter((s) => s.done).length;
  const telas = Object.keys(TELA_TITULO) as Guia["tela"][];

  return (
    <div className="max-w-3xl">
      <PageHead title="Ajuda e tutoriais" sub="O passo a passo de cada tarefa, do jeito que aparece na tela.">
        <button onClick={() => window.dispatchEvent(new Event("visatto-tour"))} className="btn-dark h-10 px-4">
          <Icon name="play" size={15} /> Fazer o tour do painel
        </button>
      </PageHead>

      <section className="card mt-6 overflow-hidden" aria-label="Primeiros passos">
        <div className="flex items-end justify-between gap-4 px-5 pt-5">
          <div>
            <h2 className="text-[18px] font-extrabold">Primeiros passos</h2>
            <p className="text-[14px] text-slate">{done === steps.length ? "Tudo pronto. Seu cardápio está completo." : `${done} de ${steps.length} feitos. Siga na ordem.`}</p>
          </div>
          <span className="tnum font-display text-[28px] font-extrabold leading-none">{Math.round((done / steps.length) * 100)}%</span>
        </div>
        <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-cream">
          <div className="h-full rounded-full bg-leaf transition-[width] duration-700 ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 divide-y divide-line border-t border-line">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3.5 px-5 py-3.5">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold ${s.done ? "bg-leaf text-white" : "text-slate ring-1 ring-inset ring-black/15"}`}>
                {s.done ? <Icon name="check" size={15} stroke={2.6} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <b className={`block text-[15px] ${s.done ? "text-slate line-through decoration-black/20" : ""}`}>{s.title}</b>
                {!s.done && <span className="block text-[13.5px] text-slate">{s.text}</span>}
              </span>
              {!s.done && (
                <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => { setOpen(s.guia); setTimeout(() => document.getElementById(s.guia)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }} className="btn-ghost hidden h-9 px-3 text-[13px] sm:inline-flex">Como fazer</button>
                  <Link href={s.href} className="btn-dark h-9 px-3 text-[13px]">Fazer</Link>
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {telas.map((t) => (
        <section key={t} className="mt-8">
          <h2 className="mb-2 text-[16px] font-bold text-slate">{TELA_TITULO[t]}</h2>
          <div className="card divide-y divide-line">
            {GUIAS.filter((g) => g.tela === t).map((g) => {
              const isOpen = open === g.id;
              return (
                <div key={g.id} id={g.id} className="scroll-mt-6">
                  <button onClick={() => setOpen(isOpen ? null : g.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15.5px]">{g.titulo}</b>
                      <span className="block text-[13.5px] text-slate">{g.resumo}</span>
                    </span>
                    <span className="tnum hidden shrink-0 text-[12.5px] text-slate sm:block">{g.minutos} min</span>
                    <Icon name="down" size={18} className={`shrink-0 text-black/60 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="animate-enter px-5 pb-5">
                      <Passos passos={g.passos} />
                      <Link href={g.href} className="btn-dark mt-5 h-10 px-4">{g.acao}</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
