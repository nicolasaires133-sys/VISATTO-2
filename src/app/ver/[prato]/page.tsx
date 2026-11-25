"use client";
// Página para experimentar o "Ver na mesa" com os pratos de exemplo, aberta pelo QR ou pelo botão da página inicial.
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import DishViewer from "@/components/DishViewer";
import Logo from "@/components/Logo";
import { Dims } from "@/app/r/[slug]/parts";

const PRATOS: Record<string, { name: string; desc: string; glb: string; usdz: string; dims: { w: number; d: number; h: number } }> = {
  pizza: { name: "Pizza Calabresa Grande", desc: "Calabresa artesanal, cebola roxa, muçarela e orégano.", glb: "/demo/pizza.glb?v=4", usdz: "/demo/pizza.usdz?v=4", dims: { w: 43.2, d: 43.2, h: 4 } },
  lasanha: { name: "Lasanha à Bolonhesa", desc: "Massa fresca, ragu de carne, bechamel e parmesão gratinado.", glb: "/demo/lasanha.glb?v=4", usdz: "/demo/lasanha.usdz?v=4", dims: { w: 26, d: 26, h: 7.6 } },
  shawarma: { name: "Shawarma de Carne", desc: "Pão sírio, carne temperada, alface, tomate e molho de alho.", glb: "/demo/shawarma.glb?v=4", usdz: "/demo/shawarma.usdz?v=4", dims: { w: 30, d: 20, h: 6.8 } },
  acai: { name: "Açaí 500 ml", desc: "Açaí com banana, granola, morango e leite condensado.", glb: "/demo/acai.glb?v=4", usdz: "/demo/acai.usdz?v=4", dims: { w: 9.9, d: 9.9, h: 11.2 } },
  pudim: { name: "Pudim de Leite", desc: "Pudim cremoso com calda de caramelo.", glb: "/demo/pudim.glb?v=4", usdz: "/demo/pudim.usdz?v=4", dims: { w: 26, d: 26, h: 6.6 } },
  brownie: { name: "Brownie com Sorvete", desc: "Brownie de chocolate, sorvete de creme e calda quente.", glb: "/demo/brownie.glb?v=4", usdz: "/demo/brownie.usdz?v=4", dims: { w: 20, d: 20, h: 9.5 } },
  tiramisu: { name: "Tiramisù da Casa", desc: "Mascarpone, café espresso, biscoito champagne e cacau.", glb: "/demo/tiramisu.glb?v=4", usdz: "/demo/tiramisu.usdz?v=4", dims: { w: 22, d: 22, h: 7.8 } },
  pannacotta: { name: "Panna Cotta", desc: "Creme de baunilha com calda e frutas vermelhas.", glb: "/demo/pannacotta.glb?v=4", usdz: "/demo/pannacotta.usdz?v=4", dims: { w: 18, d: 18, h: 6.8 } },
};

export default function Ver({ params }: { params: Promise<{ prato: string }> }) {
  const { prato } = use(params);
  const router = useRouter();
  const p = PRATOS[prato] ?? PRATOS.pizza;
  const outros = Object.entries(PRATOS).filter(([k]) => k !== (PRATOS[prato] ? prato : "pizza"));
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-4 pb-10 pt-5">
      <Link href="/" className="inline-block text-ink"><Logo size={26} /></Link>
      <h1 className="mt-5 text-[28px] font-bold leading-tight">{p.name}</h1>
      <p className="mt-1 text-[15px] text-slate">{p.desc}</p>
      <div className="mt-4">
        <DishViewer model={{ glb: p.glb, usdz: p.usdz, dims: p.dims }} alt={`${p.name} em 3D`} height={340} hideDims color="#E4572E" arTitle={p.name} arSubtitle="Cardápio de exemplo do Visatto" arAction="Quero no meu restaurante" onArAction={() => router.push("/cadastro")} />
      </div>
      <div className="mt-3"><Dims dims={p.dims} /></div>
      <p className="mt-6 text-[14px] font-semibold text-slate">Ver outro prato</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {outros.map(([k, o]) => (
          <Link key={k} href={`/ver/${k}`} className="btn-ghost h-10 px-3.5 text-[14px]">{o.name.split(" ")[0]}</Link>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-cream p-4">
        <p className="text-[15px] font-bold">Quer isso no seu restaurante?</p>
        <p className="mt-1 text-[14px] text-slate">Escaneie os seus pratos com o celular e uma folha A4 em branco.</p>
        <Link href="/cadastro" className="btn-primary mt-3 h-11 px-4">Criar meu cardápio grátis</Link>
      </div>
    </main>
  );
}
