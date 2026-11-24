"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, dataUrlToBlob, resizeImage, uploadFile } from "@/lib/client";
import Icon from "@/components/Icon";
import ModelStudio from "./ModelStudio";
import { usePainel } from "../ctx";
import { Confirm, Dialog, IconButton, Notice, PageHead, Switch, SwitchRow, Thumb } from "../ui";
import { brl, TAG_OPTIONS, type Category, type MenuItem } from "@/lib/format";

type Draft = Partial<MenuItem> & { price?: string; tab?: "info" | "3d" };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Cardapio() {
  const { aiEnabled, waiter, reload } = usePainel();
  const [menu, setMenu] = useState<{ categories: Category[]; items: MenuItem[] } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [only3d, setOnly3d] = useState(false);

  async function load() {
    setMenu(await api("/api/painel/items"));
  }
  useEffect(() => {
    load();
  }, []);

  // enquanto algum 3D estiver sendo gerado, acompanha e atualiza a lista
  const generating = (menu?.items ?? []).filter((i) => i.model_status === "gerando" || i.model_status === "processando").map((i) => i.id);
  const genKey = generating.join(",");
  useEffect(() => {
    if (!genKey) return;
    const t = setInterval(async () => {
      for (const id of genKey.split(",")) await api(`/api/painel/items/${id}/model`).catch(() => {});
      load();
    }, 6000);
    return () => clearInterval(t);
  }, [genKey]);

  if (!menu)
    return (
      <div aria-busy="true">
        <div className="skeleton h-9 w-44 rounded-lg" />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  const { categories, items } = menu;
  const catIds = new Set(categories.map((c) => c.id));
  const q = norm(query.trim());
  const shown = items.filter((i) => (!q || norm(`${i.name} ${i.description}`).includes(q)) && (!only3d || !(i.model_status === "pronto" && i.model_published)));
  const orphans = shown.filter((i) => !i.category_id || !catIds.has(i.category_id));
  const with3d = items.filter((i) => i.model_status === "pronto" && i.model_published).length;
  const filtering = !!q || only3d;
  const blank = (category_id: string | null = categories[0]?.id ?? null): Draft => ({ category_id, serves: 1, tags: [], available: true });
  const edit = (i: MenuItem, tab: "info" | "3d" = "info") => setEditing({ ...i, price: (i.price_cents / 100).toFixed(2).replace(".", ","), tab });

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    await api("/api/painel/categories", { body: { name: newCat } });
    setNewCat("");
    setAddingCat(false);
    load();
  }

  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming || !renaming.name.trim()) return setRenaming(null);
    await api(`/api/painel/categories/${renaming.id}`, { method: "PUT", body: { name: renaming.name } });
    setRenaming(null);
    load();
  }

  async function deleteCategory(c: Category) {
    await api(`/api/painel/categories/${c.id}`, { method: "DELETE" });
    setDelCat(null);
    load();
  }

  /** sobe ou desce a categoria na ordem em que o cliente vê */
  async function moveCategory(idx: number, dir: -1 | 1) {
    const order = [...categories];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    setMenu((m) => m && { ...m, categories: order });
    await Promise.all(order.map((c, position) => api(`/api/painel/categories/${c.id}`, { method: "PUT", body: { position } })));
    load();
  }

  async function quick(i: MenuItem, patch: Partial<MenuItem>) {
    setMenu((m) => m && { ...m, items: m.items.map((x) => (x.id === i.id ? { ...x, ...patch } : x)) });
    await api(`/api/painel/items/${i.id}`, { method: "PUT", body: { quick: true, ...patch } }).catch(load);
  }

  const sections = [
    ...categories.map((c, idx) => ({ cat: c as Category | null, idx, list: shown.filter((i) => i.category_id === c.id) })),
    ...(orphans.length ? [{ cat: null, idx: -1, list: orphans }] : []),
  ].filter((s) => !filtering || s.list.length);

  return (
    <div>
      <PageHead
        title="Cardápio"
        sub={items.length ? <>{items.length} {items.length === 1 ? "prato" : "pratos"} · <b className="text-ink">{with3d} com 3D na mesa</b>. O que você muda aqui aparece na hora para o cliente{waiter ? " e para o garçom de IA" : ""}.</> : "Cadastre seus pratos e escaneie cada um em 3D."}
      >
        {aiEnabled && (
          <Link href="/painel/importar" className="btn-ghost">
            <Icon name="camera" size={17} /> Importar por foto
          </Link>
        )}
        <button className="btn-primary" onClick={() => setEditing(blank())}>
          <Icon name="plus" size={17} stroke={2.4} /> Novo prato
        </button>
      </PageHead>

      {items.length === 0 && (
        <div className="card mt-6 grid gap-5 p-6 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div>
            <h2 className="text-[22px] font-extrabold">Vamos montar o seu cardápio</h2>
            <p className="mt-1.5 text-[15px] text-black/65">
              {aiEnabled
                ? "O jeito mais rápido é tirar foto do cardápio que você já tem. A IA lê tudo e você só confere."
                : "Comece pelas categorias (Entradas, Pratos, Bebidas...) e adicione os pratos com foto, preço e descrição. Depois é só escanear cada um em 3D."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {aiEnabled && <Link href="/painel/importar" className="btn-primary h-12">Importar do cardápio impresso</Link>}
            <button className={`h-12 ${aiEnabled ? "btn-ghost" : "btn-primary"}`} onClick={() => setEditing(blank(null))}>Adicionar o primeiro prato</button>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {items.length > 6 && (
          <label className="flex h-11 w-full items-center gap-2 rounded-xl bg-white px-3.5 ring-1 ring-black/12 sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1">
            <Icon name="search" size={17} className="text-black/45" />
            <span className="sr-only">Buscar prato</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar prato" className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
            {query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}><Icon name="close" size={15} /></button>}
          </label>
        )}
        {items.length > 0 && with3d < items.length && (
          <button type="button" aria-pressed={only3d} onClick={() => setOnly3d(!only3d)} className={`h-11 ${only3d ? "btn-dark" : "btn-ghost"}`}>
            <Icon name="scan" size={17} /> Sem 3D ({items.length - with3d})
          </button>
        )}
        {addingCat ? (
          <form onSubmit={addCategory} className="flex min-w-0 flex-1 gap-2 sm:max-w-sm">
            <input autoFocus className="input h-11" aria-label="Nome da nova categoria" placeholder="Ex.: Pizzas, Bebidas" maxLength={60} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn-dark h-11 shrink-0">Criar</button>
            <button type="button" className="btn-ghost h-11 shrink-0 px-3" aria-label="Cancelar" onClick={() => { setAddingCat(false); setNewCat(""); }}><Icon name="close" size={16} /></button>
          </form>
        ) : (
          <button type="button" className="btn-ghost h-11" onClick={() => setAddingCat(true)}>
            <Icon name="plus" size={17} /> Nova categoria
          </button>
        )}
      </div>

      {filtering && shown.length === 0 && <p className="mt-10 text-center text-black/55">Nenhum prato encontrado{q ? ` para “${query.trim()}”` : ""}.</p>}

      <div className="mt-6 space-y-9">
        {sections.map(({ cat, idx, list }) => (
          <section key={cat?.id ?? "none"}>
            <div className="mb-3 flex min-h-9 items-center gap-1">
              {cat && renaming?.id === cat.id ? (
                <form onSubmit={saveRename} className="flex flex-1 gap-2 sm:max-w-sm">
                  <input autoFocus className="input h-10" aria-label="Nome da categoria" maxLength={60} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                  <button className="btn-dark h-10 shrink-0">Salvar</button>
                  <button type="button" className="btn-ghost h-10 shrink-0" onClick={() => setRenaming(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <h2 className="text-[20px] font-extrabold">{cat?.name ?? "Sem categoria"}</h2>
                  <span className="tnum ml-1.5 mr-1 rounded-full bg-black/[0.06] px-2 py-0.5 text-[12.5px] font-semibold text-black/55">{list.length}</span>
                  {cat && !filtering && (
                    <>
                      <IconButton icon="edit" label={`Renomear ${cat.name}`} onClick={() => setRenaming({ id: cat.id, name: cat.name })} />
                      {idx > 0 && <IconButton icon="down" className="rotate-180" label={`Subir ${cat.name}`} onClick={() => moveCategory(idx, -1)} />}
                      {idx < categories.length - 1 && <IconButton icon="down" label={`Descer ${cat.name}`} onClick={() => moveCategory(idx, 1)} />}
                      <IconButton icon="trash" danger label={`Excluir ${cat.name}`} onClick={() => (items.some((i) => i.category_id === cat.id) ? setDelCat(cat) : deleteCategory(cat))} />
                      <button onClick={() => setEditing(blank(cat.id))} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[14px] font-semibold hover:bg-black/5">
                        <Icon name="plus" size={15} stroke={2.2} /> Prato aqui
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {list.length === 0 && <p className="rounded-2xl border border-dashed border-black/15 px-4 py-6 text-center text-[14px] text-black/45">Nenhum prato nesta categoria ainda.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((i) => (
                <article key={i.id} className="card flex gap-3.5 p-3.5">
                  <button type="button" onClick={() => edit(i)} aria-label={`Editar ${i.name}`} className={`shrink-0 ${i.available ? "" : "opacity-50"}`}>
                    <Thumb src={i.image} className="h-[72px] w-[72px] rounded-xl sm:h-[88px] sm:w-[88px]" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1">
                      <button type="button" onClick={() => edit(i)} className={`min-w-0 flex-1 text-left ${i.available ? "" : "opacity-50"}`}>
                        <p className="truncate font-display text-[16.5px] font-bold leading-tight">{i.name}</p>
                        <p className="mt-1 line-clamp-1 text-[13.5px] text-black/55">
                          <b className="tnum text-[14.5px] text-ink">{brl(i.price_cents)}</b>
                          {i.description ? ` · ${i.description}` : ""}
                        </p>
                      </button>
                      <span className="-mr-1.5 -mt-1.5 flex shrink-0">
                        <button
                          type="button"
                          aria-pressed={i.featured}
                          aria-label={i.featured ? `Tirar ${i.name} dos destaques` : `Destacar ${i.name}`}
                          title={i.featured ? "Destaque da casa" : "Colocar nos destaques"}
                          onClick={() => quick(i, { featured: !i.featured })}
                          className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5 ${i.featured ? "text-amber-500" : "text-black/30"}`}
                        >
                          <svg width="19" height="19" viewBox="0 0 24 24" fill={i.featured ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                            <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8L12 3Z" />
                          </svg>
                        </button>
                        <IconButton icon="edit" label={`Editar ${i.name}`} onClick={() => edit(i)} />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                      <label className="flex items-center gap-2 text-[13px] font-semibold">
                        <Switch on={i.available} onChange={(v) => quick(i, { available: v })} label={`${i.name} disponível`} />
                        <span className={i.available ? "text-black/70" : "text-red-700"}>{i.available ? "Disponível" : "Esgotado"}</span>
                      </label>
                      <ModelBadge item={i} onClick={() => edit(i, "3d")} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {delCat && (
        <Confirm
          title={`Excluir a categoria “${delCat.name}”?`}
          text={`Os ${items.filter((i) => i.category_id === delCat.id).length} pratos dela não são apagados: ficam em “Sem categoria”.`}
          confirm="Excluir categoria"
          danger
          onCancel={() => setDelCat(null)}
          onConfirm={() => deleteCategory(delCat)}
        />
      )}

      {editing && (
        <ItemForm
          key={`${editing.id ?? "novo"}-${editing.tab ?? "info"}`}
          draft={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={async (createdId) => {
            const m = await api<{ categories: Category[]; items: MenuItem[] }>("/api/painel/items");
            setMenu(m);
            reload();
            // prato novo: já abre na aba do 3D, que é o próximo passo natural
            const created = createdId ? m.items.find((x) => x.id === createdId) : null;
            if (created) edit(created, "3d");
            else setEditing(null);
          }}
          onChangedModel={() => { load(); reload(); }}
        />
      )}
    </div>
  );
}

function ModelBadge({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  const st = item.model_status || "nenhum";
  const map: Record<string, [string, string, string]> = {
    nenhum: ["Pôr em 3D", "bg-white text-ink ring-1 ring-black/15 hover:bg-black/5", "scan"],
    gerando: [`3D ${item.model_progress || 0}%`, "bg-sky-100 text-sky-900", "clock"],
    processando: ["3D quase pronto", "bg-sky-100 text-sky-900", "clock"],
    revisar: ["Conferir 3D", "bg-amber-100 text-amber-950", "eye"],
    pronto: item.model_published ? ["3D na mesa", "bg-ink text-white", "scan"] : ["3D oculto", "bg-black/[0.06] text-black/60", "eye"],
    erro: ["3D com erro", "bg-red-100 text-red-800", "alert"],
  };
  const [label, cls, icon] = map[st] ?? map.nenhum;
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ${cls}`}>
      <Icon name={icon} size={14} stroke={2} />
      {label}
    </button>
  );
}

function ItemForm({
  draft,
  categories,
  onClose,
  onSaved,
  onChangedModel,
}: {
  draft: Draft;
  categories: Category[];
  onClose: () => void;
  onSaved: (createdId?: string) => void;
  onChangedModel?: () => void;
}) {
  const [f, setF] = useState<Draft>({ name: "", description: "", price: "", image: "", ...draft });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const isNew = !draft.id;

  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"info" | "3d">(draft.tab ?? "info");

  async function pickImage(file?: File) {
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const img = await resizeImage(file, 1000, 0.8);
      setF((x) => ({ ...x, image: img })); // prévia imediata
      const url = await uploadFile(dataUrlToBlob(img), "foto.jpg");
      setF((x) => ({ ...x, image: url }));
    } catch (e: any) {
      setErr(e.message || "Não foi possível enviar a foto.");
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const body = { ...f, price: f.price };
      if (isNew) {
        const { id } = await api<{ id: string }>("/api/painel/items", { body });
        onSaved(id);
      } else {
        await api(`/api/painel/items/${draft.id}`, { method: "PUT", body });
        onSaved();
      }
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  async function remove() {
    await api(`/api/painel/items/${draft.id}`, { method: "DELETE" });
    onSaved();
  }

  const tags = f.tags ?? [];
  return (
    <Dialog onClose={onClose} label={isNew ? "Novo prato" : draft.name || "Prato"} wide>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="min-w-0 truncate text-[21px] font-extrabold">{isNew ? "Novo prato" : draft.name}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/10"><Icon name="close" size={18} /></button>
      </div>
      {!isNew && (
        <div className="px-5 pt-4">
          <div className="flex rounded-xl bg-black/[0.05] p-1 text-[14px] font-semibold" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "info"} onClick={() => setTab("info")} className={`flex-1 rounded-lg py-2.5 ${tab === "info" ? "bg-white shadow-sm" : "text-black/55"}`}>Informações</button>
            <button type="button" role="tab" aria-selected={tab === "3d"} onClick={() => setTab("3d")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 ${tab === "3d" ? "bg-white shadow-sm" : "text-black/55"}`}>
              <Icon name="scan" size={16} /> Ver na mesa (3D)
            </button>
          </div>
        </div>
      )}
      {tab === "3d" && draft.id ? (
        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <ModelStudio itemId={draft.id} itemName={draft.name || "prato"} image={f.image || undefined} onChanged={onChangedModel} />
        </div>
      ) : (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto p-5">
            <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-black/20 p-3 hover:border-ink">
              <Thumb src={f.image} className="h-20 w-20 shrink-0 rounded-xl" />
              <div className="text-[14px]">
                <p className="flex items-center gap-1.5 font-semibold"><Icon name="image" size={17} /> {f.image ? "Trocar a foto" : "Adicionar foto do prato"}</p>
                <p className="mt-0.5 text-black/55">{uploading ? "Enviando..." : "Pode tirar com o celular. Prato com foto vende mais."}</p>
                {f.image && !uploading && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setF({ ...f, image: "" }); }} className="mt-1 text-[13px] font-semibold text-red-700 underline">Remover foto</button>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>

            <div>
              <label className="label" htmlFor="it-nome">Nome</label>
              <input id="it-nome" className="input" required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="it-desc">Descrição</label>
              <textarea id="it-desc" className="input" rows={3} maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ingredientes, preparo, tamanho. Quanto mais detalhe, menos dúvida na mesa." />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="it-preco">Preço (R$)</label>
                <input id="it-preco" className="input" required inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="39,90" />
              </div>
              <div>
                <label className="label" htmlFor="it-serve">Serve quantas pessoas</label>
                <input id="it-serve" className="input" type="number" min={1} max={20} value={f.serves ?? 1} onChange={(e) => setF({ ...f, serves: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label" htmlFor="it-cat">Categoria</label>
                <select id="it-cat" className="input" value={f.category_id ?? ""} onChange={(e) => setF({ ...f, category_id: e.target.value || null })}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset>
              <legend className="label">Etiquetas</legend>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={tags.includes(t)}
                    onClick={() => setF({ ...f, tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] })}
                    className={`rounded-full px-3 py-1.5 text-[13.5px] font-semibold ${tags.includes(t) ? "bg-ink text-white" : "bg-black/[0.06] text-black/70"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-3 rounded-2xl bg-cream p-4">
              <SwitchRow on={f.available !== false} onChange={(v) => setF({ ...f, available: v })} title="Disponível hoje" text="Desligue quando acabar. O prato aparece como esgotado." />
              <SwitchRow on={!!f.featured} onChange={(v) => setF({ ...f, featured: v })} title="Destaque da casa" text="Aparece no topo do cardápio, com foto grande." />
            </div>
            {err && <Notice tone="error">{err}</Notice>}
            {isNew && <p className="text-[13px] text-black/50">Depois de salvar, você já pode escanear o prato em 3D.</p>}
          </div>
          <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!isNew && (
              <button type="button" onClick={() => setAskDelete(true)} className="btn-ghost h-12 text-red-700" aria-label="Excluir prato">
                <Icon name="trash" size={17} />
              </button>
            )}
            <button className="btn-primary h-12 flex-1 text-[15px]" disabled={busy || uploading}>{busy ? "Salvando..." : uploading ? "Enviando foto..." : isNew ? "Salvar prato" : "Salvar alterações"}</button>
          </div>
        </form>
      )}
      {askDelete && (
        <Confirm
          title={`Excluir “${draft.name}”?`}
          text="O prato sai do cardápio e o 3D dele é apagado. Os pedidos antigos continuam no histórico."
          confirm="Excluir prato"
          danger
          onCancel={() => setAskDelete(false)}
          onConfirm={remove}
        />
      )}
    </Dialog>
  );
}
