// Guarnições pequenas que a câmera não consegue esculpir bem (um morango tem 3 cm: vira uma bolinha disforme).
// Quando a IA reconhece o pedaço, ele é redesenhado: forma de morango com bem mais polígonos, sementes e folhinhas,
// no lugar, no tamanho e na cor medidos nas fotos.
import type { HeightMesh } from "./heightmesh";
import type { Berry } from "./understand";

type V3 = [number, number, number];

/** Perfil do morango ao longo do eixo (t: 0 = ponta, 1 = onde ficam as folhas), raio relativo. */
function profile(t: number) {
  if (t <= 0.7) return Math.pow(Math.sin((Math.min(1, t / 0.7) * Math.PI) / 2), 0.78);
  const s = (t - 0.7) / 0.3;
  return Math.sqrt(Math.max(0, 1 - 0.72 * s * s));
}

/** Textura: casca vermelha com sementes em espiral (com a "covinha" em volta) e uma faixa verde para as folhas. */
function berryTexture(base: [number, number, number]) {
  const W = 512, H = 512, tex = new Uint8ClampedArray(W * H * 4);
  // cor de base mais viva que a da foto (a foto tem sombra e reflexo)
  const l = 0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2];
  const sat = (c: number) => Math.max(0, Math.min(255, l + (c - l) * 1.25));
  const red: V3 = [Math.max(150, sat(base[0])), Math.min(70, sat(base[1])), Math.min(80, sat(base[2]))];
  const skinH = Math.round(H * 0.8);
  const COLS = 22, ROWS = 15;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (y >= skinH) {
        // faixa das folhas (verde, mais claro no meio)
        const g = (y - skinH) / (H - skinH);
        tex[o] = 46 + 30 * g; tex[o + 1] = 118 + 40 * g; tex[o + 2] = 40 + 12 * g; tex[o + 3] = 255;
        continue;
      }
      const t = 1 - y / skinH; // 0 = ponta (embaixo da faixa), 1 = topo
      const u = x / W;
      // gradiente: ponta um pouco mais escura, perto das folhas mais claro (a parte que pegou menos sol)
      const pale = Math.max(0, (t - 0.82) / 0.18), dark = Math.max(0, (0.25 - t) / 0.25) * 0.12;
      let r = red[0] * (1 - dark) * (1 - pale) + 236 * pale, g = red[1] * (1 - dark) * (1 - pale) + 150 * pale, b = red[2] * (1 - dark) * (1 - pale) + 120 * pale;
      // sementes: grade em diagonal (cada linha deslocada meia coluna)
      if (t > 0.06 && t < 0.9) {
        const row = t * ROWS, ri = Math.round(row), off = (ri % 2) * 0.5;
        const col = u * COLS + off, ci = Math.round(col);
        const du = (col - ci) / (1.0), dv = (row - ri) / (1.0);
        const dist = Math.hypot(du * 2.4, dv * 1.9); // elipse um pouco mais alta que larga
        if (dist < 0.62) {
          // covinha escura em volta, semente amarelada no centro, um pontinho de brilho
          const k = dist < 0.3 ? 0 : (dist - 0.3) / 0.32;
          const sr = 228, sg = 196, sb = 92;
          const pit = 0.55 + 0.45 * k;
          r = dist < 0.3 ? sr : r * pit; g = dist < 0.3 ? sg : g * pit; b = dist < 0.3 ? sb : b * pit;
          if (dist < 0.1) { r = 250; g = 236; b = 170; }
        }
      }
      tex[o] = r; tex[o + 1] = g; tex[o + 2] = b; tex[o + 3] = 255;
    }
  return { data: tex, width: W, height: H, skinV: 1 - skinH / H };
}

function normalsOf(pos: number[], idx: number[]) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/**
 * Malhas do morango (fruta + folhinhas) já no lugar certo. `origin` é o centro do prato (cm), como nas outras partes.
 * Saída no padrão das outras malhas: metros, y para cima.
 */
export function buildStrawberry(b: Berry, origin: [number, number], seed = 1): HeightMesh[] {
  const SEG = 56, RINGS = 44;
  const tex = berryTexture(b.color);
  let rnd = seed * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  const lobes = [rand() * 6.28, rand() * 6.28];
  // eixo local: z vai da ponta (0) ao topo (len); x/y em volta
  const local: V3[] = [], uv: [number, number][] = [];
  const radius = (t: number, th: number) => b.rad * profile(t) * (1 + 0.045 * Math.sin(3 * th + lobes[0] + t * 2.5) + 0.025 * Math.sin(5 * th + lobes[1]));
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    for (let s = 0; s <= SEG; s++) {
      const th = (s / SEG) * Math.PI * 2, r = radius(t, th);
      // ponta levemente arredondada
      const z = b.len * (t === 0 ? 0.01 : t) * 0.94;
      local.push([r * Math.cos(th), r * Math.sin(th), z]);
      // casca: v = 0,2 (ponta) até 1 (topo); a faixa verde fica em v < 0,2
      uv.push([s / SEG, tex.skinV + 0.005 + t * (1 - tex.skinV - 0.01)]);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < RINGS; i++)
    for (let s = 0; s < SEG; s++) {
      const a = i * (SEG + 1) + s, c = a + SEG + 1;
      idx.push(a, a + 1, c + 1, a, c + 1, c);
    }
  // tampa de cima (fica embaixo das folhas)
  const topC = local.length, zTop = b.len * 0.94;
  local.push([0, 0, zTop + b.rad * 0.06]);
  uv.push([0.5, 0.985]);
  for (let s = 0; s < SEG; s++) idx.push(RINGS * (SEG + 1) + s, RINGS * (SEG + 1) + s + 1, topC);

  // folhinhas: 7 sépalas saindo do topo e deitando sobre o "ombro" do morango
  const lv: V3[] = [], luv: [number, number][] = [], lidx: number[] = [];
  const NS = 7, rTop = b.rad * profile(1);
  for (let k = 0; k < NS; k++) {
    const th0 = (k / NS) * Math.PI * 2 + rand() * 0.3, L = b.rad * (0.95 + rand() * 0.25), Wd = b.rad * 0.36;
    const base = lv.length;
    const STEPS = 6;
    for (let i = 0; i <= STEPS; i++) {
      const f = i / STEPS, wHalf = Wd * Math.sin(Math.PI * Math.min(1, f * 1.15)) * (1 - f * 0.35) * 0.5;
      // anda para fora e desce acompanhando o ombro
      const rr = rTop * 0.25 + L * f, drop = Math.pow(f, 1.6) * b.rad * 0.55;
      for (const side of [-1, 0, 1]) {
        const th = th0 + (side * wHalf) / Math.max(0.3, rr);
        lv.push([rr * Math.cos(th), rr * Math.sin(th), zTop + b.rad * 0.08 - drop + (side === 0 ? b.rad * 0.03 : 0)]);
        luv.push([0.5 + side * 0.2, tex.skinV * (0.15 + 0.7 * (1 - f))]);
      }
    }
    for (let i = 0; i < STEPS; i++)
      for (let c = 0; c < 2; c++) {
        const a = base + i * 3 + c, d = a + 3;
        lidx.push(a, a + 1, d + 1, a, d + 1, d);
      }
  }
  // cabinho
  const sBase = lv.length, SR = b.rad * 0.09, SH = b.rad * 0.45;
  for (let i = 0; i <= 1; i++)
    for (let s = 0; s <= 8; s++) {
      const th = (s / 8) * Math.PI * 2;
      lv.push([SR * Math.cos(th) + i * SR * 0.6, SR * Math.sin(th), zTop + b.rad * 0.05 + i * SH]);
      luv.push([s / 8, tex.skinV * 0.5]);
    }
  for (let s = 0; s < 8; s++) { const a = sBase + s, c = a + 9; lidx.push(a, a + 1, c + 1, a, c + 1, c); }

  // posição no prato: em pé (ponta para baixo) ou deitado, com as folhas para o lado certo
  const place = (p: V3): V3 => {
    let X: number, Y: number, Z: number;
    if (b.upright) { X = b.x + p[0]; Y = b.y + p[1]; Z = b.z0 + p[2]; }
    else {
      // eixo do morango na horizontal, ao longo de `ax`; levemente inclinado (a ponta encosta no prato)
      const dir = b.calyxAt, ca = Math.cos(b.ax) * dir, sa = Math.sin(b.ax) * dir;
      const along = p[2] - b.len / 2, tilt = 0.12;
      X = b.x + ca * along - sa * p[0];
      Y = b.y + sa * along + ca * p[0];
      Z = b.z0 + b.rad * 0.92 + p[1] + along * tilt;
    }
    return [(X - origin[0]) / 100, Z / 100, -(Y - origin[1]) / 100];
  };
  const pack = (pts: V3[], uvs: [number, number][], ids: number[], texture: HeightMesh["texture"], rough: number, name: string, doubleSided = false): HeightMesh => {
    const flat: number[] = [];
    for (const p of pts) flat.push(...place(p));
    const positions = Float32Array.from(flat);
    return {
      positions, uvs: Float32Array.from(uvs.flat()), normals: normalsOf(flat, ids), indices: Uint32Array.from(ids),
      texture, dims: { w: b.rad * 2, d: b.rad * 2, h: b.len }, roughness: rough, name, doubleSided,
    };
  };
  const t = { data: tex.data, width: tex.width, height: tex.height };
  return [pack(local, uv, idx, t, 0.3, "morango"), pack(lv, luv, lidx, t, 0.6, "folhas_morango", true)];
}
