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

// LASANHA (prato de 26 cm): camadas onduladas que cedem, ragu em pedaços escorrendo, bechamel,
// massa com bordas aparentes e queijo gratinado derretendo pelas bordas
async function lasanha() {
  const { doc, buf, mesh } = start("lasanha");
  const W = 0.1, D = 0.082, H = 0.056;
  const L = [["m", 0.045], ["s", 0.17], ["b", 0.06], ["m", 0.04], ["s", 0.17], ["b", 0.06], ["m", 0.04], ["s", 0.13], ["q", 0.285]];
  const cuts = []; { let acc = 0; for (const [k, h] of L) { cuts.push([k, acc, acc + h]); acc += h; } }
  // fronteiras bem onduladas (a lasanha cede e as camadas não ficam retas)
  const wav = (u, t) => fbmWrap(u, t * 3 + 1.7, 7, 4) * 0.08 + Math.sin(u * TAU * 3 + t * 5) * 0.015 + fbmWrap(u, t * 9, 30, 2) * 0.02;
  const kindAt = (u, t) => { const tt = t + wav(u, t); for (const [k, a, b] of cuts) if (tt < b) return k; return "q"; };
  const drip = (u) => Math.pow(Math.max(0, fbmWrap(u, 3.3, 9, 3) + 0.15), 1.5) * 2.4; // queijo escorrendo
  const sideTex = await img(2048, 1024, (u, y) => {
    const t = 1 - y, k = kindAt(u, t);
    if (k === "m") { let c = mix(hex("#f4dc98"), hex("#e2bb6a"), 0.5 + fbmWrap(u, t * 25, 40, 3)); if (perlin(u * 400, t * 80) > 0.4) c = mix(c, hex("#c99a4a"), 0.4); return c; }
    if (k === "s") {
      const g = Math.abs(perlin(u * 520, t * 110)), g2 = perlin(u * 260 + 3, t * 55);
      let c = mix(hex("#c4421d"), hex("#8e2611"), 0.5 + fbmWrap(u, t * 18, 30, 3) * 1.3);
      if (g < 0.1) c = mix(c, hex("#5a2412"), 0.7); // carne moída
      if (g2 > 0.45) c = mix(c, hex("#6e3018"), 0.6);
      if (perlin(u * 900 + 5, t * 190) > 0.55) c = mix(c, hex("#e0602e"), 0.55); // óleo/tomate
      return c;
    }
    if (k === "b") { let c = mix(hex("#f8efdc"), hex("#ead8b4"), 0.5 + fbmWrap(u, t * 15, 30, 3)); if (fbmWrap(u, t * 9 + 4, 20, 3) > 0.25) c = mix(c, hex("#d97a52"), 0.45); return c; }
    // queijo: dourado, mais escuro em cima, escorrendo pela lateral
    let c = mix(hex("#f7d36e"), hex("#e7a83e"), 0.5 + fbmWrap(u, t * 20, 40, 4) * 1.3);
    const top = smooth(0.86, 1, t); c = mix(c, hex("#b5692a"), top * 0.6);
    if (perlin(u * 300, t * 60) > 0.38) c = mix(c, hex("#8f4c1c"), top * 0.7);
    if (t < 0.83 && t > 0.83 - 0.12 * drip(u)) c = mix(hex("#f2c45a"), hex("#e2a240"), perlin(u * 80, t * 30) + 0.5); // gotas de queijo
    return c;
  });
  const sideN = await normalMap(1024, 512, (u, y) => { const t = 1 - y, k = kindAt(u, t); return k === "s" ? 0.5 - Math.abs(perlin(u * 520, t * 110)) * 1.2 + perlin(u * 260, t * 55) * 0.4 : k === "q" ? 0.5 + fbmWrap(u, t * 20, 40, 3) * 0.7 : k === "m" ? 0.5 + perlin(u * 400, t * 80) * 0.25 : 0.5 + fbmWrap(u, t * 15, 30, 2) * 0.3; }, 4);
  const topTex = await img(1024, 1024, (u, v) => {
    const b = perlin(u * 22, v * 22) + fbm(u * 5, v * 5, 3) * 0.7;
    let c = mix(hex("#f8d77c"), hex("#eab04a"), 0.5 + fbm(u * 12, v * 12, 4));
    c = mix(c, hex("#c07a30"), smooth(0.05, 0.4, b) * 0.85); c = mix(c, hex("#6b3612"), smooth(0.42, 0.75, b) * 0.8);
    if (fbm(u * 7 + 9, v * 7, 3) > 0.34) c = mix(c, hex("#a8341a"), 0.7);
    if (perlin(u * 650, v * 650) > 0.58) c = mix(c, hex("#2f6a1f"), 0.85); // salsinha
    return c;
  });
  const topN = await normalMap(512, 512, (u, v) => 0.5 + perlin(u * 22, v * 22) * 0.9 + fbm(u * 12, v * 12, 3) * 0.4, 3.5);
  await layeredSlice(doc, buf, mesh, {
    W, D, H, R: 0.005, F: 0.006, sideTex, sideN, topTex, topN, topRough: 0.32, sideRough: 0.42,
    bulge: (u, t) => {
      const k = kindAt(u, t), n = fbmWrap(u, t * 12, 26, 3);
      let o = k === "s" ? 0.0026 + 0.0026 * n + 0.0018 * Math.abs(perlin(u * 60, t * 22)) : k === "b" ? 0.0012 + 0.0008 * n : k === "m" ? 0.0018 + 0.0006 * Math.sin(u * 160) : 0.001 + 0.0008 * n;
      if (t > 0.6) o += 0.0016 * drip(u) * smooth(0.6, 0.85, t) * (1 - smooth(0.92, 1, t)); // queijo derretendo
      return o * (0.6 + 0.4 * smooth(0, 0.15, t)); // na base encosta no prato
    },
    topH: (x, z, k) => 0.003 * Math.max(0, perlin(x * 55, z * 55)) + 0.0016 * fbm(x * 30, z * 30, 3) + 0.0025 * Math.min(1, (1 - k) * 3),
  });
  // molho escorrido no prato, em volta da base
  const sauceTex = await img(256, 256, (u, v) => { let c = mix(hex("#a63618"), hex("#6a1a0a"), 0.5 + fbm(u * 8, v * 8, 3)); if (Math.abs(perlin(u * 60, v * 60)) < 0.1) c = mix(c, hex("#3e1a0c"), 0.7); return c; });
  const sauceMat = material(doc, "molho", { tex: sauceTex, rough: 0.18 });
  const out = roundRect(W + 0.004, D + 0.004, 0.008);
  const pool = grid(160, 6, (u, v) => { const [x, z, nx, nz] = out(u); const ext = v * (0.004 + 0.016 * Math.pow(Math.max(0, fbmWrap(u, 7.1, 8, 3) + 0.2), 1.6) * 2); return [x + nx * ext, 0.0088 + (1 - v) * 0.0018, z + nz * ext]; }, { wrap: true, flip: true });
  planarUV(pool, 0.2); mesh.addPrimitive(prim(doc, buf, pool, sauceMat));
  const leafMat = material(doc, "manjericao", { tex: await leafTex(), rough: 0.55 }); leafMat.setDoubleSided(true);
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.012, 0.0085 + H + 0.004, -0.006, 0.034, 0.013, -0.4, 0.12), leafMat));
  mesh.addPrimitive(prim(doc, buf, leafGeo(0.012, 0.0085 + H + 0.0045, -0.006, 0.028, 0.011, 0.9, 0.28), leafMat));
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

// SHAWARMA em pé (como na foto de referência): pão sírio enrolado na diagonal, com a dobra aparente,
// boca aberta na frente mostrando frango, cebola roxa, pepino, repolho e pimentões, sobre uma tábua
function rotZ(g, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1]; g.pos[i] = x * c - y * s; g.pos[i + 1] = x * s + y * c; const nx = g.nor[i], ny = g.nor[i + 1]; g.nor[i] = nx * c - ny * s; g.nor[i + 1] = nx * s + ny * c; } return g; }
function rotX(g, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < g.pos.length; i += 3) { const y = g.pos[i + 1], z = g.pos[i + 2]; g.pos[i + 1] = y * c - z * s; g.pos[i + 2] = y * s + z * c; const ny = g.nor[i + 1], nz = g.nor[i + 2]; g.nor[i + 1] = ny * c - nz * s; g.nor[i + 2] = ny * s + nz * c; } return g; }
/** pedaço irregular (elipsoide com calombos), na origem */
function lump(rx, ry, rz, amp = 0.25, seed = 0, seg = 18) {
  const g = grid(seg, seg / 2, (u, v) => {
    const a = u * TAU, b = v * Math.PI; const k = 1 + amp * fbm(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5 + b + seed * 0.7, 3);
    return [Math.cos(a) * Math.sin(b) * rx * k, -Math.cos(b) * ry * k, Math.sin(a) * Math.sin(b) * rz * k];
  }, { wrap: true, flip: true });
  return g;
}
function torus(R, r, segU = 32, segV = 10) {
  return grid(segU, segV, (u, v) => { const a = u * TAU, b = v * TAU; const rr = R + Math.cos(b) * r; return [Math.cos(a) * rr, Math.sin(b) * r * 0.8, Math.sin(a) * rr]; }, { wrap: true, flip: true });
}
async function shawarma() {
  const { doc, buf, mesh } = start("shawarma");
  const B = 0.022; // altura da tábua
  const H = 0.19, R0 = 0.025, R1 = 0.032; // altura do enrolado, raio embaixo e em cima
  const rAt = (y) => lerp(R0, R1, Math.min(1, y / H));
  const FRONT = Math.PI / 2; // a boca aberta fica virada para +z (de frente para quem olha)
  const lip = (a) => H - 0.034 * Math.pow((1 + Math.cos(a - FRONT)) / 2, 1.6) - 0.004 * Math.sin(a * 3); // borda de cima, mais baixa na frente
  // pão: claro, com manchas tostadas da chapa e farinha
  const wrapTex = await img(1024, 1024, (u, v) => {
    let c = mix(hex("#f6efe1"), hex("#ead9bb"), 0.5 + fbm(u * 6, v * 6, 4));
    const spot = fbm(u * 7, v * 7, 4) + perlin(u * 34, v * 34) * 0.4;
    c = mix(c, hex("#d6a66a"), smooth(0.02, 0.32, spot) * 0.8);
    c = mix(c, hex("#8e5a2c"), smooth(0.3, 0.55, spot) * 0.7);
    if (perlin(u * 260, v * 260) > 0.52) c = mix(c, hex("#fdfaf2"), 0.6);
    return c;
  });
  const wrapN = await normalMap(512, 512, (u, v) => 0.5 + fbm(u * 18, v * 18, 4) * 0.45 + fbm(u * 9, v * 9, 3) * 0.25, 2.5);
  const wrapMat = material(doc, "pao-sirio", { tex: wrapTex, normal: wrapN, rough: 0.85 }); wrapMat.setDoubleSided(true);
  // dobra diagonal: a ponta do pão dá a volta subindo; marca um degrau e uma prega
  // aba de fora: a borda corre na diagonal pela frente (de cima à esquerda para baixo à direita)
  const wrapA = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const edgeA = (y) => FRONT + 1.15 - (y / H) * 2.0; // ângulo da borda em cada altura
  const flapD = (a, y) => wrapA(a - edgeA(y)); // >0: em cima da aba
  const fold = (a, y) => { const d = flapD(a, y); const on = d > 0 && d < 3.3 ? 1 : 0; const lipEdge = d > 0 && d < 0.06 ? 0.0018 * (1 - d / 0.06) : 0; return on * 0.0034 + lipEdge - (d < 0 && d > -0.08 ? 0.0012 * (1 + d / 0.08) : 0); };
  const crease = (a, y) => 0.0009 * Math.exp(-Math.pow(wrapA(a - (FRONT - 1.3 + (y / H) * 1.1)) * 9, 2));
  const body = grid(96, 64, (u, v) => {
    const a = u * TAU;
    if (v < 0.18) { const q = (v / 0.18) * Math.PI / 2; const rr = rAt(0.012) * Math.sin(q); return [Math.cos(a) * rr, B + 0.012 - Math.cos(q) * 0.012, Math.sin(a) * rr]; } // fundo arredondado
    const y = lerp(0.012, lip(a), (v - 0.18) / 0.82);
    const rr = rAt(y) + fold(a, y) - crease(a, y) + 0.0006 * fbm(Math.cos(a) * 4 + y * 30, Math.sin(a) * 4, 3);
    return [Math.cos(a) * rr, B + y, Math.sin(a) * rr];
  }, { wrap: true });
  for (let i = 0; i < body.uv.length; i += 2) { const p = (i / 2) * 3; body.uv[i] = ((i / 2) % 97) / 96; body.uv[i + 1] = (body.pos[p + 1] - B) / (H * 1.1); }
  mesh.addPrimitive(prim(doc, buf, body, wrapMat));
  // parede de dentro (mostra a espessura do pão na boca)
  const inner = grid(96, 6, (u, v) => { const a = u * TAU; const y = lip(a) - v * 0.03; const rr = rAt(y) - 0.0025; return [Math.cos(a) * rr, B + y, Math.sin(a) * rr]; }, { wrap: true });
  for (let i = 0; i < inner.uv.length; i += 2) { inner.uv[i] = ((i / 2) % 97) / 96 * 0.3; inner.uv[i + 1] = 0.9; }
  mesh.addPrimitive(prim(doc, buf, inner, wrapMat));
  const lipRing = grid(96, 2, (u, v) => { const a = u * TAU; const y = lip(a); const rr = rAt(y) + fold(a, y) - v * 0.0028; return [Math.cos(a) * rr, B + y + Math.sin(v * Math.PI) * 0.0008, Math.sin(a) * rr]; }, { wrap: true });
  mesh.addPrimitive(prim(doc, buf, lipRing, wrapMat));

  // recheio
  const yTop = B + H - 0.03; // base do monte de recheio
  const fillBase = disc(0, yTop, 0, R1 - 0.002, (x, z) => 0.006 * fbm(x * 60, z * 60, 2) + 0.004, 40, 6);
  const baseTex = await img(256, 256, (u, v) => mix(hex("#e9efd0"), hex("#b8d38c"), 0.5 + fbm(u * 8, v * 8, 3)));
  mesh.addPrimitive(prim(doc, buf, fillBase, material(doc, "recheio-base", { tex: baseTex, rough: 0.6 })));
  const chickTex = await img(256, 256, (u, v) => { let c = mix(hex("#dca06a"), hex("#a8642e"), 0.5 + fbm(u * 5, v * 5, 3) * 1.2); c = mix(c, hex("#7a3e16"), smooth(0.15, 0.45, perlin(u * 9, v * 9)) * 0.7); if (perlin(u * 60, v * 60) > 0.45) c = mix(c, hex("#f2d7b0"), 0.5); return c; });
  const chickN = await normalMap(256, 256, (u, v) => 0.5 + fbm(u * 12, v * 12, 3) * 0.7, 3);
  const chick = material(doc, "frango", { tex: chickTex, rough: 0.6 });
  const onion = material(doc, "cebola-roxa", { tex: await img(128, 64, (u, v) => mix(hex("#a3285e"), hex("#f2dbe6"), smooth(0.2, 0.8, Math.abs(Math.sin(v * Math.PI * 2))))), rough: 0.25 });
  const cucTex = await img(256, 128, (u, v) => { const skin = Math.abs(Math.sin(u * Math.PI * 2)) > 0.72; return skin ? mix(hex("#3f7a2a"), hex("#25561b"), perlin(u * 30, v * 30) + 0.5) : mix(hex("#e8f2c8"), hex("#c7e09a"), perlin(u * 20, v * 40) + 0.5); });
  const cuc = material(doc, "pepino", { tex: cucTex, rough: 0.3 });
  const cabTex = await img(256, 256, (u, v) => { const vein = Math.abs(((u * 5 + v * 1.5) % 1) - 0.5) < 0.05; const c = mix(hex("#f3f6dc"), hex("#c9e39a"), 0.5 + fbm(u * 6, v * 6, 3)); return vein ? mix(c, hex("#ffffff"), 0.6) : c; });
  const cab = material(doc, "repolho", { tex: cabTex, rough: 0.5 }); cab.setDoubleSided(true);
  const red = material(doc, "pimentao-vermelho", { color: [0.72, 0.05, 0.03, 1], rough: 0.32 });
  const yel = material(doc, "pimentao-amarelo", { color: [0.95, 0.62, 0.05, 1], rough: 0.32 });
  const put = (g, m, tz, ty, cx, cy, cz) => { rotZ(g, tz); rotY(g, ty); translate(g, cx, cy, cz); mesh.addPrimitive(prim(doc, buf, g, m)); };
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const inDisc = (rmax) => { const a = rnd() * TAU, r = Math.sqrt(rnd()) * rmax; return [Math.cos(a) * r, Math.sin(a) * r * 0.9 + 0.003]; };
  // repolho (folhas onduladas saindo para cima, mais atrás)
  for (let i = 0; i < 9; i++) {
    const [x, z] = inDisc(0.022); const g = grid(14, 8, (u, v) => { const w = 0.009 + 0.004 * rnd(); const xx = (u - 0.5) * w * 2, yy = v * (0.022 + 0.01 * rnd()); return [xx, yy, 0.004 * Math.sin(u * 9 + i) + 0.006 * v * v]; });
    put(g, cab, (rnd() - 0.5) * 0.6, rnd() * TAU, x, yTop + 0.002, z - 0.006);
  }
  // frango em pedaços
  for (let i = 0; i < 10; i++) { const [x, z] = inDisc(0.022); put(lump(0.009 + rnd() * 0.003, 0.006 + rnd() * 0.003, 0.008 + rnd() * 0.003, 0.35, i * 3.1), chick, (rnd() - 0.5) * 0.9, rnd() * TAU, x, yTop + 0.012 + rnd() * 0.016, z); }
  // palitos de pepino, inclinados para fora
  for (let i = 0; i < 5; i++) { const [x, z] = inDisc(0.018); put(lump(0.005, 0.026, 0.005, 0.04, i), cuc, (rnd() - 0.5) * 1.0, rnd() * TAU, x, yTop + 0.024, z); }
  // anéis de cebola roxa
  for (let i = 0; i < 6; i++) { const [x, z] = inDisc(0.022); const g = torus(0.009 + rnd() * 0.004, 0.0018); rotX(g, Math.PI / 2 + (rnd() - 0.5) * 1.4); put(g, onion, (rnd() - 0.5) * 0.6, rnd() * TAU, x, yTop + 0.02 + rnd() * 0.012, z); }
  // pimentões
  for (let i = 0; i < 8; i++) { const [x, z] = inDisc(0.022); put(lump(0.007, 0.0035, 0.009, 0.18, 20 + i), i % 2 ? yel : red, rnd(), rnd() * TAU, x, yTop + 0.016 + rnd() * 0.014, z); }

  // tábua redonda de madeira
  const wood = material(doc, "madeira", { tex: await woodTex(), rough: 0.6 });
  const board = lathe([[0.0001, B], [0.085, B], [0.09, B - 0.003], [0.091, 0.003], [0.087, 0], [0.0001, 0]], 96);
  planarUV(board, 0.18);
  mesh.addPrimitive(prim(doc, buf, board, wood));
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
