"use client";
// Os pratos do restaurante de exemplo passando de lado, cada um girando em 3D com a medida real.
// No computador, a rolagem vertical vira movimento horizontal; no celular, é um carrossel de arrastar.
import Link from "next/link";
import { useRef } from "react";
import Model from "./Model";
import { useScrollScene } from "./useScroll";

const DISHES = [
  { src: "/demo/pizza.glb", name: "Pizza Calabresa Grande", price: "R$ 74,90", dims: "40 × 40 × 3,7 cm", orbit: "0deg 58deg 105%" },
  { src: "/demo/lasanha.glb", name: "Lasanha à Bolonhesa", price: "R$ 62,00", dims: "26 × 26 × 6 cm", orbit: "0deg 62deg 110%" },
  { src: "/demo/tiramisu.glb", name: "Tiramisù da Casa", price: "R$ 29,00", dims: "22 × 22 × 6,4 cm", orbit: "0deg 64deg 112%" },
];

export default function Gallery() {
  const track = useRef<HTMLDivElement>(null);
  const ref = useScrollScene<HTMLElement>((p) => {
    const t = track.current;
    if (!t || window.innerWidth < 1024) return;
    const max = t.scrollWidth - window.innerWidth;
    t.style.transform = `translate3d(${(-p * max).toFixed(1)}px,0,0)`;
  });
  return (
    <section ref={ref} className="relative lg:h-[280vh]">
      <div className="lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:justify-center lg:overflow-hidden">
        <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8">
          <p className="cine-kicker">Feito com o escâner do Visatto</p>
          <h2 className="cine-title mt-3 max-w-3xl text-[clamp(40px,6vw,88px)] leading-[0.95]">Cada prato, como ele é.</h2>
        </div>
        <div className="no-scrollbar mt-10 overflow-x-auto lg:overflow-visible">
          <div ref={track} className="flex w-max gap-5 px-5 pb-4 will-change-transform md:px-8 lg:gap-8 lg:pl-[max(2rem,calc((100vw-1200px)/2+2rem))] lg:pr-[10vw]">
            {DISHES.map((d) => (
              <article key={d.name} className="cine-card relative flex h-[min(62svh,540px)] w-[82vw] max-w-[440px] shrink-0 flex-col overflow-hidden rounded-[28px] lg:w-[440px]">
                <div aria-hidden className="absolute inset-x-0 top-0 h-2/3" style={{ background: "radial-gradient(60% 60% at 50% 45%, rgba(255,150,90,0.18), transparent 70%)" }} />
                <Model src={d.src} alt={`${d.name} em 3D`} orbit={d.orbit} rotateSpeed="22deg" className="min-h-0 flex-1" />
                <div className="relative flex items-end justify-between gap-4 border-t border-white/10 p-6">
                  <div>
                    <h3 className="text-[20px] font-bold">{d.name}</h3>
                    <p className="tnum mt-1 text-[14.5px] text-white/55">{d.dims}</p>
                  </div>
                  <span className="tnum shrink-0 whitespace-nowrap text-[18px] font-bold text-[#ff7a4d]">{d.price}</span>
                </div>
              </article>
            ))}
            <article className="relative flex h-[min(62svh,540px)] w-[82vw] max-w-[440px] shrink-0 flex-col justify-end overflow-hidden rounded-[28px] border border-dashed border-white/20 p-8 lg:w-[440px]">
              <p className="cine-title text-[40px] leading-[0.98]">O seu prato aqui.</p>
              <p className="mt-4 text-[17px] leading-relaxed text-white/60">Um celular, uma folha A4 em branco e uma volta em torno do prato. Uns 5 minutos.</p>
              <Link href="/cadastro" className="cine-btn mt-7 self-start">Escanear o primeiro</Link>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
