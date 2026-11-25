"use client";
// Página que abre dentro do App Clip do Variant Launch (iPhone). Só tem o prato e o botão da câmera:
// a câmera procura a mesa com o carregamento de bolinhas e o prato só aparece pronto, no tamanho real.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DishViewer from "@/components/DishViewer";
import Logo from "@/components/Logo";
import { safeModelUrl } from "@/lib/iosAr";

function Conteudo() {
  const q = useSearchParams();
  const glb = safeModelUrl(q.get("glb"));
  const usdz = safeModelUrl(q.get("usdz")) || undefined;
  const name = (q.get("n") || "Prato").slice(0, 80);
  const d = (q.get("d") || "").split(",").map(Number);
  const dims = d.length === 3 && d.every((x) => Number.isFinite(x) && x > 0 && x < 500) ? { w: d[0], d: d[1], h: d[2] } : null;

  if (!glb) {
    return <p className="mt-10 text-center text-[15px] text-slate">Não foi possível abrir este prato. Volte ao cardápio e tente de novo.</p>;
  }
  return (
    <>
      <h1 className="mt-5 text-[26px] font-bold leading-tight">{name}</h1>
      <p className="mt-1 text-[15px] text-slate">Toque no botão, aponte para a mesa e mova o celular devagar.</p>
      <div className="mt-4">
        <DishViewer model={{ glb, usdz, dims }} alt={`${name} em 3D`} height={360} hideDims color="#E4572E" quickOpen autoOpen />
      </div>
      <p className="mt-6 text-center text-[13px] text-slate">Para voltar ao cardápio, feche esta janela.</p>
    </>
  );
}

export default function VerNaMesa() {
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-4 pb-10 pt-5">
      <Logo size={24} />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </main>
  );
}
