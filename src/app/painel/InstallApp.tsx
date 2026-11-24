"use client";
import { useEffect, useState } from "react";

/** Botão "Instalar o app do Visatto" no painel: Android/Chrome instala direto; iPhone mostra o passo a passo. */
export default function InstallApp({ dismissible = false }: { dismissible?: boolean }) {
  const [can, setCan] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    try { if (dismissible && localStorage.getItem("visatto-install-x") === "1") setHidden(true); } catch {}
    const ready = () => setCan(!!(window as any).__visattoInstall);
    ready();
    window.addEventListener("visatto-install-ready", ready);
    const done = () => setInstalled(true);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("visatto-install-ready", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  if (installed || hidden || (!can && !ios)) return null;
  return (
    <div className="relative mt-3 rounded-xl bg-ink p-3 text-xs text-white">
      {dismissible && (
        <button
          aria-label="Fechar"
          className="absolute right-2 top-1.5 px-2 text-base text-white/60"
          onClick={() => { setHidden(true); try { localStorage.setItem("visatto-install-x", "1"); } catch {} }}
        >
          ×
        </button>
      )}
      <p className="font-bold">📲 Visatto no seu celular</p>
      <p className="mt-0.5 text-white/70">Ícone na tela inicial, abre como app. Grátis, sem loja.</p>
      {can ? (
        <button
          className="mt-2 w-full rounded-lg bg-brand py-2 font-bold"
          onClick={async () => {
            const ev = (window as any).__visattoInstall;
            if (!ev) return;
            ev.prompt();
            const r = await ev.userChoice.catch(() => null);
            if (r?.outcome === "accepted") setInstalled(true);
            (window as any).__visattoInstall = null;
            setCan(false);
          }}
        >
          Instalar o app
        </button>
      ) : (
        <>
          <button className="mt-2 w-full rounded-lg bg-brand py-2 font-bold" onClick={() => setHelp(!help)}>Como instalar no iPhone</button>
          {help && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-white/85">
              <li>Abra este painel no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
              <li>Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li>
            </ol>
          )}
        </>
      )}
    </div>
  );
}
