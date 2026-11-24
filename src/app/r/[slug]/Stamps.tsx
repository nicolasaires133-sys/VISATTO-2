"use client";
import Icon from "@/components/Icon";

/** Selos do cartão fidelidade: bolinhas cheias e vazias. */
export default function Stamps({ n, goal, color }: { n: number; goal: number; color: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" role="img" aria-label={`${n} de ${goal} selos`}>
      {Array.from({ length: goal }, (_, i) => (
        <span
          key={i}
          className={`grid h-8 w-8 place-items-center rounded-full text-white ${i < n ? "animate-pop" : ""}`}
          style={i < n ? { background: color, animationDelay: `${i * 40}ms` } : { background: "#efefeb" }}
        >
          {i < n ? <Icon name="check" size={15} stroke={3} /> : i === goal - 1 ? <Icon name="gift" size={15} className="text-black/35" /> : null}
        </span>
      ))}
    </div>
  );
}
