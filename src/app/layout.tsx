import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND, TAGLINE } from "@/lib/format";
import InstallCatcher from "@/components/InstallCatcher";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
  title: `${BRAND} — ${TAGLINE}`,
  appleWebApp: { capable: true, title: "Visatto", statusBarStyle: "default" },
  icons: { apple: "/icones/apple-touch-icon.png" },
  description: "Cardápio digital em que o cliente vê o prato na mesa, em tamanho real, pela câmera do celular, e faz o pedido direto pelo celular. O restaurante escaneia os pratos em 3D com o próprio celular, de graça. Sem baixar aplicativo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#efefeb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh font-sans antialiased">
        <InstallCatcher />
        {children}
      </body>
    </html>
  );
}
