"use client";
// Peças compartilhadas do cardápio do cliente.
import { DishArt } from "@/components/DishArt";
import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import type { PublicItem as MenuItem } from "@/lib/format";
import { useFocusTrap } from "@/lib/useFocusTrap";

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

// O botão "voltar" do celular fecha a folha de cima. Todas as folhas abertas dividem UMA entrada no
// histórico: assim, trocar de folha (ex.: carrinho -> editar prato) não mexe no histórico e nada fecha sozinho.
const openSheets: { current: () => void }[] = [];
let hasEntry = false;
let ignoreNextPop = false;
function ensureEntry() {
  if (hasEntry || leaving) return;
  try {
    history.pushState({ ...(history.state || {}), visattoSheet: 1 }, "");
    hasEntry = true;
  } catch {}
}
if (typeof window !== "undefined")
  window.addEventListener("popstate", () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    if (!hasEntry) return;
    hasEntry = false;
    openSheets[openSheets.length - 1]?.current();
    // ainda tem folha aberta por baixo: ela ganha a entrada de volta
    setTimeout(() => openSheets.length && ensureEntry(), 0);
  });

/** Folha que sobe de baixo. O botão "voltar" do celular fecha a folha em vez de sair do cardápio. */
export function Sheet({ children, onClose, full = false, label }: { children: React.ReactNode; onClose: () => void; full?: boolean; label: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const me = { current: () => closeRef.current() };
    openSheets.push(me);
    ensureEntry();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openSheets[openSheets.length - 1] === me && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      openSheets.splice(openSheets.indexOf(me), 1);
      // fechou pelo X ou por uma ação e nenhuma outra folha abriu: tira a entrada do histórico
      setTimeout(() => {
        if (openSheets.length || !hasEntry || leaving) return;
        hasEntry = false;
        ignoreNextPop = true;
        try {
          history.back();
        } catch {
          ignoreNextPop = false;
        }
      }, 0);
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={`animate-sheet flex outline-none w-full max-w-2xl flex-col overflow-hidden bg-white sm:rounded-[28px] ${full ? "h-[100dvh] sm:h-[90dvh]" : "max-h-[94dvh] rounded-t-[28px]"}`}
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

/** Tema escuro do cardápio: "escuro" sempre, "auto" quando o celular do cliente está no modo escuro. */
export function useMenuTheme(theme?: string) {
  useEffect(() => {
    const el = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      if (theme === "escuro" || (theme === "auto" && mq.matches)) el.dataset.theme = "dark";
      else delete el.dataset.theme;
    };
    apply();
    mq.addEventListener?.("change", apply);
    return () => {
      mq.removeEventListener?.("change", apply);
      delete el.dataset.theme;
    };
  }, [theme]);
}

/** Selo discreto de 3D no canto da foto (o "ver na mesa" aparece quando a pessoa abre o prato). */
export function Chip3D({ className = "", label = "3D" }: { className?: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-[rgba(255,255,255,0.95)] px-1.5 py-[3px] text-[10.5px] font-bold text-[#172033] shadow-sm ${className}`} aria-label={label} title={label}>
      <Icon name="cube" size={12} stroke={2} />3D
    </span>
  );
}

/** Foto do prato; sem foto, um desenho do tipo de prato (pizza, massa, bebida...), igual em todo celular.
 *  Se o dono escolheu "sem foto", aparece só um bloco com o símbolo da categoria (nos carrosséis). */
export function Thumb({ item, className = "", art = 0.72, icon }: { item: Pick<MenuItem, "image" | "name"> & { description?: string; photo_mode?: string; tags?: string[] }; className?: string; art?: number; icon?: string }) {
  if (item.photo_mode === "none")
    return (
      <span className={`grid place-items-center bg-[color-mix(in_srgb,var(--color-brand)_10%,var(--surface-2,#f4f3ef))] text-[color-mix(in_srgb,var(--color-brand)_70%,var(--ink-mix,#172033))] ${className}`} aria-hidden>
        <Icon name={(CAT_ICON[icon ?? ""] ?? "bowl") as IconName} size={34} stroke={1.6} />
      </span>
    );
  if (item.image) return <img src={item.image} alt="" loading="lazy" decoding="async" className={`bg-[#ececE7] object-cover ${className}`} />;
  return <DishArt name={item.name} description={item.description} tags={item.tags} className={className} size={art} />;
}

import { CAT_ICON } from "@/lib/catIcons";
export { CAT_ICON };

/** Etiqueta com símbolo: combo, vegano, picante, novidade... */
const TAG_ICON: Record<string, string> = { combo: "layers", vegano: "leaf", vegetariano: "leaf", picante: "flame", novidade: "sparkle", "mais pedido": "star", kids: "kid", fit: "leaf", "sem glúten": "check", "sem lactose": "check" };
export function TagPill({ tag }: { tag: string }) {
  const icon = TAG_ICON[tag];
  const tone = tag === "picante" ? "bg-red-50 text-red-800" : tag === "vegano" || tag === "vegetariano" || tag === "fit" ? "bg-emerald-50 text-emerald-800" : tag === "combo" ? "bg-indigo-50 text-indigo-900" : tag === "novidade" ? "bg-amber-50 text-amber-900" : "bg-black/[0.06] text-black/65";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}>
      {icon && <Icon name={icon as IconName} size={12} stroke={2} />}
      {tag.charAt(0).toUpperCase() + tag.slice(1)}
    </span>
  );
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


