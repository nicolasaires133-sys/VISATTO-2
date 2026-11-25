"use client";
// Peças compartilhadas do cardápio do cliente.
import { DishArt } from "@/components/DishArt";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import type { PublicItem as MenuItem } from "@/lib/format";

export function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

// Quando a página vai trocar (ex.: pedido enviado), as folhas abertas não devem mexer no histórico.
let leaving = false;
export function leavingPage() {
  leaving = true;
  setTimeout(() => (leaving = false), 3000);
}

/** Folha que sobe de baixo. O botão "voltar" do celular fecha a folha em vez de sair do cardápio. */
export function Sheet({ children, onClose, full = false, label }: { children: React.ReactNode; onClose: () => void; full?: boolean; label: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = Math.random().toString(36).slice(2);
    let popped = false;
    try {
      history.pushState({ ...(history.state || {}), visattoSheet: id }, "");
    } catch {}
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      // fechada pelo X ou por uma ação: tira a entrada que a folha colocou no histórico
      if (!popped && !leaving && history.state?.visattoSheet === id) {
        try {
          history.back();
        } catch {}
      }
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`animate-sheet flex w-full max-w-2xl flex-col overflow-hidden bg-white sm:rounded-[28px] ${full ? "h-[100dvh] sm:h-[90dvh]" : "max-h-[94dvh] rounded-t-[28px]"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Fechar" className={`grid h-10 w-10 place-items-center rounded-full bg-white text-ink ring-1 ring-black/10 ${className}`}>
      <Icon name="close" size={18} />
    </button>
  );
}

export function Pill({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-black/[0.06] text-black/65"}`}>{children}</span>
  );
}

/** Selo dos pratos que dá para ver na mesa pela câmera. */
export function ArBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-ink px-2 py-[3px] text-[11.5px] font-semibold text-white ${className}`}>
      <Icon name="scan" size={13} stroke={2} />
      Ver na mesa
    </span>
  );
}

/** Foto do prato; sem foto, um desenho do tipo de prato (pizza, massa, bebida...), igual em todo celular. */
export function Thumb({ item, className = "", art = 0.72 }: { item: Pick<MenuItem, "image" | "name"> & { description?: string }; className?: string; art?: number }) {
  if (item.image) return <img src={item.image} alt="" loading="lazy" decoding="async" className={`bg-[#ececE7] object-cover ${className}`} />;
  return <DishArt name={item.name} description={item.description} className={className} size={art} />;
}

export function Stepper({ qty, onChange, min = 0, size = "md" }: { qty: number; onChange: (q: number) => void; min?: number; size?: "md" | "lg" }) {
  const b = size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <div className="flex items-center rounded-xl bg-white ring-1 ring-black/12">
      <button type="button" aria-label="Diminuir" className={`grid ${b} place-items-center disabled:opacity-30`} disabled={qty <= min} onClick={() => onChange(qty - 1)}>
        <Icon name="minus" size={16} stroke={2.2} />
      </button>
      <span className="tnum w-6 text-center text-[15px] font-bold" aria-live="polite">{qty}</span>
      <button type="button" aria-label="Aumentar" className={`grid ${b} place-items-center`} onClick={() => onChange(qty + 1)}>
        <Icon name="plus" size={16} stroke={2.2} />
      </button>
    </div>
  );
}


/** Medidas reais do prato, desenhadas como cotas (a régua é a marca do Visatto). */
/** Tamanho do prato só quando o cliente quer ver: um botão discreto que mostra "40 cm". */
export function Dims({ dims, label = "Ver o tamanho", sizeLabel = "Tamanho", note = "medido no restaurante" }: { dims: { w: number; d: number; h: number }; label?: string; sizeLabel?: string; note?: string }) {
  const [open, setOpen] = useState(false);
  const size = `${Math.round(Math.max(dims.w, dims.d || 0))} cm`;
  return open ? (
    <button type="button" onClick={() => setOpen(false)} className="animate-enter flex w-full items-center gap-3 rounded-2xl bg-[#efefeb] px-4 py-3 text-left">
      <Icon name="ruler" size={20} className="shrink-0 text-black/50" />
      <span className="flex-1">
        <b className="tnum text-[17px]">{sizeLabel}: {size}</b>
        <span className="block text-[12.5px] text-black/50">{note}</span>
      </span>
      <Icon name="close" size={16} className="text-black/35" />
    </button>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold text-black/65 ring-1 ring-black/12 transition-colors hover:bg-black/[0.04]">
      <Icon name="ruler" size={16} /> {label}
    </button>
  );
}
