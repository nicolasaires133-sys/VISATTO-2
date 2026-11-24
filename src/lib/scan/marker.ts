// Marcador de medição do Visatto (ArUco ARUCO_MIP_36h12, id 7) e cartão de banco como alternativa.
import { AR } from "./vendor/aruco.mjs";
import type { Vec2 } from "./geometry";

export const MARKER_ID = 7;
export const MARKER_DICT = "ARUCO_MIP_36h12";
/** Lado do quadrado preto impresso (cm). */
export const MARKER_CM = 15;
/** Cartão de banco / crachá padrão ISO/IEC 7810 ID-1. */
export const CARD_CM = { w: 8.56, h: 5.398 };

/**
 * Posição da folha A4 em relação ao centro do marcador (cm), com o topo do marcador apontando para +Y.
 * Usado para "apagar" a folha das fotos enviadas à IA.
 */
export const SHEET = { left: -10.5, right: 10.5, top: 10.5 + 0.0, bottom: -19.2 };

/** SVG do marcador: quadrado preto de `sizeMm` com a grade de bits (sem margem branca). */
export function markerSvg(sizeMm = MARKER_CM * 10) {
  const dict = new AR.Dictionary(MARKER_DICT);
  const code: string = dict.codeList[MARKER_ID];
  const n = dict.markSize - 2; // 6 células de dados
  const cell = sizeMm / (n + 2);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizeMm}mm" height="${sizeMm}mm" viewBox="0 0 ${sizeMm} ${sizeMm}"><rect width="${sizeMm}" height="${sizeMm}" fill="#000"/>`;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (code[y * n + x] === "1") s += `<rect x="${((x + 1) * cell).toFixed(3)}" y="${((y + 1) * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" fill="#fff"/>`;
  return s + "</svg>";
}

let detector: any = null;

/** Procura o marcador na imagem. Devolve os 4 cantos (TL, TR, BR, BL do marcador) ou null. */
export function detectMarker(img: ImageData): Vec2[] | null {
  if (!detector) detector = new AR.Detector({ dictionaryName: MARKER_DICT });
  // tenta na resolução original e, se não achar, numa versão reduzida (o detector prefere ~1000px)
  const tries: { data: ImageData; k: number }[] = [{ data: img, k: 1 }];
  const maxSide = Math.max(img.width, img.height);
  if (maxSide > 1300 && typeof OffscreenCanvas !== "undefined") {
    const k = 1000 / maxSide;
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const src = new OffscreenCanvas(img.width, img.height);
    src.getContext("2d")!.putImageData(img, 0, 0);
    const dst = new OffscreenCanvas(w, h);
    const g = dst.getContext("2d")!;
    g.drawImage(src, 0, 0, w, h);
    tries.push({ data: g.getImageData(0, 0, w, h), k });
  }
  for (const t of tries) {
    const found = detector.detect(t.data).filter((m: any) => m.id === MARKER_ID);
    if (found.length) {
      const c: Vec2[] = found[0].corners.map((p: any) => [p.x / t.k, p.y / t.k]);
      return c;
    }
  }
  return null;
}
