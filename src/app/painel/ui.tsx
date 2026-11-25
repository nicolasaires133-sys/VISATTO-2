"use client";
// Peças compartilhadas do painel.
import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DishArt } from "@/components/DishArt";

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[30px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 text-[14.5px] text-slate">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const openDialogs: object[] = []; // só a janela de cima responde ao Esc

/** Janela do painel: sobe de baixo no celular, centralizada no computador. Esc fecha. */
export function Dialog({ children, onClose, label, wide = false }: { children: React.ReactNode; onClose: () => void; label: string; wide?: boolean }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const me = {};
    openDialogs.push(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openDialogs[openDialogs.length - 1] === me && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      openDialogs.splice(openDialogs.indexOf(me), 1);
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`animate-sheet flex max-h-[94dvh] w-full outline-none flex-col overflow-hidden rounded-t-[28px] bg-white sm:rounded-[28px] ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  title,
  text,
  confirm,
  cancel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  text?: React.ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog onClose={onCancel} label={title}>
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h3 className="text-[21px] font-extrabold leading-tight">{title}</h3>
        {text && <p className="mt-2 text-[14.5px] text-black/65">{text}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-ghost h-12 flex-1" onClick={onCancel}>{cancel}</button>
          <button type="button" autoFocus className={`btn h-12 flex-1 text-white ${danger ? "bg-red-700 hover:bg-red-800" : "bg-ink hover:bg-black"}`} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-leaf" : "bg-black/20"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Linha de configuração com chave liga/desliga. */
export function SwitchRow({ on, onChange, title, text }: { on: boolean; onChange: (v: boolean) => void; title: string; text?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {text && <p className="text-[13.5px] text-black/55">{text}</p>}
      </div>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}

/** Foto do prato; sem foto, um prato desenhado. */
export function Thumb({ src, name, className = "" }: { src?: string; name?: string; className?: string }) {
  if (src) return <img src={src} alt="" loading="lazy" decoding="async" className={`bg-[#efede8] object-cover ${className}`} />;
  if (name) return <DishArt name={name} className={className} />;
  return (
    <div className={`grid place-items-center bg-[#efede8] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="h-1/2 w-1/2 text-black/20" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="32" cy="32" r="24" />
        <circle cx="32" cy="32" r="15" />
      </svg>
    </div>
  );
}

export function IconButton({ icon, label, onClick, className = "", danger = false }: { icon: string; label: string; onClick: () => void; className?: string; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`grid h-9 w-9 place-items-center rounded-lg text-black/60 hover:bg-black/5 ${danger ? "hover:text-red-700" : "hover:text-ink"} ${className}`}>
      <Icon name={icon} size={17} />
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const cls = { info: "bg-cream text-black/75", warn: "bg-amber-50 text-amber-950", error: "bg-red-50 text-red-800", ok: "bg-emerald-50 text-emerald-900" }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`flex gap-2 rounded-xl px-3.5 py-2.5 text-[14px] ${cls}`}>
      <Icon name={tone === "ok" ? "check" : tone === "info" ? "info" : "alert"} size={17} className="mt-0.5" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
