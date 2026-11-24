import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { owner, ok } from "@/lib/http";
import { readLoyalty } from "@/lib/loyalty";

// Próximos passos para vender mais, calculados com os dados do próprio restaurante (sem IA paga).
export async function GET() {
  const r = await owner();
  if (r instanceof NextResponse) return r;
  const db = await getDB();
  const [c] = await db.query<{ items: number; nophoto: number; models: number; orders: number }>(
    `SELECT (SELECT COUNT(*)::int FROM items WHERE restaurant_id=$1 AND available) AS items,
            (SELECT COUNT(*)::int FROM items WHERE restaurant_id=$1 AND available AND COALESCE(image,'')='') AS nophoto,
            (SELECT COUNT(*)::int FROM items WHERE restaurant_id=$1 AND model_status='pronto' AND model_published) AS models,
            (SELECT COUNT(*)::int FROM orders WHERE restaurant_id=$1 AND status<>'cancelado') AS orders`,
    [r.id]
  );
  const [top] = await db.query<{ name: string; id: string }>(
    `SELECT i.id, i.name FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN items i ON i.id=oi.item_id
      WHERE o.restaurant_id=$1 AND o.created_at > NOW() - INTERVAL '60 days' AND i.model_status <> 'pronto'
      GROUP BY i.id, i.name ORDER BY SUM(oi.qty) DESC LIMIT 1`,
    [r.id]
  );
  const tips: { id: string; title: string; text: string; href: string; action: string }[] = [];
  if (c.items && c.nophoto / c.items > 0.3)
    tips.push({ id: "fotos", title: `${c.nophoto} pratos estão sem foto`, text: "No celular, prato com foto chama mais atenção e vende mais. Dá para tirar a foto na hora, pelo próprio painel.", href: "/painel/cardapio", action: "Pôr fotos" });
  if (!r.pix_key)
    tips.push({ id: "pix", title: "Receba a conta da mesa por Pix", text: "Com a sua chave Pix, o cliente divide e paga pelo celular, com o valor certo. A mesa libera mais rápido.", href: "/painel/config", action: "Pôr a chave Pix" });
  if (!readLoyalty(r.loyalty).on)
    tips.push({ id: "fidelidade", title: "Ligue o cartão fidelidade", text: "Um selo por pedido e um prêmio no fim. É o motivo para o cliente voltar e pedir de novo.", href: "/painel/config", action: "Ligar" });
  if (!r.google_review_url)
    tips.push({ id: "google", title: "Ganhe avaliações no Google", text: "Cole o link de avaliação do Google e o cliente é convidado a avaliar depois de comer.", href: "/painel/config", action: "Pôr o link" });
  if (top && c.models < 3)
    tips.push({ id: `3d-${top.id}`, title: `Faça o 3D de "${top.name}"`, text: "É o seu prato mais pedido. Em 3D, o cliente vê ele na mesa antes de pedir.", href: "/painel/cardapio", action: "Fazer o 3D" });
  return ok({ tips: tips.slice(0, 3) });
}
