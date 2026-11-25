"use client";
// Topo da página inicial: fica transparente sobre o início e ganha fundo e linha ao rolar.
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

const LINKS = [
  { href: "#cliente", label: "Como funciona" },
  { href: "#escaner", label: "Escâner 3D" },
  { href: "#painel", label: "Painel" },
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
    <header className={`fixed inset-x-0 top-0 z-40 text-white transition-[background-color,box-shadow] duration-300 ${scrolled || open ? "bg-[#07090d]/70 shadow-[0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl backdrop-saturate-150" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 md:px-8">
        <Link href="/" className="text-white" aria-label="Visatto, início"><Logo size={30} /></Link>
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[14px] font-medium text-white/65 transition-colors hover:text-white">{l.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/entrar" className="hidden rounded-lg px-3 py-2 text-[14px] font-semibold text-white/85 hover:bg-white/10 sm:block">Entrar</Link>
          <Link href="/cadastro" className="btn h-9 rounded-full bg-white px-4 text-[14px] text-[#07090d] hover:bg-white/90"><span className="sm:hidden">Testar grátis</span><span className="hidden sm:inline">Criar cardápio grátis</span></Link>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/20 lg:hidden">
            <Icon name={open ? "close" : "list"} size={19} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="animate-enter border-t border-white/10 px-5 pb-5 pt-2 lg:hidden" aria-label="Principal">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-white/10 py-3.5 text-[17px] font-semibold">{l.label}</a>
          ))}
          <Link href="/entrar" className="mt-4 block text-[16px] font-semibold text-white/60">Já tenho conta: entrar</Link>
        </nav>
      )}
    </header>
  );
}
