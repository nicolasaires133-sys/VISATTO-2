import type { Metadata, Viewport } from "next";
import Link from "next/link";
import CustomerApp from "./CustomerApp";
import { publicMenu } from "@/lib/menu";
import { ensureDemoOnce, DEMO_SLUG } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string; modo?: string; prato?: string }>;
};

// Título e descrição que aparecem quando o link do cardápio é colado no WhatsApp ou no Instagram
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await publicMenu(slug).catch(() => null);
  if (!menu) return { title: "Cardápio não encontrado" };
  const r = menu.restaurant;
  const with3d = menu.items.filter((i) => i.model).length;
  const description = with3d
    ? `Veja os pratos do ${r.name} na sua mesa, em tamanho real, pela câmera do celular. Peça direto pelo cardápio.`
    : `Cardápio do ${r.name}. Veja os pratos e peça direto pelo celular.`;
  return {
    title: `${r.name} · Cardápio`,
    description,
    openGraph: { title: `${r.name} · Cardápio`, description, type: "website", locale: "pt_BR" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#ffffff" };

export default async function Page(props: Props) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  // o cardápio de exemplo do site se cria (ou se atualiza) sozinho na primeira visita
  if (slug === DEMO_SLUG) await ensureDemoOnce();
  const menu = await publicMenu(slug);
  if (!menu)
    return (
      <main className="grid min-h-dvh place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">Cardápio não encontrado</h1>
          <p className="mt-2 text-black/60">Confira se o link ou o QR code está certo.</p>
          <Link href="/" className="btn-ghost mt-5">Conhecer o Visatto</Link>
        </div>
      </main>
    );
  const mesa = String(sp.mesa ?? "").slice(0, 20);
  return <CustomerApp slug={slug} mesa={mesa} modo={sp.modo ?? ""} prato={sp.prato ?? ""} initial={JSON.parse(JSON.stringify(menu))} />;
}
