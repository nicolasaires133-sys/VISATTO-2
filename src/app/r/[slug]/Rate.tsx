"use client";
// Nota depois do pedido ou da conta. Todo mundo recebe o convite para avaliar no Google (o Google proíbe
// mandar só quem gostou); quem não gostou pode, além disso, contar só para o restaurante.
import { useState } from "react";
import { api } from "@/lib/client";

export default function Rate({ slug, id, initial = 0, color, name, title = "Como está a sua experiência?" }: { slug: string; id: string; initial?: number; color: string; name: string; title?: string }) {
  const [stars, setStars] = useState(initial);
  const [sent, setSent] = useState(initial > 0);
  const [comment, setComment] = useState("");
  const [review, setReview] = useState("");
  const [told, setTold] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send(n: number, text = "") {
    setBusy(true);
    try {
      const res = await api<{ review: string }>(`/api/r/${slug}/orders/${id}/feedback`, { body: { stars: n, comment: text } });
      setReview(res.review);
      setSent(true);
      if (text) setTold(true);
    } catch {}
    setBusy(false);
  }
  return (
    <section className="animate-enter mt-7 rounded-2xl p-4 ring-1 ring-black/10" aria-label="Avaliar">
      <h3 className="text-[16px] font-bold">{sent && stars >= 4 ? "Obrigado!" : title}</h3>
      <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            disabled={busy}
            onClick={() => {
              setStars(n);
              setTold(false);
              send(n);
            }}
            className="grid h-11 w-11 place-items-center rounded-xl text-[24px] transition-transform active:scale-90"
            style={{ background: n <= stars ? color : "#efefeb", color: n <= stars ? "#fff" : "#00000040" }}
          >
            ★
          </button>
        ))}
      </div>
      {sent && stars > 0 && stars <= 3 && !told && (
        <div className="mt-3">
          <label className="label" htmlFor="fb">O que podemos melhorar? Só o restaurante vê.</label>
          <textarea id="fb" className="input" rows={2} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button disabled={busy || !comment.trim()} onClick={() => send(stars, comment.trim())} className="btn-dark mt-2 h-10 px-4">Enviar comentário</button>
        </div>
      )}
      {told && <p className="mt-3 text-[14px] text-black/65">Recebemos o seu comentário. Obrigado por contar.</p>}
      {sent && stars > 0 && review && (
        <a href={review} target="_blank" rel="noopener" className={`mt-3 h-11 w-full ${stars >= 4 ? "btn-dark" : "btn-ghost"}`}>
          Avaliar o {name} no Google
        </a>
      )}
    </section>
  );
}
