"use client";
// O escâner: o prato gira no centro e um anel de marcas vai acendendo a cada ângulo fotografado,
// como no cadastro de rosto do celular. Os três passos aparecem ao lado conforme a rolagem.
import { useRef } from "react";
import Model, { type ModelHandle } from "./Model";
import { lerp, seg, useScrollScene } from "./useScroll";

const TICKS = 72;
const STEPS = [
  { t: "Uma folha A4 em branco ao lado.", d: "Sulfite comum, sem imprimir nada, a um palmo do prato. É a régua: dá a medida certa." },
  { t: "Uma volta devagar em torno.", d: "O celular guia e tira as fotos sozinho. Mesa branca? Um pano escuro embaixo da folha." },
  { t: "O 3D fica pronto no próprio celular.", d: "Mede o prato sozinho e pinta com as cores de verdade. Sem custo por prato." },
];

export default function ScanScene() {
  const ticks = useRef<(SVGLineElement | null)[]>([]);
  const steps = useRef<(HTMLLIElement | null)[]>([]);
  const model = useRef<ModelHandle>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const ref = useScrollScene<HTMLElement>((p) => {
    const ring = seg(p, 0.12, 0.82);
    const lit = ring * TICKS;
    ticks.current.forEach((l, i) => {
      if (!l) return;
      const on = i < lit;
      l.setAttribute("stroke", on ? "#ff6a3d" : "rgba(255,255,255,0.16)");
      l.setAttribute("stroke-width", on ? "1.1" : "0.7");
    });
    if (pct.current) pct.current.textContent = `${Math.round(ring * 100)}%`;
    model.current?.orbit(lerp(0, 360, ring), lerp(70, 62, ring), "112%");
    const active = p < 0.36 ? 0 : p < 0.66 ? 1 : 2;
    steps.current.forEach((s, i) => s && (s.dataset.on = String(i === active)));
  });
  return (
    <section ref={ref} id="escaner" className="relative h-[260vh] scroll-mt-0">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-5 md:px-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="cine-kicker">Escâner 3D</p>
            <h2 className="cine-title mt-3 text-[clamp(38px,5vw,76px)] leading-[0.95]">Você mesmo faz o 3D. Com o celular.</h2>
            <ol className="mt-8 space-y-1">
              {STEPS.map((s, i) => (
                <li key={s.t} ref={(el) => { steps.current[i] = el; }} data-on={i === 0} className="scan-step border-l-2 py-3 pl-5">
                  <h3 className="text-[19px] font-bold">{s.t}</h3>
                  <p className="scan-step-d text-[15.5px] leading-relaxed text-white/60">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative order-1 mx-auto aspect-square w-[min(84vw,46svh,520px)] lg:order-2 lg:w-[min(42vw,72svh,560px)]">
            <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
              {Array.from({ length: TICKS }, (_, i) => {
                const a = (i / TICKS) * Math.PI * 2;
                return <line key={i} ref={(el) => { ticks.current[i] = el; }} x1={50 + Math.cos(a) * 44} y1={50 + Math.sin(a) * 44} x2={50 + Math.cos(a) * 48.5} y2={50 + Math.sin(a) * 48.5} stroke="rgba(255,255,255,0.16)" strokeWidth="0.7" strokeLinecap="round" />;
              })}
            </svg>
            <div className="absolute inset-[11%]">
              <Model ref={model} src="/demo/lasanha.glb?v=4" alt="Lasanha sendo escaneada em 3D" autoRotate={false} orbit="0deg 70deg 112%" decay={120} className="h-full w-full" />
            </div>
            <p className="absolute inset-x-0 -bottom-[7%] text-center text-[13px] font-semibold text-white/60">Fotos do prato <span ref={pct} className="tnum text-white">0%</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}
