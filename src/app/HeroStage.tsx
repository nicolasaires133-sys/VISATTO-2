"use client";
// Palco da página inicial, como uma ficha técnica: a pizza em 3D sobre papel milimetrado.
// Quando o 3D carrega, a moldura da câmera trava no prato, as cotas de medida se desenham
// (largura e altura, em cm) e o celular com o cardápio de verdade sobe ao lado. É o único momento animado sozinho.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Phone from "./home/Phone";

const DishViewer = dynamic(() => import("@/components/DishViewer"), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

const W = 40; // a tábua da pizza tem 40 cm
const H = 3.7;

export default function HeroStage() {
  const [locked, setLocked] = useState(false);
  const [cm, setCm] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setLocked(true), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!locked) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setCm(W);
    const start = performance.now() + 550;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / 1000));
      setCm(Math.round(W * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    // se o navegador pausar a animação (aba em segundo plano), a medida final aparece mesmo assim
    const done = setTimeout(() => setCm(W), 2200);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(done);
    };
  }, [locked]);

  return (
    <div className="hero-stage relative mx-auto aspect-square w-full max-w-[600px]" data-locked={locked || undefined}>
      {/* papel milimetrado: 1 cm por quadrado, some nas bordas */}
      <div aria-hidden className="mm-grid absolute inset-0 rounded-[32px] [mask-image:radial-gradient(closest-side,#000_55%,transparent)]" />

      <div className="absolute inset-[12%] sm:inset-[6%] [&>div]:h-full">
        <DishViewer
          model={{ glb: "/demo/pizza.glb", usdz: "/demo/pizza.usdz", dims: { w: 40, d: 40, h: 3.7 } }}
          alt="Pizza calabresa em 3D, girando devagar"
          height="100%"
          background="transparent"
          showArButton={false}
          hideDims
          hideHint
          orbit="25deg 62deg 150%"
        />
      </div>

      {/* moldura da câmera que trava no prato */}
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-[14%] h-[72%] w-[72%] overflow-visible">
        {["M2 14V6Q2 2 6 2H14", "M86 2H94Q98 2 98 6V14", "M98 86V94Q98 98 94 98H86", "M14 98H6Q2 98 2 94V86"].map((d, i) => (
          <path key={i} d={d} className={`hero-corner hero-corner-${i}`} fill="none" stroke="var(--color-brand)" strokeWidth="1.8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {/* cota da largura */}
      <div className="hero-measure pointer-events-none absolute inset-x-[17%] bottom-[9%]">
        <div className="relative h-4 text-ink/55">
          <span className="absolute left-0 top-0 h-4 w-px bg-current" />
          <span className="absolute right-0 top-0 h-4 w-px bg-current" />
          <span className="hero-measure-line absolute inset-x-0 top-1/2 h-px origin-center bg-current" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 border-y-[4px] border-l-[7px] border-y-transparent border-l-current" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[4px] border-r-[7px] border-y-transparent border-r-current" />
        </div>
        <p className="tnum mt-1.5 text-center text-[15px] font-bold text-ink" aria-live="polite">
          <span className="rounded-md bg-white px-2.5 py-1 shadow-[0_4px_14px_-6px_rgba(23,32,51,0.35)] ring-1 ring-line">{cm} cm</span>
        </p>
      </div>

      {/* cota da altura */}
      <div className="hero-measure pointer-events-none absolute right-[5%] top-[44%] flex items-center gap-2 text-ink/55">
        <div className="relative h-10 w-3">
          <span className="absolute left-0 top-0 h-px w-3 bg-current" />
          <span className="absolute bottom-0 left-0 h-px w-3 bg-current" />
          <span className="hero-measure-line-v absolute left-1/2 top-0 h-full w-px origin-center bg-current" />
        </div>
        <span className="tnum text-[13px] font-bold text-ink">{String(H).replace(".", ",")} cm</span>
      </div>

      <p className="hero-chip pointer-events-none absolute right-[4%] top-[5%] flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-[0_6px_20px_-10px_rgba(23,32,51,0.4)] ring-1 ring-line">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
        </span>
        Tamanho real travado
      </p>

      {/* o cardápio de verdade, no celular do cliente */}
      <div className="hero-phone absolute -bottom-[6%] -left-[3%] w-[34%] max-w-[200px] sm:-left-[8%]">
        <Phone small>
          <img src="/landing/cli-cardapio.webp" alt="O cardápio da Cantina da Nonna aberto no celular, com o cartão fidelidade" className="h-full w-full object-cover object-top" />
        </Phone>
      </div>
    </div>
  );
}
