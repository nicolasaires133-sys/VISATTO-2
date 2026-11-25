"use client";
// Motor das cenas "presas" da página inicial: uma seção alta com um palco fixo (sticky) dentro.
// Conforme a pessoa rola, calcula de 0 a 1 o quanto da cena já passou e escreve em --p (sem re-renderizar),
// e chama onFrame para quem precisa mexer em algo fora do CSS (a câmera do 3D, por exemplo).
import { useEffect, useRef } from "react";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** pedaço da cena: 0 antes de `a`, 1 depois de `b`, suave no meio */
export const seg = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function useScrollScene<T extends HTMLElement>(onFrame?: (p: number, el: T) => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = -1;
    const run = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = clamp(-r.top / span);
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      el.style.setProperty("--p", p.toFixed(4));
      cb.current?.(p, el);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
