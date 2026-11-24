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

const DishViewer = dynamic(() => import("@/components/DishViewer"), { ssr: false });
const Waiter = dynamic(() => import("./Waiter"), { ssr: false });

export type MenuData = { restaurant: PublicRestaurant; categories: Category[]; items: MenuItem[]; waiter?: boolean };
type LastOrder = { id: string; number: number; at: number };

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
    loaded.current = true;
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
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug]);

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
  const color = r.primary_color || "#E4572E";
  const paused = r.accepting_orders === false;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const lines = cart.filter((l) => byId.get(l.itemId)?.available);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + byId.get(l.itemId)!.price_cents * l.qty, 0);
  const qtyOf = (id: string) => lines.reduce((s, l) => s + (l.itemId === id ? l.qty : 0), 0);

  const groups = useMemo(
    () =>
      [
        ...categories.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.category_id === c.id) })),
        { id: "outros", name: "Outros", items: items.filter((i) => !i.category_id || !catName.has(i.category_id)) },
      ].filter((g) => g.items.length),
    [categories, items, catName]
  );
  const featured = useMemo(() => items.filter((i) => i.featured && i.available).slice(0, 8), [items]);
  const results = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return null;
    return items.filter((i) => norm(`${i.name} ${i.description} ${i.tags.join(" ")} ${catName.get(i.category_id ?? "") ?? ""}`).includes(q));
  }, [query, items, catName]);

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
  }, [groups, featured.length, results]);
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

  function addToCart(itemId: string, qty = 1, notes = "", viaAi = false) {
    const item = byId.get(itemId);
    if (!item || !item.available) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.itemId === itemId && l.notes === notes);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: Math.min(50, copy[i].qty + qty), viaAi: copy[i].viaAi || viaAi };
        return copy;
      }
      return [...c, { itemId, qty, notes, viaAi }];
    });
    flash(`${qty > 1 ? `${qty}x ` : ""}${item.name} no pedido`);
  }

  function goTo(id: string) {
    clickedTab.current = Date.now();
    setActiveCat(id);
    document.getElementById(id === "destaques" ? "destaques" : `cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const tabs = [...(featured.length ? [{ id: "destaques", name: "Destaques" }] : []), ...groups.map((g) => ({ id: g.id, name: g.name }))];
  const canCall = r.dine_in_enabled && channel === "mesa";

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white pb-32 sm:my-0" style={{ ["--color-brand" as any]: color }}>
      <header className="px-5 pb-4 pt-7">
        <h1 className="text-[30px] font-extrabold leading-[1.05]">{r.name}</h1>
        {r.address && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[14px] text-black/60">
            <Icon name="pin" size={16} className="mt-0.5" />
            {r.address}
          </p>
        )}
        {(r.dine_in_enabled || r.delivery_enabled) && (
          <div className="mt-4 inline-flex rounded-full bg-[#f1efea] p-1 text-[13.5px] font-semibold" role="tablist" aria-label="Como você vai pedir">
            {r.dine_in_enabled && (
              <button role="tab" aria-selected={channel === "mesa"} onClick={() => setChannel("mesa")} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${channel === "mesa" ? "bg-ink text-white" : "text-black/60"}`}>
                <Icon name="table" size={16} />
                {table ? `Mesa ${table}` : "Na mesa"}
              </button>
            )}
            {r.delivery_enabled && (
              <button role="tab" aria-selected={channel === "delivery"} onClick={() => setChannel("delivery")} className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 ${channel === "delivery" ? "bg-ink text-white" : "text-black/60"}`}>
                <Icon name="bike" size={16} />
                Entrega
              </button>
            )}
          </div>
        )}

        {paused && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3.5 text-[14px] text-amber-950">
            <Icon name="pause" size={18} className="mt-0.5" />
            Os pedidos pelo celular estão pausados agora. Você pode ver o cardápio e pedir a um atendente.
          </p>
        )}

        {lastOrder && (
          <a href={`/r/${slug}/pedido/${lastOrder.id}`} className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f1efea] p-3.5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white"><Icon name="receipt" size={20} /></span>
            <span className="flex-1 text-[14.5px]">
              <b className="block">Pedido #{lastOrder.number} enviado</b>
              <span className="text-black/60">Toque para acompanhar o preparo</span>
            </span>
            <Icon name="right" size={18} className="text-black/40" />
          </a>
        )}

        {data.waiter && (
          <button onClick={() => setChatOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-ink p-4 text-left text-white transition active:scale-[0.99]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15"><Icon name="chat" size={22} /></span>
            <span className="flex-1">
              <span className="block font-display text-[17px] font-bold">Na dúvida? Pergunte ao {r.ai_name}</span>
              <span className="block text-[13.5px] text-white/75">Ele conhece cada prato e monta o pedido com você.</span>
            </span>
            <Icon name="right" size={18} />
          </button>
        )}
      </header>

      {/* Busca + categorias */}
      <nav className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur" aria-label="Categorias">
        {searching ? (
          <div className="flex items-center gap-2 px-5 py-2.5">
            <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-[#f1efea] px-4">
              <Icon name="search" size={18} className="text-black/50" />
              <span className="sr-only">Buscar no cardápio</span>
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar prato, ingrediente..." className="h-full flex-1 bg-transparent text-base outline-none" enterKeyHint="search" />
            </label>
            <button onClick={() => { setSearching(false); setQuery(""); }} className="px-1 text-[14.5px] font-semibold">Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center">
            <button onClick={() => setSearching(true)} aria-label="Buscar no cardápio" className="ml-3 grid h-11 w-11 shrink-0 place-items-center rounded-full">
              <Icon name="search" size={21} />
            </button>
            <div ref={tabsRef} className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto py-3 pl-1 pr-5">
              {tabs.map((t) => (
                <button key={t.id} data-tab={t.id} onClick={() => goTo(t.id)} className={`shrink-0 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors ${activeCat === t.id ? "bg-ink text-white" : "bg-[#f1efea] text-black/75"}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {items.length === 0 && <p className="px-5 py-16 text-center text-black/55">O cardápio ainda está sendo montado. Volte em breve.</p>}

      {results ? (
        <section className="px-5 pt-5">
          <p className="mb-1 text-[13.5px] text-black/55">
            {results.length === 0 ? `Nada encontrado para “${query.trim()}”. Tente outra palavra.` : `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`}
          </p>
          <div className="divide-y divide-line">
            {results.map((i) => (
              <Row key={i.id} item={i} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onAdd={() => addToCart(i.id)} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {featured.length > 0 && (
            <section id="destaques" data-cat="destaques" className="scroll-mt-20 pt-6">
              <h2 className="px-5 text-[21px] font-extrabold">Destaques da casa</h2>
              <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {featured.map((i) => (
                  <button key={i.id} onClick={() => setDetail(i)} className="relative w-[46%] max-w-[210px] shrink-0 snap-start overflow-hidden rounded-[20px] text-left">
                    <Thumb item={i} className="aspect-[4/5] w-full" />
                    {i.model && <ArBadge className="absolute left-2.5 top-2.5" />}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent p-3 pt-10 text-white">
                      <span className="line-clamp-2 font-display text-[16px] font-bold leading-tight">{i.name}</span>
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
                  <Row key={i.id} item={i} color={color} qty={qtyOf(i.id)} paused={paused} onOpen={() => setDetail(i)} onAdd={() => addToCart(i.id)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <p className="px-5 pb-2 pt-12 text-center text-[12px] text-black/40">
        Cardápio digital por <a href="/" className="font-semibold underline">Visatto</a>
      </p>

      {/* Barra inferior */}
      <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 ${count > 0 && !paused ? "bg-gradient-to-t from-white via-white/90 to-transparent" : ""}`}>
        <div className="pointer-events-auto flex justify-end gap-2">
          {canCall && (
            <button onClick={() => setCallOpen(true)} aria-label="Chamar atendente ou pedir a conta" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-lg shadow-black/10 ring-1 ring-black/10">
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
              onClick={() => setCartOpen(true)}
              className="animate-pop flex h-14 flex-1 items-center justify-between rounded-2xl px-5 text-[15.5px] font-bold text-white shadow-lg shadow-black/10 transition active:scale-[0.99]"
              style={{ background: color }}
            >
              <span className="flex items-center gap-2.5">
                <Icon name="bag" size={20} />
                Ver pedido ({count})
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
          item={byId.get(detail.id) ?? detail}
          color={color}
          paused={paused}
          onTrack={(type) => track(type, detail.id)}
          onClose={() => setDetail(null)}
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
          sessionId={sessionId}
          byId={byId}
          catName={catName}
          onClose={() => setChatOpen(false)}
          onAction={(a) => {
            if (a.type === "add") addToCart(a.itemId, a.qty, a.notes || "", true);
            if (a.type === "remove") setCart((c) => c.filter((l) => l.itemId !== a.itemId));
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
        <CallSheet slug={slug} table={table} setTable={setTable} onClose={() => setCallOpen(false)} onDone={(msg) => { setCallOpen(false); flash(msg); }} />
      )}

      {cartOpen && (
        <CartSheet
          slug={slug}
          r={r}
          color={color}
          cart={cart}
          setCart={setCart}
          byId={byId}
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
            save(`gia:${slug}:last`, { id, number, at: Date.now() });
            router.push(`/r/${slug}/pedido/${id}`);
          }}
        />
      )}
    </main>
  );
}

function Row({ item: i, color, qty, paused, onOpen, onAdd }: { item: MenuItem; color: string; qty: number; paused: boolean; onOpen: () => void; onAdd: () => void }) {
  return (
    <div className={`relative flex gap-3.5 py-4 ${i.available ? "" : "opacity-55"}`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 gap-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-bold leading-snug">{i.name}</span>
          {i.description && <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-black/60">{i.description}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="tnum mr-1 text-[15.5px] font-bold" style={{ color }}>{brl(i.price_cents)}</span>
            {!i.available && <Pill tone="warn">esgotado</Pill>}
            {i.model && <ArBadge />}
            {i.serves > 1 && <Pill>serve {i.serves}</Pill>}
            {i.tags.slice(0, i.model ? 1 : 2).map((t) => <Pill key={t}>{t}</Pill>)}
          </span>
        </span>
        <Thumb item={i} className="h-[104px] w-[104px] shrink-0 rounded-2xl" />
      </button>
      {i.available && !paused && (
        <button
          onClick={onAdd}
          aria-label={`Adicionar ${i.name} ao pedido`}
          className="absolute bottom-2.5 right-[-6px] grid h-10 min-w-10 place-items-center rounded-full px-2 text-white shadow-md ring-2 ring-white"
          style={{ background: qty ? "#1d1a16" : color }}
        >
          {qty ? <span className="tnum text-[14px] font-bold">{qty}</span> : <Icon name="plus" size={18} stroke={2.4} />}
        </button>
      )}
    </div>
  );
}

function ItemSheet({ item, color, paused, onClose, onAdd, onTrack }: { item: MenuItem; color: string; paused: boolean; onClose: () => void; onAdd: (qty: number, notes: string) => void; onTrack: (type: "view3d" | "ar") => void }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [view, setView] = useState<"3d" | "foto">(item.model ? "3d" : "foto");
  return (
    <Sheet onClose={onClose} label={item.name}>
      <div className="overflow-y-auto">
        <div className="relative">
          {item.model && view === "3d" ? (
            <div className="p-3 pb-0">
              <DishViewer model={item.model} poster={item.image || undefined} alt={item.name} color={color} height={300} onEvent={onTrack} hideDims />
            </div>
          ) : (
            <Thumb item={item} className="h-72 w-full" />
          )}
          <CloseButton onClick={onClose} className="absolute right-5 top-5 z-10 shadow-sm" />
          {item.model && item.image && (
            <div className="absolute left-5 top-5 z-10 flex rounded-full bg-white p-0.5 text-[13px] font-semibold ring-1 ring-black/10">
              <button onClick={() => setView("3d")} className={`rounded-full px-3 py-1.5 ${view === "3d" ? "bg-ink text-white" : ""}`}>3D</button>
              <button onClick={() => setView("foto")} className={`rounded-full px-3 py-1.5 ${view === "foto" ? "bg-ink text-white" : ""}`}>Foto</button>
            </div>
          )}
        </div>
        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[24px] font-extrabold leading-tight">{item.name}</h3>
              <p className="tnum shrink-0 pt-1 font-display text-[20px] font-bold" style={{ color }}>{brl(item.price_cents)}</p>
            </div>
            {item.description && <p className="mt-2 text-[15.5px] leading-relaxed text-black/70">{item.description}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>serve {item.serves} {item.serves === 1 ? "pessoa" : "pessoas"}</Pill>
              {item.tags.map((t) => <Pill key={t}>{t}</Pill>)}
            </div>
          </div>
          {item.model?.dims && item.model.dims.w > 0 && <Dims dims={item.model.dims} />}
          {item.available && !paused && (
            <div>
              <label className="label" htmlFor="obs">Alguma observação?</label>
              <input id="obs" className="input" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: sem cebola, bem passado" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {paused ? (
          <p className="flex-1 py-2 text-center text-[14px] text-black/60">Pedidos pelo celular pausados. Peça a um atendente.</p>
        ) : item.available ? (
          <>
            <Stepper qty={qty} min={1} onChange={(q) => setQty(Math.min(50, q))} size="lg" />
            <button onClick={() => onAdd(qty, notes.trim())} className="btn h-12 flex-1 justify-between px-5 text-[15.5px] text-white" style={{ background: color }}>
              <span>Adicionar</span>
              <span className="tnum">{brl(item.price_cents * qty)}</span>
            </button>
          </>
        ) : (
          <p className="flex-1 py-2 text-center font-semibold text-black/60">Esgotado por hoje</p>
        )}
      </div>
    </Sheet>
  );
}

function CallSheet({ slug, table, setTable, onClose, onDone }: { slug: string; table: string; setTable: (t: string) => void; onClose: () => void; onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  async function call(type: "atendente" | "conta") {
    if (!table.trim()) return setErr("Digite o número da sua mesa.");
    setBusy(type);
    setErr("");
    try {
      await api(`/api/r/${slug}/calls`, { body: { type, table: table.trim() } });
      onDone(type === "conta" ? `Conta pedida para a mesa ${table.trim()}` : `Atendente a caminho da mesa ${table.trim()}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy("");
    }
  }
  return (
    <Sheet onClose={onClose} label="Chamar atendente">
      <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="text-[22px] font-extrabold">Precisa de algo na mesa?</h3>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="mesa-call">Sua mesa</label>
          <input id="mesa-call" className="input h-12 max-w-32 text-lg font-bold" inputMode="numeric" value={table} maxLength={20} onChange={(e) => setTable(e.target.value)} />
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button onClick={() => call("atendente")} disabled={!!busy} className="flex items-center gap-3 rounded-2xl bg-[#f1efea] p-4 text-left disabled:opacity-50">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white"><Icon name="bell" size={22} /></span>
            <span><b className="block text-[15.5px]">{busy === "atendente" ? "Chamando..." : "Chamar atendente"}</b><span className="text-[13.5px] text-black/60">Alguém vem até a sua mesa</span></span>
          </button>
          <button onClick={() => call("conta")} disabled={!!busy} className="flex items-center gap-3 rounded-2xl bg-[#f1efea] p-4 text-left disabled:opacity-50">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white"><Icon name="receipt" size={22} /></span>
            <span><b className="block text-[15.5px]">{busy === "conta" ? "Pedindo..." : "Pedir a conta"}</b><span className="text-[13.5px] text-black/60">Levamos a conta até você</span></span>
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
  color: string;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  byId: Map<string, MenuItem>;
  channel: "mesa" | "delivery";
  setChannel: (c: "mesa" | "delivery") => void;
  table: string;
  setTable: (t: string) => void;
  subtotal: number;
  onClose: () => void;
  onDone: (orderId: string, number: number) => void;
}) {
  const { slug, r, color, cart, setCart, byId, channel, table, subtotal } = props;
  const [f, setF] = useState(() => store("gia:customer", { name: "", phone: "", address: "" }));
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"pix" | "cartao" | "dinheiro" | "">("");
  const [changeFor, setChangeFor] = useState("");
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
    if (channel === "delivery" && !payment) return setErr("Escolha a forma de pagamento.");
    setBusy(true);
    try {
      if (channel === "delivery") save("gia:customer", f);
      const res = await api<{ id: string; number: number }>(`/api/r/${slug}/orders`, {
        body: { channel, table, notes, ...f, payment, changeFor: payment === "dinheiro" ? changeFor : "", items: visible.map((x) => x.l), sessionId: store<string>("gia:sid", "") },
      });
      props.onDone(res.id, res.number);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={props.onClose} label="Seu pedido">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[22px] font-extrabold">Seu pedido</h3>
          <CloseButton onClick={props.onClose} />
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {visible.length === 0 && <p className="py-6 text-center text-black/55">Seu pedido está vazio. Escolha um prato no cardápio.</p>}
          <div className="divide-y divide-line">
            {visible.map(({ l, idx, it }) => (
              <div key={idx} className="flex items-center gap-3 py-3 first:pt-0">
                <Thumb item={it!} className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{it!.name}</p>
                  {l.notes && <p className="mt-0.5 text-[13px] text-black/55">{l.notes}</p>}
                  <p className="tnum mt-0.5 text-[14px] text-black/65">{brl(it!.price_cents * l.qty)}</p>
                </div>
                <Stepper qty={l.qty} onChange={(q) => setQty(idx, q)} />
              </div>
            ))}
          </div>

          {r.dine_in_enabled && r.delivery_enabled && (
            <div className="flex rounded-xl bg-[#f1efea] p-1 text-[14px] font-semibold">
              <button type="button" onClick={() => props.setChannel("mesa")} className={`flex-1 rounded-lg py-2.5 ${channel === "mesa" ? "bg-white shadow-sm" : "text-black/55"}`}>Estou na mesa</button>
              <button type="button" onClick={() => props.setChannel("delivery")} className={`flex-1 rounded-lg py-2.5 ${channel === "delivery" ? "bg-white shadow-sm" : "text-black/55"}`}>Entrega</button>
            </div>
          )}

          {channel === "mesa" ? (
            <div>
              <label className="label" htmlFor="mesa">Número da mesa</label>
              <input id="mesa" className="input h-12 max-w-32 text-lg font-bold" required inputMode="numeric" maxLength={20} value={table} onChange={(e) => props.setTable(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="nome">Seu nome</label>
                <input id="nome" className="input" required autoComplete="name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="fone">WhatsApp com DDD</label>
                <input id="fone" className="input" required inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="label" htmlFor="end">Endereço completo</label>
                <textarea id="end" className="input" required rows={2} autoComplete="street-address" maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Rua, número, bairro, complemento" />
              </div>
              <fieldset>
                <legend className="label">Pagamento na entrega</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["pix", "cartao", "dinheiro"] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={payment === p} onClick={() => setPayment(p)} className={`rounded-xl px-2 py-3 text-[14px] font-semibold ring-1 ${payment === p ? "bg-ink text-white ring-ink" : "bg-white ring-black/15"}`}>
                      {p === "cartao" ? "Cartão" : PAYMENT_LABEL[p]}
                    </button>
                  ))}
                </div>
                {payment === "dinheiro" && (
                  <div className="mt-3">
                    <label className="label" htmlFor="troco">Precisa de troco para quanto? (opcional)</label>
                    <input id="troco" className="input max-w-40" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} placeholder="Ex.: 100" />
                  </div>
                )}
                {payment === "pix" && <p className="mt-2 text-[13.5px] text-black/60">A chave Pix aparece na próxima tela.</p>}
              </fieldset>
            </div>
          )}
          <div>
            <label className="label" htmlFor="obs-pedido">Observações do pedido (opcional)</label>
            <input id="obs-pedido" className="input" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={channel === "delivery" ? "Ex.: interfone 42, portão azul" : "Ex.: trazer as bebidas antes"} />
          </div>

          <div className="space-y-1.5 rounded-2xl bg-[#f5f4f1] p-4 text-[14.5px]">
            <div className="flex justify-between"><span>Subtotal</span><span className="tnum">{brl(subtotal)}</span></div>
            {channel === "delivery" && <div className="flex justify-between"><span>Entrega</span><span className="tnum">{fee ? brl(fee) : "Grátis"}</span></div>}
            <div className="flex justify-between pt-1 font-display text-[18px] font-bold"><span>Total</span><span className="tnum">{brl(subtotal + fee)}</span></div>
          </div>
          {missing > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-950">
              Faltam <b>{brl(missing)}</b> para o pedido mínimo de entrega ({brl(r.min_order_cents)}).
            </p>
          )}
          {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] text-red-800">{err}</p>}
        </div>
        <div className="border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button disabled={busy || !visible.length || missing > 0} className="btn h-[52px] w-full justify-between px-5 text-[16px] text-white disabled:bg-black/30" style={busy || !visible.length || missing > 0 ? undefined : { background: color }}>
            <span>{busy ? "Enviando..." : channel === "mesa" ? "Enviar pedido para a cozinha" : "Enviar pedido"}</span>
            <span className="tnum">{brl(subtotal + fee)}</span>
          </button>
        </div>
      </form>
    </Sheet>
  );
}
