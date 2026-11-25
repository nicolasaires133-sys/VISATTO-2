"use client";
// Botão "Ver na sua mesa" da página inicial. No celular, abre a página do prato com a câmera;
// no computador, mostra um QR para abrir no celular.
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

const mobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

export default function SeeOnTable({ prato = "pizza", label = "Ver na sua mesa", className = "cine-btn-ghost" }: { prato?: string; label?: string; className?: string }) {
  const [isMobile, setIsMobile] = useState(true);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  useEffect(() => setIsMobile(mobile()), []);
  useEffect(() => {
    if (!open || qr) return;
    import("qrcode").then((Q) => Q.toDataURL(`${window.location.origin}/ver/${prato}`, { margin: 1, width: 360 })).then(setQr).catch(() => {});
  }, [open, qr, prato]);

  if (isMobile)
    return (
      <Link href={`/ver/${prato}`} className={className}>
        <Icon name="scan" size={18} stroke={2} /> {label}
      </Link>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Icon name="scan" size={18} stroke={2} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5 backdrop-blur-sm" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Ver o prato na sua mesa">
          <div onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-sm rounded-[28px] bg-white p-7 text-center text-ink">
            <h3 className="text-[22px] font-bold leading-tight">Aponte a câmera do celular</h3>
            <p className="mt-2 text-[15px] text-slate">Abra no celular e toque em <b>Ver na minha mesa</b>. O prato aparece em cima da sua mesa, do tamanho de verdade.</p>
            <div className="mx-auto mt-5 grid h-56 w-56 place-items-center rounded-2xl bg-white ring-1 ring-black/10">
              {qr ? <img src={qr} alt={`QR code para abrir /ver/${prato}`} className="h-52 w-52" /> : <span className="text-[13px] text-slate">Gerando o QR...</span>}
            </div>
            <p className="mt-4 text-[13px] text-slate">Funciona no iPhone e no Android, direto no navegador.</p>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost mt-5 h-11 w-full">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
