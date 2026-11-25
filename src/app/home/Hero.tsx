"use client";
// Abertura cinematográfica: a pizza em 3D, enorme, sob uma luz de restaurante. Rolando, ela gira para a
// vista de cima e o texto troca de "Antes do pedido" para "Tamanho real" e "Só a câmera".
// Toda a cena é presa na tela e conduzida pela rolagem; sem rolar, o prato gira devagar sozinho.
import { TableFloor } from "./Backdrop";
import Link from "next/link";
import { useEffect, useRef } from "react";
import SeeOnTable from "./SeeOnTable";
import Model, { type ModelHandle } from "./Model";
import { lerp, seg, useScrollScene } from "./useScroll";

export default function Hero() {
  const model = useRef<ModelHandle>(null);
  const prog = useRef(0);
  const reduced = useRef(false);

  const scene = useScrollScene<HTMLElement>((p, el) => {
    prog.current = p;
    const v = (k: string, x: number) => el.style.setProperty(k, x.toFixed(3));
    v("--a", 1 - seg(p, 0.08, 0.26));
    v("--b", seg(p, 0.34, 0.46) * (1 - seg(p, 0.64, 0.72)));
    v("--c", seg(p, 0.76, 0.86));
    // no computador, na fase "tamanho real" a pizza vai para a direita e o texto fica à esquerda
    const wide = window.innerWidth >= 1024;
    const side = seg(p, 0.3, 0.44) * (1 - seg(p, 0.66, 0.76));
    v("--x", wide ? side * 17 : 0);
    v("--s", lerp(1, wide ? 0.8 : 0.66, seg(p, 0.25, 0.55)) * lerp(1, 0.86, seg(p, 0.74, 1)));
    v("--y", wide ? lerp(0, -4, seg(p, 0.74, 1)) : side * 9 + lerp(0, -4, seg(p, 0.74, 1)));
    v("--g", 0.55 + 0.45 * seg(p, 0.2, 0.5));
  });

  // câmera: gira devagar sempre; a rolagem leva da vista de lado para a de cima e volta um pouco
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      const p = prog.current;
      const spin = reduced.current ? 0 : ((now - t0) / 1000) * 9;
      const top = seg(p, 0.26, 0.5) * (1 - seg(p, 0.7, 0.9) * 0.6);
      const theta = -25 + spin + p * 140;
      const phi = lerp(74, 4, top);
      const radius = `${lerp(98, 124, top).toFixed(0)}%`;
      model.current?.orbit(theta, phi, radius);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section ref={scene} className="hero-scene relative h-[320vh]" style={{ ["--a" as string]: 1, ["--b" as string]: 0, ["--c" as string]: 0, ["--s" as string]: 1, ["--g" as string]: 0.55 }}>
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* luz de restaurante atrás do prato */}
        <div aria-hidden className="absolute left-1/2 top-[52%] h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,138,76,0.30), rgba(255,90,46,0.10) 45%, transparent 72%)", opacity: "var(--g)" }} />
        <TableFloor />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-[#07090d] to-transparent" />

        {/* o prato */}
        <div
          className="absolute left-1/2 top-[56%] aspect-square w-[min(92vw,86vh)] will-change-transform md:top-[58%]"
          style={{ transform: "translate(calc(-50% + var(--x, 0) * 1vw), calc(-50% + var(--y, 0) * 1vh)) scale(var(--s))" }}
        >
          <Model
            ref={model}
            src="/demo/pizza.glb?v=4"
            alt="Pizza calabresa em 3D"
            autoRotate={false}
            orbit="-25deg 74deg 98%"
            exposure={1.12}
            shadow={1.2}
            decay={140}
            className="h-full w-full"
          />
        </div>

        {/* 1: a promessa */}
        <div className="absolute inset-x-0 top-[13vh] px-5 text-center md:top-[11vh]" style={{ opacity: "var(--a)", transform: "translateY(calc((1 - var(--a)) * -40px))", filter: "blur(calc((1 - var(--a)) * 8px))", pointerEvents: "auto" }}>
          <h1 className="cine-title text-[clamp(52px,11vw,168px)] leading-[0.9]">Antes do pedido.</h1>
          <p className="mx-auto mt-5 max-w-[34rem] text-[clamp(17px,1.5vw,21px)] leading-relaxed text-white/70">
            O cliente aponta a câmera e vê o prato na mesa, em 3D, do tamanho que vai chegar.
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-[7vh] flex flex-col items-center gap-5 px-5" style={{ opacity: "var(--a)" }}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/cadastro" className="cine-btn">Criar meu cardápio grátis</Link>
            <SeeOnTable prato="pizza" label="Ver uma pizza na sua mesa" />
          </div>
          <span className="flex items-center gap-2 text-[13px] text-white/45"><span className="scroll-cue" aria-hidden /> Role para ver</span>
        </div>

        {/* 2: tamanho real */}
        <div className="pointer-events-none absolute inset-x-0 top-[11vh] px-5 text-center lg:inset-x-auto lg:left-[7vw] lg:top-1/2 lg:max-w-[40vw] lg:-translate-y-1/2 lg:px-0 lg:text-left" style={{ opacity: "var(--b)" }}>
          <h2 className="cine-title text-[clamp(48px,7.4vw,128px)] leading-[0.9]">Tamanho real.</h2>
          <p className="mx-auto mt-5 max-w-[30rem] text-[clamp(16px,1.4vw,20px)] leading-relaxed text-white/65 lg:mx-0">
            O prato aparece na mesa do tamanho que vai chegar. Sem susto quando ele chega.
          </p>
        </div>

        {/* 3: só a câmera */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[9vh] px-5 text-center" style={{ opacity: "var(--c)", transform: "translateY(calc((1 - var(--c)) * 30px))" }}>
          <h2 className="cine-title text-[clamp(40px,7vw,108px)] leading-[0.92]">Sem aplicativo.<br />Só a câmera.</h2>
          <p className="mx-auto mt-5 max-w-[30rem] text-[clamp(16px,1.4vw,20px)] leading-relaxed text-white/65">Funciona no iPhone e no Android, direto do QR code da mesa.</p>
        </div>
      </div>
    </section>
  );
}
