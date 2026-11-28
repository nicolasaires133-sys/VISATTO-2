"use client";
// Página para experimentar o "Ver na mesa" com os pratos de exemplo, aberta pelo QR ou pelo botão da página inicial.
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import DishViewer from "@/components/DishViewer";
import Logo from "@/components/Logo";

type Prato = { name: string; short?: string; desc: string; glb: string; usdz: string; dims: { w: number; d: number; h: number } };
const P = (file: string, name: string, short: string, desc: string, dims: Prato["dims"]): Prato => ({ name, short, desc, glb: `/demo/${file}.glb?v=6`, usdz: `/demo/${file}.usdz?v=6`, dims });
const PIZZA = { w: 43.2, d: 43.2, h: 4 };
// hambúrgueres: pão de 11 cm (medidas tiradas dos arquivos)
const BURGER: Record<string, Prato["dims"]> = { "x-burger": { w: 12.1, d: 12.1, h: 7.7 }, "x-salada": { w: 13.3, d: 13.3, h: 8.7 }, "x-egg": { w: 12.2, d: 12.2, h: 8.1 }, "x-bacon": { w: 13.2, d: 12.1, h: 8.1 }, "x-tudo": { w: 13.5, d: 13.3, h: 9.8 } };
const PRATOS: Record<string, Prato> = {
  pizza: { name: "Pizza Calabresa Grande", desc: "Calabresa artesanal, cebola roxa, muçarela e orégano.", glb: "/demo/pizza.glb?v=6", usdz: "/demo/pizza.usdz?v=6", dims: { w: 43.2, d: 43.2, h: 4 } },
  lasanha: { name: "Lasanha à Bolonhesa", desc: "Massa fresca, ragu de carne, bechamel e parmesão gratinado.", glb: "/demo/lasanha.glb?v=6", usdz: "/demo/lasanha.usdz?v=6", dims: { w: 26, d: 26, h: 7.6 } },
  shawarma: { name: "Shawarma de Frango", desc: "Pão sírio, frango grelhado, cebola roxa, pepino, repolho e pimentões.", glb: "/demo/shawarma.glb?v=6", usdz: "/demo/shawarma.usdz?v=6", dims: { w: 27, d: 27, h: 7.2 } },
  acai: { name: "Açaí 500 ml", desc: "Açaí com banana, granola, morango e leite condensado.", glb: "/demo/acai.glb?v=6", usdz: "/demo/acai.usdz?v=6", dims: { w: 9.9, d: 9.9, h: 11.2 } },
  pudim: { name: "Pudim de Leite", desc: "Pudim cremoso com calda de caramelo.", glb: "/demo/pudim.glb?v=6", usdz: "/demo/pudim.usdz?v=6", dims: { w: 26, d: 26, h: 6.6 } },
  brownie: { name: "Brownie com Sorvete", desc: "Brownie de chocolate, sorvete de creme e calda quente.", glb: "/demo/brownie.glb?v=6", usdz: "/demo/brownie.usdz?v=6", dims: { w: 20, d: 20, h: 9.5 } },
  tiramisu: { name: "Tiramisù da Casa", desc: "Mascarpone, café espresso, biscoito champagne e cacau.", glb: "/demo/tiramisu.glb?v=6", usdz: "/demo/tiramisu.usdz?v=6", dims: { w: 22, d: 22, h: 7.8 } },
  mussarela: P("pizza-mussarela", "Pizza Mussarela", "Mussarela", "Muçarela, rodelas de tomate, azeitona e orégano.", PIZZA),
  "frango-catupiry": P("pizza-frango-catupiry", "Pizza Frango com Catupiry", "Frango c/ Catupiry", "Frango desfiado, Catupiry original e orégano.", { ...PIZZA, h: 4.1 }),
  portuguesa: P("pizza-portuguesa", "Pizza Portuguesa", "Portuguesa", "Presunto, ovo, cebola, ervilha, azeitona e muçarela.", PIZZA),
  "bacon-cheddar": P("pizza-bacon-cheddar", "Pizza Bacon com Cheddar", "Bacon c/ Cheddar", "Muçarela, bacon crocante e fios de cheddar.", PIZZA),
  "frango-bacon": P("pizza-frango-bacon", "Pizza Frango com Bacon", "Frango c/ Bacon", "Frango desfiado, bacon crocante e muçarela.", PIZZA),
  pepperoni: P("pizza-pepperoni", "Pizza Pepperoni", "Pepperoni", "Pepperoni fatiado, muçarela e molho de tomate.", PIZZA),
  margherita: P("pizza-margherita", "Pizza Margherita", "Margherita", "Molho de tomate, muçarela de búfala e manjericão.", PIZZA),
  "quatro-queijos": P("pizza-quatro-queijos", "Pizza Quatro Queijos", "4 Queijos", "Muçarela, provolone, gorgonzola e parmesão.", PIZZA),
  brigadeiro: P("pizza-brigadeiro", "Pizza de Brigadeiro", "Brigadeiro", "Chocolate cremoso, granulado e brigadeiros.", { ...PIZZA, h: 4.7 }),
  "x-burger": P("burger-x-burger", "X-Burger", "X-Burger", "Pão com gergelim, hambúrguer e queijo derretido.", BURGER["x-burger"]),
  "x-salada": P("burger-x-salada", "X-Salada", "X-Salada", "Hambúrguer, queijo, alface e tomate.", BURGER["x-salada"]),
  "x-egg": P("burger-x-egg", "X-Egg", "X-Egg", "Hambúrguer, queijo e ovo frito.", BURGER["x-egg"]),
  "x-bacon": P("burger-x-bacon", "X-Bacon", "X-Bacon", "Hambúrguer, queijo e bacon crocante.", BURGER["x-bacon"]),
  "x-tudo": P("burger-x-tudo", "X-Tudo", "X-Tudo", "Hambúrguer, queijo, presunto, ovo, bacon, alface e tomate.", BURGER["x-tudo"]),
  pannacotta: { name: "Panna Cotta", desc: "Creme de baunilha com calda e frutas vermelhas.", glb: "/demo/pannacotta.glb?v=6", usdz: "/demo/pannacotta.usdz?v=6", dims: { w: 18, d: 18, h: 6.8 } },
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
      <p className="mt-6 text-[14px] font-semibold text-slate">Ver outro prato</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {outros.map(([k, o]) => (
          <Link key={k} href={`/ver/${k}`} className="btn-ghost h-10 px-3.5 text-[14px]">{o.short ?? o.name.split(" ")[0]}</Link>
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
