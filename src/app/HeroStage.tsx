"use client";
// Palco da página inicial: a pizza em 3D sob a luz da mesa. Quando o 3D carrega, a moldura
// da câmera "trava" no prato e a régua mede o tamanho real (o momento que resume o Visatto).
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const DishViewer = dynamic(() => import("@/components/DishViewer"), {
  ssr: false,
  loading: () => <div className="h-full" />,
});

const CM = 40; // a tábua da pizza tem 40 cm

export default function HeroStage() {
  const [locked, setLocked] = useState(false);
  const [cm, setCm] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    // trava a moldura pouco depois do palco aparecer (o 3D já vem carregando atrás)
    const t = setTimeout(() => setLocked(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCm(CM);
      return;
    }
    const start = performance.now() + 650; // começa junto com a linha da régua
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / 1100));
      setCm(Math.round(CM * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [locked]);

  return (
    <div className="hero-stage relative mx-auto aspect-[1/1.02] w-full max-w-[560px]" data-locked={locked || undefined}>
      {/* luz de cima, como o foco sobre a mesa do restaurante */}
      <div aria-hidden className="absolute inset-x-[-10%] top-[-8%] bottom-[18%] bg-[radial-gradient(50%_60%_at_50%_40%,rgba(255,170,110,0.22),rgba(228,87,46,0.06)_55%,transparent_75%)]" />
      {/* tampo da mesa */}
      <div aria-hidden className="absolute inset-x-[4%] bottom-[14%] h-[34%] rounded-[50%] bg-[radial-gradient(closest-side,#3a332b,#2a2620_60%,transparent)] opacity-90" />

      <div className="absolute inset-0 [&>div]:h-full">
        <DishViewer
          model={{ glb: "/demo/pizza.glb", usdz: "/demo/pizza.usdz", dims: { w: 40, d: 40, h: 3.7 } }}
          alt="Pizza calabresa em 3D, girando"
          height="100%"
          background="transparent"
          showArButton={false}
          hideDims
          dark
          orbit="25deg 60deg 150%"
        />
      </div>

      {/* moldura da câmera que trava no prato */}
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-[11%] h-[78%] w-[78%] overflow-visible">
        {[
          "M2 16V6Q2 2 6 2H16",
          "M84 2H94Q98 2 98 6V16",
          "M98 84V94Q98 98 94 98H84",
          "M16 98H6Q2 98 2 94V84",
        ].map((d, i) => (
          <path key={i} d={d} className={`hero-corner hero-corner-${i}`} fill="none" stroke="var(--color-brand)" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {/* régua do tamanho real */}
      <div className="hero-measure pointer-events-none absolute inset-x-[16%] bottom-[7%]">
        <div className="relative h-3 text-white/70">
          <span className="absolute left-0 top-0 h-3 w-px bg-current" />
          <span className="absolute right-0 top-0 h-3 w-px bg-current" />
          <span className="hero-measure-line absolute inset-x-0 top-1/2 h-px origin-left bg-current" />
        </div>
        <p className="tnum mt-2 text-center font-display text-[15px] font-bold text-white" aria-live="polite">
          <span className="rounded-full bg-brand px-3 py-1 shadow-[0_6px_18px_-6px_rgba(228,87,46,0.8)]">{cm} cm</span>
        </p>
      </div>

      <p className="hero-chip pointer-events-none absolute left-[6%] top-[8%] flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white ring-1 ring-white/15 backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4cc27a]" />
        </span>
        Tamanho real travado
      </p>
    </div>
  );
}
