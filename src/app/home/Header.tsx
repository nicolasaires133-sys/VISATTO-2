"use client";
// Topo da página inicial: fica transparente sobre o início e ganha fundo e linha ao rolar.
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

const LINKS = [
  { href: "#cliente", label: "Para o cliente" },
  { href: "#painel", label: "Para você" },
  { href: "#escaner", label: "Escâner 3D" },
  { href: "#precos", label: "Preços" },
  { href: "#perguntas", label: "Perguntas" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-300 ${scrolled || open ? "bg-white/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 md:px-8">
        <Link href="/" className="text-ink" aria-label="Visatto, início"><Logo size={30} /></Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[14.5px] font-medium text-slate transition-colors hover:text-ink">{l.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/entrar" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-semibold text-ink hover:bg-ink/5 sm:block">Entrar</Link>
          <Link href="/cadastro" className="btn-dark h-10 px-4"><span className="sm:hidden">Testar grátis</span><span className="hidden sm:inline">Criar cardápio grátis</span></Link>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-lg ring-1 ring-black/10 lg:hidden">
            <Icon name={open ? "close" : "list"} size={19} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="animate-enter border-t border-line px-5 pb-5 pt-2 lg:hidden" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-[17px] font-semibold">{l.label}</a>
          ))}
          <Link href="/entrar" className="mt-4 block text-[16px] font-semibold text-slate">Já tenho conta: entrar</Link>
        </nav>
      )}
    </header>
  );
}
