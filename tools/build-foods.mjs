// Comidas de demonstração e modelos prontos em 3D, feitos por código (mesma técnica do tiramisù).
// Uso: node tools/build-foods.mjs [nomes...] → tools/out/<nome>.glb
// Demonstração: pizza, lasanha, shawarma, acai, pudim, brownie
// Modelos prontos (o painel ajusta o tamanho): pizza-caixa, acai-copo, marmita
import { Document, perlin, fbm, fbmWrap, mix, hex, lerp, img, normalMap, material, prim, smoothNormals, grid, lathe, ellipsoid, plateGeo, save, leafGeo } from "./food3d.mjs";

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- formas ----------
/** contorno de retângulo arredondado pelo comprimento: [x, z, nx, nz] */
function roundRect(W, D, R) {
  const a = W / 2 - R, b = D / 2 - R;
  const per = 4 * (a + b) + TAU * R;
  return (u, inset = 0) => {
    let s = (((u % 1) + 1) % 1) * per; const r = R - inset;
    const segs = [[2 * b, (t) => [a + r, -b + t, 1, 0]], [Math.PI * R / 2, (t) => { const q = t / R; return [a + Math.cos(q) * r, b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * a, (t) => [a - t, b + r, 0, 1]], [Math.PI * R / 2, (t) => { const q = Math.PI / 2 + t / R; return [-a + Math.cos(q) * r, b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * b, (t) => [-a - r, b - t, -1, 0]], [Math.PI * R / 2, (t) => { const q = Math.PI + t / R; return [-a + Math.cos(q) * r, -b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }],
      [2 * a, (t) => [-a + t, -b - r, 0, -1]], [Math.PI * R / 2, (t) => { const q = 1.5 * Math.PI + t / R; return [a + Math.cos(q) * r, -b + Math.sin(q) * r, Math.cos(q), Math.sin(q)]; }]];
    for (const [len, f] of segs) { if (s <= len + 1e-9) return f(Math.max(0, s)); s -= len; }
    return segs[0][1](0);
  };
}
/** superfície de cima com relevo dentro de um contorno (u: volta, v: da borda ao centro) */
function capInside(outline, y, inset, hFn, nu = 128, nv = 14, W = 0.1) {
  const g = grid(nu, nv, (u, v) => { const [xi, zi] = outline(u, inset); const k = 1 - v; const x = xi * k, z = zi * k; return [x, y + hFn(x, z, k), z]; }, { wrap: true });
  for (let i = 0; i < g.uv.length; i += 2) { const p = (i / 2) * 3; g.uv[i] = 0.5 + g.pos[p] / W; g.uv[i + 1] = 0.5 + g.pos[p + 2] / W; }
  return g;
}
/** planta: troca u/v da textura pela posição (para superfícies de cima) */
function planarUV(g, W, cx = 0, cz = 0) { for (let i = 0; i < g.uv.length; i += 2) { const p = (i / 2) * 3; g.uv[i] = 0.5 + (g.pos[p] - cx) / W; g.uv[i + 1] = 0.5 + (g.pos[p + 2] - cz) / W; } return g; }
function translate(g, dx, dy, dz) { for (let i = 0; i < g.pos.length; i += 3) { g.pos[i] += dx; g.pos[i + 1] += dy; g.pos[i + 2] += dz; } return g; }
function rotY(g, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], z = g.pos[i + 2]; g.pos[i] = x * c - z * s; g.pos[i + 2] = x * s + z * c; const nx = g.nor[i], nz = g.nor[i + 2]; g.nor[i] = nx * c - nz * s; g.nor[i + 2] = nx * s + nz * c; } return g; }
function disc(cx, cy, cz, r, hFn = () => 0, seg = 48, rings = 6) {
  return planarUV(grid(seg, rings, (u, v) => { const a = u * TAU, rr = r * (1 - v); const x = Math.cos(a) * rr, z = Math.sin(a) * rr; return [cx + x, cy + hFn(x, z, v), cz + z]; }, { wrap: true }), 2 * r, cx, cz);
}
/** cilindro deitado (eixo x), com tampas; tampa com uv própria (para mostrar o recheio) */
function lyingCylinder(len, r, bump = () => 0, seg = 64) {
  const body = grid(seg, 24, (u, v) => { const a = u * TAU; const rr = r + bump(u, v); return [(v - 0.5) * len, Math.sin(a) * rr + r, Math.cos(a) * rr]; }, { wrap: true });
  const cap = (sx) => { const g = grid(seg, 8, (u, v) => { const a = u * TAU, rr = (r + bump(u, sx > 0 ? 1 : 0)) * (1 - v); return [sx * len / 2, Math.sin(a) * rr + r, Math.cos(a) * rr]; }, { wrap: true, flip: sx < 0 }); for (let i = 0; i < g.uv.length; i += 2) { const p = (i / 2) * 3; g.uv[i] = 0.5 + g.pos[p + 2] / (2.2 * r); g.uv[i + 1] = 0.5 - (g.pos[p + 1] - r) / (2.2 * r); } return g; };
  return { body, capL: cap(-1), capR: cap(1) };
}
function ceramic(doc) { return material(doc, "porcelana", { color: [0.97, 0.965, 0.95, 1], rough: 0.16 }); }
function scene(doc, mesh, name) { doc.createScene("Scene").addChild(doc.createNode(name).setMesh(mesh)); }
function start(name) { const doc = new Document(); return { doc, buf: doc.createBuffer(), mesh: doc.createMesh(name) }; }

// ---------- texturas comuns ----------
async function woodTex(dark = false) {
  return img(1024, 1024, (u, v) => {
    const ring = Math.sin((v * 46 + fbm(u * 3, v * 9, 4) * 6) * Math.PI) * 0.5 + 0.5;
    const base = dark ? mix(hex("#7a4e2c"), hex("#4f2f17"), ring * 0.6 + fbm(u * 20, v * 2, 3)) : mix(hex("#c8945c"), hex("#9a6738"), ring * 0.55 + fbm(u * 20, v * 2, 3) * 0.8);
    return mix(base, hex("#e2b884"), perlin(u * 400, v * 30) > 0.5 ? 0.12 : 0);
  });
}
async function leafTex() {
  return img(512, 256, (u, v) => { const mid = Math.abs(v - 0.5) < 0.012; const vein = Math.abs(Math.abs(v - 0.5) - (u * 0.45) % 0.11) < 0.008; const c = mix(hex("#4c8a45"), hex("#2c5e2b"), 0.5 + fbm(u * 6, v * 6, 4) + Math.abs(v - 0.5) * 0.6); return mid || vein ? mix(c, hex("#9ccb8c"), 0.45) : c; });
}

// =====================================================================
// PIZZA (40 cm) — base com molho e queijo derretido, calabresa, cebola, azeitona, borda estufada
async function pizzaParts(doc, buf, mesh, R = 0.19, Y = 0.02) {
  const crustW = 0.022, inner = R - crustW;
  // borda (anel estufado e irregular)
  const crustTex = await img(1024, 256, (u, v) => {
    const burn = Math.max(0, perlin(u * 90, v * 12) + fbm(u * 18, v * 4, 3) * 0.8);
    let c = mix(hex("#e7b871"), hex("#c98a3e"), 0.5 + fbm(u * 30, v * 6, 4) * 1.2);
    c = mix(c, hex("#6b3a17"), smooth(0.35, 0.8, burn) * 0.8);
    if (perlin(u * 700, v * 170) > 0.55) c = mix(c, hex("#f6dfae"), 0.5); // farinha
    return c;
  });
  const crustN = await normalMap(512, 128, (u, v) => 0.5 + fbm(u * 60, v * 12, 4) * 0.8 + perlin(u * 300, v * 60) * 0.2, 3);
  const crustMat = material(doc, "borda", { tex: crustTex, normal: crustN, rough: 0.7 });
  const crust = grid(220, 26, (u, v) => {
    const a = u * TAU, puff = 1 + 0.18 * fbm(Math.cos(a) * 6, Math.sin(a) * 6, 3), q = v * Math.PI; // meia volta (de dentro para fora por cima)
    const rr = inner + crustW * 0.5 - Math.cos(q) * crustW * 0.5 * (1 + 0.1 * puff);
    const yy = Y + Math.sin(q) * 0.017 * puff + 0.002;
    return [Math.cos(a) * rr, yy, Math.sin(a) * rr];
  }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, crust, crustMat));
  // recheio: molho + queijo com bolhas douradas e orégano
  const topTex = await img(2048, 2048, (u, v) => {
    const x = u - 0.5, z = v - 0.5, r = Math.hypot(x, z) * 2;
    const cheese = fbm(u * 14, v * 14, 5) + perlin(u * 60, v * 60) * 0.3;
    let c = mix(hex("#fbe6a2"), hex("#f2c766"), 0.5 + cheese * 1.2);
    const sauce = smooth(0.12, 0.35, -fbm(u * 9 + 3, v * 9, 4) + (r - 0.75) * 1.2);
    c = mix(c, mix(hex("#c2381f"), hex("#8f2210"), 0.5 + fbm(u * 30, v * 30, 3)), sauce);
    const blister = smooth(0.32, 0.5, perlin(u * 38, v * 38) + fbm(u * 6, v * 6, 2) * 0.4);
    c = mix(c, hex("#c88a36"), blister * 0.7);
    c = mix(c, hex("#7c4a1c"), smooth(0.48, 0.62, perlin(u * 38, v * 38)) * 0.6);
    if (perlin(u * 900, v * 900) > 0.62) c = mix(c, hex("#3f5a1f"), 0.8); // orégano
    return c;
  });
  const topN = await normalMap(1024, 1024, (u, v) => 0.5 + perlin(u * 38, v * 38) * 0.6 + fbm(u * 14, v * 14, 4) * 0.4, 2.5);
  const topMat = material(doc, "queijo", { tex: topTex, normal: topN, rough: 0.42 });
  mesh.addPrimitive(prim(doc, buf, disc(0, Y + 0.004, 0, inner + 0.003, (x, z) => 0.0018 * fbm(x * 40, z * 40, 3) + 0.0015 * Math.max(0, perlin(x * 70, z * 70)), 160, 30), topMat));
  // calabresa
  const calTex = await img(256, 256, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; let c = mix(hex("#c0422f"), hex("#8c2418"), 0.5 + fbm(u * 8, v * 8, 3)); if (perlin(u * 40, v * 40) > 0.35) c = mix(c, hex("#f0c9a8"), 0.7); if (r > 0.86) c = mix(c, hex("#5e170d"), 0.8); return c; });
  const calMat = material(doc, "calabresa", { tex: calTex, rough: 0.35 });
  let k = 0;
  for (let ring = 0; ring < 3; ring++) {
    const n = [1, 6, 11][ring], rr = [0, 0.065, 0.128][ring];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.4 + (k++ % 3) * 0.05; const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
      const rad = 0.019 + (k % 3) * 0.0015;
      mesh.addPrimitive(prim(doc, buf, disc(cx, Y + 0.0068, cz, rad, (x, z, v) => 0.0024 * (1 - v) * (1 - v) - 0.001 + 0.0006 * Math.sin(x * 300), 36, 5), calMat));
    }
  }
  // cebola e azeitona
  const onionMat = material(doc, "cebola", { color: [0.95, 0.9, 0.95, 1], rough: 0.25 });
  const oliveMat = material(doc, "azeitona", { color: [0.08, 0.07, 0.06, 1], rough: 0.2 });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, rr = 0.03 + (i % 5) * 0.03, cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
    const g = lathe([[0.008, 0], [0.0095, 0.0009], [0.008, 0.0018], [0.0065, 0.0009], [0.008, 0]], 32);
    mesh.addPrimitive(prim(doc, buf, translate(g, cx, Y + 0.0072, cz), onionMat));
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785 + 0.3, rr = 0.1 + (i % 2) * 0.05;
    const g = lathe([[0.0025, 0], [0.0062, 0.0006], [0.0068, 0.0035], [0.0062, 0.0062], [0.0025, 0.0068], [0.0025, 0]], 24);
    mesh.addPrimitive(prim(doc, buf, translate(g, Math.cos(a) * rr, Y + 0.0062, Math.sin(a) * rr), oliveMat));
  }
}
async function pizza() {
  const { doc, buf, mesh } = start("pizza");
  // tábua redonda de madeira com pegador
  const wood = material(doc, "madeira", { tex: await woodTex(), rough: 0.6 });
  const board = lathe([[0.0001, 0.02], [0.205, 0.02], [0.214, 0.017], [0.216, 0.008], [0.212, 0.002], [0.0001, 0]], 128);
  planarUV(board, 0.44);
  mesh.addPrimitive(prim(doc, buf, board, wood));
  await pizzaParts(doc, buf, mesh, 0.19, 0.02);
  scene(doc, mesh, "pizza"); await save(doc, "pizza");
}

// =====================================================================
// FATIA EM CAMADAS (lasanha, brownie): bloco de retângulo arredondado com textura por camada
async function layeredSlice(doc, buf, mesh, { W, D, H, R = 0.006, F = 0.004, Y0 = 0.0085, sideTex, sideN, topTex, topN, topRough = 0.5, sideRough = 0.6, bulge = () => 0, topH = () => 0 }) {
  const outline = roundRect(W, D, R);
  const top0 = 1 - F / H;
  const side = grid(200, 60, (u, v) => {
    const [x, z, nx, nz] = outline(u);
    if (v <= 0.86) { const t = (v / 0.86) * top0; const o = bulge(u, t); return [x + nx * o, Y0 + t * H, z + nz * o]; }
    const q = ((v - 0.86) / 0.14) * (Math.PI / 2); const [xi, zi] = outline(u, F);
    return [x + (xi - x) * (1 - Math.cos(q)), Y0 + H - F + Math.sin(q) * F, z + (zi - z) * (1 - Math.cos(q))];
  }, { wrap: true });
  for (let i = 0; i < side.uv.length; i += 2) side.uv[i + 1] = 1 - Math.min(1, (side.pos[(i / 2) * 3 + 1] - Y0) / H);
  const top = capInside(outline, Y0 + H, F, topH, 128, 14, W * 1.05);
  const sideMat = material(doc, "lado", { tex: sideTex, normal: sideN, rough: sideRough });
  const topMat = material(doc, "topo", { tex: topTex, normal: topN, rough: topRough });
  mesh.addPrimitive(prim(doc, buf, side, sideMat));
  mesh.addPrimitive(prim(doc, buf, top, topMat));
  return { outline };
}

// LASANHA (prato de 26 cm): massa, molho à bolonhesa, bechamel e queijo gratinado
async function lasanha() {
  const { doc, buf, mesh } = start("lasanha");
  const W = 0.1, D = 0.085, H = 0.058;
  // camadas de baixo para cima: massa, molho, bechamel, massa, molho, bechamel, massa, molho, queijo
  const L = [["m", 0.06], ["s", 0.2], ["b", 0.07], ["m", 0.05], ["s", 0.19], ["b", 0.07], ["m", 0.05], ["s", 0.14], ["q", 0.17]];
  const cuts = []; { let acc = 0; for (const [k, h] of L) { cuts.push([k, acc, acc + h]); acc += h; } }
  const kindAt = (u, t) => { const w = fbmWrap(u, t * 4, 10, 3) * 0.03; for (const [k, a, b] of cuts) if (t + w < b) return k; return "q"; };
  const sideTex = await img(2048, 1024, (u, y) => {
    const t = 1 - y, k = kindAt(u, t);
    if (k === "m") return mix(hex("#f2d58c"), hex("#e2b866"), 0.5 + fbmWrap(u, t * 30, 40, 3));
    if (k === "s") { let c = mix(hex("#9c2c14"), hex("#6a1a0a"), 0.5 + fbmWrap(u, t * 40, 60, 3) * 1.4); if (perlin(u * 500, t * 100) > 0.3) c = mix(c, hex("#4a2414"), 0.6); if (perlin(u * 900 + 5, t * 190) > 0.55) c = mix(c, hex("#d8562e"), 0.5); return c; }
    if (k === "b") return mix(hex("#f7eedc"), hex("#e9d9b8"), 0.5 + fbmWrap(u, t * 20, 30, 3));
    let c = mix(hex("#f6cf6e"), hex("#e2a540"), 0.5 + fbmWrap(u, t * 30, 50, 4) * 1.3); if (t > 0.94) c = mix(c, hex("#9a5a22"), smooth(0.94, 1, t) * 0.7); return c;
  });
  const sideN = await normalMap(1024, 512, (u, y) => { const t = 1 - y, k = kindAt(u, t); return k === "s" ? 0.5 + perlin(u * 500, t * 100) * 0.8 : k === "q" ? 0.5 + fbmWrap(u, t * 30, 50, 3) * 0.6 : 0.5 + fbmWrap(u, t * 20, 30, 2) * 0.2; }, 3);
  const topTex = await img(1024, 1024, (u, v) => {
    const b = perlin(u * 26, v * 26) + fbm(u * 5, v * 5, 3) * 0.6;
    let c = mix(hex("#f8d77c"), hex("#eab04a"), 0.5 + fbm(u * 12, v * 12, 4));
    c = mix(c, hex("#b86f28"), smooth(0.15, 0.45, b) * 0.85); c = mix(c, hex("#5c3010"), smooth(0.45, 0.7, b) * 0.7);
    if (fbm(u * 8 + 9, v * 8, 3) > 0.32) c = mix(c, hex("#a22c12"), 0.75); // molho aparecendo
    if (perlin(u * 700, v * 700) > 0.6) c = mix(c, hex("#3e5a1d"), 0.8);
    return c;
  });
  const topN = await normalMap(512, 512, (u, v) => 0.5 + perlin(u * 26, v * 26) * 0.7 + fbm(u * 12, v * 12, 3) * 0.3, 3);
  await layeredSlice(doc, buf, mesh, {
    W, D, H, sideTex, sideN, topTex, topN, topRough: 0.38, sideRough: 0.55,
    bulge: (u, t) => { const k = kindAt(u, t); return k === "s" ? 0.0012 * (1 + fbmWrap(u, t * 9, 20, 2)) : k === "q" ? 0.0006 : k === "b" ? 0.0007 : -0.0003; },
    topH: (x, z) => 0.0025 * Math.max(0, perlin(x * 60, z * 60)) + 0.001 * fbm(x * 30, z * 30, 3),
  });
  // molho escorrido no prato e manjericão
  const sauceTex = await img(256, 256, (u, v) => mix(hex("#a22c12"), hex("#6a1a0a"), 0.5 + fbm(u * 8, v * 8, 3)));
  const sauceMat = material(doc, "molho", { tex: sauceTex, rough: 0.2 });
  const pool = grid(96, 5, (u, v) => { const a = u * TAU; const r = 0.05 + v * (0.012 + 0.018 * Math.max(0, Math.sin(a * 3 + 1) * Math.sin(a * 2))); return [0.006 + Math.cos(a) * r * 1.15, 0.0088 + (1 - v) * 0.0012, Math.sin(a) * r]; }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, pool, sauceMat));
  const leafMat = material(doc, "manjericao", { tex: await leafTex(), rough: 0.55 }); leafMat.setDoubleSided(true);
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.01, 0.0085 + H + 0.003, -0.006, 0.032, 0.012, -0.4, 0.15), leafMat));
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.01, 0.0085 + H + 0.0035, -0.006, 0.026, 0.01, 0.9, 0.3), leafMat));
  mesh.addPrimitive(prim(doc, buf, plateGeo(0.13), ceramic(doc)));
  scene(doc, mesh, "lasanha"); await save(doc, "lasanha");
}

// BROWNIE com bola de sorvete e calda de chocolate
async function brownie() {
  const { doc, buf, mesh } = start("brownie");
  const W = 0.075, D = 0.07, H = 0.038, Y0 = 0.0085;
  const sideTex = await img(1024, 512, (u, y) => { const t = 1 - y; let c = mix(hex("#3e2112"), hex("#24120a"), 0.5 + fbmWrap(u, t * 6, 20, 4) * 1.3); if (perlin(u * 600, t * 120) > 0.4) c = mix(c, hex("#5a3420"), 0.6); if (t > 0.9) c = mix(c, hex("#2b160c"), 0.5); if (perlin(u * 90, t * 20) > 0.55) c = mix(c, hex("#120804"), 0.8); return c; });
  const sideN = await normalMap(512, 256, (u, y) => 0.5 + perlin(u * 600, (1 - y) * 120) * 0.8 + fbmWrap(u, (1 - y) * 6, 20, 3) * 0.4, 3);
  const topTex = await img(1024, 1024, (u, v) => { const crack = Math.abs(perlin(u * 12, v * 12)) < 0.04 || Math.abs(perlin(u * 25 + 4, v * 25)) < 0.03; let c = mix(hex("#4a2a17"), hex("#2e180c"), 0.5 + fbm(u * 10, v * 10, 4)); if (perlin(u * 300, v * 300) > 0.4) c = mix(c, hex("#6b4329"), 0.35); return crack ? mix(c, hex("#160a04"), 0.8) : c; });
  const topN = await normalMap(512, 512, (u, v) => 0.5 - (Math.abs(perlin(u * 12, v * 12)) < 0.05 ? 0.6 : 0) + fbm(u * 10, v * 10, 3) * 0.4, 3);
  await layeredSlice(doc, buf, mesh, { W, D, H, R: 0.004, F: 0.003, sideTex, sideN, topTex, topN, topRough: 0.55, sideRough: 0.8, bulge: (u, t) => 0.0004 * fbmWrap(u, t * 5, 18, 2), topH: (x, z) => 0.0012 * fbm(x * 40, z * 40, 3) });
  // sorvete de creme (bola com textura raspada)
  const iceTex = await img(1024, 512, (u, v) => mix(hex("#fbf3dc"), hex("#efe0b8"), 0.5 + fbmWrap(u, v * 6, 12, 4)));
  const iceN = await normalMap(512, 256, (u, v) => 0.5 + fbmWrap(u, v * 14, 30, 4) * 0.9 + Math.abs(perlin(u * 40, v * 20)) * -0.4, 4);
  const iceMat = material(doc, "sorvete", { tex: iceTex, normal: iceN, rough: 0.55 }); iceMat.setDoubleSided(true);
  const sy = Y0 + H, sr = 0.026;
  const scoop = grid(64, 32, (u, v) => { const a = u * TAU, b = v * Math.PI; const bump = 1 + 0.06 * fbm(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + b * 2, 3) + (b > 2.3 ? 0.12 * Math.sin((b - 2.3) * 4) * (1 + 0.6 * Math.sin(a * 9)) : 0); const r = sr * bump; return [Math.cos(a) * Math.sin(b) * r, sy + 0.019 - Math.cos(b) * r * 0.88, Math.sin(a) * Math.sin(b) * r]; }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, scoop, iceMat));
  // calda de chocolate por cima do sorvete, escorrendo
  const choc = material(doc, "calda-chocolate", { color: [0.17, 0.08, 0.04, 1], rough: 0.1 }); choc.setDoubleSided(true);
  const drip = (a) => Math.pow(Math.max(0, Math.sin(a * 5 + 0.8) * Math.sin(a * 2 + 0.3)), 1.4);
  const capG = grid(96, 22, (u, v) => { const a = u * TAU; const reach = 0.22 + 0.3 * drip(a); const b = v * Math.PI * reach; const bump = 1.06 + 0.06 * fbm(Math.cos(a) * 3 + 9, Math.sin(a) * 3 + b * 2, 3); const r = sr * bump + 0.0018; return [Math.cos(a) * Math.sin(b) * r, sy + 0.02 + Math.cos(b) * r * 0.88, Math.sin(a) * Math.sin(b) * r]; }, { wrap: true });
  mesh.addPrimitive(prim(doc, buf, capG, choc));
  // fios de calda no prato
  for (let i = 0; i < 3; i++) { const g = grid(80, 6, (u, v) => { const a = u * TAU; const r = 0.062 + i * 0.009; const w = 0.0016 + 0.0012 * Math.sin(u * 30 + i); return [Math.cos(a) * (r + (v - 0.5) * w * 2), 0.0089 + Math.sin(v * Math.PI) * 0.0008, Math.sin(a) * (r + (v - 0.5) * w * 2)]; }, { wrap: true, flip: true }); mesh.addPrimitive(prim(doc, buf, g, choc)); }
  const leafMat = material(doc, "hortela", { tex: await leafTex(), rough: 0.55 }); leafMat.setDoubleSided(true);
  mesh.addPrimitive(prim(doc, buf, leafGeo(-0.004, sy + 0.043, 0.002, 0.022, 0.0065, 2.2, 0.4), leafMat));
  mesh.addPrimitive(prim(doc, buf, plateGeo(0.1), ceramic(doc)));
  scene(doc, mesh, "brownie"); await save(doc, "brownie");
}

// PUDIM DE LEITE (20 cm) com furo no meio e calda de caramelo
async function pudim() {
  const { doc, buf, mesh } = start("pudim");
  const Y0 = 0.0085, Ro = 0.092, Rt = 0.082, Ri = 0.022, H = 0.06;
  const body = [[Ri, Y0 + H - 0.004], [Ri + 0.001, Y0 + 0.01], [Ri + 0.006, Y0], [Ro - 0.004, Y0], [Ro, Y0 + 0.004], [lerp(Ro, Rt, 0.5) + 0.002, Y0 + H * 0.5], [Rt + 0.002, Y0 + H - 0.006], [Rt - 0.004, Y0 + H], [Ri + 0.005, Y0 + H], [Ri, Y0 + H - 0.004]];
  const bodyTex = await img(1024, 512, (u, v) => { let c = mix(hex("#f2c56e"), hex("#e4a94a"), 0.5 + fbmWrap(u, v * 4, 10, 3)); if (perlin(u * 700, v * 200) > 0.5) c = mix(c, hex("#c98a33"), 0.55); return c; });
  const bodyN = await normalMap(512, 256, (u, v) => 0.5 - (perlin(u * 700, v * 200) > 0.5 ? 0.4 : 0) + fbmWrap(u, v * 4, 10, 2) * 0.2, 2);
  const g = lathe(body, 128); mesh.addPrimitive(prim(doc, buf, g, material(doc, "pudim", { tex: bodyTex, normal: bodyN, rough: 0.3 })));
  // calda de caramelo: cobre o topo e escorre pelos lados; poça no prato
  const car = material(doc, "caramelo", { color: [0.55, 0.24, 0.05, 1], rough: 0.05 });
  const drip = (a) => Math.pow(Math.max(0, 0.5 + 0.5 * Math.sin(a * 9 + 0.4) * Math.sin(a * 4 + 1.3)), 1.5);
  const capG = grid(160, 30, (u, v) => {
    const a = u * TAU;
    if (v < 0.5) { const r = lerp(Ri + 0.004, Rt - 0.002, v / 0.5); return [Math.cos(a) * r, Y0 + H + 0.0018, Math.sin(a) * r]; }
    const w = (v - 0.5) / 0.5, reach = 0.15 + 0.7 * drip(a); const t = 1 - w * reach;
    const r = lerp(Ro, Rt + 0.002, Math.max(0, (t * H - H * 0.5) / (H * 0.5))) * (t < 0.5 ? 1 : 1) + 0.0016;
    const rr = t > 0.95 ? Rt + 0.0016 : lerp(Ro + 0.0016, Rt + 0.0036, t);
    return [Math.cos(a) * rr, Y0 + t * H, Math.sin(a) * rr];
  }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, capG, car));
  const pool = grid(128, 5, (u, v) => { const a = u * TAU; const r = Ro + v * (0.008 + 0.012 * drip(a + 0.2)); return [Math.cos(a) * r, 0.0088 + (1 - v) * 0.001, Math.sin(a) * r]; }, { wrap: true, flip: true });
  mesh.addPrimitive(prim(doc, buf, pool, car));
  mesh.addPrimitive(prim(doc, buf, plateGeo(0.13), ceramic(doc)));
  scene(doc, mesh, "pudim"); await save(doc, "pudim");
}

// SHAWARMA: enrolado cortado ao meio mostrando o recheio, metade no papel
async function shawarma() {
  const { doc, buf, mesh } = start("shawarma");
  const r = 0.028, len = 0.11, Y = 0.0085;
  const wrapTex = await img(1024, 512, (u, v) => { let c = mix(hex("#f1d39a"), hex("#ddb26a"), 0.5 + fbm(u * 10, v * 6, 4) * 1.2); const mark = Math.abs(((u * 6 + v * 0.8) % 1) - 0.5) < 0.05 && perlin(u * 20, v * 20) > -0.2; if (mark) c = mix(c, hex("#6e3c16"), 0.7); if (perlin(u * 120, v * 60) > 0.45) c = mix(c, hex("#a46a2c"), 0.6); return c; });
  const wrapN = await normalMap(512, 256, (u, v) => 0.5 + fbm(u * 30, v * 15, 4) * 0.6, 2);
  const wrapMat = material(doc, "pao-sirio", { tex: wrapTex, normal: wrapN, rough: 0.75 });
  // corte: espiral do pão, carne, alface, tomate, molho branco
  const cutTex = await img(1024, 1024, (u, v) => {
    const x = (u - 0.5) * 2.2, y = (v - 0.5) * 2.2, rr = Math.hypot(x, y), a = Math.atan2(y, x);
    if (rr > 0.9) return mix(hex("#e7c27f"), hex("#c79446"), 0.5 + perlin(u * 40, v * 40));
    const spiral = Math.abs(((rr * 3 + a / TAU) % 1) - 0.5) < 0.04 && rr > 0.55;
    if (spiral) return hex("#e9c886");
    const n = fbm(u * 12, v * 12, 3), m = perlin(u * 18 + 3, v * 18);
    if (m > 0.32) return mix(hex("#5aa83f"), hex("#2f7a26"), perlin(u * 60, v * 60) + 0.5); // alface
    if (m < -0.36) return mix(hex("#e0442c"), hex("#b72515"), perlin(u * 40, v * 40) + 0.5); // tomate
    if (n > 0.22) return mix(hex("#f6f1e4"), hex("#e8dfc7"), perlin(u * 50, v * 50) + 0.5); // molho de alho
    let c = mix(hex("#9c5a2c"), hex("#5f2f12"), 0.5 + perlin(u * 70, v * 30) * 1.2); // carne em tiras
    if (perlin(u * 90, v * 220) > 0.4) c = mix(c, hex("#c98a4f"), 0.5);
    return c;
  });
  const cutN = await normalMap(512, 512, (u, v) => 0.5 + perlin(u * 70, v * 30) * 0.6 + fbm(u * 12, v * 12, 3) * 0.4, 3);
  const cutMat = material(doc, "recheio", { tex: cutTex, normal: cutN, rough: 0.5 });
  const paperTex = await img(512, 512, (u, v) => { let c = mix(hex("#f5efe2"), hex("#e7ddc8"), 0.5 + fbm(u * 8, v * 8, 3) * 0.6); if (Math.abs(((u * 10) % 1) - 0.5) < 0.12) c = mix(c, hex("#c8452c"), 0.85); return c; });
  const paperMat = material(doc, "papel", { tex: paperTex, rough: 0.9 }); paperMat.setDoubleSided(true);
  const bump = (u, v) => 0.0018 * fbm(u * 8, v * 4, 3) + 0.0012 * Math.sin(u * TAU * 3 + v * 6);
  for (const [dx, dz, ang, paper] of [[-0.03, 0.022, 0.35, true], [0.035, -0.02, -0.25, false]]) {
    const c = lyingCylinder(len, r, bump);
    for (const part of [c.body, c.capL, c.capR]) { rotY(part, ang); translate(part, dx, Y, dz); }
    mesh.addPrimitive(prim(doc, buf, c.body, wrapMat));
    mesh.addPrimitive(prim(doc, buf, c.capL, wrapMat));
    mesh.addPrimitive(prim(doc, buf, c.capR, cutMat));
    if (paper) {
      const pg = grid(48, 10, (u, v) => { const a = (u * 0.75 + 0.62) * TAU, rr = r + 0.0035; return [(v - 0.5) * len * 0.55 - len * 0.22, Math.sin(a) * rr + r, Math.cos(a) * rr]; });
      rotY(pg, ang); translate(pg, dx, Y, dz);
      mesh.addPrimitive(prim(doc, buf, pg, paperMat));
    }
  }
  // molho de alho num potinho e tábua
  const wood = material(doc, "tabua", { tex: await woodTex(true), rough: 0.6 });
  const board = roundRect(0.3, 0.2, 0.02);
  const top = capInside(board, Y, 0.0005, () => 0, 96, 6, 0.3);
  const side = grid(96, 2, (u, v) => { const [x, z] = board(u); return [x, v * Y, z]; }, { wrap: true });
  mesh.addPrimitive(prim(doc, buf, top, wood)); mesh.addPrimitive(prim(doc, buf, side, wood));
  const pot = lathe([[0.0001, Y], [0.022, Y], [0.026, Y + 0.022], [0.028, Y + 0.024], [0.024, Y + 0.022], [0.0001, Y + 0.018]], 64);
  translate(pot, 0.1, 0, 0.06); mesh.addPrimitive(prim(doc, buf, pot, ceramic(doc)));
  const sauce = material(doc, "molho-alho", { color: [0.97, 0.95, 0.88, 1], rough: 0.3 });
  mesh.addPrimitive(prim(doc, buf, disc(0.1, Y + 0.0185, 0.06, 0.023, (x, z) => 0.0015 * fbm(x * 90, z * 90, 2)), sauce));
  scene(doc, mesh, "shawarma"); await save(doc, "shawarma");
}

// AÇAÍ NO COPO (500 ml) — copo transparente, açaí em camadas com banana, granola, morango e leite condensado.
// Animação: o açaí sobe até encher o copo e depois os acompanhamentos caem por cima.
async function acai(name = "acai", animate = true) {
  const { doc, buf, mesh } = start(name);
  const Rb = 0.0325, Rt = 0.0475, H = 0.0983, T = 0.0012; // copo de 500 ml
  const rAt = (y) => lerp(Rb, Rt, y / H);
  // copo
  const cupMat = material(doc, "copo", { color: [1, 1, 1, 0.1], rough: 0.04, alpha: "BLEND" });
  cupMat.setDoubleSided(true);
  const cup = lathe([[0.0001, 0], [Rb, 0], [Rt, H], [Rt + 0.0018, H + 0.0012], [Rt + 0.0008, H + 0.0024], [Rt - T, H], [Rb - T, T], [0.0001, T]], 96);
  const cupMesh = doc.createMesh("copo").addPrimitive(prim(doc, buf, cup, cupMat));
  // açaí (cresce de baixo para cima na animação)
  const acaiTex = await img(1024, 512, (u, v) => { let c = mix(hex("#3d1240"), hex("#1e0820"), 0.5 + fbmWrap(u, v * 4, 9, 4) * 1.2); if (perlin(u * 160, v * 80) > 0.4) c = mix(c, hex("#5a2660"), 0.45); return c; });
  const acaiN = await normalMap(512, 256, (u, v) => 0.5 + fbmWrap(u, v * 8, 18, 3) * 0.5, 2);
  const acaiMat = material(doc, "acai", { tex: acaiTex, normal: acaiN, rough: 0.18 });
  const fillH = H * 0.86;
  const prof = [[0.0001, 0.0015]]; for (let i = 0; i <= 10; i++) { const y = 0.0015 + (i / 10) * (fillH - 0.0015); prof.push([rAt(y) - T - 0.0004, y]); }
  for (let i = 1; i <= 8; i++) { const q = i / 8; prof.push([(rAt(fillH) - T - 0.0004) * (1 - q), fillH + Math.sin(q * Math.PI / 2) * 0.009 * (1 - q * 0.3)]); }
  const acaiG = lathe(prof, 96);
  for (let i = 0; i < acaiG.pos.length; i += 3) if (acaiG.pos[i + 1] > fillH) acaiG.pos[i + 1] += 0.0015 * fbm(acaiG.pos[i] * 80, acaiG.pos[i + 2] * 80, 2);
  const acaiMesh = doc.createMesh("acai").addPrimitive(prim(doc, buf, acaiG, acaiMat));
  // camada de leite em pó/banana visível no meio (anel claro dentro do copo)
  const bandTex = await img(512, 128, (u, v) => mix(hex("#f3e9cf"), hex("#e2cf9c"), 0.5 + fbmWrap(u, v * 2, 20, 3)));
  const bandMat = material(doc, "creme", { tex: bandTex, rough: 0.5 });
  const y1 = fillH * 0.47, y2 = fillH * 0.51;
  const band = grid(96, 4, (u, v) => { const a = u * TAU, y = lerp(y1, y2, v) + 0.0015 * Math.sin(a * 3 + v); const rr = rAt(y) - T - 0.0002; return [Math.cos(a) * rr, y, Math.sin(a) * rr]; }, { wrap: true });
  acaiMesh.addPrimitive(prim(doc, buf, band, bandMat));
  // acompanhamentos por cima
  const top = doc.createMesh("acompanhamentos");
  const ty = fillH + 0.004;
  const banTex = await img(256, 256, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; let c = mix(hex("#fbf0c4"), hex("#efd98c"), r); if (r < 0.25 && perlin(u * 60, v * 60) > 0.1) c = mix(c, hex("#7a5a2a"), 0.6); if (r > 0.9) c = hex("#d9c06a"); return c; });
  const banMat = material(doc, "banana", { tex: banTex, rough: 0.45 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, rr = 0.022 + (i % 2) * 0.006; top.addPrimitive(prim(doc, buf, disc(Math.cos(a) * rr, ty + 0.002 - rr * 0.08, Math.sin(a) * rr, 0.0115, (x, z, v) => 0.004 * Math.sin(v * Math.PI / 2) * 0 + 0.0012 * (1 - v)), banMat)); }
  const granTex = await img(256, 256, (u, v) => mix(hex("#c8914a"), hex("#7c4f22"), 0.5 + perlin(u * 30, v * 30) + fbm(u * 6, v * 6, 2)));
  const granMat = material(doc, "granola", { tex: granTex, rough: 0.8 });
  for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = 0.004 + ((i * 37) % 17) / 17 * 0.016; top.addPrimitive(prim(doc, buf, ellipsoid(Math.cos(a) * rr, ty + 0.004, Math.sin(a) * rr, 0.0038, 0.0022, 0.003, i, 8), granMat)); }
  const morTex = await img(256, 256, (u, v) => { let c = mix(hex("#e0283c"), hex("#a3101f"), v + perlin(u * 8, v * 8) * 0.3); if (perlin(u * 50, v * 50) > 0.45) c = hex("#f2d34b"); return c; });
  const morMat = material(doc, "morango", { tex: morTex, rough: 0.25 });
  top.addPrimitive(prim(doc, buf, ellipsoid(-0.012, ty + 0.009, -0.006, 0.011, 0.013, 0.01, 0.5, 18), morMat));
  top.addPrimitive(prim(doc, buf, ellipsoid(0.014, ty + 0.007, 0.01, 0.0095, 0.011, 0.0085, 2, 18), morMat));
  const milk = material(doc, "leite-condensado", { color: [0.98, 0.95, 0.86, 1], rough: 0.12 });
  for (let i = 0; i < 3; i++) { const g = grid(64, 5, (u, v) => { const a = u * TAU; const r = 0.008 + i * 0.009; const w = 0.0011; return [Math.cos(a) * (r + (v - 0.5) * w * 2), ty + 0.0035 + 0.0016 * Math.sin(v * Math.PI) + 0.002 * Math.sin(a * 3 + i), Math.sin(a) * (r + (v - 0.5) * w * 2)]; }, { wrap: true, flip: true }); top.addPrimitive(prim(doc, buf, g, milk)); }
  const leafMat = material(doc, "hortela", { tex: await leafTex(), rough: 0.55 }); leafMat.setDoubleSided(true);
  top.addPrimitive(prim(doc, buf, leafGeo(0.004, ty + 0.012, -0.004, 0.022, 0.007, 1.9, 0.5), leafMat));

  const root = doc.createNode(name);
  const nCup = doc.createNode("copo").setMesh(cupMesh);
  const nAcai = doc.createNode("acai").setMesh(acaiMesh);
  const nTop = doc.createNode("acompanhamentos").setMesh(top);
  root.addChild(nCup).addChild(nAcai).addChild(nTop);
  doc.createScene("Scene").addChild(root);
  if (animate) {
    const t = (arr) => doc.createAccessor().setType("SCALAR").setArray(new Float32Array(arr)).setBuffer(buf);
    const v3 = (arr) => doc.createAccessor().setType("VEC3").setArray(new Float32Array(arr)).setBuffer(buf);
    const anim = doc.createAnimation("encher");
    const s1 = doc.createAnimationSampler().setInput(t([0, 0.3, 2.0, 4.5])).setOutput(v3([1, 0.02, 1, 1, 0.02, 1, 1, 1, 1, 1, 1, 1])).setInterpolation("LINEAR");
    const s2 = doc.createAnimationSampler().setInput(t([0, 2.0, 2.6, 2.75, 4.5])).setOutput(v3([0.001, 0.001, 0.001, 0.001, 0.001, 0.001, 1.08, 1.08, 1.08, 1, 1, 1, 1, 1, 1])).setInterpolation("LINEAR");
    anim.addSampler(s1).addSampler(s2)
      .addChannel(doc.createAnimationChannel().setTargetNode(nAcai).setTargetPath("scale").setSampler(s1))
      .addChannel(doc.createAnimationChannel().setTargetNode(nTop).setTargetPath("scale").setSampler(s2));
    // os acompanhamentos crescem a partir do topo do açaí
    nTop.setTranslation([0, 0, 0]);
  }
  await save(doc, name);
}

// =====================================================================
// MODELO PRONTO: PIZZA NA CAIXA (40 × 40 × 4,5 cm; o painel ajusta para a caixa do restaurante)
async function pizzaCaixa() {
  const { doc, buf, mesh } = start("pizza-caixa");
  const S = 0.4, Hb = 0.045, t = 0.003;
  const kraft = await img(1024, 1024, (u, v) => { let c = mix(hex("#c79a62"), hex("#b0834d"), 0.5 + fbm(u * 6, v * 6, 4) * 0.8); if (perlin(u * 900, v * 5) > 0.45) c = mix(c, hex("#9c7140"), 0.25); return c; });
  const inside = await img(512, 512, (u, v) => mix(hex("#e8d8b8"), hex("#d6c094"), 0.5 + fbm(u * 6, v * 6, 3) * 0.7));
  const outMat = material(doc, "papelao", { tex: kraft, rough: 0.9 });
  const inMat = material(doc, "papelao-dentro", { tex: inside, rough: 0.95 });
  const box = (x0, x1, y0, y1, z0, z1, m) => { // caixa simples com 6 faces
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const F = [[0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 4, 7, 3, [-1, 0, 0]], [1, 2, 6, 5, [1, 0, 0]], [3, 7, 6, 2, [0, 1, 0]], [0, 1, 5, 4, [0, -1, 0]]];
    const g = { pos: [], nor: [], uv: [], idx: [] };
    for (const [a, b, c, d, n] of F) { const o = g.pos.length / 3; for (const k of [a, b, c, d]) { g.pos.push(...P[k]); g.nor.push(...n); } g.uv.push(0, 0, 1, 0, 1, 1, 0, 1); g.idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    planarUV(g, S); mesh.addPrimitive(prim(doc, buf, g, m));
  };
  const h = S / 2;
  box(-h, h, 0, t, -h, h, inMat); // fundo
  box(-h, h, 0, Hb, -h, -h + t, outMat); box(-h, h, 0, Hb, h - t, h, outMat); box(-h, -h + t, 0, Hb, -h, h, outMat); box(h - t, h, 0, Hb, -h, h, outMat);
  // sem a tampa: assim a medida mostrada é a da caixa (largura × comprimento × altura)
  await pizzaParts(doc, buf, mesh, 0.19 * (S - 0.014) / 0.4 + 0.0, t);
  scene(doc, mesh, "pizza-caixa"); await save(doc, "pizza-caixa");
}

// MODELO PRONTO: MARMITA (embalagem de alumínio 20 × 14 × 5 cm com arroz, feijão, carne e salada)
async function marmita() {
  const { doc, buf, mesh } = start("marmita");
  const W = 0.2, D = 0.14, H = 0.05, Rb = 0.012, inset = 0.014;
  const outer = roundRect(W, D, Rb), bottom = roundRect(W - 2 * inset, D - 2 * inset, Rb * 0.6);
  const alu = await img(512, 512, (u, v) => { const ridge = Math.sin(v * 160) * 0.5 + 0.5; return mix(hex("#d9dde2"), hex("#aab1ba"), ridge * 0.35 + fbm(u * 10, v * 10, 3) * 0.6); });
  const aluMat = material(doc, "aluminio", { tex: alu, rough: 0.32, color: [1, 1, 1, 1] }); aluMat.setMetallicFactor(0.85); aluMat.setDoubleSided(true);
  // parede (do fundo menor até a borda maior) e aba
  const wall = grid(160, 8, (u, v) => { const [xb, zb] = bottom(u); const [xt, zt] = outer(u); return [lerp(xb, xt, v), v * H, lerp(zb, zt, v)]; }, { wrap: true, flip: true });
  for (let i = 0; i < wall.uv.length; i += 2) { wall.uv[i] = (i / 2) % 161 / 160; wall.uv[i + 1] = wall.pos[(i / 2) * 3 + 1] / H; }
  const rim = grid(160, 3, (u, v) => { const [x, z, nx, nz] = outer(u); const o = v * 0.008; return [x + nx * o, H - Math.sin(v * Math.PI) * -0.0012, z + nz * o]; }, { wrap: true, flip: true });
  const floor = capInside(bottom, 0.0006, 0, () => 0, 96, 6, W);
  for (const gg of [wall, rim, floor]) mesh.addPrimitive(prim(doc, buf, gg, aluMat));
  // comida: superfície com relevo; arroz à esquerda, feijão em cima à direita, carne e salada embaixo à direita
  const fy = H * 0.82;
  const region = (x, z) => (x < -0.005 ? "arroz" : z < -0.004 ? "feijao" : x < 0.05 ? "carne" : "salada");
  const foodTex = await img(2048, 1400, (u, v) => {
    const x = (u - 0.5) * W, z = (v - 0.5) * D, k = region(x + fbm(u * 8, v * 8, 2) * 0.006, z + fbm(u * 8 + 4, v * 8, 2) * 0.006);
    if (k === "arroz") { const g = perlin(u * 420, v * 290), g2 = perlin(u * 260 + 7, v * 520); let c = mix(hex("#fffdf6"), hex("#e3dbc6"), 0.5 + g * 0.9); if (Math.abs(g2) < 0.06 || Math.abs(g) < 0.04) c = mix(c, hex("#bfb49a"), 0.7); return c; }
    if (k === "feijao") { const bv = perlin(u * 160, v * 112); const bean = bv > 0.12; return bean ? mix(hex("#4a2416"), hex("#21100a"), (bv - 0.12) * 3 + perlin(u * 40, v * 40) * 0.3) : mix(hex("#2f170e"), hex("#4a2716"), fbm(u * 20, v * 20, 2) + 0.5); }
    if (k === "carne") { let c = mix(hex("#9a5530"), hex("#5a2c12"), 0.5 + perlin(u * 30, v * 160) * 1.2); const sl = ((u * 22 + v * 9) % 1); if (sl < 0.05) c = mix(c, hex("#3a1a0a"), 0.7); if (Math.abs(((u * 14 - v * 30) % 1) - 0.5) < 0.04) c = mix(c, hex("#2a1206"), 0.55); if (perlin(u * 400, v * 280) > 0.5) c = mix(c, hex("#c08b5a"), 0.35); return c; }
    const m = perlin(u * 30, v * 30); return m > 0.38 ? mix(hex("#e5432b"), hex("#b8281a"), perlin(u * 90, v * 90) + 0.5) : mix(hex("#7cc35a"), hex("#3f8a32"), perlin(u * 70, v * 70) + 0.5);
  });
  const foodN = await normalMap(1024, 700, (u, v) => { const x = (u - 0.5) * W, z = (v - 0.5) * D, k = region(x, z); return k === "arroz" ? 0.5 + perlin(u * 420, v * 290) * 0.8 - (Math.abs(perlin(u * 260 + 7, v * 520)) < 0.06 ? 0.3 : 0) : k === "feijao" ? 0.5 + (perlin(u * 150, v * 105) > 0.15 ? 0.4 : -0.2) : 0.5 + perlin(u * 30, v * 90) * 0.5; }, 3);
  const foodMat = material(doc, "comida", { tex: foodTex, normal: foodN, rough: 0.55 });
  const innerAt = (y) => roundRect(lerp(W - 2 * inset, W, y / H) - 0.002, lerp(D - 2 * inset, D, y / H) - 0.002, Rb * 0.7);
  const fo = innerAt(fy);
  const food = capInside(fo, fy, 0, (x, z, k) => { const reg = region(x, z); const mound = (reg === "arroz" ? 0.008 : reg === "carne" ? 0.01 : reg === "salada" ? 0.012 : 0.004) * Math.min(1, (1 - k) * 4); return mound + 0.002 * fbm(x * 60, z * 60, 3); }, 160, 24, W);
  for (let i = 0; i < food.uv.length; i += 2) { const p = (i / 2) * 3; food.uv[i] = 0.5 + food.pos[p] / W; food.uv[i + 1] = 0.5 + food.pos[p + 2] / D; }
  mesh.addPrimitive(prim(doc, buf, food, foodMat));
  scene(doc, mesh, "marmita"); await save(doc, "marmita");
}

const ALL = { pizza, lasanha, brownie, pudim, shawarma, acai: () => acai("acai", true), "pizza-caixa": pizzaCaixa, marmita };
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
for (const n of want) await ALL[n]();
