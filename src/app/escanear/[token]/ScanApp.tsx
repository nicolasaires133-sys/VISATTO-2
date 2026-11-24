"use client";
// Escâner do Visatto: o dono aponta a câmera, dá uma volta no produto e o próprio celular monta o 3D em tamanho real,
// usando a folha com o marcador como régua. A captura é guiada ao vivo (LiveCapture); vídeo gravado, fotos e o modo
// manual de 2 fotos continuam como alternativas.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, glbToUsdz, setScanToken, uploadFile } from "@/lib/client";
import { calibrate, cameraCenter, heightOnVertical, pixelToPlane, project, viewElevation, type Camera, type Vec2 } from "@/lib/scan/geometry";
import { CARD_CM, MARKER_CM, SHEET, detectMarker } from "@/lib/scan/marker";
import { loadPhoto, sample, type Photo } from "@/lib/scan/photo";
import { PLATE_H, buildDish, type DishShape } from "@/lib/scan/builder";
import { framesFromPhotos, framesFromVideo, reconstructFromFrames, type Frame } from "@/lib/scan/video";
import LiveCapture from "./LiveCapture";
import { KINDS, profileFromName, type ProductProfile } from "@/lib/scan/profile";
import type { DishGuess, RecognizeFn, RecognizeOut } from "@/lib/scan/understand";
import { describeParts } from "@/lib/scan/pratos";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";

const DishViewer = dynamic(() => import("@/components/DishViewer"), { ssr: false });

type Ref = "marcador" | "cartao";
type Calib = { photo: Photo; corners: Vec2[]; cam: Camera; auto: boolean; focal: string };
type Outline = { cx: number; cy: number; a: number; b: number; rot: number }; // no plano z=0 da foto de cima (cm)
type Step = "inicio" | "processando" | "revisar" | "cima" | "contorno" | "lado" | "altura" | "extras" | "formato" | "pronto";

const STEPS: { id: Step; label: string }[] = [
  { id: "cima", label: "Foto de cima" },
  { id: "lado", label: "Foto de lado" },
  { id: "extras", label: "Mais fotos" },
  { id: "formato", label: "3D" },
];

export default function ScanApp({ token }: { token: string }) {
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState("");
  const [step, setStep] = useState<Step>("inicio");
  const [ref, setRef] = useState<Ref>("marcador");
  const [markerCm, setMarkerCm] = useState(String(MARKER_CM).replace(".", ","));
  const [top, setTop] = useState<Calib | null>(null);
  const [side, setSide] = useState<Calib | null>(null);
  const [extras, setExtras] = useState<{ photo: Photo; calib: Calib | null }[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [rect, setRect] = useState(false);
  const [height, setHeight] = useState(5);
  const [plate, setPlate] = useState(true);
  const [foodScale, setFoodScale] = useState(0.78);
  const [topRound, setTopRound] = useState(false);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; blob: Blob; dims: { w: number; d: number; h: number } } | null>(null);
  const [saved, setSaved] = useState<any>(null);
  const [manual, setManual] = useState<{ photo: Photo; corners: Vec2[]; which: "cima" | "lado" } | null>(null);
  const [recon, setRecon] = useState<{ found: number; total: number; used: number; markerCm: number; scaleSource: "folha" | "manual" | "padrao" | "folha-branca" } | null>(null);
  const [live, setLive] = useState(false); // câmera guiada aberta
  const [noCam, setNoCam] = useState(""); // a câmera guiada não abriu: mostra o caminho do vídeo comum
  const [markerEdited, setMarkerEdited] = useState(false); // o dono informou o tamanho do quadrado à mão
  const [note, setNote] = useState(""); // o que o dono diz que é o produto (ajuda a IA)
  const [profile, setProfile] = useState<ProductProfile | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rec, setRec] = useState<RecognizeOut["rec"] | null>(null); // o que a IA reconheceu pela imagem
  const [partesVistas, setPartesVistas] = useState<DishGuess[]>([]);
  const [askOpen, setAskOpen] = useState(false); // painel "Não é isso? Qual é o prato?"
  const [typed, setTyped] = useState("");
  const [research, setResearch] = useState<{ profile: ProductProfile; entendi: string; fonte: string; link?: string } | null>(null);
  const [researching, setResearching] = useState(false);
  const framesRef = useRef<{ frames: Frame[]; kind: "aovivo" | "video" | "fotos" } | null>(null);
  const warmed = useRef(false);
  /** Acorda a IA no servidor assim que o escaneamento começa: quando os recortes ficarem prontos, ela já está carregada. */
  function warmAI() {
    if (warmed.current) return;
    warmed.current = true;
    api(`/api/scan/${token}/reconhecer`, { body: { aquecer: true } }).catch(() => { warmed.current = false; });
  }
  const [fix, setFix] = useState<{ w: string; h: string } | null>(null); // medidas corrigidas à mão
  const resultRef = useRef<any>(null);
  const reconRef = useRef<any>(null);
  useEffect(() => { reconRef.current = recon; }, [recon]);
  useEffect(() => { resultRef.current = result ? { dims: result.dims, size: result.blob.size, profile, warnings, blob: result.blob, rec, partes: partesVistas } : null; }, [result, profile, warnings, rec, partesVistas]);

  useEffect(() => {
    setScanToken(token);
    api(`/api/scan/${token}`).then(setInfo).catch((e) => setErr(e.message));
    return () => setScanToken(null);
  }, [token]);

  const refSize = useMemo(() => {
    if (ref === "cartao") return { w: CARD_CM.w, h: CARD_CM.h };
    const v = Number(markerCm.replace(",", "."));
    const s = v >= 5 && v <= 30 ? v : MARKER_CM;
    return { w: s, h: s };
  }, [ref, markerCm]);

  const doCalib = useCallback(
    (photo: Photo, corners: Vec2[], auto: boolean): Calib => {
      const { cam, focalSource } = calibrate({ corners, refW: refSize.w, refH: refSize.h, width: photo.width, height: photo.height, f35: photo.f35 });
      return { photo, corners, cam, auto, focal: focalSource };
    },
    [refSize]
  );

  // Altura do contorno marcado na foto de cima: borda do prato (≈1,8 cm) ou topo da comida
  const outlineZ = plate ? PLATE_H : Math.max(0.5, height * 0.9);

  /** Contorno convertido para a altura real em que ele está (corrige a perspectiva da foto de cima). */
  const realOutline = useMemo(() => {
    if (!outline || !top) return null;
    const C = cameraCenter(top.cam);
    const k = Math.max(0.5, (C[2] - outlineZ) / C[2]);
    return {
      cx: C[0] + (outline.cx - C[0]) * k,
      cy: C[1] + (outline.cy - C[1]) * k,
      a: outline.a * k,
      b: outline.b * k,
      rot: outline.rot,
    };
  }, [outline, top, outlineZ]);

  // Gancho de teste automatizado (só com ?teste=1 no endereço): permite posicionar o contorno e a altura
  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("teste")) return;
    (window as any).__visattoScan = {
      setRealOutline: (o: Outline, z: number) => {
        if (!top) return false;
        const C = cameraCenter(top.cam);
        const k = Math.max(0.5, (C[2] - z) / C[2]);
        setOutline({ cx: C[0] + (o.cx - C[0]) / k, cy: C[1] + (o.cy - C[1]) / k, a: o.a / k, b: o.b / k, rot: o.rot });
        return true;
      },
      setHeight,
      setFoodScale,
      capture: (files: File[], kind: "video" | "fotos") => fromCapture(files, kind),
      recon: () => reconRef.current,
      result: () => resultRef.current,
      state: () => ({ realOutline, height, top: !!top, side: !!side }),
      // conferência de que as imagens guardadas para o "Refazer" não são alteradas pela montagem
      framesChecksum: () => {
        const f = framesRef.current;
        if (!f) return null;
        let h = 0;
        for (const fr of f.frames) { const d = fr.data.data; for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0; }
        return h;
      },
    };
  }, [top, side, realOutline, height]);

  async function onPhoto(file: File | undefined, which: "cima" | "lado" | "extra") {
    if (!file) return;
    setErr("");
    setBusy("Lendo a foto...");
    try {
      const photo = await loadPhoto(file);
      if (which === "extra") {
        const c = detectMarker(photo.data);
        setExtras((x) => [...x, { photo, calib: c && ref === "marcador" ? doCalib(photo, c, true) : null }].slice(0, 3));
        setBusy("");
        return;
      }
      const corners = ref === "marcador" ? detectMarker(photo.data) : null;
      if (!corners) {
        // posição inicial dos cantos para o ajuste manual: um retângulo no centro da foto
        const w = photo.width, h = photo.height, s = Math.min(w, h) * (ref === "cartao" ? 0.07 : 0.15);
        const r = ref === "cartao" ? CARD_CM.h / CARD_CM.w : 1;
        const guess: Vec2[] = [[w / 2 - s, h / 2 - s * r], [w / 2 + s, h / 2 - s * r], [w / 2 + s, h / 2 + s * r], [w / 2 - s, h / 2 + s * r]];
        setManual({ photo, corners: guess, which });
        if (ref === "marcador") setErr("Não encontrei o marcador nesta foto. Arraste os 4 pontos para os cantos do quadrado preto, ou tire outra foto com a folha inteira aparecendo.");
        setBusy("");
        return;
      }
      acceptCalib(doCalib(photo, corners, true), which);
    } catch (e: any) {
      setErr(e?.message || "Não foi possível ler a foto.");
    }
    setBusy("");
  }

  function acceptCalib(c: Calib, which: "cima" | "lado") {
    const elev = viewElevation(c.cam);
    if (which === "cima") {
      if (elev < 45) {
        setErr(`Esta foto foi tirada muito de lado (${Math.round(elev)}°). Para a foto de cima, segure o celular acima do prato, olhando para baixo.`);
        return;
      }
      setTop(c);
      setOutline(null);
      setStep("contorno");
    } else {
      if (elev > 60) {
        setErr(`Esta foto ficou muito de cima (${Math.round(elev)}°). Para a foto de lado, abaixe o celular até ver bem a lateral do prato (uns 30°).`);
        return;
      }
      setSide(c);
      setStep("altura");
    }
    setManual(null);
  }

  async function generate() {
    if (!realOutline || !top || !side) return;
    setErr("");
    setResult(null);
    setBusy("Montando o 3D...");
    setProgress(0);
    try {
      const shape: DishShape = { ...realOutline, rect, height, plate, foodScale, topRound };
      const shots = [top, side, ...extras.filter((e) => e.calib).map((e) => e.calib!)].map((c) => ({ data: c.photo.data, cam: c.cam }));
      const res = await buildDish(shape, shots, (msg, p) => {
        setBusy(msg);
        setProgress(Math.round(p * 100));
      });
      setResult({ url: URL.createObjectURL(res.glb), blob: res.glb, dims: res.dims });
    } catch (e: any) {
      setErr(e?.message || "Não foi possível montar o 3D.");
    }
    setBusy("");
  }

  /** Vídeo ou fotos → 3D automático, no próprio celular. */
  async function fromCapture(files: File[], kind: "video" | "fotos") {
    if (!files.length) return;
    await run((stage) => (kind === "video" ? framesFromVideo(files[0], stage("Lendo o vídeo", 0, 0.15)) : framesFromPhotos(files, stage("Lendo as fotos", 0, 0.15))), kind);
  }

  /** Quadros (da câmera guiada, de um vídeo ou de fotos) → 3D. */
  async function run(
    getFrames: (stage: (msg: string, base: number, span: number) => (m: string, p: number) => void) => Promise<Frame[]>,
    kind: "aovivo" | "video" | "fotos",
    forced?: ProductProfile,
  ) {
    setErr("");
    setResult(null);
    setRecon(null);
    setProfile(forced ?? null);
    setWarnings([]);
    setRec(null);
    setPartesVistas([]);
    setAskOpen(false);
    setResearch(null);
    warmAI();
    setStep("processando");
    setProgress(0);
    // mantém a tela ligada enquanto o 3D é montado (se o aparelho permitir)
    let lock: any = null;
    try {
      lock = await (navigator as any).wakeLock?.request("screen");
    } catch {}
    const stage = (msg: string, base: number, span: number) => (m: string, p: number) => {
      setBusy(m || msg);
      setProgress(Math.round((base + p * span) * 100));
    };
    try {
      const frames = await getFrames(stage);
      framesRef.current = { frames, kind };
      // primeira ideia pelo nome do item; durante a montagem a IA olha o prato e corrige (ou o dono já disse o que é)
      const prof = forced ?? profileFromName(info.item.name, note);
      setProfile(prof);
      // a IA de visão roda no servidor do próprio site (grátis); sem resposta a tempo, segue sem ela
      const recognize: RecognizeFn = async (req) => {
        try {
          return await Promise.race([
            api<RecognizeOut>(`/api/scan/${token}/reconhecer`, { body: { ...req, note } }),
            new Promise<never>((_, no) => setTimeout(() => no(new Error("demorou")), 15000)),
          ]);
        } catch {
          return null;
        }
      };
      const res = await reconstructFromFrames(
        frames,
        (m, p) => {
          // pesos aproximados de cada etapa na barra
          const w: Record<string, [number, number]> = {
            // pesos medidos: quanto tempo cada etapa leva de verdade (a barra anda no ritmo real)
            "Procurando a folha em cada quadro": [0.15, 0.06],
            "Calculando a forma e a altura": [0.21, 0.42],
            "Reconhecendo o prato": [0.63, 0.08],
            "Preparando a pintura": [0.71, 0.06],
            "Separando a comida do prato": [0.77, 0.04],
            "Reconhecendo cada parte do prato": [0.81, 0.06],
            "Pintando o modelo com as imagens": [0.87, 0.11],
            "Gerando o arquivo 3D": [0.98, 0.02],
          };
          const [b, sp] = w[m] ?? [0.15, 0.85];
          setBusy(m);
          setProgress(Math.round((b + p * sp) * 100));
        },
        // sem medida informada à mão, o tamanho da impressão é conferido sozinho pela folha A4
        markerEdited && ref === "marcador" ? refSize.w : null,
        prof,
        "foto",
        { recognize, keepProfile: !!forced, onDish: (p) => setProfile(p) },
      );
      setResult({ url: URL.createObjectURL(res.glb), blob: res.glb, dims: res.dims });
      setRecon({ found: res.found, total: res.total, used: res.used, markerCm: res.markerCm, scaleSource: res.scaleSource });
      setWarnings(res.warnings);
      setProfile(res.profile ?? prof);
      setRec(res.rec);
      setPartesVistas(res.partes);
      // sem certeza (ou o nome do item não bate com a imagem): já abre a pergunta "qual é o prato?"
      const p = res.rec?.escolha?.p ?? 0;
      if (!forced && res.rec && (res.rec.conflito || (res.rec.fonte !== "nome" && p < 0.2))) setAskOpen(true);
      setFix(null);
      setStep("revisar");
    } catch (e: any) {
      setErr(e?.message || (kind === "aovivo" ? "Não foi possível montar o 3D desta vez. Tente de novo, com mais luz." : "Não foi possível montar o 3D com este vídeo."));
      setStep("inicio");
    }
    lock?.release?.().catch(() => {});
    setBusy("");
  }

  /** O dono digitou (ou escolheu) o nome do prato: o Visatto pesquisa o que é. */
  async function pesquisar(nome: string) {
    const n = nome.trim();
    if (n.length < 2) return;
    setResearching(true);
    setResearch(null);
    try {
      setResearch(await api(`/api/scan/${token}/pesquisar`, { body: { nome: n } }));
    } catch (e: any) {
      setErr(e?.message || "Não consegui pesquisar agora.");
    }
    setResearching(false);
  }

  /** Monta o 3D de novo com as mesmas imagens, já sabendo o que é o prato (não precisa escanear de novo). */
  function redo(p: ProductProfile) {
    const f = framesRef.current;
    if (!f) {
      setErr("As imagens deste escaneamento não estão mais guardadas. Escaneie de novo e escolha o prato na conferência.");
      return;
    }
    run(async () => f.frames, f.kind, p);
  }

  async function save(publish: boolean) {
    if (!result || !info) return;
    setErr("");

    try {
      setBusy("Enviando o 3D... 0%");
      const glbUrl = await uploadFile(result.blob, `${info.item.id}-escaneado.glb`, (p) => setBusy(`Enviando o 3D... ${p}%`));
      setBusy("Preparando para o celular...");
      const fw = Number(fix?.w.replace(",", ".")), fh = Number(fix?.h.replace(",", "."));
      const target =
        fix && fw > 1 && fh > 0.5 ? { w: fw, d: Math.round(result.dims.d * (fw / result.dims.w) * 10) / 10, h: fh } : undefined;
      await api(`/api/painel/items/${info.item.id}/model/import`, { body: { url: glbUrl, keep_scale: true, source: "escaner", target_dims: target } });
      let m = await api(`/api/painel/items/${info.item.id}/model`);
      setBusy("Preparando a versão para iPhone...");
      try {
        const usdz = await glbToUsdz(m.model_glb_url);
        const usdzUrl = await uploadFile(usdz, `${info.item.id}.usdz`);
        m = await api(`/api/painel/items/${info.item.id}/model`, { method: "PUT", body: { action: "usdz", url: usdzUrl } });
      } catch {
        // o iPhone ainda consegue gerar na hora; não bloqueia
      }
      if (publish) m = await api(`/api/painel/items/${info.item.id}/model`, { method: "PUT", body: { action: "publish", published: true } });
      setSaved(m);
      setStep("pronto");
      // salvo: as imagens guardadas para o "Refazer o 3D" (bastante memória) não são mais necessárias
      framesRef.current = null;
    } catch (e: any) {
      setErr(e?.message || "Não foi possível salvar.");
    }
    setBusy("");
  }

  async function generateAI() {
    if (!info || !top || !side || !realOutline) return;
    setErr("");
    setBusy("Enviando fotos para a IA...");
    try {
      const shots = [top, side, ...extras.map((e) => e.calib || { photo: e.photo, cam: null as any, corners: [], auto: false, focal: "" })];
      const images = shots.slice(0, 4).map((c) => withoutSheet(c.photo, c.cam, refSize, ref));
      const dims = { w: realOutline.a * 2, d: realOutline.b * 2, h: Math.max(height, plate ? PLATE_H : 0) };
      await api(`/api/painel/items/${info.item.id}/model/generate`, { body: { images, target_dims: dims } });
      setSaved({ ai: true });
      setStep("pronto");
    } catch (e: any) {
      setErr(e?.message || "Não foi possível iniciar a IA.");
    }
    setBusy("");
  }

  if (err && !info)
    return (
      <Center>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white"><Icon name="clock" size={28} /></span>
        <p className="mt-4 font-display text-[20px] font-bold">{err}</p>
        <p className="mt-2 text-[14.5px] text-black/60">Abra o prato no painel e toque em “Escanear” para gerar um link novo.</p>
        <a href="/painel/cardapio" className="btn-ghost mt-5">Ir para o painel</a>
      </Center>
    );
  if (!info) return <Center><div className="skeleton mx-auto h-14 w-14 rounded-2xl" /><p className="mt-4 text-black/55">Abrindo o escâner...</p></Center>;
  const back = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("volta") === "painel";
  const color = info.restaurant.primary_color || "#E4572E";
  const stepIdx = STEPS.findIndex((s) => s.id === step || (s.id === "cima" && step === "contorno") || (s.id === "lado" && step === "altura"));

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-white pb-28">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Logo size={26} />
        <span className="min-w-0 truncate text-[14px] font-semibold text-black/60">{info.item.name}</span>
      </header>
      {!["inicio", "pronto", "processando", "revisar"].includes(step) && (
        <div className="flex gap-1 px-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-brand" : "bg-black/10"}`} />
              <p className={`mt-1 text-[10px] font-semibold ${i === stepIdx ? "text-ink" : "text-black/40"}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        {step === "inicio" && (
          <>
            <div className="pt-2">
              <h1 className="text-[28px] font-extrabold leading-[1.1]">Escanear {info.item.name}</h1>
              <p className="mt-2 text-[15.5px] leading-relaxed text-black/65">
                Aponte a câmera e dê uma volta no produto. O celular avisa o que fazer, tira as fotos sozinho e monta o 3D em tamanho real.
              </p>
            </div>

            <CaptureIllustration />

            <ol className="space-y-2.5">
              {[
                ["Uma folha A4 em branco ao lado do produto", "Folha de sulfite comum, sem imprimir nada, a um palmo do prato. Em mesa branca, ponha um pano escuro embaixo."],
                ["Toque em Começar e aponte a câmera", "A folha inteira e o produto aparecendo juntos na tela."],
                ["Dê a volta até o anel fechar", "Devagar, celular meio inclinado. Leva uns 20 segundos e termina sozinho."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 rounded-2xl bg-cream p-3.5">
                  <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{i + 1}</span>
                  <span>
                    <b className="block text-[15px]">{t}</b>
                    <span className="text-[13.5px] text-black/60">{d}</span>
                  </span>
                </li>
              ))}
            </ol>


            {noCam && (
              <div className="space-y-3 rounded-2xl bg-amber-50 p-4 text-amber-950" role="alert">
                <p className="flex gap-2 text-[14.5px]"><Icon name="alert" size={17} className="mt-0.5" /><span>{noCam} Dá para fazer do mesmo jeito gravando um vídeo de 15 a 20 segundos em volta do produto.</span></p>
                <label className="btn-dark h-12 w-full cursor-pointer">
                  <Icon name="video" size={19} />
                  Gravar um vídeo
                  <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setRef("marcador"); fromCapture([f], "video"); } }} />
                </label>
              </div>
            )}

            {/* botão principal sempre à vista */}
            <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-xl bg-gradient-to-t from-white via-white to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
              <button className="btn-primary h-14 w-full text-[16.5px] shadow-lg shadow-black/10" onClick={() => { setErr(""); setNoCam(""); setRef("marcador"); setLive(true); warmAI(); }}>
                <Icon name="camera" size={21} />
                Começar
              </button>
            </div>

            <details className="rounded-2xl p-4 text-[14px] ring-1 ring-black/10">
              <summary className="cursor-pointer font-semibold text-black/70">Ajustes e outros jeitos de escanear</summary>
              <div className="mt-4 space-y-5">
                <div>
                  <label className="label" htmlFor="oque">O que é este produto? (opcional)</label>
                  <input id="oque" className="input h-12" placeholder={`Ex.: ${info.item.name}, em prato raso`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
                  <p className="mt-1.5 text-[13px] text-black/55">Diga o que é e em que vem (prato, taça, copo de vidro, tábua). Ajuda a medir melhor.</p>
                </div>
                <div>
                  <p className="label">Marcador impresso (opcional)</p>
                  <p className="mb-2 text-[13.5px] text-black/60">
                    Não precisa. Se a folha em branco se confundir com a mesa, dá para{" "}
                    <a href="/marcador" target="_blank" className="font-semibold underline">imprimir um marcador</a>: o Visatto encontra ele sozinho.
                  </p>
                  <p className="label">Tamanho da impressão</p>
                  {!markerEdited ? (
                    <p className="text-[13.5px] text-black/60">
                      O Visatto confere sozinho pela folha A4, não precisa de régua.{" "}
                      <button className="font-semibold underline" onClick={() => setMarkerEdited(true)}>Informar à mão</button>
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <input id="marcador-cm" aria-label="Lado do quadrado preto em centímetros" className="input h-12 w-24 text-center font-bold" inputMode="decimal" value={markerCm} onChange={(e) => { setRef("marcador"); setMarkerCm(e.target.value); }} />
                        <span className="text-[15px] font-semibold">cm</span>
                        <button className="ml-auto text-[13.5px] font-semibold underline" onClick={() => { setMarkerEdited(false); setMarkerCm(String(MARKER_CM)); }}>Voltar ao automático</button>
                      </div>
                      <p className="mt-1.5 text-[13px] text-black/55">Meça o lado do quadrado preto com uma régua. Impresso em 100%, dá 15 cm.</p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="label">Outros jeitos</p>
                  <label className="btn-ghost h-12 w-full cursor-pointer">
                    <Icon name="video" size={18} />
                    Usar um vídeo (gravar ou escolher)
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setRef("marcador"); fromCapture([f], "video"); } }} />
                  </label>
                  <label className="btn-ghost h-12 w-full cursor-pointer">
                    <Icon name="image" size={18} />
                    Escolher fotos (10 a 30, em volta do produto)
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) { setRef("marcador"); fromCapture(fs, "fotos"); } }} />
                  </label>
                </div>
                <div>
                  <p className="label">Modo manual com 2 fotos</p>
                  <p className="text-black/60">Use um cartão de banco como referência (ou o marcador) e marque o contorno e a altura com o dedo.</p>
                  <div className="mt-3 space-y-2">
                    <Choice active={ref === "cartao"} onClick={() => setRef("cartao")} title="Cartão de banco" text="Você marca os 4 cantos dele nas fotos." />
                    <Choice active={ref === "marcador"} onClick={() => setRef("marcador")} title="Marcador impresso" text="O Visatto encontra sozinho." />
                    <button className="btn-ghost w-full" onClick={() => setStep("cima")}>Começar o modo manual</button>
                  </div>
                </div>
              </div>
            </details>

            {live && (
              <LiveCapture
                onCancel={() => setLive(false)}
                onUnavailable={(reason) => { setLive(false); setNoCam(reason); }}
                onDone={(frames) => { setLive(false); run(async () => frames, "aovivo"); }}
              />
            )}
          </>
        )}

        {step === "processando" && (
          <div className="grid min-h-[62dvh] place-items-center text-center">
            <div className="w-full">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-ink text-white"><Icon name="cube" size={34} stroke={1.6} className="animate-pulse" /></span>
              <h2 className="mt-5 text-[24px] font-extrabold">Montando o 3D no seu celular</h2>
              <p className="mt-1.5 text-[15px] text-black/60" role="status">{busy || "Começando..."}</p>
              <div className="mx-auto mt-5 h-2.5 w-64 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${Math.max(3, progress)}%` }} />
              </div>
              <p className="tnum mt-2.5 text-[13.5px] text-black/50">{progress}% · costuma levar de 20 segundos a 1 minuto (em celulares mais simples, um pouco mais)</p>
              {profile && (
                <p className="mx-auto mt-4 w-fit max-w-full truncate rounded-full bg-cream px-3.5 py-1.5 text-[13px] font-semibold text-black/70">
                  {profile.produto} · {profile.recipiente || KINDS[profile.kind].label}
                </p>
              )}
              <p className="mt-6 text-[13px] text-black/45">Deixe esta tela aberta até terminar.</p>
            </div>
          </div>
        )}

        {step === "revisar" && result && (() => {
          const fw = fix ? Number(fix.w.replace(",", ".")) || result.dims.w : result.dims.w;
          const dims = fix
            ? { w: fw, d: Math.round(result.dims.d * (fw / result.dims.w) * 10) / 10, h: Number(fix.h.replace(",", ".")) || result.dims.h }
            : result.dims;
          return (
          <>
            <div className="pt-2">
              <h2 className="text-[26px] font-extrabold leading-tight">Confira o 3D</h2>
              <p className="mt-1 text-[15px] text-black/60">Gire com o dedo e compare as medidas com o produto de verdade.</p>
            </div>
            <RecognitionCard
              rec={rec}
              profile={profile}
              partes={partesVistas}
              itemName={info.item.name}
              open={askOpen}
              onOpen={setAskOpen}
              typed={typed}
              onTyped={setTyped}
              research={research}
              researching={researching}
              onResearch={pesquisar}
              onRedo={redo}
              busy={!!busy}
            />
            <DishViewer model={{ glb: result.url, dims }} alt={info.item.name} color={color} height={340} showArButton={false} />
            <div className="grid grid-cols-3 divide-x divide-black/10 rounded-2xl bg-cream p-3.5 text-center">
              <Dim label="Largura" v={dims.w} />
              <Dim label="Profundidade" v={dims.d} />
              <Dim label="Altura" v={dims.h} />
            </div>
            {warnings.map((w, i) => (
              <p key={i} className="flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-950"><Icon name="alert" size={17} className="mt-0.5" /><span>{w}</span></p>
            ))}
            {profile?.transparente && (
              <p className="flex gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-[14px] text-sky-950">
                <Icon name="info" size={17} className="mt-0.5" />
                <span><b>Vidro transparente:</b> a câmera enxerga o que está dentro, mas às vezes não a borda do copo. Se a altura ficou menor que a do copo de verdade, corrija abaixo.</span>
              </p>
            )}
            {!fix ? (
              <button className="btn-ghost h-11 w-full" onClick={() => setFix({ w: fmt(result.dims.w), h: fmt(result.dims.h) })}>
                <Icon name="ruler" size={17} /> Medidas erradas? Corrigir com a régua
              </button>
            ) : (
              <div className="space-y-2.5 rounded-2xl p-4 text-[14px] ring-1 ring-black/12">
                <p className="font-semibold">Meça o produto de verdade com uma régua:</p>
                <div className="flex gap-2.5">
                  <label className="flex-1 font-semibold text-black/70">Largura (cm)<input className="input mt-1.5 h-12 text-center font-bold" inputMode="decimal" value={fix.w} onChange={(e) => setFix({ ...fix, w: e.target.value })} /></label>
                  <label className="flex-1 font-semibold text-black/70">Altura (cm)<input className="input mt-1.5 h-12 text-center font-bold" inputMode="decimal" value={fix.h} onChange={(e) => setFix({ ...fix, h: e.target.value })} /></label>
                </div>
                <p className="text-[13px] text-black/55">O 3D é ajustado para essas medidas quando você salvar.</p>
              </div>
            )}
            {recon?.scaleSource === "padrao" && !fix && (
              <p className="flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-950">
                <Icon name="alert" size={17} className="mt-0.5" />
                <span>Não deu para conferir o tamanho da impressão pela folha (ela precisa aparecer inteira, sobre uma mesa mais escura que o papel). Considerei a impressão em 100%. Compare a largura acima com a do produto de verdade.</span>
              </p>
            )}
            {recon && (
              <p className="text-center text-[12.5px] text-black/45" data-escala={recon.scaleSource}>
                {recon.used} ângulos usados no 3D
                {recon.scaleSource === "folha" ? ` · tamanho conferido pela folha A4${Math.abs(recon.markerCm - MARKER_CM) > 0.05 ? ` (impressão em ${Math.round((recon.markerCm / MARKER_CM) * 100)}%)` : ""}` : recon.scaleSource === "manual" ? ` · quadrado de ${fmt(recon.markerCm)} cm informado por você` : recon.scaleSource === "folha-branca" ? " · tamanho medido pela folha A4" : ""}
              </p>
            )}
            <div className="space-y-2">
              <button className="btn-primary h-12 w-full text-base" disabled={!!busy} onClick={() => save(true)}>{busy || "Salvar e mostrar para os clientes"}</button>
              <button className="btn-ghost w-full" disabled={!!busy} onClick={() => save(false)}>Salvar sem publicar</button>
              <button className="w-full py-2 text-sm font-semibold text-black/55 underline" disabled={!!busy} onClick={() => { setResult(null); setStep("inicio"); }}>
                Não ficou bom? Escanear de novo
              </button>
            </div>
          </>
          );
        })()}

        {step === "cima" && !manual && (
          <ShotCard
            n={1}
            title="Foto de cima"
            text={`Segure o celular uns 50 cm acima, olhando para baixo, com o prato inteiro e ${ref === "marcador" ? "o quadrado preto" : "o cartão"} aparecendo.`}
            illustration="cima"
            onFile={(f) => onPhoto(f, "cima")}
            busy={busy}
          />
        )}

        {step === "lado" && !manual && (
          <ShotCard
            n={2}
            title="Foto de lado"
            text={`Abaixe o celular até uns 30° acima da mesa (como alguém sentado olhando o prato), de 40 a 60 cm de distância, com o prato e ${ref === "marcador" ? "o quadrado" : "o cartão"} aparecendo.`}
            illustration="lado"
            onFile={(f) => onPhoto(f, "lado")}
            busy={busy}
          />
        )}

        {manual && (
          <CornerEditor
            photo={manual.photo}
            corners={manual.corners}
            isCard={ref === "cartao"}
            onCancel={() => {
              setManual(null);
              setErr("");
            }}
            onDone={(c) => {
              setErr("");
              acceptCalib(doCalib(manual.photo, c, false), manual.which);
            }}
          />
        )}

        {step === "contorno" && top && (
          <>
            <StepTitle n={1} title="Marque o contorno do prato" text="A foto foi “endireitada” como se fosse vista de cima. Arraste o círculo até a borda de fora do prato." />
            <div className="flex rounded-xl bg-black/5 p-1 text-sm font-semibold">
              <button onClick={() => setRect(false)} className={`flex-1 rounded-lg py-2 ${!rect ? "bg-white shadow" : "text-black/50"}`}>⚪ Redondo</button>
              <button onClick={() => setRect(true)} className={`flex-1 rounded-lg py-2 ${rect ? "bg-white shadow" : "text-black/50"}`}>▭ Retangular</button>
            </div>
            <TopEditor calib={top} outline={outline} onChange={setOutline} rect={rect} refSize={refSize} />
            {outline && realOutline && (
              <p className="text-center text-sm">
                <b>{fmt(realOutline.a * 2)} cm</b> de largura × <b>{fmt(realOutline.b * 2)} cm</b> de profundidade
              </p>
            )}
            <SmallNote calib={top} />
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setStep("cima")}>Refazer foto</button>
              <button className="btn-primary flex-1" disabled={!outline} onClick={() => setStep("lado")}>Continuar</button>
            </div>
          </>
        )}

        {step === "altura" && side && realOutline && (
          <>
            <StepTitle n={2} title="Ajuste a altura" text="O contorno do prato aparece desenhado na foto. Arraste o ponto laranja até o ponto mais alto da comida." />
            <SideEditor calib={side} outline={realOutline} rect={rect} height={height} onHeight={setHeight} />
            <div className="flex items-center justify-center gap-3">
              <button className="btn-ghost h-10 w-10 p-0 text-lg" onClick={() => setHeight((h) => Math.max(0.5, +(h - 0.2).toFixed(1)))}>−</button>
              <p className="text-center text-sm">Altura: <b className="text-lg">{fmt(height)} cm</b></p>
              <button className="btn-ghost h-10 w-10 p-0 text-lg" onClick={() => setHeight((h) => Math.min(60, +(h + 0.2).toFixed(1)))}>+</button>
            </div>
            {ref === "cartao" && (
              <button
                className="w-full rounded-xl bg-black/[0.03] p-2 text-xs font-semibold text-black/60"
                onClick={() => {
                  const c = side.corners;
                  setSide(doCalib(side.photo, [c[2], c[3], c[0], c[1]], false));
                }}
              >
                O desenho não ficou em cima do prato? Toque aqui para virar o cartão
              </button>
            )}
            <label className="flex items-center gap-2 rounded-xl bg-black/[0.03] p-3 text-sm">
              <input type="checkbox" checked={plate} onChange={(e) => setPlate(e.target.checked)} />
              A comida está num prato raso (o contorno que marquei é a borda do prato)
            </label>
            <SmallNote calib={side} />
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setStep("lado")}>Refazer foto</button>
              <button className="btn-primary flex-1" onClick={() => setStep("extras")}>Continuar</button>
            </div>
          </>
        )}

        {step === "extras" && (
          <>
            <StepTitle n={3} title="Mais fotos (opcional)" text="Fotos dos outros lados deixam o 3D mais fiel por trás. Tire do lado oposto e das laterais, com o marcador aparecendo." />
            <div className="grid grid-cols-3 gap-2">
              {extras.map((e, i) => (
                <div key={i} className="relative">
                  <img src={e.photo.dataUrl} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  <span className={`absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.calib ? "bg-emerald-500 text-white" : "bg-amber-400"}`}>
                    {e.calib ? "com medida" : "só textura IA"}
                  </span>
                  <button onClick={() => setExtras(extras.filter((_, j) => j !== i))} aria-label="Remover foto" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow"><Icon name="close" size={13} /></button>
                </div>
              ))}
              {extras.length < 3 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-black/15 text-center text-xs text-black/50">
                  <Icon name="camera" size={20} className="mx-auto mb-1" />Adicionar
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0], "extra")} />
                </label>
              )}
            </div>
            <button className="btn-primary h-12 w-full" onClick={() => { setStep("formato"); setTimeout(generate, 50); }}>
              {extras.length ? "Montar o 3D" : "Pular e montar o 3D"}
            </button>
          </>
        )}

        {step === "formato" && (
          <>
            <StepTitle n={4} title="Confira o 3D" text="Gire com o dedo. Se algo não ficou parecido, ajuste abaixo e toque em Atualizar." />
            {result ? (
              <DishViewer model={{ glb: result.url, dims: result.dims }} alt={info.item.name} color={color} height={320} showArButton={false} />
            ) : (
              <div className="grid h-[320px] place-items-center rounded-2xl bg-black/5 text-center text-sm text-black/60">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><Icon name="cube" size={26} className="animate-pulse" /></span>
                  <p className="mt-2 font-semibold">{busy || "Montando..."}</p>
                  <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-brand" style={{ width: `${progress}%` }} /></div>
                </div>
              </div>
            )}
            <div className="card space-y-3 p-4 text-sm">
              <div className="flex rounded-xl bg-black/5 p-1 font-semibold">
                <button onClick={() => setTopRound(false)} className={`flex-1 rounded-lg py-2 ${!topRound ? "bg-white shadow" : "text-black/50"}`}>Topo reto</button>
                <button onClick={() => setTopRound(true)} className={`flex-1 rounded-lg py-2 ${topRound ? "bg-white shadow" : "text-black/50"}`}>Topo arredondado</button>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={plate} onChange={(e) => setPlate(e.target.checked)} /> Servido em prato raso</label>
              {plate && (
                <label className="block">
                  Tamanho da comida dentro do prato: <b>{Math.round(foodScale * 100)}%</b>
                  <input type="range" min={40} max={100} value={Math.round(foodScale * 100)} onChange={(e) => setFoodScale(Number(e.target.value) / 100)} className="mt-1 w-full" />
                </label>
              )}
              <button className="btn-ghost w-full" disabled={!!busy} onClick={generate}><Icon name="rotate" size={16} /> Atualizar 3D</button>
            </div>
            {result && (
              <div className="space-y-2">
                <button className="btn-primary h-12 w-full text-base" disabled={!!busy} onClick={() => save(true)}>{busy || "Salvar e mostrar para os clientes"}</button>
                <button className="btn-ghost w-full" disabled={!!busy} onClick={() => save(false)}>Salvar sem publicar</button>
                {info.meshyEnabled && (
                  <button className="w-full py-2 text-sm font-semibold text-black/55 underline" disabled={!!busy} onClick={generateAI}>
                    Prefiro uma versão mais detalhada feita por IA (com estas medidas)
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {step === "pronto" && (
          <Center>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-leaf text-white"><Icon name="check" size={36} stroke={2.4} /></span>
            <h2 className="mt-5 text-[26px] font-extrabold leading-tight">{saved?.ai ? "A IA está montando o 3D" : "Prato escaneado!"}</h2>
            <p className="mt-2 text-[15.5px] leading-relaxed text-black/65">
              {saved?.ai
                ? "Em 1 a 4 minutos ele aparece no painel, já com as medidas do escaneamento. Confira e publique por lá."
                : saved?.model_published
                  ? "O 3D já está no cardápio. Abra o prato, toque em “Ver na minha mesa” e compare com o prato de verdade."
                  : "O 3D foi salvo, mas ainda não aparece para os clientes. Publique quando quiser pelo painel."}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              {saved?.model_published && (
                <a className="btn-primary h-[52px] text-[16px]" href={`/r/${info.restaurant.slug}?prato=${info.item.id}`}>
                  <Icon name="scan" size={19} /> Ver na minha mesa
                </a>
              )}
              {back ? (
                <a className="btn-ghost h-12" href="/painel/cardapio">Voltar ao painel e escanear outro prato</a>
              ) : (
                <p className="text-[13.5px] text-black/50">Pode fechar esta tela. Para escanear outro prato, gere um novo QR no painel.</p>
              )}
            </div>
          </Center>
        )}

        {err && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-[14.5px] text-red-800">
            <Icon name="alert" size={18} className="mt-0.5" />
            <span>{err}</span>
          </p>
        )}
        {busy && step !== "formato" && step !== "processando" && <p className="text-center text-sm text-black/50">{busy}</p>}
      </div>
    </main>
  );
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[60dvh] place-items-center px-6 text-center"><div>{children}</div></div>;
}

function Choice({ active, onClick, title, text }: { active: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button onClick={onClick} className={`w-full rounded-xl p-3 text-left ring-2 ${active ? "bg-brand/5 ring-brand" : "ring-black/10"}`}>
      <p className="font-bold">{active ? "● " : "○ "}{title}</p>
      <p className="text-sm text-black/60">{text}</p>
    </button>
  );
}

function Dim({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-black/45">{label}</p>
      <p className="text-lg font-extrabold">{fmt(v)} cm</p>
    </div>
  );
}

function CaptureIllustration() {
  // a folha ao lado do prato e o caminho do celular dando a volta
  return (
    <svg viewBox="0 0 340 176" className="w-full rounded-2xl bg-cream" role="img" aria-label="Uma folha A4 em branco ao lado do prato, e o celular dando uma volta em torno dos dois">
      {/* mesa */}
      <ellipse cx="170" cy="104" rx="150" ry="56" fill="#e9e3d8" />
      {/* folha A4 em branco */}
      <polygon points="70,103 134,96 141,128 71,137" fill="#fff" stroke="#bdb6a8" strokeWidth="1.4" />
      {/* prato */}
      <ellipse cx="204" cy="108" rx="56" ry="19" fill="#fff" stroke="#cfc9bd" strokeWidth="1.2" />
      <ellipse cx="204" cy="106" rx="40" ry="12.5" fill="#f1ede5" />
      <path d="M172 104c0-21 14-33 32-33s32 12 32 33Z" fill="#E4572E" />
      <ellipse cx="204" cy="104" rx="32" ry="7.5" fill="#c9461f" />
      <path d="M186 88q5-10 15-13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      {/* caminho do celular */}
      <ellipse cx="170" cy="100" rx="138" ry="62" fill="none" stroke="#1d1a16" strokeWidth="1.8" strokeDasharray="2 7" strokeLinecap="round" />
      <polygon points="301,95 315,95 308,108" fill="#1d1a16" />
      {/* celular */}
      <g transform="rotate(-18 46 62)">
        <rect x="33" y="40" width="26" height="46" rx="6" fill="#1d1a16" />
        <rect x="36.5" y="45" width="19" height="32" rx="2.5" fill="#57534e" />
        <circle cx="46" cy="81.5" r="1.8" fill="#57534e" />
      </g>
      <text x="170" y="20" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#57534e">uma volta devagar, até o anel fechar</text>
    </svg>
  );
}

function StepTitle({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand">Passo {n}</p>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-black/60">{text}</p>
    </div>
  );
}

function SmallNote({ calib }: { calib: Calib }) {
  const elev = Math.round(viewElevation(calib.cam));
  const C = cameraCenter(calib.cam);
  return (
    <p className="text-center text-[11px] text-black/40">
      Referência {calib.auto ? "encontrada automaticamente" : "marcada à mão"} • câmera a {Math.round(Math.hypot(C[0], C[1], C[2]))} cm, {elev}° acima da mesa •
      foco {calib.focal === "exif" ? "da câmera" : calib.focal === "foto" ? "calculado pela foto" : "estimado"}
    </p>
  );
}

function ShotCard({ n, title, text, illustration, onFile, busy }: { n: number; title: string; text: string; illustration: "cima" | "lado"; onFile: (f?: File) => void; busy: string }) {
  return (
    <>
      <StepTitle n={n} title={title} text={text} />
      <div className="grid place-items-center rounded-2xl bg-black/[0.03] py-6">
        {illustration === "cima" ? (
          <svg width="200" height="140" viewBox="0 0 200 140"><rect x="40" y="95" width="120" height="8" rx="2" fill="#c9a27a" /><ellipse cx="85" cy="92" rx="34" ry="6" fill="#eee" stroke="#999" /><rect x="125" y="89" width="22" height="5" fill="#222" /><rect x="70" y="8" width="30" height="50" rx="5" fill="#1d1a16" /><path d="M85 60 L85 82" stroke="#E4572E" strokeWidth="2" strokeDasharray="4 3" /><text x="105" y="40" fontSize="11" fill="#555">~50 cm</text></svg>
        ) : (
          <svg width="200" height="140" viewBox="0 0 200 140"><rect x="40" y="105" width="140" height="8" rx="2" fill="#c9a27a" /><ellipse cx="120" cy="100" rx="34" ry="6" fill="#eee" stroke="#999" /><rect x="105" y="85" width="30" height="14" rx="4" fill="#e7a25a" /><rect x="150" y="99" width="22" height="4" fill="#222" /><rect x="18" y="40" width="12" height="40" rx="3" fill="#1d1a16" transform="rotate(-60 24 60)" /><path d="M35 62 L100 92" stroke="#E4572E" strokeWidth="2" strokeDasharray="4 3" /><text x="40" y="45" fontSize="11" fill="#555">~30°</text></svg>
        )}
      </div>
      <label className={`btn-primary h-12 w-full cursor-pointer text-base ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <Icon name="camera" size={20} /> {busy || "Tirar a foto"}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
    </>
  );
}

// ---------- editores ----------

function useCanvasSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function drag(e: React.PointerEvent, el: HTMLElement, onMove: (x: number, y: number) => void) {
  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const move = (ev: PointerEvent) => onMove(ev.clientX - rect.left, ev.clientY - rect.top);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  onMove(e.clientX - rect.left, e.clientY - rect.top);
}

function Handle({ x, y, color = "#E4572E", label, onDown, big }: { x: number; y: number; color?: string; label?: string; onDown: (e: React.PointerEvent) => void; big?: boolean }) {
  const s = big ? 30 : 24;
  return (
    <div
      onPointerDown={onDown}
      className="absolute grid touch-none place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-lg"
      style={{ left: x - s / 2, top: y - s / 2, width: s, height: s, background: color }}
    >
      {label}
    </div>
  );
}

function CornerEditor({ photo, corners, isCard, onDone, onCancel }: { photo: Photo; corners: Vec2[]; isCard: boolean; onDone: (c: Vec2[]) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const W = useCanvasSize(box);
  const [c, setC] = useState<Vec2[]>(corners);
  const [zoom, setZoom] = useState<{ i: number } | null>(null);
  // área da foto mostrada (permite ampliar em volta da referência)
  const [view, setView] = useState({ x0: 0, y0: 0, w: photo.width, h: photo.height });
  const k = W / view.w;
  const toS = (p: Vec2): Vec2 => [(p[0] - view.x0) * k, (p[1] - view.y0) * k];
  const toI = (x: number, y: number): Vec2 => [view.x0 + x / k, view.y0 + y / k];

  useEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.drawImage(photo.canvas, view.x0, view.y0, view.w, view.h, 0, 0, W, view.h * k);
    g.strokeStyle = "#E4572E";
    g.lineWidth = 2;
    g.beginPath();
    c.forEach((p, i) => {
      const [x, y] = toS(p);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.closePath();
    g.stroke();
  }, [c, W, k, photo, view]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomIn() {
    const xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 120) * 2.2;
    const w = Math.min(photo.width, span), h = Math.min(photo.height, span * (photo.height / photo.width));
    setView({ x0: Math.max(0, Math.min(photo.width - w, cx - w / 2)), y0: Math.max(0, Math.min(photo.height - h, cy - h / 2)), w, h });
  }

  // tocar fora dos pontos leva os 4 pontos para lá (para achar a referência rápido)
  function moveAll(e: React.PointerEvent) {
    if ((e.target as HTMLElement).tagName !== "CANVAS") return;
    const rect = box.current!.getBoundingClientRect();
    const [x, y] = toI(e.clientX - rect.left, e.clientY - rect.top);
    const mx = c.reduce((a, p) => a + p[0], 0) / 4, my = c.reduce((a, p) => a + p[1], 0) / 4;
    setC(c.map((p) => [p[0] + x - mx, p[1] + y - my] as Vec2));
  }

  const zoomed = view.w < photo.width;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold">Marque os 4 cantos {isCard ? "do cartão" : "do quadrado preto"}</h2>
        <p className="text-sm text-black/60">
          Toque onde está {isCard ? "o cartão" : "o quadrado"} para trazer os pontos, amplie e arraste cada ponto até o canto exato.{" "}
          {isCard ? "O lado comprido do cartão vai do ponto 1 ao 2." : "O ponto 1 é o canto de cima à esquerda do quadrado."}
        </p>
      </div>
      <div ref={box} onPointerDown={moveAll} className="relative w-full touch-none select-none overflow-hidden rounded-xl">
        <canvas ref={cv} width={W} height={view.h * k} className="block" />
        {c.map((p, i) => {
          const [x, y] = toS(p);
          return (
            <Handle
              key={i}
              x={x}
              y={y}
              label={String(i + 1)}
              onDown={(e) => {
                e.stopPropagation();
                setZoom({ i });
                drag(e, box.current!, (sx, sy) => setC((old) => old.map((q, j) => (j === i ? toI(sx, sy) : q))));
                const end = () => {
                  setZoom(null);
                  window.removeEventListener("pointerup", end);
                };
                window.addEventListener("pointerup", end);
              }}
            />
          );
        })}
        {zoom && <Loupe photo={photo} at={c[zoom.i]} />}
      </div>
      <button className="btn-ghost w-full" onClick={() => (zoomed ? setView({ x0: 0, y0: 0, w: photo.width, h: photo.height }) : zoomIn())}>
        {zoomed ? "Ver a foto inteira" : `Ampliar ${isCard ? "o cartão" : "o quadrado"}`}
      </button>
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={onCancel}>Tirar outra foto</button>
        <button className="btn-primary flex-1" onClick={() => onDone(c)}>Confirmar cantos</button>
      </div>
    </div>
  );
}

function Loupe({ photo, at }: { photo: Photo; at: Vec2 }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    const s = 60;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 120, 120);
    g.drawImage(photo.canvas, at[0] - s / 2, at[1] - s / 2, s, s, 0, 0, 120, 120);
    g.strokeStyle = "#E4572E";
    g.beginPath();
    g.moveTo(60, 0); g.lineTo(60, 120); g.moveTo(0, 60); g.lineTo(120, 60);
    g.stroke();
  }, [photo, at]);
  return <canvas ref={ref} width={120} height={120} className="pointer-events-none absolute right-2 top-2 rounded-full border-4 border-white shadow-xl" />;
}

/** Vista "endireitada" (de cima) da foto, com o contorno do prato editável. */
function TopEditor({ calib, outline, onChange, rect, refSize }: { calib: Calib; outline: Outline | null; onChange: (o: Outline) => void; rect: boolean; refSize: { w: number; h: number } }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const W = useCanvasSize(box);

  // área da mesa visível: projeta os cantos da foto no plano da mesa
  const view = useMemo(() => {
    const { photo, cam } = calib;
    const pts = [[0, 0], [photo.width, 0], [photo.width, photo.height], [0, photo.height], [photo.width / 2, photo.height / 2]]
      .map((p) => pixelToPlane(cam, p as Vec2, 0))
      .filter(Boolean) as number[][];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const clamp = (v: number) => Math.max(-90, Math.min(90, v));
    const minX = clamp(Math.min(...xs)), maxX = clamp(Math.max(...xs)), minY = clamp(Math.min(...ys)), maxY = clamp(Math.max(...ys));
    const size = Math.max(maxX - minX, maxY - minY);
    return { x0: (minX + maxX) / 2 - size / 2, y0: (minY + maxY) / 2 + size / 2, size };
  }, [calib]);

  const N = 720; // resolução da imagem endireitada
  const rectified = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d")!;
    const out = g.createImageData(N, N);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const X = view.x0 + ((i + 0.5) / N) * view.size;
        const Y = view.y0 - ((j + 0.5) / N) * view.size;
        const [u, v] = project(calib.cam, [X, Y, 0]);
        const col = sample(calib.photo.data, u, v);
        const o = (j * N + i) * 4;
        if (col) { out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255; }
        else { out.data[o] = 235; out.data[o + 1] = 230; out.data[o + 2] = 222; out.data[o + 3] = 255; }
      }
    g.putImageData(out, 0, 0);
    return c;
  }, [calib, view]);

  const toPx = (X: number, Y: number): Vec2 => [((X - view.x0) / view.size) * W, ((view.y0 - Y) / view.size) * W];
  const toW = (x: number, y: number): Vec2 => [view.x0 + (x / W) * view.size, view.y0 - (y / W) * view.size];

  // contorno inicial: perto do centro da foto, ao lado do marcador
  useEffect(() => {
    if (outline) return;
    const c = pixelToPlane(calib.cam, [calib.photo.width / 2, calib.photo.height / 2], 0);
    let cx = c ? c[0] : 20, cy = c ? c[1] : 0;
    if (Math.hypot(cx, cy) < 14) cx += 18; // não começar em cima do marcador
    onChange({ cx, cy, a: 12, b: 12, rot: 0 });
  }, [outline, calib, onChange]);

  useEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.drawImage(rectified, 0, 0, W, W);
    // referência (confirma que a medida está certa)
    g.strokeStyle = "rgba(46,160,90,.9)";
    g.lineWidth = 2;
    const rw = refSize.w / 2, rh = refSize.h / 2;
    const q = [toPx(-rw, rh), toPx(rw, rh), toPx(rw, -rh), toPx(-rw, -rh)];
    g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    if (!outline) return;
    g.strokeStyle = "#E4572E";
    g.lineWidth = 3;
    g.setLineDash([]);
    g.beginPath();
    for (let k = 0; k <= 96; k++) {
      const t = (k / 96) * Math.PI * 2;
      const n = rect ? 7 : 2;
      const c = Math.cos(t), s = Math.sin(t);
      const x = outline.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = outline.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      const X = outline.cx + x * Math.cos(outline.rot) - y * Math.sin(outline.rot);
      const Y = outline.cy + x * Math.sin(outline.rot) + y * Math.cos(outline.rot);
      const p = toPx(X, Y);
      k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.stroke();
  }, [rectified, outline, W, rect, refSize]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!outline) return <div ref={box} className="aspect-square w-full rounded-xl bg-black/5" />;
  const cr = Math.cos(outline.rot), sr = Math.sin(outline.rot);
  const center = toPx(outline.cx, outline.cy);
  const ha = toPx(outline.cx + outline.a * cr, outline.cy + outline.a * sr);
  const hb = toPx(outline.cx - outline.b * sr, outline.cy + outline.b * cr);
  const hr = toPx(outline.cx + (outline.a + 3) * Math.cos(outline.rot + 0.6), outline.cy + (outline.a + 3) * Math.sin(outline.rot + 0.6));
  const el = () => box.current!;
  return (
    <div ref={box} className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl">
      <canvas ref={cv} width={W} height={W} className="block" />
      <Handle x={center[0]} y={center[1]} label="✥" big onDown={(e) => drag(e, el(), (x, y) => { const [X, Y] = toW(x, y); onChange({ ...outline, cx: X, cy: Y }); })} />
      <Handle x={ha[0]} y={ha[1]} label="↔" onDown={(e) => drag(e, el(), (x, y) => {
        const [X, Y] = toW(x, y);
        const a = Math.max(2, (X - outline.cx) * cr + (Y - outline.cy) * sr);
        onChange(rect ? { ...outline, a } : { ...outline, a, b: outline.a === outline.b ? a : outline.b });
      })} />
      <Handle x={hb[0]} y={hb[1]} label="↕" onDown={(e) => drag(e, el(), (x, y) => {
        const [X, Y] = toW(x, y);
        onChange({ ...outline, b: Math.max(2, -(X - outline.cx) * sr + (Y - outline.cy) * cr) });
      })} />
      <Handle x={hr[0]} y={hr[1]} color="#1d1a16" label="⟳" onDown={(e) => drag(e, el(), (x, y) => {
        const [X, Y] = toW(x, y);
        onChange({ ...outline, rot: Math.atan2(Y - outline.cy, X - outline.cx) - 0.6 });
      })} />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold">
        Quadrado verde = referência medida
      </span>
    </div>
  );
}

/** Foto de lado com o "cilindro" do prato desenhado; o usuário ajusta só a altura. */
function SideEditor({ calib, outline, rect, height, onHeight }: { calib: Calib; outline: Outline; rect: boolean; height: number; onHeight: (h: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const W = useCanvasSize(box);
  const k = W / calib.photo.width;

  const ring = useCallback(
    (z: number) => {
      const pts: Vec2[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        const n = rect ? 7 : 2;
        const c = Math.cos(t), s = Math.sin(t);
        const x = outline.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y = outline.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
        const X = outline.cx + x * Math.cos(outline.rot) - y * Math.sin(outline.rot);
        const Y = outline.cy + x * Math.sin(outline.rot) + y * Math.cos(outline.rot);
        const p = project(calib.cam, [X, Y, z]);
        pts.push([p[0] * k, p[1] * k]);
      }
      return pts;
    },
    [outline, rect, calib, k]
  );

  useEffect(() => {
    const g = cv.current?.getContext("2d");
    if (!g) return;
    g.drawImage(calib.photo.canvas, 0, 0, W, calib.photo.height * k);
    const base = ring(0), topR = ring(height);
    const line = (pts: Vec2[], color: string, w: number, dash: number[] = []) => {
      g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    };
    line(base, "rgba(255,255,255,.9)", 2, [6, 4]);
    line(topR, "#E4572E", 3);
    // laterais do "cilindro"
    const left = base.reduce((m, p, i) => (p[0] < base[m][0] ? i : m), 0);
    const right = base.reduce((m, p, i) => (p[0] > base[m][0] ? i : m), 0);
    for (const i of [left, right]) line([base[i], topR[i]], "rgba(228,87,46,.7)", 2);
    g.setLineDash([]);
  }, [calib, W, k, ring, height]);

  const topC = project(calib.cam, [outline.cx, outline.cy, height]);
  return (
    <div ref={box} className="relative w-full touch-none select-none overflow-hidden rounded-xl">
      <canvas ref={cv} width={W} height={calib.photo.height * k} className="block" />
      <Handle
        x={topC[0] * k}
        y={topC[1] * k}
        big
        label="↕"
        onDown={(e) =>
          drag(e, box.current!, (x, y) => {
            const h = heightOnVertical(calib.cam, [x / k, y / k], outline.cx, outline.cy);
            if (Number.isFinite(h)) onHeight(Math.round(Math.min(60, Math.max(0.5, h)) * 10) / 10);
          })
        }
      />
    </div>
  );
}

/** Copia da foto sem a folha do marcador (para a IA não "modelar" o papel junto). */
function withoutSheet(photo: Photo, cam: Camera | null, refSize: { w: number; h: number }, ref: Ref) {
  const c = document.createElement("canvas");
  const ks = Math.min(1, 1280 / Math.max(photo.width, photo.height));
  c.width = Math.round(photo.width * ks);
  c.height = Math.round(photo.height * ks);
  const g = c.getContext("2d")!;
  g.drawImage(photo.canvas, 0, 0, c.width, c.height);
  if (cam) {
    const s = refSize.w / MARKER_CM;
    const area = ref === "marcador"
      ? [[SHEET.left * s, SHEET.top * s], [SHEET.right * s, SHEET.top * s], [SHEET.right * s, SHEET.bottom * s], [SHEET.left * s, SHEET.bottom * s]]
      : [[-refSize.w / 2 - 1, refSize.h / 2 + 1], [refSize.w / 2 + 1, refSize.h / 2 + 1], [refSize.w / 2 + 1, -refSize.h / 2 - 1], [-refSize.w / 2 - 1, -refSize.h / 2 - 1]];
    const poly = area.map(([x, y]) => project(cam, [x, y, 0])).map(([u, v]) => [u * ks, v * ks]);
    // cor da mesa: média de um anel em volta da folha
    let r = 0, gg = 0, b = 0, n = 0;
    const cx = poly.reduce((a, p) => a + p[0], 0) / 4, cy = poly.reduce((a, p) => a + p[1], 0) / 4;
    for (const p of poly) {
      const x = Math.round(p[0] + (p[0] - cx) * 0.15), y = Math.round(p[1] + (p[1] - cy) * 0.15);
      if (x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
      const d = g.getImageData(x, y, 1, 1).data;
      r += d[0]; gg += d[1]; b += d[2]; n++;
    }
    g.fillStyle = n ? `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})` : "#8a6a4a";
    g.beginPath();
    poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
    g.fill();
  }
  return c.toDataURL("image/jpeg", 0.88);
}

/** O que a IA reconheceu, e o caminho para corrigir: escolher entre as opções ou digitar o nome para ela pesquisar. */
function RecognitionCard(props: {
  rec: RecognizeOut["rec"] | null;
  profile: ProductProfile | null;
  partes: DishGuess[];
  itemName: string;
  open: boolean;
  onOpen: (v: boolean) => void;
  typed: string;
  onTyped: (v: string) => void;
  research: { profile: ProductProfile; entendi: string; fonte: string; link?: string } | null;
  researching: boolean;
  onResearch: (nome: string) => void;
  onRedo: (p: ProductProfile) => void;
  busy: boolean;
}) {
  const { rec, profile, partes, open, research } = props;
  const [confirmed, setConfirmed] = useState(false);
  const informed = profile?.fonte === "pesquisa";
  const top = rec?.escolha;
  const p = top?.p ?? 0;
  const seen = describeParts(partes.map((x) => x.id));
  const sure = !!top && !rec?.conflito && rec?.fonte !== "nome" && (confirmed || p >= 0.5);
  const maybe = !!top && !rec?.conflito && !sure && p >= 0.2;
  const options = rec ? [rec.escolha, ...rec.alternativas].filter((x): x is DishGuess => !!x && x.p >= 0.03).slice(0, 4) : [];
  let head: React.ReactNode;
  if (informed) head = <>Montado como <b>{profile!.produto}</b>, como você informou.</>;
  else if (!top) head = <>Não consegui reconhecer este prato pela imagem.</>;
  else if (rec?.fonte === "nome") head = <>Montado como <b>{top.nome}</b>, pelo nome do item no cardápio (a IA de imagem não respondeu).</>;
  else if (rec?.conflito) head = <>O item se chama <b>“{props.itemName}”</b>, mas a imagem parece <b>{top.nome}</b>. Está escaneando o prato certo?</>;
  else if (sure) head = <>A IA reconheceu: <b>{top.nome}</b>{seen ? <>. Vi {seen}.</> : "."}</>;
  else if (maybe) head = <>Parece ser <b>{top.nome}</b>. Acertei?</>;
  else head = <>Não tenho certeza do que é este prato.</>;
  return (
    <div className="rounded-2xl bg-cream p-3.5 text-[14.5px]" data-reconhecimento={informed ? "dono" : top ? `${top.id}:${p}` : "nada"}>
      <p className="flex gap-2.5">
        <Icon name="sparkle" size={18} className="mt-0.5 shrink-0 text-brand" />
        <span>{head}</span>
      </p>
      {!open && !informed && (
        <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
          {maybe && (
            <button className="rounded-full bg-ink px-3.5 py-1.5 text-[13.5px] font-semibold text-white" onClick={() => setConfirmed(true)}>
              Sim, é isso
            </button>
          )}
          <button className="rounded-full px-1 py-1.5 text-[13.5px] font-semibold underline" onClick={() => props.onOpen(true)}>
            {sure || rec?.fonte === "nome" ? "Não é isso?" : maybe ? "Não, é outro prato" : "Dizer qual é o prato"}
          </button>
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3 border-t border-black/10 pt-3">
          {options.length > 0 && !informed && (
            <div>
              <p className="mb-2 text-[13.5px] font-semibold text-black/65">É um destes?</p>
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <button key={o.id} className="rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold ring-1 ring-black/12" onClick={() => { props.onTyped(o.nome); props.onResearch(o.nome); }}>
                    {o.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form
            className="space-y-2"
            onSubmit={(e) => { e.preventDefault(); props.onResearch(props.typed); }}
          >
            <label className="block text-[13.5px] font-semibold text-black/65" htmlFor="qual-prato">Qual é o prato? A IA pesquisa o nome.</label>
            <div className="flex gap-2">
              <input id="qual-prato" className="input h-12 flex-1" placeholder="Ex.: Baião de dois" value={props.typed} maxLength={80} onChange={(e) => props.onTyped(e.target.value)} />
              <button className="btn-dark h-12 px-4" disabled={props.researching || props.typed.trim().length < 2}>
                {props.researching ? "..." : "Pesquisar"}
              </button>
            </div>
          </form>
          {research && (
            <div className="space-y-2.5 rounded-xl bg-white p-3 ring-1 ring-black/8" data-pesquisa={research.fonte}>
              <p className="text-[14px] leading-relaxed">{research.entendi}</p>
              {research.link && (
                <a href={research.link} target="_blank" rel="noreferrer" className="text-[13px] font-semibold underline">Ver na Wikipédia</a>
              )}
              <button className="btn-primary h-11 w-full" disabled={props.busy} onClick={() => props.onRedo(research.profile)}>
                Refazer o 3D com isso
              </button>
              <p className="text-[12.5px] text-black/50">Usa as mesmas imagens, não precisa escanear de novo.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

