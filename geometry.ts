// Geometria de câmera para medir pratos a partir de fotos (sem dependências; roda no navegador e no Node).
//
// Sistema de coordenadas do "mundo" (em centímetros): a mesa é o plano Z = 0, Z aponta para cima.
// A origem é o centro da referência (marcador impresso ou cartão) e os eixos X/Y seguem as bordas dela.
//
// Referências: Zhang (2000) — calibração por homografia de plano; Criminisi, Reid & Zisserman (1999) —
// metrologia a partir de uma vista; Hartley & Zisserman — Multiple View Geometry (DLT, pose por homografia).

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Mat3 = number[]; // 9 valores, linha a linha

// ---------- álgebra básica ----------
export function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}
export function mulVec(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
export function inv3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("Matriz singular");
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, Hh = -(a * f - c * d), I = a * e - b * d;
  return [A / det, D / det, G / det, B / det, E / det, Hh / det, C / det, F / det, I / det];
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("Sistema sem solução");
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Homografia H que leva pontos do plano (src) para a imagem (dst): dst ~ H·src. 4 pontos exatos (DLT normalizado). */
export function homography(src: Vec2[], dst: Vec2[]): Mat3 {
  // normalização (Hartley) para estabilidade numérica
  const normT = (pts: Vec2[]) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const d = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length || 1;
    const k = Math.SQRT2 / d;
    return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1] as Mat3;
  };
  const Ts = normT(src), Td = normT(dst);
  const s = src.map((p) => mulVec(Ts, [p[0], p[1], 1]));
  const d = dst.map((p) => mulVec(Td, [p[0], p[1], 1]));
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = [s[i][0], s[i][1]], [u, v] = [d[i][0], d[i][1]];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  const Hn: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  const H = mul3(inv3(Td), mul3(Hn, Ts));
  const k = H[8];
  return H.map((x) => x / k);
}

export function applyH(H: Mat3, p: Vec2): Vec2 {
  const r = mulVec(H, [p[0], p[1], 1]);
  return [r[0] / r[2], r[1] / r[2]];
}

// ---------- câmera ----------
export type Camera = { f: number; cx: number; cy: number; R: Mat3; t: Vec3; width: number; height: number };

export function Kmat(f: number, cx: number, cy: number): Mat3 {
  return [f, 0, cx, 0, f, cy, 0, 0, 1];
}

/**
 * Estima a distância focal (em pixels) a partir da homografia de um plano, supondo pixels quadrados e
 * centro óptico no centro da imagem (Zhang). Retorna null quando a foto está muito "de frente" (mal condicionado).
 */
export function focalFromHomography(H: Mat3, cx: number, cy: number): number | null {
  // remove o centro óptico
  const T: Mat3 = [1, 0, -cx, 0, 1, -cy, 0, 0, 1];
  const G = mul3(T, H);
  const h1: Vec3 = [G[0], G[3], G[6]];
  const h2: Vec3 = [G[1], G[4], G[7]];
  // ω = diag(1/f², 1/f², 1): h1ᵀωh2 = 0 e h1ᵀωh1 = h2ᵀωh2
  const estimates: number[] = [];
  const a = h1[0] * h2[0] + h1[1] * h2[1];
  const b = h1[2] * h2[2];
  if (Math.abs(b) > 1e-12) {
    const f2 = -a / b;
    if (f2 > 0) estimates.push(Math.sqrt(f2));
  }
  const c = h1[0] * h1[0] + h1[1] * h1[1] - (h2[0] * h2[0] + h2[1] * h2[1]);
  const d = h2[2] * h2[2] - h1[2] * h1[2];
  if (Math.abs(d) > 1e-12) {
    const f2 = c / d;
    if (f2 > 0) estimates.push(Math.sqrt(f2));
  }
  if (!estimates.length) return null;
  const f = estimates.length === 2 ? Math.sqrt(estimates[0] * estimates[1]) : estimates[0];
  // confiável apenas se as duas estimativas concordam e o valor é plausível para um celular
  if (estimates.length === 2 && Math.abs(estimates[0] - estimates[1]) / f > 0.12) return null;
  const size = Math.max(cx, cy) * 2;
  if (f < size * 0.45 || f > size * 3) return null;
  return f;
}

/** Foco equivalente em 35 mm (EXIF) → pixels. */
export function focalFrom35mm(f35: number, width: number, height: number) {
  return (f35 * Math.hypot(width, height)) / Math.hypot(36, 24);
}

/** Câmera principal típica de celular (~26 mm equivalentes) quando não há outra informação. */
export const DEFAULT_F35 = 26;

/** Pose da câmera (R, t: mundo → câmera) a partir da homografia mundo(Z=0) → imagem e do foco. */
export function poseFromHomography(H: Mat3, f: number, cx: number, cy: number, width: number, height: number): Camera {
  const Ki = inv3(Kmat(f, cx, cy));
  const B = mul3(Ki, H);
  let b1: Vec3 = [B[0], B[3], B[6]];
  let b2: Vec3 = [B[1], B[4], B[7]];
  let b3: Vec3 = [B[2], B[5], B[8]];
  let lambda = 2 / (norm(b1) + norm(b2));
  if (b3[2] * lambda < 0) lambda = -lambda; // a mesa precisa estar na frente da câmera
  let r1 = scale(b1, lambda), r2 = scale(b2, lambda);
  const t = scale(b3, lambda);
  // ortonormaliza (r1, r2) preservando a simetria
  const c = add(r1, r2), d = sub(r1, r2);
  const cn = norm(c), dn = norm(d);
  r1 = scale(add(scale(c, 1 / cn), scale(d, 1 / dn)), Math.SQRT1_2);
  r2 = scale(sub(scale(c, 1 / cn), scale(d, 1 / dn)), Math.SQRT1_2);
  const r3 = cross(r1, r2);
  const R: Mat3 = [r1[0], r2[0], r3[0], r1[1], r2[1], r3[1], r1[2], r2[2], r3[2]];
  return { f, cx, cy, R, t, width, height };
}

/** Projeta um ponto do mundo (cm) na imagem. */
export function project(cam: Camera, P: Vec3): Vec2 {
  const pc = add(mulVec(cam.R, P), cam.t);
  return [cam.f * (pc[0] / pc[2]) + cam.cx, cam.f * (pc[1] / pc[2]) + cam.cy];
}

/** Profundidade (distância ao longo do eixo da câmera) de um ponto do mundo; > 0 se visível. */
export function depthOf(cam: Camera, P: Vec3) {
  return add(mulVec(cam.R, P), cam.t)[2];
}

export function cameraCenter(cam: Camera): Vec3 {
  return scale(mulVec(transpose(cam.R), cam.t), -1);
}

/** Raio (origem, direção) no mundo que passa por um pixel. */
export function pixelRay(cam: Camera, p: Vec2): { o: Vec3; d: Vec3 } {
  const dc: Vec3 = [(p[0] - cam.cx) / cam.f, (p[1] - cam.cy) / cam.f, 1];
  const d = mulVec(transpose(cam.R), dc);
  const n = norm(d);
  return { o: cameraCenter(cam), d: scale(d, 1 / n) };
}

/** Ponto da mesa (Z = z) atingido pelo raio do pixel. */
export function pixelToPlane(cam: Camera, p: Vec2, z = 0): Vec3 | null {
  const { o, d } = pixelRay(cam, p);
  if (Math.abs(d[2]) < 1e-9) return null;
  const s = (z - o[2]) / d[2];
  if (s <= 0) return null;
  return add(o, scale(d, s));
}

/**
 * Altura (cm) do ponto da imagem `top` sobre a reta vertical que passa por (x, y) da mesa:
 * menor distância entre o raio do pixel e essa reta (metrologia de uma vista).
 */
export function heightOnVertical(cam: Camera, top: Vec2, x: number, y: number): number {
  const { o, d } = pixelRay(cam, top);
  const p0: Vec3 = [x, y, 0];
  const u: Vec3 = [0, 0, 1];
  const w0 = sub(o, p0);
  const a = dot(d, d), b = dot(d, u), c = dot(u, u), dd = dot(d, w0), e = dot(u, w0);
  const den = a * c - b * b;
  if (Math.abs(den) < 1e-9) return NaN; // olhando exatamente de cima: altura indefinida
  return (a * e - b * dd) / den;
}

/** Ângulo (graus) entre o eixo da câmera e a mesa: 90 = de cima, 0 = rente à mesa. */
export function viewElevation(cam: Camera) {
  const dir = mulVec(transpose(cam.R), [0, 0, 1]);
  return (Math.asin(-dir[2] / norm(dir)) * 180) / Math.PI;
}

/** Monta a câmera de uma foto a partir dos 4 cantos da referência na imagem. */
export function calibrate(opts: {
  corners: Vec2[]; // TL, TR, BR, BL na imagem
  refW: number; // largura real da referência (cm)
  refH: number; // altura real da referência (cm)
  width: number;
  height: number;
  f35?: number | null; // foco equivalente do EXIF, se houver
  fKnown?: number | null; // foco já conhecido (ex.: de outra foto da mesma câmera)
}): { cam: Camera; H: Mat3; focalSource: "exif" | "foto" | "padrao" | "conhecido" } {
  const { corners, refW, refH, width, height } = opts;
  const w = refW / 2, h = refH / 2;
  const world: Vec2[] = [[-w, h], [w, h], [w, -h], [-w, -h]];
  const H = homography(world, corners);
  const cx = width / 2, cy = height / 2;
  let f: number | null = null;
  let focalSource: "exif" | "foto" | "padrao" | "conhecido" = "padrao";
  if (opts.fKnown) {
    f = opts.fKnown;
    focalSource = "conhecido";
  } else if (opts.f35 && opts.f35 > 10 && opts.f35 < 200) {
    f = focalFrom35mm(opts.f35, width, height);
    focalSource = "exif";
  } else {
    const est = focalFromHomography(H, cx, cy);
    if (est) {
      f = est;
      focalSource = "foto";
    }
  }
  if (!f) f = focalFrom35mm(DEFAULT_F35, width, height);
  return { cam: poseFromHomography(H, f, cx, cy, width, height), H, focalSource };
}
