import type { MetadataRoute } from "next";

// O painel do dono vira um "app" instalável pelo próprio navegador (sem loja, sem custo).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Visatto — Painel do restaurante",
    short_name: "Visatto",
    description: "Pedidos, cardápio e escâner 3D dos pratos.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4f1",
    theme_color: "#1D1A16",
    lang: "pt-BR",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
