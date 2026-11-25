"use client";
// Medida escondida: só aparece se a pessoa quiser ("Ver tamanho" → "40 cm").
import { useState } from "react";
import Icon from "@/components/Icon";

export default function SizeToggle({ size }: { size: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold text-white/70 ring-1 ring-white/15 transition-colors hover:text-white">
      <Icon name="ruler" size={16} />
      {open ? <span className="tnum animate-fade text-white">{size}</span> : "Ver tamanho"}
    </button>
  );
}
