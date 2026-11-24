// Moldura das telas de entrar e criar conta: no computador, o prato sob a luz à esquerda e o formulário à direita.
import Link from "next/link";
import Logo from "@/components/Logo";

export default function AuthShell({ title, sub, side, children }: { title: string; sub?: string; side: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh md:grid md:grid-cols-[1fr_minmax(440px,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink text-white md:flex md:flex-col md:justify-between md:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_58%,rgba(228,87,46,0.2),transparent_70%)]" />
        <Link href="/" className="relative inline-flex"><Logo size={34} /></Link>
        <div className="relative mx-auto w-full max-w-[380px]">
          <div className="relative aspect-square">
            <img src="/demo/tiramisu.jpg" alt="" className="h-full w-full rounded-[28px] object-cover opacity-95" />
            <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-[-6%] h-[112%] w-[112%] overflow-visible">
              {["M2 14V6Q2 2 6 2H14", "M86 2H94Q98 2 98 6V14", "M98 86V94Q98 98 94 98H86", "M14 98H6Q2 98 2 94V86"].map((d) => (
                <path key={d} d={d} fill="none" stroke="#E4572E" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
          <div aria-hidden className="ruler mt-10 h-4 text-white/30" />
        </div>
        <p className="display-wide relative max-w-md text-[34px] leading-[1.04]">{side}</p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-cream md:bg-white">
        <header className="bg-ink px-5 pb-8 pt-5 text-white md:hidden">
          <Link href="/" className="inline-flex"><Logo size={30} /></Link>
          <p className="display-wide mt-6 text-[26px] leading-[1.05]">{side}</p>
        </header>
        <div className="flex flex-1 items-start justify-center px-5 py-8 md:items-center md:py-12">
          <div className="animate-enter w-full max-w-[400px]">
            <h1 className="text-[30px] font-extrabold leading-tight">{title}</h1>
            {sub && <p className="mt-1.5 text-[15.5px] text-black/60">{sub}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
