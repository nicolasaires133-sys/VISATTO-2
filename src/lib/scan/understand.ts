// "Entender" o prato durante a montagem do 3D (roda no celular):
// - recorta o prato (e cada pedaço dele) das imagens, para a IA de visão dizer o que é;
// - aplica o que foi entendido: feijão vira um monte com caldo (não uma bolota), morango vira um morango de verdade.
import { cameraCenter, type Camera } from "./geometry";
import type { Dish, HeightField, RGBA, View } from "./recon";
import { plateHeight, type Plate } from "./plate";
import type { ProductProfile } from "./profile";

export type DishGuess = { id: string; nome: string; p: number };
export type RecognizeOut = {
  profile?: ProductProfile;
  rec?: { escolha: DishGuess | null; alternativas: DishGuess[]; conflito: boolean; fonte: string };
  partes?: DishGuess[][];
};
/** Pergunta à IA (no servidor) o que é o prato e/ou cada pedaço. null = sem resposta (segue sem). */
export type RecognizeFn = (req: { fotos?: string[]; partes?: string[]; prato?: string }) => Promise<RecognizeOut | null>;

const canDraw = () => typeof document !== "undefined" && typeof document.createElement === "function";

/** Recorte quadrado da imagem, ampliado/reduzido para `size`, em JPEG (data URL). */
export function cropDataURL(img: RGBA, box: [number, number, number, number], size = 256, keep?: (u: number, v: number) => number): string | null {
  if (!canDraw()) return null;
  let [u0, v0, u1, v1] = box;
  const s = Math.max(u1 - u0, v1 - v0), cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  u0 = cu - s / 2; v0 = cv - s / 2;
  if (s < 24) return null;
  const out = new Uint8ClampedArray(size * size * 4), d = img.data, W = img.width, H = img.height;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rx = u0 + ((x + 0.5) / size) * s, ry = v0 + ((y + 0.5) / size) * s, o = (y * size + x) * 4;
      // fora da foto: cinza neutro (esticar a borda cria listras que confundem a IA)
      if (rx < 0 || ry < 0 || rx > W - 1 || ry > H - 1) { out[o] = out[o + 1] = out[o + 2] = 128; out[o + 3] = 255; continue; }
      const sx = Math.min(W - 1.001, rx), sy = Math.min(H - 1.001, ry);
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i = (iy * W + ix) * 4;
      for (let c = 0; c < 3; c++)
        out[o + c] = d[i + c] * (1 - fx) * (1 - fy) + d[i + 4 + c] * fx * (1 - fy) + d[i + W * 4 + c] * (1 - fx) * fy + d[i + W * 4 + 4 + c] * fx * fy;
      // fora do pedaço: apagado para cinza claro (a IA olha só o que interessa)
      if (keep) {
        const k = keep(rx, ry);
        if (k < 1) for (let c = 0; c < 3; c++) out[o + c] = out[o + c] * k + 200 * (1 - k);
      }
      out[o + 3] = 255;
    }
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.putImageData(new ImageData(out, size, size), 0, 0);
  return c.toDataURL("image/jpeg", 0.88);
}

function project(cam: Camera, X: number, Y: number, Z: number): [number, number] | null {
  const R = cam.R, t = cam.t, zc = R[6] * X + R[7] * Y + R[8] * Z + t[2];
  if (zc <= 1) return null;
  return [(cam.f * (R[0] * X + R[1] * Y + R[2] * Z + t[0])) / zc + cam.cx, (cam.f * (R[3] * X + R[4] * Y + R[5] * Z + t[1])) / zc + cam.cy];
}

/** Caixa (cm) → retângulo na imagem. */
function boxOnImage(cam: Camera, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const X of [x0, x1]) for (const Y of [y0, y1]) for (const Z of [z0, z1]) {
    const p = project(cam, X, Y, Z);
    if (!p) return null;
    u0 = Math.min(u0, p[0]); v0 = Math.min(v0, p[1]); u1 = Math.max(u1, p[0]); v1 = Math.max(v1, p[1]);
  }
  return [u0, v0, u1, v1] as [number, number, number, number];
}

const elevation = (cam: Camera, cx: number, cy: number) => {
  const C = cameraCenter(cam);
  return { el: Math.atan2(C[2], Math.hypot(C[0] - cx, C[1] - cy)), az: Math.atan2(C[1] - cy, C[0] - cx) };
};

/** Retângulo (em pixels) que o prato inteiro ocupa nesta foto, ou null se a câmera estiver atrás dele. */
export function dishRectOnImage(cam: Camera, hf: HeightField, dish: Dish): [number, number, number, number] | null {
  const { nx, ny, cell, x0, y0 } = hf;
  let i0 = nx, i1 = 0, j0 = ny, j1 = 0;
  for (let q = 0; q < nx * ny; q++) {
    if (!dish.mask[q]) continue;
    const i = q % nx, j = (q / nx) | 0;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  if (i1 < i0) return null;
  return boxOnImage(cam, x0 + i0 * cell - 1, x0 + (i1 + 1) * cell + 1, y0 + j0 * cell - 1, y0 + (j1 + 1) * cell + 1, 0, Math.max(2, dish.dims.h) + 1);
}

/**
 * Cópia da imagem com a nitidez realçada só dentro do retângulo (a pintura mistura fotos e perde definição).
 * A imagem original não muda: ela fica guardada para o "Refazer o 3D" e não pode ser realçada duas vezes.
 */
export function sharpenCopy(img: RGBA, rect: [number, number, number, number] | null, amount = 0.6): RGBA {
  const W = img.width, H = img.height, out = new Uint8ClampedArray(img.data);
  if (!rect) return { data: out, width: W, height: H };
  const M = 4; // 4 passadas de raio 1: o desfoque alcança 4 pixels
  const x0 = Math.max(0, Math.floor(rect[0]) - M), y0 = Math.max(0, Math.floor(rect[1]) - M);
  const x1 = Math.min(W, Math.ceil(rect[2]) + M), y1 = Math.min(H, Math.ceil(rect[3]) + M);
  const w = x1 - x0, h = y1 - y0;
  if (w < 3 || h < 3) return { data: out, width: W, height: H };
  let a = new Float32Array(w * h), b = new Float32Array(w * h);
  const src = img.data;
  for (let ch = 0; ch < 3; ch++) {
    for (let y = 0; y < h; y++) {
      const r = y * w, o = ((y0 + y) * W + x0) * 4 + ch;
      for (let x = 0; x < w; x++) a[r + x] = src[o + x * 4];
    }
    for (let pass = 0; pass < 4; pass++) {
      if (pass % 2 === 0)
        for (let y = 0; y < h; y++) {
          const r = y * w;
          for (let x = 0; x < w; x++) b[r + x] = (a[r + (x > 0 ? x - 1 : 0)] + a[r + x] + a[r + (x < w - 1 ? x + 1 : x)]) / 3;
        }
      else
        for (let y = 0; y < h; y++) {
          const r = y * w, up = (y > 0 ? y - 1 : 0) * w, dn = (y < h - 1 ? y + 1 : y) * w;
          for (let x = 0; x < w; x++) b[r + x] = (a[up + x] + a[r + x] + a[dn + x]) / 3;
        }
      const t = a; a = b; b = t;
    }
    for (let y = 0; y < h; y++) {
      const r = y * w, o = ((y0 + y) * W + x0) * 4 + ch;
      for (let x = 0; x < w; x++) { const v = src[o + x * 4]; out[o + x * 4] = v + (v - a[r + x]) * amount; }
    }
  }
  return { data: out, width: W, height: H };
}

/** Recortes do prato inteiro, de 3 lados, na altura de quem olha o prato na mesa (~45°). */
export function dishCrops(views: View[], hf: HeightField, dish: Dish): string[] {
  const { nx, ny, cell, x0, y0 } = hf;
  let i0 = nx, i1 = 0, j0 = ny, j1 = 0;
  for (let q = 0; q < nx * ny; q++) {
    if (!dish.mask[q]) continue;
    const i = q % nx, j = (q / nx) | 0;
    i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
  }
  if (i1 < i0) return [];
  const bx0 = x0 + i0 * cell, bx1 = x0 + (i1 + 1) * cell, by0 = y0 + j0 * cell, by1 = y0 + (j1 + 1) * cell;
  const [cx, cy] = dish.centroid;
  const info = views.map((v, k) => ({ k, ...elevation(v.cam, cx, cy) }));
  info.sort((a, b) => Math.abs(a.el - 0.8) - Math.abs(b.el - 0.8));
  const pick: typeof info = [];
  for (const v of info) {
    if (pick.every((p) => Math.abs(((v.az - p.az + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 1.4)) pick.push(v);
    if (pick.length === 3) break;
  }
  const out: string[] = [];
  for (const p of pick) {
    const b = boxOnImage(views[p.k].cam, bx0, bx1, by0, by1, 0, Math.max(2, dish.dims.h));
    if (!b) continue;
    const m = 0.1 * Math.max(b[2] - b[0], b[3] - b[1]);
    const url = cropDataURL(views[p.k].img, [b[0] - m, b[1] - m, b[2] + m, b[3] + m]);
    if (url) out.push(url);
  }
  return out;
}

export type Region = { cells: number[]; area: number; cx: number; cy: number; x0: number; x1: number; y0: number; y1: number; top: number };

/** Pedaços separados de comida no prato (arroz, feijão, carne...), do maior para o menor. */
export function foodRegions(hf: HeightField, food: Uint8Array, vol: Uint8Array, minArea = 3): Region[] {
  const { nx, ny, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!, N = nx * ny;
  const lab = new Uint8Array(N), out: Region[] = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (!food[s0] || lab[s0]) continue;
    const cells = [s0];
    lab[s0] = 1;
    for (let e = 0; e < cells.length; e++) {
      const q = cells[e], i = q % nx, j = (q / nx) | 0;
      for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1])
        if (o >= 0 && food[o] && !lab[o]) { lab[o] = 1; cells.push(o); }
    }
    const area = cells.length * cell * cell;
    if (area < minArea) continue;
    let sx = 0, sy = 0, rx0 = Infinity, rx1 = -Infinity, ry0 = Infinity, ry1 = -Infinity, top = 0;
    for (const q of cells) {
      const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
      sx += X; sy += Y;
      rx0 = Math.min(rx0, X); rx1 = Math.max(rx1, X); ry0 = Math.min(ry0, Y); ry1 = Math.max(ry1, Y);
      for (let k = nz - 1; k >= 0; k--) if (vol[k * N + q]) { top = Math.max(top, (k + 1) * dz); break; }
    }
    out.push({ cells, area, cx: sx / cells.length, cy: sy / cells.length, x0: rx0 - cell / 2, x1: rx1 + cell / 2, y0: ry0 - cell / 2, y1: ry1 + cell / 2, top });
  }
  return out.sort((a, b) => b.area - a.area);
}

/** Recorte de cada pedaço, visto o mais de cima possível (é como a IA reconhece melhor arroz, feijão, molho...). */
export function regionCrops(views: View[], regions: Region[], plate: Plate, hf: HeightField): (string | null)[] {
  return regions.map((r) => {
    const pt = plateHeight(plate, r.cx, r.cy);
    // um pouco do que está em volta ajuda (feijão ao lado do arroz é feijão, não chocolate)
    const m = Math.max(1.2, 0.25 * Math.max(r.x1 - r.x0, r.y1 - r.y0));
    const order = views.map((v, k) => ({ k, el: elevation(v.cam, r.cx, r.cy).el })).sort((a, b) => b.el - a.el);
    let pick: { k: number; b: [number, number, number, number]; inside: number } | null = null;
    for (const { k } of order.slice(0, 8)) {
      const b = boxOnImage(views[k].cam, r.x0 - m, r.x1 + m, r.y0 - m, r.y1 + m, pt, Math.max(pt + 0.5, r.top));
      if (!b) continue;
      const W = views[k].img.width, H = views[k].img.height;
      const iw = Math.max(0, Math.min(W, b[2]) - Math.max(0, b[0])), ih = Math.max(0, Math.min(H, b[3]) - Math.max(0, b[1]));
      const inside = (iw * ih) / Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));
      if (!pick || inside > pick.inside + 0.02) pick = { k, b, inside };
      if (inside > 0.98) break; // a mais de cima que mostra o pedaço inteiro
    }
    if (!pick) return null;
    // máscara: o pixel enxerga (no plano do meio do pedaço) uma célula do pedaço? (com 1 célula de folga)
    const { nx, ny, cell, x0, y0 } = hf;
    const inR = new Uint8Array(nx * ny);
    for (const q of r.cells) {
      const i = q % nx, j = (q / nx) | 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const ii = i + a, jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) inR[jj * nx + ii] = 1;
      }
    }
    const cam = views[pick.k].cam, R = cam.R, C = cameraCenter(cam), zp = (pt + Math.max(pt + 0.5, r.top)) / 2;
    const keep = (u: number, v: number) => {
      const a = (u - cam.cx) / cam.f, b = (v - cam.cy) / cam.f;
      // direção do raio no mundo: R^T · [a, b, 1]
      const dx = R[0] * a + R[3] * b + R[6], dy = R[1] * a + R[4] * b + R[7], dzv = R[2] * a + R[5] * b + R[8];
      if (Math.abs(dzv) < 1e-6) return 0.15;
      const t = (zp - C[2]) / dzv, X = C[0] + dx * t, Y = C[1] + dy * t;
      const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell);
      return i >= 0 && j >= 0 && i < nx && j < ny && inR[j * nx + i] ? 1 : 0.15;
    };
    return cropDataURL(views[pick.k].img, pick.b, 224, keep);
  });
}

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/**
 * Pedaços que se encostam (arroz colado na carne, salada encostada no arroz) viram uma região só. Aqui cada região
 * grande é separada pela cor vista de cima: cada parte do prato ganha a sua (e a IA reconhece uma por uma).
 */
export function splitByColor(hf: HeightField, regions: Region[], views: View[], vol: Uint8Array, minArea = 3): Region[] {
  const { nx, ny, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!, N = nx * ny;
  const out: Region[] = [];
  for (const r of regions) {
    if (r.area < 18) { out.push(r); continue; }
    const order = views.map((v, k) => ({ k, el: elevation(v.cam, r.cx, r.cy).el })).sort((a, b) => b.el - a.el).slice(0, 2);
    const lab = new Map<number, [number, number, number]>();
    for (const q of r.cells) {
      const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
      let top = 0;
      for (let k = nz - 1; k >= 0; k--) if (vol[k * N + q]) { top = (k + 1) * dz; break; }
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (const { k } of order) {
        const p = project(views[k].cam, X, Y, top), img = views[k].img;
        if (!p) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const u = (p[0] | 0) + dx, v = (p[1] | 0) + dy;
            if (u < 0 || v < 0 || u >= img.width || v >= img.height) continue;
            const o = (v * img.width + u) * 4;
            sr += img.data[o]; sg += img.data[o + 1]; sb += img.data[o + 2]; n++;
          }
      }
      if (n) lab.set(q, toLab(sr / n, sg / n, sb / n));
    }
    // crescimento por cor: cada parte junta vizinhos parecidos com a média dela (não com o vizinho, que deriva)
    const seg = new Int32Array(N).fill(-1), inR = new Uint8Array(N);
    for (const q of r.cells) inR[q] = 1;
    const segs: { cells: number[]; m: [number, number, number] }[] = [];
    const T = 19;
    for (const s0 of r.cells) {
      if (seg[s0] >= 0) continue;
      const c0 = lab.get(s0) ?? [50, 0, 0];
      const sgm = { cells: [s0], m: [...c0] as [number, number, number] };
      seg[s0] = segs.length;
      for (let e = 0; e < sgm.cells.length; e++) {
        const q = sgm.cells[e], i = q % nx, j = (q / nx) | 0;
        for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1]) {
          if (o < 0 || !inR[o] || seg[o] >= 0) continue;
          const c = lab.get(o);
          if (!c) continue;
          if (Math.hypot(c[0] - sgm.m[0], c[1] - sgm.m[1], c[2] - sgm.m[2]) > T) continue;
          seg[o] = segs.length;
          sgm.cells.push(o);
          const n = sgm.cells.length;
          for (let a = 0; a < 3; a++) sgm.m[a] += (c[a] - sgm.m[a]) / n;
        }
      }
      segs.push(sgm);
    }
    // partes pequenas (sementes, sombrinhas, pontos de brilho) voltam para a vizinha de cor mais parecida
    const minCells = Math.max(4, Math.round(minArea / (cell * cell)));
    for (let pass = 0; pass < 3; pass++)
      segs.forEach((sg, si) => {
        if (!sg.cells.length || sg.cells.length >= minCells) return;
        const votes = new Map<number, number>();
        for (const q of sg.cells) {
          const i = q % nx, j = (q / nx) | 0;
          for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1])
            if (o >= 0 && inR[o] && seg[o] >= 0 && seg[o] !== si) votes.set(seg[o], (votes.get(seg[o]) ?? 0) + 1);
        }
        let best = -1, bd = Infinity;
        for (const t of votes.keys()) {
          const m = segs[t].m, d = Math.hypot(m[0] - sg.m[0], m[1] - sg.m[1], m[2] - sg.m[2]);
          if (segs[t].cells.length && d < bd) { bd = d; best = t; }
        }
        if (best < 0) return;
        for (const q of sg.cells) { seg[q] = best; segs[best].cells.push(q); }
        sg.cells = [];
      });
    const parts = segs.filter((sg) => sg.cells.length >= minCells);
    if (parts.length <= 1) { out.push(r); continue; }
    const mask = new Uint8Array(N);
    for (const sg of parts) {
      mask.fill(0);
      for (const q of sg.cells) mask[q] = 1;
      out.push(...foodRegions(hf, mask, vol, minArea));
    }
  }
  return out.sort((a, b) => b.area - a.area);
}

/** Distância (cm) de cada célula da região até a borda dela. */
function insideDistance(hf: HeightField, r: Region) {
  const { nx, ny, cell } = hf, N = nx * ny;
  const inR = new Uint8Array(N);
  for (const q of r.cells) inR[q] = 1;
  const d = new Float32Array(N).fill(1e9);
  const queue: number[] = [];
  for (const q of r.cells) {
    const i = q % nx, j = (q / nx) | 0;
    const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || !inR[q - 1] || !inR[q + 1] || !inR[q - nx] || !inR[q + nx];
    if (edge) { d[q] = 0.5; queue.push(q); }
  }
  // duas passadas de chanfro (aproximação boa da distância euclidiana)
  const order = [...r.cells].sort((a, b) => a - b);
  for (let pass = 0; pass < 2; pass++) {
    const seq = pass === 0 ? order : [...order].reverse();
    for (const q of seq) {
      const i = q % nx, j = (q / nx) | 0;
      for (const [a, b, w] of [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [1, 1, 1.414]]) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const o = jj * nx + ii;
        if (inR[o] && d[o] + w < d[q]) d[q] = d[o] + w;
      }
    }
  }
  for (const q of r.cells) d[q] *= cell;
  return d;
}

/**
 * Feijão: o caldo escuro e liso engana a medida de altura (sai bolota ou buraco). Feijão servido é um monte baixo e
 * arredondado, que escorre nas bordas: a forma vira essa, na altura que as fotos indicam (limitada ao razoável).
 */
export function shapeBeans(hf: HeightField, vol: Uint8Array, r0: Region, plate: Plate) {
  const { nx, ny, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!, N = nx * ny;
  // o caldo escorre um pouco além do que foi medido como comida: a base do monte vai até lá (~0,8 cm),
  // senão sobra um anel de prato entre o monte e a mancha de caldo pintada no prato
  const grow = Math.max(1, Math.round(0.8 / cell)), inR = new Uint8Array(N);
  for (const q of r0.cells) inR[q] = 1;
  const cells = [...r0.cells];
  for (let g = 0; g < grow; g++) {
    const add: number[] = [];
    for (const q of cells) {
      const i = q % nx, j = (q / nx) | 0;
      for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1]) {
        if (o < 0 || inR[o]) continue;
        const X = x0 + ((o % nx) + 0.5) * cell, Y = y0 + (((o / nx) | 0) + 0.5) * cell;
        if (Math.hypot(X - plate.cx, Y - plate.cy) > plate.R * 0.93) continue;
        // não invade outra comida
        let other = false;
        for (let k = 0; k < nz && !other; k++) if (vol[k * N + o] && (k + 0.5) * dz > plateHeight(plate, X, Y) + 0.3) other = true;
        if (other) continue;
        inR[o] = 1;
        add.push(o);
      }
    }
    cells.push(...add);
  }
  const r: Region = { ...r0, cells };
  const d = insideDistance(hf, r);
  let D = 0;
  for (const q of r.cells) D = Math.max(D, d[q]);
  // altura: o contorno das fotos (casco) é um limite por cima; um monte de feijão costuma ter de 1,2 a 3 cm
  const occ = hf.occ;
  const ups: number[] = [];
  for (const q of r.cells) {
    if (d[q] < D * 0.45) continue;
    const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell, pt = plateHeight(plate, X, Y);
    let top = 0;
    const src = occ ?? vol;
    for (let k = nz - 1; k >= 0; k--) if (src[k * N + q]) { top = (k + 1) * dz; break; }
    ups.push(top - pt);
  }
  ups.sort((a, b) => a - b);
  const hull = ups.length ? ups[Math.floor(ups.length * 0.6)] : 2;
  const H = Math.min(3.2, Math.max(1.3, Math.min(hull * 0.7, D * 0.75)));
  for (const q of r.cells) {
    const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell, pt = plateHeight(plate, X, Y);
    const t = Math.min(1, d[q] / Math.max(cell, D));
    const z = pt + 0.08 + (H - 0.08) * Math.pow(Math.sin((t * Math.PI) / 2), 0.85);
    for (let k = 0; k < nz; k++) vol[k * N + q] = (k + 0.5) * dz <= z ? 1 : 0;
  }
  return H;
}

export type Berry = { x: number; y: number; z0: number; len: number; rad: number; upright: boolean; ax: number; calyxAt: 1 | -1; color: [number, number, number] };

/** Medidas de um morango a partir do pedaço reconhecido (posição, tamanho, deitado ou em pé, cor de verdade). */
export function berryFromRegion(hf: HeightField, vol: Uint8Array, r: Region, plate: Plate, views: View[]): Berry | null {
  const { nx, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!, N = nx * hf.ny;
  const pts: [number, number][] = [];
  let zTop = 0;
  for (const q of r.cells) {
    const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
    pts.push([X, Y]);
    for (let k = nz - 1; k >= 0; k--) if (vol[k * N + q]) { zTop = Math.max(zTop, (k + 1) * dz); break; }
  }
  const z0 = plateHeight(plate, r.cx, r.cy);
  const hh = zTop - z0;
  if (hh < 0.8) return null; // metade cortada ou muito baixo: deixa como escaneou
  // eixo maior (vista de cima)
  let sxx = 0, syy = 0, sxy = 0;
  for (const [X, Y] of pts) { const a = X - r.cx, b = Y - r.cy; sxx += a * a; syy += b * b; sxy += a * b; }
  const ax = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let lo = Infinity, hi = -Infinity, lo2 = Infinity, hi2 = -Infinity;
  for (const [X, Y] of pts) {
    const u = (X - r.cx) * Math.cos(ax) + (Y - r.cy) * Math.sin(ax), v = -(X - r.cx) * Math.sin(ax) + (Y - r.cy) * Math.cos(ax);
    lo = Math.min(lo, u); hi = Math.max(hi, u); lo2 = Math.min(lo2, v); hi2 = Math.max(hi2, v);
  }
  const major = hi - lo + cell, minor = hi2 - lo2 + cell;
  // cor de verdade: pontos avermelhados do pedaço, na foto mais de cima
  let best = 0, bestEl = -1;
  for (let k = 0; k < views.length; k++) { const { el } = elevation(views[k].cam, r.cx, r.cy); if (el > bestEl) { bestEl = el; best = k; } }
  const reds: number[][] = [];
  let green = [0, 0];
  const img = views[best].img;
  const sampleAt = (X: number, Y: number, Z: number) => {
    const p = project(views[best].cam, X, Y, Z);
    if (!p || p[0] < 0 || p[1] < 0 || p[0] >= img.width || p[1] >= img.height) return null;
    const o = ((p[1] | 0) * img.width + (p[0] | 0)) * 4;
    return [img.data[o], img.data[o + 1], img.data[o + 2]];
  };
  for (const [X, Y] of pts) {
    const c = sampleAt(X, Y, zTop * 0.9 + z0 * 0.1);
    if (c && c[0] > c[1] * 1.5 && c[0] > c[2] * 1.3 && c[0] > 70) reds.push(c);
  }
  // deitado: qual ponta tem o verde das folhinhas
  const upright = hh >= major * 0.7;
  if (!upright)
    for (const s of [1, -1] as const) {
      const X = r.cx + Math.cos(ax) * s * major * 0.42, Y = r.cy + Math.sin(ax) * s * major * 0.42;
      const c = sampleAt(X, Y, z0 + hh * 0.6);
      if (c && c[1] > c[0] * 1.05 && c[1] > c[2]) green[s === 1 ? 0 : 1]++;
    }
  const med = (k: number) => { const a = reds.map((c) => c[k]).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : [205, 32, 40][k]; };
  const color: [number, number, number] = reds.length >= 3 ? [med(0), med(1), med(2)] : [205, 32, 40];
  return {
    x: r.cx, y: r.cy, z0,
    len: upright ? Math.min(6, Math.max(1.8, hh)) : Math.min(6, Math.max(1.8, major)),
    rad: upright ? Math.min(3, Math.max(0.9, (major + minor) / 4)) : Math.min(3, Math.max(0.9, Math.min(hh, minor) / 2)),
    upright, ax, calyxAt: green[0] >= green[1] ? 1 : -1, color,
  };
}

/** Tira o pedaço do volume (vai ser substituído por outra malha). */
export function clearRegion(hf: HeightField, vol: Uint8Array, r: Region) {
  const N = hf.nx * hf.ny, nz = hf.nz!;
  for (const q of r.cells) for (let k = 0; k < nz; k++) vol[k * N + q] = 0;
}
