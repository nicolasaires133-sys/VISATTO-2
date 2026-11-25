"use client";
// Visualizador 3D + "ver na mesa" (realidade aumentada) usando o <model-viewer> do Google.
// - Android: WebXR no Chrome (dentro do navegador) ou Google Scene Viewer
// - iPhone/iPad: câmera própria pelo Variant Launch (App Clip), se houver a chave; senão AR Quick Look com USDZ
// - ar-scale="fixed": o prato aparece no TAMANHO REAL e o cliente não consegue aumentar/diminuir
// - ar-placement="floor": apoia em superfícies horizontais (a mesa)
import { useEffect, useRef, useState } from "react";
import { formatDims } from "@/lib/client";
import Icon from "@/components/Icon";
import { isIOS, prepareIosXr, type IosXr } from "@/lib/iosAr";
import { readable } from "@/lib/color";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": any;
    }
  }
}

export type DishModel = { glb: string; usdz?: string; dims?: { w: number; d: number; h: number } | null };

function inAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter/i.test(navigator.userAgent);
}
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

let loader: Promise<unknown> | null = null;
export function loadModelViewer() {
  // no iPhone, o SDK do Variant Launch precisa entrar antes do model-viewer (ele vê a câmera na hora em que carrega)
  if (!loader) loader = prepareIosXr().then(() => import("@google/model-viewer")).catch((e) => ((loader = null), Promise.reject(e)));
  return loader;
}

export default function DishViewer({
  model,
  poster,
  alt,
  color = "#E4572E",
  height = 300,
  onEvent,
  showArButton = true,
  hideDims = false,
  hideHint = false,
  background,
  dark = false,
  orbit = "25deg 62deg 94%",
  arTitle,
  arSubtitle,
  arAction,
  onArAction,
  quickOpen = false,
  autoOpen = false,
}: {
  model: DishModel;
  poster?: string;
  alt: string;
  color?: string;
  height?: number | string;
  onEvent?: (type: "view3d" | "ar") => void;
  showArButton?: boolean;
  hideDims?: boolean;
  hideHint?: boolean;
  /** fundo do palco do 3D (padrão: porcelana clara) */
  background?: string;
  /** textos de carregamento claros, para fundo escuro */
  dark?: boolean;
  /** enquadramento inicial da câmera */
  orbit?: string;
  /** faixa embaixo da câmera do iPhone: nome, preço e um botão (ex.: "Adicionar ao pedido") */
  arTitle?: string;
  arSubtitle?: string;
  arAction?: string;
  onArAction?: () => void;
  /** o botão abre a câmera direto, sem a janela de dicas */
  quickOpen?: boolean;
  /** tenta abrir a câmera sozinho assim que o prato carrega (página do App Clip) */
  autoOpen?: boolean;
}) {
  color = readable(color);
  const ref = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [canAR, setCanAR] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [arMsg, setArMsg] = useState("");
  const [tips, setTips] = useState(false);
  const [touched, setTouched] = useState(false);
  const [qr, setQr] = useState("");
  // câmera aberta (WebXR): enquanto procura a mesa, o prato fica escondido e aparece um círculo de bolinhas
  const [arSearching, setArSearching] = useState(false);
  const [iosXr, setIosXr] = useState<IosXr | null>(null);
  const autoTried = useRef(false);
  const logged = useRef(false);
  const onArActionRef = useRef(onArAction);
  onArActionRef.current = onArAction;

  useEffect(() => {
    let alive = true;
    prepareIosXr().then((r) => alive && setIosXr(r));
    loadModelViewer()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onLoad = () => {
      setLoaded(true);
      setCanAR(Boolean(el.canActivateAR));
      // o modo de AR é escolhido de forma assíncrona; confere de novo em seguida
      for (const ms of [300, 1000, 2500]) timers.push(setTimeout(() => setCanAR(Boolean(el.canActivateAR)), ms));
      if (!logged.current) {
        logged.current = true;
        onEvent?.("view3d");
      }
    };
    const onProgress = (e: any) => setProgress(Math.round((e.detail?.totalProgress ?? 0) * 100));
    const onError = () => setFailed(true);
    // Esconde o prato (transparente) até ele pousar na mesa; o carregamento de bolinhas fica na tela nesse tempo.
    // Sem isso, o prato fica "voando" e apagado na frente da câmera enquanto o celular procura a superfície.
    const fades: ReturnType<typeof setTimeout>[] = [];
    const setAlpha = (k: number) => {
      for (const m of el.model?.materials ?? []) {
        const pbr = m.pbrMetallicRoughness;
        if (!m.__orig) m.__orig = { f: [...pbr.baseColorFactor], mode: m.getAlphaMode?.() ?? "OPAQUE" };
        const f = m.__orig.f;
        if (k >= 1) {
          pbr.setBaseColorFactor(f);
          m.setAlphaMode?.(m.__orig.mode);
          delete m.__orig;
        } else {
          m.setAlphaMode?.("BLEND");
          pbr.setBaseColorFactor([f[0], f[1], f[2], f[3] * k]);
        }
      }
    };
    // Mostra o prato inteiro de uma vez (tamanho real, sem ficar apagado), só depois que ele assentou na mesa.
    const reveal = (delay: number) => {
      fades.forEach(clearTimeout);
      fades.length = 0;
      fades.push(setTimeout(() => { setAlpha(1); setArSearching(false); }, delay));
    };
    const onAr = (e: any) => {
      const s = e.detail?.status;
      if (s === "failed") {
        setArSearching(false);
        setAlpha(1);
        setArMsg("Não foi possível abrir a câmera. Confira se o navegador tem permissão para usar a câmera.");
      }
      if (s === "session-started") {
        setArMsg("");
        try {
          setAlpha(0);
          setArSearching(true);
        } catch {
          setArSearching(false);
        }
      }
      if (s === "object-placed") {
        try { reveal(400); } catch { setArSearching(false); }
      }
      if (s === "not-presenting") {
        setArSearching(false);
        fades.forEach(clearTimeout);
        try { setAlpha(1); } catch {}
      }
    };
    el.addEventListener("load", onLoad);
    el.addEventListener("progress", onProgress);
    el.addEventListener("error", onError);
    el.addEventListener("ar-status", onAr);
    const onCam = (e: any) => e.detail?.source === "user-interaction" && setTouched(true);
    el.addEventListener("camera-change", onCam);
    const onQL = () => onArActionRef.current?.();
    el.addEventListener("quick-look-button-tapped", onQL);
    if (el.loaded) onLoad();
    return () => {
      timers.forEach(clearTimeout);
      fades.forEach(clearTimeout);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("error", onError);
      el.removeEventListener("ar-status", onAr);
      el.removeEventListener("camera-change", onCam);
      el.removeEventListener("quick-look-button-tapped", onQL);
    };
  }, [ready, onEvent]);

  // iPhone no Safari: abre o App Clip do Variant Launch numa página só do prato, com a câmera própria
  const launchIos = iosXr?.status === "launch-required" && Boolean(iosXr.getLaunchUrl);
  function openAR() {
    const el = ref.current;
    if (launchIos) {
      setTips(false);
      onEvent?.("ar");
      const q = new URLSearchParams({ glb: model.glb, n: (arTitle || alt).slice(0, 80) });
      if (model.usdz) q.set("usdz", model.usdz);
      if (model.dims) q.set("d", `${model.dims.w},${model.dims.d},${model.dims.h}`);
      const target = `${window.location.origin}/ar?${q.toString()}`;
      try {
        window.location.href = iosXr!.getLaunchUrl!(target);
        return;
      } catch {}
    }
    if (!el?.canActivateAR) return;
    setTips(false);
    onEvent?.("ar");
    try {
      const r = el.activateAR();
      if (r && typeof r.catch === "function") r.catch(() => setArMsg("Não foi possível abrir a câmera."));
    } catch {
      setArMsg("Não foi possível abrir a câmera.");
    }
  }

  const dims = formatDims(model.dims);
  const arOk = Boolean(canAR) || (launchIos && loaded);
  const askAR = () => (quickOpen ? openAR() : setTips(true));

  // página do App Clip: tenta abrir a câmera sozinho (se o navegador pedir um toque, o botão continua lá)
  useEffect(() => {
    if (!autoOpen || autoTried.current || !loaded || !canAR || launchIos) return;
    autoTried.current = true;
    const el = ref.current;
    try {
      const r = el?.activateAR?.();
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch {}
  }, [autoOpen, loaded, canAR, launchIos]);

  // no computador: um QR para abrir esta mesma página no celular e ver o prato na mesa
  useEffect(() => {
    if (!showArButton || isMobile()) return;
    let alive = true;
    import("qrcode")
      .then((Q) => Q.toDataURL(window.location.href, { margin: 1, width: 280 }))
      .then((u) => alive && setQr(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showArButton]);
  const inApp = inAppBrowser();
  const mobile = isMobile();
  const ios = isIOS();
  // No iPhone a câmera é a do próprio iOS (Quick Look). Dá para pôr uma faixa com o nome, o preço e um botão.
  const iosSrc = model.usdz
    ? arTitle
      ? `${model.usdz}#${new URLSearchParams({
          checkoutTitle: arTitle.slice(0, 60),
          checkoutSubtitle: (arSubtitle || "").slice(0, 60),
          ...(arAction ? { callToAction: arAction.slice(0, 30) } : {}),
        }).toString().replace(/\+/g, "%20")}`
      : model.usdz
    : undefined;

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl" style={{ height, background: background ?? "radial-gradient(115% 85% at 50% 36%, #ffffff 0%, #f2f2ef 42%, #dfdfd8 100%)" }}>
        {ready && !failed && (
          <model-viewer
            ref={ref}
            src={model.glb}
            ios-src={iosSrc}
            alt={alt}
            poster={poster || undefined}
            ar={true}
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            ar-placement="floor"
            xr-environment={true}
            camera-controls={true}
            touch-action="pan-y"
            interaction-prompt="none"
            auto-rotate={true}
            auto-rotate-delay="1500"
            rotation-per-second="18deg"
            camera-orbit={orbit}
            min-camera-orbit="auto 0deg auto"
            max-camera-orbit="auto 88deg auto"
            shadow-intensity="1"
            shadow-softness="0.9"
            environment-image="legacy"
            exposure="1"
            loading="eager"
            reveal="auto"
            style={{ width: "100%", height: "100%", background: "transparent", ["--poster-color" as any]: "transparent" }}
          >
            <div slot="progress-bar" />
            <div slot="ar-button" style={{ display: "none" }} />
            {arSearching && (
              <div className="ar-searching" role="status" aria-live="polite">
                <span className="ar-dots" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-26px)`, animationDelay: `${(i - 10) * 0.1}s` }} />
                  ))}
                </span>
                <p className="ar-searching-t">Carregando...</p>
                <p className="ar-searching-s">Aponte para a mesa e mova o celular devagar</p>
              </div>
            )}
          </model-viewer>
        )}
        {!loaded && !failed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-40">
            <div className={`h-1.5 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-black/10"}`}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(8, progress)}%`, background: color }} />
            </div>
            <p className={`mt-1 text-center text-[11px] ${dark ? "text-white/55" : "text-black/60"}`}>Carregando 3D...</p>
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-black/55">
            Não foi possível carregar o 3D deste prato.
          </div>
        )}
        {showArButton && loaded && arOk && (
          <button type="button" onClick={askAR} className="absolute bottom-3 right-3 z-[1] flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold text-white shadow-lg" style={{ background: color }}>
            <Icon name="scan" size={16} stroke={2.2} /> Ver na mesa
          </button>
        )}
        {loaded && !touched && !dark && !hideHint && !(showArButton && arOk) && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-black/70">
            <Icon name="rotate" size={14} />
            Gire com o dedo
          </span>
        )}
      </div>

      {dims && !hideDims && <p className="mt-2 text-center text-[13px] text-black/60">Tamanho real: {dims}</p>}

      {showArButton && loaded && (
        <div className="mt-3">
          {arOk ? (
            <button type="button" onClick={askAR} className="btn h-[52px] w-full text-[16px] text-white" style={{ background: "#172033" }}>
              <Icon name="scan" size={20} stroke={2} />
              Ver na minha mesa, em tamanho real
            </button>
          ) : inApp ? (
            <p className="rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">
              Para ver o prato na sua mesa, abra este cardápio no navegador do celular (toque nos três pontinhos e em “Abrir no navegador”).
            </p>
          ) : mobile ? (
            <p className="rounded-xl bg-black/5 p-3 text-center text-sm text-black/60">
              Para ver o prato na sua mesa, abra esta página no <b>Safari</b> (iPhone) ou no <b>Chrome</b> (Android). Aqui dá para girar o prato com o dedo.
            </p>
          ) : (
            <div className="flex items-center gap-4 rounded-xl bg-black/5 p-3 text-sm text-black/65">
              {qr && <img src={qr} alt="QR code para abrir no celular" className="h-24 w-24 shrink-0 rounded-lg bg-white p-1" />}
              <p>Aponte a câmera do celular para o QR e toque em <b>Ver na minha mesa</b>: o prato aparece em cima da sua mesa, no tamanho real.</p>
            </div>
          )}
          {arMsg && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{arMsg}</p>}
        </div>
      )}

      {tips && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-black/50 sm:place-items-center" onClick={() => setTips(false)}>
          <div onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white"><Icon name="scan" size={30} stroke={1.8} /></span>
            <h3 className="mt-3 text-center text-[21px] font-extrabold">Como ver o prato na mesa</h3>
            <ol className="mt-4 space-y-3 text-[14.5px]">
              {(launchIos
                ? [
                    "Vai aparecer um cartão da Apple embaixo da tela. Toque em Abrir (não instala nada).",
                    "Aponte a câmera para a mesa e mova o celular devagar enquanto as bolinhas giram.",
                    "O prato aparece pronto, no tamanho real, em cima da mesa. Arraste com o dedo para mudar de lugar.",
                  ]
                : ios && iosXr?.status !== "supported"
                ? [
                    "Antes de abrir, aponte o celular para o lugar da mesa onde o prato vai ficar.",
                    "Mova o celular devagar enquanto o iPhone reconhece a mesa. O prato aparece quando ela for encontrada.",
                    "Ficou no lugar errado? Arraste o prato com um dedo. Com dois dedos, você gira. O tamanho é o real.",
                  ]
                : [
                    "Aponte a câmera para a mesa, em um lugar livre e bem iluminado.",
                    "Mova o celular devagar enquanto as bolinhas giram: o prato aparece pronto, no tamanho real, quando a mesa for encontrada.",
                    "Arraste para mudar de lugar e gire com dois dedos. O tamanho é o real.",
                  ]
              ).map((t, i) => (
                <li key={i} className="flex gap-3"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: color }}>{i + 1}</b>{t}</li>
              ))}
            </ol>
            <button type="button" onClick={openAR} className="btn mt-5 h-[52px] w-full text-[16px] text-white" style={{ background: color }}>
              Abrir a câmera
            </button>
            <button type="button" onClick={() => setTips(false)} className="mt-2 w-full py-2 text-sm text-black/60">Agora não</button>
          </div>
        </div>
      )}
    </div>
  );
}
