"use client";
// Estrutura do painel do restaurante. No computador: menu lateral. No celular: barra inferior, como um app.
// Os pedidos e os chamados das mesas são consultados aqui, então o aviso sonoro toca em qualquer tela do painel.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PainelCtx, type Call, type Order } from "./ctx";
import { api } from "@/lib/client";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import InstallApp from "./InstallApp";

const NAV = [
  { href: "/painel", label: "Pedidos", short: "Pedidos", icon: "receipt" },
  { href: "/painel/cardapio", label: "Cardápio", short: "Cardápio", icon: "list" },
  { href: "/painel/importar", label: "Importar por foto", short: "Importar", icon: "camera", ai: true },
  { href: "/painel/insights", label: "Resultados", short: "Resultados", icon: "chart" },
  { href: "/painel/qrcodes", label: "QR codes e links", short: "QR codes", icon: "qr" },
  { href: "/painel/config", label: "Configurações", short: "Ajustes", icon: "settings" },
];

let audio: AudioContext | null = null;
function beep(kind: "pedido" | "chamado" = "pedido") {
  try {
    audio = audio || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audio;
    if (ctx.state === "suspended") ctx.resume();
    const notes = kind === "pedido" ? [[880, 0], [1175, 0.18], [880, 0.5], [1175, 0.68]] : [[660, 0], [660, 0.22]];
    for (const [f, t] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.28, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.16);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.17);
    }
  } catch {}
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<{ restaurant: any; aiEnabled: boolean; waiter?: boolean; counts?: any } | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [offline, setOffline] = useState(false);
  const [sound, setSoundState] = useState(false);
  const soundRef = useRef(false);
  const known = useRef<{ orders: Set<string>; calls: Set<string> } | null>(null);

  const [loadErr, setLoadErr] = useState("");
  const reload = useCallback(async () => {
    try {
      setState(await api("/api/painel/restaurant"));
      setLoadErr("");
    } catch (e: any) {
      if (e.status === 401) router.replace("/entrar");
      else setLoadErr(e.message || "Não foi possível abrir o painel.");
    }
  }, [router]);

  const refreshOrders = useCallback(async () => {
    try {
      const d = await api<{ orders: Order[]; calls: Call[] }>("/api/painel/orders");
      const calls = d.calls || [];
      if (known.current && soundRef.current) {
        if (d.orders.some((o) => o.status === "novo" && !known.current!.orders.has(o.id))) beep("pedido");
        else if (calls.some((c) => !known.current!.calls.has(c.id))) beep("chamado");
      }
      known.current = { orders: new Set(d.orders.map((o) => o.id)), calls: new Set(calls.map((c) => c.id)) };
      setOrders(d.orders);
      setCalls(calls);
      setOffline(false);
    } catch (e: any) {
      if (e.status === 401) router.replace("/entrar");
      else setOffline(true);
    }
  }, [router]);

  useEffect(() => {
    reload();
    try {
      const on = localStorage.getItem("visatto-som") === "1";
      setSoundState(on);
      soundRef.current = on;
    } catch {}
  }, [reload]);

  useEffect(() => {
    if (!state) return;
    refreshOrders();
    // com a aba escondida continua consultando (mais devagar), para o aviso sonoro funcionar
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(async () => {
        await refreshOrders();
        loop();
      }, document.hidden ? 15000 : 6000);
    };
    loop();
    const onVisible = () => !document.hidden && refreshOrders();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [!!state, refreshOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = (orders?.filter((o) => o.status === "novo").length ?? 0) + calls.length;
  useEffect(() => {
    const page = NAV.find((n) => (n.href === "/painel" ? path === "/painel" : path.startsWith(n.href)))?.label ?? "Painel";
    document.title = `${pending ? `(${pending}) ` : ""}${page} · Visatto`;
  }, [pending, path]);

  function setSound(on: boolean) {
    setSoundState(on);
    soundRef.current = on;
    try {
      localStorage.setItem("visatto-som", on ? "1" : "0");
    } catch {}
    if (on) beep("pedido");
  }

  if (!state && loadErr)
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="animate-enter max-w-sm text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white"><Icon name="alert" size={26} /></span>
          <h1 className="mt-4 text-[24px] font-extrabold">O painel não abriu</h1>
          <p className="mt-2 text-[15px] text-black/60">{loadErr}</p>
          <button className="btn-primary mt-5 h-12 px-6" onClick={() => { setLoadErr(""); reload(); }}>Tentar de novo</button>
        </div>
      </div>
    );
  if (!state)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="w-64 space-y-3">
          <div className="skeleton h-8 w-32 rounded-lg" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
    );
  const r = state.restaurant;
  const trialDays = r.trial_ends_at ? Math.ceil((new Date(r.trial_ends_at).getTime() - Date.now()) / 86400000) : null;
  const nav = NAV.filter((n) => !n.ai || state.aiEnabled);
  const isActive = (href: string) => (href === "/painel" ? path === "/painel" : path.startsWith(href));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/entrar");
  };

  return (
    <PainelCtx.Provider value={{ ...state, reload, orders, calls, offline, refreshOrders, setOrders, setCalls, sound, setSound }}>
      <div className="min-h-dvh md:flex">
        {/* Computador: menu lateral */}
        <aside className="no-print sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col overflow-y-auto bg-ink p-4 text-white md:flex">
          <Link href="/painel" className="px-2 pt-1">
            <Logo size={30} />
          </Link>
          <div className="mt-6 rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
            <p className="truncate font-display text-[16px] font-bold">{r.name}</p>
            <a href={`/r/${r.slug}`} target="_blank" className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-white/60 transition-colors hover:text-ember">
              Ver meu cardápio <Icon name="external" size={13} />
            </a>
          </div>
          <nav className="mt-4 space-y-1" aria-label="Painel">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition-colors duration-200 ${isActive(n.href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"}`}
              >
                <span aria-hidden className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-all duration-300 ${isActive(n.href) ? "opacity-100" : "scale-y-0 opacity-0"}`} />
                <Icon name={n.icon} size={19} className={isActive(n.href) ? "text-ember" : ""} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/painel" && pending > 0 && (
                  <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11.5px] font-bold text-white">{pending}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-3 pt-6">
            <InstallApp />
            {trialDays != null && r.plan === "trial" && (
              <p className="rounded-xl bg-white/[0.06] p-3 text-[13px] text-white/70 ring-1 ring-white/10">
                <b className="text-white">Teste grátis:</b> {trialDays > 0 ? `${trialDays} ${trialDays === 1 ? "dia restante" : "dias restantes"}` : "encerrado"}
              </p>
            )}
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white">
              <Icon name="logout" size={19} />
              Sair
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Celular: topo com o nome do restaurante */}
          <header className="no-print sticky top-0 z-20 flex items-center gap-3 bg-ink px-4 py-2.5 text-white md:hidden">
            <Logo size={26} className="[&>span:last-child]:hidden" />
            <p className="min-w-0 flex-1 truncate font-display text-[16px] font-bold">{r.name}</p>
            <a href={`/r/${r.slug}`} target="_blank" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15">
              Cardápio <Icon name="external" size={13} />
            </a>
          </header>
          <div className="no-print px-4 md:hidden">
            <InstallApp dismissible />
          </div>
          <div key={path} className="animate-enter mx-auto max-w-6xl px-4 pb-28 pt-5 md:p-10">{children}</div>
        </div>

        {/* Celular: barra inferior */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden" aria-label="Painel">
          {nav.filter((n) => !n.ai).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold ${isActive(n.href) ? "text-ink" : "text-black/45"}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-200 ${isActive(n.href) ? "bg-ink text-white" : ""}`}>
                <Icon name={n.icon} size={19} />
              </span>
              {n.short}
              {n.href === "/painel" && pending > 0 && (
                <span className="tnum absolute right-[calc(50%-26px)] top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-bold text-white ring-2 ring-white">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </PainelCtx.Provider>
  );
}
