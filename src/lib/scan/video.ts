// Do vídeo (ou de várias fotos) ao modelo 3D, tudo no celular — sem servidor e sem custo.
//
// 1. Tira ~40 quadros do vídeo (ou usa as fotos).
// 2. Acha a folha com o marcador em cada quadro → posição exata da câmera, em centímetros.
// 3. Reconstrói o mapa de altura do prato (recon.ts) e separa o prato da mesa.
// 4. Monta a malha 3D completa (volume.ts: pega até partes suspensas) e pinta com os quadros → GLB em tamanho real.
import { calibrate, focalFromHomography, homography, type Vec2 } from "./geometry";
import { detectMarker, MARKER_CM, SHEET } from "./marker";
import { A4, detectSheet, SheetTracker } from "./sheet";
import { applyFlatTopPrior, applyRoundPrior, estimateCenter, reconstructHeightfield, segmentDish, selectViews, sharpness, type View } from "./recon";
import { checkDims, reconParams, type ProductProfile } from "./profile";
import { heightMeshToGlb, type HeightMesh } from "./heightmesh";
import { buildVolumeMesh, finalVolume, grade } from "./volume";
import { buildPlateMesh, buildPlatePoly, detectPlate, foodVolume, plateHeight, shadePlate } from "./plate";
import { polyFromVolume } from "./lowpoly";
import { checkPrintScale } from "./sheetscale";
import { berryFromRegion, clearRegion, dishCrops, dishRectOnImage, foodRegions, regionCrops, shapeBeans, sharpenCopy, splitByColor, type Berry, type DishGuess, type RecognizeFn, type RecognizeOut } from "./understand";
import { buildStrawberry } from "./garnish";
import { partById } from "./pratos";

/**
 * Um quadro do vídeo. Quando vem da captura ao vivo, já traz os cantos da referência na ordem certa
 * (a captura acompanhou a folha quadro a quadro), e a montagem não precisa procurar de novo.
 */
export type Frame = { data: ImageData; f35?: number | null; corners?: Vec2[]; ref?: "folha" | "marcador" };
export type Progress = (msg: string, p: number) => void;

const tick = () => new Promise((r) => setTimeout(r, 0));
/** Marca de tempo para medir as etapas (só aparece com window.__visattoTempo = true). */
const mark = (() => {
  let t = 0;
  return (what: string) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if ((globalThis as any).__visattoTempo && t) console.log(`TEMPO ${what}: ${Math.round(now - t)} ms`);
    t = now;
  };
})();
const MAX_SIDE = 1280;

function toCanvas(src: CanvasImageSource, w: number, h: number) {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.round(w * s), ch = Math.round(h * s);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, cw, ch);
  return g.getImageData(0, 0, cw, ch);
}

/** Extrai quadros espaçados de um vídeo. */
export async function framesFromVideo(file: File, onProgress?: Progress, count = 44): Promise<Frame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      video.onloadedmetadata = () => ok();
      video.onerror = () => fail(new Error("Não consegui abrir este vídeo. Tente gravar de novo pela câmera do celular."));
      setTimeout(() => fail(new Error("O vídeo demorou demais para abrir.")), 20000);
    });
    // alguns navegadores (iPhone) só liberam os quadros depois de um play
    try {
      await video.play();
      video.pause();
    } catch {}
    const dur = video.duration;
    if (!isFinite(dur) || dur < 2) throw new Error("O vídeo ficou curto demais. Grave uns 15 segundos dando a volta no prato.");
    const n = Math.min(count, Math.max(12, Math.round(dur * 3)));
    const frames: Frame[] = [];
    for (let k = 0; k < n; k++) {
      const t = 0.2 + ((dur - 0.4) * k) / (n - 1);
      await new Promise<void>((ok) => {
        const done = () => { video.removeEventListener("seeked", done); ok(); };
        video.addEventListener("seeked", done);
        video.currentTime = t;
        setTimeout(done, 3000);
      });
      if (!video.videoWidth) continue;
      frames.push({ data: toCanvas(video, video.videoWidth, video.videoHeight) });
      onProgress?.("Lendo o vídeo", (k + 1) / n);
      await tick();
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Usa várias fotos (com o foco do EXIF, quando houver). */
export async function framesFromPhotos(files: File[], onProgress?: Progress): Promise<Frame[]> {
  const exifr = (await import("exifr")).default;
  const out: Frame[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let f35: number | null = null;
    try {
      const ex = await exifr.parse(f, ["FocalLengthIn35mmFormat"]);
      f35 = ex?.FocalLengthIn35mmFormat ?? null;
    } catch {}
    let bmp: ImageBitmap | HTMLImageElement;
    try {
      bmp = await createImageBitmap(f, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      const url = URL.createObjectURL(f);
      bmp = await new Promise<HTMLImageElement>((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = url; });
    }
    out.push({ data: toCanvas(bmp, bmp.width, bmp.height), f35 });
    onProgress?.("Lendo as fotos", (i + 1) / files.length);
    await tick();
  }
  return out;
}

export type ReconResult = {
  glb: Blob;
  dims: { w: number; d: number; h: number };
  used: number;
  found: number;
  total: number;
  warnings: string[];
  /** tamanho do quadrado usado na conta e de onde veio: medido pela folha A4, informado à mão ou o padrão de 15 cm */
  markerCm: number;
  scaleSource: "folha" | "manual" | "padrao" | "folha-branca";
  /** o que a IA entendeu do prato (ficha final, reconhecimento e partes vistas) */
  profile: ProductProfile | null;
  rec: RecognizeOut["rec"] | null;
  partes: DishGuess[];
};

/** Um quadro do meio do vídeo, pequeno, para a IA dizer o que é o produto. */
export function frameForAI(frames: Frame[]): string | null {
  if (!frames.length) return null;
  const f = frames[Math.floor(frames.length / 2)].data;
  const s = Math.min(1, 640 / Math.max(f.width, f.height));
  const c = document.createElement("canvas");
  c.width = Math.round(f.width * s);
  c.height = Math.round(f.height * s);
  const tmp = document.createElement("canvas");
  tmp.width = f.width;
  tmp.height = f.height;
  tmp.getContext("2d")!.putImageData(f, 0, 0);
  c.getContext("2d")!.drawImage(tmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}

/** Quadros → modelo 3D em escala real. */
export async function reconstructFromFrames(
  frames: Frame[],
  onProgress?: Progress,
  /** tamanho do quadrado medido à mão pelo dono; null = conferir sozinho pela folha A4 */
  manualCm: number | null = null,
  profile?: ProductProfile | null,
  /** acabamento: "poligonos" (faces planas, cores limpas) ou "foto" (pintura das fotos sobre a forma lisa) */
  style: "poligonos" | "foto" = "foto",
  /** IA de reconhecimento: recognize pergunta ao servidor; keepProfile = o dono já disse o que é (não reconhece o prato) */
  ai: { recognize?: RecognizeFn; keepProfile?: boolean; onDish?: (p: ProductProfile, rec: RecognizeOut["rec"] | null) => void } = {},
): Promise<ReconResult> {
  const prm = profile ? reconParams(profile) : { zMax: 30, half: 26, round: false, flatTop: false };
  mark("início");
  // 1. referência em cada quadro: folha A4 em branco (padrão) ou a folha com o marcador impresso (opcional)
  type Hit = { data: ImageData; corners: Vec2[]; f35?: number | null };
  let hits: Hit[] = [];
  let mode: "folha" | "marcador" = "folha";
  if (frames.length && frames.every((f) => f.corners && f.ref)) {
    // vieram da captura ao vivo, já com os cantos certos
    mode = frames[0].ref!;
    hits = frames.filter((f) => f.ref === mode).map((f) => ({ data: f.data, corners: f.corners!, f35: f.f35 }));
    onProgress?.("Procurando a folha em cada quadro", 1);
  } else {
    // quadros soltos (vídeo ou fotos): primeiro vê se é a folha com marcador; senão, segue a folha em branco
    const marks: Hit[] = [];
    for (let i = 0; i < frames.length; i++) {
      const c = detectMarker(frames[i].data);
      if (c) marks.push({ data: frames[i].data, corners: c, f35: frames[i].f35 });
      onProgress?.("Procurando a folha em cada quadro", ((i + 1) / frames.length) * (marks.length >= 6 ? 1 : 0.5));
      if (i % 2 === 0) await tick();
    }
    if (marks.length >= Math.max(6, frames.length * 0.25)) {
      mode = "marcador";
      hits = marks;
    } else {
      const tr = new SheetTracker();
      for (let i = 0; i < frames.length; i++) {
        const c = detectSheet(frames[i].data);
        // quadros seguidos: segue a folha pela posição; se ela sumiu, reconhece pela mesa em volta
        const o = c ? tr.orient(c, frames[i].data, i, 1.5) : null;
        if (o) hits.push({ data: frames[i].data, corners: o, f35: frames[i].f35 });
        onProgress?.("Procurando a folha em cada quadro", 0.5 + ((i + 1) / frames.length) * 0.5);
        if (i % 2 === 0) await tick();
      }
    }
  }
  if (hits.length < 6)
    throw new Error(
      mode === "marcador"
        ? `A folha com o marcador apareceu inteira em só ${hits.length} de ${frames.length} quadros. Escaneie de novo devagar, sempre mostrando a folha inteira e o prato.`
        : `A folha apareceu inteira em só ${hits.length} de ${frames.length} quadros. Deixe a folha branca inteira na tela o tempo todo, a um palmo do prato. Em mesa clara, coloque um pano ou jogo americano escuro embaixo da folha.`,
    );

  // escala e tamanho da referência no mundo (cm)
  let refW: number, refH: number, markerCm: number, scaleSource: ReconResult["scaleSource"], k: number;
  if (mode === "marcador") {
    // o dono informou o tamanho do quadrado, ou confere sozinho pela largura/altura da folha A4
    const auto = manualCm ? null : checkPrintScale(hits);
    markerCm = manualCm ?? auto!.markerCm;
    scaleSource = manualCm ? "manual" : auto!.source;
    k = markerCm / MARKER_CM; // folha impressa em outra escala: o desenho escala junto
    refW = refH = markerCm;
  } else {
    // folha em branco: 21 × 29,7 cm sempre (o "manual" aqui não se aplica)
    markerCm = A4.w;
    scaleSource = "folha-branca";
    k = 1;
    refW = A4.w;
    refH = A4.h;
  }

  // 2. foco da câmera: o mesmo para o vídeo todo (mediana das estimativas)
  const ests: number[] = [];
  for (const h of hits) {
    if (h.f35) continue;
    const H = homography([[-refW / 2, refH / 2], [refW / 2, refH / 2], [refW / 2, -refH / 2], [-refW / 2, -refH / 2]], h.corners);
    const f = focalFromHomography(H, h.data.width / 2, h.data.height / 2);
    if (f) ests.push(f / Math.max(h.data.width, h.data.height)); // normalizado: vale para quadros de tamanhos diferentes
  }
  ests.sort((a, b) => a - b);
  const fNorm = ests.length >= 3 ? ests[ests.length >> 1] : null;
  const all = hits.map((h) => {
    const img = { data: h.data.data, width: h.data.width, height: h.data.height };
    const cam = calibrate({
      corners: h.corners, refW, refH, width: img.width, height: img.height,
      f35: h.f35 ?? null, fKnown: h.f35 ? null : fNorm ? fNorm * Math.max(img.width, img.height) : null,
    }).cam;
    return { img, cam, sharp: sharpness(img) };
  });

  // 3. mapa de altura
  const center = estimateCenter(all as View[]);
  const views = selectViews(all, center, 20);
  if (views.length < 6) throw new Error("Faltaram ângulos diferentes. Dê a volta inteira em torno do prato.");
  const hf = await reconstructHeightfield(
    views,
    mode === "marcador"
      ? { center, half: prm.half, zMax: prm.zMax, markerHalf: markerCm / 2 + 1, exclude: { x0: SHEET.left, x1: SHEET.right, y0: SHEET.bottom * k, y1: SHEET.top * k } }
      : { center, half: prm.half, zMax: prm.zMax, markerHalf: A4.w / 2 - 0.5, exclude: { x0: -A4.w / 2 - 0.6, x1: A4.w / 2 + 0.6, y0: -A4.h / 2 - 0.6, y1: A4.h / 2 + 0.6 } },
    (p) => onProgress?.("Calculando a forma e a altura", p),
  );
  let dish = segmentDish(hf);
  // a IA olha o prato (3 recortes de lados diferentes) e diz o que é; a ficha ajusta o resto da montagem
  let prof: ProductProfile | null = profile ?? null, rec: RecognizeOut["rec"] | null = null, aiDown = false;
  if (ai.recognize && !ai.keepProfile) {
    mark("forma e altura");
    onProgress?.("Reconhecendo o prato", 0);
    const fotos = dishCrops(views as View[], hf, dish);
    mark("recortes do prato");
    const r = fotos.length ? await ai.recognize({ fotos }).catch(() => null) : null;
    // sem resposta (servidor fora do ar ou lento demais): nem pergunta das partes, para não esperar duas vezes
    if (fotos.length && !r) aiDown = true;
    mark("resposta da IA (prato)");
    if (r?.profile) prof = r.profile;
    rec = r?.rec ?? null;
    if (prof) ai.onDish?.(prof, rec);
    onProgress?.("Reconhecendo o prato", 1);
  }
  const prm2 = prof ? reconParams(prof) : prm;
  if (prm2.round) {
    applyRoundPrior(hf, dish);
    dish = segmentDish(hf);
  }
  if (prm2.flatTop) {
    applyFlatTopPrior(hf, dish, 0.75);
    dish = segmentDish(hf);
  }
  if (dish.dims.h < 0.8) throw new Error("Não consegui ver altura no prato. Escaneie de novo com o celular mais de lado, não só de cima.");

  // 4. malha + pintura
  // Com prato redondo por baixo, a louça é desenhada limpa (redonda, lisa, brilhante) e só a comida vem das fotos.
  const paint = (p: number) => onProgress?.("Pintando o modelo com as imagens", p);
  // realça a nitidez das fotos antes de pintar, só na área do prato e numa cópia (as originais ficam guardadas
  // para o "Refazer o 3D com isso"; realçar nelas estragaria a segunda montagem)
  for (let k = 0; k < views.length; k++) {
    const v = views[k];
    v.img = sharpenCopy(v.img, dishRectOnImage(v.cam, hf, dish)) as typeof v.img;
    onProgress?.("Preparando a pintura", (k + 1) / views.length);
    if (k % 3 === 2) await tick();
  }
  mark("realce de nitidez");
  onProgress?.("Separando a comida do prato", 0);
  await tick();
  const F = finalVolume(hf, dish);
  const plate = detectPlate(hf, dish, views as View[], F);
  mark("separar comida e prato");
  const parts: HeightMesh[] = [];
  // Estilo polígonos (padrão): a forma vira anéis de faces planas e cada face ganha uma cor limpa, tirada da
  // malha pintada com as fotos (que continua sendo calculada, mas só serve de "tinta").
  const poly = style === "poligonos";
  const count = (m: Uint8Array) => { let n = 0; for (let q = 0; q < m.length; q++) n += m[q]; return n; };
  const partesVistas: DishGuess[] = [];
  if (plate) {
    const vol = foodVolume(hf, F, plate), floor = (x: number, y: number) => plateHeight(plate, x, y);
    const berries: Berry[] = [];
    // a IA olha cada pedaço do prato (visto de cima) e diz o que é: arroz, feijão, morango...
    if (ai.recognize && !aiDown && plate.food.some((v) => v === 1)) {
      onProgress?.("Reconhecendo cada parte do prato", 0);
      // pedaços a partir de 1,5 cm² (um morango visto de cima tem uns 2 a 3 cm²)
      const regions = splitByColor(hf, foodRegions(hf, plate.food, vol, 1.5), views as View[], vol).slice(0, 10);
      const crops = regionCrops(views as View[], regions, plate, hf);
      mark("separar as partes + recortes");
      const sent = crops.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
      const r = sent.length ? await ai.recognize({ partes: sent.map((i) => crops[i]!), prato: prof?.id }).catch(() => null) : null;
      const dbg = (globalThis as any).__visattoDebug;
      if (dbg) dbg.push({ brutas: foodRegions(hf, plate.food, vol, 0.2).map((g) => ({ area: Math.round(g.area * 10) / 10, x: Math.round(g.cx), y: Math.round(g.cy), top: Math.round(g.top * 10) / 10 })) });
      if (dbg) dbg.push({ regioes: sent.map((i) => ({ area: Math.round(regions[i].area), x: Math.round(regions[i].cx), y: Math.round(regions[i].cy) })), crops: sent.map((i) => crops[i]), partes: r?.partes });
      (r?.partes ?? []).forEach((guess, k) => {
        const reg = regions[sent[k]], top = guess?.[0];
        if (!reg || !top || top.p < 0.3) return;
        partesVistas.push(top);
        const part = partById(top.id);
        // feijão: monte baixo e arredondado, no lugar da "bolota" que o caldo escuro engana
        // farofa e purê também são montes, mas só fazem sentido em pratos (não numa pizza ou num lanche)
        const mound = top.id === "farofa" || top.id === "pure" ? !!prof && ["prato_raso", "tigela", "porcao"].includes(prof.kind) : false;
        if (part?.trat === "feijao" || mound) shapeBeans(hf, vol, reg, plate);
        // morango inteiro (até ~5 cm): redesenhado com forma, sementes e folhinhas
        if (part?.trat === "morango" && reg.area <= 30) {
          const berry = berryFromRegion(hf, vol, reg, plate, views as View[]);
          if (berry) { berries.push(berry); clearRegion(hf, vol, reg); }
        }
      });
      mark("resposta da IA (partes) e ajustes");
      onProgress?.("Reconhecendo cada parte do prato", 1);
    }
    if (vol.some((v) => v === 1)) {
      const food = await buildVolumeMesh(hf, dish, views, paint, { maxTex: 1024, volume: vol, floor, step: poly ? 2 : 1, bleed: [plate.raw],
        pale: (x, y) => { const i = Math.floor((x - hf.x0) / hf.cell), j = Math.floor((y - hf.y0) / hf.cell); return i >= 0 && j >= 0 && i < hf.nx && j < hf.ny && plate.pale[j * hf.nx + i] === 1; },
      });
      const low = poly ? polyFromVolume(hf, vol, dish.centroid, food, floor) : null;
      parts.push(low ?? food);
    }
    mark("malha e pintura da comida");
    berries.forEach((b, i) => parts.push(...buildStrawberry(b, dish.centroid, i + 1)));
    grade(plate.tex.data, 1.1, 1.03);
    if (!poly) shadePlate(plate, hf, vol);
    parts.push(poly ? buildPlatePoly(plate, dish.centroid) : buildPlateMesh(plate, dish.centroid));
  } else {
    // (estilo foto) produto pequeno (cupcake, taça, lanche): malha mais fina, o contorno fica mais bem definido
    const mesh = await buildVolumeMesh(hf, dish, views, paint, { maxTex: 1024, volume: F, step: !poly && count(dish.mask) < 4000 ? 1 : 2 });
    const low = poly ? polyFromVolume(hf, F, dish.centroid, mesh) : null;
    parts.push(low ?? mesh);
  }
  mark("prato e acabamentos");
  onProgress?.("Gerando o arquivo 3D", 1);
  const glb = await heightMeshToGlb(parts);
  mark("arquivo 3D");
  // As medidas mostradas ao dono são as do modelo final (a mesma conta que o servidor faz ao publicar),
  // para que o que ele confere seja exatamente o que o cliente vai ver.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of parts)
    for (let i = 0; i < mesh.positions.length; i += 3)
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a], mesh.positions[i + a]);
        hi[a] = Math.max(hi[a], mesh.positions[i + a]);
      }
  const cm = (a: number) => Math.round((hi[a] - lo[a]) * 1000) / 10;
  const dims = isFinite(lo[0]) ? { w: cm(0), d: cm(2), h: cm(1) } : dish.dims;
  return {
    glb, dims, used: views.length, found: hits.length, total: frames.length, warnings: prof ? checkDims(prof, dims) : [], markerCm, scaleSource,
    profile: prof, rec, partes: partesVistas,
  };
}
