"use client";
// Cardápio do cliente: abre pelo QR da mesa ou pelo link do delivery.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readable } from "@/lib/color";
import { searchMenu } from "@/lib/search";
import Stamps from "./Stamps";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { basePrice, hasRequired, picksKey, priceWith, promoActive, type Picks } from "@/lib/options";
import { brl, PAYMENT_LABEL, type CartLine, type Category, type PublicItem as MenuItem, type PublicRestaurant } from "@/lib/format";
import { ArBadge, CloseButton, Dims, leavingPage, Pill, save, Sheet, Stepper, store, Thumb } from "./parts";
import type { ChatEntry } from "./Waiter";
import { allergenLabel, categoryKind, daypartAt, hourIn, suggest, tr, type Kind, type Lang } from "@/lib/sell";
import { makeT, type T } from "./i18n";

const DishViewer = dynamic(() => import("@/components/DishViewer"), { ssr: false });
const Waiter = dynamic(() => import("./Waiter"), { ssr: false });

export type MenuData = { restaurant: PublicRestaurant; categories: Category[]; items: MenuItem[]; waiter?: boolean };
type LastOrder = { id: string; number: number; at: number; channel?: "mesa" | "delivery"; itemIds?: string[] };
const LANGS: { id: Lang; label: string }[] = [
  { id: "pt", label: "PT" },
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// etiquetas de dieta que viram filtro (sem acento, minúsculas)
const DIETS = ["vegetariano", "vegano", "sem gluten", "sem lactose", "zero acucar", "fit"];
// topo da barra de categorias, para o filtro levar a pessoa até a lista
const tabsTop = () => {
  const nav = document.querySelector<HTMLElement>("nav[aria-label='Categorias']");
  return nav ? nav.getBoundingClientRect().top + window.scrollY : 0;
};

/** Bolinha que voa do botão "+" até a barra do pedido (e um toque leve no celular). */
function flyToBag(from: Element | null, color: string) {
  try { navigator.vibrate?.(12); } catch {}
  if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect();
  const bag = document.querySelector("[data-bag]")?.getBoundingClientRect();
  const tx = bag ? bag.left + 34 : window.innerWidth - 60, ty = bag ? bag.top + bag.height / 2 : window.innerHeight - 44;
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, { position: "fixed", left: `${x0 - 9}px`, top: `${y0 - 9}px`, width: "18px", height: "18px", borderRadius: "999px", background: color, zIndex: "60", pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,.25)" });
  document.body.appendChild(dot);
  const dx = tx - x0, dy = ty - y0, lift = Math.min(-60, dy * 0.2 - 80);
  const anim = dot.animate(
    [
      { transform: "translate(0,0) scale(1)" },
      { transform: `translate(${dx * 0.45}px, ${lift}px) scale(1.15)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.6 },
    ],
    { duration: 620, easing: "cubic-bezier(.45,.05,.4,1)" }
  );
  anim.onfinish = () => dot.remove();
  setTimeout(() => dot.remove(), 900);
}

export default function CustomerApp({ slug, mesa, modo, prato = "", initial }: { slug: string; mesa: string; modo: string; prato?: string; initial: MenuData }) {
  const router = useRouter();
  const [data, setData] = useState<MenuData>(initial);
  const [cart, setCart] = useState<CartLine[]>([]);
  // item do carrinho sendo editado (troca de opções, quantidade ou observação sem apagar e começar de novo)
  const [editLine, setEditLine] = useState<{ idx: number; line: CartLine } | null>(null);
  const [channel, setChannel] = useState<"mesa" | "delivery">(() => {
    const r = initial.restaurant;
    if (modo === "delivery" && r.delivery_enabled) return "delivery";
    if (mesa && r.dine_in_enabled) return "mesa";
    return r.delivery_enabled && !mesa ? "delivery" : r.dine_in_enabled ? "mesa" : "delivery";
  });
  const [table, setTable] = useState(mesa);
  const [activeCat, setActiveCat] = useState("");
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [lang, setLangState] = useState<Lang>("pt");
  const [roundOff, setRoundOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [diet, setDiet] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [hist, setHist] = useState<Record<string, number>>({});
  const [card, setCard] = useState<{ stamps: number; goal: number; ready: boolean } | null>(null);
  const loyalty = data.restaurant.loyalty?.on ? data.restaurant.loyalty : null;
  const loaded = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const clickedTab = useRef(0);

  // estado salvo no aparelho + cardápio atualizado (preço e disponibilidade mudam durante o serviço)
  useEffect(() => {
    setCart(store<CartLine[]>(`gia:${slug}:cart`, []));
    setChat(store<ChatEntry[]>(`gia:${slug}:chat`, []));
    const lo = store<LastOrder | null>(`gia:${slug}:last`, null);
    if (lo && Date.now() - lo.at < 3 * 3600_000) setLastOrder(lo);
    let sid = store<string>("gia:sid", "");
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      save("gia:sid", sid);
    }
    setSessionId(sid);
    // idioma: o que o cliente escolheu antes, senão o do celular (se o restaurante traduziu o cardápio)
    const langs = initial.restaurant.languages ?? [];
    const saved = store<string>("gia:lang", "");
    const device = (navigator.language || "pt").slice(0, 2);
    const pick = [saved, device].find((l) => l === "pt" || ((l === "en" || l === "es") && langs.includes(l)));
    if (pick) setLangState(pick as Lang);
    setRoundOff(store<string>(`gia:${slug}:round`, "") === lo?.id);
    setFavs(store<string[]>(`gia:${slug}:fav`, []));
    setHist(store<Record<string, number>>(`gia:${slug}:hist`, {}));
    const tel = store<{ phone?: string }>("gia:customer", {}).phone ?? "";
    if (r.loyalty?.on && tel.replace(/\D/g, "").length >= 10)
      api<{ stamps: number; goal: number; ready: boolean }>(`/api/r/${slug}/fidelidade?tel=${encodeURIComponent(tel)}`).then(setCard).catch(() => {});
    loaded.current = true;
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    fetch(`/api/r/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "visit", sessionId: sid }),
    }).catch(() => {});
    const refresh = () => api<MenuData>(`/api/r/${slug}`).then(setData).catch(() => {});
    const t = setInterval(() => !document.hidden && refresh(), 90_000);
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!prato) return;
    const it = initial.items.find((i) => i.id === prato);
    if (it) setDetail(it);
  }, [prato, initial]);

  useEffect(() => {
    if (loaded.current) save(`gia:${slug}:cart`, cart);
  }, [cart, slug]);
  useEffect(() => {
    if (loaded.current) save(`gia:${slug}:chat`, chat.slice(-30));
  }, [chat, slug]);

  const { restaurant: r, categories, items } = data;
  const t = useMemo(() => makeT(lang), [lang]);
  // leitor de tela fala no idioma escolhido
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : lang === "es" ? "es" : "pt-BR";
  }, [lang]);
  const langs = r.languages ?? [];
  const setLang = (l: Lang) => {
    setLangState(l);
    save("gia:lang", l);
  };
  const color = readable(r.primary_color);
  const paused = r.accepting_orders === false;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, tr(c, lang).name])), [categories, lang]);
  const kinds = useMemo(() => new Map(categories.map((c) => [c.id, categoryKind(c.name)])), [categories]);
  const kindOf = (catId: string | null): Kind => kinds.get(catId ?? "") ?? "principal";
  const daypart = useMemo(() => daypartAt(hourIn()), [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (i: MenuItem) => tr(i, lang).name;
  const lines = cart.filter((l) => byId.get(l.itemId)?.available);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + unitOf(byId.get(l.itemId)!, l.opts) * l.qty, 0);
  const qtyOf = (id: string) => lines.reduce((s, l) => s + (l.itemId === id ? l.qty : 0), 0);

  // filtros de dieta: só aparecem os que existem nas etiquetas do cardápio
  const dietOpts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) for (const tag of i.tags) { const k = norm(tag); if (DIETS.includes(k) && !seen.has(k)) seen.set(k, tag); }
    return DIETS.filter((d) => seen.has(d)).map((d) => ({ id: d, label: seen.get(d)! }));
  }, [items]);
  const dietLabel = dietOpts.find((d) => d.id === diet)?.label ?? "";
  const fits = useCallback(
    (i: MenuItem) => !diet || i.tags.some((tag) => norm(tag) === diet || (diet === "vegetariano" && norm(tag) === "vegano")),
    [diet]
  );
  const groups = useMemo(
    () =>
      [
        ...categories.map((c) => ({ id: c.id, name: catName.get(c.id) ?? c.name, items: items.filter((i) => i.category_id === c.id && fits(i)) })),
        { id: "outros", name: t("others"), items: items.filter((i) => (!i.category_id || !catName.has(i.category_id)) && fits(i)) },
      ].filter((g) => g.items.length),
    [categories, items, catName, t, fits]
  );
  const featured = useMemo(() => items.filter((i) => i.featured && i.available && fits(i)).slice(0, 8), [items, fits]);
  // favoritos e o que a pessoa já pediu neste restaurante (fica guardado só no celular dela)
  const usuals = useMemo(() => {
    const score = (id: string) => (favs.includes(id) ? 1000 : 0) + (hist[id] ?? 0);
    return items.filter((i) => i.available && score(i.id) > 0 && fits(i)).sort((a, b) => score(b.id) - score(a.id)).slice(0, 8);
  }, [items, favs, hist, fits]);
  function toggleFav(id: string) {
    setFavs((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f].slice(0, 40);
      save(`gia:${slug}:fav`, next);
      if (!f.includes(id)) flash(t("favSaved"));
      return next;
    });
  }
  // pratos marcados para esta hora do dia (almoço, noite...)
  const forNow = useMemo(() => items.filter((i) => i.available && i.dayparts?.includes(daypart) && fits(i)).slice(0, 8), [items, daypart, fits]);
  // segunda rodada: uns 25 minutos depois do pedido na mesa, sugere sobremesa (ou bebida)
  const round = useMemo(() => {
    if (!lastOrder || lastOrder.channel !== "mesa" || roundOff || paused) return null;
    if (now - lastOrder.at < 25 * 60_000) return null;
    const ordered = lastOrder.itemIds ?? [];
    const hadDessert = ordered.some((id) => kindOf(byId.get(id)?.category_id ?? null) === "sobremesa");
    const want: Kind = hadDessert ? "bebida" : "sobremesa";
    const list = items.filter((i) => i.available && kindOf(i.category_id) === want).sort((a, b) => Number(!!b.promote) - Number(!!a.promote) || Number(!!b.model) - Number(!!a.model)).slice(0, 3);
    return list.length ? { kind: want, list } : null;
  }, [lastOrder, roundOff, paused, now, items, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => {
    if (norm(query.trim()).length < 2) return null;
    return searchMenu(items, query, (i) => ({
      name: `${i.name} ${tr(i, lang).name}`,
      rest: `${i.description} ${tr(i, lang).description} ${i.tags.join(" ")} ${catName.get(i.category_id ?? "") ?? ""}`,
    }));
  }, [query, items, catName, lang]);

  // a aba ativa acompanha a rolagem
  useEffect(() => {
    if (results) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-cat]"));
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() - clickedTab.current < 900) return;
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveCat((vis.target as HTMLElement).dataset.cat || "");
      },
      { rootMargin: "-120px 0px -65% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [groups, featured.length, forNow.length, usuals.length, results]);
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${activeCat}"]`);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeCat]);

  function track(type: "view3d" | "ar", itemId: string) {
    fetch(`/api/r/${slug}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, itemId, sessionId }),
      keepalive: true,
    }).catch(() => {});
  }

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2000);
  }

  function addToCart(itemId: string, qty = 1, notes = "", viaAi = false, viaSuggest = false, from?: Element | null, opts?: Picks) {
    const item = byId.get(itemId);
    if (!item || !item.available) return;
    // prato com escolha obrigatória (tamanho, ponto...): abre a folha do prato para a pessoa escolher
    if (!opts && hasRequired(item.options)) {
      setChatOpen(false);
      setCartOpen(false);
      setDetail(item);
      flash(t("chooseOptions", { name: name(item) }));
      return;
    }
    flyToBag(from ?? null, color);
    const key = picksKey(opts);
    setCart((c) => {
      const i = c.findIndex((l) => l.itemId === itemId && l.notes === notes && picksKey(l.opts) === key);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: Math.min(50, copy[i].qty + qty), viaAi: copy[i].viaAi || viaAi, viaSuggest: copy[i].viaSuggest || viaSuggest };
        return copy;
      }
      return [...c, { itemId, qty, notes, viaAi, viaSuggest, ...(opts && Object.keys(opts).length ? { opts } : {}) }];
    });
    flash(t("added", { name: `${qty > 1 ? `${qty}x ` : ""}${name(item)}` }));
  }
  const suggestFor = (ids: string[], limit = 3, exclude: string[] = []) =>
    suggest(ids, items, kindOf, { daypart, limit, exclude }).map((id) => byId.get(id)!).filter(Boolean);

  function goTo(id: string) {
    clickedTab.current = Date.now();
    setActiveCat(id);
    document.getElementById(id === "destaques" || id === "agora" || id === "sempre" ? id : `cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const tabs = [
    ...(usuals.length ? [{ id: "sempre", name: t("againTab") }] : []),
    ...(forNow.length ? [{ id: "agora", name: t("nowTab") }] : []),
    ...(featured.length ? [{ id: "destaques", name: t("featuredTab") }] : []),
    ...groups.map((g) => ({ id: g.id, name: g.name })),
  ];
  const canCall = r.dine_in_enabled && channel === "mesa";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white pb-32 sm:my-0" style={{ ["--color-brand" as any]: color }}>
      <header className="relative overflow-hidden rounded-b-[30px] bg-ink px-5 pb-6 pt-8 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(70% 90% at 100% 0%, ${color}55, transparent 70%)` }} />
        <div className="relative flex items-start justify-between gap-3">
          <h1 className="text-[32px] font-extrabold leading-[1.02]">{r.name}</h1>
          {langs.length > 0 && (
            <div className="mt-1 flex shrink-0 rounded-full bg-white/10 p-0.5 text-[12px] font-bold ring-1 ring-white/10" role="group" aria-label={t("language")}>
              {LANGS.filter((l) => l.id === "pt" || langs.includes(l.id)).map((l) => (
                <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`rounded-full px-2.5 py-1 transition-colors ${lang === l.id ? "bg-white text-ink" : "text-white/70"}`}>{l.label}</button>
              ))}
            </div>
          )}
        </div>
        {r.address && (
          <p className="relative mt-2 flex items-start gap-1.5 text-[14px] text-white/65">
            <Icon name="pin" size={16} className="mt-0.5" />
            {r.address}
          </p>
        )}
        {(r.dine_in_enabled || r.delivery_enabled) && (
          <div className="relative mt-5 inline-flex rounded-full bg-white/10 p-1 text-[13.5px] font-semibold ring-1 ring-white/10" role="tablist" aria-label={t("howOrder")}>
            {r.dine_in_enabled && (
              <button role="tab" aria-selected={channel === "mesa"} onClick={() => setChannel("mesa")} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors duration-200 ${channel === "mesa" ? "bg-white text-ink" : "text-white/65"}`}>
                <Icon name="table" size={16} />
                {table ? `${t("table")} ${table}` : t("atTable")}
              </button>
            )}
            {r.delivery_enabled && (
              <button role="tab" aria-selected={channel === "delivery"} onClick={() => setChannel("delivery")} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors duration-200 ${channel === "delivery" ? "bg-white text-ink" : "text-white/65"}`}>
                <Icon name="bike" size={16} />
                {t("delivery")}
              </button>
            )}
          </div>
        )}

        {paused && (
          <p className="relative mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3.5 text-[14px] text-amber-950">
            <Icon name="pause" size={18} className="mt-0.5" />
            {t("paused")}
          </p>
        )}

        {lastOrder && (
          <a href={`/r/${slug}/pedido/${lastOrder.id}`} className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/15">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink"><Icon name="receipt" size={20} /></span>
            <span className="flex-1 text-[14.5px]">
              <b className="block">{t("orderSent", { n: lastOrder.number })}</b>
              <span className="text-white/65">{t("trackOrder")}</span>
            </span>
            <Icon name="right" size={18} className="text-white/50" />
          </a>
        )}

        {loyalty && (
          <div className="relative mt-4 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-[14.5px] font-bold"><Icon name="gift" size={18} /> {card?.ready ? t("loyaltyReady") : t("loyaltyTitle")}</p>
            <p className="mt-0.5 text-[13.5px] text-white/70">
              {card?.ready
                ? t("loyaltyReadySub", { r: loyalty.reward })
                : card
                  ? t("loyaltyProgress", { n: card.stamps, g: card.goal, r: loyalty.reward })
                  : t("loyaltyHow", { g: loyalty.goal, r: loyalty.reward })}
            </p>
            {card && <div className="[&_span]:h-6 [&_span]:w-6 [&>div]:mt-2"><Stamps n={card.stamps} goal={card.goal} color={color} /></div>}
          </div>
        )}

        {data.waiter && (
          <button onClick={() => setChatOpen(true)} className="relative mt-4 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left text-ink transition active:scale-[0.99]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white" style={{ background: color }}><Icon name="chat" size={22} /></span>
            <span className="flex-1">
              <span className="block font-display text-[17px] font-bold">{t("askWaiter", { name: r.ai_name })}</span>
              <span className="block text-[13.5px] text-black/60">{t("askWaiterSub")}</span>
            </span>
            <Icon name="right" size={18} />
          </button>
        )}
      </header>

      {/* Busca + categorias */}
      <nav className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur" aria-label="Categorias">
        {searching ? (
          <div className="flex items-center gap-2 px-5 py-2.5">
            <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-[#efefeb] px-4">
              <Icon name="search" size={18} className="text-black/60" />
              <span className="sr-only">{t("search")}</span>
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPh")} className="h-full flex-1 bg-transparent text-base outline-none" enterKeyHint="search" />
            </label>
            <button onClick={() => { setSearching(false); setQuery(""); }} className="px-1 text-[14.5px] font-semibold">{t("cancel")}</button>
          </div>
        ) : (
          <div className="flex items-center">
            <button onClick={() => setSearching(true)} aria-label={t("search")} className="ml-3 grid h-11 w-11 shrink-0 place-items-center rounded-full">
              <Icon name="search" size={21} />
            </button>
            <div ref={tabsRef} className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto py-3 pl-1 pr-5">
              {diet && (
                <button onClick={() => setDiet("")} aria-label={t("clearFilter", { f: dietLabel })} className="flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[14px] font-semibold text-white" style={{ background: color }}>
                  {dietLabel} <Icon name="close" size={14} stroke={2.4} />
                </button>
              )}
              {tabs.map((t) => (
                <button key={t.id} data-tab={t.id} onClick={() => goTo(t.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors duration-200 ${activeCat === t.id ? "bg-ink text-white" : "bg-[#efefeb] text-black/70 hover:bg-[#e6e6e1]"}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {items.length === 0 && <p className="px-5 py-16 text-center text-black/55">{t("empty")}</p>}

      {dietOpts.length > 0 && !results && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-5 pt-4" role="group" aria-label={t("onlyShow")}>
          <span className="shrink-0 text-[13px] font-semibold text-black/60">{t("onlyShow")}</span>
          {dietOpts.map((d) => (
            <button
              key={d.id}
              aria-pressed={diet === d.id}
              onClick={() => { setDiet(diet === d.id ? "" : d.id); window.scrollTo({ top: Math.min(window.scrollY, tabsTop()), behavior: "smooth" }); }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13.5px] font-semibold ring-1 transition-colors duration-200 ${diet === d.id ? "text-white ring-transparent" : "bg-white text-black/70 ring-black/10"}`}
              style={diet === d.id ? { background: color } : undefined}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
      {diet && !results && groups.length === 0 && <p className="px-5 py-12 text-center text-black/55">{t("noneDiet", { f: dietLabel.toLowerCase() })}</p>}

      {round && !results && (
        <section className="animate-enter mx-5 mt-5 rounded-3xl p-4 ring-1 ring-black/[0.07]" style={{ background: `${color}12` }} aria-label={round.kind === "sobremesa" ? t("secondRound") : t("secondRoundDrink")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">{round.kind === "sobremesa" ? t("secondRound") : t("secondRoundDrink")}</h2>
            <button onClick={() => { setRoundOff(true); save(`gia:${slug}:round`, lastOrder?.id ?? ""); }} className="shrink-0 text-[13px] font-semibold text-black/60">{t("dismiss")}</button>
          </div>
          <div className="mt-3 space-y-2">
            {round.list.map((i) => (
              <SuggestRow key={i.id} item={i} name={name(i)} color={color} t={t} onOpen={() => setDetail(i)} onAdd={(el) => addToCart(i.id, 1, "", false, true, el)} />
            ))}
          </div>
        </section>
      )}

      {results ? (
        <section className="px-5 pt-5">
          <p className="mb-1 text-[13.5px] text-black/55">
            {results.length === 0 ? t("noResults", { q: query.trim() }) : t("results", { n: results.length })}
          </p>
          <div className="divide-y divide-line">
            {results.map((i) => (
              <Row key={i.id} item={i} lang={lang} t={t} sub={byId.get(i.substitute_id ?? "")} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onOpenSub={(x) => setDetail(x)} onAdd={(el) => addToCart(i.id, 1, "", false, false, el)} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {usuals.length > 0 && (
            <section id="sempre" data-cat="sempre" className="scroll-mt-20 pt-6">
              <h2 className="px-5 text-[21px] font-extrabold">{t("again")}</h2>
              <p className="px-5 text-[13.5px] text-black/55">{t("againSub")}</p>
              <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {usuals.map((i) => (
                  <div key={i.id} className="w-[38%] max-w-[170px] shrink-0 snap-start">
                    <div className="relative">
                      <button onClick={() => setDetail(i)} aria-label={name(i)} className="group block w-full overflow-hidden rounded-[20px] transition active:scale-[0.98]">
                        <Thumb item={i} className="aspect-square w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                      </button>
                      {favs.includes(i.id) && <Icon name="heart" size={18} filled className="pointer-events-none absolute left-2.5 top-2.5 text-white drop-shadow" />}
                      {!paused && (
                        <button
                          key={qtyOf(i.id)}
                          onClick={(e) => addToCart(i.id, 1, "", false, false, e.currentTarget)}
                          aria-label={t("addAria", { name: name(i) })}
                          className={`absolute bottom-[-6px] right-[-6px] grid h-9 min-w-9 place-items-center rounded-full px-2 text-white shadow-md ring-2 ring-white transition-transform active:scale-90 ${qtyOf(i.id) ? "animate-bump" : ""}`}
                          style={{ background: qtyOf(i.id) ? "#172033" : color }}
                        >
                          {qtyOf(i.id) ? <span className="tnum text-[13.5px] font-bold">{qtyOf(i.id)}</span> : <Icon name="plus" size={17} stroke={2.4} />}
                        </button>
                      )}
                    </div>
                    <button onClick={() => setDetail(i)} className="block w-full text-left">
                      <span className="mt-2 line-clamp-2 block pr-1 text-[14.5px] font-bold leading-tight">{name(i)}</span>
                      <span className="tnum mt-0.5 block text-[14px] font-semibold" style={{ color }}>{brl(basePrice(i))}</span>
                      {hist[i.id] > 0 && <span className="block text-[12.5px] text-black/60">{t("orderedTimes", { n: hist[i.id] })}</span>}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {forNow.length > 0 && (
            <section id="agora" data-cat="agora" className="scroll-mt-20 pt-6">
              <h2 className="px-5 text-[21px] font-extrabold">{t(`now_${daypart}` as "now_almoco")}</h2>
              <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {forNow.map((i) => (
                  <button key={i.id} onClick={() => setDetail(i)} className="group w-[38%] max-w-[170px] shrink-0 snap-start text-left transition active:scale-[0.98]">
                    <span className="relative block overflow-hidden rounded-[20px]">
                      <Thumb item={i} className="aspect-square w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                      {i.model && <ArBadge className="absolute left-2 top-2" />}
                    </span>
                    <span className="mt-2 line-clamp-2 block text-[14.5px] font-bold leading-tight">{name(i)}</span>
                    <span className="tnum mt-0.5 block text-[14px] font-semibold" style={{ color }}>{brl(basePrice(i))}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {featured.length > 0 && (
            <section id="destaques" data-cat="destaques" className="scroll-mt-20 pt-6">
              <h2 className="px-5 text-[21px] font-extrabold">{t("featured")}</h2>
              <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {featured.map((i) => (
                  <button key={i.id} onClick={() => setDetail(i)} className="group relative w-[46%] max-w-[210px] shrink-0 snap-start overflow-hidden rounded-[22px] text-left shadow-[0_14px_30px_-20px_rgba(29,26,22,0.6)] transition active:scale-[0.98]">
                    <Thumb item={i} className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                    {i.model && <ArBadge className="absolute left-2.5 top-2.5" />}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-3 pt-10 text-white">
                      <span className="line-clamp-2 font-display text-[16px] font-bold leading-tight">{name(i)}</span>
                      <span className="tnum mt-0.5 block text-[14px] font-semibold">{brl(basePrice(i))}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {groups.map((g) => (
            <section key={g.id} id={`cat-${g.id}`} data-cat={g.id} className="scroll-mt-20 px-5 pt-8">
              <h2 className="text-[21px] font-extrabold">{g.name}</h2>
              <div className="mt-1 divide-y divide-line">
                {g.items.map((i) => (
                  <Row key={i.id} item={i} lang={lang} t={t} sub={byId.get(i.substitute_id ?? "")} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onOpenSub={(x) => setDetail(x)} onAdd={(el) => addToCart(i.id, 1, "", false, false, el)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="px-5 pb-2 pt-12 text-center text-[12px] text-black/60">
        {t("by")} <a href="/" className="font-semibold underline">Visatto</a> · <a href="/privacidade" className="underline-offset-2 hover:underline">{t("privacy")}</a>
      </p>

      {/* Barra inferior */}
      <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 ${count > 0 && !paused ? "bg-gradient-to-t from-white via-white/90 to-transparent" : ""}`}>
        <div className="pointer-events-auto flex justify-end gap-2">
          {canCall && (
            <button onClick={() => setCallOpen(true)} aria-label={t("callAria")} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/10">
              <Icon name="bell" size={22} />
            </button>
          )}
          {data.waiter && (
            <button onClick={() => setChatOpen(true)} aria-label={`Falar com ${r.ai_name}`} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/10">
              <Icon name="chat" size={22} />
            </button>
          )}
          {!paused && count > 0 && (
            <button
              key={count}
              data-bag
              onClick={() => setCartOpen(true)}
              className="animate-bump flex h-14 flex-1 items-center justify-between rounded-2xl px-5 text-[15.5px] font-bold text-white shadow-lg shadow-black/10 transition active:scale-[0.99]"
              style={{ background: color }}
            >
              <span className="flex items-center gap-2.5">
                <Icon name="bag" size={20} />
                {t("viewOrder", { n: count })}
              </span>
              <span className="tnum">{brl(subtotal)}</span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" className="animate-pop fixed inset-x-0 top-4 z-50 mx-auto flex w-fit max-w-[88%] items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg">
          <Icon name="check" size={16} stroke={2.4} />
          <span className="truncate">{toast}</span>
        </div>
      )}

      {detail && (
        <ItemSheet
          key={detail.id}
          item={byId.get(detail.id) ?? detail}
          lang={lang}
          t={t}
          color={color}
          paused={paused}
          sub={byId.get((byId.get(detail.id) ?? detail).substitute_id ?? "")}
          goesWith={suggestFor([detail.id], 3, cart.map((l) => l.itemId))}
          onTrack={(type) => track(type, detail.id)}
          fav={favs.includes(detail.id)}
          onFav={() => toggleFav(detail.id)}
          initial={editLine && editLine.line.itemId === detail.id ? { qty: editLine.line.qty, notes: editLine.line.notes, picks: editLine.line.opts } : undefined}
          onClose={() => {
            setDetail(null);
            if (editLine) {
              setEditLine(null);
              setCartOpen(true);
            }
          }}
          onOpen={(x) => { setEditLine(null); setDetail(x); }}
          onAddPair={(id) => addToCart(id, 1, "", false, true)}
          onAdd={(qty, notes, opts) => {
            if (editLine && editLine.line.itemId === detail.id) {
              const o = opts && Object.keys(opts).length ? opts : undefined;
              setCart((c) => c.map((l, i) => (i === editLine.idx ? { ...l, qty, notes, opts: o } : l)));
              setEditLine(null);
              setDetail(null);
              setCartOpen(true);
              flash(t("saveChange"));
              return;
            }
            addToCart(detail.id, qty, notes, false, false, null, opts ?? {});
            setDetail(null);
          }}
        />
      )}

      {chatOpen && data.waiter && (
        <Waiter
          slug={slug}
          r={r}
          color={color}
          chat={chat}
          setChat={setChat}
          cart={cart}
          channel={channel}
          table={table}
          sessionId={sessionId}
          byId={byId}
          catName={catName}
          onClose={() => setChatOpen(false)}
          onAction={(a) => {
            if (a.type === "add") addToCart(a.itemId, a.qty, a.notes || "", true);
            if (a.type === "remove") setCart((c) => c.filter((l) => l.itemId !== a.itemId));
            if (a.type === "call") flash(t("serverComing", { t: table || "" }));
          }}
          onAddCard={(id) => addToCart(id, 1, "", true)}
          onOpenItem={(id) => {
            const it = byId.get(id);
            if (it) {
              setChatOpen(false);
              setDetail(it);
            }
          }}
          onOpenCart={() => {
            setChatOpen(false);
            setCartOpen(true);
          }}
        />
      )}

      {callOpen && (
        <CallSheet slug={slug} t={t} table={table} setTable={setTable} onClose={() => setCallOpen(false)} onDone={(msg) => { setCallOpen(false); flash(msg); }} />
      )}

      {cartOpen && (
        <CartSheet
          slug={slug}
          r={r}
          t={t}
          lang={lang}
          color={color}
          cart={cart}
          setCart={setCart}
          byId={byId}
          suggestions={suggestFor(lines.map((l) => l.itemId), 3)}
          onAddSuggestion={(id) => addToCart(id, 1, "", false, true)}
          onOpenItem={(x) => { setCartOpen(false); setDetail(x); }}
          onEdit={(idx) => {
            const l = cart[idx];
            const it = l && byId.get(l.itemId);
            if (!it) return;
            setCartOpen(false);
            setEditLine({ idx, line: l });
            setDetail(it);
          }}
          channel={channel}
          setChannel={setChannel}
          table={table}
          setTable={setTable}
          subtotal={subtotal}
          onClose={() => setCartOpen(false)}
          onDone={(id, number) => {
            leavingPage();
            setCart([]);
            save(`gia:${slug}:cart`, []);
            save(`gia:${slug}:last`, { id, number, at: Date.now(), channel, itemIds: lines.map((l) => l.itemId) });
            const h = { ...hist };
            for (const l of lines) h[l.itemId] = (h[l.itemId] ?? 0) + 1;
            save(`gia:${slug}:hist`, h);
            router.push(`/r/${slug}/pedido/${id}`);
          }}
        />
      )}
    </main>
  );
}

function Row({ item: i, lang, t, sub, color, qty, paused, onOpen, onOpenSub, onAdd }: { item: MenuItem; lang: Lang; t: T; sub?: MenuItem; color: string; qty: number; paused: boolean; onOpen: () => void; onOpenSub: (x: MenuItem) => void; onAdd: (el: Element) => void }) {
  const { name, description } = tr(i, lang);
  return (
    <div className="relative py-4">
      <div className={`relative flex gap-3.5 ${i.available ? "" : "opacity-55"}`}>
        <button onClick={onOpen} className="flex min-w-0 flex-1 gap-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-bold leading-snug">{name}</span>
            {description && <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-black/60">{description}</span>}
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <PriceTag item={i} color={color} t={t} />
              {!i.available && <Pill tone="warn">{t("soldOut")}</Pill>}
              {i.available && promoActive(i.promo ?? null, i.price_cents) && <PromoPill item={i} t={t} />}
              {i.available && i.popular && <PopularPill t={t} />}
              {i.model && <ArBadge />}
              {i.serves > 1 && <Pill>{t("serves", { n: i.serves })}</Pill>}
              {i.tags.slice(0, i.model ? 1 : 2).map((tag) => <Pill key={tag}>{tag}</Pill>)}
            </span>
          </span>
          <Thumb item={i} art={0.8} className="h-[104px] w-[104px] shrink-0 rounded-2xl" />
        </button>
        {i.available && !paused && (
          <button
            key={qty}
            onClick={(e) => onAdd(e.currentTarget)}
            aria-label={qty ? `${qty} · ${t("addAria", { name })}` : t("addAria", { name })}
            className={`absolute bottom-[-6px] right-[-6px] grid h-10 min-w-10 place-items-center rounded-full px-2 text-white shadow-md ring-2 ring-white transition-transform active:scale-90 ${qty ? "animate-bump" : ""}`}
            style={{ background: qty ? "#172033" : color }}
          >
            {qty ? <span className="tnum text-[14px] font-bold">{qty}</span> : <Icon name="plus" size={18} stroke={2.4} />}
          </button>
        )}
      </div>
      {!i.available && sub?.available && (
        <button onClick={() => onOpenSub(sub)} className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-3 py-1.5 text-[13px] font-semibold">
          {t("tryInstead", { name: tr(sub, lang).name })} <Icon name="right" size={14} />
        </button>
      )}
    </div>
  );
}

/** Linha compacta de sugestão: foto pequena, nome, preço e botão de adicionar. */
function SuggestRow({ item, name, color, t, onOpen, onAdd }: { item: MenuItem; name: string; color: string; t: T; onOpen: () => void; onAdd: (el: Element) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pr-2.5 ring-1 ring-black/[0.06]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Thumb item={item} className="h-12 w-12 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{name}</span>
          <span className="tnum text-[13.5px] text-black/60">{brl(basePrice(item))}</span>
        </span>
      </button>
      <button type="button" onClick={(e) => onAdd(e.currentTarget)} aria-label={t("addAria", { name })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-90" style={{ background: color }}>
        <Icon name="plus" size={17} stroke={2.4} />
      </button>
    </div>
  );
}

function ItemSheet({
  item,
  lang,
  t,
  color,
  paused,
  sub,
  goesWith,
  onClose,
  onOpen,
  onAdd,
  onAddPair,
  onTrack,
  fav,
  onFav,
  initial,
}: {
  item: MenuItem;
  lang: Lang;
  t: T;
  color: string;
  paused: boolean;
  sub?: MenuItem;
  goesWith: MenuItem[];
  onClose: () => void;
  onOpen: (x: MenuItem) => void;
  onAdd: (qty: number, notes: string, opts?: Picks) => void;
  onAddPair: (id: string) => void;
  onTrack: (type: "view3d" | "ar") => void;
  fav: boolean;
  onFav: () => void;
  /** editando um item do carrinho: começa com o que a pessoa já tinha escolhido */
  initial?: { qty: number; notes: string; picks?: Picks };
}) {
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picks, setPicks] = useState<Picks>(initial?.picks ?? {});
  const [tried, setTried] = useState(false);
  const groups = item.options ?? [];
  const priced = priceWith(item, picks);
  const unit = priced.ok ? priced.unit : basePrice(item);
  const missing = groups.find((g) => (picks[g.id]?.length ?? 0) < g.min);
  function toggle(gid: string, cid: string, max: number) {
    setPicks((p) => {
      const cur = p[gid] ?? [];
      if (max === 1) return { ...p, [gid]: [cid] };
      if (cur.includes(cid)) return { ...p, [gid]: cur.filter((x) => x !== cid) };
      if (cur.length >= max) return p;
      return { ...p, [gid]: [...cur, cid] };
    });
  }
  function add() {
    if (missing) {
      setTried(true);
      document.getElementById(`grp-${missing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onAdd(qty, notes.trim(), priced.ok ? priced.picks : {});
  }
  const [view, setView] = useState<"3d" | "foto">(item.model ? "3d" : "foto");
  const [added, setAdded] = useState<string[]>([]);
  // a lista fica parada enquanto a folha está aberta (o item adicionado vira "no pedido", não some)
  const [pairsList] = useState(goesWith);
  const { name, description } = tr(item, lang);
  const allergens = item.allergens ?? [];
  return (
    <Sheet onClose={onClose} label={name}>
      <div className="overflow-y-auto">
        <div className="relative">
          {item.model && view === "3d" ? (
            <div className="p-3 pb-0">
              <DishViewer
                model={item.model}
                poster={item.image || undefined}
                alt={name}
                color={color}
                height={300}
                onEvent={onTrack}
                hideDims
                arTitle={name}
                arSubtitle={brl(basePrice(item))}
                arAction={!paused && item.available && !hasRequired(groups) ? t("addToOrder") : undefined}
                onArAction={!paused && item.available && !hasRequired(groups) ? () => onAdd(1, "", {}) : undefined}
              />
            </div>
          ) : (
            <Thumb item={item} art={0.62} className="h-72 w-full" />
          )}
          <CloseButton onClick={onClose} className="absolute right-5 top-5 z-10 shadow-sm" />
          <button
            key={String(fav)}
            onClick={onFav}
            aria-pressed={fav}
            aria-label={fav ? t("unfav") : t("fav")}
            className={`absolute right-[4.75rem] top-5 z-10 grid h-11 w-11 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform active:scale-90 ${fav ? "animate-bump" : ""}`}
            style={fav ? { color } : undefined}
          >
            <Icon name="heart" size={20} filled={fav} />
          </button>
          {item.model && item.image && (
            <div className="absolute left-5 top-5 z-10 flex rounded-full bg-white p-0.5 text-[13px] font-semibold ring-1 ring-black/10">
              <button onClick={() => setView("3d")} className={`rounded-full px-3 py-1.5 transition-colors ${view === "3d" ? "bg-ink text-white" : ""}`}>3D</button>
              <button onClick={() => setView("foto")} className={`rounded-full px-3 py-1.5 transition-colors ${view === "foto" ? "bg-ink text-white" : ""}`}>{t("photo")}</button>
            </div>
          )}
        </div>
        <div className="space-y-5 p-5">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[24px] font-extrabold leading-tight">{name}</h3>
              <div className="shrink-0 pt-1 text-right">
                <p className="tnum font-display text-[20px] font-bold" style={{ color }}>{brl(basePrice(item))}</p>
                {basePrice(item) < item.price_cents && <p className="tnum text-[13px] text-black/60 line-through">{brl(item.price_cents)}</p>}
              </div>
            </div>
            {(promoActive(item.promo ?? null, item.price_cents) || item.popular) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {promoActive(item.promo ?? null, item.price_cents) && <PromoPill item={item} t={t} />}
                {item.popular && <PopularPill t={t} />}
              </div>
            )}
            {description && <p className="mt-2 text-[15.5px] leading-relaxed text-black/70">{description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>{t("servesLong", { n: item.serves, p: item.serves === 1 ? t("person") : t("people") })}</Pill>
              {item.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}
            </div>
          </div>
          {item.model?.dims && item.model.dims.w > 0 && <Dims dims={item.model.dims} label={t("seeSize")} sizeLabel={t("size")} note={t("sizeNote")} />}

          <div className="rounded-2xl bg-[#efefeb] p-3.5 text-[14px]">
            <p className="flex items-center gap-1.5 font-semibold"><Icon name="info" size={16} /> {t("allergens")}</p>
            <p className="mt-1 text-black/70">
              {!item.allergens_known
                ? t("allergenUnknown")
                : allergens.length
                  ? `${t("contains", { list: allergens.map((a) => allergenLabel(a, lang)).join(", ") })} ${t("allergenNote")}`
                  : `${t("noMain")} ${t("allergenNote")}`}
            </p>
          </div>

          {!item.available && sub?.available && (
            <button onClick={() => onOpen(sub)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-black/10">
              <Thumb item={sub} className="h-12 w-12 shrink-0 rounded-xl" />
              <span className="flex-1 font-semibold">{t("tryInstead", { name: tr(sub, lang).name })}</span>
              <Icon name="right" size={16} />
            </button>
          )}

          {item.available && !paused && groups.map((g) => {
            const chosen = picks[g.id] ?? [];
            const bad = tried && chosen.length < g.min;
            return (
              <fieldset key={g.id} id={`grp-${g.id}`} className={`rounded-2xl p-3.5 ring-1 transition-colors ${bad ? "bg-red-50 ring-red-300" : "ring-black/10"}`}>
                <legend className="sr-only">{g.name}</legend>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[16px] font-bold">{g.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${g.min > 0 ? (chosen.length >= g.min ? "bg-emerald-100 text-emerald-800" : "bg-ink text-white") : "bg-black/[0.06] text-black/60"}`}>
                    {g.min > 0 ? (chosen.length >= g.min ? "✓" : t("required")) : t("optional")}
                  </span>
                </div>
                <p className="-mt-1 mb-2 text-[13px] text-black/55">{g.max === 1 ? t("chooseOne") : g.min > 1 ? t("chooseAtLeast", { n: g.min }) : t("chooseUpTo", { n: g.max })}</p>
                <div className="space-y-1.5">
                  {g.choices.map((c) => {
                    const on = chosen.includes(c.id);
                    const full = !on && g.max > 1 && chosen.length >= g.max;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role={g.max === 1 ? "radio" : "checkbox"}
                        aria-checked={on}
                        disabled={full}
                        onClick={() => toggle(g.id, c.id, g.max)}
                        className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors disabled:opacity-40 ${on ? "bg-white" : "bg-white ring-1 ring-black/10 hover:ring-black/20"}`}
                        style={on ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
                      >
                        <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center border-2 ${g.max === 1 ? "rounded-full" : "rounded-md"} ${on ? "" : "border-black/30 bg-white"}`} style={on ? { background: color, borderColor: color } : undefined}>
                          {on && <Icon name="check" size={13} stroke={3} className="text-white" />}
                        </span>
                        <span className="flex-1 font-medium">{c.name}</span>
                        {c.price_cents > 0 && <span className="tnum text-[14px] text-black/60">+ {brl(c.price_cents)}</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {item.available && !paused && (
            <div>
              <label className="label" htmlFor="obs">{t("notesQ")}</label>
              <input id="obs" className="input" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPh")} />
            </div>
          )}

          {item.available && !paused && pairsList.length > 0 && (
            <div>
              <p className="mb-2 text-[15px] font-bold">{t("goesWith")}</p>
              <div className="space-y-2">
                {pairsList.map((g) =>
                  added.includes(g.id) ? (
                    <p key={g.id} className="animate-fade flex items-center gap-2 rounded-2xl bg-white p-3 text-[14px] font-semibold ring-1 ring-black/[0.06]">
                      <Icon name="check" size={16} stroke={2.4} className="text-leaf" /> {t("added", { name: tr(g, lang).name })}
                    </p>
                  ) : (
                    <SuggestRow key={g.id} item={g} name={tr(g, lang).name} color={color} t={t} onOpen={() => onOpen(g)} onAdd={() => { onAddPair(g.id); setAdded((a) => [...a, g.id]); }} />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {paused ? (
          <p className="flex-1 py-2 text-center text-[14px] text-black/60">{t("pausedShort")}</p>
        ) : item.available ? (
          <>
            <Stepper qty={qty} min={1} onChange={(q) => setQty(Math.min(50, q))} size="lg" />
            <button onClick={add} className="btn h-12 flex-1 justify-between px-5 text-[15.5px] text-white" style={{ background: color }}>
              <span className="truncate">{missing && tried ? t("missingChoice", { g: missing.name.toLowerCase() }) : initial ? t("saveChange") : t("add")}</span>
              <span className="tnum">{brl(unit * qty)}</span>
            </button>
          </>
        ) : (
          <p className="flex-1 py-2 text-center font-semibold text-black/60">{t("soldOutToday")}</p>
        )}
      </div>
    </Sheet>
  );
}

function CallSheet({ slug, t, table, setTable, onClose, onDone }: { slug: string; t: T; table: string; setTable: (t: string) => void; onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function call(type: "atendente" | "conta") {
    if (!table.trim()) return setErr(t("typeTable"));
    setBusy(type);
    setErr("");
    try {
      await api(`/api/r/${slug}/calls`, { body: { type, table: table.trim() } });
      onDone(type === "conta" ? t("billAsked", { t: table.trim() }) : t("serverComing", { t: table.trim() }));
    } catch (e: any) {
      setErr(e.message);
      setBusy("");
    }
  }
  return (
    <Sheet onClose={onClose} label={t("callServer")}>
      <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="text-[22px] font-extrabold">{t("needSomething")}</h3>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="mesa-call">{t("yourTable")}</label>
          <input id="mesa-call" className="input h-12 max-w-32 text-lg font-bold" inputMode="numeric" value={table} maxLength={20} onChange={(e) => setTable(e.target.value)} />
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button onClick={() => call("atendente")} disabled={!!busy} className="flex items-center gap-3 rounded-2xl bg-[#efefeb] p-4 text-left transition-colors hover:bg-[#e6e6e1] disabled:opacity-50">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white"><Icon name="bell" size={22} /></span>
            <span><b className="block text-[15.5px]">{busy === "atendente" ? t("calling") : t("callServer")}</b><span className="text-[13.5px] text-black/60">{t("callServerSub")}</span></span>
          </button>
          <button
            onClick={() => (table.trim() ? window.location.assign(`/r/${slug}/conta?mesa=${encodeURIComponent(table.trim())}`) : setErr(t("typeTable")))}
            disabled={!!busy}
            className="flex items-center gap-3 rounded-2xl bg-[#efefeb] p-4 text-left transition-colors hover:bg-[#e6e6e1] disabled:opacity-50"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white"><Icon name="receipt" size={22} /></span>
            <span><b className="block text-[15.5px]">{busy === "conta" ? t("asking") : t("askBill")}</b><span className="text-[13.5px] text-black/60">{t("askBillSub")}</span></span>
          </button>
        </div>
        {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-800">{err}</p>}
      </div>
    </Sheet>
  );
}

function CartSheet(props: {
  slug: string;
  r: PublicRestaurant;
  t: T;
  lang: Lang;
  color: string;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  byId: Map<string, MenuItem>;
  suggestions: MenuItem[];
  onAddSuggestion: (id: string) => void;
  onOpenItem: (x: MenuItem) => void;
  onEdit: (idx: number) => void;
  channel: "mesa" | "delivery";
  setChannel: (c: "mesa" | "delivery") => void;
  table: string;
  setTable: (t: string) => void;
  subtotal: number;
  onClose: () => void;
  onDone: (orderId: string, number: number) => void;
}) {
  const { slug, r, t, lang, color, cart, setCart, byId, channel, table, subtotal } = props;
  const [f, setF] = useState(() => store("gia:customer", { name: "", phone: "", address: "" }));
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"pix" | "cartao" | "dinheiro" | "">("");
  const [changeFor, setChangeFor] = useState("");
  const [optin, setOptin] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fee = channel === "delivery" ? r.delivery_fee_cents : 0;
  const missing = channel === "delivery" && r.min_order_cents > subtotal ? r.min_order_cents - subtotal : 0;
  const visible = cart.map((l, idx) => ({ l, idx, it: byId.get(l.itemId) })).filter((x) => x.it?.available);

  function setQty(idx: number, q: number) {
    setCart((c) => c.map((l, i) => (i === idx ? { ...l, qty: Math.min(50, q) } : l)).filter((l) => l.qty > 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    if (channel === "delivery" && !payment) return setErr(t("choosePay"));
    setBusy(true);
    try {
      if (channel === "delivery" || f.phone.trim()) save("gia:customer", f);
      const res = await api<{ id: string; number: number }>(`/api/r/${slug}/orders`, {
        body: {
          channel,
          table,
          notes,
          ...f,
          payment,
          changeFor: payment === "dinheiro" ? changeFor : "",
          items: visible.map((x) => x.l),
          sessionId: store<string>("gia:sid", ""),
          lang,
          marketingOptin: channel === "delivery" && optin,
        },
      });
      props.onDone(res.id, res.number);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={props.onClose} label={t("yourOrder")}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[22px] font-extrabold">{t("yourOrder")}</h3>
          <CloseButton onClick={props.onClose} />
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {visible.length === 0 && <p className="py-6 text-center text-black/55">{t("cartEmpty")}</p>}
          <div className="divide-y divide-line">
            {visible.map(({ l, idx, it }) => (
              <div key={idx} className="flex items-center gap-3 py-3 first:pt-0">
                <Thumb item={it!} className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{tr(it!, lang).name}</p>
                  {optSummary(it!, l.opts) && <p className="mt-0.5 text-[13px] text-black/65">{optSummary(it!, l.opts)}</p>}
                  {l.notes && <p className="mt-0.5 text-[13px] text-black/55">{l.notes}</p>}
                  <p className="mt-0.5 flex items-center gap-3 text-[14px]">
                    <span className="tnum text-black/65">{brl(unitOf(it!, l.opts) * l.qty)}</span>
                    <button type="button" onClick={() => props.onEdit(idx)} aria-label={t("editAria", { name: tr(it!, lang).name })} className="-my-2 inline-flex min-h-[36px] items-center gap-1 px-1 font-semibold underline decoration-black/25 underline-offset-2" style={{ color }}>
                      <Icon name="edit" size={14} /> {t("edit")}
                    </button>
                  </p>
                </div>
                <Stepper qty={l.qty} onChange={(q) => setQty(idx, q)} />
              </div>
            ))}
          </div>

          {props.suggestions.length > 0 && (
            <div className="animate-fade rounded-3xl p-3.5" style={{ background: `${color}10` }}>
              <p className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[15px] font-bold"><Icon name="sparkle" size={16} /> {t("goesWithOrder")}</p>
              <div className="space-y-2">
                {props.suggestions.map((s) => (
                  <SuggestRow key={s.id} item={s} name={tr(s, lang).name} color={color} t={t} onOpen={() => props.onOpenItem(s)} onAdd={() => props.onAddSuggestion(s.id)} />
                ))}
              </div>
            </div>
          )}

          {r.dine_in_enabled && r.delivery_enabled && (
            <div className="flex rounded-xl bg-[#efefeb] p-1 text-[14px] font-semibold">
              <button type="button" onClick={() => props.setChannel("mesa")} className={`flex-1 rounded-lg py-2.5 transition-colors ${channel === "mesa" ? "bg-white shadow-sm" : "text-black/55"}`}>{t("imAtTable")}</button>
              <button type="button" onClick={() => props.setChannel("delivery")} className={`flex-1 rounded-lg py-2.5 transition-colors ${channel === "delivery" ? "bg-white shadow-sm" : "text-black/55"}`}>{t("delivery")}</button>
            </div>
          )}

          {channel === "mesa" ? (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="mesa">{t("tableNumber")}</label>
                <input id="mesa" className="input h-12 max-w-32 text-lg font-bold" required inputMode="numeric" maxLength={20} value={table} onChange={(e) => props.setTable(e.target.value)} />
              </div>
              {r.loyalty?.on && (
                <div className="rounded-2xl p-3.5" style={{ background: `${color}10` }}>
                  <label className="label flex items-center gap-1.5" htmlFor="fone-fid"><Icon name="gift" size={16} /> {t("loyaltyPhone")}</label>
                  <input id="fone-fid" className="input" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(11) 99999-9999" />
                  <p className="mt-1.5 text-[13px] text-black/55">{t("loyaltyPhoneHint", { g: r.loyalty.goal, r: r.loyalty.reward })}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="nome">{t("yourName")}</label>
                <input id="nome" className="input" required autoComplete="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="fone">{t("phone")}</label>
                <input id="fone" className="input" required inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="label" htmlFor="end">{t("address")}</label>
                <textarea id="end" className="input" required rows={2} autoComplete="street-address" maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={t("addressPh")} />
              </div>
              <fieldset>
                <legend className="label">{t("payOnDelivery")}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["pix", "cartao", "dinheiro"] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={payment === p} onClick={() => setPayment(p)} className={`rounded-xl px-2 py-3 text-[14px] font-semibold ring-1 transition-colors ${payment === p ? "bg-ink text-white ring-ink" : "bg-white ring-black/15"}`}>
                      {p === "cartao" ? t("card") : p === "dinheiro" ? t("cash") : PAYMENT_LABEL[p]}
                    </button>
                  ))}
                </div>
                {payment === "dinheiro" && (
                  <div className="mt-3">
                    <label className="label" htmlFor="troco">{t("change")}</label>
                    <input id="troco" className="input max-w-40" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="100" />
                  </div>
                )}
                {payment === "pix" && <p className="mt-2 text-[13.5px] text-black/60">{t("pixNext")}</p>}
              </fieldset>
              <label className="flex items-start gap-2.5 text-[13.5px] text-black/70">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#172033]" checked={optin} onChange={(e) => setOptin(e.target.checked)} />
                {t("optin")}
              </label>
            </div>
          )}
          <div>
            <label className="label" htmlFor="obs-pedido">{t("orderNotes")}</label>
            <input id="obs-pedido" className="input" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={channel === "delivery" ? t("orderNotesDelivery") : t("orderNotesTable")} />
          </div>

          <div className="space-y-1.5 rounded-2xl bg-[#efefeb] p-4 text-[14.5px]">
            <div className="flex justify-between"><span>{t("subtotal")}</span><span className="tnum">{brl(subtotal)}</span></div>
            {channel === "delivery" && <div className="flex justify-between"><span>{t("deliveryFee")}</span><span className="tnum">{fee ? brl(fee) : t("free")}</span></div>}
            <div className="flex justify-between pt-1 font-display text-[18px] font-bold"><span>{t("total")}</span><span className="tnum">{brl(subtotal + fee)}</span></div>
          </div>
          {missing > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-950">
              {t("minMissing", { v: brl(missing), m: brl(r.min_order_cents) })}
            </p>
          )}
          {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">{err}</p>}
        </div>
        <div className="border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button disabled={busy || !visible.length || missing > 0} className="btn h-[52px] w-full justify-between px-5 text-[16px] text-white disabled:bg-black/30" style={busy || !visible.length || missing > 0 ? undefined : { background: color }}>
            <span>{busy ? t("sending") : channel === "mesa" ? t("sendKitchen") : t("send")}</span>
            <span className="tnum">{brl(subtotal + fee)}</span>
          </button>
          {channel === "delivery" && r.whatsapp && visible.length > 0 && (
            <a
              className="mt-2 flex h-10 items-center justify-center gap-1.5 text-[14px] font-semibold text-black/60 underline-offset-2 hover:underline"
              href={`https://wa.me/55${r.whatsapp.replace(/^55/, "")}?text=${encodeURIComponent(
                `${t("yourOrder")} (${r.name}):\n${visible.map(({ l, it }) => `${l.qty}x ${tr(it!, "pt").name}${optSummary(it!, l.opts) ? ` [${optSummary(it!, l.opts)}]` : ""}${l.notes ? ` (${l.notes})` : ""}`).join("\n")}\n${t("total")}: ${brl(subtotal + fee)}${f.address ? `\n${f.address}` : ""}`
              )}`}
              target="_blank"
              rel="noopener"
            >
              <Icon name="chat" size={16} /> {t("viaWhatsapp")}
            </a>
          )}
        </div>
      </form>
    </Sheet>
  );
}

/** Preço de uma unidade com as escolhas (e a promoção, se estiver valendo). */
function unitOf(item: MenuItem, opts?: Picks) {
  const p = priceWith(item, opts);
  return p.ok ? p.unit : basePrice(item);
}
function optSummary(item: MenuItem, opts?: Picks) {
  if (!opts || !item.options?.length) return "";
  const p = priceWith(item, opts);
  return p.ok ? p.summary : "";
}

/** Preço na lista: promoção riscando o preço normal; "a partir de" quando as opções mudam o preço. */
function PriceTag({ item, color, t }: { item: MenuItem; color: string; t: T }) {
  const now = basePrice(item);
  const from = (item.options ?? []).some((g) => g.choices.some((c) => c.price_cents > 0));
  const minAdd = (item.options ?? []).filter((g) => g.min > 0).reduce((s, g) => s + Math.min(...g.choices.map((c) => c.price_cents)) * g.min, 0);
  return (
    <span className="mr-1 inline-flex items-baseline gap-1.5">
      {from && <span className="text-[12.5px] text-black/60">{t("fromPrice")}</span>}
      <span className="tnum text-[15.5px] font-bold" style={{ color }}>{brl(now + minAdd)}</span>
      {now < item.price_cents && <span className="tnum text-[13px] text-black/60 line-through">{brl(item.price_cents + minAdd)}</span>}
    </span>
  );
}
function PopularPill({ t }: { t: T }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-bold text-amber-900">
      <Icon name="sparkle" size={12} /> {t("popular")}
    </span>
  );
}
function PromoPill({ item, t }: { item: MenuItem; t: T }) {
  const to = item.promo?.to;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-bold text-emerald-900">{to ? t("promoUntil", { h: to.replace(":00", "h").replace(":", "h") }) : t("promo")}</span>;
}
