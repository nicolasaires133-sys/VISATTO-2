// Hambúrgueres em 3D (os lanches mais famosos do Brasil), feitos por código.
// Uso: node tools/build-burgers.mjs [nomes...] → tools/out/burger-<nome>.glb
// Pão de 11 cm. O mesmo arquivo serve para a demonstração e para o modelo pronto.
import { perlin, fbm, mix, hex, img, normalMap, material, prim, grid, lathe, ellipsoid, save } from "./food3d.mjs";
import { rng, planarUV, translate, rotY, disc, start, scene, lin, merge } from "./build-pizzas.mjs";

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const BURGERS = {
  "x-burger": { label: "X-Burger", layers: ["patty", "cheese"] },
  "x-salada": { label: "X-Salada", layers: ["patty", "cheese", "lettuce", "tomato"] },
  "x-egg": { label: "X-Egg", layers: ["patty", "cheese", "egg"] },
  "x-bacon": { label: "X-Bacon", layers: ["patty", "cheese", "bacon"] },
  "x-tudo": { label: "X-Tudo", layers: ["lettuce", "tomato", "patty", "cheese", "ham", "egg", "bacon"] },
};

const R = 0.055; // raio do pão (11 cm)
const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

/** lathe com relevo: desloca o raio por ruído (a = ângulo, y = altura) */
function bumpyLathe(profile, seg, bump) {
  const g = lathe(profile, seg);
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2], r = Math.hypot(x, z); if (r < 1e-5) continue; const a = Math.atan2(z, x), k = 1 + bump(a, y, r) / r; g.pos[i] = x * k; g.pos[i + 2] = z * k; }
  return renorm(g);
}
function renorm(g) {
  const n = new Float32Array(g.pos.length);
  for (let i = 0; i < g.idx.length; i += 3) { const [a, b, c] = [g.idx[i], g.idx[i + 1], g.idx[i + 2]]; const e1 = [0, 1, 2].map((k) => g.pos[b * 3 + k] - g.pos[a * 3 + k]), e2 = [0, 1, 2].map((k) => g.pos[c * 3 + k] - g.pos[a * 3 + k]); const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const v of [a, b, c]) for (let k = 0; k < 3; k++) n[v * 3 + k] += f[k]; }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; g.nor[i] = n[i] / l; g.nor[i + 1] = n[i + 1] / l; g.nor[i + 2] = n[i + 2] / l; }
  return g;
}

async function burger(name) {
  const B = BURGERS[name], id = `burger-${name}`, { doc, buf, mesh } = start(id);
  const batches = new Map();
  const add = (g, m) => { if (!batches.has(m)) batches.set(m, []); batches.get(m).push(g); };
  const M = async (key, make) => once(key, make); // textura guardada entre lanches

  // ---- papel manteiga amassadinho
  const paperTex = await M("papel", () => img(1024, 1024, (u, v) => { let c = mix(hex("#f3ead6"), hex("#e6dbc2"), 0.5 + fbm(u * 8, v * 8, 4) * 0.8); if (perlin(u * 600, v * 20) > 0.5) c = mix(c, hex("#d9cdb2"), 0.25); const spot = smooth(0.25, 0.45, fbm(u * 5 + 7, v * 5, 3)); return mix(c, hex("#d8c39a"), spot * 0.35); }));
  const paperN = await M("papelN", () => normalMap(512, 512, (u, v) => 0.5 + Math.abs(fbm(u * 6, v * 6, 4)) * 0.8 + perlin(u * 40, v * 40) * 0.05, 2.2));
  const P = 0.2, paper = grid(40, 40, (u, v) => { const x = (u - 0.5) * P, z = (v - 0.5) * P, e = Math.max(Math.abs(x), Math.abs(z)) / (P / 2); return [x, 0.0006 + 0.0012 * Math.abs(fbm(u * 5, v * 5, 3)) + smooth(0.8, 1, e) * 0.004, z]; }, { flip: true });
  planarUV(paper, P); rotY(paper, 0.35);
  const paperMat = material(doc, "papel", { tex: paperTex, normal: paperN, rough: 0.75 }); paperMat.setDoubleSided(true);
  // sem o papel: assim a medida do 3D é a do próprio lanche (o papel ficava maior que o pão)
  if (process.env.PAPEL) mesh.addPrimitive(prim(doc, buf, paper, paperMat));

  // ---- pão de baixo
  const crustTex = await M("pao", () => img(1024, 512, (u, v) => {
    // v: 0 = embaixo/borda, 1 = topo (miolo da tampa fica em outra textura)
    let c = mix(hex("#ecc58a"), hex("#c07a36"), smooth(0.04, 0.4, v) + fbm(u * 20, v * 6, 3) * 0.45);
    c = mix(c, hex("#8e4b1c"), smooth(0.5, 1, v) * 0.6 + Math.max(0, fbm(u * 9, v * 3, 3)) * 0.45);
    c = mix(c, hex("#6f3812"), smooth(0.25, 0.6, perlin(u * 14, v * 5)) * 0.25);
    if (perlin(u * 500, v * 160) > 0.5) c = mix(c, hex("#f6dcae"), 0.22);
    return c;
  }));
  const crustN = await M("paoN", () => normalMap(512, 256, (u, v) => 0.5 + fbm(u * 40, v * 12, 3) * 0.2 + perlin(u * 160, v * 50) * 0.04, 2));
  const crumbTex = await M("miolo", () => img(512, 512, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; let c = mix(hex("#f6e3bb"), hex("#e7c993"), 0.5 + perlin(u * 70, v * 70) * 0.9); if (perlin(u * 160, v * 160) > 0.42) c = mix(c, hex("#cfa86b"), 0.55); c = mix(c, hex("#c98a3e"), smooth(0.25, 0.9, fbm(u * 4, v * 4, 3) + 0.2) * 0.55); return mix(c, hex("#b97a3a"), smooth(0.9, 1, r) * 0.8); }));
  const crustMat = material(doc, "pao", { tex: crustTex, normal: crustN, rough: 0.48 });
  const crumbMat = material(doc, "miolo", { tex: crumbTex, rough: 0.8 });
  const bump = (a, y) => 0.0012 * fbm(Math.cos(a) * 3, Math.sin(a) * 3 + y * 80, 3);
  const bot = bumpyLathe([[0.0001, 0.0015], [R * 0.82, 0.0015], [R * 0.95, 0.004], [R, 0.009], [R * 1.005, 0.0145], [R * 0.985, 0.019]], 72, bump);
  for (let i = 0; i < bot.uv.length; i += 2) bot.uv[i + 1] = 0.05 + (1 - bot.uv[i + 1]) * 0.35;
  add(bot, crustMat);
  let y = 0.019;
  add(disc(0, y, 0, R * 0.985, (x, z) => 0.0004 * perlin(x * 300, z * 300), 72, 6), crumbMat);

  // ---- camadas
  for (const L of B.layers) {
    if (L === "patty") {
      const pTex = await M("carne", () => img(1024, 1024, (u, v) => { let c = mix(hex("#6b3d23"), hex("#3e2112"), 0.5 + fbm(u * 18, v * 18, 4) * 1.2); if (perlin(u * 120, v * 120) > 0.32) c = mix(c, hex("#9a6542"), 0.55); c = mix(c, hex("#1e0e06"), smooth(0.3, 0.6, perlin(u * 14, v * 14) + fbm(u * 40, v * 40, 2) * 0.4) * 0.75); return c; }));
      const pN = await M("carneN", () => normalMap(512, 512, (u, v) => 0.5 + perlin(u * 120, v * 120) * 0.5 + fbm(u * 30, v * 30, 3) * 0.5, 4));
      const h = 0.016, r = R * 1.03, rc = 0.004;
      const prof = [[0.0001, 0], [r - rc, 0], [r - rc * 0.3, rc * 0.3], [r, rc], [r, h - rc], [r - rc * 0.3, h - rc * 0.3], [r - rc, h], [0.0001, h]];
      const g = bumpyLathe(prof, 80, (a, yy) => 0.0022 * fbm(Math.cos(a) * 4, Math.sin(a) * 4 + yy * 120, 4));
      for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], z = g.pos[i + 2]; if (g.pos[i + 1] > h * 0.8) g.pos[i + 1] += 0.0012 * fbm(x * 90, z * 90, 3); }
      renorm(g);
      for (let i = 0; i < g.uv.length; i += 2) { const p = (i / 2) * 3, ny = Math.abs(g.nor[p + 1]); if (ny > 0.55) { g.uv[i] = 0.5 + g.pos[p] / 0.12; g.uv[i + 1] = 0.5 + g.pos[p + 2] / 0.12; } else { g.uv[i] = (Math.atan2(g.pos[p + 2], g.pos[p]) / TAU + 0.5) * 3; g.uv[i + 1] = g.pos[p + 1] / 0.05; } }
      add(translate(g, 0, y, 0), material(doc, "carne", { tex: pTex, normal: pN, rough: 0.55 }));
      y += h;
    }
    if (L === "cheese") {
      // fatia quadrada que derrete e cai pelas pontas
      const S = 0.106, rp = R * 1.0, cm = material(doc, "queijo", { color: lin("#f6b51e"), rough: 0.28 }); cm.setDoubleSided(true);
      const g = grid(40, 40, (u, v) => {
        const x = (u - 0.5) * S, z = (v - 0.5) * S, d = Math.hypot(x, z) || 1e-6, edge = 0.0545;
        if (d <= edge) return [x, 0.0012 + 0.0003 * perlin(x * 200, z * 200), z];
        // passa da borda: dobra e escorre colado na lateral da carne
        const t = d - edge, bend = Math.min(t, 0.004), down = Math.max(0, t - 0.004), k = (Math.max(edge + bend, R * 1.03 + 0.0034) + down * 0.06) / d;
        return [x * k, 0.0012 - bend * 0.6 - Math.min(down, 0.011) * 1.0, z * k];
      }, { flip: true });
      rotY(g, Math.PI / 4 + 0.15); add(translate(g, 0, y, 0), cm);
      y += 0.0018;
    }
    if (L === "lettuce") {
      const lTex = await M("alface", () => img(512, 512, (u, v) => { const vein = Math.abs(Math.sin(u * TAU * 9 + fbm(u * 4, v * 4, 2) * 3)) < 0.06; let c = mix(hex("#86b84a"), hex("#3f7a22"), v * 0.9 + fbm(u * 8, v * 8, 3) * 0.7); return vein ? mix(c, hex("#cfe6a0"), 0.45) : c; }));
      const lm = material(doc, "alface", { tex: lTex, rough: 0.5 }); lm.setDoubleSided(true);
      const g = grid(96, 10, (u, v) => { const a = u * TAU, n = fbm(Math.cos(a) * 3, Math.sin(a) * 3, 3); const r = R * (0.2 + 1.0 * v) * (1 + 0.1 * n); const wave = (Math.sin(a * 7 + n * 5) * 0.6 + fbm(Math.cos(a) * 8, Math.sin(a) * 8, 2) * 0.8) * 0.004 * smooth(0.55, 1, v); return [Math.cos(a) * r, 0.0035 + wave - smooth(0.7, 1, v) * 0.004, Math.sin(a) * r]; }, { wrap: true, flip: true });
      add(translate(g, 0, y, 0), lm);
      y += 0.0045;
    }
    if (L === "tomato") {
      const tTex = await M("tomate", () => img(512, 512, (u, v) => {
        const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
        if (r > 0.9) return mix(hex("#d8321d"), hex("#a71e10"), (r - 0.9) * 10);
        const wall = Math.abs(Math.sin(a * 2.5)) < 0.16 || r > 0.78 || r < 0.22;
        let c = wall ? mix(hex("#e5482f"), hex("#c93220"), perlin(u * 30, v * 30) + 0.5) : mix(hex("#f2735a"), hex("#e2513a"), perlin(u * 20, v * 20) + 0.5);
        if (!wall && r > 0.35 && r < 0.7 && perlin(u * 90, v * 90) > 0.35) c = mix(c, hex("#f7d48a"), 0.8);
        return c;
      }));
      const tm = material(doc, "tomate", { tex: tTex, rough: 0.2 }), side = material(doc, "tomate-casca", { color: lin("#c8281a"), rough: 0.25 });
      for (const [cx, cz] of [[-0.028, 0.012], [0.027, -0.006]]) {
        const rt = 0.031, th = 0.006;
        add(disc(cx, y + th, cz, rt, () => 0, 40, 4), tm);
        add(translate(grid(40, 1, (u, v) => [Math.cos(u * TAU) * rt, v * th, Math.sin(u * TAU) * rt], { wrap: true, flip: true }), cx, y, cz), side);
      }
      y += 0.006;
    }
    if (L === "ham") {
      const hm = material(doc, "presunto", { color: lin("#e9a39d"), rough: 0.4 }); hm.setDoubleSided(true);
      const g = grid(64, 6, (u, v) => { const a = u * TAU, r = R * 1.02 * (1 - v) * (1 + 0.04 * Math.sin(a * 3)); return [Math.cos(a) * r, Math.sin(a * 6) * 0.003 * (1 - v) - (1 - v) * (1 - v) * 0.004 + 0.002, Math.sin(a) * r]; }, { wrap: true, flip: true });
      add(translate(g, 0, y, 0), hm);
      y += 0.0025;
    }
    if (L === "egg") {
      const eTex = await M("ovo", () => img(512, 512, (u, v) => { const r = Math.hypot(u - 0.5, v - 0.5) * 2; const edge = smooth(0.7, 1, r + fbm(u * 8, v * 8, 3) * 0.4); return mix(mix(hex("#fffdf6"), hex("#f4eedf"), perlin(u * 20, v * 20) + 0.5), hex("#c98a45"), edge * 0.85); }));
      const em = material(doc, "clara", { tex: eTex, rough: 0.3 }); em.setDoubleSided(true);
      const re = R * 1.1;
      const g = grid(72, 8, (u, v) => { const a = u * TAU, n = fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 3); const r = re * (1 - v) * (1 + 0.16 * n); return [Math.cos(a) * r, 0.0025 * Math.sqrt(v) - (1 - v) * (1 - v) * 0.003 + 0.001, Math.sin(a) * r]; }, { wrap: true });
      planarUV(g, re * 2.4); add(translate(g, 0, y, 0), em);
      add(translate(lathe([[0.017, 0], [0.0168, 0.003], [0.0145, 0.0072], [0.0095, 0.0102], [0.004, 0.0114], [0.0001, 0.0116]], 40), 0.008, y + 0.0028, -0.006), material(doc, "gema", { color: lin("#f7a512"), rough: 0.12 }));
      y += 0.004;
    }
    if (L === "bacon") {
      const bTex = await M("bacon", () => img(512, 256, (u, v) => { const fat = Math.sin(v * TAU * 2.3 + fbm(u * 6, v * 2, 3) * 3) > 0.35; let c = fat ? mix(hex("#f1cfa4"), hex("#d9a874"), perlin(u * 30, v * 30) + 0.5) : mix(hex("#a3381f"), hex("#6a1f0d"), perlin(u * 20, v * 40) + 0.5); return mix(c, hex("#3d1405"), smooth(0.15, 0.5, perlin(u * 9, v * 4)) * 0.7); }));
      const bm = material(doc, "bacon", { tex: bTex, rough: 0.45 }); bm.setDoubleSided(true);
      const r = rng(5);
      for (let k = 0; k < 3; k++) {
        const len = 0.12, w = 0.024, off = (k - 1) * 0.025, rot = 0.25 + (r() - 0.5) * 0.3;
        const g = grid(40, 4, (u, v) => { const x = (u - 0.5) * len, z = off + (v - 0.5) * w * (1 + 0.15 * Math.sin(u * 23)); const droop = Math.max(0, Math.abs(x) - R * 0.82); return [x, 0.0018 + Math.sin(u * TAU * 3 + k) * 0.0022 - droop * droop * 6, z]; }, { flip: true });
        rotY(g, rot); add(translate(g, 0, y + k * 0.0008, 0), bm);
      }
      y += 0.0045;
    }
  }

  // ---- pão de cima (com gergelim)
  y += 0.0005;
  const dome = [[R * 1.0, 0], [R * 1.03, 0.005], [R * 1.01, 0.013], [R * 0.9, 0.024], [R * 0.72, 0.032], [R * 0.45, 0.0375], [R * 0.18, 0.0395], [0.0001, 0.04]];
  const top = bumpyLathe(dome, 80, (a, yy, r) => 0.0012 * fbm(Math.cos(a) * 3, Math.sin(a) * 3 + yy * 40, 3));
  for (let i = 0; i < top.uv.length; i += 2) top.uv[i + 1] = 0.15 + (1 - top.uv[i + 1]) * 0.85;
  add(translate(top, 0, y, 0), crustMat);
  add(translate(disc(0, 0, 0, R, () => 0, 64, 3), 0, y + 0.0002, 0), crumbMat);
  // gergelim espalhado pela tampa
  const seedMat = material(doc, "gergelim", { color: lin("#f4e4bd"), rough: 0.4 });
  const prof = (rr) => { for (let i = 0; i < dome.length - 1; i++) { const [r0, y0] = dome[i], [r1, y1] = dome[i + 1]; if (rr <= r0 && rr >= r1) return y0 + (y1 - y0) * ((r0 - rr) / (r0 - r1)); } return 0.04; };
  const sr = rng(77);
  for (let k = 0; k < 70; k++) {
    const rr = Math.sqrt(sr()) * R * 0.8, a = sr() * TAU, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const s = ellipsoid(0, 0, 0, 0.0022, 0.0008, 0.0012, sr() * TAU, 8);
    const tilt = rr / R * 0.9; // acompanha a curva da tampa
    for (let i = 0; i < s.pos.length; i += 3) { const px = s.pos[i], py = s.pos[i + 1]; const ca = Math.cos(a), sa = Math.sin(a); const radial = px * ca + s.pos[i + 2] * sa; const lift = radial * -Math.sin(tilt); s.pos[i + 1] = py + lift; }
    add(translate(s, x, y + prof(rr) + 0.0004, z), seedMat);
  }

  for (const [m, list] of batches) mesh.addPrimitive(prim(doc, buf, merge(list), m));
  scene(doc, mesh, id); await save(doc, id);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BURGERS);
  for (const n of want) await burger(n);
}
