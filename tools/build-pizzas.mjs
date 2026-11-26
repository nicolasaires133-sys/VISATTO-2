// Pizzas em 3D dos sabores mais pedidos no Brasil, feitas por código (mesma técnica das outras comidas).
// Uso: node tools/build-pizzas.mjs [sabores...]
//   → tools/out/pizza-<sabor>.glb        (na tábua, para o cardápio de demonstração)
//   → tools/out/pizza-caixa-<sabor>.glb  (na caixa, modelo pronto: o painel ajusta para a caixa do restaurante)
import { Document, perlin, fbm, mix, hex, img, normalMap, material, prim, grid, lathe, ellipsoid, save, leafGeo } from "./food3d.mjs";

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- sorteio repetível ----------
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
/** pontos espalhados dentro de um anel, sem encostar uns nos outros */
export function scatter(R, n, rMin, rMax, gap, seed, avoid = []) {
  const r = rng(seed), out = [];
  for (let tries = 0; out.length < n && tries < n * 400; tries++) {
    const a = r() * TAU, d = Math.sqrt(rMin * rMin + r() * (rMax * rMax - rMin * rMin));
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if ([...out, ...avoid].every((p) => Math.hypot(p[0] - x, p[1] - z) > gap)) out.push([x, z, r()]);
  }
  return out;
}

// ---------- formas ----------
export function planarUV(g, W, cx = 0, cz = 0) { for (let i = 0; i < g.uv.length; i += 2) { const p = (i / 2) * 3; g.uv[i] = 0.5 + (g.pos[p] - cx) / W; g.uv[i + 1] = 0.5 + (g.pos[p + 2] - cz) / W; } return g; }
export function translate(g, dx, dy, dz) { for (let i = 0; i < g.pos.length; i += 3) { g.pos[i] += dx; g.pos[i + 1] += dy; g.pos[i + 2] += dz; } return g; }
export function rotY(g, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], z = g.pos[i + 2]; g.pos[i] = x * c - z * s; g.pos[i + 2] = x * s + z * c; const nx = g.nor[i], nz = g.nor[i + 2]; g.nor[i] = nx * c - nz * s; g.nor[i + 2] = nx * s + nz * c; } return g; }
/** disco (ou elipse) com relevo; uv pela posição, para a textura cair certa */
export function disc(cx, cy, cz, rx, hFn = () => 0, seg = 40, rings = 6, rz = rx, rot = 0) {
  const g = grid(seg, rings, (u, v) => { const a = u * TAU, k = 1 - v; const x = Math.cos(a) * rx * k, z = Math.sin(a) * rz * k; return [x, hFn(x, z, v, a), z]; }, { wrap: true });
  planarUV(g, 2 * Math.max(rx, rz)); rotY(g, rot); return translate(g, cx, cy, cz);
}
/** paralelepípedo (bacon, presunto) com uv 0..1 em cada face */
export function cuboid(sx, sy, sz) {
  const x = sx / 2, z = sz / 2, P = [[-x, 0, -z], [x, 0, -z], [x, sy, -z], [-x, sy, -z], [-x, 0, z], [x, 0, z], [x, sy, z], [-x, sy, z]];
  const F = [[0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 4, 7, 3, [-1, 0, 0]], [1, 2, 6, 5, [1, 0, 0]], [3, 7, 6, 2, [0, 1, 0]], [0, 1, 5, 4, [0, -1, 0]]];
  const g = { pos: [], nor: [], uv: [], idx: [] };
  for (const [a, b, c, d, n] of F) { const o = g.pos.length / 3; for (const k of [a, b, c, d]) { g.pos.push(...P[k]); g.nor.push(...n); } g.uv.push(0, 0, 1, 0, 1, 1, 0, 1); g.idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  return g;
}
/** tubo que segue um caminho (fio de cheddar) */
export function tube(path, rad, seg = 8) {
  const n = path.length - 1;
  return grid(n, seg, (u, v) => {
    const i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i, p = path[i], q = path[i + 1];
    const x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f, z = p[2] + (q[2] - p[2]) * f;
    let tx = q[0] - p[0], tz = q[2] - p[2]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const a = v * TAU, w = rad * (1 - 0.25 * Math.sin(u * 40) ** 2) * (u < 0.02 || u > 0.98 ? 0.4 : 1);
    return [x - tz * Math.cos(a) * w, y + Math.max(-0.35, Math.sin(a)) * w * 0.7, z + tx * Math.cos(a) * w];
  }, { flip: true });
}
/** fio de frango desfiado: tirinha curva, mais fina nas pontas */
export function shred(cx, cy, cz, len, wid, hgt, rot, bend) {
  const g = grid(7, 5, (u, v) => {
    const t = u - 0.5, a = v * TAU, taper = Math.sin(Math.PI * (0.08 + u * 0.84)) ** 0.6;
    const px = t * len, pz = bend * (t * t - 0.08) * len;
    return [px, Math.max(-0.4, Math.sin(a)) * hgt * taper, pz + Math.cos(a) * wid * taper * 0.5];
  }, { wrap: true, flip: true });
  for (let i = 0; i < g.uv.length; i += 2) { const k = i / 2; g.uv[i] = (k % 8) / 7; g.uv[i + 1] = Math.floor(k / 8) / 5; }
  rotY(g, rot); return translate(g, cx, cy, cz);
}
/** pedaço irregular (bacon crocante): bolinha amassada com relevo */
export function chunk(cx, cy, cz, sx, sy, sz, rot, seed) {
  const k = seed * 13.7;
  const g = grid(14, 8, (u, v) => {
    const a = u * TAU, b = v * Math.PI, n = 1 + 0.35 * fbm(Math.cos(a) * 2 + k, Math.sin(a) * 2 + Math.cos(b) * 2, 3);
    const sq = (x) => Math.sign(x) * Math.abs(x) ** 0.6; // mais quadrado
    return [sq(Math.cos(a) * Math.sin(b)) * sx * n, -Math.cos(b) * sy * (0.8 + 0.4 * n), sq(Math.sin(a) * Math.sin(b)) * sz * n];
  }, { wrap: true, flip: true });
  rotY(g, rot); return translate(g, cx, cy, cz);
}
export function smoothNormalsLocal(g) {
  const n = new Float32Array(g.pos.length);
  for (let i = 0; i < g.idx.length; i += 3) { const [a, b, c] = [g.idx[i], g.idx[i + 1], g.idx[i + 2]]; const e1 = [0, 1, 2].map((k) => g.pos[b * 3 + k] - g.pos[a * 3 + k]), e2 = [0, 1, 2].map((k) => g.pos[c * 3 + k] - g.pos[a * 3 + k]); const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v * 3 + k] += f[k]; }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; g.nor[i] = n[i] / l; g.nor[i + 1] = n[i + 1] / l; g.nor[i + 2] = n[i + 2] / l; }
}
export function dollop(r, h, seed) {
  const k = rng(seed)();
  const g = lathe([[r, 0], [r * 0.97, h * 0.22], [r * 0.86, h * 0.45], [r * 0.66, h * 0.68], [r * 0.42, h * 0.86], [r * 0.16, h * 0.97], [0.0002, h]], 30);
  // creme com ondas (como saiu do saco de confeitar)
  for (let i = 0; i < g.pos.length; i += 3) { const a = Math.atan2(g.pos[i + 2], g.pos[i]), y = g.pos[i + 1] / h; const sw = 1 + 0.1 * Math.sin(a * 3 + k * 6 + y * 9) + 0.05 * Math.sin(a * 7) ; g.pos[i] *= sw; g.pos[i + 2] *= sw; g.pos[i + 1] *= 1 + 0.06 * Math.sin(a * 4 + k * 3); }
  smoothNormalsLocal(g);
  return g;
}
/** cor da tela (#rrggbb) para o valor linear que o glTF espera */
export const lin = (h) => [...hex(h).map((c) => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)), 1];
export function start(name) { const doc = new Document(); return { doc, buf: doc.createBuffer(), mesh: doc.createMesh(name) }; }
export function scene(doc, mesh, name) { doc.createScene("Scene").addChild(doc.createNode(name).setMesh(mesh)); }

// ---------- texturas ----------
export async function woodTex() {
  return img(1024, 1024, (u, v) => {
    const ring = Math.sin((v * 46 + fbm(u * 3, v * 9, 4) * 6) * Math.PI) * 0.5 + 0.5;
    const base = mix(hex("#c8945c"), hex("#9a6738"), ring * 0.55 + fbm(u * 20, v * 2, 3) * 0.8);
    return mix(base, hex("#e2b884"), perlin(u * 400, v * 30) > 0.5 ? 0.12 : 0);
  });
}
const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

/** granulado (para a de brigadeiro): bastõezinhos espalhados por células */
export function sprinkle(x, y, cell, seed) {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const h = Math.sin((cx + i) * 127.1 + (cy + j) * 311.7 + seed) * 43758.5453, r1 = h - Math.floor(h);
    const h2 = Math.sin((cx + i) * 269.5 + (cy + j) * 183.3 + seed) * 23421.631, r2 = h2 - Math.floor(h2);
    if (r1 < 0.12) continue;
    const px = (cx + i + r1) * cell, py = (cy + j + r2) * cell, a = r1 * 40, L = cell * 0.45;
    const dx = x - px, dy = y - py, t = Math.max(-L, Math.min(L, dx * Math.cos(a) + dy * Math.sin(a)));
    const d = Math.hypot(dx - Math.cos(a) * t, dy - Math.sin(a) * t);
    if (d < cell * 0.12) return r2 > 0.82 ? 2 : 1; // 1 = escuro, 2 = mais claro
  }
  return 0;
}

// ---------- sabores ----------
// cada sabor: como fica a cobertura (textura) e o que vai por cima (formas)
export const FLAVORS = {
  mussarela: { label: "Mussarela", cheese: 1, sauce: 0.15, oregano: 1.4 },
  calabresa: { label: "Calabresa", cheese: 1, sauce: 0.35, oregano: 1 },
  margherita: { label: "Margherita", cheese: 0, sauce: 1, oregano: 0.2 },
  "frango-catupiry": { label: "Frango com Catupiry", cheese: 1, sauce: 0.1, oregano: 1, chicken: 1 },
  "frango-bacon": { label: "Frango com Bacon", cheese: 1, sauce: 0.15, oregano: 0.8, chicken: 1 },
  "bacon-cheddar": { label: "Bacon com Cheddar", cheese: 1, sauce: 0.1, oregano: 0.4, cheddar: 1 },
  portuguesa: { label: "Portuguesa", cheese: 1, sauce: 0.25, oregano: 1.2 },
  "quatro-queijos": { label: "Quatro Queijos", cheese: 1, sauce: 0.05, oregano: 0.6, four: 1 },
  pepperoni: { label: "Pepperoni", cheese: 1, sauce: 0.3, oregano: 0.5 },
  brigadeiro: { label: "Brigadeiro", choc: 1 },
};

async function topTexture(name, f, inner) {
  const S = 2048, M = (u) => (u - 0.5) * 2 * inner; // pixel -> metros
  // queijos em manchas (margherita: muçarela de búfala; quatro queijos)
  const blobs = name === "margherita" ? scatter(inner, 13, 0, inner * 0.86, 0.05, 7).map(([x, z, k]) => [x, z, 0.022 + k * 0.01]) : [];
  return img(S, S, (u, v) => {
    const x = M(u), z = M(v), r = Math.hypot(x, z) / inner;
    if (f.choc) {
      let c = mix(hex("#5a2c17"), hex("#3a190b"), 0.5 + fbm(u * 10, v * 10, 4) * 1.1);
      c = mix(c, hex("#7a4127"), smooth(0.3, 0.6, perlin(u * 22, v * 22)) * 0.35); // brilho do creme
      const s = sprinkle(x, z, 0.0042, 3.1);
      if (s === 1) c = mix(hex("#2a1309"), hex("#1a0b05"), perlin(u * 300, v * 300) + 0.5);
      if (s === 2) c = hex("#6b3a20");
      return c;
    }
    const cheese = fbm(u * 14, v * 14, 5) + perlin(u * 60, v * 60) * 0.3;
    let c = mix(hex("#fbe6a2"), hex("#f2c766"), 0.5 + cheese * 1.2);
    const sauceC = mix(hex("#c2381f"), hex("#8f2210"), 0.5 + fbm(u * 30, v * 30, 3));
    // molho aparecendo (mais perto da borda)
    let sauce = smooth(0.12, 0.35, -fbm(u * 9 + 3, v * 9, 4) + (r - 0.75) * 1.2) * f.sauce * 2;
    if (name === "margherita") {
      sauce = 1; let m = 0;
      for (const [bx, bz, br] of blobs) { const d = Math.hypot(x - bx, z - bz) / (br * (1 + 0.18 * fbm(u * 20 + bx * 50, v * 20, 3))); m = Math.max(m, smooth(1, 0.7, d)); }
      c = mix(sauceC, mix(hex("#fffaf0"), hex("#f4e6c4"), 0.5 + perlin(u * 50, v * 50)), m);
      c = mix(c, hex("#d79a4a"), smooth(0.35, 0.55, perlin(u * 40, v * 40)) * m * 0.45);
      if (perlin(u * 700, v * 700) > 0.66) c = mix(c, hex("#3f5a1f"), 0.7);
      return c;
    }
    c = mix(c, sauceC, clamp01(sauce));
    if (f.four) { // quatro queijos: provolone, gorgonzola e parmesão por cima da muçarela
      const reg = fbm(u * 6 + 11, v * 6, 3);
      if (reg > 0.08) c = mix(c, mix(hex("#f2c45a"), hex("#dfa53c"), 0.5 + perlin(u * 40, v * 40)), smooth(0.08, 0.16, reg) * 0.9);
      if (reg < -0.1) { c = mix(c, hex("#fff8ea"), smooth(-0.1, -0.18, reg)); const vein = Math.abs(fbm(u * 70, v * 70, 3)); if (vein < 0.07) c = mix(c, hex("#4f6d66"), 0.9); else if (perlin(u * 300, v * 300) > 0.45) c = mix(c, hex("#6f8b82"), 0.8); }
      if (perlin(u * 520, v * 520) > 0.5) c = mix(c, hex("#f8efd6"), 0.65);
    }
    if (f.cheddar) { // poças de cheddar derretido
      const pool = fbm(u * 7 + 5, v * 7 + 2, 4);
      c = mix(c, mix(hex("#f39a24"), hex("#d9740e"), 0.5 + perlin(u * 30, v * 30)), smooth(0.02, 0.12, pool) * 0.95);
    }
    if (f.chicken) { // frango desfiado espalhado pelo queijo
      const ch = fbm(u * 18 + 9, v * 18, 3);
      c = mix(c, hex("#e6b764"), smooth(0.05, 0.2, ch) * 0.5);
    }
    // bolhas douradas do forno
    const blister = smooth(0.32, 0.5, perlin(u * 38, v * 38) + fbm(u * 6, v * 6, 2) * 0.4);
    c = mix(c, f.cheddar ? hex("#b9621a") : hex("#c88a36"), blister * 0.65);
    c = mix(c, hex("#7c4a1c"), smooth(0.48, 0.62, perlin(u * 38, v * 38)) * 0.55);
    if (perlin(u * 900, v * 900) > 0.66 - f.oregano * 0.04) c = mix(c, hex("#3f5a1f"), 0.8); // orégano
    return c;
  });
}

async function pizzaParts(doc, buf, mesh, name, R = 0.19, Y = 0.02) {
  const f = FLAVORS[name], crustW = 0.022, inner = R - crustW, top = Y + 0.0068;
  // borda estufada (igual em todas)
  const crustTex = await once("crust", () => img(1024, 256, (u, v) => {
    const burn = Math.max(0, perlin(u * 90, v * 12) + fbm(u * 18, v * 4, 3) * 0.8);
    let c = mix(hex("#e7b871"), hex("#c98a3e"), 0.5 + fbm(u * 30, v * 6, 4) * 1.2);
    c = mix(c, hex("#6b3a17"), smooth(0.35, 0.8, burn) * 0.8);
    if (perlin(u * 700, v * 170) > 0.55) c = mix(c, hex("#f6dfae"), 0.5);
    return c;
  }));
  const crustN = await once("crustN", () => normalMap(512, 128, (u, v) => 0.5 + fbm(u * 60, v * 12, 4) * 0.8 + perlin(u * 300, v * 60) * 0.2, 3));
  const crust = grid(220, 26, (u, v) => {
    const a = u * TAU, puff = 1 + 0.18 * fbm(Math.cos(a) * 6, Math.sin(a) * 6, 3), q = v * Math.PI;
    const rr = inner + crustW * 0.5 - Math.cos(q) * crustW * 0.5 * (1 + 0.1 * puff);
    return [Math.cos(a) * rr, Y + Math.sin(q) * 0.017 * puff + 0.002, Math.sin(a) * rr];
  }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, crust, material(doc, "borda", { tex: crustTex, normal: crustN, rough: 0.7 })));

  // cobertura
  const topN = await once("topN" + (f.choc ? "c" : ""), () => normalMap(1024, 1024, (u, v) => f.choc ? 0.5 + fbm(u * 10, v * 10, 4) * 0.3 + (sprinkle((u - 0.5) * 0.336, (v - 0.5) * 0.336, 0.0042, 3.1) ? 0.35 : 0) : 0.5 + perlin(u * 38, v * 38) * 0.6 + fbm(u * 14, v * 14, 4) * 0.4, f.choc ? 2 : 2.5));
  const topMat = material(doc, f.choc ? "chocolate" : "queijo", { tex: await topTexture(name, f, inner), normal: topN, rough: f.choc ? 0.3 : name === "margherita" ? 0.36 : 0.42 });
  mesh.addPrimitive(prim(doc, buf, disc(0, Y + 0.004, 0, inner + 0.003, (x, z) => 0.0018 * fbm(x * 40, z * 40, 3) + 0.0015 * Math.max(0, perlin(x * 70, z * 70)), 160, 30), topMat));

  const T = (key, w, h, fn, rough = 0.4, extra = {}) => once(key, async () => ({ tex: await img(w, h, fn), rough, ...extra }));
  const mat = async (key, w, h, fn, rough, extra) => { const t = await T(key, w, h, fn, rough, extra); return material(doc, key, { tex: t.tex, rough: t.rough }); };
  // junta as peças do mesmo material numa malha só (menos desenhos por quadro no celular)
  const batches = new Map();
  const add = (g, m) => { if (!batches.has(m)) batches.set(m, []); batches.get(m).push(g); };
  const solid = (n, color, rough) => material(doc, n, { color: lin(color), rough });

  // ---- coberturas por cima
  const calabresaMat = () => mat("calabresa", 256, 256, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; let c = mix(hex("#c0422f"), hex("#8c2418"), 0.5 + fbm(u * 8, v * 8, 3)); if (perlin(u * 40, v * 40) > 0.35) c = mix(c, hex("#f0c9a8"), 0.7); if (r > 0.86) c = mix(c, hex("#5e170d"), 0.8); return c; }, 0.35);
  const olives = (n, seed, rMin = 0.04, rMax = inner * 0.85) => { const m = solid("azeitona", "#2a2420", 0.18); for (const [x, z] of scatter(inner, n, rMin, rMax, 0.04, seed)) add(translate(lathe([[0.0025, 0], [0.0062, 0.0006], [0.0068, 0.0035], [0.0062, 0.0062], [0.0025, 0.0068], [0.0025, 0]], 24), x, Y + 0.0062, z), m); };
  const onions = (n, seed) => { const m = solid("cebola", "#f1e6ef", 0.25); for (const [x, z] of scatter(inner, n, 0.02, inner * 0.85, 0.03, seed)) add(translate(lathe([[0.008, 0], [0.0095, 0.0009], [0.008, 0.0018], [0.0065, 0.0009], [0.008, 0]], 32), x, Y + 0.0072, z), m); };
  const tomatoMat = () => mat("tomate", 512, 512, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    if (r > 0.9) return mix(hex("#d8321d"), hex("#a71e10"), (r - 0.9) * 10);
    const wall = Math.abs(Math.sin(a * 2.5)) < 0.16 || r > 0.78 || r < 0.22; // paredes da polpa
    let c = wall ? mix(hex("#e5482f"), hex("#c93220"), perlin(u * 30, v * 30) + 0.5) : mix(hex("#f2735a"), hex("#e2513a"), perlin(u * 20, v * 20) + 0.5);
    if (!wall && r > 0.35 && r < 0.7 && perlin(u * 90, v * 90) > 0.35) c = mix(c, hex("#f7d48a"), 0.8); // sementes
    return c;
  }, 0.22);
  const tomatoes = async (n, seed, rr = 0.026) => { const m = await tomatoMat(); for (const [x, z, k] of scatter(inner, n, 0.035, inner * 0.8, rr * 2.1, seed)) add(disc(x, top + 0.0004, z, rr * (0.92 + k * 0.12), (px, pz, v) => 0.0026 * Math.min(1, v * 6) - 0.0004, 44, 6), m); };
  const chickenMat = () => mat("frango", 256, 256, (u, v) => { let c = mix(hex("#e7bf83"), hex("#b98146"), 0.5 + perlin(u * 4, v * 40) * 1.3 + fbm(u * 6, v * 6, 2) * 0.5); return mix(c, hex("#8a4f1f"), smooth(0.15, 0.5, perlin(u * 7 + 3, v * 7)) * 0.7); }, 0.62);
  // frango desfiado: montinhos de fios, meio afundados no queijo
  const chicken = async (n, seed) => { const m = await chickenMat(); const r = rng(seed); for (const [x, z] of scatter(inner, n, 0.012, inner * 0.88, 0.028, seed)) { const base = r() * TAU; for (let j = 0; j < 8; j++) { const a = r() * TAU, d = r() * 0.011; add(shred(x + Math.cos(a) * d, top - 0.0016 + j * 0.00025, z + Math.sin(a) * d, 0.011 + r() * 0.009, 0.0036 + r() * 0.0016, 0.0019 + r() * 0.0009, base + (r() - 0.5) * 1.6, (r() - 0.5) * 0.8), m); } } };
  const baconMat = () => mat("bacon", 256, 256, (u, v) => { const fat = fbm(u * 5 + 2, v * 9, 3) + Math.sin(v * 9 + fbm(u * 3, v * 3, 2) * 4) * 0.25; let c = fat > 0.18 ? mix(hex("#e9bd8c"), hex("#c98f5c"), perlin(u * 20, v * 20) + 0.5) : mix(hex("#8a3a22"), hex("#52200f"), perlin(u * 14, v * 30) + 0.5); return mix(c, hex("#3a1607"), smooth(0.15, 0.5, perlin(u * 11, v * 11)) * 0.65); }, 0.45);
  // bacon em cubinhos crocantes e irregulares
  const bacon = async (n, seed) => { const m = await baconMat(); const r = rng(seed); for (const [x, z, k] of scatter(inner, n, 0.015, inner * 0.9, 0.017, seed)) add(chunk(x, top + 0.0002, z, 0.0048 + k * 0.0018, 0.0026, 0.0038 + r() * 0.0016, r() * TAU, k * 10 + seed), m); };
  const catupiry = async (n, seed, rMax = inner * 0.75, big = 1) => { const m = material(doc, "catupiry", { color: lin("#fbf3e2"), rough: 0.3 }); for (const [x, z, k] of scatter(inner, n, 0, rMax, 0.055 * big, seed)) add(translate(dollop((0.016 + k * 0.006) * big, (0.012 + k * 0.004) * big, seed + x * 1e4), x, top - 0.0018, z), m); };

  if (name === "calabresa") {
    const m = await calabresaMat(); let k = 0;
    for (let ring = 0; ring < 3; ring++) { const n = [1, 6, 11][ring], rr = [0, 0.065, 0.128][ring]; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + ring * 0.4 + (k++ % 3) * 0.05; add(disc(Math.cos(a) * rr, top, Math.sin(a) * rr, 0.019 + (k % 3) * 0.0015, (x, z, v) => 0.0024 * (1 - v) * (1 - v) - 0.001 + 0.0006 * Math.sin(x * 300), 36, 5), m); } }
    onions(9, 21); olives(8, 22);
  }
  if (name === "mussarela") { await tomatoes(7, 31); olives(8, 32, 0.03); }
  if (name === "margherita") {
    const leafTex = await once("manjericao", () => img(512, 256, (u, v) => { const mid = Math.abs(v - 0.5) < 0.012; const c = mix(hex("#4f9a3c"), hex("#2a6a22"), 0.5 + fbm(u * 6, v * 6, 4) + Math.abs(v - 0.5) * 0.7); return mid ? mix(c, hex("#a5d48d"), 0.4) : c; }));
    const lm = material(doc, "manjericao", { tex: leafTex, rough: 0.35 }); lm.setDoubleSided(true);
    const r = rng(41);
    for (const [x, z] of scatter(inner, 8, 0.02, inner * 0.78, 0.05, 41)) add(leafGeo(x, top + 0.0012, z, 0.034 + r() * 0.01, 0.011 + r() * 0.003, r() * TAU, -0.05), lm);
  }
  if (name === "frango-catupiry") { await chicken(46, 51); await catupiry(9, 52); }
  if (name === "frango-bacon") { await chicken(40, 61); await bacon(40, 62); }
  if (name === "bacon-cheddar") {
    await bacon(55, 71);
    const m = material(doc, "cheddar", { color: lin("#ee8418"), rough: 0.22 });
    // fios de cheddar em zigue-zague, de um lado ao outro (como sai da bisnaga)
    const lim = inner * 0.9, ang = 0.5;
    for (let L = -3; L <= 3; L++) {
      const off = L * 0.042, half = Math.sqrt(Math.max(0, lim * lim - off * off)); if (half < 0.03) continue;
      const pts = [];
      for (let t = -half; t <= half; t += 0.002) { const w = Math.sin(t * 95 + L) * 0.009 + Math.sin(t * 31) * 0.003; const x = t, z = off + w; pts.push([x * Math.cos(ang) - z * Math.sin(ang), top + 0.0024, x * Math.sin(ang) + z * Math.cos(ang)]); }
      add(tube(pts, 0.0026, 8), m);
    }
  }
  if (name === "portuguesa") {
    const ham = solid("presunto", "#e8a09a", 0.35); const r = rng(81);
    for (const [x, z, k] of scatter(inner, 34, 0.01, inner * 0.9, 0.019, 81)) { const g = cuboid(0.016 + k * 0.006, 0.0022, 0.0065 + r() * 0.003); rotY(g, r() * TAU); add(translate(g, x, top - 0.0004, z), ham); }
    const eggM = await mat("ovo", 256, 256, (u, v) => { const r2 = Math.hypot((u - 0.5) * 1.25, v - 0.5) * 2; return r2 < 0.5 ? mix(hex("#f7c531"), hex("#eaa818"), perlin(u * 9, v * 9) + 0.5) : r2 < 0.56 ? hex("#f3e3a2") : mix(hex("#fffef8"), hex("#f1ece0"), perlin(u * 9, v * 9) + 0.5); }, 0.3);
    for (const [x, z, k] of scatter(inner, 8, 0.03, inner * 0.78, 0.055, 82)) add(disc(x, top + 0.0003, z, 0.0175, (px, pz, v) => 0.0028 * Math.min(1, v * 5) - 0.0005, 36, 6, 0.0135, k * TAU), eggM);
    const pea = solid("ervilha", "#7cb342", 0.3);
    for (const [x, z] of scatter(inner, 34, 0.01, inner * 0.9, 0.012, 83)) add(ellipsoid(x, top + 0.0012, z, 0.0036, 0.0033, 0.0036, 0, 12), pea);
    onions(7, 84); olives(8, 85);
  }
  if (name === "quatro-queijos") await catupiry(5, 91, inner * 0.7, 0.9);
  if (name === "pepperoni") {
    const m = await mat("pepperoni", 256, 256, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; let c = mix(hex("#b8301f"), hex("#861a10"), 0.5 + fbm(u * 10, v * 10, 3)); if (perlin(u * 46, v * 46) > 0.4) c = mix(c, hex("#e9a58c"), 0.6); c = mix(c, hex("#4e0f07"), smooth(0.72, 0.98, r) * 0.85); return c; }, 0.28);
    for (const [x, z, k] of scatter(inner, 30, 0, inner * 0.9, 0.033, 101)) add(disc(x, top, z, 0.0155 + k * 0.002, (px, pz, v) => 0.0034 * (1 - v) * (1 - v) - 0.0008, 36, 6), m);
  }
  if (name === "brigadeiro") {
    const bTex = await once("brig", () => img(512, 256, (u, v) => { const s = sprinkle(u * 0.07, v * 0.035, 0.0042, 8.3); return s === 1 ? hex("#1c0b04") : s === 2 ? hex("#6b3a20") : mix(hex("#3a1a0b"), hex("#24100a"), perlin(u * 30, v * 30) + 0.5); }));
    const m = material(doc, "brigadeiro", { tex: bTex, rough: 0.75 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2, rr = inner * 0.62; add(ellipsoid(Math.cos(a) * rr, top + 0.0085, Math.sin(a) * rr, 0.012, 0.0115, 0.012, a, 24), m); }
    add(ellipsoid(0, top + 0.0085, 0, 0.012, 0.0115, 0.012, 0, 24), m);
  }
  for (const [m, list] of batches) mesh.addPrimitive(prim(doc, buf, merge(list), m));
}

export function merge(list) {
  const out = { pos: [], nor: [], uv: [], idx: [] };
  for (const g of list) { const o = out.pos.length / 3; for (const v of g.pos) out.pos.push(v); for (const v of g.nor) out.nor.push(v); for (const v of g.uv) out.uv.push(v); for (const i of g.idx) out.idx.push(i + o); }
  return out;
}

async function onBoard(name) {
  const id = `pizza-${name}`, { doc, buf, mesh } = start(id);
  const wood = material(doc, "madeira", { tex: await once("wood", woodTex), rough: 0.6 });
  mesh.addPrimitive(prim(doc, buf, planarUV(lathe([[0.0001, 0.02], [0.205, 0.02], [0.214, 0.017], [0.216, 0.008], [0.212, 0.002], [0.0001, 0]], 128), 0.44), wood));
  await pizzaParts(doc, buf, mesh, name, 0.19, 0.02);
  scene(doc, mesh, id); await save(doc, id);
}
async function inBox(name) {
  const id = `pizza-caixa-${name}`, { doc, buf, mesh } = start(id);
  const S = 0.4, Hb = 0.045, t = 0.003;
  const kraft = await once("kraft", () => img(1024, 1024, (u, v) => { let c = mix(hex("#c79a62"), hex("#b0834d"), 0.5 + fbm(u * 6, v * 6, 4) * 0.8); if (perlin(u * 900, v * 5) > 0.45) c = mix(c, hex("#9c7140"), 0.25); return c; }));
  const inside = await once("kraftIn", () => img(512, 512, (u, v) => mix(hex("#e8d8b8"), hex("#d6c094"), 0.5 + fbm(u * 6, v * 6, 3) * 0.7)));
  const outMat = material(doc, "papelao", { tex: kraft, rough: 0.9 }), inMat = material(doc, "papelao-dentro", { tex: inside, rough: 0.95 });
  const box = (x0, x1, y0, y1, z0, z1, m) => { const g = translate(cuboid(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, y0, (z0 + z1) / 2); planarUV(g, S); mesh.addPrimitive(prim(doc, buf, g, m)); };
  const h = S / 2;
  box(-h, h, 0, t, -h, h, inMat);
  box(-h, h, 0, Hb, -h, -h + t, outMat); box(-h, h, 0, Hb, h - t, h, outMat); box(-h, -h + t, 0, Hb, -h, h, outMat); box(h - t, h, 0, Hb, -h, h, outMat);
  await pizzaParts(doc, buf, mesh, name, 0.19 * (S - 0.014) / 0.4, t);
  scene(doc, mesh, id); await save(doc, id);
}

if (import.meta.url === `file://${process.argv[1]}`) {
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const names = only.length ? only : Object.keys(FLAVORS);
for (const n of names) {
  if (!FLAVORS[n]) { console.error("sabor desconhecido:", n); continue; }
  if (!args.includes("--caixa")) await onBoard(n);
  if (!args.includes("--tabua")) await inBox(n);
}
}
