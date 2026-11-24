// Estilo "polígonos" (low-poly): em vez de uma pintura de foto esticada sobre a forma, o produto vira um conjunto de
// faces planas, cada uma com uma cor limpa. A forma e o tamanho continuam sendo os medidos; a cor de cada face vem
// das fotos, arredondada para uma paleta curta (como numa ilustração).
import type { HeightMesh } from "./heightmesh";

export type Face = { pts: number[][]; color: number[] };

/** Monta a malha de faces planas: cada face tem seus próprios vértices, a normal da face e uma cor da paleta. */
export function flatMesh(faces: Face[], opts: { roughness?: number; name?: string } = {}): HeightMesh {
  const B = 4; // cada cor ocupa um bloco de 4×4 pontos da textura (sem risco de uma cor vazar na outra)
  const per = Math.max(1, Math.ceil(Math.sqrt(faces.length))), TW = per * B;
  const tex = new Uint8ClampedArray(TW * TW * 4).fill(255);
  let nV = 0, nI = 0;
  for (const f of faces) { nV += f.pts.length; nI += (f.pts.length - 2) * 3; }
  const positions = new Float32Array(nV * 3), normals = new Float32Array(nV * 3), uvs = new Float32Array(nV * 2), indices = new Uint32Array(nI);
  let v = 0, ii = 0;
  faces.forEach((f, q) => {
    const bx = (q % per) * B, by = Math.floor(q / per) * B;
    for (let y = 0; y < B; y++)
      for (let x = 0; x < B; x++) {
        const o = ((by + y) * TW + bx + x) * 4;
        tex[o] = f.color[0]; tex[o + 1] = f.color[1]; tex[o + 2] = f.color[2];
      }
    const p = f.pts, n = [0, 0, 0];
    // normal da face (soma dos produtos vetoriais em leque: funciona para triângulo e para quadrilátero torto)
    for (let k = 1; k < p.length - 1; k++) {
      const a = [p[k][0] - p[0][0], p[k][1] - p[0][1], p[k][2] - p[0][2]], b = [p[k + 1][0] - p[0][0], p[k + 1][1] - p[0][1], p[k + 1][2] - p[0][2]];
      n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0];
    }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const u = (bx + B / 2) / TW, w = 1 - (by + B / 2) / TW;
    for (let k = 0; k < p.length; k++) {
      positions.set(p[k], (v + k) * 3);
      normals.set([n[0] / l, n[1] / l, n[2] / l], (v + k) * 3);
      uvs[(v + k) * 2] = u; uvs[(v + k) * 2 + 1] = w;
    }
    for (let k = 1; k < p.length - 1; k++) { indices[ii++] = v; indices[ii++] = v + k; indices[ii++] = v + k + 1; }
    v += p.length;
  });
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], positions[i + a]); hi[a] = Math.max(hi[a], positions[i + a]); }
  return {
    positions, uvs, normals, indices, texture: { data: tex, width: TW, height: TW }, png: true,
    dims: { w: (hi[0] - lo[0]) * 100, d: (hi[2] - lo[2]) * 100, h: (hi[1] - lo[1]) * 100 }, roughness: opts.roughness ?? 0.7, name: opts.name,
  };
}

/** Paleta curta: agrupa as cores em poucas famílias e puxa cada face para a cor da sua família. */
export function simplifyColors(colors: number[][], adj: number[][], K = 10, pull = 0.72) {
  const n = colors.length;
  if (!n) return;
  // 1. alisa entre faces vizinhas de cor parecida (tira o chuvisco, mantém as divisas de cor)
  for (let it = 0; it < 2; it++) {
    const next = colors.map((c, q) => {
      let r = c[0], g = c[1], b = c[2], w = 1;
      for (const o of adj[q]) {
        const d = Math.hypot(c[0] - colors[o][0], c[1] - colors[o][1], c[2] - colors[o][2]);
        const k = Math.exp(-(d * d) / (2 * 20 * 20));
        r += colors[o][0] * k; g += colors[o][1] * k; b += colors[o][2] * k; w += k;
      }
      return [r / w, g / w, b / w];
    });
    for (let q = 0; q < n; q++) colors[q] = next[q];
  }
  // 2. famílias de cor (k-médias, começando pelas cores mais distantes entre si)
  const cent: number[][] = [colors[0].slice()];
  const dmin = new Float32Array(n).fill(Infinity);
  while (cent.length < Math.min(K, n)) {
    const last = cent[cent.length - 1];
    let best = 0;
    for (let q = 0; q < n; q++) {
      dmin[q] = Math.min(dmin[q], Math.hypot(colors[q][0] - last[0], colors[q][1] - last[1], colors[q][2] - last[2]));
      if (dmin[q] > dmin[best]) best = q;
    }
    if (dmin[best] < 14) break; // já não há cor diferente o bastante para merecer uma família
    cent.push(colors[best].slice());
  }
  const lab = new Int32Array(n);
  for (let it = 0; it < 8; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let q = 0; q < n; q++) {
      let b = 0, bd = Infinity;
      for (let k = 0; k < cent.length; k++) {
        const d = (colors[q][0] - cent[k][0]) ** 2 + (colors[q][1] - cent[k][1]) ** 2 + (colors[q][2] - cent[k][2]) ** 2;
        if (d < bd) { bd = d; b = k; }
      }
      lab[q] = b;
      sum[b][0] += colors[q][0]; sum[b][1] += colors[q][1]; sum[b][2] += colors[q][2]; sum[b][3]++;
    }
    for (let k = 0; k < cent.length; k++) if (sum[k][3]) cent[k] = [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]];
  }
  for (let q = 0; q < n; q++) for (let c = 0; c < 3; c++) colors[q][c] = cent[lab[q]][c] * pull + colors[q][c] * (1 - pull);
}

/** Converte a malha pintada (um quadrado da textura por face) em faces planas de cor limpa. */
export function toLowPoly(m: HeightMesh, opts: { roughness?: number; name?: string } = {}): HeightMesh {
  const nQ = m.indices.length / 6, T = m.texture, faces: Face[] = [], colors: number[][] = [];
  const key = new Map<string, number[]>();
  for (let q = 0; q < nQ; q++) {
    const pts: number[][] = [];
    for (let e = 0; e < 4; e++) pts.push([m.positions[(q * 4 + e) * 3], m.positions[(q * 4 + e) * 3 + 1], m.positions[(q * 4 + e) * 3 + 2]]);
    // cor média do quadrado desta face na textura
    const u0 = m.uvs[q * 8] * T.width, v0 = (1 - m.uvs[q * 8 + 1]) * T.height, u1 = m.uvs[q * 8 + 4] * T.width, v1 = (1 - m.uvs[q * 8 + 5]) * T.height;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.floor(Math.min(v0, v1)); y <= Math.floor(Math.max(v0, v1)); y++)
      for (let x = Math.floor(Math.min(u0, u1)); x <= Math.floor(Math.max(u0, u1)); x++) {
        if (x < 0 || y < 0 || x >= T.width || y >= T.height) continue;
        const o = (y * T.width + x) * 4;
        r += T.data[o]; g += T.data[o + 1]; b += T.data[o + 2]; n++;
      }
    colors.push(n ? [r / n, g / n, b / n] : [200, 170, 130]);
    faces.push({ pts, color: colors[q] });
    for (const p of pts) {
      const k = `${Math.round(p[0] * 2e4)},${Math.round(p[1] * 2e4)},${Math.round(p[2] * 2e4)}`;
      const a = key.get(k);
      if (a) a.push(q); else key.set(k, [q]);
    }
  }
  // faces vizinhas = as que dividem pelo menos um canto
  const adj: number[][] = faces.map(() => []);
  for (const qs of key.values()) for (const a of qs) for (const b of qs) if (a !== b && !adj[a].includes(b)) adj[a].push(b);
  simplifyColors(colors, adj);
  faces.forEach((f, q) => (f.color = colors[q]));
  return flatMesh(faces, { roughness: opts.roughness ?? 0.72, name: opts.name ?? "prato" });
}

type Grid = { nx: number; ny: number; nz?: number; cell: number; dz?: number; x0: number; y0: number };

/**
 * Malha "de modelagem" a partir do volume: cada pedaço de comida vira anéis de faces em volta do seu eixo
 * (como um vaso torneado, mas com o raio livre em cada direção), fechado em cima. É a topologia limpa de um
 * modelo desenhado à mão: poucas faces, grandes e bem alinhadas.
 * Coordenadas de saída: metros, y para cima, centradas em `origin`.
 */
export function radialFaces(g: Grid, F: Uint8Array, origin: [number, number], floor?: (x: number, y: number) => number): number[][][] {
  const { nx, ny, cell, x0, y0 } = g, nz = g.nz!, dz = g.dz!, N = nx * ny;
  const top = new Int16Array(N).fill(-1), bot = new Int16Array(N).fill(-1);
  for (let k = 0; k < nz; k++) for (let q = 0; q < N; q++) if (F[k * N + q]) { top[q] = k; if (bot[q] < 0) bot[q] = k; }
  const occ = (x: number, y: number, k: number) => {
    const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < ny && k >= 0 && k < nz && F[k * N + j * nx + i] === 1;
  };
  const out: number[][][] = [];
  const lab = new Uint8Array(N);
  for (let s0 = 0; s0 < N; s0++) {
    if (top[s0] < 0 || lab[s0]) continue;
    // um pedaço = colunas vizinhas com comida
    const cells = [s0];
    lab[s0] = 1;
    for (let e = 0; e < cells.length; e++) {
      const q = cells[e], i = q % nx, j = (q / nx) | 0;
      for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1])
        if (o >= 0 && top[o] >= 0 && !lab[o]) { lab[o] = 1; cells.push(o); }
    }
    if (cells.length < 12) continue;
    const X = (q: number) => x0 + ((q % nx) + 0.5) * cell, Y = (q: number) => y0 + (((q / nx) | 0) + 0.5) * cell;
    let sx = 0, sy = 0, kTop = 0, kBot = nz;
    for (const q of cells) { sx += X(q); sy += Y(q); kTop = Math.max(kTop, top[q]); kBot = Math.min(kBot, bot[q]); }
    let cx = sx / cells.length, cy = sy / cells.length;
    // o eixo tem que passar por dentro do pedaço
    let best = cells[0], bd = Infinity;
    for (const q of cells) { const d = (X(q) - cx) ** 2 + (Y(q) - cy) ** 2; if (d < bd) { bd = d; best = q; } }
    if (bd > cell * cell) { cx = X(best); cy = Y(best); }
    let Rm = 0;
    for (const q of cells) Rm = Math.max(Rm, Math.hypot(X(q) - cx, Y(q) - cy));
    Rm += cell;
    // topo dos anéis: a altura "típica" de cima (não o ponto mais alto), para um topo plano sair plano
    const tops = cells.map((q) => (top[q] + 1) * dz).sort((a, b) => a - b);
    const zmax = (kTop + 1) * dz, zt = Math.max(tops[Math.floor(tops.length * 0.85)], zmax - 1.5);
    const zb = Math.max(kBot * dz, floor ? Math.max(0, floor(cx, cy) - 0.3) : 0);
    if (zt - zb < 0.3) continue;
    const flat = tops.filter((t) => t >= zt - 0.8).length > tops.length * 0.6;
    const SEG = Math.max(10, Math.min(24, Math.round((2 * Math.PI * Rm) / 1.7)));
    const K = Math.max(2, Math.min(16, Math.round((zt - zb) / 1.0)));
    // raio de fora em cada direção e altura
    const rad: number[][] = [];
    for (let k = 0; k <= K; k++) {
      // topo plano: perto de cima, o contorno é o de 1 cm abaixo (a beirada de cima não fica "mordida" pelo ruído)
      const z = Math.min(zb + ((zt - zb) * k) / K, flat ? Math.max(zb, zt - 1) : zt - dz * 0.6), kk = Math.max(0, Math.floor(Math.max(z, zb + dz * 0.4) / dz));
      const row: number[] = [];
      for (let s = 0; s < SEG; s++) {
        const a = (s / SEG) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        let r = 0;
        for (let t = cell * 0.25; t <= Rm; t += cell * 0.5) if (occ(cx + dx * t, cy + dy * t, kk) || occ(cx + dx * t, cy + dy * t, kk + 1 < nz && k < K ? kk + 1 : kk)) r = t + cell * 0.25;
        row.push(r);
      }
      rad.push(row);
    }
    // alisa de leve em volta e na vertical (regulariza sem apagar a forma)
    for (let k = 0; k <= K; k++) {
      const r = rad[k].slice();
      for (let s = 0; s < SEG; s++) rad[k][s] = Math.max(r[s] * 0.85, (r[(s + SEG - 1) % SEG] + 2 * r[s] + r[(s + 1) % SEG]) / 4);
    }
    for (let k = 1; k < K; k++) for (let s = 0; s < SEG; s++) rad[k][s] = (rad[k - 1][s] + 2 * rad[k][s] + rad[k + 1][s]) / 4;
    const colTop = (x: number, y: number) => {
      const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
      const t = i >= 0 && j >= 0 && i < nx && j < ny ? top[j * nx + i] : -1;
      return t < 0 ? -1 : (t + 1) * dz;
    };
    const P = (r: number, a: number, z: number) => [(cx + r * Math.cos(a) - origin[0]) / 100, z / 100, -(cy + r * Math.sin(a) - origin[1]) / 100];
    const ring = (k: number) => rad[k].map((r, s) => P(r, (s / SEG) * Math.PI * 2, zb + ((zt - zb) * k) / K));
    const rings = rad.map((_, k) => ring(k));
    // tampa: um anel a meio caminho, na altura real da comida ali, e o topo no eixo
    // Tampa. Altura de um ponto = mediana da vizinhança (um voxel solto não vira espinho). Se a tampa fica quase
    // na altura dos anéis, é um topo plano: sai plano. Se fica bem acima, é uma cúpula: acompanha a forma.
    const med = (x: number, y: number) => {
      const v: number[] = [];
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const h = colTop(x + a * cell, y + b * cell); if (h >= 0) v.push(h); }
      v.sort((p, q) => p - q);
      return v.length ? v[v.length >> 1] : zt;
    };
    let capH = rad[K].map((r, s) => { const a = (s / SEG) * Math.PI * 2; return Math.min(zmax, Math.max(med(cx + r * 0.55 * Math.cos(a), cy + r * 0.55 * Math.sin(a)), zt - 1.5)); });
    const sorted = capH.slice().sort((p, q) => p - q), mid = sorted[sorted.length >> 1];
    let poleZ = Math.min(zmax, Math.max(med(cx, cy), zt - 1.5));
    if (flat || Math.abs(mid - zt) < 0.7) { capH = capH.map(() => zt); if (Math.abs(poleZ - zt) < 1) poleZ = zt; }
    else capH = capH.map((h, s) => (capH[(s + SEG - 1) % SEG] + 2 * h + capH[(s + 1) % SEG]) / 4);
    const cap = rad[K].map((r, s) => P(r * 0.55, (s / SEG) * Math.PI * 2, capH[s]));
    const pole = [(cx - origin[0]) / 100, poleZ / 100, -(cy - origin[1]) / 100];
    const faces: number[][][] = [];
    const area = (p: number[][]) => {
      let n = 0;
      for (let k = 1; k < p.length - 1; k++) {
        const a = [p[k][0] - p[0][0], p[k][1] - p[0][1], p[k][2] - p[0][2]], b = [p[k + 1][0] - p[0][0], p[k + 1][1] - p[0][1], p[k + 1][2] - p[0][2]];
        n += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
      }
      return n;
    };
    const add = (p: number[][]) => { if (area(p) > 2e-7) faces.push(p); };
    for (let k = 0; k < K; k++) for (let s = 0; s < SEG; s++) add([rings[k][s], rings[k][(s + 1) % SEG], rings[k + 1][(s + 1) % SEG], rings[k + 1][s]]);
    for (let s = 0; s < SEG; s++) {
      add([rings[K][s], rings[K][(s + 1) % SEG], cap[(s + 1) % SEG], cap[s]]);
      add([cap[s], cap[(s + 1) % SEG], pole]);
    }
    out.push(...faces);
  }
  return out;
}

/** Cor de cada face, tirada da malha pintada com as fotos (média do que está perto de cada face). */
export function polyFromVolume(g: Grid, F: Uint8Array, origin: [number, number], painted: HeightMesh, floor?: (x: number, y: number) => number, opts: { roughness?: number; name?: string } = {}): HeightMesh | null {
  const shapes = radialFaces(g, F, origin, floor);
  if (!shapes.length) return null;
  // nuvem de cores: o centro de cada quadradinho da malha pintada, com a cor média dele
  const nQ = painted.indices.length / 6, T = painted.texture, H = 0.01;
  const hash = new Map<number, number[]>();
  const pc = new Float32Array(nQ * 3), cc = new Float32Array(nQ * 3);
  const hk = (x: number, y: number, z: number) => ((Math.floor(x / H) + 512) * 1024 + (Math.floor(y / H) + 512)) * 1024 + (Math.floor(z / H) + 512);
  for (let q = 0; q < nQ; q++) {
    for (let a = 0; a < 3; a++) pc[q * 3 + a] = (painted.positions[q * 12 + a] + painted.positions[q * 12 + 6 + a]) / 2;
    const u0 = painted.uvs[q * 8] * T.width, v0 = (1 - painted.uvs[q * 8 + 1]) * T.height, u1 = painted.uvs[q * 8 + 4] * T.width, v1 = (1 - painted.uvs[q * 8 + 5]) * T.height;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = Math.floor(Math.min(v0, v1)); y <= Math.floor(Math.max(v0, v1)); y++)
      for (let x = Math.floor(Math.min(u0, u1)); x <= Math.floor(Math.max(u0, u1)); x++) {
        if (x < 0 || y < 0 || x >= T.width || y >= T.height) continue;
        const o = (y * T.width + x) * 4;
        r += T.data[o]; gg += T.data[o + 1]; b += T.data[o + 2]; n++;
      }
    cc[q * 3] = n ? r / n : 200; cc[q * 3 + 1] = n ? gg / n : 170; cc[q * 3 + 2] = n ? b / n : 130;
    const k = hk(pc[q * 3], pc[q * 3 + 1], pc[q * 3 + 2]);
    const a = hash.get(k);
    if (a) a.push(q); else hash.set(k, [q]);
  }
  const lookup = (p: number[], out: number[]) => {
    for (const R of [1, 2, 4]) {
      let r = 0, gg = 0, b = 0, w = 0;
      const bx = Math.floor(p[0] / H), by = Math.floor(p[1] / H), bz = Math.floor(p[2] / H);
      for (let dz2 = -R; dz2 <= R; dz2++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const cell = hash.get(((bx + dx + 512) * 1024 + (by + dy + 512)) * 1024 + (bz + dz2 + 512));
        if (!cell) continue;
        for (const q of cell) {
          const d = Math.hypot(pc[q * 3] - p[0], pc[q * 3 + 1] - p[1], pc[q * 3 + 2] - p[2]);
          if (d > R * H) continue;
          const k = 1 / (0.002 + d);
          r += cc[q * 3] * k; gg += cc[q * 3 + 1] * k; b += cc[q * 3 + 2] * k; w += k;
        }
      }
      if (w > 0) { out[0] = r / w; out[1] = gg / w; out[2] = b / w; return true; }
    }
    return false;
  };
  const faces: Face[] = [], colors: number[][] = [], c = [0, 0, 0];
  const key = new Map<string, number[]>();
  shapes.forEach((pts, q) => {
    const cen = [0, 0, 0];
    for (const p of pts) for (let a = 0; a < 3; a++) cen[a] += p[a] / pts.length;
    let r = 0, gg = 0, b = 0, n = 0;
    for (const p of [cen, ...pts.map((v) => [(v[0] + cen[0] * 2) / 3, (v[1] + cen[1] * 2) / 3, (v[2] + cen[2] * 2) / 3])])
      if (lookup(p, c)) { r += c[0]; gg += c[1]; b += c[2]; n++; }
    colors.push(n ? [r / n, gg / n, b / n] : [-1, -1, -1]);
    faces.push({ pts, color: colors[q] });
    for (const p of pts) {
      const k = `${Math.round(p[0] * 2e4)},${Math.round(p[1] * 2e4)},${Math.round(p[2] * 2e4)}`;
      const a = key.get(k);
      if (a) a.push(q); else key.set(k, [q]);
    }
  });
  const adj: number[][] = faces.map(() => []);
  for (const qs of key.values()) for (const a of qs) for (const b of qs) if (a !== b && !adj[a].includes(b)) adj[a].push(b);
  // faces sem cor por perto herdam das vizinhas
  for (let it = 0; it < 20; it++) {
    let left = 0;
    for (let q = 0; q < colors.length; q++) {
      if (colors[q][0] >= 0) continue;
      const nb = adj[q].filter((o) => colors[o][0] >= 0);
      if (!nb.length) { left++; continue; }
      colors[q] = [0, 1, 2].map((a) => nb.reduce((s, o) => s + colors[o][a], 0) / nb.length);
    }
    if (!left) break;
  }
  for (let q = 0; q < colors.length; q++) if (colors[q][0] < 0) colors[q] = [200, 170, 130];
  simplifyColors(colors, adj);
  faces.forEach((f, q) => (f.color = colors[q]));
  return flatMesh(faces, { roughness: opts.roughness ?? 0.72, name: opts.name ?? "prato" });
}
