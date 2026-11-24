// Monta o prato em 3D a partir das medidas reais e "pinta" as fotos nele (texturização projetiva).
// Cada ponto da superfície é projetado de volta em cada foto (com a pose da câmera calculada pelo marcador);
// a cor vem das fotos que enxergam aquele ponto de frente, misturadas suavemente. Nada sai do aparelho.
import type { Camera, Vec3 } from "./geometry";
import { cameraCenter, depthOf, project } from "./geometry";
import { sample } from "./photo";

export type Shot = { data: ImageData; cam: Camera };

export type DishShape = {
  cx: number; // centro do prato na mesa (cm)
  cy: number;
  a: number; // meia-largura do contorno marcado (cm)
  b: number; // meia-profundidade (cm)
  rot: number; // rotação do contorno (rad)
  rect: boolean; // retangular (travessa, lasanha) ou redondo
  height: number; // altura total, da mesa ao topo da comida (cm)
  plate: boolean; // comida servida em prato raso
  foodScale: number; // tamanho da comida em relação ao contorno (quando há prato), 0.4–1
  topRound: boolean; // topo arredondado (hambúrguer, sobremesa) ou reto (pizza, bolo, lasanha)
};

export const PLATE_H = 1.8; // altura típica de um prato raso (cm)

type Surface = {
  name: string;
  point: (theta: number, t: number) => Vec3; // mundo (cm)
  segU: number;
  segV: number;
  texW: number;
  texH: number;
  rough: number;
};

function footprint(shape: DishShape, scaleA: number, scaleB: number, theta: number, s: number): [number, number] {
  const n = shape.rect ? 7 : 2;
  const c = Math.cos(theta), si = Math.sin(theta);
  const x = shape.a * scaleA * s * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  const y = shape.b * scaleB * s * Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
  const cr = Math.cos(shape.rot), sr = Math.sin(shape.rot);
  return [shape.cx + x * cr - y * sr, shape.cy + x * sr + y * cr];
}

/** Perfil (s = fração do raio, z em cm) reparametrizado por comprimento de arco, para a textura não esticar nas paredes. */
function arcProfile(pts: [number, number][], radius: number) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) {
    const dr = (pts[i][0] - pts[i - 1][0]) * radius, dz = pts[i][1] - pts[i - 1][1];
    len.push(len[i - 1] + Math.hypot(dr, dz));
  }
  const total = len[len.length - 1] || 1;
  return (t: number): [number, number] => {
    const L = Math.min(1, Math.max(0, t)) * total;
    let i = 1;
    while (i < len.length - 1 && len[i] < L) i++;
    const k = (L - len[i - 1]) / (len[i] - len[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
}

function foodSurface(shape: DishShape): Surface {
  const z0 = shape.plate ? PLATE_H * 0.35 : 0;
  const H = Math.max(z0 + 0.3, shape.height);
  const q = shape.topRound ? 2.2 : 7;
  const sc = shape.plate ? shape.foodScale : 1;
  const pts: [number, number][] = [];
  for (let k = 0; k <= 600; k++) {
    const u = k / 600;
    // amostragem densa perto da borda, onde o perfil cai
    const ss = 1 - Math.pow(1 - u, 1.6);
    pts.push([ss, z0 + (H - z0) * Math.pow(Math.max(0, 1 - Math.pow(ss, q)), 1 / q)]);
  }
  const prof = arcProfile(pts, ((shape.a + shape.b) / 2) * sc);
  return {
    name: "comida",
    point: (theta, t) => {
      const [s, z] = prof(t);
      const [x, y] = footprint(shape, sc, sc, theta, s);
      return [x, y, z];
    },
    segU: 160,
    segV: 64,
    texW: 2048,
    texH: 1024,
    rough: 0.75,
  };
}

function plateSurface(shape: DishShape): Surface {
  // perfil de um prato raso (s, z/altura): centro → aba → borda → lateral → base
  const P: [number, number][] = [
    [0, 0.35], [0.6, 0.35], [0.7, 0.45], [0.8, 0.7], [0.9, 0.92], [0.97, 1.0], [1.0, 0.96], [0.995, 0.75], [0.96, 0.45], [0.86, 0.12], [0.84, 0.0], [0.4, 0.0], [0, 0.0],
  ];
  const pts = P.map(([s, z]) => [s, z * PLATE_H] as [number, number]);
  const prof = arcProfile(pts, (shape.a + shape.b) / 2);
  return {
    name: "prato",
    point: (theta, t) => {
      const [s, z] = prof(t);
      const [x, y] = footprint(shape, 1, 1, theta, s);
      return [x, y, z];
    },
    segU: 160,
    segV: 40,
    texW: 2048,
    texH: 512,
    rough: 0.35,
  };
}

/** Dentro do volume da comida? (para saber se a comida esconde um ponto do prato numa foto) */
function insideFood(shape: DishShape, p: Vec3) {
  if (!shape.plate) return false;
  const sc = shape.foodScale;
  const dx = p[0] - shape.cx, dy = p[1] - shape.cy;
  const cr = Math.cos(-shape.rot), sr = Math.sin(-shape.rot);
  const lx = (dx * cr - dy * sr) / (shape.a * sc), ly = (dx * sr + dy * cr) / (shape.b * sc);
  const n = shape.rect ? 7 : 2;
  const s = Math.pow(Math.pow(Math.abs(lx), n) + Math.pow(Math.abs(ly), n), 1 / n);
  if (s >= 1) return false;
  const z0 = PLATE_H * 0.35, H = shape.height, q = shape.topRound ? 2.2 : 7;
  const zTop = z0 + (H - z0) * Math.pow(1 - Math.pow(s, q), 1 / q);
  return p[2] > z0 && p[2] < zTop;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossV = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

function normalAt(surf: Surface, theta: number, t: number): Vec3 {
  const e = 1e-3;
  const p = surf.point(theta, t);
  const pu = sub(surf.point(theta + e, t), p);
  let pv = sub(surf.point(theta, Math.min(1, t + e)), p);
  if (len(pv) < 1e-9) pv = sub(p, surf.point(theta, Math.max(0, t - e)));
  let n = crossV(pv, pu);
  const l = len(n);
  if (l < 1e-12) return [0, 0, 1];
  n = [n[0] / l, n[1] / l, n[2] / l];
  return n;
}

/** Gera a textura de uma superfície projetando as fotos. */
async function bake(surf: Surface, shape: DishShape, shots: Shot[], onProgress?: (p: number) => void) {
  const W = surf.texW, H = surf.texH;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  const out = g.createImageData(W, H);
  const centers = shots.map((s) => cameraCenter(s.cam));
  // azimute de cada câmera em volta do prato, das fotos mais "de lado" para as mais "de cima"
  const shotAz = centers
    .map((c) => ({ az: Math.atan2(c[1] - shape.cy, c[0] - shape.cx), elev: Math.atan2(c[2], Math.hypot(c[0] - shape.cx, c[1] - shape.cy)) }))
    .sort((a, b) => a.elev - b.elev)
    .map((x) => x.az);
  const missing: number[] = [];
  let sumC = [0, 0, 0], nC = 0;
  const rowSum = new Float64Array(H * 3), rowN = new Uint32Array(H);

  const colorAt = (theta: number, t: number, strict: boolean): [number, number, number] | null => {
    const P = surf.point(theta, t);
    const N = normalAt(surf, theta, t);
    let acc = [0, 0, 0], wsum = 0;
    for (let k = 0; k < shots.length; k++) {
      const s = shots[k];
      const d = depthOf(s.cam, P);
      if (d <= 1) continue;
      const C = centers[k];
      const v = sub(C, P);
      const vl = len(v);
      const facing = (N[0] * v[0] + N[1] * v[1] + N[2] * v[2]) / vl;
      if (facing <= (strict ? 0.22 : 0.0)) continue; // evita usar a foto onde a superfície aparece "de raspão"
      // a comida esconde este ponto do prato nesta foto?
      if (surf.name === "prato" && shape.plate) {
        let hidden = false;
        for (let i = 1; i <= 14 && !hidden; i++) {
          const k2 = (i / 14) * Math.min(1, 45 / vl);
          hidden = insideFood(shape, [P[0] + v[0] * k2, P[1] + v[1] * k2, P[2] + v[2] * k2]);
        }
        if (hidden) continue;
      }
      const [px, py] = project(s.cam, P);
      const c = sample(s.data, px, py);
      if (!c) continue;
      // peso: quanto mais de frente e mais perto (mais resolução), maior
      const w = Math.pow(facing, 3) * Math.pow(s.cam.f / d, 2);
      acc[0] += c[0] * w; acc[1] += c[1] * w; acc[2] += c[2] * w;
      wsum += w;
    }
    if (wsum <= 0) return null;
    return [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum];
  };

  for (let j = 0; j < H; j++) {
    const t = 1 - (j + 0.5) / H; // linha 0 do canvas = v 1 (flipY)
    for (let i = 0; i < W; i++) {
      const theta = ((i + 0.5) / W) * Math.PI * 2;
      const c = colorAt(theta, t, true);
      const o = (j * W + i) * 4;
      if (c) {
        out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
        sumC[0] += c[0]; sumC[1] += c[1]; sumC[2] += c[2]; nC++;
        rowSum[j * 3] += c[0]; rowSum[j * 3 + 1] += c[1]; rowSum[j * 3 + 2] += c[2]; rowN[j]++;
      } else missing.push(o, i, j);
    }
    if (j % 32 === 0) {
      onProgress?.(j / H);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // partes que nenhuma foto viu (ex.: o lado de trás): espelha o lado visto pela foto mais próxima
  const avg: [number, number, number] = nC ? [sumC[0] / nC, sumC[1] / nC, sumC[2] / nC] : [200, 160, 120];
  for (let m = 0; m < missing.length; m += 3) {
    const o = missing[m], i = missing[m + 1], j = missing[m + 2];
    const t = 1 - (j + 0.5) / H;
    const theta = ((i + 0.5) / W) * Math.PI * 2;
    let best: [number, number, number] | null = null;
    for (const az of shotAz) {
      // espelha em relação à direção da câmera: o lado de trás recebe a textura do lado da frente
      const m = 2 * az + Math.PI - theta; // reflexo frente↔trás em relação à câmera
      best = colorAt(m, t, true);
      if (best) break;
    }
    // sem nada visto: cor média daquela "faixa" do prato
    const c = best || (rowN[j] ? ([rowSum[j * 3] / rowN[j], rowSum[j * 3 + 1] / rowN[j], rowSum[j * 3 + 2] / rowN[j]] as [number, number, number]) : avg);
    out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return canvas;
}

export type BuildResult = { glb: Blob; dims: { w: number; d: number; h: number } };

/** Constrói o GLB do prato (metros, Y para cima, centralizado, base na mesa). */
export async function buildDish(shape: DishShape, shots: Shot[], onProgress?: (msg: string, p: number) => void): Promise<BuildResult> {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const surfaces = [...(shape.plate ? [plateSurface(shape)] : []), foodSurface(shape)];
  const group = new THREE.Group();
  group.name = "prato_visatto";
  for (let si = 0; si < surfaces.length; si++) {
    const surf = surfaces[si];
    const tex = await bake(surf, shape, shots, (p) => onProgress?.(`Pintando ${surf.name} com as fotos`, (si + p) / surfaces.length));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= surf.segV; j++) {
      const t = j / surf.segV;
      for (let i = 0; i <= surf.segU; i++) {
        const theta = (i / surf.segU) * Math.PI * 2;
        const [x, y, z] = surf.point(theta, t);
        pos.push((x - shape.cx) / 100, z / 100, -(y - shape.cy) / 100);
        uv.push(i / surf.segU, t);
      }
    }
    const row = surf.segU + 1;
    for (let j = 0; j < surf.segV; j++)
      for (let i = 0; i < surf.segU; i++) {
        const a = j * row + i, b = a + row;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // garante normais para fora (para cima no topo)
    const nrm = geo.getAttribute("normal");
    let up = 0;
    for (let k = 0; k < nrm.count; k++) up += nrm.getY(k);
    if (up < 0) {
      for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    const map = new THREE.CanvasTexture(tex);
    map.colorSpace = THREE.SRGBColorSpace;
    map.userData.mimeType = "image/jpeg";
    const mat = new THREE.MeshStandardMaterial({ map, roughness: surf.rough, metalness: 0, side: THREE.DoubleSide });
    mat.name = surf.name;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = surf.name;
    group.add(mesh);
  }
  onProgress?.("Gerando arquivo 3D", 1);
  const scene = new THREE.Scene();
  scene.add(group);
  const ab = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  const dims = {
    w: Math.round(shape.a * 2 * 10) / 10,
    d: Math.round(shape.b * 2 * 10) / 10,
    h: Math.round(Math.max(shape.height, shape.plate ? PLATE_H : 0) * 10) / 10,
  };
  return { glb: new Blob([ab], { type: "model/gltf-binary" }), dims };
}
