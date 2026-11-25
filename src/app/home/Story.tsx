"use client";
// O caminho do cliente contado em quatro telas reais. No computador, o celular fica parado
// e a tela troca conforme a pessoa rola o texto; no celular, cada passo traz a sua tela.
import { useEffect, useRef, useState } from "react";
import Phone from "./Phone";

export type StoryStep = { img: string; alt: string; title: string; text: string; points: string[] };

export default function Story({ steps, dark = false }: { steps: StoryStep[]; dark?: boolean }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
      <ol className="relative">
        {/* trilho de progresso ao lado dos passos */}
        <span aria-hidden className={`absolute bottom-0 left-[11px] top-2 hidden w-px lg:block ${dark ? "bg-white/12" : "bg-line"}`} />
        <span
          aria-hidden
          className="absolute left-[11px] top-2 hidden w-px origin-top bg-brand transition-transform duration-500 ease-out lg:block"
          style={{ height: "calc(100% - 0.5rem)", transform: `scaleY(${(active + 1) / steps.length})` }}
        />
        {steps.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => { refs.current[i] = el; }}
            data-i={i}
            className={`relative flex min-h-0 flex-col justify-center pb-16 transition-opacity duration-500 lg:min-h-[78vh] lg:pb-0 lg:pl-14 ${active === i ? "lg:opacity-100" : "lg:opacity-40"}`}
          >
            <span aria-hidden className={`absolute left-0 top-1/2 hidden h-[23px] w-[23px] -translate-y-1/2 rounded-full border-2 transition-colors duration-500 lg:block ${dark ? "bg-[#07090d]" : "bg-white"} ${i <= active ? "border-brand" : dark ? "border-white/20" : "border-line"}`}>
              <span className={`absolute inset-[4px] rounded-full transition-colors duration-500 ${i <= active ? "bg-brand" : "bg-transparent"}`} />
            </span>
            <p className={`tnum text-[13.5px] font-semibold ${dark ? "text-[#ff8a5c]" : "text-brand"}`}>Passo {i + 1} de {steps.length}</p>
            <h3 className={`font-wide mt-2 text-[30px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[40px] ${dark ? "text-white" : ""}`}>{s.title}</h3>
            <p className={`mt-4 max-w-[34rem] text-[17px] leading-relaxed ${dark ? "text-white/60" : "text-slate"}`}>{s.text}</p>
            <ul className={`mt-6 max-w-[34rem] divide-y border-y ${dark ? "divide-white/10 border-white/10 text-white/85" : "divide-line border-line"}`}>
              {s.points.map((p) => (
                <li key={p} className="flex gap-3 py-3 text-[15.5px]">
                  <span aria-hidden className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${dark ? "bg-brand" : "bg-ink"}`} />
                  {p}
                </li>
              ))}
            </ul>
            {/* celular: a tela deste passo */}
            <div className="mx-auto mt-10 w-[78%] max-w-[300px] lg:hidden">
              <Phone>
                <img src={s.img} alt={s.alt} loading="lazy" className="h-full w-full object-cover object-top" />
              </Phone>
            </div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-370px)]">
          <Phone>
            {steps.map((s, i) => (
              <img
                key={s.img}
                src={s.img}
                alt={active === i ? s.alt : ""}
                aria-hidden={active !== i}
                loading={i === 0 ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full object-cover object-top transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${active === i ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"}`}
              />
            ))}
          </Phone>
        </div>
      </div>
    </div>
  );
}
