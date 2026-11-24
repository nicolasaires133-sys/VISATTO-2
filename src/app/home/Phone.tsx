// Moldura de celular para as telas reais do produto (sem imagem de marca de aparelho).
export default function Phone({ children, className = "", small = false }: { children: React.ReactNode; className?: string; small?: boolean }) {
  return (
    <div className={`relative bg-[#0f1522] shadow-[0_50px_90px_-45px_rgba(15,21,34,0.75),inset_0_0_0_1px_rgba(255,255,255,0.08)] ${small ? "rounded-[28px] p-[5px]" : "rounded-[46px] p-[9px]"} ${className}`}>
      <div className={`relative aspect-[390/844] overflow-hidden bg-white ${small ? "rounded-[23px]" : "rounded-[38px]"}`}>
        {children}
        <span aria-hidden className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-[#0f1522] ${small ? "top-1.5 h-[11px] w-[28%]" : "top-2.5 h-[22px] w-[30%]"}`} />
      </div>
    </div>
  );
}

/** Moldura de navegador para as telas do painel. */
export function Browser({ children, url = "visatto.com.br/painel", className = "" }: { children: React.ReactNode; url?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-[0_40px_90px_-50px_rgba(15,21,34,0.55)] ring-1 ring-[#172033]/10 ${className}`}>
      <div className="flex items-center gap-3 border-b border-line bg-[#fbfbfa] px-4 py-2.5">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9dbd8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9dbd8]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9dbd8]" />
        </span>
        <span className="mx-auto truncate rounded-md bg-white px-3 py-1 text-[12px] text-slate ring-1 ring-line">{url}</span>
        <span aria-hidden className="w-[42px]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
