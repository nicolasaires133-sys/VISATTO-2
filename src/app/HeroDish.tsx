"use client";
import dynamic from "next/dynamic";
import Icon from "@/components/Icon";

const DishViewer = dynamic(() => import("@/components/DishViewer"), {
  ssr: false,
  loading: () => <div className="h-[340px] skeleton rounded-2xl" />,
});

export default function HeroDish() {
  return (
    <div className="mx-auto w-full max-w-md rounded-[28px] bg-white p-4 ring-1 ring-black/[0.08]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="font-display text-[17px] font-bold">Pizza Calabresa Grande</p>
          <p className="text-[13.5px] text-black/55">35 cm na tábua de 40 cm · serve 3</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white">
          <Icon name="scan" size={13} stroke={2} /> Ver na mesa
        </span>
      </div>
      <DishViewer
        model={{ glb: "/demo/pizza.glb", usdz: "/demo/pizza.usdz", dims: { w: 40, d: 40, h: 3.7 } }}
        poster="/demo/pizza.jpg"
        alt="Pizza em 3D"
        height={300}
      />
    </div>
  );
}
