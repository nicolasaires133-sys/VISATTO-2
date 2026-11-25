"use client";
// O painel do dono, tela por tela, com marcadores em cima da tela real explicando cada parte.
// Serve de venda e de manual: é o mesmo caminho que a pessoa vai seguir depois de entrar.
import { useState } from "react";
import { Browser } from "./Phone";

type Spot = { x: number; y: number; title: string; text: string };
type Tab = { id: string; label: string; img: string; alt: string; intro: string; spots: Spot[] };

const TABS: Tab[] = [
  {
    id: "pedidos",
    label: "Pedidos",
    img: "/landing/painel-pedidos.webp",
    alt: "Tela de pedidos do painel, com as colunas Novos, Em preparo e Prontos e o aviso de pagamento da mesa 8",
    intro: "Os pedidos chegam sozinhos, com som, e andam por três colunas. Você só toca no botão de cada etapa.",
    spots: [
      { x: 35, y: 23, title: "Aviso da mesa", text: "A mesa 8 pagou a parte dela no Pix. Confira no banco e toque em Fechar mesa." },
      { x: 29.5, y: 67, title: "Um toque por etapa", text: "Aceitar, Está pronto, Entregue. O cliente acompanha cada passo no celular dele." },
      { x: 60, y: 52, title: "Mesa e entrega juntas", text: "Pedido da mesa vem com o número; o de entrega, com endereço e forma de pagamento." },
      { x: 68, y: 8, title: "Ajuda em toda tela", text: "O botão Como usar mostra o passo a passo daquela tela, para você e para a equipe." },
    ],
  },
  {
    id: "cardapio",
    label: "Cardápio",
    img: "/landing/painel-cardapio.webp",
    alt: "Tela de cardápio do painel, com as pizzas e massas, botões de disponível e de 3D",
    intro: "Mudou o preço ou acabou um ingrediente? Mude aqui e o cliente vê na hora, sem reimprimir nada.",
    spots: [
      { x: 92, y: 8.5, title: "Novo prato", text: "Nome, preço e foto tirada com o próprio celular. Ou importe de uma foto do cardápio impresso." },
      { x: 35, y: 40, title: "Acabou? Desligue", text: "O prato some do pedido até você ligar de novo. Nada de cliente pedindo o que não tem." },
      { x: 85, y: 40, title: "Prato em 3D", text: "Escaneie com o celular e uma folha A4 em branco. Aparece Ver na mesa para o cliente." },
      { x: 55, y: 33, title: "Destaque da casa", text: "A estrela coloca o prato no topo do cardápio. Bom para o que dá mais lucro." },
    ],
  },
  {
    id: "resultados",
    label: "Resultados",
    img: "/landing/painel-resultados.webp",
    alt: "Tela de resultados do painel, com faturamento, ticket médio, vendas por sugestão e o lucro de cada prato",
    intro: "Quanto entrou, quanto cada pedido vale e o que fazer com cada prato, escrito em português claro.",
    spots: [
      { x: 33, y: 23, title: "Faturamento do período", text: "7, 30 ou 90 dias, com pedidos da mesa e da entrega separados." },
      { x: 82, y: 23, title: "Vendido por sugestões", text: "O que o cliente acrescentou porque o cardápio ofereceu na hora certa." },
      { x: 31, y: 40, title: "Resumo da semana", text: "Três frases sobre o que mudou e o que vale fazer agora." },
      { x: 29, y: 64, title: "Lucro de cada prato", text: "Cruza vendas com o custo e diz: destaque, suba o preço ou reveja a receita." },
    ],
  },
  {
    id: "ajuda",
    label: "Ajuda",
    img: "/landing/painel-ajuda.webp",
    alt: "Tela de ajuda do painel, com os primeiros passos e o progresso de 83%",
    intro: "Primeiros passos com progresso e o passo a passo de cada tarefa. Dá para aprender sozinho e ensinar a equipe.",
    spots: [
      { x: 76, y: 8.5, title: "Tour do painel", text: "Um passeio de um minuto mostrando para que serve cada parte." },
      { x: 53, y: 22, title: "Primeiros passos", text: "Seis tarefas na ordem certa, do cadastro ao primeiro pedido." },
      { x: 73, y: 54, title: "Como fazer", text: "Abre o passo a passo daquela tarefa, com os mesmos nomes dos botões da tela." },
      { x: 42, y: 86, title: "Guias por tela", text: "Receber pedido, fechar a conta, pôr prato em 3D, imprimir QR codes e mais." },
    ],
  },
];

export default function PanelShowcase({ dark = false }: { dark?: boolean }) {
  const [tab, setTab] = useState(0);
  const [spot, setSpot] = useState(0);
  const t = TABS[tab];

  return (
    <div>
      <div className={`no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl p-1 ${dark ? "bg-white/[0.07]" : "bg-ink/[0.05]"} text-[14.5px] font-semibold sm:inline-flex`} role="tablist" aria-label="Telas do painel">
        {TABS.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === i}
            onClick={() => { setTab(i); setSpot(0); }}
            className={`flex-1 shrink-0 whitespace-nowrap rounded-lg px-4 py-2 transition-[background-color,color,box-shadow] duration-200 sm:flex-none ${tab === i ? "bg-white text-ink shadow-[0_1px_3px_rgba(23,32,51,0.12)]" : dark ? "text-white/60 hover:text-white" : "text-slate hover:text-ink"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <Browser className={dark ? "shadow-[0_60px_140px_-40px_rgba(255,106,61,0.35)] ring-white/10" : ""}>
          <img key={t.img} src={t.img} alt={t.alt} loading="lazy" className="animate-fade block w-full" />
          {t.spots.map((s, i) => (
            <button
              key={`${t.id}-${i}`}
              onClick={() => setSpot(i)}
              aria-hidden="true"
              tabIndex={-1}
              className="spot absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[12.5px] font-bold text-white sm:h-8 sm:w-8"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${120 + i * 90}ms` }}
              data-on={spot === i || undefined}
            >
              <span className="tnum relative z-[1]">{i + 1}</span>
            </button>
          ))}
        </Browser>

        <div>
          <p className={`text-[16.5px] leading-relaxed ${dark ? "text-white/65" : "text-slate"}`}>{t.intro}</p>
          <ol className={`mt-5 divide-y border-y ${dark ? "divide-white/10 border-white/10" : "divide-line border-line"}`}>
            {t.spots.map((s, i) => (
              <li key={`${t.id}-${i}`}>
                <button onClick={() => setSpot(i)} aria-pressed={spot === i} className="flex w-full gap-3 py-3.5 text-left">
                  <span className={`tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors duration-200 ${spot === i ? "bg-brand text-white" : dark ? "bg-white/10 text-white" : "bg-ink/[0.07] text-ink"}`}>{i + 1}</span>
                  <span>
                    <b className="block text-[15.5px]">{s.title}</b>
                    <span className={`grid transition-[grid-template-rows,opacity] duration-300 ${spot === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <span className={`overflow-hidden text-[14.5px] leading-relaxed ${dark ? "text-white/60" : "text-slate"}`}>{s.text}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
