// Moldura das páginas de Política de Privacidade e Termos de Uso.
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-cream">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/"><Logo size={30} /></Link>
          <nav className="flex gap-4 text-[14px] text-white/70">
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
            <Link href="/termos" className="hover:text-white">Termos</Link>
          </nav>
        </div>
        <div className="mx-auto max-w-3xl px-5 pb-10 pt-6">
          <h1 className="display-wide text-[36px] leading-[1.05] sm:text-[46px]">{title}</h1>
          <p className="mt-3 text-[14px] text-white/55">Última atualização: {updated}</p>
        </div>
      </header>
      <article className="legal mx-auto max-w-3xl px-5 py-10 text-[16px] leading-relaxed text-black/80">{children}</article>
      <footer className="mx-auto max-w-3xl border-t border-line px-5 py-8 text-[14px] text-black/60">
        © {new Date().getFullYear()} Visatto · <Link href="/privacidade" className="underline">Política de Privacidade</Link> · <Link href="/termos" className="underline">Termos de Uso</Link>
      </footer>
    </main>
  );
}

export function contato() {
  const e = process.env.NEXT_PUBLIC_CONTATO_EMAIL;
  return e ? (
    <>
      pelo e-mail <a href={`mailto:${e}`}>{e}</a>
    </>
  ) : (
    <>pelas opções do painel, em Configurações</>
  );
}
