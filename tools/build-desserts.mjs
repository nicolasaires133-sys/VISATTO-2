// Sobremesas de demonstração com mais realismo: tiramisù (camadas onduladas, biscoito com poros,
// creme que estufa, cacau em pó, hortelã e grãos de café) e panna cotta (calda escorrendo, frutas vermelhas).
// Texturas e relevo (normal map) feitos por código. Uso: node tools/build-desserts.mjs → tools/out/*.glb
import { Document, NodeIO } from "@gltf-transform/core";
import sharp from "sharp";
import fs from "node:fs";

const OUT = new URL("./out/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// ---------- ruído ----------
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y) { const u = h & 1 ? x : -x, v = h & 2 ? y : -y; return (h & 4 ? u + v : u - v) * 0.7; }
function perlin(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y), a = P[X] + Y, b = P[X + 1] + Y;
  return lerp(lerp(grad(P[a], x, y), grad(P[b], x - 1, y), u), lerp(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v);
}
const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * perlin(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
// ruído que fecha a volta em u (para a lateral, que dá a volta no doce)
const fbmWrap = (u, y, period, o = 5) => { const a = u * Math.PI * 2, R = period / (Math.PI * 2); return fbm(Math.cos(a) * R + 50, Math.sin(a) * R + y, o); };
const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * Math.max(0, Math.min(1, t)));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

async function img(w, h, fn, { jpeg = true, alpha = false } = {}) {
  const ch = alpha ? 4 : 3, buf = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x / w, y / h, x, y); const o = (y * w + x) * ch; buf[o] = clamp(c[0]); buf[o + 1] = clamp(c[1]); buf[o + 2] = clamp(c[2]); if (alpha) buf[o + 3] = clamp(c[3] ?? 255); }
  const s = sharp(buf, { raw: { width: w, height: h, channels: ch } });
  return jpeg && !alpha ? s.jpeg({ quality: 80, mozjpeg: true }).toBuffer() : s.png().toBuffer();
}
// normal map a partir de um mapa de altura (0..1)
async function normalMap(w, h, height, strength = 2) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = height(x / w, y / h);
  return img(w, h, (u, v, x, y) => {
    const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)], d = H[Math.min(h - 1, y + 1) * w + x], t = H[Math.max(0, y - 1) * w + x];
    let nx = (l - r) * strength, ny = (d - t) * strength, nz = 1; const L = Math.hypot(nx, ny, nz);
    return [(nx / L * 0.5 + 0.5) * 255, (ny / L * 0.5 + 0.5) * 255, (nz / L * 0.5 + 0.5) * 255];
  });
}

// ---------- glTF ----------
function material(doc, name, { color = [1, 1, 1, 1], tex, normal, rough = 0.8, alpha, mime = "image/jpeg", normalScale = 1 } = {}) {
  const m = doc.createMaterial(name).setRoughnessFactor(rough).setMetallicFactor(0).setBaseColorFactor(color);
  if (tex) m.setBaseColorTexture(doc.createTexture(name).setImage(tex).setMimeType(alpha ? "image/png" : mime));
  if (normal) { m.setNormalTexture(doc.createTexture(name + "-n").setImage(normal).setMimeType("image/jpeg")); m.getNormalTextureInfo(); m.setNormalScale(normalScale); }
  if (alpha) m.setAlphaMode(alpha);
  return m;
}
function prim(doc, buffer, { pos, nor, uv, idx }, mat) {
  const p = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buffer));
  if (mat) p.setMaterial(mat);
  return p;
}
// normais suaves calculadas pela malha
function smoothNormals(g) {
  const n = new Float32Array(g.pos.length);
  for (let i = 0; i < g.idx.length; i += 3) {
    const [a, b, c] = [g.idx[i], g.idx[i + 1], g.idx[i + 2]];
    const ax = g.pos[a * 3], ay = g.pos[a * 3 + 1], az = g.pos[a * 3 + 2];
    const e1 = [g.pos[b * 3] - ax, g.pos[b * 3 + 1] - ay, g.pos[b * 3 + 2] - az], e2 = [g.pos[c * 3] - ax, g.pos[c * 3 + 1] - ay, g.pos[c * 3 + 2] - az];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v * 3 + k] += f[k];
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  g.nor = Array.from(n);
  return g;
}
// grade (u,v) -> ponto; fecha em u se wrap
function grid(nu, nv, f, { wrap = false, flip = false } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; pos.push(...f(u, v)); uv.push(u, 1 - v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    flip ? idx.push(a, b, c, b, d, c) : idx.push(a, c, b, b, c, d);
  }
  const g = { pos, uv, idx, nor: [] };
  smoothNormals(g);
  if (wrap) { // junta as normais da costura
    for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; for (let k = 0; k < 3; k++) { const m = (g.nor[a * 3 + k] + g.nor[b * 3 + k]) / 2; g.nor[a * 3 + k] = g.nor[b * 3 + k] = m; } }
  }
  return g;
}
function lathe(profile, seg = 128) {
  const n = profile.length - 1;
  const at = (v) => { const t = v * n, i = Math.min(n - 1, Math.floor(t)), f = t - i; return [lerp(profile[i][0], profile[i + 1][0], f), lerp(profile[i][1], profile[i + 1][1], f)]; };
  return grid(seg, n * 4, (u, v) => { const [r, y] = at(v); const a = u * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; }, { wrap: true });
}
function ellipsoid(cx, cy, cz, rx, ry, rz, rotY = 0, seg = 22) {
  return grid(seg, seg / 2, (u, v) => {
    const a = u * Math.PI * 2, b = v * Math.PI; let x = Math.cos(a) * Math.sin(b) * rx, z = Math.sin(a) * Math.sin(b) * rz;
    const y = -Math.cos(b) * ry; const c = Math.cos(rotY), s = Math.sin(rotY);
    return [cx + x * c - z * s, cy + y, cz + x * s + z * c];
  }, { wrap: true, flip: true });
}
function plateGeo(r) {
  return lathe([[0.0001, 0.0085], [r * 0.6, 0.0085], [r * 0.69, 0.011], [r * 0.88, 0.019], [r * 0.985, 0.022], [r, 0.02], [r * 0.9, 0.016], [r * 0.7, 0.007], [r * 0.62, 0.004], [0.0001, 0.004]], 112);
}
async function save(doc, name) { fs.writeFileSync(new URL(`${name}.glb`, OUT), await new NodeIO().writeBinary(doc)); console.log("ok", name); }

// folha de hortelã (plana, levemente curvada), em pé sobre o doce
function leafGeo(cx, cy, cz, len, wid, rot, tilt) {
  return grid(16, 8, (u, v) => {
    const t = u, half = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 - 0.15 * t);
    const s = (v - 0.5) * 2, x = (t - 0.15) * len, z = s * half, y = (s * s) * wid * 0.35 + Math.sin(t * Math.PI) * len * 0.12;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    const y2 = y * ct + x * st, x2 = x * ct - y * st;
    return [cx + x2 * cr - z * sr, cy + y2, cz + x2 * sr + z * cr];
  }, { flip: true });
}

// ================= TIRAMISÙ =================
async function tiramisu() {
  const doc = new Document(); const buf = doc.createBuffer(); const mesh = doc.createMesh("tiramisu");
  const W = 0.088, D = 0.074, R = 0.009, Y0 = 0.0085, H = 0.062, F = 0.0045; // fatia de 8,8 × 7,4 × 6,2 cm
  // camadas de baixo para cima (fração da altura)
  const L = [0, 0.2, 0.46, 0.64, 0.93, 1];
  const kind = (t) => (t < L[1] ? "s" : t < L[2] ? "c" : t < L[3] ? "s" : t < L[4] ? "c" : "k");
  const per = 2 * (W - 2 * R) + 2 * (D - 2 * R) + 2 * Math.PI * R;
  // contorno do retângulo arredondado pelo comprimento: ponto e normal
  function outline(u, inset = 0) {
    let s = u * per; const a = W / 2 - R, b = D / 2 - R, r = R - inset;
    const seg = [[2 * b, (t) => [a + r, -b + t, 1, 0]], [Math.PI * R / 2, (t) => { const q = t / R; return [a + Math.cos(q) * r, b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * a, (t) => [a - t, b + r, 0, 1]], [Math.PI * R / 2, (t) => { const q = Math.PI / 2 + t / R; return [-a + Math.cos(q) * r, b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * b, (t) => [-a - r, b - t, -1, 0]], [Math.PI * R / 2, (t) => { const q = Math.PI + t / R; return [-a + Math.cos(q) * r, -b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * a, (t) => [-a + t, -b - r, 0, -1]], [Math.PI * R / 2, (t) => { const q = 1.5 * Math.PI + t / R; return [a + Math.cos(q) * r, -b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }]];
    for (const [len, f] of seg) { if (s <= len + 1e-9) return f(Math.max(0, s)); s -= len; }
    return seg[0][1](0);
  }
  const wave = (u, k) => fbmWrap(u, k * 3.1, 9, 4) * 0.035; // fronteira ondulada entre as camadas
  const layerAt = (u, t) => { let tt = t; for (let k = 1; k < L.length - 1; k++) if (Math.abs(t - L[k]) < 0.06) tt = t - wave(u, k) * Math.max(0, 1 - Math.abs(t - L[k]) / 0.06); return kind(tt); };
  // deslocamento para fora: o creme estufa, o biscoito fica um pouco para dentro
  function bulge(u, t) {
    let o = 0;
    for (const [a, b] of [[L[1], L[2]], [L[3], L[4]]]) if (t > a && t < b) { const q = (t - a) / (b - a); o += 0.0008 * Math.sin(Math.PI * Math.pow(q, 1.25)) * (1 + 0.35 * fbmWrap(u, a * 9, 6, 3)); }
    if (layerAt(u, t) === "s") o -= 0.0003 - 0.0002 * fbmWrap(u, t * 9, 40, 2);
    return o;
  }
  const SIDE_TOP = 1 - F / H;
  const side = grid(200, 64, (u, v) => {
    const [x, z, nx, nz] = outline(u);
    if (v <= 0.86) { const t = (v / 0.86) * SIDE_TOP; const o = bulge(u, t); return [x + nx * o, Y0 + t * H, z + nz * o]; }
    // borda de cima arredondada
    const q = ((v - 0.86) / 0.14) * (Math.PI / 2); const [xi, zi] = outline(u, F);
    const ix = x + (xi - x) * (1 - Math.cos(q)), iz = z + (zi - z) * (1 - Math.cos(q));
    return [ix, Y0 + H - F + Math.sin(q) * F, iz];
  }, { wrap: true });
  // a textura da lateral segue a altura real (v da imagem = altura)
  for (let i = 0; i < side.uv.length; i += 2) side.uv[i + 1] = 1 - Math.min(1, (side.pos[(i / 2) * 3 + 1] - Y0) / H);
  // topo: grade dentro do contorno recuado, levemente abaulado
  const top = grid(128, 14, (u, v) => {
    const [xi, zi] = outline(u, F); const k = 1 - v; const x = xi * k, z = zi * k;
    const dome = 0.0012 * (1 - k * k) + 0.0004 * fbm(x * 90, z * 90, 3);
    return [x, Y0 + H + dome, z];
  }, { wrap: true });
  for (let i = 0; i < top.uv.length; i += 2) { const p = (i / 2) * 3; top.uv[i] = 0.5 + top.pos[p] / (W * 1.05); top.uv[i + 1] = 0.5 + top.pos[p + 2] / (W * 1.05); }

  // ---- texturas da lateral ----
  const SW = 2048, SH = 1024;
  const sponge = (u, v) => { // biscoito molhado no café
    const base = mix(hex("#a36c3d"), hex("#5d341b"), 0.5 + fbmWrap(u, v * 5, 24, 4) * 1.4);
    const pore = fbmWrap(u, v * 52, 260, 2); const p2 = perlin(u * 900, v * 186);
    const dark = pore < -0.2 || p2 < -0.45 ? 0.5 : 0;
    const crumb = perlin(u * 1500, v * 310) > 0.45 ? 0.14 : 0;
    return mix(mix(base, hex("#3b200f"), dark), hex("#c79461"), crumb);
  };
  const cream = (u, v) => {
    const c = mix(hex("#f3e6cb"), hex("#e4d0a8"), 0.5 + fbmWrap(u, v * 3, 14, 4) * 1.3);
    const streak = perlin(u * 60, v * 60) * 0.5 + 0.5;
    const speck = perlin(u * 1400, v * 290) > 0.6 ? 0.08 : 0;
    return mix(mix(c, hex("#fffaf0"), streak * 0.18), hex("#c9a77a"), speck);
  };
  const cocoa = (u, v) => mix(hex("#5a321b"), hex("#2f190c"), 0.5 + perlin(u * 1200, v * 600) * 0.9 + fbmWrap(u, v * 9, 20, 3));
  const sideTex = await img(SW, SH, (u, y) => {
    const t = 1 - y; const k = layerAt(u, t);
    let c = k === "s" ? sponge(u, t) : k === "c" ? cream(u, t) : cocoa(u, t);
    // o café escurece o creme logo acima do biscoito
    for (const b of [L[1], L[3]]) { const d = t - b; if (d > 0 && d < 0.04 && k === "c") c = mix(c, hex("#c9a273"), (1 - d / 0.04) * 0.55); }
    return c;
  });
  const sideNor = await normalMap(1024, 512, (u, y) => {
    const t = 1 - y, k = layerAt(u, t);
    if (k === "s") return 0.5 + fbmWrap(u, t * 52, 260, 2) * 0.9 + perlin(u * 900, t * 186) * 0.4;
    if (k === "c") return 0.5 + perlin(u * 60, t * 60) * 0.25 + fbmWrap(u, t * 3, 14, 3) * 0.3;
    return 0.5 + perlin(u * 1200, t * 600) * 0.6;
  }, 3);
  // ---- topo: cacau em pó ----
  const topTex = await img(1024, 1024, (u, v) => {
    const g = perlin(u * 700, v * 700), c = fbm(u * 9, v * 9, 5);
    const g2 = perlin(u * 1900 + 7, v * 1900);
    let col = mix(hex("#6b3d21"), hex("#3a1f0f"), 0.5 + c * 0.55 + g * 0.7 + g2 * 0.35);
    if (perlin(u * 1500 + 3, v * 1500) > 0.5) col = mix(col, hex("#8a5a35"), 0.5);
    return col;
  });
  const topNor = await normalMap(512, 512, (u, v) => 0.5 + perlin(u * 700, v * 700) * 0.7 + fbm(u * 9, v * 9, 4) * 0.5, 2.5);

  const sideMat = material(doc, "tiramisu-lado", { tex: sideTex, normal: sideNor, rough: 0.72, normalScale: 0.9 });
  const topMat = material(doc, "tiramisu-cacau", { tex: topTex, normal: topNor, rough: 0.95 });
  mesh.addPrimitive(prim(doc, buf, side, sideMat));
  mesh.addPrimitive(prim(doc, buf, top, topMat));
  // fundo (não aparece, mas fecha a peça)
  mesh.addPrimitive(prim(doc, buf, grid(96, 2, (u, v) => { const [x, z] = outline(u); return [x * (1 - v), Y0 + 0.0002, z * (1 - v)]; }, { wrap: true }), sideMat));

  // ---- prato ----
  const ceramic = material(doc, "porcelana", { color: [0.97, 0.965, 0.95, 1], rough: 0.16 });
  mesh.addPrimitive(prim(doc, buf, plateGeo(0.11), ceramic));
  // cacau polvilhado no prato, em volta da fatia
  const dust = await img(512, 512, (u, v) => {
    const x = (u - 0.5) * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y);
    const n = perlin(u * 260, v * 260) + fbm(u * 12, v * 12, 3) * 0.8;
    const a = (r < 0.92 ? 1 : 0) * Math.max(0, n - 0.25) * 2.2 * Math.max(0, 1 - Math.abs(r - 0.62) * 2.4);
    return [92, 52, 28, Math.min(1, a) * 255];
  }, { alpha: true });
  const dustMat = material(doc, "cacau-prato", { tex: dust, rough: 1, alpha: "BLEND" });
  mesh.addPrimitive(prim(doc, buf, grid(64, 1, (u, v) => { const a = u * Math.PI * 2, r = 0.066 * (v ? 1 : 0.001); return [Math.cos(a) * r, 0.0088, Math.sin(a) * r]; }, { flip: false }), dustMat));
  const dustGeo = mesh.listPrimitives().at(-1);
  { const g = dustGeo.getAttribute("TEXCOORD_0"); const p = dustGeo.getAttribute("POSITION"); const arr = new Float32Array(g.getCount() * 2); for (let i = 0; i < g.getCount(); i++) { const q = p.getElement(i, []); arr[i * 2] = 0.5 + q[0] / 0.132; arr[i * 2 + 1] = 0.5 + q[2] / 0.132; } g.setArray(arr); }

  // ---- hortelã e grãos de café ----
  const leafTex = await img(512, 256, (u, v) => {
    const mid = Math.abs(v - 0.5) < 0.012; const vein = Math.abs(Math.abs(v - 0.5) - (u * 0.45) % 0.11) < 0.008;
    const c = mix(hex("#4c8a45"), hex("#2c5e2b"), 0.5 + fbm(u * 6, v * 6, 4) + Math.abs(v - 0.5) * 0.6);
    return mid || vein ? mix(c, hex("#9ccb8c"), 0.45) : c;
  });
  const leafMat = material(doc, "hortela", { tex: leafTex, rough: 0.6 });
  leafMat.setDoubleSided(true);
  const ty = Y0 + H + 0.0014;
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.014, ty, -0.012, 0.03, 0.0085, -0.6, 0.18), leafMat));
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.014, ty + 0.001, -0.012, 0.024, 0.007, 0.5, 0.32), leafMat));
  const beanTex = await img(256, 128, (u, v) => { const crease = Math.abs(u - 0.25) < 0.012 || Math.abs(u - 0.75) < 0.012; return crease ? hex("#1c0d05") : mix(hex("#5a2f14"), hex("#3a1c0b"), 0.5 + fbm(u * 8, v * 8, 3)); });
  const beanMat = material(doc, "grao-cafe", { tex: beanTex, rough: 0.35 });
  mesh.addPrimitive(prim(doc, buf, ellipsoid(-0.058, 0.0118, 0.03, 0.0058, 0.0028, 0.0042, 0.7), beanMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(-0.05, 0.0116, 0.04, 0.0055, 0.0027, 0.004, 2.1), beanMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(0.006, ty + 0.0018, 0.016, 0.005, 0.0024, 0.0037, 1.2), beanMat));

  doc.createScene("Scene").addChild(doc.createNode("tiramisu").setMesh(mesh));
  await save(doc, "tiramisu");
}

// ================= PANNA COTTA =================
async function pannacotta() {
  const doc = new Document(); const buf = doc.createBuffer(); const mesh = doc.createMesh("pannacotta");
  const Y0 = 0.0085, R0 = 0.034, Rt = 0.024, H = 0.045;
  // perfil do creme (formato de pudim, topo achatado com borda arredondada)
  const prof = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; prof.push([lerp(R0, Rt, Math.pow(t, 1.1)) * (1 + 0.04 * Math.sin(t * Math.PI)), Y0 + t * (H - 0.004)]); }
  for (let i = 1; i <= 8; i++) { const q = (i / 8) * Math.PI / 2; prof.push([Rt - 0.004 + Math.cos(q) * 0.004, Y0 + H - 0.004 + Math.sin(q) * 0.004]); }
  prof.push([0.0001, Y0 + H]);
  const creamTex = await img(1024, 512, (u, v) => mix(hex("#fbf4e6"), hex("#efe2c8"), 0.5 + fbmWrap(u, v * 5, 7, 4) * 0.9 + perlin(u * 400, v * 200) * 0.08));
  const creamNor = await normalMap(512, 256, (u, v) => 0.5 + fbmWrap(u, v * 5, 7, 3) * 0.15, 2);
  const creamMat = material(doc, "creme", { tex: creamTex, normal: creamNor, rough: 0.32 });
  mesh.addPrimitive(prim(doc, buf, lathe(prof, 96), creamMat));
  // calda de frutas vermelhas: cobre o topo e escorre pela lateral em gotas
  const drip = (a) => { const n = 0.5 + 0.5 * Math.sin(a * 7 + 0.6) * Math.sin(a * 3 + 2.1); return Math.pow(Math.max(0, n), 1.6); };
  const sauce = grid(128, 32, (u, v) => {
    const a = u * Math.PI * 2; const reach = 0.12 + 0.62 * drip(a); // até onde a calda desce (fração da altura)
    if (v < 0.35) { const r = (v / 0.35) * (Rt - 0.001); return [Math.cos(a) * r, Y0 + H + 0.0016 - (v / 0.35) * 0.0004, Math.sin(a) * r]; }
    const w = (v - 0.35) / 0.65; // da borda para baixo
    if (w < 0.2) { const q = (w / 0.2) * Math.PI / 2; const r = Rt - 0.004 + Math.cos(Math.PI / 2 - q) * 0.0056; return [Math.cos(a) * r, Y0 + H - 0.004 + Math.cos(q) * 0.0056, Math.sin(a) * r]; }
    const t = 1 - ((w - 0.2) / 0.8) * reach; const yy = Y0 + t * (H - 0.004);
    const rr = lerp(R0, Rt, Math.pow(t, 1.1)) * (1 + 0.04 * Math.sin(t * Math.PI)) + 0.0014 + 0.0012 * (1 - (w - 0.2) / 0.8);
    return [Math.cos(a) * rr, yy, Math.sin(a) * rr];
  }, { wrap: true, flip: true });
  const sauceTex = await img(512, 256, (u, v) => mix(hex("#a3122a"), hex("#5e0716"), 0.5 + fbm(u * 10, v * 10, 4) + perlin(u * 300, v * 150) * 0.3));
  const sauceMat = material(doc, "calda", { tex: sauceTex, rough: 0.08 });
  mesh.addPrimitive(prim(doc, buf, sauce, sauceMat));
  // framboesas (bolinhas) e mirtilos
  const rasp = await img(256, 256, (u, v) => { const d = Math.abs(perlin(u * 40, v * 20)); return mix(hex("#d01f45"), hex("#7a0c22"), d * 2.2 + fbm(u * 6, v * 6, 2)); });
  const raspN = await normalMap(256, 256, (u, v) => 0.5 + Math.abs(perlin(u * 40, v * 20)) * -1.2, 3);
  const raspMat = material(doc, "framboesa", { tex: rasp, normal: raspN, rough: 0.4 });
  const blue = await img(128, 128, (u, v) => mix(hex("#3b3f6e"), hex("#1d1f3d"), 0.5 + fbm(u * 5, v * 5, 3)));
  const blueMat = material(doc, "mirtilo", { tex: blue, rough: 0.55, color: [0.85, 0.85, 0.95, 1] });
  const topY = Y0 + H + 0.0016;
  mesh.addPrimitive(prim(doc, buf, ellipsoid(0.004, topY + 0.008, -0.003, 0.0085, 0.009, 0.0085, 0), raspMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(-0.009, topY + 0.006, 0.008, 0.0062, 0.0064, 0.0062, 1), blueMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(0.052, 0.0138, 0.018, 0.0085, 0.009, 0.0085, 0.4), raspMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(0.046, 0.0122, 0.035, 0.0062, 0.0062, 0.0062, 0), blueMat));
  mesh.addPrimitive(prim(doc, buf, ellipsoid(0.06, 0.0122, 0.002, 0.006, 0.006, 0.006, 0), blueMat));
  // poça de calda no prato
  const pool = grid(96, 6, (u, v) => { const a = u * Math.PI * 2; const r = R0 + 0.002 + v * (0.012 + 0.012 * drip(a + 0.4)); return [Math.cos(a) * r, 0.0088 + (1 - v) * 0.0006, Math.sin(a) * r]; }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, pool, sauceMat));
  const leafTex = await img(512, 256, (u, v) => { const mid = Math.abs(v - 0.5) < 0.012; const c = mix(hex("#3f8a3a"), hex("#2a6b2a"), 0.5 + fbm(u * 6, v * 6, 4)); return mid ? mix(c, hex("#8cc77d"), 0.6) : c; });
  const leafMat = material(doc, "hortela", { tex: leafTex, rough: 0.45 }); leafMat.setDoubleSided(true);
  mesh.addPrimitive(prim(doc, buf, leafGeo(-0.002, topY + 0.004, 0.002, 0.026, 0.0075, 2.4, 0.35), leafMat));
  const ceramic = material(doc, "porcelana", { color: [0.97, 0.965, 0.95, 1], rough: 0.16 });
  mesh.addPrimitive(prim(doc, buf, plateGeo(0.09), ceramic));
  doc.createScene("Scene").addChild(doc.createNode("pannacotta").setMesh(mesh));
  await save(doc, "pannacotta");
}

await tiramisu();
await pannacotta();
