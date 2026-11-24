"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, resizeImage } from "@/lib/client";
import { brl } from "@/lib/format";
import { usePainel } from "../ctx";
import Icon from "@/components/Icon";

type Imported = { categories: { name: string; items: { name: string; description: string; price_cents: number; serves: number; tags: string[] }[] }[] };

export default function Importar() {
  const router = useRouter();
  const { aiEnabled } = usePainel();
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<Imported | null>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) next.push(await resizeImage(f, 1600, 0.85));
    setPhotos(next);
  }

  async function read() {
    setBusy(true);
    setErr("");
    try {
      setPreview(await api("/api/painel/import", { body: { images: photos } }));
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function saveAll() {
    if (!preview) return;
    setBusy(true);
    try {
      await api("/api/painel/import/save", { body: preview });
      router.push("/painel/cardapio");
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  function edit(ci: number, ii: number, patch: any) {
    setPreview((p) => {
      if (!p) return p;
      const c = structuredClone(p);
      Object.assign(c.categories[ci].items[ii], patch);
      return c;
    });
  }
  function removeItem(ci: number, ii: number) {
    setPreview((p) => {
      if (!p) return p;
      const c = structuredClone(p);
      c.categories[ci].items.splice(ii, 1);
      c.categories = c.categories.filter((x) => x.items.length);
      return c;
    });
  }

  const total = preview?.categories.reduce((s, c) => s + c.items.length, 0) ?? 0;

  return (
    <div className="max-w-3xl">
      <h1 className="text-[28px] font-extrabold leading-tight">Importar cardápio por foto</h1>
      <p className="mt-0.5 text-[14px] text-black/55">Tire até 4 fotos do seu cardápio impresso (ou prints do iFood). A IA lê tudo e monta as categorias.</p>

      {!aiEnabled && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Esta função precisa da IA ativada (chave da Anthropic). Enquanto isso, você pode cadastrar os pratos manualmente em Cardápio.
        </p>
      )}

      {!preview && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p} alt="" className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-black/10" />
                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Remover foto" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow"><Icon name="close" size={14} /></button>
              </div>
            ))}
            {photos.length < 4 && (
              <label className="grid aspect-[3/4] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-black/15 text-center text-sm text-black/50 hover:border-ink">
                <span><Icon name="camera" size={22} className="mx-auto mb-1" />Adicionar foto</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
              </label>
            )}
          </div>
          {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <button onClick={read} disabled={!photos.length || busy || !aiEnabled} className="btn-primary mt-5 px-6 py-3">
            {busy ? "Lendo o cardápio... (até 1 minuto)" : "Ler cardápio com IA"}
          </button>
        </>
      )}

      {preview && (
        <div className="mt-6">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p><b>{total} pratos</b> em {preview.categories.length} categorias. Confira e corrija o que precisar.</p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setPreview(null)}>Voltar</button>
              <button className="btn-primary" disabled={busy || !total} onClick={saveAll}>{busy ? "Salvando..." : "Salvar no cardápio"}</button>
            </div>
          </div>
          {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="mt-5 space-y-6">
            {preview.categories.map((c, ci) => (
              <section key={ci}>
                <input
                  className="mb-2 w-full bg-transparent text-lg font-extrabold outline-none"
                  value={c.name}
                  onChange={(e) =>
                    setPreview((p) => {
                      const x = structuredClone(p!);
                      x.categories[ci].name = e.target.value;
                      return x;
                    })
                  }
                />
                <div className="card divide-y divide-black/5">
                  {c.items.map((it, ii) => (
                    <div key={ii} className="grid gap-2 p-3 sm:grid-cols-[1fr_110px_auto]">
                      <div className="space-y-1">
                        <input className="w-full font-semibold outline-none" value={it.name} onChange={(e) => edit(ci, ii, { name: e.target.value })} />
                        <input className="w-full text-sm text-black/60 outline-none" value={it.description} onChange={(e) => edit(ci, ii, { description: e.target.value })} placeholder="descrição" />
                      </div>
                      <input
                        className="input h-10"
                        inputMode="decimal"
                        defaultValue={(it.price_cents / 100).toFixed(2).replace(".", ",")}
                        onBlur={(e) => edit(ci, ii, { price_cents: Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 })}
                        title={brl(it.price_cents)}
                      />
                      <button onClick={() => removeItem(ci, ii)} className="text-sm text-black/40 hover:text-red-700">remover</button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
