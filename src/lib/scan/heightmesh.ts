// Transforma o mapa de altura (recon.ts) num modelo 3D texturizado, em escala real.
//
// A superfície é descrita em "raios" saindo do centro do prato: para cada ângulo, um perfil que sobe pela
// comida e desce pela borda até a mesa. A textura usa (ângulo, comprimento ao longo do perfil), então as
// laterais recebem tanta resolução quanto o topo. Cada ponto da textura é pintado com os quadros do vídeo
// que realmente o enxergam (de frente e sem a própria comida na frente).
import type { Camera, Vec3 } from "./geometry";
import { cameraCenter } from "./geometry";
import type { Dish, HeightField, RGBA, View } from "./recon";

export type HeightMesh = {
  positions: Float32Array; // metros, Y para cima, origem no centro da base
  uvs: Float32Array;
  /** normais suaves por vértice (opcional; sem elas, são calculadas pela geometria) */
  normals?: Float32Array;
  indices: Uint32Array;
  texture: RGBA;
  /** acabamento do material: 1 = fosco, 0 = espelhado */
  roughness?: number;
  name?: string;
  /** textura de cores chapadas (paleta): grava sem perdas e sem suavizar entre uma cor e outra */
  png?: boolean;
  /** desenha os dois lados das faces (folhinhas finas) */
  doubleSided?: boolean;
  dims: { w: number; d: number; h: number };
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Altura suavizada, só dentro do prato (fora = mesa = 0). */
function smoothMasked(hf: HeightField, mask: Uint8Array) {
  const { nx, ny } = hf;
  let a = new Float32Array(nx * ny);
  for (let q = 0; q < a.length; q++) a[q] = mask[q] ? hf.h[q] : 0;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let s = 0, w = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
            const k = (di ? 1 : 2) * (dj ? 1 : 2);
            s += a[jj * nx + ii] * k;
            w += k;
          }
        b[j * nx + i] = s / w;
      }
    a = b;
  }
  return a;
}

export async function buildHeightMesh(
  hf: HeightField,
  dish: Dish,
  views: View[],
  onProgress?: (p: number) => void,
  opts: { segU?: number; segV?: number; texW?: number; texH?: number; round?: boolean } = {},
): Promise<HeightMesh> {
  const segU = opts.segU ?? 160, segV = opts.segV ?? 72, W = opts.texW ?? 1024, H = opts.texH ?? 512;
  const { x0, y0, cell, nx, ny } = hf;
  const hs = smoothMasked(hf, dish.mask);
  const [cx, cy] = dish.centroid;
  const hAt = (X: number, Y: number) => {
    const fx = (X - x0) / cell - 0.5, fy = (Y - y0) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const g = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= nx || jj >= ny ? 0 : hs[jj * nx + ii]);
    return g(i, j) * (1 - u) * (1 - v) + g(i + 1, j) * u * (1 - v) + g(i, j + 1) * (1 - u) * v + g(i + 1, j + 1) * u * v;
  };
  const inMask = (X: number, Y: number) => {
    const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell);
    return i >= 0 && j >= 0 && i < nx && j < ny && dish.mask[j * nx + i] === 1;
  };
  let hMax = 0;
  for (let q = 0; q < hs.length; q++) hMax = Math.max(hMax, hs[q]);

  // contorno: raio até a borda do prato em cada ângulo, suavizado (bordas sem "dentes")
  const NA = 360, rEdge = new Float32Array(NA);
  for (let a = 0; a < NA; a++) {
    const th = (a / NA) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
    let rMax = cell;
    for (let r = 0; r < 60; r += cell / 2) if (inMask(cx + ct * r, cy + st * r)) rMax = r;
    rEdge[a] = rMax + cell / 2;
  }
  const rSmooth = new Float32Array(NA);
  for (let a = 0; a < NA; a++) {
    const win: number[] = [];
    for (let d = -6; d <= 6; d++) win.push(rEdge[(a + d + NA) % NA]);
    win.sort((x, y) => x - y);
    rSmooth[a] = win[6];
  }
  if (opts.round) {
    // item redondo: contorno puxado para um círculo (mantém um pouco do contorno medido)
    const sorted = Array.from(rSmooth).sort((x, y) => x - y), rm = sorted[NA >> 1];
    for (let a = 0; a < NA; a++) rSmooth[a] = 0.8 * rm + 0.2 * rSmooth[a];
  }
  const rAt = (theta: number) => {
    const f = (((theta / (Math.PI * 2)) * NA) % NA + NA) % NA, i = Math.floor(f), k = f - i;
    return rSmooth[i] * (1 - k) + rSmooth[(i + 1) % NA] * k;
  };

  // perfil radial de um ângulo: sobe pela comida e desce pela borda até a mesa, reamostrado por comprimento
  const R = 96;
  const profileCache = new Map<number, { r: Float32Array; z: Float32Array; L: Float32Array; rTex: number; zTex: number }>();
  const profile = (theta: number) => {
    const key = Math.round(theta * 1e5);
    const hit = profileCache.get(key);
    if (hit) return hit;
    const ct = Math.cos(theta), st = Math.sin(theta), rMax = rAt(theta);
    const r = new Float32Array(R + 1), z = new Float32Array(R + 1), L = new Float32Array(R + 1);
    let rTex = 0, zTex = 0;
    for (let i = 0; i <= R; i++) {
      r[i] = i === R ? rMax : (rMax * i) / (R - 1); // os 2 últimos pontos: a borda desce reto até a mesa
      if (i === R - 1) r[i] = rMax;
      z[i] = i === R ? 0 : hAt(cx + ct * Math.min(r[i], rMax - cell / 2), cy + st * Math.min(r[i], rMax - cell / 2));
      if (z[i] >= 0.6 && i < R) { rTex = r[i]; zTex = z[i]; }
      if (i) L[i] = L[i - 1] + Math.hypot(r[i] - r[i - 1], z[i] - z[i - 1]);
    }
    const p = { r, z, L, rTex, zTex };
    profileCache.set(key, p);
    return p;
  };
  const point = (theta: number, t: number): Vec3 => {
    const p = profile(theta), total = p.L[R] || 1, target = Math.min(1, Math.max(0, t)) * total;
    let i = 1;
    while (i < R && p.L[i] < target) i++;
    const k = (target - p.L[i - 1]) / (p.L[i] - p.L[i - 1] || 1);
    const rr = p.r[i - 1] + (p.r[i] - p.r[i - 1]) * k, zz = p.z[i - 1] + (p.z[i] - p.z[i - 1]) * k;
    return [cx + Math.cos(theta) * rr, cy + Math.sin(theta) * rr, zz];
  };

  // ---- malha
  const positions = new Float32Array((segU + 1) * (segV + 1) * 3), uvs = new Float32Array((segU + 1) * (segV + 1) * 2);
  for (let j = 0; j <= segV; j++)
    for (let i = 0; i <= segU; i++) {
      const theta = (i / segU) * Math.PI * 2, t = j / segV;
      const [x, y, z] = point(theta, t), o = j * (segU + 1) + i;
      positions[o * 3] = (x - cx) / 100;
      positions[o * 3 + 1] = z / 100;
      positions[o * 3 + 2] = -(y - cy) / 100;
      uvs[o * 2] = i / segU;
      uvs[o * 2 + 1] = t;
    }
  const indices = new Uint32Array(segU * segV * 6);
  let n = 0;
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + segU + 1;
      // ordem anti-horária vista de cima (normal para fora)
      indices[n++] = a; indices[n++] = b; indices[n++] = a + 1;
      indices[n++] = a + 1; indices[n++] = b; indices[n++] = b + 1;
    }

  // ---- textura
  const centers = views.map((v) => cameraCenter(v.cam));
  const gains = hf.gains ?? views.map(() => [1, 1, 1]);
  const occluded = (P: Vec3, C: Vec3) => {
    const dx = C[0] - P[0], dy = C[1] - P[1], dz = C[2] - P[2], hl = Math.hypot(dx, dy);
    if (hl < 1e-6) return false;
    const sx = (dx / hl) * cell, sy = (dy / hl) * cell, sz = (dz / hl) * cell;
    let x = P[0] + sx * 1.5, y = P[1] + sy * 1.5, z = P[2] + 0.35 + sz * 1.5;
    while (z < hMax) {
      if (hAt(x, y) > z) return true;
      x += sx; y += sy; z += sz;
    }
    return false;
  };
  const normalAt = (X: number, Y: number): Vec3 => {
    const e = cell;
    const gx = (hAt(X + e, Y) - hAt(X - e, Y)) / (2 * e), gy = (hAt(X, Y + e) - hAt(X, Y - e)) / (2 * e);
    const l = Math.hypot(gx, gy, 1);
    return [-gx / l, -gy / l, 1 / l];
  };
  const sampleImg = (img: RGBA, x: number, y: number, out: number[]) => {
    if (x < 1 || y < 1 || x > img.width - 2 || y > img.height - 2) return false;
    const x0_ = x | 0, y0_ = y | 0, fx = x - x0_, fy = y - y0_, w = img.width, d = img.data;
    const i00 = (y0_ * w + x0_) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
    const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, e = fx * fy;
    for (let ch = 0; ch < 3; ch++) out[ch] = d[i00 + ch] * a + d[i10 + ch] * b + d[i01 + ch] * c + d[i11 + ch] * e;
    return true;
  };
  const proj = (cam: Camera, P: Vec3): [number, number, number] => {
    const R_ = cam.R, t = cam.t;
    const zc = R_[6] * P[0] + R_[7] * P[1] + R_[8] * P[2] + t[2];
    return [(cam.f * (R_[0] * P[0] + R_[1] * P[1] + R_[2] * P[2] + t[0])) / zc + cam.cx, (cam.f * (R_[3] * P[0] + R_[4] * P[1] + R_[5] * P[2] + t[1])) / zc + cam.cy, zc];
  };

  const tex = new Uint8ClampedArray(W * H * 4);
  const have = new Uint8Array(W * H);
  const c3 = [0, 0, 0];
  for (let i = 0; i < W; i++) {
    const theta = ((i + 0.5) / W) * Math.PI * 2;
    for (let j = 0; j < H; j++) {
      const t = 1 - (j + 0.5) / H; // linha 0 da imagem = v 1 (a textura do glTF é lida de cima para baixo)
      let P = point(theta, t);
      if (P[2] < 0.6) {
        // pé da borda (encostado na mesa): usa a cor de um pouco acima, senão pega a cor da mesa
        const pr = profile(theta), rr = Math.hypot(P[0] - cx, P[1] - cy);
        if (rr > pr.rTex && pr.rTex > 0) P = [cx + Math.cos(theta) * pr.rTex, cy + Math.sin(theta) * pr.rTex, pr.zTex];
      }
      const N = normalAt(P[0], P[1]);
      let r = 0, g = 0, b = 0, ws = 0;
      for (let v = 0; v < views.length; v++) {
        const C = centers[v];
        const vx = C[0] - P[0], vy = C[1] - P[1], vz = C[2] - P[2], vl = Math.hypot(vx, vy, vz);
        const facing = (N[0] * vx + N[1] * vy + N[2] * vz) / vl;
        if (facing <= 0.2) continue;
        const [u, w, zc] = proj(views[v].cam, P);
        if (zc <= 1 || !sampleImg(views[v].img, u, w, c3)) continue;
        if (occluded(P, C)) continue;
        const wt = facing * facing * facing * (views[v].cam.f / zc) ** 2;
        const gn = gains[v];
        r += c3[0] * gn[0] * wt; g += c3[1] * gn[1] * wt; b += c3[2] * gn[2] * wt; ws += wt;
      }
      if (ws > 0) {
        const o = (j * W + i) * 4;
        tex[o] = r / ws; tex[o + 1] = g / ws; tex[o + 2] = b / ws; tex[o + 3] = 255;
        have[j * W + i] = 1;
      }
    }
    if (i % 24 === 0) {
      onProgress?.(i / W);
      await tick();
    }
  }
  // pontos que nenhum quadro viu (ex.: um lado que não foi filmado): copia do vizinho mais próximo na mesma altura
  for (let j = 0; j < H; j++) {
    let any = -1;
    for (let i = 0; i < W; i++) if (have[j * W + i]) { any = i; break; }
    if (any < 0) continue;
    for (let dir = 0; dir < 2; dir++) {
      let last = -1;
      for (let s = 0; s < 2 * W; s++) {
        const i = dir === 0 ? (any + s) % W : (any - s + 2 * W) % W;
        const q = j * W + i;
        if (have[q] === 1) last = q;
        else if (last >= 0 && have[q] === 0) {
          tex.copyWithin(q * 4, last * 4, last * 4 + 4);
          have[q] = 2;
        }
      }
    }
  }
  for (let q = 0; q < W * H; q++) if (!have[q]) { tex[q * 4] = 200; tex[q * 4 + 1] = 170; tex[q * 4 + 2] = 130; tex[q * 4 + 3] = 255; }
  // linhas inteiras sem dado: copia da linha vizinha
  for (let j = 0; j < H; j++)
    if (!have[j * W]) {
      for (let d = 1; d < H; d++) {
        const jj = j + d < H && have[(j + d) * W] ? j + d : j - d >= 0 && have[(j - d) * W] ? j - d : -1;
        if (jj >= 0) { tex.copyWithin(j * W * 4, jj * W * 4, (jj + 1) * W * 4); break; }
      }
    }
  onProgress?.(1);
  return { positions, uvs, indices, texture: { data: tex, width: W, height: H }, dims: dish.dims };
}

/** Exporta para GLB (no navegador). Aceita várias partes (ex.: a comida e a louça), cada uma com seu material. */
export async function heightMeshToGlb(input: HeightMesh | HeightMesh[]): Promise<Blob> {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const scene = new THREE.Scene();
  for (const m of Array.isArray(input) ? input : [input]) {
    if (!m.indices.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(m.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    if (m.normals) geo.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
    else geo.computeVertexNormals();
    const canvas = document.createElement("canvas");
    canvas.width = m.texture.width;
    canvas.height = m.texture.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const id = ctx.createImageData(m.texture.width, m.texture.height);
    id.data.set(m.texture.data);
    ctx.putImageData(id, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.userData.mimeType = m.png ? "image/png" : "image/jpeg";
    if (m.png) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; }
    const mat = new THREE.MeshStandardMaterial({ map, roughness: m.roughness ?? 0.62, metalness: 0, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
    mat.name = m.name ?? "prato";
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${m.name ?? "prato"}_visatto`;
    scene.add(mesh);
  }
  // texturas convertidas com o canvas no processador (ver withCpuCanvas em client.ts)
  const { withCpuCanvas } = await import("../cpu-canvas");
  const ab = (await withCpuCanvas(() => new GLTFExporter().parseAsync(scene, { binary: true }))) as ArrayBuffer;
  return new Blob([ab], { type: "model/gltf-binary" });
}
