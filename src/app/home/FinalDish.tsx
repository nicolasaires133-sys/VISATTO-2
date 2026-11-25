"use client";
// Fechamento: frase gigante e a pizza girando por trás, iluminada, com o convite final.
import Link from "next/link";
import Model from "./Model";

export default function FinalDish() {
  return (
    <section className="relative overflow-hidden pb-24 pt-10 md:pb-32">
      <div aria-hidden className="absolute left-1/2 top-[58%] h-[110vmin] w-[110vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,120,60,0.28), rgba(255,90,46,0.08) 50%, transparent 72%)" }} />
      <div className="relative mx-auto max-w-[1200px] px-5 text-center md:px-8">
        <h2 className="cine-title mx-auto max-w-5xl text-[clamp(48px,9vw,150px)] leading-[0.9]">Seu primeiro prato em 3D, hoje.</h2>
        <div className="relative mx-auto -mt-[4vw] aspect-[16/10] w-full max-w-[900px]">
          <Model src="/demo/pizza.glb?v=6" alt="Pizza calabresa em 3D girando" orbit="0deg 66deg 100%" rotateSpeed="14deg" exposure={1.15} shadow={1.3} className="h-full w-full" />
        </div>
        <div className="relative -mt-[6vw] flex flex-wrap justify-center gap-3">
          <Link href="/cadastro" className="cine-btn">Criar meu cardápio grátis</Link>
          <Link href="/r/cantina-da-nonna?mesa=7" className="cine-btn-ghost">Ver o exemplo antes</Link>
        </div>
        <p className="relative mt-5 text-[14px] text-white/45">14 dias grátis, sem cartão de crédito.</p>
      </div>
    </section>
  );
}
