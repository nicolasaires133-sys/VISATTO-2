"use client";
// Frase grande que acende palavra por palavra conforme a rolagem (a cena fica presa enquanto isso).
import { useRef } from "react";
import { useScrollScene } from "./useScroll";

export default function WordReveal({ text, accent = [] }: { text: string; accent?: string[] }) {
  const words = text.split(" ");
  const spans = useRef<(HTMLSpanElement | null)[]>([]);
  const ref = useScrollScene<HTMLElement>((p) => {
    const lit = p * 1.25 * words.length;
    spans.current.forEach((s, i) => {
      if (!s) return;
      const k = Math.min(1, Math.max(0, lit - i));
      s.style.opacity = String(0.14 + 0.86 * k);
    });
  });
  return (
    <section ref={ref} className="relative h-[230vh]">
      <div className="sticky top-0 flex h-svh items-center">
        <p className="mx-auto max-w-[1100px] px-5 text-[clamp(30px,4.6vw,68px)] font-semibold leading-[1.12] tracking-[-0.03em] md:px-8" style={{ fontFamily: "var(--font-wide)" }}>
          {words.map((w, i) => (
            <span key={i} ref={(el) => { spans.current[i] = el; }} className={`transition-opacity duration-150 ${accent.includes(w.replace(/[.,]/g, "")) ? "text-[#ff7a4d]" : "text-white"}`} style={{ opacity: 0.14 }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
