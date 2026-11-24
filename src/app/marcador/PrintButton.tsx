"use client";
import Icon from "@/components/Icon";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary mt-4 h-12 w-full text-[15px]">
      <Icon name="printer" size={18} /> Imprimir (A4, tamanho real)
    </button>
  );
}
