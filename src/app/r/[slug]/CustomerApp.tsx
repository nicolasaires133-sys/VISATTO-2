"use client";
// Cardápio do cliente: abre pelo QR da mesa ou pelo link do delivery.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
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

export default function CustomerApp({ slug, mesa, modo, prato = "", initial }: { slug: string; mesa: string; modo: string; prato?: string; initial: MenuData }) {
  const router = useRouter();
  const [data, setData] = useState<MenuData>(initial);
  const [cart, setCart] = useState<CartLine[]>([]);
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
  const langs = r.languages ?? [];
  const setLang = (l: Lang) => {
    setLangState(l);
    save("gia:lang", l);
  };
  const color = r.primary_color || "#E4572E";
  const paused = r.accepting_orders === false;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, tr(c, lang).name])), [categories, lang]);
  const kinds = useMemo(() => new Map(categories.map((c) => [c.id, categoryKind(c.name)])), [categories]);
  const kindOf = (catId: string | null): Kind => kinds.get(catId ?? "") ?? "principal";
  const daypart = useMemo(() => daypartAt(hourIn()), [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (i: MenuItem) => tr(i, lang).name;
  const lines = cart.filter((l) => byId.get(l.itemId)?.available);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + byId.get(l.itemId)!.price_cents * l.qty, 0);
  const qtyOf = (id: string) => lines.reduce((s, l) => s + (l.itemId === id ? l.qty : 0), 0);

  const groups = useMemo(
    () =>
      [
        ...categories.map((c) => ({ id: c.id, name: catName.get(c.id) ?? c.name, items: items.filter((i) => i.category_id === c.id) })),
        { id: "outros", name: t("others"), items: items.filter((i) => !i.category_id || !catName.has(i.category_id)) },
      ].filter((g) => g.items.length),
    [categories, items, catName, t]
  );
  const featured = useMemo(() => items.filter((i) => i.featured && i.available).slice(0, 8), [items]);
  // pratos marcados para esta hora do dia (almoço, noite...)
  const forNow = useMemo(() => items.filter((i) => i.available && i.dayparts?.includes(daypart)).slice(0, 8), [items, daypart]);
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
    const q = norm(query.trim());
    if (q.length < 2) return null;
    return items.filter((i) => norm(`${i.name} ${i.description} ${tr(i, lang).name} ${tr(i, lang).description} ${i.tags.join(" ")} ${catName.get(i.category_id ?? "") ?? ""}`).includes(q));
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
  }, [groups, featured.length, forNow.length, results]);
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

  function addToCart(itemId: string, qty = 1, notes = "", viaAi = false, viaSuggest = false) {
    const item = byId.get(itemId);
    if (!item || !item.available) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.itemId === itemId && l.notes === notes);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: Math.min(50, copy[i].qty + qty), viaAi: copy[i].viaAi || viaAi, viaSuggest: copy[i].viaSuggest || viaSuggest };
        return copy;
      }
      return [...c, { itemId, qty, notes, viaAi, viaSuggest }];
    });
    flash(t("added", { name: `${qty > 1 ? `${qty}x ` : ""}${name(item)}` }));
  }
  const suggestFor = (ids: string[], limit = 3, exclude: string[] = []) =>
    suggest(ids, items, kindOf, { daypart, limit, exclude }).map((id) => byId.get(id)!).filter(Boolean);

  function goTo(id: string) {
    clickedTab.current = Date.now();
    setActiveCat(id);
    document.getElementById(id === "destaques" || id === "agora" ? id : `cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const tabs = [
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
              <Icon name="search" size={18} className="text-black/50" />
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

      {round && !results && (
        <section className="animate-enter mx-5 mt-5 rounded-3xl p-4 ring-1 ring-black/[0.07]" style={{ background: `${color}12` }} aria-label={round.kind === "sobremesa" ? t("secondRound") : t("secondRoundDrink")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">{round.kind === "sobremesa" ? t("secondRound") : t("secondRoundDrink")}</h2>
            <button onClick={() => { setRoundOff(true); save(`gia:${slug}:round`, lastOrder?.id ?? ""); }} className="shrink-0 text-[13px] font-semibold text-black/50">{t("dismiss")}</button>
          </div>
          <div className="mt-3 space-y-2">
            {round.list.map((i) => (
              <SuggestRow key={i.id} item={i} name={name(i)} color={color} t={t} onOpen={() => setDetail(i)} onAdd={() => addToCart(i.id, 1, "", false, true)} />
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
              <Row key={i.id} item={i} lang={lang} t={t} sub={byId.get(i.substitute_id ?? "")} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onOpenSub={(x) => setDetail(x)} onAdd={() => addToCart(i.id)} />
            ))}
          </div>
        </section>
      ) : (
        <>
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
                    <span className="tnum mt-0.5 block text-[14px] font-semibold" style={{ color }}>{brl(i.price_cents)}</span>
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
                      <span className="tnum mt-0.5 block text-[14px] font-semibold">{brl(i.price_cents)}</span>
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
                  <Row key={i.id} item={i} lang={lang} t={t} sub={byId.get(i.substitute_id ?? "")} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onOpenSub={(x) => setDetail(x)} onAdd={() => addToCart(i.id)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="px-5 pb-2 pt-12 text-center text-[12px] text-black/40">
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
          onClose={() => setDetail(null)}
          onOpen={(x) => setDetail(x)}
          onAddPair={(id) => addToCart(id, 1, "", false, true)}
          onAdd={(qty, notes) => {
            addToCart(detail.id, qty, notes);
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
            router.push(`/r/${slug}/pedido/${id}`);
          }}
        />
      )}
    </main>
  );
}

function Row({ item: i, lang, t, sub, color, qty, paused, onOpen, onOpenSub, onAdd }: { item: MenuItem; lang: Lang; t: T; sub?: MenuItem; color: string; qty: number; paused: boolean; onOpen: () => void; onOpenSub: (x: MenuItem) => void; onAdd: () => void }) {
  const { name, description } = tr(i, lang);
  return (
    <div className="relative py-4">
      <div className={`relative flex gap-3.5 ${i.available ? "" : "opacity-55"}`}>
        <button onClick={onOpen} className="flex min-w-0 flex-1 gap-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-bold leading-snug">{name}</span>
            {description && <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-black/60">{description}</span>}
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="tnum mr-1 text-[15.5px] font-bold" style={{ color }}>{brl(i.price_cents)}</span>
              {!i.available && <Pill tone="warn">{t("soldOut")}</Pill>}
              {i.model && <ArBadge />}
              {i.serves > 1 && <Pill>{t("serves", { n: i.serves })}</Pill>}
              {i.tags.slice(0, i.model ? 1 : 2).map((tag) => <Pill key={tag}>{tag}</Pill>)}
            </span>
          </span>
          <Thumb item={i} className="h-[104px] w-[104px] shrink-0 rounded-2xl" />
        </button>
        {i.available && !paused && (
          <button
            key={qty}
            onClick={onAdd}
            aria-label={t("addAria", { name })}
            className={`absolute bottom-[-6px] right-[-6px] grid h-10 min-w-10 place-items-center rounded-full px-2 text-white shadow-md ring-2 ring-white transition-transform active:scale-90 ${qty ? "animate-bump" : ""}`}
            style={{ background: qty ? "#1d1a16" : color }}
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
function SuggestRow({ item, name, color, t, onOpen, onAdd }: { item: MenuItem; name: string; color: string; t: T; onOpen: () => void; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pr-2.5 ring-1 ring-black/[0.06]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Thumb item={item} className="h-12 w-12 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{name}</span>
          <span className="tnum text-[13.5px] text-black/60">{brl(item.price_cents)}</span>
        </span>
      </button>
      <button type="button" onClick={onAdd} aria-label={t("addAria", { name })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-90" style={{ background: color }}>
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
  onAdd: (qty: number, notes: string) => void;
  onAddPair: (id: string) => void;
  onTrack: (type: "view3d" | "ar") => void;
}) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
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
              <DishViewer model={item.model} poster={item.image || undefined} alt={name} color={color} height={300} onEvent={onTrack} hideDims />
            </div>
          ) : (
            <Thumb item={item} className="h-72 w-full" />
          )}
          <CloseButton onClick={onClose} className="absolute right-5 top-5 z-10 shadow-sm" />
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
              <p className="tnum shrink-0 pt-1 font-display text-[20px] font-bold" style={{ color }}>{brl(item.price_cents)}</p>
            </div>
            {description && <p className="mt-2 text-[15.5px] leading-relaxed text-black/70">{description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>{t("servesLong", { n: item.serves, p: item.serves === 1 ? t("person") : t("people") })}</Pill>
              {item.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}
            </div>
          </div>
          {item.model?.dims && item.model.dims.w > 0 && <Dims dims={item.model.dims} />}

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
            <button onClick={() => onAdd(qty, notes.trim())} className="btn h-12 flex-1 justify-between px-5 text-[15.5px] text-white" style={{ background: color }}>
              <span>{t("add")}</span>
              <span className="tnum">{brl(item.price_cents * qty)}</span>
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
          <button onClick={() => call("conta")} disabled={!!busy} className="flex items-center gap-3 rounded-2xl bg-[#efefeb] p-4 text-left transition-colors hover:bg-[#e6e6e1] disabled:opacity-50">
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
      if (channel === "delivery") save("gia:customer", f);
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
                  {l.notes && <p className="mt-0.5 text-[13px] text-black/55">{l.notes}</p>}
                  <p className="tnum mt-0.5 text-[14px] text-black/65">{brl(it!.price_cents * l.qty)}</p>
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
            <div>
              <label className="label" htmlFor="mesa">{t("tableNumber")}</label>
              <input id="mesa" className="input h-12 max-w-32 text-lg font-bold" required inputMode="numeric" maxLength={20} value={table} onChange={(e) => props.setTable(e.target.value)} />
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
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#1d1a16]" checked={optin} onChange={(e) => setOptin(e.target.checked)} />
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
                `${t("yourOrder")} (${r.name}):\n${visible.map(({ l, it }) => `${l.qty}x ${tr(it!, "pt").name}${l.notes ? ` (${l.notes})` : ""}`).join("\n")}\n${t("total")}: ${brl(subtotal + fee)}${f.address ? `\n${f.address}` : ""}`
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
