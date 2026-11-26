"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, formatDims, glbToUsdz, resizeImage, uploadFile } from "@/lib/client";
import { ACAI_SIZES, BURGER_TYPES, PIZZA_FLAVORS, TEMPLATES, guessVariant, variantImage, type TemplateKind } from "@/lib/templates";
import QRCode from "qrcode";
import { usePainel } from "../ctx";
import Icon from "@/components/Icon";
import { Confirm, Notice } from "../ui";

const DishViewer = dynamic(() => import("@/components/DishViewer"), { ssr: false });

type ModelInfo = {
  model_status: "nenhum" | "gerando" | "processando" | "revisar" | "pronto" | "erro";
  model_glb_url: string;
  model_usdz_url: string;
  model_width_cm: number;
  model_dims: { w: number; d: number; h: number } | null;
  model_progress: number;
  model_published: boolean;
  model_error: string;
  meshyEnabled: boolean;
  warning?: string;
};

export default function ModelStudio({ itemId, itemName, image, onChanged }: { itemId: string; itemName: string; image?: string; onChanged?: () => void }) {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  // pizza, açaí e marmita: começa no modelo pronto (não precisa escanear)
  const [mode, setMode] = useState<"escanear" | "pronto" | "ia" | "arquivo">(() => (guessTemplate(itemName) ? "pronto" : "escanear"));
  const [scan, setScan] = useState<{ url: string; qr: string; base: string | null } | null>(null);
  const [rescan, setRescan] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [width, setWidth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [keepScale, setKeepScale] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [usdzState, setUsdzState] = useState<"" | "gerando" | "erro">("");
  const [newWidth, setNewWidth] = useState("");
  const usdzFor = useRef("");
  const { restaurant } = usePainel();
  const [qr, setQr] = useState("");
  const [askRemove, setAskRemove] = useState(false);
  const [onPhone, setOnPhone] = useState(false);
  useEffect(() => setOnPhone(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)), []);

  const load = useCallback(async () => {
    const d = await api<ModelInfo>(`/api/painel/items/${itemId}/model`);
    setInfo(d);
    return d;
  }, [itemId]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  // acompanha a geração por IA
  useEffect(() => {
    if (!info || !["gerando", "processando"].includes(info.model_status)) return;
    const t = setInterval(() => {
      load()
        .then((d) => {
          if (!["gerando", "processando"].includes(d.model_status)) onChanged?.();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [info, load, onChanged]);

  // enquanto o QR do escâner está aberto, acompanha se o celular já salvou o 3D
  useEffect(() => {
    if (!scan) return;
    const t = setInterval(() => {
      load()
        .then((d) => {
          if (d.model_status !== "nenhum" && d.model_status !== "erro" && d.model_glb_url !== scan.base) {
            setScan(null);
            setRescan(false);
            onChanged?.();
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [scan, load, onChanged]);

  /** here=true: o dono já está no celular, abre o escâner direto (sem QR). */
  async function startScan(here = false) {
    setErr("");
    try {
      const { path } = await api<{ path: string }>(`/api/painel/items/${itemId}/scan`, { method: "POST" });
      if (here) {
        window.location.href = `${path}?volta=painel`;
        return;
      }
      const url = `${window.location.origin}${path}`;
      setScan({ url, qr: await QRCode.toString(url, { type: "svg", margin: 1, width: 200 }), base: info?.model_glb_url ?? null });
    } catch (e: any) {
      setErr(e.message);
    }
  }

  // cria a versão para iPhone (USDZ) no próprio navegador assim que o modelo fica pronto
  useEffect(() => {
    if (!info?.model_glb_url || info.model_usdz_url) return;
    if (!["revisar", "pronto"].includes(info.model_status)) return;
    if (usdzFor.current === info.model_glb_url) return;
    usdzFor.current = info.model_glb_url;
    setUsdzState("gerando");
    (async () => {
      try {
        const blob = await glbToUsdz(info.model_glb_url);
        const url = await uploadFile(blob, `${itemId}.usdz`);
        setInfo(await api(`/api/painel/items/${itemId}/model`, { method: "PUT", body: { action: "usdz", url } }));
        setUsdzState("");
      } catch {
        setUsdzState("erro");
      }
    })();
  }, [info, itemId]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) next.push(await resizeImage(f, 1280, 0.88));
    setPhotos(next);
  }

  async function generate() {
    setErr("");
    setBusy("Enviando fotos...");
    try {
      await api(`/api/painel/items/${itemId}/model/generate`, { body: { images: photos, width_cm: Number(width.replace(",", ".")) } });
      await load();
      onChanged?.();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy("");
  }

  async function importFile() {
    if (!file) return;
    setErr("");
    if (!/\.glb$/i.test(file.name)) return setErr("Envie um arquivo .glb. Nos apps de escaneamento, exporte como GLB.");
    if (file.size > 80 * 1024 * 1024) return setErr("Arquivo maior que 80 MB. Exporte com qualidade média no app de escaneamento.");
    try {
      setBusy("Enviando arquivo... 0%");
      const url = await uploadFile(file, `${itemId}-scan.glb`, (p) => setBusy(`Enviando arquivo... ${p}%`));
      setBusy("Preparando para o celular...");
      await api(`/api/painel/items/${itemId}/model/import`, {
        body: { url, keep_scale: keepScale, width_cm: keepScale ? undefined : Number(width.replace(",", ".")) },
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy("");
  }

  async function action(body: any, label: string) {
    setErr("");
    setBusy(label);
    try {
      setInfo(await api(`/api/painel/items/${itemId}/model`, { method: "PUT", body }));
      onChanged?.();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy("");
  }

  async function remove() {
    setBusy("Removendo...");
    try {
      setInfo(await api(`/api/painel/items/${itemId}/model`, { method: "DELETE" }));
      usdzFor.current = "";
      onChanged?.();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy("");
  }

  useEffect(() => {
    if (!info?.model_published) return setQr("");
    const url = `${window.location.origin}/r/${restaurant.slug}?prato=${itemId}`;
    QRCode.toString(url, { type: "svg", margin: 1, width: 140 }).then(setQr).catch(() => {});
  }, [info?.model_published, restaurant.slug, itemId]);

  if (!info)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-56 rounded-2xl" />
        <div className="skeleton h-12 rounded-xl" />
      </div>
    );
  const st = info.model_status;
  const widthOk = Number(width.replace(",", ".")) >= 3 && Number(width.replace(",", ".")) <= 150;
  const has3d = (st === "revisar" || st === "pronto") && !!info.model_glb_url;
  const modes = [
    { id: "escanear" as const, label: "Escanear", icon: "video" },
    { id: "pronto" as const, label: "Modelo pronto", icon: "cube" },
    ...(info.meshyEnabled ? [{ id: "ia" as const, label: "IA por fotos", icon: "sparkle" }] : []),
    { id: "arquivo" as const, label: "Arquivo 3D", icon: "upload" },
  ];

  return (
    <div className="space-y-4">
      {!has3d && st !== "gerando" && st !== "processando" && (
        <div className="flex gap-3 rounded-2xl bg-ink p-4 text-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/12"><Icon name="scan" size={24} /></span>
          <div>
            <p className="font-display text-[16.5px] font-bold">O prato na mesa do cliente, em tamanho real</p>
            <p className="mt-0.5 text-[13.5px] text-white/75">
              Ele aponta o celular para a mesa e vê o {itemName} do tamanho exato que vai chegar. No iPhone e no Android, sem baixar aplicativo.
            </p>
          </div>
        </div>
      )}

      {(st === "gerando" || st === "processando") && (
        <div className="rounded-2xl bg-cream p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><Icon name="cube" size={26} /></span>
          <p className="mt-3 font-display text-[17px] font-bold">{st === "gerando" ? "A IA está montando o 3D do prato" : "Ajustando o tamanho real e deixando leve para o celular"}</p>
          <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={info.model_progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(6, info.model_progress)}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-black/55">Leva de 1 a 4 minutos. Pode fechar esta janela: o cardápio avisa quando terminar.</p>
          {info.warning && <p className="mt-2 text-[13px] text-amber-800">{info.warning}</p>}
        </div>
      )}

      {has3d && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-2xl p-3.5 ${info.model_published ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
            <Icon name={info.model_published ? "eye" : "alert"} size={20} />
            <p className="min-w-0 flex-1 text-[14.5px]">
              <b>{info.model_published ? "Os clientes já veem este 3D." : "Este 3D ainda não aparece para os clientes."}</b>{" "}
              {info.model_published ? "" : "Confira o tamanho e publique."}
            </p>
            {info.model_published ? (
              <button type="button" disabled={!!busy} onClick={() => action({ action: "publish", published: false }, "Ocultando...")} className="btn-ghost h-10 shrink-0">Ocultar</button>
            ) : (
              <button type="button" disabled={!!busy || usdzState === "gerando"} onClick={() => action({ action: "publish", published: true }, "Publicando...")} className="btn-primary h-10 shrink-0">
                Mostrar aos clientes
              </button>
            )}
          </div>

          <DishViewer model={{ glb: info.model_glb_url, usdz: info.model_usdz_url, dims: info.model_dims }} poster={image} alt={itemName} height={280} />

          <div className="rounded-2xl bg-cream p-4 text-[14px]">
            <p>
              <b>Confira o tamanho:</b> {formatDims(info.model_dims)}. Se não estiver igual ao prato de verdade, informe a largura certa.
            </p>
            <div className="mt-2.5 flex gap-2">
              <input className="input h-11" inputMode="decimal" aria-label="Largura correta em centímetros" placeholder={`Largura correta em cm (hoje: ${Math.round(info.model_width_cm)})`} value={newWidth} onChange={(e) => setNewWidth(e.target.value)} />
              <button
                type="button"
                disabled={!!busy || !(Number(newWidth.replace(",", ".")) >= 3)}
                onClick={() => action({ action: "resize", width_cm: Number(newWidth.replace(",", ".")) }, "Ajustando tamanho...")}
                className="btn-dark h-11 shrink-0"
              >
                Ajustar
              </button>
            </div>
            {(usdzState || info.model_usdz_url) && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-black/60">
                <Icon name={usdzState === "erro" ? "alert" : usdzState === "gerando" ? "clock" : "check"} size={14} stroke={2.2} />
                {usdzState === "gerando"
                  ? "Preparando a versão para iPhone..."
                  : usdzState === "erro"
                    ? "Não deu para preparar a versão para iPhone neste navegador. O iPhone gera na hora (demora um pouco mais)."
                    : "Pronto para iPhone e Android."}
              </p>
            )}
          </div>

          {qr && (
            <div className="flex items-center gap-4 rounded-2xl bg-cream p-3.5">
              <div className="w-24 shrink-0 rounded-xl bg-white p-1.5" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="text-[14px] text-black/70">
                <b className="text-ink">Teste no seu celular.</b> Aponte a câmera para este QR, toque em “Ver na minha mesa” e compare com o prato de verdade.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!rescan && (
              <button type="button" disabled={!!busy} onClick={() => { setRescan(true); setMode("escanear"); }} className="btn-ghost">
                <Icon name="video" size={17} /> Escanear de novo
              </button>
            )}
            <button type="button" disabled={!!busy} onClick={() => setAskRemove(true)} className="btn-ghost text-red-700">
              <Icon name="trash" size={17} /> Remover 3D
            </button>
          </div>
        </div>
      )}

      {(st === "nenhum" || st === "erro" || rescan) && (
        <div className="space-y-4">
          {st === "erro" && <Notice tone="error">Não deu certo: {info.model_error || "erro desconhecido"}. Tente de novo abaixo.</Notice>}

          {modes.length > 1 && (
            <div className="flex rounded-xl bg-black/[0.05] p-1 text-[13.5px] font-semibold" role="tablist">
              {modes.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 ${mode === m.id ? "bg-white shadow-sm" : "text-black/55"}`}>
                  <Icon name={m.icon} size={16} />
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {mode === "escanear" ? (
            <div className="space-y-3">
              <ol className="grid gap-2 text-[14px] sm:grid-cols-3">
                {[
                  ["Pegue uma folha A4 em branco", "Sulfite comum, sem imprimir. É a régua do escâner."],
                  ["Coloque ao lado do prato", "A um palmo, em mesa bem iluminada. Mesa branca? Ponha um pano escuro embaixo."],
                  ["Aponte e dê uma volta", "O celular guia, tira as fotos sozinho e o 3D sai na hora."],
                ].map(([t, d], i) => (
                  <li key={t} className="rounded-xl bg-cream p-3">
                    <span className="tnum grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] font-bold text-white">{i + 1}</span>
                    <b className="mt-2 block">{t}</b>
                    <span className="text-[13px] text-black/60">{d}</span>
                  </li>
                ))}
              </ol>
              {!scan ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => startScan(onPhone)} className="btn-primary h-12 flex-1 text-[15px]">
                    <Icon name="video" size={18} />
                    {onPhone ? "Escanear agora neste celular" : "Escanear com o celular"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-2xl bg-cream p-4 sm:flex-row">
                  <div className="w-40 shrink-0 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: scan.qr }} />
                  <div className="text-[14px]">
                    <p className="font-display text-[16.5px] font-bold">Aponte a câmera do celular para o QR</p>
                    <p className="mt-1 text-black/65">O escâner abre no navegador do celular, sem senha. O link vale 3 horas. Quando você salvar, o 3D aparece aqui sozinho.</p>
                    <a href={scan.url} target="_blank" className="mt-2 inline-block text-[13.5px] font-semibold underline">Abrir neste aparelho</a>
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-black/60">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-brand" /> Aguardando o escaneamento...
                    </p>
                  </div>
                </div>
              )}
              {onPhone && !scan && (
                <button type="button" onClick={() => startScan(false)} className="w-full text-center text-[13.5px] font-semibold text-black/55 underline">
                  Prefiro usar outro celular (mostrar QR)
                </button>
              )}
            </div>
          ) : mode === "pronto" ? (
            <TemplatePicker
              itemId={itemId}
              itemName={itemName}
              onDone={async () => {
                await load();
                setRescan(false);
                onChanged?.();
              }}
            />
          ) : mode === "ia" ? (
            <div className="space-y-3">
              <p className="text-[14px] text-black/65">
                Tire de 1 a 4 fotos do prato <b>montado como é servido</b>: uma de frente (45°), uma de cima e, se puder, dos lados. Luz boa, fundo liso e o prato inteiro na foto.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt="" className="aspect-square w-full rounded-xl object-cover" />
                    <button type="button" aria-label="Remover foto" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow">
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-black/20 text-center text-[12.5px] font-semibold text-black/55 hover:border-ink">
                    <span>
                      <Icon name="camera" size={20} className="mx-auto mb-1" />
                      foto {photos.length + 1}
                    </span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                )}
              </div>
              <WidthField value={width} onChange={setWidth} />
              <button type="button" onClick={generate} disabled={!!busy || !photos.length || !widthOk} className="btn-primary h-12 w-full text-[15px]">
                {busy || "Gerar 3D com IA"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-black/65">
                Já tem o prato escaneado em outro aplicativo (<b>Polycam</b>, <b>Scaniverse</b>, <b>KIRI Engine</b>)? Exporte em <b>GLB</b> e envie aqui.
              </p>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-black/20 p-3.5 text-[14px] hover:border-ink">
                <Icon name="upload" size={22} />
                <span className="min-w-0 flex-1 truncate font-semibold">{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : "Escolher arquivo .glb"}</span>
                <input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <label className="flex items-start gap-2.5 text-[14px]">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#172033]" checked={keepScale} onChange={(e) => setKeepScale(e.target.checked)} />
                <span>O arquivo já está no tamanho real (escaneado com iPhone Pro / LiDAR)</span>
              </label>
              {!keepScale && <WidthField value={width} onChange={setWidth} />}
              <button type="button" onClick={importFile} disabled={!!busy || !file || (!keepScale && !widthOk)} className="btn-primary h-12 w-full text-[15px]">
                {busy || "Enviar e preparar"}
              </button>
            </div>
          )}
        </div>
      )}

      {busy && has3d && <p className="text-center text-[13.5px] text-black/55" role="status">{busy}</p>}
      {err && <Notice tone="error">{err}</Notice>}

      {askRemove && (
        <Confirm
          title="Remover o 3D deste prato?"
          text="O prato continua no cardápio, só deixa de aparecer na mesa pela câmera. Você pode escanear de novo quando quiser."
          confirm="Remover 3D"
          danger
          onCancel={() => setAskRemove(false)}
          onConfirm={() => { setAskRemove(false); remove(); }}
        />
      )}
    </div>
  );
}

function WidthField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor="largura-real">Largura real do prato ou travessa (cm)</label>
      <input id="largura-real" className="input" inputMode="decimal" placeholder="Ex.: 28" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="mt-1.5 text-[13px] text-black/55">Meça com uma régua a parte mais larga, contando o prato. É isso que garante o tamanho real na mesa.</p>
    </div>
  );
}

function guessTemplate(name: string): TemplateKind | null {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bacai\b/.test(n)) return "acai";
  if (/marmit|quentinha|prato feito|\bpf\b/.test(n)) return "marmita";
  if (/pizza/.test(n) && !/broto|fatia/.test(n)) return "pizza-caixa";
  if (/hamb|burg|\bx[- ]?(salada|egg|bacon|tudo|burger|queijo|frango|calabresa)\b|lanche/.test(n)) return "hamburguer";
  return null;
}

/** Modelo pronto: o dono escolhe pizza na caixa, açaí no copo ou marmita e digita a medida da embalagem. */
function TemplatePicker({ itemId, itemName, onDone }: { itemId: string; itemName: string; onDone: () => Promise<void> }) {
  const [kind, setKind] = useState<TemplateKind>(() => guessTemplate(itemName) ?? "pizza-caixa");
  const [w, setW] = useState("");
  const [d, setD] = useState("");
  const [h, setH] = useState("");
  const [ml, setMl] = useState("500");
  const [sabor, setSabor] = useState(() => guessVariant(guessTemplate(itemName) ?? "pizza-caixa", itemName));
  const pick = (k: TemplateKind) => { setKind(k); setSabor(guessVariant(k, itemName)); };
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function create() {
    setErr("");
    setBusy(true);
    try {
      const body = kind === "acai" ? { kind, ml } : kind === "pizza-caixa" ? { kind, sabor, w, d: d || w } : kind === "hamburguer" ? { kind, sabor, w: w || "11" } : { kind, w, d, h };
      await api(`/api/painel/items/${itemId}/model/template`, { body });
      await onDone();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }
  const field = (id: string, label: string, v: string, set: (s: string) => void, ph: string) => (
    <div className="flex-1">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} className="input pr-10" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder={ph} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-black/55">cm</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-black/65">Sem escanear: escolha o modelo e informe a medida da embalagem. O 3D sai no tamanho certo em poucos segundos.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Modelo pronto">
        {(Object.keys(TEMPLATES) as TemplateKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => pick(k)} className={`overflow-hidden rounded-2xl bg-white text-left ring-1 transition-shadow ${kind === k ? "ring-2 ring-ink" : "ring-black/10 hover:ring-black/25"}`}>
            <img src={TEMPLATES[k].image} alt="" className="aspect-square w-full bg-[#efe9e0] object-cover" />
            <span className="block px-2.5 py-2 text-[13.5px] font-bold leading-tight">{TEMPLATES[k].label}</span>
          </button>
        ))}
      </div>
      <p className="text-[13.5px] text-black/60">{TEMPLATES[kind].desc}</p>

      {(kind === "pizza-caixa" || kind === "hamburguer") && (
        <div>
          <p className="label">{kind === "pizza-caixa" ? "Sabor" : "Lanche"}</p>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={kind === "pizza-caixa" ? "Sabor da pizza" : "Tipo de lanche"}>
            {(kind === "pizza-caixa" ? PIZZA_FLAVORS : BURGER_TYPES).map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={sabor === f.id} onClick={() => setSabor(f.id)} className={`w-[92px] shrink-0 snap-start overflow-hidden rounded-xl bg-white text-left ring-1 ${sabor === f.id ? "ring-2 ring-ink" : "ring-black/10"}`}>
                <img src={variantImage(kind, f.id)} alt="" loading="lazy" className="aspect-square w-full bg-[#efe9e0] object-cover" />
                <span className="block px-2 py-1.5 text-[12.5px] font-semibold leading-tight">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {kind === "hamburguer" && (
        <div className="flex max-w-56 gap-3">
          {field("tpl-w", "Largura do pão", w, setW, "11")}
        </div>
      )}
      {kind === "pizza-caixa" && (
        <div className="flex gap-3">
          {field("tpl-w", "Largura da caixa", w, setW, "35")}
          {field("tpl-d", "Comprimento (se diferente)", d, setD, w || "35")}
        </div>
      )}
      {kind === "marmita" && (
        <div className="flex gap-3">
          {field("tpl-w", "Largura", w, setW, "20")}
          {field("tpl-d", "Comprimento", d, setD, "14")}
          {field("tpl-h", "Altura", h, setH, "5")}
        </div>
      )}
      {kind === "acai" && (
        <div>
          <p className="label">Tamanho do copo</p>
          <div className="flex flex-wrap gap-2">
            {ACAI_SIZES.map((s) => (
              <button key={s} type="button" aria-pressed={!other && ml === String(s)} onClick={() => { setOther(false); setMl(String(s)); }} className={`h-11 rounded-full px-4 text-[14.5px] font-semibold ${!other && ml === String(s) ? "bg-ink text-white" : "bg-black/[0.06] text-black/75"}`}>
                {s} ml
              </button>
            ))}
            <button type="button" aria-pressed={other} onClick={() => { setOther(true); setMl(""); }} className={`h-11 rounded-full px-4 text-[14.5px] font-semibold ${other ? "bg-ink text-white" : "bg-black/[0.06] text-black/75"}`}>Outro</button>
          </div>
          {other && (
            <div className="mt-2 max-w-40">
              <label className="label" htmlFor="tpl-ml">Quantos ml?</label>
              <input id="tpl-ml" className="input" inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ""))} placeholder="350" />
            </div>
          )}
        </div>
      )}
      {kind !== "acai" && <p className="text-[13px] text-black/55">{kind === "hamburguer" ? "Meça o pão de um lado ao outro, com uma régua. Se não souber, deixe 11 cm (o tamanho mais comum)." : "Meça a embalagem por fora, com uma régua ou fita métrica."}</p>}
      {err && <Notice tone="error">{err}</Notice>}
      <button type="button" onClick={create} disabled={busy} className="btn-primary h-12 w-full">
        {busy ? "Criando o 3D..." : "Criar o 3D"}
      </button>
    </div>
  );
}
