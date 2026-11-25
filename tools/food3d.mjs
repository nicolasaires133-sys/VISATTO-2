// Ferramentas para criar comidas em 3D por código: ruído, texturas, relevo (normal map), malhas e glTF.
import { Document, NodeIO } from "@gltf-transform/core";
export { Document };
import sharp from "sharp";
import fs from "node:fs";

export const OUT = new URL("./out/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// ---------- ruído ----------
let seed = 11;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
export const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const lerp = (a, b, t) => a + (b - a) * t;
export function grad(h, x, y) { const u = h & 1 ? x : -x, v = h & 2 ? y : -y; return (h & 4 ? u + v : u - v) * 0.7; }
export function perlin(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y), a = P[X] + Y, b = P[X + 1] + Y;
  return lerp(lerp(grad(P[a], x, y), grad(P[b], x - 1, y), u), lerp(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v);
}
export const fbm = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * perlin(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
// ruído que fecha a volta em u (para a lateral, que dá a volta no doce)
export const fbmWrap = (u, y, period, o = 5) => { const a = u * Math.PI * 2, R = period / (Math.PI * 2); return fbm(Math.cos(a) * R + 50, Math.sin(a) * R + y, o); };
export const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * Math.max(0, Math.min(1, t)));
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

export async function img(w, h, fn, { jpeg = true, alpha = false } = {}) {
  const ch = alpha ? 4 : 3, buf = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x / w, y / h, x, y); const o = (y * w + x) * ch; buf[o] = clamp(c[0]); buf[o + 1] = clamp(c[1]); buf[o + 2] = clamp(c[2]); if (alpha) buf[o + 3] = clamp(c[3] ?? 255); }
  const s = sharp(buf, { raw: { width: w, height: h, channels: ch } });
  return jpeg && !alpha ? s.jpeg({ quality: 80, mozjpeg: true }).toBuffer() : s.png().toBuffer();
}
// normal map a partir de um mapa de altura (0..1)
export async function normalMap(w, h, height, strength = 2) {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = height(x / w, y / h);
  return img(w, h, (u, v, x, y) => {
    const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)], d = H[Math.min(h - 1, y + 1) * w + x], t = H[Math.max(0, y - 1) * w + x];
    let nx = (l - r) * strength, ny = (d - t) * strength, nz = 1; const L = Math.hypot(nx, ny, nz);
    return [(nx / L * 0.5 + 0.5) * 255, (ny / L * 0.5 + 0.5) * 255, (nz / L * 0.5 + 0.5) * 255];
  });
}

// ---------- glTF ----------
export function material(doc, name, { color = [1, 1, 1, 1], tex, normal, rough = 0.8, alpha, mime = "image/jpeg", normalScale = 1 } = {}) {
  const m = doc.createMaterial(name).setRoughnessFactor(rough).setMetallicFactor(0).setBaseColorFactor(color);
  if (tex) m.setBaseColorTexture(doc.createTexture(name).setImage(tex).setMimeType(alpha ? "image/png" : mime));
  if (normal) { m.setNormalTexture(doc.createTexture(name + "-n").setImage(normal).setMimeType("image/jpeg")); m.getNormalTextureInfo(); m.setNormalScale(normalScale); }
  if (alpha) m.setAlphaMode(alpha);
  return m;
}
export function prim(doc, buffer, { pos, nor, uv, idx }, mat) {
  const p = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buffer));
  if (mat) p.setMaterial(mat);
  return p;
}
// normais suaves calculadas pela malha
export function smoothNormals(g) {
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
export function grid(nu, nv, f, { wrap = false, flip = false } = {}) {
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
export function lathe(profile, seg = 128) {
  const n = profile.length - 1;
  const at = (v) => { const t = v * n, i = Math.min(n - 1, Math.floor(t)), f = t - i; return [lerp(profile[i][0], profile[i + 1][0], f), lerp(profile[i][1], profile[i + 1][1], f)]; };
  return grid(seg, n * 4, (u, v) => { const [r, y] = at(v); const a = u * Math.PI * 2; return [Math.cos(a) * r, y, Math.sin(a) * r]; }, { wrap: true });
}
export function ellipsoid(cx, cy, cz, rx, ry, rz, rotY = 0, seg = 22) {
  return grid(seg, seg / 2, (u, v) => {
    const a = u * Math.PI * 2, b = v * Math.PI; let x = Math.cos(a) * Math.sin(b) * rx, z = Math.sin(a) * Math.sin(b) * rz;
    const y = -Math.cos(b) * ry; const c = Math.cos(rotY), s = Math.sin(rotY);
    return [cx + x * c - z * s, cy + y, cz + x * s + z * c];
  }, { wrap: true, flip: true });
}
export function plateGeo(r) {
  return lathe([[0.0001, 0.0085], [r * 0.6, 0.0085], [r * 0.69, 0.011], [r * 0.88, 0.019], [r * 0.985, 0.022], [r, 0.02], [r * 0.9, 0.016], [r * 0.7, 0.007], [r * 0.62, 0.004], [0.0001, 0.004]], 112);
}
export async function save(doc, name) { fs.writeFileSync(new URL(`${name}.glb`, OUT), await new NodeIO().writeBinary(doc)); console.log("ok", name); }

// folha de hortelã (plana, levemente curvada), em pé sobre o doce
export function leafGeo(cx, cy, cz, len, wid, rot, tilt) {
  return grid(16, 8, (u, v) => {
    const t = u, half = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 - 0.15 * t);
    const s = (v - 0.5) * 2, x = (t - 0.15) * len, z = s * half, y = (s * s) * wid * 0.35 + Math.sin(t * Math.PI) * len * 0.12;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    const y2 = y * ct + x * st, x2 = x * ct - y * st;
    return [cx + x2 * cr - z * sr, cy + y2, cz + x2 * sr + z * cr];
  }, { flip: true });
}

