"use client";
import { useEffect } from "react";

// Segura o convite de instalação do navegador: ele só aparece quando o dono toca em "Instalar app"
// no painel (o cliente que abre o cardápio pelo QR não é incomodado).
export default function InstallCatcher() {
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      (window as any).__visattoInstall = e;
      window.dispatchEvent(new Event("visatto-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  return null;
}
