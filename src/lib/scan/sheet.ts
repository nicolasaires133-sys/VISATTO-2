// Folha A4 em branco como referência de medida (sem imprimir nada).
//
// Qualquer folha sulfite tem 21 × 29,7 cm. Achando os 4 cantos dela na imagem, o Visatto sabe a escala e de onde
// a câmera está olhando, como fazia com o quadrado preto impresso. Dois cuidados que o quadrado resolvia sozinho:
//  1. Qual lado é o comprido: resolvido pela geometria (só um dos dois jeitos combina com uma câmera de verdade).
//  2. Qual ponta é "cima" (a folha é igual girada 180°): resolvido seguindo a folha de um quadro para o outro e,
//     quando ela some e volta, comparando a mesa em volta (o prato fica de um lado só).
import { applyH, focalFrom35mm, DEFAULT_F35, homography, type Mat3, type Vec2 } from "./geometry";

export const A4 = { w: 21, h: 29.7 };
/** Cantos da folha no mundo (cm), centro na origem: TL, TR, BR, BL vistos de cima. */
export const SHEET_WORLD: Vec2[] = [
  [-A4.w / 2, A4.h / 2],
  [A4.w / 2, A4.h / 2],
  [A4.w / 2, -A4.h / 2],
  [-A4.w / 2, -A4.h / 2],
];

type Img = { data: Uint8ClampedArray; width: number; height: number };

const lumAt = (d: Uint8ClampedArray, o: number) => d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;

function bilinear(img: Img, x: number, y: number): number {
  const { data: d, width: w, height: h } = img;
  if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return NaN;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const o = (y0 * w + x0) * 4;
  const a = lumAt(d, o), b = lumAt(d, o + 4), c = lumAt(d, o + w * 4), e = lumAt(d, o + w * 4 + 4);
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy;
}

/** Limiar de Otsu num histograma de 256 posições. */
function otsu(hist: Float64Array, total: number) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) {
      best = v;
      t = i;
    }
  }
  return t;
}

function cross(o: Vec2, a: Vec2, b: Vec2) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}
function hull(pts: Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo: Vec2[] = [], up: Vec2[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const polyArea = (p: Vec2[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};

/** Tira vértices quase retos do contorno (sobram só as "quinas"). */
function simplify(h: Vec2[], maxN: number) {
  let p = [...h];
  while (p.length > maxN) {
    let bi = 0, bv = Infinity;
    for (let i = 0; i < p.length; i++) {
      const v = Math.abs(cross(p[(i - 1 + p.length) % p.length], p[i], p[(i + 1) % p.length]));
      if (v < bv) {
        bv = v;
        bi = i;
      }
    }
    p.splice(bi, 1);
  }
  return p;
}

/** Maior quadrilátero com vértices no contorno convexo. */
function bestQuad(h: Vec2[]): Vec2[] | null {
  const n = h.length;
  if (n < 4) return null;
  let best = -1, q: Vec2[] | null = null;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const area = Math.abs(polyArea([h[a], h[b], h[c], h[d]]));
          if (area > best) {
            best = area;
            q = [h[a], h[b], h[c], h[d]];
          }
        }
  return q;
}

function lineFit(pts: Vec2[]): { p: Vec2; d: Vec2 } | null {
  if (pts.length < 5) return null;
  let mx = 0, my = 0;
  for (const p of pts) {
    mx += p[0];
    my += p[1];
  }
  mx /= pts.length;
  my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) {
    const x = p[0] - mx, y = p[1] - my;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: [mx, my], d: [Math.cos(ang), Math.sin(ang)] };
}
function intersect(l1: { p: Vec2; d: Vec2 }, l2: { p: Vec2; d: Vec2 }): Vec2 | null {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
  return [l1.p[0] + l1.d[0] * t, l1.p[1] + l1.d[1] * t];
}

/** Ajuste fino: cada lado da folha vira uma reta pela borda clara→escura, e os cantos são os cruzamentos. */
function refine(img: Img, q: Vec2[]): Vec2[] {
  const lines: ({ p: Vec2; d: Vec2 } | null)[] = [];
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    // normal apontando para fora da folha
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const R = Math.max(4, len * 0.035);
    let pts: Vec2[] = [];
    const K = 28;
    for (let k = 0; k < K; k++) {
      const t = 0.12 + (0.76 * k) / (K - 1);
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      let bs = 0, bg = 0;
      const prof: number[] = [];
      for (let s = -R; s <= R; s += 0.5) prof.push(bilinear(img, px + nx * s, py + ny * s));
      for (let j = 1; j < prof.length - 1; j++) {
        const g = prof[j - 1] - prof[j + 1]; // claro (folha) → escuro (mesa), andando para fora
        if (g > bg) {
          bg = g;
          bs = j;
        }
      }
      if (bg < 12 || !bs || bs >= prof.length - 1) continue;
      // sub-pixel: parábola nos três vizinhos
      const g0 = prof[bs - 1 - 1 < 0 ? 0 : bs - 2] - prof[bs], g1 = bg, g2 = prof[bs] - prof[Math.min(prof.length - 1, bs + 2)];
      const off = g0 - 2 * g1 + g2 !== 0 ? (0.5 * (g0 - g2)) / (g0 - 2 * g1 + g2) : 0;
      const s = -R + (bs + Math.max(-1, Math.min(1, off))) * 0.5;
      if (Number.isFinite(s)) pts.push([px + nx * s, py + ny * s]);
    }
    let L = lineFit(pts);
    // tira os pontos fora da reta (sombra, dedo, prato encostado) e ajusta de novo
    for (let it = 0; it < 2 && L; it++) {
      const l = L;
      const res = pts.map((p) => Math.abs((p[0] - l.p[0]) * -l.d[1] + (p[1] - l.p[1]) * l.d[0]));
      const sorted = [...res].sort((x, y) => x - y);
      const cut = Math.max(1.2, sorted[Math.floor(sorted.length * 0.7)] * 2);
      pts = pts.filter((_, k) => res[k] <= cut);
      L = lineFit(pts);
    }
    lines.push(L);
  }
  const out: Vec2[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = lines[(i + 3) % 4], cur = lines[i];
    const p = prev && cur ? intersect(prev, cur) : null;
    // canto refinado só vale se ficou perto do canto grosseiro
    out.push(p && Math.hypot(p[0] - q[i][0], p[1] - q[i][1]) < Math.max(6, 0.06 * Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])) ? p : q[i]);
  }
  return out;
}

/**
 * Procura uma folha branca retangular na imagem. Devolve os 4 cantos em sentido horário (na imagem), começando
 * por qualquer um, ou null. A folha precisa aparecer inteira e contrastar com a mesa.
 */
export function detectSheet(img: Img): Vec2[] | null {
  const W = img.width, H = img.height;
  const step = Math.max(1, Math.round(Math.max(W, H) / 400));
  const w = Math.floor(W / step), h = Math.floor(H / step);
  const L = new Float32Array(w * h), S = new Float32Array(w * h);
  const hist = new Float64Array(256);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * step * W + x * step) * 4;
      const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      L[y * w + x] = l;
      S[y * w + x] = Math.max(r, g, b) - Math.min(r, g, b);
      hist[Math.min(255, l | 0)]++;
    }
  // brilho do papel: o limiar separa "claro" do resto; o papel ainda precisa ser quase sem cor
  let acc = 0, p98 = 255;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= w * h * 0.02) {
      p98 = i;
      break;
    }
  }
  const T = Math.max(otsu(hist, w * h), p98 * 0.62, 90);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (L[i] >= T && S[i] <= 26 + L[i] * 0.22) mask[i] = 1;

  // regiões conectadas
  const lab = new Int32Array(w * h);
  let best: { q: Vec2[]; score: number } | null = null;
  let id = 0;
  const stack: number[] = [];
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!mask[s0] || lab[s0]) continue;
    id++;
    stack.length = 0;
    stack.push(s0);
    lab[s0] = id;
    let area = 0, touches = 0;
    const rowMin = new Map<number, number>(), rowMax = new Map<number, number>();
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches++;
      if (!rowMin.has(y) || x < rowMin.get(y)!) rowMin.set(y, x);
      if (!rowMax.has(y) || x > rowMax.get(y)!) rowMax.set(y, x);
      if (x > 0 && mask[i - 1] && !lab[i - 1]) (lab[i - 1] = id), stack.push(i - 1);
      if (x < w - 1 && mask[i + 1] && !lab[i + 1]) (lab[i + 1] = id), stack.push(i + 1);
      if (y > 0 && mask[i - w] && !lab[i - w]) (lab[i - w] = id), stack.push(i - w);
      if (y < h - 1 && mask[i + w] && !lab[i + w]) (lab[i + w] = id), stack.push(i + w);
    }
    if (area < w * h * 0.006 || area > w * h * 0.7 || touches > 2) continue;
    const pts: Vec2[] = [];
    for (const [y, x] of rowMin) pts.push([x, y], [rowMax.get(y)! + 1, y], [x, y + 1], [rowMax.get(y)! + 1, y + 1]);
    const hl = hull(pts);
    const ha = Math.abs(polyArea(hl));
    const q = bestQuad(simplify(hl, 24));
    if (!q) continue;
    const qa = Math.abs(polyArea(q));
    // é um quadrilátero cheio? (prato redondo, guardanapo amassado e reflexos não passam)
    if (qa / ha < 0.9 || area / qa < 0.82) continue;
    // ângulos internos razoáveis e lados não minúsculos
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
      const v1: Vec2 = [a[0] - b[0], a[1] - b[1]], v2: Vec2 = [c[0] - b[0], c[1] - b[1]];
      const ang = (Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1)) * 180) / Math.PI;
      if (ang < 25 || ang > 155 || Math.hypot(...v2) < 8) ok = false;
    }
    if (!ok) continue;
    // contraste: a folha precisa ser bem mais clara que a mesa logo em volta
    const score = area * (area / qa);
    if (!best || score > best.score) best = { q, score };
  }
  if (!best) return null;
  let q = best.q.map(([x, y]) => [x * step, y * step] as Vec2);
  if (polyArea(q) < 0) q = q.reverse(); // horário na imagem (y para baixo)
  const r = refine(img, q);
  // nenhum canto encostado na borda da imagem (folha cortada mede errado)
  if (r.some(([x, y]) => x < 2 || y < 2 || x > W - 3 || y > H - 3)) return null;
  return r;
}

/** Os 4 jeitos de casar os cantos achados com os cantos da folha (girando a lista). */
export const rotate = (c: Vec2[], r: number): Vec2[] => [0, 1, 2, 3].map((i) => c[(i + r) % 4]);

/**
 * Quanto o jeito "r" combina com uma câmera de verdade: com o foco certo, os dois eixos da folha precisam ter o
 * mesmo comprimento depois de tirar a perspectiva. Valor perto de 0 = combina.
 */
export function aspectResidual(corners: Vec2[], r: number, f: number, width: number, height: number) {
  const Hm = homography(SHEET_WORLD, rotate(corners, r));
  const cx = width / 2, cy = height / 2;
  const col = (k: number) => {
    const x = (Hm[k] - cx * Hm[6 + k]) / f, y = (Hm[3 + k] - cy * Hm[6 + k]) / f, z = Hm[6 + k];
    return Math.hypot(x, y, z);
  };
  return Math.abs(Math.log(col(0) / col(1)));
}

/** Foco padrão de celular, para decidir o lado comprido antes de conhecer o foco de verdade. */
export const guessFocal = (width: number, height: number) => focalFrom35mm(DEFAULT_F35, width, height);

/** Mesa vista de cima em volta da folha (para reconhecer "de que lado" a câmera está). */
const PATCH = { half: 45, cell: 1.5 };
const PN = Math.round((2 * PATCH.half) / PATCH.cell);
export function topPatch(img: Img, H: Mat3): Float32Array {
  const out = new Float32Array(PN * PN).fill(NaN);
  const { data: d, width: w, height: h } = img;
  for (let j = 0; j < PN; j++)
    for (let i = 0; i < PN; i++) {
      const X = -PATCH.half + (i + 0.5) * PATCH.cell, Y = -PATCH.half + (j + 0.5) * PATCH.cell;
      if (Math.abs(X) < A4.w / 2 + 2 && Math.abs(Y) < A4.h / 2 + 2) continue; // a própria folha não ajuda
      const [u, v] = applyH(H, [X, Y]);
      const x = Math.round(u), y = Math.round(v);
      if (!(x >= 0 && y >= 0 && x < w && y < h)) continue;
      out[j * PN + i] = lumAt(d, (y * w + x) * 4);
    }
  return out;
}
function ncc(a: Float32Array, b: Float32Array) {
  let n = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === a[i] && b[i] === b[i]) (n++, (sa += a[i]), (sb += b[i]));
  if (n < 120) return { r: 0, n };
  const ma = sa / n, mb = sb / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++)
    if (a[i] === a[i] && b[i] === b[i]) {
      const x = a[i] - ma, y = b[i] - mb;
      ab += x * y;
      aa += x * x;
      bb += y * y;
    }
  return { r: aa && bb ? ab / Math.sqrt(aa * bb) : 0, n };
}

/**
 * Segue a folha ao longo dos quadros e devolve os cantos sempre na mesma ordem (TL, TR, BR, BL da folha),
 * para que todos os quadros concordem sobre onde fica cada lado da mesa.
 */
export class SheetTracker {
  private last: { c: Vec2[]; t: number; scale: number } | null = null;
  private sum: Float32Array | null = null;
  private cnt: Uint16Array | null = null;
  private focals: number[] = [];

  /** foco estimado até aqui (normalizado pelo maior lado da imagem), ou null */
  focalNorm(): number | null {
    if (this.focals.length < 3) return null;
    const s = [...this.focals].sort((a, b) => a - b);
    return s[s.length >> 1];
  }
  addFocal(fNorm: number) {
    if (this.focals.length < 300) this.focals.push(fNorm);
  }

  /**
   * @param corners cantos achados por detectSheet (horário, começo qualquer)
   * @param img imagem em que foram achados (para comparar a mesa em volta)
   * @param t relógio (ms) ou índice do quadro; "seguir" só vale entre quadros próximos
   * @param maxGap maior intervalo de t em que ainda dá para seguir pela posição
   */
  orient(corners: Vec2[], img: Img, t: number, maxGap = 900): Vec2[] | null {
    const W = img.width, Hh = img.height, side = Math.max(W, Hh);
    const fN = this.focalNorm();
    const f = fN ? fN * side : guessFocal(W, Hh);
    // 1. lado comprido: os jeitos 0/2 e 1/3 diferem nisso
    const res = [0, 1].map((r) => aspectResidual(corners, r, f, W, Hh));
    let pairs: number[][];
    if (Math.abs(res[0] - res[1]) > 0.08) pairs = [res[0] < res[1] ? [0, 2] : [1, 3]];
    else {
      // vista quase de cima: o lado mais comprido na imagem é o comprido de verdade
      const len = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const e01 = len(corners[0], corners[1]) + len(corners[2], corners[3]);
      const e12 = len(corners[1], corners[2]) + len(corners[3], corners[0]);
      // na folha do mundo, TL→TR é o lado curto (21 cm)
      pairs = Math.abs(e01 - e12) / Math.max(e01, e12) > 0.06 ? [e01 < e12 ? [0, 2] : [1, 3]] : [[0, 2], [1, 3]];
    }
    const cands = pairs.flat();

    // 2. ponta de cima: segue a posição do quadro anterior, se for recente
    let pick: number | null = null;
    const perim = corners.reduce((s, c, i) => s + Math.hypot(c[0] - corners[(i + 1) % 4][0], c[1] - corners[(i + 1) % 4][1]), 0);
    if (this.last && t - this.last.t <= maxGap) {
      const k = perim / this.last.scale;
      const d = cands.map((r) => rotate(corners, r).reduce((s, c, i) => s + Math.hypot(c[0] - this.last!.c[i][0] * 1, c[1] - this.last!.c[i][1] * 1), 0) / perim);
      const order = d.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
      if (order[0][0] < 0.35 && (order.length === 1 || order[0][0] < order[1][0] * 0.5) && k > 0.6 && k < 1.6) pick = cands[order[0][1]];
    }
    // 3. sem quadro recente: compara a mesa em volta com o que já foi visto
    if (pick === null) {
      if (!this.sum) pick = cands[0]; // primeiro quadro: define o "norte" da cena
      else {
        const ref = new Float32Array(this.sum.length);
        for (let i = 0; i < ref.length; i++) ref[i] = this.cnt![i] ? this.sum[i] / this.cnt![i] : NaN;
        const scores = cands.map((r) => ncc(ref, topPatch(img, homography(SHEET_WORLD, rotate(corners, r)))));
        const order = scores.map((s, i) => [s.r, i]).sort((a, b) => b[0] - a[0]);
        if (order[0][0] < 0.15 || (order.length > 1 && order[0][0] - order[1][0] < 0.12)) return null; // na dúvida, descarta
        pick = cands[order[0][1]];
      }
    }
    const out = rotate(corners, pick);
    this.last = { c: out, t, scale: perim };
    // guarda a vista de cima (já na orientação certa) para os próximos reencontros
    const p = topPatch(img, homography(SHEET_WORLD, out));
    if (!this.sum) {
      this.sum = new Float32Array(p.length);
      this.cnt = new Uint16Array(p.length);
    }
    for (let i = 0; i < p.length; i++)
      if (p[i] === p[i] && this.cnt![i] < 60000) {
        this.sum[i] += p[i];
        this.cnt![i]++;
      }
    return out;
  }

  /** Quebra o "seguir pela posição" (ex.: quadros de outra resolução). */
  reset() {
    this.last = null;
  }
}
