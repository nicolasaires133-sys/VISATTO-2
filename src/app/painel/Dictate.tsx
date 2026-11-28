"use client";
// Ditado por voz (reconhecimento de fala do próprio navegador, sem custo): o dono fala e o texto entra no campo.
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const getRec = (): (new () => Rec) | null => (typeof window === "undefined" ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null));

/** Botão de microfone: junta o que foi falado ao texto atual. */
export function DictateButton({ value, onChange, label, max = 500, sep = " · " }: { value: string; onChange: (v: string) => void; label: string; max?: number; sep?: string }) {
  const [state, setState] = useState<"idle" | "on" | "na" | "denied" | "err">("idle");
  const [live, setLive] = useState("");
  const rec = useRef<Rec | null>(null);
  const base = useRef("");
  useEffect(() => () => rec.current?.abort(), []);

  function start() {
    const R = getRec();
    if (!R) return setState("na");
    const r = new R();
    r.lang = "pt-BR";
    r.interimResults = true;
    r.continuous = false;
    base.current = value.trim();
    r.onresult = (e: any) => {
      let fin = "", tmp = "";
      for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript));
      setLive(tmp);
      if (fin.trim()) {
        const said = fin.trim().replace(/^./, (c) => c.toUpperCase());
        base.current = [base.current, said].filter(Boolean).join(base.current && !/[.·,;:!?]$/.test(base.current) ? sep : " ").slice(0, max);
        onChange(base.current);
      }
    };
    r.onerror = (e: any) => setState(e?.error === "not-allowed" || e?.error === "service-not-allowed" ? "denied" : e?.error === "no-speech" || e?.error === "aborted" ? "idle" : "err");
    r.onend = () => { setLive(""); setState((s) => (s === "on" ? "idle" : s)); };
    rec.current = r;
    try { r.start(); setState("on"); } catch { setState("idle"); }
  }
  function stop() { rec.current?.stop(); setState("idle"); }

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={state === "on" ? stop : start} aria-pressed={state === "on"} aria-label={state === "on" ? "Parar de ouvir" : `Falar ${label}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold ${state === "on" ? "animate-pulse bg-red-600 text-white" : "text-ink hover:bg-black/5"}`}>
        <Icon name="mic" size={15} /> {state === "on" ? "Ouvindo... toque para parar" : "Falar"}
      </button>
      {live && <span className="mt-0.5 max-w-56 truncate text-[12px] italic text-black/55" aria-live="polite">{live}</span>}
      {state === "na" && <span className="mt-0.5 max-w-64 text-right text-[12px] text-black/60" role="status">Este navegador não tem ditado. Use o microfone do teclado do celular.</span>}
      {state === "err" && <span className="mt-0.5 max-w-64 text-right text-[12px] text-black/60" role="status">Não consegui ouvir agora. Tente de novo ou use o microfone do teclado do celular.</span>}
      {state === "denied" && <span className="mt-0.5 max-w-64 text-right text-[12px] text-red-700" role="status">Libere o microfone nas permissões do navegador para ditar.</span>}
    </span>
  );
}
