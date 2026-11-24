// Reconstrução 3D de um prato a partir de vários quadros de vídeo/fotos com o marcador visível.
//
// 1. Cada quadro tem a pose da câmera calculada pelo marcador (geometry.ts), em centímetros reais.
// 2. Casco visual: um ponto acima da mesa só pode estar ocupado se, em quase todas as vistas, a linha de visão
//    que passa por ele bate num lugar que não tem cor de mesa (a cor da mesa vem de um anel em volta do prato).
// 3. Dentro do casco, a superfície é o ponto mais alto em que os quadros concordam na cor (imagens levemente
//    borradas para tolerar pequenos erros), seguido de refinamentos usando só os quadros que enxergam o ponto.
// 4. O prato é separado da mesa sozinho (componente ligada ao centro).
// 5. O volume ocupado (casco 3D limitado pelo topo) vira a malha em volume.ts: funciona para qualquer formato.
// Resultado: um mapa de altura em escala real. Sem servidor, sem custo: roda no celular.
import type { Camera } from "./geometry";
import { cameraCenter, pixelToPlane } from "./geometry";

export type RGBA = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type View = { img: RGBA; cam: Camera };

export type HeightField = {
  x0: number; // canto da grade (cm)
  y0: number;
  cell: number; // tamanho da célula (cm)
  nx: number;
  ny: number;
  h: Float32Array; // altura de cada célula (cm)
  conf: Float32Array; // confiança 0–1
  gains?: number[][]; // ganho de cor por quadro (exposição)
  table?: number[][]; // cores típicas da mesa (RGB)
  occ?: Uint8Array; // volume ocupado (casco visual), índice k * nx * ny + q
  nz?: number;
  dz?: number;
};

export type ReconOptions = {
  half?: number; // meia-largura da área analisada (cm)
  cell?: number; // resolução da grade (cm)
  zMax?: number; // altura máxima procurada (cm)
  dz?: number; // passo de altura (cm)
  center?: [number, number]; // centro da área (cm); se ausente, estimado pelo enquadramento
  exclude?: { x0: number; x1: number; y0: number; y1: number } | null; // a folha do marcador (plana, na mesa)
  markerHalf?: number; // meia-largura do quadrado do marcador + margem (cm)
};

/** Onde está o prato: ponto da mesa para onde as câmeras apontaram (mediana dos centros das imagens). */
export function estimateCenter(views: View[]): [number, number] {
  const xs: number[] = [], ys: number[] = [];
  for (const v of views) {
    const p = pixelToPlane(v.cam, [v.cam.cx, v.cam.cy], 0);
    if (p && Math.hypot(p[0], p[1]) < 120) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
  }
  const med = (a: number[]) => (a.length ? a.sort((x, y) => x - y)[a.length >> 1] : 0);
  return [med(xs), med(ys)];
}

/** Ganho de cor por quadro (o celular muda a exposição durante o vídeo): iguala o brilho médio da área. */
function viewGains(views: View[], x0: number, y0: number, size: number) {
  const means = views.map((v) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < 24; i++)
      for (let j = 0; j < 24; j++) {
        const X = x0 + ((i + 0.5) / 24) * size, Y = y0 + ((j + 0.5) / 24) * size;
        const c = sampleWorld(v, X, Y, 0);
        if (!c) continue;
        r += c[0]; g += c[1]; b += c[2]; n++;
      }
    return n ? [r / n, g / n, b / n] : [128, 128, 128];
  });
  const ref = [0, 1, 2].map((k) => means.map((m) => m[k]).sort((a, b) => a - b)[means.length >> 1]);
  return means.map((m) => [ref[0] / Math.max(1, m[0]), ref[1] / Math.max(1, m[1]), ref[2] / Math.max(1, m[2])]);
}

function sampleWorld(v: View, X: number, Y: number, Z: number): [number, number, number] | null {
  const R = v.cam.R, t = v.cam.t;
  const xc = R[0] * X + R[1] * Y + R[2] * Z + t[0];
  const yc = R[3] * X + R[4] * Y + R[5] * Z + t[1];
  const zc = R[6] * X + R[7] * Y + R[8] * Z + t[2];
  if (zc <= 1) return null;
  const u = v.cam.f * (xc / zc) + v.cam.cx, w = v.cam.f * (yc / zc) + v.cam.cy;
  return bilinear(v.img, u, w);
}

function bilinear(img: RGBA, x: number, y: number): [number, number, number] | null {
  if (x < 1 || y < 1 || x > img.width - 2 || y > img.height - 2) return null;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, w = img.width, d = img.data;
  const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
  const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, e = fx * fy;
  return [
    d[i00] * a + d[i10] * b + d[i01] * c + d[i11] * e,
    d[i00 + 1] * a + d[i10 + 1] * b + d[i01 + 1] * c + d[i11 + 1] * e,
    d[i00 + 2] * a + d[i10 + 2] * b + d[i01 + 2] * c + d[i11 + 2] * e,
  ];
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Mapa de altura do que está sobre a mesa, em centímetros reais.
 *
 * Duas pistas combinadas:
 * - Silhueta ("casco visual"): um ponto só pode estar ocupado se, em quase todos os quadros, a linha de visão
 *   que passa por ele bate num lugar da mesa que NÃO parece mesa. Isso corta o ar acima e em volta do prato,
 *   mesmo quando a mesa é lisa (onde a comparação de cores sozinha se engana).
 * - Cores: dentro desse limite, a superfície é o ponto mais alto em que todos os quadros veem a mesma cor.
 */
export async function reconstructHeightfield(views: View[], opts: ReconOptions = {}, onProgress?: (p: number) => void): Promise<HeightField> {
  if (views.length < 4) throw new Error("Poucas imagens com a folha visível. Escaneie de novo mostrando o prato e a folha o tempo todo.");
  const half = opts.half ?? 24, cell = opts.cell ?? 0.4, zMax = opts.zMax ?? 22, dz = opts.dz ?? 0.25;
  const [cx, cy] = opts.center ?? estimateCenter(views);
  const nx = Math.round((2 * half) / cell), ny = nx, nz = Math.round(zMax / dz) + 1;
  const x0 = cx - half, y0 = cy - half;
  const gains = viewGains(views, x0, y0, 2 * half);
  const V = views.length, N = nx * ny;
  const ex = opts.exclude;
  const inSheet = (X: number, Y: number) => !!ex && X > ex.x0 && X < ex.x1 && Y > ex.y0 && Y < ex.y1;
  // o quadrado preto do marcador fica sempre na mesa (altura 0); o resto da folha é tratado como mesa conhecida
  const mk = opts.markerHalf ?? 8.5;
  const inMarker = (X: number, Y: number) => !!ex && Math.abs(X) < mk && Math.abs(Y) < mk;

  // ---- 1. a mesa vista de cima: cor de cada ponto do chão em cada quadro + a cor "de consenso" (mediana)
  // As cores do chão saem de imagens borradas na escala de uma célula: numa mesa de madeira com veios finos,
  // cada quadro cairia num veio diferente e "discordaria" da mesa, que viraria objeto.
  const groundBlur = Math.max(2, Math.round(views[0].img.width / 220));
  const gviews = views.map((v) => ({ img: blurImage(v.img, groundBlur), cam: v.cam }));
  const gm = 16; // margem extra (cm): raios inclinados batem no chão longe do prato
  const gh = half + gm, gn = Math.round((2 * gh) / cell), gx0 = cx - gh, gy0 = cy - gh, GN = gn * gn;
  const gcol = new Float32Array(V * GN * 3).fill(NaN);
  const bgc = new Float32Array(GN * 3);
  const spread = new Float32Array(GN); // quanto os quadros discordam sobre a cor deste ponto do chão
  const tmp: number[][] = [[], [], []];
  const dev: number[] = [];
  for (let q = 0; q < GN; q++) {
    const X = gx0 + ((q % gn) + 0.5) * cell, Y = gy0 + (((q / gn) | 0) + 0.5) * cell;
    tmp[0].length = tmp[1].length = tmp[2].length = 0;
    for (let v = 0; v < V; v++) {
      const c = sampleWorld(gviews[v], X, Y, 0);
      if (!c) continue;
      const g = gains[v], o = (v * GN + q) * 3;
      for (let ch = 0; ch < 3; ch++) { gcol[o + ch] = c[ch] * g[ch]; tmp[ch].push(c[ch] * g[ch]); }
    }
    for (let ch = 0; ch < 3; ch++) {
      const a = tmp[ch].sort((x, y) => x - y);
      bgc[q * 3 + ch] = a.length ? a[a.length >> 1] : NaN;
    }
    dev.length = 0;
    for (let v = 0; v < V; v++) {
      const o = (v * GN + q) * 3;
      if (gcol[o] === gcol[o]) dev.push(Math.abs(gcol[o] - bgc[q * 3]) + Math.abs(gcol[o + 1] - bgc[q * 3 + 1]) + Math.abs(gcol[o + 2] - bgc[q * 3 + 2]));
    }
    dev.sort((x, y) => x - y);
    spread[q] = dev.length ? dev[dev.length >> 1] : 1e9;
  }
  onProgress?.(0.1);
  await tick();

  // cores típicas da mesa: anel em volta da área (fora do prato e da folha), resumidas em poucas cores
  const QB = 16, acc = new Map<number, number[]>();
  for (let q = 0; q < GN; q++) {
    const X = gx0 + ((q % gn) + 0.5) * cell, Y = gy0 + (((q / gn) | 0) + 0.5) * cell;
    if (Math.max(Math.abs(X - cx), Math.abs(Y - cy)) < half + 2 || !(bgc[q * 3] === bgc[q * 3])) continue;
    if (inSheet(X - 2, Y) || inSheet(X + 2, Y) || inSheet(X, Y - 2) || inSheet(X, Y + 2)) continue;
    const r = bgc[q * 3], g = bgc[q * 3 + 1], b = bgc[q * 3 + 2];
    const key = ((Math.min(QB - 1, (r / 256) * QB) | 0) * QB + (Math.min(QB - 1, (g / 256) * QB) | 0)) * QB + (Math.min(QB - 1, (b / 256) * QB) | 0);
    const e = acc.get(key) ?? [0, 0, 0, 0];
    e[0] += r; e[1] += g; e[2] += b; e[3]++;
    acc.set(key, e);
  }
  let ringTotal = 0;
  for (const e of acc.values()) ringTotal += e[3];
  const palette = [...acc.values()].filter((e) => e[3] >= Math.max(3, ringTotal * 0.015)).map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3]]);
  const tableDist = (r: number, g: number, b: number) => {
    let m = Infinity;
    for (const p of palette) m = Math.min(m, Math.abs(r - p[0]) + Math.abs(g - p[1]) + Math.abs(b - p[2]));
    return palette.length ? m : 0;
  };
  // fundo[v][G] = o quadro v vê mesa (ou folha) livre no ponto G do chão
  const ground = new Uint8Array(V * GN);
  for (let v = 0; v < V; v++)
    for (let q = 0; q < GN; q++) {
      const o = (v * GN + q) * 3;
      if (!(gcol[o] === gcol[o])) { ground[v * GN + q] = 2; continue; } // fora do quadro: sem opinião
      const X = gx0 + ((q % gn) + 0.5) * cell, Y = gy0 + (((q / gn) | 0) + 0.5) * cell;
      const d = Math.abs(gcol[o] - bgc[q * 3]) + Math.abs(gcol[o + 1] - bgc[q * 3 + 1]) + Math.abs(gcol[o + 2] - bgc[q * 3 + 2]);
      if (inSheet(X, Y)) ground[v * GN + q] = d < 60 ? 1 : 0; // folha: plana e conhecida
      // mesa livre: os quadros concordam sobre este ponto (é plano), este quadro também, e a cor é de mesa.
      // Embaixo da comida os quadros veem partes diferentes dela e discordam: aí não é mesa.
      else ground[v * GN + q] = spread[q] < 24 && d < 45 && tableDist(gcol[o], gcol[o + 1], gcol[o + 2]) < 40 ? 1 : 0;
    }
  onProgress?.(0.2);
  await tick();

  // ---- 2. casco visual em 3D: cada "cubinho" (voxel) acima da mesa está ocupado se quase todas as vistas
  // o enxergam na frente de algo que não é mesa. Não precisa estar apoiado: pega taças com haste, casquinhas,
  // pães em pé, espetinhos, sorvete transbordando do pote...
  const C = views.map((v) => cameraCenter(v.cam));
  const occ = new Uint8Array(N * nz); // índice k * N + q
  const tol = Math.max(1, Math.floor(V * 0.2));
  for (let q = 0; q < N; q++) {
    const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
    if (inMarker(X, Y)) continue;
    for (let k = 0; k < nz; k++) {
      const Z = k * dz;
      let free = 0;
      for (let v = 0; v < V && free <= tol; v++) {
        const c = C[v];
        if (c[2] <= Z + 1) continue;
        const s = c[2] / (c[2] - Z);
        const GX = c[0] + (X - c[0]) * s, GY = c[1] + (Y - c[1]) * s;
        const gi = Math.floor((GX - gx0) / cell), gj = Math.floor((GY - gy0) / cell);
        if (gi < 0 || gj < 0 || gi >= gn || gj >= gn) { free++; continue; } // raio sai da área: lá é mesa
        if (ground[v * GN + gj * gn + gi] === 1) free++;
      }
      if (free <= tol) occ[k * N + q] = 1;
    }
    if (q % 2000 === 0) { onProgress?.(0.2 + (q / N) * 0.18); await tick(); }
  }
  // fecha buracos pequenos em cada fatia horizontal (manchas da comida com cor parecida com a da mesa)
  const rClose = Math.max(2, Math.round(1.2 / cell));
  for (let k = 0; k < nz; k++) closeMask(occ.subarray(k * N, (k + 1) * N), nx, ny, rClose);
  const hullK = new Int16Array(N).fill(-1);
  for (let q = 0; q < N; q++) for (let k = nz - 1; k >= 0; k--) if (occ[k * N + q]) { hullK[q] = k; break; }
  onProgress?.(0.4);
  await tick();

  // ---- 3. consistência de cor por altura (só onde o casco permite)
  let maxK = 0;
  for (let q = 0; q < N; q++) maxK = Math.max(maxK, hullK[q]);
  const nzz = maxK + 1;
  const cost = new Float32Array(nzz * N).fill(1e9);
  const raw = new Float32Array(N);
  // imagens levemente borradas: tolera erros de 1–3 px na posição da câmera e texturas muito finas
  const blurR = Math.max(2, Math.round(views[0].img.width / 320));
  const soft = views.map((v) => ({ img: blurImage(v.img, blurR), cam: v.cam }));
  const cols = new Float32Array(V * 3), dist = new Float32Array(V);
  // visibilidade: o quadro só "vota" num ponto se a linha até a câmera não atravessa o casco
  const visible = (v: number, X: number, Y: number, Z: number, HH: Float32Array, hMax: number) => {
    const c = C[v], ddx = c[0] - X, ddy = c[1] - Y, ddz = c[2] - Z, hl = Math.hypot(ddx, ddy);
    if (hl < 1e-6) return true;
    const sx = (ddx / hl) * cell, sy = (ddy / hl) * cell, sz = (ddz / hl) * cell;
    let x = X + sx, y = Y + sy, z = Z + sz;
    while (z < hMax) {
      const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return true;
      if (HH[j * nx + i] > z + 0.3) return false;
      x += sx; y += sy; z += sz;
    }
    return true;
  };
  const keepFrac = 0.7;
  for (let k = 0; k < nzz; k++) {
    const Z = k * dz;
    raw.fill(1e9);
    for (let q = 0; q < N; q++) {
      if (hullK[q] < k) continue;
      const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
      let n = 0, mr = 0, mg = 0, mb = 0;
      for (let v = 0; v < V; v++) {
        const c = sampleWorld(soft[v], X, Y, Z);
        if (!c) continue;
        const g = gains[v];
        cols[n * 3] = c[0] * g[0]; cols[n * 3 + 1] = c[1] * g[1]; cols[n * 3 + 2] = c[2] * g[2];
        mr += cols[n * 3]; mg += cols[n * 3 + 1]; mb += cols[n * 3 + 2]; n++;
      }
      if (n < 3) continue;
      // cor de consenso robusta: descarta os quadros mais diferentes (reflexos, borrões)
      mr /= n; mg /= n; mb /= n;
      for (let it = 0; it < 2; it++) {
        for (let a = 0; a < n; a++) dist[a] = Math.abs(cols[a * 3] - mr) + Math.abs(cols[a * 3 + 1] - mg) + Math.abs(cols[a * 3 + 2] - mb);
        const sorted = Array.from(dist.subarray(0, n)).sort((x, y) => x - y);
        const keep = Math.max(3, Math.ceil(n * keepFrac)), lim = sorted[keep - 1];
        let r = 0, gg = 0, b = 0, m = 0, sd = 0;
        for (let a = 0; a < n; a++) if (dist[a] <= lim) { r += cols[a * 3]; gg += cols[a * 3 + 1]; b += cols[a * 3 + 2]; m++; sd += dist[a]; }
        mr = r / m; mg = gg / m; mb = b / m;
        if (it === 1) raw[q] = sd / m;
      }
    }
    // agrega em 3×3 células
    for (let q = 0; q < N; q++) {
      if (hullK[q] < k) continue;
      const i = q % nx, j = (q / nx) | 0;
      let s = 0, m = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const x = raw[jj * nx + ii];
        if (x < 1e8) { s += x; m++; }
      }
      cost[k * N + q] = m ? s / m : 1e9;
    }
    if (k % 4 === 0) {
      onProgress?.(0.4 + (k / nzz) * 0.55);
      await tick();
    }
  }

  const AMBIG = 3.5; // se mais de 3,5 cm de alturas "combinam" com as cores, a célula é incerta
  // ---- 4. superfície: o ponto mais alto (dentro do casco) cuja cor é quase tão consistente quanto a melhor
  const h = new Float32Array(N), conf = new Float32Array(N);
  for (let q = 0; q < N; q++) {
    const K = hullK[q];
    if (K < 0) { h[q] = 0; conf[q] = 1; continue; }
    let cmin = Infinity;
    for (let k = 0; k <= K; k++) if (occ[k * N + q]) cmin = Math.min(cmin, cost[k * N + q]);
    const lim = cmin + Math.max(6, cmin * 0.35);
    let best = 0;
    for (let k = K; k >= 0; k--) if (occ[k * N + q] && cost[k * N + q] <= lim) { best = k; break; }
    // desce até o fundo do "vale" de custo mais próximo (a superfície real fica no mínimo local)
    while (best > 0 && occ[(best - 1) * N + q] && cost[(best - 1) * N + q] < cost[best * N + q]) best--;
    h[q] = best * dz;
    // Superfície lisa (cobertura de chocolate, creme, molho): qualquer altura "combina" e a escolha acima vira
    // um morrinho, porque o casco é mais alto que o objeto. Essas células ficam marcadas como incertas.
    let acc = 0;
    for (let k = 0; k <= K; k++) if (occ[k * N + q] && cost[k * N + q] <= lim) acc++;
    conf[q] = best * dz > 1 && acc * dz > AMBIG ? 0 : 1;
  }
  let hm = median3(h, nx, ny);
  fillUncertain(hm, conf, nx, ny);
  // ---- 5. refinamento com visibilidade: agora que a forma é conhecida, cada ponto só é julgado pelos quadros
  // que realmente o enxergam, e TODOS eles precisam concordar. Isso remove a "saia" que sobra sobre
  // superfícies lisas (prato branco) ao lado da comida.
  const passes = 3;
  for (let pass = 0; pass < passes; pass++) {
    let hMax = 0;
    for (let q = 0; q < N; q++) hMax = Math.max(hMax, hm[q]);
    const next = new Float32Array(hm);
    for (let q = 0; q < N; q++) {
      const top = Math.round(hm[q] / dz);
      if (top <= 1 || hullK[q] < 0) continue;
      const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
      const cs: number[] = [];
      for (let k = 0; k <= top; k++) {
        const Z = k * dz;
        let n = 0, mr = 0, mg = 0, mb = 0;
        for (let v = 0; v < V; v++) {
          if (!visible(v, X, Y, Z + 0.3, hm, hMax)) continue;
          const c = sampleWorld(soft[v], X, Y, Z);
          if (!c) continue;
          const g = gains[v];
          cols[n * 3] = c[0] * g[0]; cols[n * 3 + 1] = c[1] * g[1]; cols[n * 3 + 2] = c[2] * g[2];
          mr += cols[n * 3]; mg += cols[n * 3 + 1]; mb += cols[n * 3 + 2]; n++;
        }
        if (n < 4) { cs.push(NaN); continue; }
        mr /= n; mg /= n; mb /= n;
        for (let a = 0; a < n; a++) dist[a] = Math.abs(cols[a * 3] - mr) + Math.abs(cols[a * 3 + 1] - mg) + Math.abs(cols[a * 3 + 2] - mb);
        const sorted = Array.from(dist.subarray(0, n)).sort((x, y) => x - y);
        // tolera só 1 em cada 8 quadros discordando (reflexo/borrão)
        const keep = Math.max(3, Math.ceil(n * 0.88));
        let sd = 0;
        for (let a = 0; a < keep; a++) sd += sorted[a];
        cs.push(sd / keep);
      }
      // o topo atual precisa ser consistente; se não for, desce até o ponto consistente mais alto
      let cmin = Infinity;
      for (const c of cs) if (c === c) cmin = Math.min(cmin, c);
      if (!(cmin < Infinity)) continue;
      const lim = cmin + Math.max(6, cmin * 0.35);
      // o topo atual já é bem consistente (todos os quadros que o veem concordam): mantém
      if (Math.min(cs[top] ?? Infinity, cs[top - 1] ?? Infinity) <= 35) continue;
      let best = -1;
      for (let k = top; k >= 0; k--) if (cs[k] === cs[k] && cs[k] <= lim) { best = k; break; }
      if (best >= 0 && best < top) next[q] = best * dz;
    }
    hm = median3(next, nx, ny);
    onProgress?.(0.97 + pass * 0.01);
    await tick();
  }
  onProgress?.(1);
  return { x0, y0, cell, nx, ny, h: hm, conf, gains, table: palette, occ, nz, dz };
}

/** Fechamento morfológico de uma máscara 2D (dilata e depois erode). */
function closeMask(m: Uint8Array, nx: number, ny: number, r: number) {
  let any = false;
  for (let q = 0; q < m.length; q++) if (m[q]) { any = true; break; }
  if (!any) return;
  const d = morphR(m, nx, ny, r, true), e = morphR(d, nx, ny, r, false);
  for (let q = 0; q < m.length; q++) m[q] = e[q] | m[q];
}

function morphR(m: Uint8Array, nx: number, ny: number, r: number, dilate: boolean) {
  // separável (quadrado) em duas passadas: rápido o bastante para todas as fatias
  const t = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const ii = Math.min(nx - 1, Math.max(0, i + d)), x = m[j * nx + ii];
        if (dilate ? x : !x) { v = dilate ? 1 : 0; break; }
      }
      t[j * nx + i] = v;
    }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      let v = dilate ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const jj = Math.min(ny - 1, Math.max(0, j + d)), x = t[jj * nx + i];
        if (dilate ? x : !x) { v = dilate ? 1 : 0; break; }
      }
      out[j * nx + i] = v;
    }
  return out;
}


/** Borrão rápido (caixa separável, 2 passadas ≈ gaussiano). */
export function blurImage(img: RGBA, r: number): RGBA {
  const w = img.width, h = img.height;
  let src = new Float32Array(img.data.length);
  for (let i = 0; i < src.length; i++) src[i] = img.data[i];
  let dst = new Float32Array(src.length);
  const k = 2 * r + 1;
  for (let pass = 0; pass < 4; pass++) {
    const horiz = pass % 2 === 0;
    const len = horiz ? w : h, lines = horiz ? h : w;
    for (let l = 0; l < lines; l++) {
      for (let ch = 0; ch < 3; ch++) {
        const at = (i: number) => (horiz ? (l * w + Math.min(w - 1, Math.max(0, i))) : (Math.min(h - 1, Math.max(0, i)) * w + l)) * 4 + ch;
        let acc = 0;
        for (let i = -r; i <= r; i++) acc += src[at(i)];
        for (let i = 0; i < len; i++) {
          dst[at(i)] = acc / k;
          acc += src[at(i + r + 1)] - src[at(i - r)];
        }
      }
    }
    [src, dst] = [dst, src];
  }
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < out.length; i++) out[i] = (i & 3) === 3 ? 255 : src[i];
  return { data: out, width: w, height: h };
}

function median3(h: Float32Array, nx: number, ny: number) {
  const out = new Float32Array(h.length), w = new Float32Array(9);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const x = Math.min(nx - 1, Math.max(0, i + a)), y = Math.min(ny - 1, Math.max(0, j + b));
        w[n++] = h[y * nx + x];
      }
      w.sort();
      out[j * nx + i] = w[4];
    }
  return out;
}

/** Células incertas recebem a altura das vizinhas confiáveis DO PRÓPRIO OBJETO (a mesa não entra na conta),
 * como uma membrana esticada entre as bordas bem medidas. Nunca sobe além do que já estava (limite do casco). */
function fillUncertain(h: Float32Array, conf: Float32Array, nx: number, ny: number) {
  const top = new Float32Array(h);
  const free = new Uint8Array(h.length), wall = new Uint8Array(h.length);
  let any = false;
  for (let q = 0; q < h.length; q++) {
    free[q] = conf[q] === 0 && h[q] > 1 ? 1 : 0;
    wall[q] = !free[q] && h[q] < 0.6 ? 1 : 0; // mesa: não puxa a altura para baixo
    if (free[q]) any = true;
  }
  if (!any) return;
  // região incerta sem nenhuma vizinha confiável do objeto: não há de onde tirar a altura, fica como estava
  const anchored = new Uint8Array(h.length), stack: number[] = [];
  for (let q = 0; q < h.length; q++) if (!free[q] && !wall[q]) stack.push(q);
  while (stack.length) {
    const q = stack.pop()!, i = q % nx, j = (q / nx) | 0;
    for (const t of [i > 0 ? q - 1 : -1, i < nx - 1 ? q + 1 : -1, j > 0 ? q - nx : -1, j < ny - 1 ? q + nx : -1])
      if (t >= 0 && free[t] && !anchored[t]) { anchored[t] = 1; stack.push(t); }
  }
  for (let it = 0; it < 240; it++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        if (!free[q] || !anchored[q]) continue;
        let s = 0, n = 0;
        if (i > 0 && !wall[q - 1]) { s += h[q - 1]; n++; }
        if (i < nx - 1 && !wall[q + 1]) { s += h[q + 1]; n++; }
        if (j > 0 && !wall[q - nx]) { s += h[q - nx]; n++; }
        if (j < ny - 1 && !wall[q + nx]) { s += h[q + nx]; n++; }
        if (n) h[q] = Math.min(top[q], s / n);
      }
}

function inpaint(h: Float32Array, conf: Float32Array, nx: number, ny: number, minConf: number) {
  const fixed = new Uint8Array(h.length);
  for (let q = 0; q < h.length; q++) fixed[q] = conf[q] >= minConf ? 1 : 0;
  for (let it = 0; it < 60; it++) {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        if (fixed[q]) continue;
        let s = 0, n = 0;
        if (i > 0) { s += h[q - 1]; n++; }
        if (i < nx - 1) { s += h[q + 1]; n++; }
        if (j > 0) { s += h[q - nx]; n++; }
        if (j < ny - 1) { s += h[q + nx]; n++; }
        h[q] = s / n;
      }
  }
}

export type Dish = {
  mask: Uint8Array; // 1 = prato
  centroid: [number, number]; // cm
  dims: { w: number; d: number; h: number }; // cm
  axis: number; // ângulo do eixo maior (rad)
};

/** Separa o prato da mesa: tudo acima de `minH` ligado à região central. */
export function segmentDish(hf: HeightField, minH = 0.45): Dish {
  const { nx, ny, h, cell, x0, y0 } = hf;
  const above = new Uint8Array(nx * ny);
  for (let q = 0; q < h.length; q++) above[q] = h[q] > minH ? 1 : 0;
  // abertura morfológica leve (tira pontinhos soltos)
  const er = morph(above, nx, ny, false), op = morph(er, nx, ny, true);
  // componentes conectados; fica o maior que encosta na região central
  const label = new Int32Array(nx * ny).fill(-1);
  let bestId = -1, bestScore = 0;
  const comps: number[][] = [];
  for (let q = 0; q < op.length; q++) {
    if (!op[q] || label[q] >= 0) continue;
    const id = comps.length, stack = [q], cells: number[] = [];
    label[q] = id;
    while (stack.length) {
      const c = stack.pop()!; cells.push(c);
      const i = c % nx, j = (c / nx) | 0;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + a, y = j + b;
        if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
        const n = y * nx + x;
        if (op[n] && label[n] < 0) { label[n] = id; stack.push(n); }
      }
    }
    comps.push(cells);
    // pontuação: tamanho, com peso para perto do centro
    let near = 0;
    for (const c of cells) { const i = c % nx, j = (c / nx) | 0; if (Math.hypot(i - nx / 2, j - ny / 2) < nx * 0.3) near++; }
    const score = cells.length * (0.2 + near / cells.length);
    if (score > bestScore) { bestScore = score; bestId = id; }
  }
  const mask = new Uint8Array(nx * ny);
  if (bestId < 0) throw new Error("Não encontrei o prato no vídeo. Ele precisa aparecer inteiro, ao lado da folha.");
  for (const c of comps[bestId]) mask[c] = 1;
  // preenche buracos (partes lisas do prato sem textura)
  const outside = new Uint8Array(nx * ny), st: number[] = [];
  for (let i = 0; i < nx; i++) for (const j of [0, ny - 1]) if (!mask[j * nx + i]) { outside[j * nx + i] = 1; st.push(j * nx + i); }
  for (let j = 0; j < ny; j++) for (const i of [0, nx - 1]) if (!mask[j * nx + i] && !outside[j * nx + i]) { outside[j * nx + i] = 1; st.push(j * nx + i); }
  while (st.length) {
    const c = st.pop()!, i = c % nx, j = (c / nx) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i + a, y = j + b;
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const n = y * nx + x;
      if (!mask[n] && !outside[n]) { outside[n] = 1; st.push(n); }
    }
  }
  for (let q = 0; q < mask.length; q++) if (!outside[q]) mask[q] = 1;

  // medidas pelos eixos principais (PCA)
  let sx = 0, sy = 0, n = 0;
  const hs: number[] = [];
  for (let q = 0; q < mask.length; q++) if (mask[q]) { const i = q % nx, j = (q / nx) | 0; sx += i; sy += j; n++; hs.push(h[q]); }
  const mx = sx / n, my = sy / n;
  let cxx = 0, cyy = 0, cxy = 0;
  for (let q = 0; q < mask.length; q++) if (mask[q]) { const i = (q % nx) - mx, j = ((q / nx) | 0) - my; cxx += i * i; cyy += j * j; cxy += i * j; }
  const axis = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const ca = Math.cos(axis), sa = Math.sin(axis);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let q = 0; q < mask.length; q++) if (mask[q]) {
    const i = (q % nx) - mx, j = ((q / nx) | 0) - my;
    const u = i * ca + j * sa, v = -i * sa + j * ca;
    a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v);
  }
  hs.sort((a, b) => a - b);
  const hTop = hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.993))];
  const w = (a1 - a0 + 1) * cell, d = (b1 - b0 + 1) * cell;
  return {
    mask,
    centroid: [x0 + (mx + 0.5) * cell, y0 + (my + 0.5) * cell],
    dims: { w: Math.round(Math.max(w, d) * 10) / 10, d: Math.round(Math.min(w, d) * 10) / 10, h: Math.round(hTop * 10) / 10 },
    axis,
  };
}

function morph(m: Uint8Array, nx: number, ny: number, dilate: boolean) {
  const out = new Uint8Array(m.length);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let v = dilate ? 0 : 1;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const x = i + a, y = j + b;
        const s = x < 0 || y < 0 || x >= nx || y >= ny ? 0 : m[y * nx + x];
        if (dilate) v |= s; else v &= s;
      }
      out[j * nx + i] = v;
    }
  return out;
}

/** Escolhe os melhores quadros: espalhados em volta do prato (azimute) e variados em altura. */
export function selectViews<T extends { cam: Camera; sharp: number }>(all: T[], center: [number, number], max = 24): T[] {
  const bins = new Map<number, T>();
  for (const v of all) {
    const C = cameraCenter(v.cam);
    const az = Math.atan2(C[1] - center[1], C[0] - center[0]);
    const el = Math.atan2(C[2], Math.hypot(C[0] - center[0], C[1] - center[1]));
    const key = Math.round(((az + Math.PI) / (2 * Math.PI)) * 18) * 10 + (el > 0.9 ? 1 : 0);
    const cur = bins.get(key);
    if (!cur || v.sharp > cur.sharp) bins.set(key, v);
  }
  const list = [...bins.values()].sort((a, b) => b.sharp - a.sharp);
  return list.slice(0, max);
}

/** Nitidez de uma imagem (variância do laplaciano na região central) — descarta quadros tremidos. */
export function sharpness(img: RGBA) {
  const { width: w, height: h, data: d } = img;
  let s = 0, s2 = 0, n = 0;
  for (let y = (h * 0.25) | 0; y < h * 0.75; y += 2)
    for (let x = (w * 0.25) | 0; x < w * 0.75; x += 2) {
      const L = (i: number) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      const c = (y * w + x) * 4;
      const lap = 4 * L(c) - L(c - 4) - L(c + 4) - L(c - w * 4) - L(c + w * 4);
      s += lap; s2 += lap * lap; n++;
    }
  return s2 / n - (s / n) ** 2;
}

/** Itens redondos (copos, taças, bolos, pizzas, pratos): cada anel em volta do centro tem altura parecida.
 * Corrige pontos fora da curva e lados pouco filmados sem apagar os detalhes da comida. */
export function applyRoundPrior(hf: HeightField, dish: Dish) {
  const { nx, ny, cell, x0, y0, h } = hf;
  const [cx, cy] = dish.centroid;
  const rings = new Map<number, number[]>();
  const ringOf = (q: number) => {
    const X = x0 + ((q % nx) + 0.5) * cell, Y = y0 + (((q / nx) | 0) + 0.5) * cell;
    return Math.round(Math.hypot(X - cx, Y - cy) / cell);
  };
  for (let q = 0; q < nx * ny; q++) {
    if (!dish.mask[q]) continue;
    const r = ringOf(q);
    if (!rings.has(r)) rings.set(r, []);
    rings.get(r)!.push(h[q]);
  }
  const med = new Map<number, number>();
  for (const [r, a] of rings) {
    a.sort((x, y) => x - y);
    med.set(r, a[a.length >> 1]);
  }
  for (let q = 0; q < nx * ny; q++) {
    if (!dish.mask[q]) continue;
    const m = med.get(ringOf(q)) ?? h[q];
    const tol = 0.3 * m + 0.6;
    h[q] = Math.min(m + tol, Math.max(m - tol, h[q]));
  }
}

/** Itens de topo reto (fatia de bolo, copo, taça, bebida, pizza): quando a cobertura é lisa (chocolate, creme),
 * as vistas não conseguem dizer a altura do meio, e sobra um "morrinho". A borda do topo é medida com precisão,
 * então o topo é nivelado pela altura da borda. */
export function applyFlatTopPrior(hf: HeightField, dish: Dish, pct = 0.3) {
  const { h, nx, ny } = hf;
  let max = 0;
  for (let q = 0; q < nx * ny; q++) if (dish.mask[q]) max = Math.max(max, h[q]);
  if (max < 1.5) return;
  const top: number[] = [];
  for (let q = 0; q < nx * ny; q++) if (dish.mask[q] && h[q] > max * 0.6) top.push(h[q]);
  if (top.length < 8) return;
  top.sort((a, b) => a - b);
  const level = top[Math.floor(top.length * pct)] + 0.3;
  for (let q = 0; q < nx * ny; q++) if (dish.mask[q] && h[q] > level) h[q] = level;
}
