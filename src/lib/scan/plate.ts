// Louça limpa: quando o produto está num prato redondo, o prato deixa de ser "esculpido" a partir das fotos
// (o que dava uma borda torta e manchada) e passa a ser desenhado: um prato perfeitamente redondo, no tamanho e
// com o perfil medidos, liso e brilhante. A comida continua vindo das fotos e é montada em cima dele.
//
// O que aparece pintado no prato (molho, comida baixinha) vem das fotos; o resto da louça fica na cor limpa dela.
import type { Vec3 } from "./geometry";
import { cameraCenter } from "./geometry";
import type { Dish, HeightField, RGBA, View } from "./recon";
import type { HeightMesh } from "./heightmesh";
import { flatMesh, type Face } from "./lowpoly";

export type Plate = {
  cx: number; // centro (cm)
  cy: number;
  R: number; // raio de fora (cm)
  /** altura do topo da louça por anel, do centro (0) até a borda; passo = `step` cm */
  prof: Float32Array;
  step: number;
  /** células de comida clara, da cor da louça (arroz, purê): a pintura delas não pode ser confundida com louça */
  pale: Uint8Array;
  /** volume já esculpido contra a louça (ou null) */
  carved: Uint8Array | null;
  /** cor da louça como saiu nas fotos (0–255) */
  raw: [number, number, number];
  /** cor limpa da louça (0–255) */
  color: [number, number, number];
  /** louça clara e lisa (porcelana): material brilhante. Madeira, pedra e afins ficam foscos. */
  glossy: boolean;
  /** pintura vista de cima, cobrindo o quadrado [cx ± half, cy ± half] */
  tex: RGBA;
  half: number;
  /** células da grade que são comida com volume (o resto é louça ou comida rasa, que vira pintura) */
  food: Uint8Array;
};

const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
/** Distância de cor tolerante a sombra: compara depois de igualar o brilho (a louça na sombra continua sendo louça). */
function colorDist(c: number[], p: number[]) {
  const k = lum(p) / Math.max(1, lum(c));
  if (k > 1.9 || k < 0.72) return 255; // muito mais escuro ou mais claro que a louça: é outra coisa
  return Math.hypot(c[0] * k - p[0], c[1] * k - p[1], c[2] * k - p[2]) + Math.abs(1 - k) * 22;
}

/** Cor de um ponto visto pelas fotos que estão do mesmo lado dele (mediana: ignora reflexo e foto desalinhada). */
function makeSampler(views: View[], gains: number[][], cx: number, cy: number, blocked?: (c: number, X: number, Y: number) => boolean) {
  const centers = views.map((v) => cameraCenter(v.cam));
  const bufs = [new Float32Array(views.length), new Float32Array(views.length), new Float32Array(views.length)];
  /** Devolve a cor (em `out`) e, em out[3], o quanto as fotos discordam entre si sobre ela. */
  const dev = new Float32Array(views.length);
  return (X: number, Y: number, Z: number, out: number[]): boolean => {
    const px = X - cx, py = Y - cy, pl = Math.hypot(px, py);
    let n = 0;
    for (let c = 0; c < views.length; c++) {
      const C = centers[c];
      // longe do centro: só as fotos tiradas do lado de cá (as do outro lado veem a comida na frente)
      if (pl > 1.5) {
        const dx = C[0] - cx, dy = C[1] - cy;
        if ((dx * px + dy * py) / (Math.hypot(dx, dy) * pl + 1e-6) < 0.25) continue;
      }
      // a comida está entre o ponto do prato e a câmera: esta foto mostra a comida, não o prato
      if (blocked && blocked(c, X, Y)) continue;
      const cam = views[c].cam, R = cam.R, t = cam.t;
      const zc = R[6] * X + R[7] * Y + R[8] * Z + t[2];
      if (zc <= 1) continue;
      const u = (cam.f * (R[0] * X + R[1] * Y + R[2] * Z + t[0])) / zc + cam.cx, v = (cam.f * (R[3] * X + R[4] * Y + R[5] * Z + t[1])) / zc + cam.cy;
      const img = views[c].img;
      if (u < 1 || v < 1 || u > img.width - 2 || v > img.height - 2) continue;
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0, w = img.width, d = img.data;
      const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
      const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), e = (1 - fx) * fy, g = fx * fy, gn = gains[c];
      for (let ch = 0; ch < 3; ch++) bufs[ch][n] = (d[i00 + ch] * a + d[i10 + ch] * b + d[i01 + ch] * e + d[i11 + ch] * g) * gn[ch];
      n++;
    }
    if (n < 2) return false;
    let spread = 0;
    for (let ch = 0; ch < 3; ch++) {
      const s = bufs[ch].subarray(0, n).slice().sort();
      out[ch] = n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;
      for (let e = 0; e < n; e++) spread += Math.abs(s[e] - out[ch]);
    }
    out[3] = spread / n;
    // out[4]: o quanto discordam as fotos que MAIS concordam (as 40% mais próximas da cor do meio): se nem elas
    // se entendem, não há superfície nessa altura
    const k = Math.max(3, Math.round(n * 0.4));
    for (let e = 0; e < n; e++) dev[e] = Math.abs(bufs[0][e] - out[0]) + Math.abs(bufs[1][e] - out[1]) + Math.abs(bufs[2][e] - out[2]);
    const ds = dev.subarray(0, n).slice().sort();
    let t = 0;
    for (let e = 0; e < Math.min(k, n); e++) t += ds[e];
    out[4] = t / Math.min(k, n);
    return true;
  };
}

/** Círculo que melhor passa por um conjunto de pontos (mínimos quadrados). */
function fitCircle(p: [number, number][]): [number, number, number] | null {
  let mx = 0, my = 0;
  for (const q of p) { mx += q[0]; my += q[1]; }
  mx /= p.length; my /= p.length;
  let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const q of p) {
    const u = q[0] - mx, v = q[1] - my;
    suu += u * u; suv += u * v; svv += v * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const a = (suuu + suvv) / 2, b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det, vc = (b * suu - a * suv) / det;
  return [mx + uc, my + vc, Math.sqrt(uc * uc + vc * vc + (suu + svv) / p.length)];
}

const median = (a: number[]) => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };

/** Procura um prato redondo por baixo da comida. Devolve null quando não há (copo na mesa, tábua retangular, cupcake...). */
export function detectPlate(hf: HeightField, dish: Dish, views: View[], F?: Uint8Array): Plate | null {
  const { nx, ny, cell, x0, y0 } = hf;
  let h = hf.h;
  const N = nx * ny;
  const X = (q: number) => x0 + ((q % nx) + 0.5) * cell, Y = (q: number) => y0 + (((q / nx) | 0) + 0.5) * cell;

  // 1. a base é um círculo? Ajusta um círculo ao contorno; vale mesmo com um pedaço escondido (atrás da folha do
  // marcador) ou com algo passando da borda, desde que a maior parte da volta acompanhe o círculo.
  const edge: [number, number][] = [];
  let area = 0;
  for (let q = 0; q < N; q++) {
    if (!dish.mask[q]) continue;
    area++;
    const i = q % nx, j = (q / nx) | 0;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || !dish.mask[q - 1] || !dish.mask[q + 1] || !dish.mask[q - nx] || !dish.mask[q + nx]) edge.push([X(q), Y(q)]);
  }
  if (edge.length < 30) return null;
  let cx = 0, cy = 0, R = 0, pts = edge;
  for (let it = 0; it < 6; it++) {
    const f = fitCircle(pts);
    if (!f) return null;
    [cx, cy, R] = f;
    const tol = it < 2 ? 1.6 : 0.7;
    pts = edge.filter((p) => Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - R) < tol);
    if (pts.length < 30) return null;
  }
  if (R < 6 || R > 24) return null;
  const arc = new Uint8Array(72);
  for (const p of pts) arc[Math.min(71, Math.floor(((Math.atan2(p[1] - cy, p[0] - cx) + Math.PI) / (2 * Math.PI)) * 72))] = 1;
  if (arc.reduce((a, b) => a + b, 0) < 44) return null; // menos de ~60% da volta acompanha o círculo
  let circle = 0, both = 0;
  for (let q = 0; q < N; q++) {
    if (Math.hypot(X(q) - cx, Y(q) - cy) > R) continue;
    circle++;
    if (dish.mask[q]) both++;
  }
  if (both / circle < 0.8) return null;

  // 2. a faixa de fora é baixa e de uma cor só (a borda da louça)?
  const gains = hf.gains ?? views.map(() => [1, 1, 1]);
  const sample = makeSampler(views, gains, cx, cy);
  const band: number[] = [], bandH: number[] = [];
  for (let q = 0; q < N; q++) {
    if (!dish.mask[q]) continue;
    const r = Math.hypot(X(q) - cx, Y(q) - cy);
    if (r > R * 0.87 && r < R * 0.97) { band.push(q); bandH.push(h[q]); }
  }
  if (band.length < 40) return null;
  const rimH = median(bandH.slice());
  if (rimH > 4.2 || rimH < 0.4) return null;
  const c3 = [0, 0, 0, 0, 0], rs: number[] = [], gs: number[] = [], bs: number[] = [], bandCol: number[][] = [];
  for (const q of band) if (sample(X(q), Y(q), rimH, c3)) { rs.push(c3[0]); gs.push(c3[1]); bs.push(c3[2]); bandCol.push([c3[0], c3[1], c3[2]]); }
  if (bandCol.length < 30) return null;
  const pc: [number, number, number] = [median(rs), median(gs), median(bs)];
  const T = 34; // tolerância de cor
  const same = bandCol.filter((c) => colorDist(c, pc) < T).length / bandCol.length;
  if (same < 0.7) return null; // a comida vai até a beirada, ou é uma tábua estampada: não dá para separar com segurança

  // 2b. Esculpe a comida contra a louça. A reconstrução só sabe que "mesa é fundo"; em cima de um prato grande ela
  // quase não consegue esculpir (tudo em volta da comida é prato, não mesa) e a comida sai "derretida". Agora que a
  // cor da louça é conhecida, ela também vira fundo: um cubinho por onde várias fotos enxergam louça lisa está vazio.
  let carved: Uint8Array | null = null;
  if (F && hf.nz && hf.dz) {
    carved = carveAgainstPlate(hf, F, views, gains, pc, (x, y) => (Math.hypot(x - cx, y - cy) <= R ? rimH : -1));
    const nz = hf.nz, dz = hf.dz, h2 = new Float32Array(N);
    for (let q = 0; q < N; q++) {
      if (!dish.mask[q]) continue;
      let top = -1;
      for (let k = nz - 1; k >= 0; k--) if (carved[k * N + q]) { top = k; break; }
      // sem nada acima da louça: a coluna é só louça
      h2[q] = top < 0 ? Math.min(h[q], rimH) : Math.min(h[q], (top + 1) * dz);
      if (Math.hypot(X(q) - cx, Y(q) - cy) > R) h2[q] = h[q];
    }
    h = h2;
  }

  // 3. cada célula: louça à mostra ou comida? (cor vista na altura da louça, pelas fotos do mesmo lado)
  const plateLike = new Uint8Array(N), colored = new Uint8Array(N);
  for (let q = 0; q < N; q++) {
    if (!dish.mask[q]) continue;
    if (!sample(X(q), Y(q), rimH, c3)) { plateLike[q] = 1; continue; }
    if (colorDist(c3, pc) < T) plateLike[q] = 1;
    else colored[q] = 1;
  }
  // comida colorida com volume
  // comida colorida com volume
  const food = new Uint8Array(N);
  for (let q = 0; q < N; q++) if (colored[q] && h[q] > rimH + 0.5) food[q] = 1;
  // comida da cor da louça (arroz, chantilly, purê): só a altura denuncia, e a altura de coisa lisa e clara é a
  // medida menos confiável do escâner. Só vale quando é um volume grande e alto; calombo pequeno é sobra da
  // reconstrução, e degrau encostado numa comida mais alta é o "pé" em volta dela.
  const near = Math.ceil(2.5 / cell);
  const pale = new Uint8Array(N);
  for (let q = 0; q < N; q++) {
    // já esculpido contra a louça, o que sobra de claro com volume é comida clara de verdade (arroz, purê)
    if (!plateLike[q] || !dish.mask[q] || h[q] < rimH + (carved ? 0.7 : 2)) continue;
    const i = q % nx, j = (q / nx) | 0;
    let skirt = false;
    for (let b = -near; b <= near && !skirt; b++)
      for (let a = -near; a <= near && !skirt; a++) {
        const ii = i + a, jj = j + b;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || a * a + b * b > near * near) continue;
        const o = jj * nx + ii;
        if (colored[o] && h[o] > h[q] + 0.4) skirt = true;
      }
    if (!skirt) pale[q] = 1;
  }
  keepBig(pale, nx, ny, Math.round(14 / (cell * cell)));
  for (let q = 0; q < N; q++) if (pale[q]) food[q] = 1;
  // fora do círculo da louça só fica o que é alto de verdade (um espeto passando da borda); o resto é sobra
  for (let q = 0; q < N; q++) if (food[q] && Math.hypot(X(q) - cx, Y(q) - cy) > R + 0.4 && h[q] < rimH + 1.5) food[q] = 0;
  cleanMask(food, nx, ny);
  // Comida clara (arroz, purê): a escultura contra a louça deixa covas onde a foto estava lisa demais. Fecha as covas
  // (cada coluna sobe até a altura típica das vizinhas claras) e alarga a marca de "aqui é comida clara" para a pintura.
  const paleWide = new Uint8Array(N);
  if (carved && hf.nz && hf.dz) {
    const nz = hf.nz, dz = hf.dz;
    const topK = (q: number) => { for (let k = nz - 1; k >= 0; k--) if (carved![k * N + q]) return k; return -1; };
    // primeiro fecha a mancha vista de cima (cratera aberta no meio do arroz): dilata e encolhe ~1,6 cm
    const rr = Math.ceil(1.6 / cell), m0 = new Uint8Array(N), m1 = new Uint8Array(N), m2 = new Uint8Array(N);
    for (let q = 0; q < N; q++) m0[q] = pale[q] && food[q] ? 1 : 0;
    const morph = (src: Uint8Array, dst: Uint8Array, grow: boolean) => {
      for (let q = 0; q < N; q++) {
        const i = q % nx, j = (q / nx) | 0;
        let hit = grow ? 0 : 1;
        for (let b = -rr; b <= rr && hit === (grow ? 0 : 1); b++) for (let a = -rr; a <= rr; a++) {
          if (a * a + b * b > rr * rr) continue;
          const ii = i + a, jj = j + b, v = ii >= 0 && jj >= 0 && ii < nx && jj < ny ? src[jj * nx + ii] : 0;
          if (grow ? v : !v) { hit = grow ? 1 : 0; break; }
        }
        dst[q] = hit;
      }
    };
    morph(m0, m1, true);
    morph(m1, m2, false);
    for (let q = 0; q < N; q++) if (m2[q] && Math.hypot(X(q) - cx, Y(q) - cy) < R * 0.95 && (!food[q] || !pale[q]) && (plateLike[q] || !food[q])) { food[q] = 1; pale[q] = 1; }
    for (let pass = 0; pass < 3; pass++) {
      const tk = new Int16Array(N);
      for (let q = 0; q < N; q++) tk[q] = pale[q] && food[q] ? Math.max(0, topK(q)) : -1;
      for (let q = 0; q < N; q++) {
        if (tk[q] < 0) continue;
        const i = q % nx, j = (q / nx) | 0, v: number[] = [];
        for (let b = -6; b <= 6; b++) for (let a = -6; a <= 6; a++) {
          const ii = i + a, jj = j + b;
          if (a * a + b * b <= 36 && ii >= 0 && jj >= 0 && ii < nx && jj < ny && tk[jj * nx + ii] >= 0) v.push(tk[jj * nx + ii]);
        }
        v.sort((x, y) => x - y);
        const m = v[Math.floor(v.length * 0.7)];
        for (let k = 0; k <= m; k++) carved[k * N + q] = 1;
      }
    }
  }
  const wide = Math.ceil(0.5 / cell);
  for (let q = 0; q < N; q++) {
    if (!pale[q] || !food[q]) continue;
    const i = q % nx, j = (q / nx) | 0;
    for (let b = -wide; b <= wide; b++) for (let a = -wide; a <= wide; a++) {
      const ii = i + a, jj = j + b;
      if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) paleWide[jj * nx + ii] = 1;
    }
  }

  // 4. perfil da louça: altura por anel, medida onde ela está à mostra
  const step = cell, nr = Math.ceil(R / step) + 1;
  const ringH: number[][] = Array.from({ length: nr }, () => []);
  for (let q = 0; q < N; q++) {
    if (!dish.mask[q] || food[q] || !plateLike[q]) continue;
    const r = Math.hypot(X(q) - cx, Y(q) - cy);
    if (r < R) ringH[Math.min(nr - 1, Math.round(r / step))].push(h[q]);
  }
  const prof = new Float32Array(nr).fill(NaN);
  for (let i = 0; i < nr; i++) {
    const a = ringH[i];
    if (a.length >= 6) { a.sort((x, y) => x - y); prof[i] = a[Math.floor(a.length * 0.3)]; }
  }
  // borda: a medida mais alta perto da beirada; para dentro, a louça só desce (o que sobe de novo é sobra em volta da comida)
  let peak = Math.max(0.8, rimH);
  for (let i = nr - 1; i >= 0 && i > nr - 1 - Math.ceil(3 / step); i--) if (prof[i] > peak) peak = Math.min(prof[i], rimH + 1);
  let run = peak;
  for (let i = nr - 1; i >= 0; i--) {
    if (!isNaN(prof[i])) run = Math.min(run, Math.max(0.6, prof[i]));
    prof[i] = i >= nr - 1 - Math.ceil(1.2 / step) ? peak : run;
  }
  for (let it = 0; it < 3; it++) {
    const p = prof.slice();
    for (let i = 1; i < nr - 1; i++) prof[i] = (p[i - 1] + 2 * p[i] + p[i + 1]) / 4;
  }

  // 5. pintura do prato vista de cima: o que não é louça (molho, comida rasa) fica; a louça vira cor limpa
  const TS = 448, half = R * 1.03;
  // Para cada foto, que pontos do prato ela não enxerga porque a comida está na frente (grade de ~3 mm).
  // Sem isso, a borda de um morango ou de uma batata "mancha" o prato em volta com a cor dela.
  const occVol = carved ?? F;
  let blocked: ((c: number, X: number, Y: number) => boolean) | undefined;
  if (occVol && hf.nz && hf.dz) {
    const G = 128, nz = hf.nz, dz = hf.dz, zTop = nz * dz;
    const centers = views.map((v) => cameraCenter(v.cam));
    const grid = new Uint8Array(views.length * G * G);
    const isOcc = (X: number, Y: number, Z: number) => {
      const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell), k = Math.floor(Z / dz);
      return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && occVol[k * N + j * nx + i] === 1 && food[j * nx + i] === 1;
    };
    const mstep = Math.min(cell, dz) * 0.9;
    for (let gj = 0; gj < G; gj++)
      for (let gi = 0; gi < G; gi++) {
        const X = cx - half + ((gi + 0.5) / G) * 2 * half, Y = cy - half + ((gj + 0.5) / G) * 2 * half;
        const r = Math.hypot(X - cx, Y - cy);
        if (r > R) continue;
        const Z0 = prof[Math.min(prof.length - 1, Math.round(r / step))] + 0.25;
        for (let c = 0; c < views.length; c++) {
          const C = centers[c], dx = C[0] - X, dy = C[1] - Y, dzz = C[2] - Z0, dl = Math.hypot(dx, dy, dzz);
          const sx = (dx / dl) * mstep, sy = (dy / dl) * mstep, sz = (dzz / dl) * mstep;
          let x = X, y = Y, z = Z0, hit = 0;
          for (let s = 0; s < 220 && z < zTop; s++) {
            x += sx; y += sy; z += sz;
            if (isOcc(x, y, z)) { hit = 1; break; }
          }
          grid[c * G * G + gj * G + gi] = hit;
        }
      }
    blocked = (c, X, Y) => {
      const gi = Math.floor(((X - (cx - half)) / (2 * half)) * G), gj = Math.floor(((Y - (cy - half)) / (2 * half)) * G);
      if (gi < 0 || gj < 0 || gi >= G || gj >= G) return false;
      // folga de 2 pontos da grade (~6 mm): o contorno da comida também esconde
      for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
        const ii = gi + a, jj = gj + b;
        if (ii >= 0 && jj >= 0 && ii < G && jj < G && grid[c * G * G + jj * G + ii]) return true;
      }
      return false;
    };
  }
  const paintSample = makeSampler(views, gains, cx, cy, blocked);
  const clean: [number, number, number] = cleanColor(pc);
  const tex = new Uint8ClampedArray(TS * TS * 4);
  // distância (em células) até a comida com volume: colada nela, a pintura do prato é só borrão da lateral da comida
  const dist = new Float32Array(N).fill(99);
  for (let q = 0; q < N; q++) if (food[q]) dist[q] = 0;
  for (let pass = 0; pass < 3; pass++)
    for (let q = 0; q < N; q++) {
      if (dist[q] === 0) continue;
      const i = q % nx, j = (q / nx) | 0;
      let d = dist[q];
      if (i > 0) d = Math.min(d, dist[q - 1] + 1);
      if (i < nx - 1) d = Math.min(d, dist[q + 1] + 1);
      if (j > 0) d = Math.min(d, dist[q - nx] + 1);
      if (j < ny - 1) d = Math.min(d, dist[q + nx] + 1);
      dist[q] = d;
    }
  const distAt = (x: number, y: number) => {
    // interpolado entre as células, para a pintura não ficar com contorno em degraus
    const fx = (x - x0) / cell - 0.5, fy = (y - y0) / cell - 0.5, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) return 99;
    const a = fx - i, b = fy - j, o = j * nx + i;
    return (dist[o] * (1 - a) * (1 - b) + dist[o + 1] * a * (1 - b) + dist[o + nx] * (1 - a) * b + dist[o + nx + 1] * a * b) * cell;
  };
  const profAt = (r: number) => { const t = Math.min(nr - 1.001, Math.max(0, r / step)), i = t | 0; return prof[i] + (prof[i + 1] - prof[i]) * (t - i); };
  for (let j = 0; j < TS; j++)
    for (let i = 0; i < TS; i++) {
      const x = cx - half + ((i + 0.5) / TS) * 2 * half, y = cy + half - ((j + 0.5) / TS) * 2 * half; // linha 0 = y maior
      const r = Math.hypot(x - cx, y - cy), o = (j * TS + i) * 4;
      let k = 0; // 0 = louça limpa, 1 = pintura da foto
      if (r < R * 0.95 && paintSample(x, y, profAt(r), c3)) {
        const d = colorDist(c3, pc);
        k = Math.min(1, Math.max(0, (d - T * 0.75) / (T * 0.6)));
        k *= Math.min(1, Math.max(0, (R * 0.95 - r) / 0.8)); // some suave perto da borda
        // molho de verdade é visto igual por todas as fotos; na beira da comida elas discordam (cada uma vê um lado).
        // Só vale perto da comida: longe dela, uma gota de calda pequena também tem fotos discordando na borda.
        if (distAt(x, y) < 1.5) k *= Math.min(1, Math.max(0, 1 - (c3[3] - 14) / 18));
      }
      tex[o] = clean[0] + (c3[0] - clean[0]) * k;
      tex[o + 1] = clean[1] + (c3[1] - clean[1]) * k;
      tex[o + 2] = clean[2] + (c3[2] - clean[2]) * k;
      tex[o + 3] = 255;
    }
  const glossy = lum(clean) > 150 && Math.max(...clean) - Math.min(...clean) < 46;
  return { cx, cy, R, prof, step, raw: pc, carved, pale: paleWide, color: clean, glossy, tex: { data: tex, width: TS, height: TS }, half, food };
}

/** Cor "de catálogo" da louça: tira o encardido da foto (louça clara fica bem clara, mantendo um leve tom). */
function cleanColor(c: number[]): [number, number, number] {
  const l = lum(c), spread = Math.max(...c) - Math.min(...c);
  if (l > 135 && spread < 46) {
    const k = 240 / l;
    return [Math.min(250, c[0] * k), Math.min(250, c[1] * k), Math.min(250, c[2] * k)] as [number, number, number];
  }
  return [c[0], c[1], c[2]];
}

/** Mantém só as ilhas com pelo menos `min` células. */
function keepBig(m: Uint8Array, nx: number, ny: number, min: number) {
  const lab = new Uint8Array(nx * ny);
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    const cells = [s];
    lab[s] = 1;
    for (let k = 0; k < cells.length; k++) {
      const q = cells[k], i = q % nx, j = (q / nx) | 0;
      for (const o of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1])
        if (o >= 0 && m[o] && !lab[o]) { lab[o] = 1; cells.push(o); }
    }
    if (cells.length < min) for (const q of cells) m[q] = 0;
  }
}

/** Tira pontinhos soltos e fecha furinhos da máscara de comida. */
function cleanMask(m: Uint8Array, nx: number, ny: number) {
  const N = nx * ny;
  // fecha furos cercados de comida
  const out = new Uint8Array(N), st: number[] = [];
  const push = (q: number) => { if (!m[q] && !out[q]) { out[q] = 1; st.push(q); } };
  for (let i = 0; i < nx; i++) { push(i); push((ny - 1) * nx + i); }
  for (let j = 0; j < ny; j++) { push(j * nx); push(j * nx + nx - 1); }
  while (st.length) {
    const q = st.pop()!, i = q % nx, j = (q / nx) | 0;
    if (i > 0) push(q - 1);
    if (i < nx - 1) push(q + 1);
    if (j > 0) push(q - nx);
    if (j < ny - 1) push(q + nx);
  }
  for (let q = 0; q < N; q++) if (!m[q] && !out[q]) m[q] = 1;
  keepBig(m, nx, ny, 10); // tira ilhas pequenas (menos de ~1,5 cm²)
}

/** Altura do topo da louça em qualquer ponto (cm); 0 fora dela. */
export function plateHeight(p: Plate, x: number, y: number) {
  const r = Math.hypot(x - p.cx, y - p.cy);
  if (r > p.R) return 0;
  const t = Math.min(p.prof.length - 1.001, r / p.step), i = t | 0;
  return p.prof[i] + (p.prof[i + 1] - p.prof[i]) * (t - i);
}

/** Do volume inteiro, fica só a comida (colunas marcadas como comida, de cima a baixo: ela "entra" na louça, sem fresta). */
export function foodVolume(hf: HeightField, F0: Uint8Array, p: Plate) {
  const { nx, ny } = hf, nz = hf.nz!, N = nx * ny, F = p.carved ?? F0;
  const out = new Uint8Array(F.length);
  for (let q = 0; q < N; q++) {
    if (!p.food[q]) continue;
    for (let k = 0; k < nz; k++) if (F[k * N + q]) out[k * N + q] = 1;
  }
  return out;
}

/**
 * Esvazia os cubinhos por onde as fotos enxergam a louça. "Enxergar louça" = o ponto da foto tem a cor da louça
 * (aceitando sombra) E é liso em volta: arroz, purê e chantilly têm a cor parecida, mas têm textura e relevo.
 * `plateTop(x, y)` devolve a altura da louça naquele ponto, ou -1 fora dela.
 */
function carveAgainstPlate(hf: HeightField, F: Uint8Array, views: View[], gains: number[][], pc: number[], plateTop: (x: number, y: number) => number) {
  const { nx, ny, cell, x0, y0 } = hf, nz = hf.nz!, dz = hf.dz!, N = nx * ny;
  const lp = 0.3 * pc[0] + 0.59 * pc[1] + 0.11 * pc[2];
  // máscara "aqui se vê louça" de cada foto, na metade da resolução
  const masks = views.map((v, c) => {
    const W = v.img.width, H = v.img.height, w = W >> 1, hh = H >> 1, d = v.img.data, g = gains[c];
    const L = new Float32Array(w * hh), ok = new Uint8Array(w * hh);
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * 2 * W + x * 2) * 4, r = d[o] * g[0], gg = d[o + 1] * g[1], b = d[o + 2] * g[2], l = 0.3 * r + 0.59 * gg + 0.11 * b;
        L[y * w + x] = l;
        const k = lp / Math.max(1, l);
        ok[y * w + x] = k <= 1.9 && k >= 0.8 && Math.hypot(r * k - pc[0], gg * k - pc[1], b * k - pc[2]) < 22 ? 1 : 0;
      }
    // liso em volta: desvio do brilho numa janela 5×5 (somas acumuladas)
    const S = new Float64Array((w + 1) * (hh + 1)), S2 = new Float64Array((w + 1) * (hh + 1));
    for (let y = 0; y < hh; y++)
      for (let x = 0; x < w; x++) {
        const l = L[y * w + x], i = (y + 1) * (w + 1) + x + 1;
        S[i] = l + S[i - 1] + S[i - w - 1] - S[i - w - 2];
        S2[i] = l * l + S2[i - 1] + S2[i - w - 1] - S2[i - w - 2];
      }
    const m = new Uint8Array(w * hh);
    for (let y = 2; y < hh - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        if (!ok[y * w + x]) continue;
        const a = (y - 2) * (w + 1) + x - 2, b = a + 5, c2 = (y + 3) * (w + 1) + x - 2, e = c2 + 5;
        const sum = S[e] - S[b] - S[c2] + S[a], sq = S2[e] - S2[b] - S2[c2] + S2[a], mean = sum / 25;
        const sd = Math.sqrt(Math.max(0, sq / 25 - mean * mean));
        // toda a janela tem que ser cor de louça e lisa (em proporção ao brilho: sombra tem menos contraste)
        if (sd < Math.max(2.2, mean * 0.028)) m[y * w + x] = 1;
      }
    // afina 1 ponto (não esculpe rente à borda da comida)
    const er = new Uint8Array(w * hh);
    for (let y = 1; y < hh - 1; y++) for (let x = 1; x < w - 1; x++) er[y * w + x] = m[y * w + x] & m[y * w + x - 1] & m[y * w + x + 1] & m[(y - 1) * w + x] & m[(y + 1) * w + x];
    return { m: er, w, h: hh };
  });
  const out = Uint8Array.from(F);
  for (let q = 0; q < N; q++) {
    const x = x0 + ((q % nx) + 0.5) * cell, y = y0 + (((q / nx) | 0) + 0.5) * cell, pt = plateTop(x, y);
    if (pt < 0) continue;
    for (let k = Math.ceil((pt + 0.1) / dz); k < nz; k++) {
      if (!F[k * N + q]) continue;
      const z = (k + 0.5) * dz;
      let seen = 0, votes = 0;
      for (let c = 0; c < views.length; c++) {
        const cam = views[c].cam, Rm = cam.R, t = cam.t;
        const zc = Rm[6] * x + Rm[7] * y + Rm[8] * z + t[2];
        if (zc <= 1) continue;
        const u = ((cam.f * (Rm[0] * x + Rm[1] * y + Rm[2] * z + t[0])) / zc + cam.cx) / 2, v = ((cam.f * (Rm[3] * x + Rm[4] * y + Rm[5] * z + t[1])) / zc + cam.cy) / 2;
        const mk = masks[c];
        if (u < 0 || v < 0 || u >= mk.w || v >= mk.h) continue;
        seen++;
        votes += mk.m[(v | 0) * mk.w + (u | 0)];
      }
      if (votes >= Math.max(2, seen * 0.12)) out[k * N + q] = 0;
    }
  }
  // coluna em que a maior parte do que havia acima da louça foi esvaziada: o resto é sobra, sai também
  for (let q = 0; q < N; q++) {
    const pt = plateTop(x0 + ((q % nx) + 0.5) * cell, y0 + (((q / nx) | 0) + 0.5) * cell);
    if (pt < 0) continue;
    let was = 0, now = 0;
    const k0 = Math.ceil((pt + 0.1) / dz);
    for (let k = k0; k < nz; k++) { was += F[k * N + q]; now += out[k * N + q]; }
    if (was && now < was * 0.5) for (let k = k0; k < nz; k++) out[k * N + q] = 0;
  }
  // o que sobrou solto e pequeno (lascas) sai: ilhas em 3D com menos de ~2,5 cm³ acima da louça
  const minVox = Math.round(2.5 / (cell * cell * dz));
  const lab = new Uint8Array(out.length);
  const above = (p: number) => {
    const k = (p / N) | 0, q = p % N, pt = plateTop(x0 + ((q % nx) + 0.5) * cell, y0 + (((q / nx) | 0) + 0.5) * cell);
    return pt >= 0 && (k + 0.5) * dz > pt + 0.1;
  };
  for (let s0 = 0; s0 < out.length; s0++) {
    if (!out[s0] || lab[s0] || !above(s0)) continue;
    const comp = [s0];
    lab[s0] = 1;
    for (let e = 0; e < comp.length; e++) {
      const p = comp[e], k = (p / N) | 0, q = p % N, i = q % nx, j = (q / nx) | 0;
      const nb = [i > 0 ? p - 1 : -1, i < nx - 1 ? p + 1 : -1, j > 0 ? p - nx : -1, j < ny - 1 ? p + nx : -1, k > 0 ? p - N : -1, k < nz - 1 ? p + N : -1];
      for (const o of nb) if (o >= 0 && out[o] && !lab[o] && above(o)) { lab[o] = 1; comp.push(o); }
    }
    // pequeno demais, ou flutuando (não encosta na louça): sai
    let low = Infinity;
    for (const p of comp) { const k = (p / N) | 0, q = p % N; low = Math.min(low, (k + 0.5) * dz - plateTop(x0 + ((q % nx) + 0.5) * cell, y0 + (((q / nx) | 0) + 0.5) * cell)); }
    if (comp.length < minVox || low > 1) for (const p of comp) out[p] = 0;
  }
  return out;
}

/** Malha da louça: um sólido de revolução (perfeitamente redondo), com a pintura de cima e o resto na cor limpa. */
export function buildPlateMesh(p: Plate, origin: [number, number]): HeightMesh {
  const SEG = 96;
  // perfil (r, z): topo do centro até a borda, lábio arredondado, e a parte de fora descendo até o pé
  const top: [number, number][] = [];
  const nTop = 26;
  for (let i = 0; i <= nTop; i++) {
    const r = (p.R - 0.25) * (i / nTop);
    top.push([r, plateHeight(p, r + p.cx, p.cy)]);
  }
  const zr = top[nTop][1], foot = p.R * 0.6;
  const lip: [number, number][] = [[p.R - 0.08, zr - 0.07], [p.R, zr - 0.25], [p.R - 0.06, zr - 0.45]];
  const under: [number, number][] = [];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6, e = t * t * (3 - 2 * t); // curva suave até o pé
    under.push([p.R - 0.06 - (p.R - 0.06 - foot) * t, Math.max(0, (zr - 0.45) * (1 - e))]);
  }
  const prof = [...top, ...lip, ...under];
  const nP = prof.length, nV = 1 + (nP - 1) * SEG;
  const positions = new Float32Array(nV * 3), uvs = new Float32Array(nV * 2), normals = new Float32Array(nV * 3);
  const idx: number[] = [];
  const ox = p.cx - origin[0], oy = p.cy - origin[1];
  const put = (v: number, r: number, z: number, a: number, paint: boolean, nr: number, nz: number) => {
    const x = r * Math.cos(a), y = r * Math.sin(a);
    positions[v * 3] = (x + ox) / 100;
    positions[v * 3 + 1] = z / 100;
    positions[v * 3 + 2] = -(y + oy) / 100;
    // pintura vista de cima no topo; lábio e parte de baixo apontam para a faixa de fora da textura, que é só a cor
    // limpa da louça (na mesma direção do ponto, para a transição não atravessar a pintura)
    const ur = paint ? r : p.R * 1.01;
    uvs[v * 2] = 0.5 + (ur * Math.cos(a)) / (2 * p.half);
    uvs[v * 2 + 1] = 0.5 + (ur * Math.sin(a)) / (2 * p.half);
    normals[v * 3] = nr * Math.cos(a);
    normals[v * 3 + 1] = nz;
    normals[v * 3 + 2] = -nr * Math.sin(a);
  };
  // normal do perfil em cada ponto (perpendicular à tangente, apontando para fora)
  const pn = prof.map((_, i) => {
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(nP - 1, i + 1)];
    const tr = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tr, tz) || 1;
    return [-tz / l, tr / l]; // gira a tangente 90°: no topo aponta para cima
  });
  put(0, 0, prof[0][1], 0, true, 0, 1);
  for (let i = 1; i < nP; i++)
    for (let s = 0; s < SEG; s++) put(1 + (i - 1) * SEG + s, prof[i][0], prof[i][1], (s / SEG) * Math.PI * 2, i <= nTop, pn[i][0], pn[i][1]);
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + ((s + 1) % SEG));
  for (let i = 1; i < nP - 1; i++)
    for (let s = 0; s < SEG; s++) {
      const a = 1 + (i - 1) * SEG + s, b = 1 + (i - 1) * SEG + ((s + 1) % SEG), c = a + SEG, d = b + SEG;
      idx.push(a, c, d, a, d, b);
    }
  return {
    positions, uvs, normals, indices: Uint32Array.from(idx), texture: p.tex,
    dims: { w: p.R * 2, d: p.R * 2, h: zr }, roughness: p.glossy ? 0.2 : 0.7, name: "louca",
  };
}

/** A mesma louça no estilo polígonos: poucas faces planas, cada uma de uma cor (molho vira faces coloridas). */
export function buildPlatePoly(p: Plate, origin: [number, number]): HeightMesh {
  const SEG = 28, nTop = Math.max(4, Math.round(p.R / 1.5));
  const prof: [number, number][] = [];
  for (let i = 0; i <= nTop; i++) {
    const r = (p.R - 0.15) * (i / nTop);
    prof.push([r, plateHeight(p, r + p.cx, p.cy)]);
  }
  const zr = prof[nTop][1];
  prof.push([p.R, Math.max(0.2, zr - 0.35)], [p.R * 0.62, 0]);
  const ox = p.cx - origin[0], oy = p.cy - origin[1];
  const P = (i: number, s: number) => {
    const a = (s / SEG) * Math.PI * 2, [r, z] = prof[i];
    return [(r * Math.cos(a) + ox) / 100, z / 100, -(r * Math.sin(a) + oy) / 100];
  };
  const T = p.tex, clean = p.color;
  // cor de uma face do topo: se boa parte dela está pintada (molho, comida rasa), fica com a cor da pintura
  const topColor = (r0: number, r1: number, s: number) => {
    let n = 0, hit = 0, r = 0, g = 0, b = 0;
    for (let e = 0; e < 5; e++)
      for (let k = 0; k < 5; k++) {
        const rr = r0 + ((e + 0.5) / 5) * (r1 - r0), a = ((s + (k + 0.5) / 5) / SEG) * Math.PI * 2;
        const i = Math.floor(((rr * Math.cos(a) + p.half) / (2 * p.half)) * T.width), j = Math.floor(((p.half - rr * Math.sin(a)) / (2 * p.half)) * T.height);
        if (i < 0 || j < 0 || i >= T.width || j >= T.height) continue;
        const o = (j * T.width + i) * 4;
        n++;
        if (Math.hypot(T.data[o] - clean[0], T.data[o + 1] - clean[1], T.data[o + 2] - clean[2]) > 34) { hit++; r += T.data[o]; g += T.data[o + 1]; b += T.data[o + 2]; }
      }
    return n && hit > n * 0.45 ? [r / hit, g / hit, b / hit] : [clean[0], clean[1], clean[2]];
  };
  const faces: Face[] = [];
  for (let i = 0; i < prof.length - 1; i++)
    for (let s = 0; s < SEG; s++) {
      const color = i < nTop ? topColor(prof[i][0], prof[i + 1][0], s) : [clean[0], clean[1], clean[2]];
      // no centro o anel de dentro é um ponto só: triângulo
      const pts = i === 0 ? [P(0, 0), P(1, s), P(1, s + 1)] : [P(i, s), P(i + 1, s), P(i + 1, s + 1), P(i, s + 1)];
      faces.push({ pts, color });
    }
  return flatMesh(faces, { roughness: p.glossy ? 0.32 : 0.75, name: "louca" });
}

/** Sombra de contato: escurece a pintura do prato em volta e embaixo da comida (ela "assenta" no prato). */
export function shadePlate(p: Plate, g: { nx: number; ny: number; nz?: number; cell: number; dz?: number; x0: number; y0: number }, vol: Uint8Array) {
  const { nx, ny, cell, x0, y0 } = g, nz = g.nz!, dz = g.dz!, N = nx * ny, T = p.tex;
  const occ = (X: number, Y: number, Z: number) => {
    const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell), k = Math.round(Z / dz);
    return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && vol[k * N + j * nx + i] === 1;
  };
  const dirs: number[][] = [];
  for (let e = 0; e < 3; e++) for (let a = 0; a < 8; a++) {
    const el = 0.25 + e * 0.42, az = (a / 8) * Math.PI * 2 + e * 0.4;
    dirs.push([Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]);
  }
  // calculada numa grade mais grossa e ampliada com suavidade (sombra não tem detalhe fino)
  const G = 112, sh = new Float32Array(G * G).fill(1);
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const x = p.cx - p.half + ((i + 0.5) / G) * 2 * p.half, y = p.cy + p.half - ((j + 0.5) / G) * 2 * p.half;
      if (Math.hypot(x - p.cx, y - p.cy) > p.R) continue;
      const z = plateHeight(p, x, y) + 0.15;
      let open = 0;
      for (const d of dirs) {
        let free = 1;
        for (let t = 0.4; t <= 4; t += 0.6) if (occ(x + d[0] * t, y + d[1] * t, z + d[2] * t)) { free = Math.min(1, t / 4) * 0.5; break; }
        open += free;
      }
      sh[j * G + i] = open / dirs.length;
    }
  for (let it = 0; it < 2; it++) {
    const prev = sh.slice();
    for (let j = 1; j < G - 1; j++) for (let i = 1; i < G - 1; i++) sh[j * G + i] = (prev[j * G + i] * 4 + prev[j * G + i - 1] + prev[j * G + i + 1] + prev[(j - 1) * G + i] + prev[(j + 1) * G + i]) / 8;
  }
  for (let j = 0; j < T.height; j++)
    for (let i = 0; i < T.width; i++) {
      const fx = ((i + 0.5) / T.width) * G - 0.5, fy = ((j + 0.5) / T.height) * G - 0.5;
      const a = Math.max(0, Math.min(G - 2, Math.floor(fx))), b = Math.max(0, Math.min(G - 2, Math.floor(fy))), u = Math.max(0, Math.min(1, fx - a)), v = Math.max(0, Math.min(1, fy - b));
      const k = 0.5 + 0.5 * (sh[b * G + a] * (1 - u) * (1 - v) + sh[b * G + a + 1] * u * (1 - v) + sh[(b + 1) * G + a] * (1 - u) * v + sh[(b + 1) * G + a + 1] * u * v);
      const o = (j * T.width + i) * 4;
      T.data[o] *= k; T.data[o + 1] *= k; T.data[o + 2] *= k;
    }
}
