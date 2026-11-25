"use client";
// "Na sua mesa": o celular sobe, a câmera mostra a mesa de madeira, o alvo encontra o lugar e o tiramisù
// pousa no tamanho real. É uma encenação do "Ver na mesa" do cardápio, conduzida pela rolagem.
import { useRef } from "react";
import Model, { type ModelHandle } from "./Model";
import SeeOnTable from "./SeeOnTable";
import { lerp, seg, useScrollScene } from "./useScroll";

export default function ARScene() {
  const model = useRef<ModelHandle>(null);
  const ref = useScrollScene<HTMLElement>((p, el) => {
    const v = (k: string, x: number) => el.style.setProperty(k, x.toFixed(3));
    const rise = seg(p, 0, 0.28);
    v("--rise", rise);
    v("--ret", seg(p, 0.24, 0.36) * (1 - seg(p, 0.46, 0.52)));
    v("--land", seg(p, 0.44, 0.56));
    v("--t1", seg(p, 0.1, 0.24) * (1 - seg(p, 0.42, 0.5)));
    v("--t2", seg(p, 0.52, 0.62) * (1 - seg(p, 0.88, 0.96)));
    v("--chip", seg(p, 0.58, 0.66));
    el.style.setProperty("--t2-pe", seg(p, 0.52, 0.62) * (1 - seg(p, 0.88, 0.96)) > 0.5 ? "auto" : "none");
    model.current?.orbit(lerp(-30, 40, p), lerp(66, 58, p), "118%");
  });

  return (
    <section ref={ref} className="relative h-[300vh]" style={{ ["--rise" as string]: 0, ["--ret" as string]: 0, ["--land" as string]: 0, ["--t1" as string]: 0, ["--t2" as string]: 0, ["--chip" as string]: 0 }}>
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,160,90,0.16), transparent 70%)" }} />

        {/* textos dos lados (embaixo, no celular) */}
        <div className="pointer-events-none absolute left-[6vw] top-1/2 hidden max-w-[300px] -translate-y-1/2 lg:block" style={{ opacity: "var(--t1)", transform: "translateY(calc(-50% + (1 - var(--t1)) * 24px))" }}>
          <p className="cine-kicker">Ver na mesa</p>
          <h3 className="cine-title mt-3 text-[44px] leading-[0.98]">Aponta para a mesa.</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-white/60">Um toque no prato e a câmera abre, direto no navegador. Nada para instalar.</p>
        </div>
        <div className="absolute right-[6vw] top-1/2 hidden max-w-[300px] lg:block" style={{ opacity: "var(--t2)", transform: "translateY(calc(-50% + (1 - var(--t2)) * 24px))", pointerEvents: "var(--t2-pe, none)" as never }}>
          <p className="cine-kicker">Tamanho real</p>
          <h3 className="cine-title mt-3 text-[44px] leading-[0.98]">O prato pousa do tamanho certo.</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-white/60">Dá para chegar perto e ver as camadas. Acaba o “achei que era maior”.</p>
          <div className="mt-6"><SeeOnTable prato="tiramisu" label="Experimentar na sua mesa" /></div>
        </div>
        <p className="cine-title pointer-events-none absolute inset-x-5 bottom-[4vh] text-center text-[30px] leading-tight lg:hidden" style={{ opacity: "max(var(--t1), var(--t2))" }}>
          Aponta para a mesa. O prato pousa do tamanho certo.
        </p>

        {/* o celular */}
        <div className="relative h-[min(78svh,760px)] max-h-[calc(100svh-250px)] -translate-y-[40px] lg:max-h-none lg:translate-y-0" style={{ aspectRatio: "390 / 844", transform: "translateY(calc((1 - var(--rise)) * 60vh)) rotate(calc((1 - var(--rise)) * 8deg))", opacity: "calc(0.2 + var(--rise) * 0.8)" }}>
          <div className="absolute inset-0 rounded-[13%/6%] bg-[#0b0e14] p-[2.4%] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.9),inset_0_0_0_1.5px_rgba(255,255,255,0.12)]">
            <div className="relative h-full w-full overflow-hidden rounded-[11%/5%] bg-[#2a1d14]">
              {/* a mesa de madeira vista pela câmera, em perspectiva (o fundo fica mais longe) */}
              <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ perspective: "420px" }}>
                <img src="/landing/mesa.webp" alt="" className="absolute left-[-55%] top-[-35%] h-[150%] w-[210%] max-w-none origin-bottom object-cover" style={{ transform: "rotateX(52deg)" }} />
              </div>
              <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(90% 55% at 50% 58%, rgba(255,214,160,0.30), transparent 65%), linear-gradient(180deg, rgba(8,6,4,0.85) 0%, rgba(8,6,4,0.35) 28%, transparent 48%, rgba(0,0,0,0.45) 100%)" }} />

              {/* alvo procurando a superfície */}
              <div aria-hidden className="absolute left-1/2 top-[56%] h-[34%] w-[70%] -translate-x-1/2 -translate-y-1/2" style={{ opacity: "var(--ret)" }}>
                <div className="ar-reticle absolute inset-0 rounded-[50%] border-2 border-white/80" style={{ transform: "rotateX(62deg)" }} />
              </div>

              {/* o prato */}
              <div className="absolute inset-x-[-10%] top-[22%] h-[64%]" style={{ opacity: "var(--land)", transform: "translateY(calc((1 - var(--land)) * -18%)) scale(calc(0.9 + var(--land) * 0.1))" }}>
                <Model ref={model} src="/demo/tiramisu.glb" alt="Tiramisù em 3D pousado na mesa" autoRotate={false} orbit="-30deg 66deg 118%" exposure={1.15} shadow={1.4} decay={160} className="h-full w-full" />
              </div>

              {/* interface do "ver na mesa" */}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[7%] pt-[12%] text-[clamp(10px,1.5svh,13px)] font-semibold text-white">
                <span className="rounded-full bg-black/45 px-3 py-1.5 backdrop-blur">Tiramisù da casa</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-black/45 backdrop-blur">✕</span>
              </div>
              <div className="absolute inset-x-0 bottom-[6%] flex justify-center" style={{ opacity: "var(--chip)", transform: "translateY(calc((1 - var(--chip)) * 12px))" }}>
                <span className="tnum flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-[clamp(11px,1.6svh,14px)] font-semibold text-white backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Tamanho real
                </span>
              </div>
              <span aria-hidden className="absolute left-1/2 top-[1.6%] h-[3%] w-[30%] -translate-x-1/2 rounded-full bg-[#0b0e14]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
