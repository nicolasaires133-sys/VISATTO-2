// Modelo 3D de verdade (não só um "relevo" visto de cima): a partir do volume ocupado (recon.ts),
// gera a superfície fechada com "surface nets" e pinta com os quadros do vídeo.
// Pega qualquer formato: taça com haste, sorvete transbordando, casquinha no suporte, pão em pé, espetinho grosso...
import type { Camera, Vec3 } from "./geometry";
import { cameraCenter } from "./geometry";
import type { Dish, HeightField, RGBA, View } from "./recon";
import type { HeightMesh } from "./heightmesh";

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Volume final do produto: casco visual, limitado pelo topo calculado pelas cores e pelo contorno do prato. */
export function finalVolume(hf: HeightField, dish: Dish) {
  const { nx, ny } = hf, nz = hf.nz!, dz = hf.dz!, occ = hf.occ!;
  const N = nx * ny;
  // contorno um pouco maior (as laterais de itens que se abrem por cima, como taças, ficam fora do "pé")
  const grow = new Uint8Array(N);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let m = 0;
      for (let d = -3; d <= 3 && !m; d++) for (let e = -3; e <= 3 && !m; e++) {
        const ii = i + d, jj = j + e;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && dish.mask[jj * nx + ii]) m = 1;
      }
      grow[j * nx + i] = m;
    }
  const F = new Uint8Array(N * nz);
  for (let q = 0; q < N; q++) {
    if (!grow[q]) continue;
    const top = hf.h[q] + dz * 0.5;
    for (let k = 0; k < nz && k * dz <= top; k++) if (occ[k * N + q]) F[k * N + q] = 1;
  }
  keepLargest(F, nx, ny, nz);
  fillCavities(F, nx, ny, nz);
  return F;
}

function keepLargest(F: Uint8Array, nx: number, ny: number, nz: number) {
  const N = nx * ny, lab = new Int32Array(F.length), stack: number[] = [];
  let best = 0, bestSize = 0, id = 0;
  for (let s = 0; s < F.length; s++) {
    if (!F[s] || lab[s]) continue;
    id++;
    let size = 0;
    stack.push(s);
    lab[s] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const k = (p / N) | 0, q = p - k * N, i = q % nx, j = (q / nx) | 0;
      const nb = [i > 0 ? p - 1 : -1, i < nx - 1 ? p + 1 : -1, j > 0 ? p - nx : -1, j < ny - 1 ? p + nx : -1, k > 0 ? p - N : -1, k < nz - 1 ? p + N : -1];
      for (const t of nb) if (t >= 0 && F[t] && !lab[t]) { lab[t] = id; stack.push(t); }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  for (let s = 0; s < F.length; s++) if (F[s] && lab[s] !== best) F[s] = 0;
}

/** Espaços vazios fechados dentro do volume viram cheios (não há como vê-los, e evitam superfícies internas). */
function fillCavities(F: Uint8Array, nx: number, ny: number, nz: number) {
  const N = nx * ny, out = new Uint8Array(F.length), stack: number[] = [];
  const push = (p: number) => { if (!F[p] && !out[p]) { out[p] = 1; stack.push(p); } };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) push(k * N + j * nx + i);
  while (stack.length) {
    const p = stack.pop()!;
    const k = (p / N) | 0, q = p - k * N, i = q % nx, j = (q / nx) | 0;
    if (i > 0) push(p - 1);
    if (i < nx - 1) push(p + 1);
    if (j > 0) push(p - nx);
    if (j < ny - 1) push(p + nx);
    if (k > 0) push(p - N);
    if (k < nz - 1) push(p + N);
  }
  for (let p = 0; p < F.length; p++) if (!F[p] && !out[p]) F[p] = 1;
}

export async function buildVolumeMesh(
  hf: HeightField,
  dish: Dish,
  views: View[],
  onProgress?: (p: number) => void,
  opts: {
    maxTex?: number;
    step?: number;
    /** cores que não pertencem à comida perto da base (a louça): onde aparecem, a cor vem da própria comida */
    bleed?: number[][];
    /** onde a comida é clara de verdade (não tirar a cor de louça dali) */
    pale?: (x: number, y: number) => boolean;
    /** sombreado dos encaixes pintado na textura (padrão: sim) */
    ao?: boolean;
    /** quantas rodadas de alisamento (padrão 4) */
    smooth?: number;
    /** de quantas em quantas camadas (altura) sai um vértice; padrão ≈ 0,5 cm */
    stepZ?: number;
    /** volume já pronto (ex.: só a comida, sem a louça); se ausente, usa o volume inteiro do produto */
    volume?: Uint8Array;
    /** altura da louça em cada ponto (cm): o que fica abaixo dela está escondido e não vira face */
    floor?: (x: number, y: number) => number;
  } = {},
): Promise<HeightMesh> {
  const { nx, ny, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!;
  const N = nx * ny;
  const F = opts.volume ?? finalVolume(hf, dish);
  const [cx, cy] = dish.centroid;
  const floor = opts.floor;

  // ---- campo suavizado numa grade 2× mais grossa (≈8 mm × 5 mm): a forma continua fiel, a malha fica ~4× mais
  // leve (arquivo menor, abre mais rápido) e os detalhes ficam por conta da textura. Borda de 1 vazia em volta.
  const S = opts.step ?? 2, SZ = opts.stepZ ?? Math.max(1, Math.round(0.5 / dz));
  const mx = Math.ceil(nx / S), my = Math.ceil(ny / S), mz = Math.ceil(nz / SZ);
  const PX = mx + 2, PY = my + 2, PZ = mz + 2, PN = PX * PY;
  const f = new Float32Array(PX * PY * PZ);
  const at = (i: number, j: number, k: number) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? 0 : F[k * N + j * nx + i]);
  for (let k = 0; k < mz; k++)
    for (let j = 0; j < my; j++)
      for (let i = 0; i < mx; i++) {
        // média do bloco, alargado em 1 voxel fino para cada lado (suaviza)
        let s = 0, n = 0;
        for (let c = k * SZ - 1; c <= k * SZ + SZ; c++)
          for (let b = j * S - 1; b <= j * S + S; b++)
            for (let a = i * S - 1; a <= i * S + S; a++) { s += at(a, b, c); n++; }
        f[(k + 1) * PN + (j + 1) * PX + (i + 1)] = s / n;
      }
  const ISO = 0.5;
  const P = (i: number, j: number, k: number): Vec3 => [
    x0 + ((i - 1) * S + S / 2) * cell,
    y0 + ((j - 1) * S + S / 2) * cell,
    ((k - 1) * SZ + (SZ - 1) / 2) * dz,
  ];

  // ---- surface nets: um vértice por cubinho cortado pela superfície
  const cellVert = new Int32Array((PX - 1) * (PY - 1) * (PZ - 1)).fill(-1);
  const verts: number[] = [];
  const CI = (i: number, j: number, k: number) => (k * (PY - 1) + j) * (PX - 1) + i;
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < PZ - 1; k++)
    for (let j = 0; j < PY - 1; j++)
      for (let i = 0; i < PX - 1; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const [a, b, d] = corners[c];
          val[c] = f[(k + d) * PN + (j + b) * PX + (i + a)];
          if (val[c] > ISO) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [e0, e1] of edges) {
          const v0 = val[e0], v1 = val[e1];
          if (v0 > ISO === v1 > ISO) continue;
          const t = (ISO - v0) / (v1 - v0);
          const A = corners[e0], B = corners[e1];
          sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
        }
        const p = P(i + sx / n, j + sy / n, k + sz / n);
        cellVert[CI(i, j, k)] = verts.length / 3;
        verts.push(p[0], p[1], Math.max(0, p[2]));
      }
  // quadrados: um para cada aresta da grade que cruza a superfície
  const quads: number[] = [];
  const addQuad = (a: number, b: number, c: number, d: number, outward: Vec3) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const pa = [verts[a * 3], verts[a * 3 + 1], verts[a * 3 + 2]], pb = [verts[b * 3], verts[b * 3 + 1], verts[b * 3 + 2]];
    const pc = [verts[c * 3], verts[c * 3 + 1], verts[c * 3 + 2]], pd = [verts[d * 3], verts[d * 3 + 1], verts[d * 3 + 2]];
    const u = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]], v = [pd[0] - pb[0], pd[1] - pb[1], pd[2] - pb[2]];
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    // base apoiada na mesa (ou escondida dentro da louça): não precisa de face (ninguém vê, e economiza textura)
    const hid = (q: number[]) => q[2] < (floor ? Math.max(0.15, floor(q[0], q[1]) - 0.3) : 0.15);
    if (hid(pa) && hid(pb) && hid(pc) && hid(pd)) return;
    if (nrm[0] * outward[0] + nrm[1] * outward[1] + nrm[2] * outward[2] >= 0) quads.push(a, b, c, d);
    else quads.push(a, d, c, b);
  };
  for (let k = 1; k < PZ - 1; k++)
    for (let j = 1; j < PY - 1; j++)
      for (let i = 1; i < PX - 1; i++) {
        const v0 = f[k * PN + j * PX + i] > ISO;
        // aresta em x: entre (i,j,k) e (i+1,j,k); cubinhos (i, j-1..j, k-1..k)
        if (i < PX - 1 && v0 !== f[k * PN + j * PX + i + 1] > ISO)
          addQuad(cellVert[CI(i, j - 1, k - 1)], cellVert[CI(i, j, k - 1)], cellVert[CI(i, j, k)], cellVert[CI(i, j - 1, k)], [v0 ? 1 : -1, 0, 0]);
        if (j < PY - 1 && v0 !== f[k * PN + (j + 1) * PX + i] > ISO)
          addQuad(cellVert[CI(i - 1, j, k - 1)], cellVert[CI(i - 1, j, k)], cellVert[CI(i, j, k)], cellVert[CI(i, j, k - 1)], [0, v0 ? 1 : -1, 0]);
        if (k < PZ - 1 && v0 !== f[(k + 1) * PN + j * PX + i] > ISO)
          addQuad(cellVert[CI(i - 1, j - 1, k)], cellVert[CI(i, j - 1, k)], cellVert[CI(i, j, k)], cellVert[CI(i - 1, j, k)], [0, 0, v0 ? 1 : -1]);
      }
  onProgress?.(0.15);
  await tick();

  // ---- suaviza a superfície (tira o "degrau" dos voxels)
  const nV = verts.length / 3;
  const nbr: number[][] = Array.from({ length: nV }, () => []);
  for (let q = 0; q < quads.length; q += 4)
    for (let e = 0; e < 4; e++) {
      const a = quads[q + e], b = quads[q + ((e + 1) % 4)];
      nbr[a].push(b);
      nbr[b].push(a);
    }
  let pos = Float32Array.from(verts);
  // 1 passada simples (tira o degrau) + suavização de Taubin (alisa os calombos sem encolher a forma)
  const lams = [0.5];
  for (let i = 0; i < (opts.smooth ?? 4); i++) lams.push(0.5, -0.53);
  for (const lam of lams) {
    const next = new Float32Array(pos);
    for (let v = 0; v < nV; v++) {
      const L = nbr[v];
      if (!L.length) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const w of L) { sx += pos[w * 3]; sy += pos[w * 3 + 1]; sz += pos[w * 3 + 2]; }
      next[v * 3] = pos[v * 3] + (sx / L.length - pos[v * 3]) * lam;
      next[v * 3 + 1] = pos[v * 3 + 1] + (sy / L.length - pos[v * 3 + 1]) * lam;
      next[v * 3 + 2] = pos[v * 3 + 2] < 0.05 ? 0 : Math.max(0, pos[v * 3 + 2] + (sz / L.length - pos[v * 3 + 2]) * lam);
    }
    pos = next;
  }
  // normais por vértice
  const vn = new Float32Array(nV * 3);
  for (let q = 0; q < quads.length; q += 4) {
    const a = quads[q], b = quads[q + 1], c = quads[q + 2], d = quads[q + 3];
    const u = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
    const v = [pos[d * 3] - pos[b * 3], pos[d * 3 + 1] - pos[b * 3 + 1], pos[d * 3 + 2] - pos[b * 3 + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const w of [a, b, c, d]) { vn[w * 3] += n[0]; vn[w * 3 + 1] += n[1]; vn[w * 3 + 2] += n[2]; }
  }
  for (let v = 0; v < nV; v++) {
    const l = Math.hypot(vn[v * 3], vn[v * 3 + 1], vn[v * 3 + 2]) || 1;
    vn[v * 3] /= l; vn[v * 3 + 1] /= l; vn[v * 3 + 2] /= l;
  }

  // ---- quanto cada quadro "vale" para cada vértice: de frente, perto e sem nada na frente
  const V = views.length, centers = views.map((v) => cameraCenter(v.cam));
  const gains = hf.gains ?? views.map(() => [1, 1, 1]);
  const occupied = (X: number, Y: number, Z: number) => {
    const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell), k = Math.round(Z / dz);
    return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && F[k * N + j * nx + i] === 1;
  };
  const zTop = nz * dz;
  const W8 = new Float32Array(nV * V);
  for (let v = 0; v < nV; v++) {
    const p: Vec3 = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [vn[v * 3], vn[v * 3 + 1], vn[v * 3 + 2]];
    for (let c = 0; c < V; c++) {
      const C = centers[c];
      const dx = C[0] - p[0], dy = C[1] - p[1], dzz = C[2] - p[2], dl = Math.hypot(dx, dy, dzz);
      const facing = (n[0] * dx + n[1] * dy + n[2] * dzz) / dl;
      if (facing < 0.12) continue;
      // anda do ponto até a câmera; se atravessar o volume, está escondido
      const step = Math.min(cell, dz) * 1.2, sx = (dx / dl) * step, sy = (dy / dl) * step, sz = (dzz / dl) * step;
      let x = p[0] + n[0] * 0.6, y = p[1] + n[1] * 0.6, z = p[2] + n[2] * 0.6, hidden = false;
      for (let s = 0; s < 400 && z < zTop; s++) {
        if (occupied(x, y, z)) { hidden = true; break; }
        x += sx; y += sy; z += sz;
      }
      if (hidden) continue;
      const cam = views[c].cam;
      const zc = cam.R[6] * p[0] + cam.R[7] * p[1] + cam.R[8] * p[2] + cam.t[2];
      if (zc <= 1) continue;
      W8[v * V + c] = facing * facing * facing * (cam.f / zc) ** 2;
    }
    if (v % 1500 === 0) { onProgress?.(0.15 + (v / nV) * 0.35); await tick(); }
  }

  // ---- atlas de textura: um quadradinho por quadrado da malha
  const nQ = quads.length / 4;
  const maxTex = opts.maxTex ?? 2048;
  const per = Math.ceil(Math.sqrt(nQ));
  // cada quadradinho tem 1 texel de margem repetindo a borda: evita "costuras" entre vizinhos no atlas
  const st = Math.max(6, Math.min(28, Math.floor(maxTex / per))), cs = st - 2;
  const TW = Math.min(maxTex, per * st), ncol = Math.floor(TW / st), rows = Math.ceil(nQ / ncol), TH = Math.min(maxTex, rows * st);
  const tex = new Uint8ClampedArray(TW * TH * 4);
  const seen = new Uint8Array(nQ);
  const qColor = new Float32Array(nQ * 3);
  const proj = (cam: Camera, X: number, Y: number, Z: number): [number, number, number] => {
    const R = cam.R, t = cam.t, zc = R[6] * X + R[7] * Y + R[8] * Z + t[2];
    return [(cam.f * (R[0] * X + R[1] * Y + R[2] * Z + t[0])) / zc + cam.cx, (cam.f * (R[3] * X + R[4] * Y + R[5] * Z + t[1])) / zc + cam.cy, zc];
  };
  const sampleImg = (img: RGBA, x: number, y: number, out: number[]) => {
    if (x < 1 || y < 1 || x > img.width - 2 || y > img.height - 2) return false;
    const x0_ = x | 0, y0_ = y | 0, fx = x - x0_, fy = y - y0_, w = img.width, d = img.data;
    const i00 = (y0_ * w + x0_) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
    const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, e = fx * fy;
    for (let ch = 0; ch < 3; ch++) out[ch] = d[i00 + ch] * a + d[i10 + ch] * b + d[i01 + ch] * c + d[i11 + ch] * e;
    return true;
  };
  const c3 = [0, 0, 0];
  const uvs = new Float32Array(nQ * 4 * 2), positions = new Float32Array(nQ * 4 * 3), normals = new Float32Array(nQ * 4 * 3), indices = new Uint32Array(nQ * 6);
  const wv = new Float32Array(V), cols = new Float32Array(V * 3);
  for (let q = 0; q < nQ; q++) {
    const vi = [quads[q * 4], quads[q * 4 + 1], quads[q * 4 + 2], quads[q * 4 + 3]];
    const ox = (q % ncol) * st + 1, oy = Math.floor(q / ncol) * st + 1;
    // cantos do quadrado no atlas: centros dos texels da borda (sem "vazar" para o vizinho)
    const u0 = (ox + 0.5) / TW, u1 = (ox + cs - 0.5) / TW, v0 = 1 - (oy + 0.5) / TH, v1 = 1 - (oy + cs - 0.5) / TH;
    const quv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let e = 0; e < 4; e++) {
      const w = vi[e], o = q * 4 + e;
      positions[o * 3] = (pos[w * 3] - cx) / 100;
      positions[o * 3 + 1] = pos[w * 3 + 2] / 100;
      positions[o * 3 + 2] = -(pos[w * 3 + 1] - cy) / 100;
      // normais suaves (as mesmas do vértice compartilhado): a superfície não fica "facetada"
      normals[o * 3] = vn[w * 3];
      normals[o * 3 + 1] = vn[w * 3 + 2];
      normals[o * 3 + 2] = -vn[w * 3 + 1];
      uvs[o * 2] = quv[e][0];
      uvs[o * 2 + 1] = quv[e][1];
    }
    indices.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    // quadros que enxergam algum canto deste quadrado
    const camList: number[] = [];
    for (let c = 0; c < V; c++) if (W8[vi[0] * V + c] + W8[vi[1] * V + c] + W8[vi[2] * V + c] + W8[vi[3] * V + c] > 0) camList.push(c);
    if (!camList.length) continue;
    // sem louça separada: o pé encostado na mesa pega a cor da mesa nas fotos; melhor herdar a cor de cima
    if (!floor && pos[vi[0] * 3 + 2] < 0.7 && pos[vi[1] * 3 + 2] < 0.7 && pos[vi[2] * 3 + 2] < 0.7 && pos[vi[3] * 3 + 2] < 0.7) continue;
    let sr = 0, sg = 0, sb = 0, sn = 0;
    for (let py = 0; py < cs; py++)
      for (let px = 0; px < cs; px++) {
        const s = px / (cs - 1), t = py / (cs - 1);
        const b0 = (1 - s) * (1 - t), b1 = s * (1 - t), b2 = s * t, b3 = (1 - s) * t;
        const X = b0 * pos[vi[0] * 3] + b1 * pos[vi[1] * 3] + b2 * pos[vi[2] * 3] + b3 * pos[vi[3] * 3];
        const Y = b0 * pos[vi[0] * 3 + 1] + b1 * pos[vi[1] * 3 + 1] + b2 * pos[vi[2] * 3 + 1] + b3 * pos[vi[3] * 3 + 1];
        const Z = b0 * pos[vi[0] * 3 + 2] + b1 * pos[vi[1] * 3 + 2] + b2 * pos[vi[2] * 3 + 2] + b3 * pos[vi[3] * 3 + 2];
        let r = 0, g = 0, b = 0, ws = 0, wmax = 0, m = 0;
        for (const c of camList) {
          const w = b0 * W8[vi[0] * V + c] + b1 * W8[vi[1] * V + c] + b2 * W8[vi[2] * V + c] + b3 * W8[vi[3] * V + c];
          if (w <= 0) continue;
          const [u, vv] = proj(views[c].cam, X, Y, Z);
          if (!sampleImg(views[c].img, u, vv, c3)) continue;
          const gn = gains[c];
          wv[m] = w; cols[m * 3] = c3[0] * gn[0]; cols[m * 3 + 1] = c3[1] * gn[1]; cols[m * 3 + 2] = c3[2] * gn[2]; m++;
          if (w > wmax) wmax = w;
        }
        // a melhor foto de cada ponto manda (peso relativo ao cubo): misturar muitas fotos borra a pintura
        for (let e = 0; e < m; e++) {
          // potência alta: a melhor foto de cada ponto manda quase sozinha (misturar várias borra os detalhes, como os grãos)
          const w = (wv[e] / wmax) ** 7;
          r += cols[e * 3] * w; g += cols[e * 3 + 1] * w; b += cols[e * 3 + 2] * w; ws += w;
        }
        if (ws <= 0) continue;
        // ponto com cor de louça no pé da comida: é o prato aparecendo por erro de encaixe. Fica sem pintura aqui
        // e depois recebe a cor da comida em volta. (Comida clara de verdade, como arroz, é poupada.)
        if (floor && opts.bleed && Z < floor(X, Y) + 3 && !(opts.pale && opts.pale(X, Y))) {
          const pr = r / ws, pg = g / ws, pb = b / ws, bl = opts.bleed[0];
          const k = Math.max(1, Math.min(2.2, (0.3 * bl[0] + 0.59 * bl[1] + 0.11 * bl[2]) / Math.max(1, 0.3 * pr + 0.59 * pg + 0.11 * pb)));
          if (Math.abs(pr * k - bl[0]) + Math.abs(pg * k - bl[1]) + Math.abs(pb * k - bl[2]) < 40) continue;
        }
        const o = ((oy + py) * TW + ox + px) * 4;
        tex[o] = r / ws; tex[o + 1] = g / ws; tex[o + 2] = b / ws; tex[o + 3] = 255;
        sr += r / ws; sg += g / ws; sb += b / ws; sn++;
      }
    if (sn) {
      seen[q] = sn === cs * cs ? 1 : 2;
      qColor[q * 3] = sr / sn; qColor[q * 3 + 1] = sg / sn; qColor[q * 3 + 2] = sb / sn;
    }
    if (q % 600 === 0) { onProgress?.(0.5 + (q / nQ) * 0.48); await tick(); }
  }
  // Sem louça separada: na parte de baixo, o que saiu com cor de mesa é a mesa aparecendo por trás de um pé mais
  // estreito que o corpo (forminha de cupcake, base de taça). Fica melhor herdando a cor do próprio produto.
  // Com louça separada vale o mesmo para a cor da louça: no pé da comida, embaixo de uma aba (alface, borda do
  // pão), o que saiu "branco de prato" é o prato aparecendo por trás.
  const bleed = floor ? opts.bleed : hf.table;
  if (bleed?.length) {
    let top = 0;
    for (let v = 0; v < nV; v++) top = Math.max(top, pos[v * 3 + 2]);
    const isTable = (q: number) => {
      let m = Infinity;
      for (const p of bleed) {
        // com louça: compara depois de igualar o brilho (a louça na sombra da comida continua sendo louça)
        const lq = 0.3 * qColor[q * 3] + 0.59 * qColor[q * 3 + 1] + 0.11 * qColor[q * 3 + 2], lp = 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2];
        const k = floor ? Math.max(1, Math.min(2.2, lp / Math.max(1, lq))) : 1;
        m = Math.min(m, Math.abs(qColor[q * 3] * k - p[0]) + Math.abs(qColor[q * 3 + 1] * k - p[1]) + Math.abs(qColor[q * 3 + 2] * k - p[2]));
      }
      return m < 42;
    };
    let low = 0, hit = 0;
    const mark: number[] = [];
    for (let q = 0; q < nQ; q++) {
      if (!seen[q]) continue;
      const z = (pos[quads[q * 4] * 3 + 2] + pos[quads[q * 4 + 2] * 3 + 2]) / 2;
      if (floor ? z > floor(pos[quads[q * 4] * 3], pos[quads[q * 4] * 3 + 1]) + 3 : z > top * 0.45) continue;
      if (floor && opts.pale && opts.pale(pos[quads[q * 4] * 3], pos[quads[q * 4] * 3 + 1])) continue; // comida clara de verdade
      low++;
      if (isTable(q)) { hit++; mark.push(q); }
    }
    // se quase tudo embaixo tem cor de mesa, o produto é que é dessa cor (pão numa mesa de madeira): não mexe
    if (hit < low * 0.8)
      for (const q of mark) {
        seen[q] = 0;
        const ox = (q % ncol) * st + 1, oy = Math.floor(q / ncol) * st + 1;
        for (let py = 0; py < cs; py++) for (let px = 0; px < cs; px++) tex[((oy + py) * TW + ox + px) * 4 + 3] = 0;
      }
  }
  // partes que nenhum quadro viu (embaixo da borda de uma taça, o pé com cor de mesa): a cor "escorre" das partes
  // vistas pela superfície, vértice a vértice, e o quadrado é pintado em degradê (sem blocos de cor chapada)
  let avg = [200, 170, 130];
  { let s = [0, 0, 0], n = 0; for (let q = 0; q < nQ; q++) if (seen[q]) { s[0] += qColor[q * 3]; s[1] += qColor[q * 3 + 1]; s[2] += qColor[q * 3 + 2]; n++; } if (n) avg = s.map((v) => v / n); }
  const vc = new Float32Array(nV * 3), vw = new Float32Array(nV);
  for (let q = 0; q < nQ; q++) {
    if (!seen[q]) continue;
    for (let e = 0; e < 4; e++) {
      const w = quads[q * 4 + e];
      vc[w * 3] += qColor[q * 3]; vc[w * 3 + 1] += qColor[q * 3 + 1]; vc[w * 3 + 2] += qColor[q * 3 + 2]; vw[w]++;
    }
  }
  const known = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) if (vw[v]) { vc[v * 3] /= vw[v]; vc[v * 3 + 1] /= vw[v]; vc[v * 3 + 2] /= vw[v]; known[v] = 1; }
  for (let it = 0; it < 80; it++) {
    const add: number[] = [];
    for (let v = 0; v < nV; v++) {
      if (known[v]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const w of nbr[v]) if (known[w] === 1) { r += vc[w * 3]; g += vc[w * 3 + 1]; b += vc[w * 3 + 2]; n++; }
      if (n) { vc[v * 3] = r / n; vc[v * 3 + 1] = g / n; vc[v * 3 + 2] = b / n; add.push(v); }
    }
    if (!add.length) break;
    for (const v of add) known[v] = 2; // 2 = preenchido (entra como fonte na próxima rodada)
    for (const v of add) known[v] = 1;
  }
  for (let v = 0; v < nV; v++) if (!known[v]) { vc[v * 3] = avg[0]; vc[v * 3 + 1] = avg[1]; vc[v * 3 + 2] = avg[2]; }
  // alisa só o que foi preenchido
  for (let it = 0; it < 4; it++)
    for (let v = 0; v < nV; v++) {
      if (vw[v] || !nbr[v].length) continue;
      let r = 0, g = 0, b = 0;
      for (const w of nbr[v]) { r += vc[w * 3]; g += vc[w * 3 + 1]; b += vc[w * 3 + 2]; }
      const n = nbr[v].length;
      vc[v * 3] = (vc[v * 3] + r / n) / 2; vc[v * 3 + 1] = (vc[v * 3 + 1] + g / n) / 2; vc[v * 3 + 2] = (vc[v * 3 + 2] + b / n) / 2;
    }
  for (let q = 0; q < nQ; q++) {
    if (seen[q] === 1) continue;
    const vi = [quads[q * 4], quads[q * 4 + 1], quads[q * 4 + 2], quads[q * 4 + 3]];
    const ox = (q % ncol) * st + 1, oy = Math.floor(q / ncol) * st + 1;
    for (let py = 0; py < cs; py++)
      for (let px = 0; px < cs; px++) {
        const o = ((oy + py) * TW + ox + px) * 4;
        if (tex[o + 3]) continue;
        const s = px / (cs - 1), t = py / (cs - 1);
        const b0 = (1 - s) * (1 - t), b1 = s * (1 - t), b2 = s * t, b3 = (1 - s) * t;
        for (let ch = 0; ch < 3; ch++) tex[o + ch] = b0 * vc[vi[0] * 3 + ch] + b1 * vc[vi[1] * 3 + ch] + b2 * vc[vi[2] * 3 + ch] + b3 * vc[vi[3] * 3 + ch];
        tex[o + 3] = 255;
      }
  }
  // ---- sombreado dos encaixes (oclusão de ambiente): cada ponto escurece conforme o quanto a própria comida (e a
  // louça) tapam o céu à sua volta. É o que dá profundidade: frestas entre camadas, o pé encostado no prato.
  if (opts.ao !== false) {
    const dirs: number[][] = [];
    for (let e = 0; e < 5; e++) for (let a = 0; a < 8; a++) {
      const el = -0.25 + e * 0.38, az = (a / 8) * Math.PI * 2 + e * 0.4;
      dirs.push([Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]);
    }
    const ao = new Float32Array(nV);
    for (let v = 0; v < nV; v++) {
      const px = pos[v * 3] + vn[v * 3] * 0.45, py = pos[v * 3 + 1] + vn[v * 3 + 1] * 0.45, pz = pos[v * 3 + 2] + vn[v * 3 + 2] * 0.45;
      let tot = 0, open = 0;
      for (const d of dirs) {
        const w = d[0] * vn[v * 3] + d[1] * vn[v * 3 + 1] + d[2] * vn[v * 3 + 2];
        if (w < 0.15) continue;
        tot += w;
        let free = 1;
        for (let t = 0.5; t <= 3.6; t += 0.6) {
          const X = px + d[0] * t, Y = py + d[1] * t, Z = pz + d[2] * t;
          if (Z < 0 || occupied(X, Y, Z) || (floor && Z < floor(X, Y))) { free = Math.min(1, (t - 0.5) / 3.6) * 0.6; break; }
        }
        open += w * free;
      }
      ao[v] = tot ? open / tot : 1;
    }
    // alisa um pouco (a sombra fica suave, sem manchas)
    for (let it = 0; it < 2; it++) {
      const prev = ao.slice();
      for (let v = 0; v < nV; v++) { const L = nbr[v]; if (!L.length) continue; let sum = 0; for (const w of L) sum += prev[w]; ao[v] = (prev[v] + sum / L.length) / 2; }
    }
    for (let q = 0; q < nQ; q++) {
      const a0 = ao[quads[q * 4]], a1 = ao[quads[q * 4 + 1]], a2 = ao[quads[q * 4 + 2]], a3 = ao[quads[q * 4 + 3]];
      const ox = (q % ncol) * st + 1, oy = Math.floor(q / ncol) * st + 1;
      for (let py = 0; py < cs; py++)
        for (let px = 0; px < cs; px++) {
          const sx = px / (cs - 1), ty = py / (cs - 1), o = ((oy + py) * TW + ox + px) * 4;
          const k = 0.42 + 0.58 * Math.min(1, ((1 - sx) * (1 - ty) * a0 + sx * (1 - ty) * a1 + sx * ty * a2 + (1 - sx) * ty * a3) * 1.12);
          tex[o] *= k; tex[o + 1] *= k; tex[o + 2] *= k;
        }
    }
  }
  // margens: copia o texel de borda mais próximo
  for (let q = 0; q < nQ; q++) {
    const bx = (q % ncol) * st, by = Math.floor(q / ncol) * st;
    for (let py = 0; py < st; py++)
      for (let px = 0; px < st; px++) {
        if (px > 0 && py > 0 && px < st - 1 && py < st - 1) continue;
        const sx = Math.min(st - 2, Math.max(1, px)), sy = Math.min(st - 2, Math.max(1, py));
        const o = ((by + py) * TW + bx + px) * 4, i = ((by + sy) * TW + bx + sx) * 4;
        if (by + py >= TH || bx + px >= TW) continue;
        tex[o] = tex[i]; tex[o + 1] = tex[i + 1]; tex[o + 2] = tex[i + 2]; tex[o + 3] = 255;
      }
  }
  for (let o = 3; o < tex.length; o += 4) if (!tex[o]) tex[o] = 255;
  onProgress?.(1);
  grade(tex);
  return { positions, uvs, normals, indices, texture: { data: tex, width: TW, height: TH }, dims: dish.dims };
}

/** Acabamento de cor da pintura: um pouco mais de contraste e de saturação, como numa foto de cardápio. */
export function grade(tex: Uint8ClampedArray | Uint8Array, sat = 1.16, con = 1.07) {
  for (let o = 0; o < tex.length; o += 4) {
    let r = tex[o], g = tex[o + 1], b = tex[o + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    r = 128 + (r - 128) * con + 3; g = 128 + (g - 128) * con + 3; b = 128 + (b - 128) * con + 3;
    tex[o] = Math.max(0, Math.min(255, r)); tex[o + 1] = Math.max(0, Math.min(255, g)); tex[o + 2] = Math.max(0, Math.min(255, b));
  }
}
