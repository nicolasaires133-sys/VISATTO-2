// Gera os modelos 3D de demonstração (pizza, lasanha e tiramisù) em tamanho real, 100% por código.
// Uso: node tools/build-demo-models.mjs → grava em tools/out/*.glb. Os arquivos finais (já preparados,
// com USDZ para iPhone e foto) estão em public/demo/.
import { Document, NodeIO } from "@gltf-transform/core";
import sharp from "sharp";
import fs from "node:fs";

const OUT = new URL("./out/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// ---------- utilidades ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const svgPng = async (svg, size = 1024) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
const svgJpg = async (svg, w = 1024, h = 1024) => sharp(Buffer.from(svg)).resize(w, h).jpeg({ quality: 88 }).toBuffer();

function material(doc, name, png, { rough = 0.8, mime = "image/png", color = [1, 1, 1, 1] } = {}) {
  const m = doc.createMaterial(name).setRoughnessFactor(rough).setMetallicFactor(0).setBaseColorFactor(color);
  if (png) m.setBaseColorTexture(doc.createTexture(name).setImage(png).setMimeType(mime));
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

// Disco horizontal (topo ou base) com UV planar
function disc(r, y, seg = 96, up = true, uvScale = 1) {
  const pos = [0, y, 0], nor = [0, up ? 1 : -1, 0], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, y, z); nor.push(0, up ? 1 : -1, 0);
    uv.push(0.5 + (Math.cos(a) / 2) * uvScale, 0.5 + (Math.sin(a) / 2) * uvScale);
  }
  for (let i = 1; i <= seg; i++) up ? idx.push(0, i + 1, i) : idx.push(0, i, i + 1);
  return { pos, nor, uv, idx };
}

// Parede de cilindro (perfil r(y) livre: pontos [r, y])
function lathe(profile, seg = 96, vRepeat = 1) {
  const pos = [], nor = [], uv = [], idx = [];
  const rows = profile.length;
  for (let j = 0; j < rows; j++) {
    const [r, y] = profile[j];
    const prev = profile[Math.max(0, j - 1)], next = profile[Math.min(rows - 1, j + 1)];
    const dr = next[0] - prev[0], dy = next[1] - prev[1];
    let nx = dy, ny = -dr; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      nor.push(Math.cos(a) * nx, ny, Math.sin(a) * nx);
      uv.push((i / seg) * 4, (j / (rows - 1)) * vRepeat);
    }
  }
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  return { pos, nor, uv, idx };
}

// Bloco (fatia retangular) com UV por face
function box(w, h, d, y0 = 0) {
  const x = w / 2, z = d / 2, y1 = y0 + h;
  const faces = [
    // [normal, 4 cantos]
    [[0, 1, 0], [[-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z]], "top"],
    [[0, 0, 1], [[-x, y0, z], [x, y0, z], [x, y1, z], [-x, y1, z]], "side"],
    [[0, 0, -1], [[x, y0, -z], [-x, y0, -z], [-x, y1, -z], [x, y1, -z]], "side"],
    [[1, 0, 0], [[x, y0, z], [x, y0, -z], [x, y1, -z], [x, y1, z]], "side"],
    [[-1, 0, 0], [[-x, y0, -z], [-x, y0, z], [-x, y1, z], [-x, y1, -z]], "side"],
  ];
  const out = { top: { pos: [], nor: [], uv: [], idx: [] }, side: { pos: [], nor: [], uv: [], idx: [] } };
  for (const [n, c, kind] of faces) {
    const o = out[kind]; const base = o.pos.length / 3;
    c.forEach((p) => { o.pos.push(...p); o.nor.push(...n); });
    o.uv.push(0, 1, 1, 1, 1, 0, 0, 0);
    if (kind === "top") o.uv.splice(o.uv.length - 8, 8, 0, 0, 1, 0, 1, 1, 0, 1);
    o.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  // corrige orientação das laterais (anti-horário visto de fora)
  for (const k of ["side"]) { const o = out[k]; for (let i = 0; i < o.idx.length; i += 3) { const t = o.idx[i + 1]; o.idx[i + 1] = o.idx[i + 2]; o.idx[i + 2] = t; } }
  return out;
}

// Prato de cerâmica branco com borda
function plate(r) {
  return lathe([[0, 0.004], [r * 0.62, 0.004], [r * 0.7, 0.007], [r * 0.9, 0.016], [r, 0.02], [r * 0.985, 0.022], [r * 0.88, 0.019], [r * 0.69, 0.011], [r * 0.6, 0.0085], [0.0001, 0.0085]], 128);
}

async function save(doc, name) {
  const io = new NodeIO();
  fs.writeFileSync(new URL(`${name}.glb`, OUT), await io.writeBinary(doc));
  console.log("ok", name);
}

// ---------- texturas (SVG → PNG) ----------
function pizzaTopSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <radialGradient id="sauce"><stop offset="0" stop-color="#c8361e"/><stop offset="0.85" stop-color="#b52a16"/><stop offset="1" stop-color="#9b2312"/></radialGradient>
    <filter id="melt"><feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.99  0 0 0 0 0.88  0 0 0 0 0.56  0 0 0 -5 3.1"/></filter>
    <filter id="spots"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.55  0 0 0 0 0.2  0 0 0 -3.5 1.4"/></filter>
    <radialGradient id="pep"><stop offset="0" stop-color="#a5281b"/><stop offset="0.75" stop-color="#8f1f14"/><stop offset="1" stop-color="#6d150d"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="#d9a35b"/>
  <circle cx="512" cy="512" r="500" fill="url(#sauce)"/>
  <circle cx="512" cy="512" r="485" filter="url(#melt)"/>
  <circle cx="512" cy="512" r="485" filter="url(#spots)" opacity="0.55"/>`;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 400;
    const x = 512 + Math.cos(a) * d, y = 512 + Math.sin(a) * d, r = 34 + rnd() * 10;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#pep)"/><circle cx="${x - r * 0.25}" cy="${y - r * 0.3}" r="${r * 0.18}" fill="#c9442e" opacity="0.6"/>`;
    for (let k = 0; k < 4; k++) s += `<circle cx="${x + (rnd() - 0.5) * r}" cy="${y + (rnd() - 0.5) * r}" r="${2 + rnd() * 3}" fill="#f2d39a" opacity="0.8"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 360, x = 512 + Math.cos(a) * d, y = 512 + Math.sin(a) * d, rot = rnd() * 180;
    s += `<ellipse cx="${x}" cy="${y}" rx="34" ry="16" fill="#2f7a2c" transform="rotate(${rot} ${x} ${y})"/><path d="M${x - 30} ${y} L${x + 30} ${y}" stroke="#4c9a3f" stroke-width="2" transform="rotate(${rot} ${x} ${y})"/>`;
  }
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 470;
    s += `<circle cx="${512 + Math.cos(a) * d}" cy="${512 + Math.sin(a) * d}" r="${1 + rnd() * 1.5}" fill="#3d5a1e" opacity="0.7"/>`;
  }
  return s + "</svg>";
}
const crustSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 -2 1.25"/></filter>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3b26b"/><stop offset="0.5" stop-color="#c98a3f"/><stop offset="1" stop-color="#e8c07d"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" filter="url(#n)" opacity="0.6"/></svg>`;
const woodSvg = () => {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#b07a45"/>`;
  for (let i = 0; i < 70; i++) { const y = rnd() * 1024; s += `<path d="M0 ${y} Q 256 ${y + (rnd() - 0.5) * 40} 512 ${y} T 1024 ${y}" stroke="${rnd() > 0.5 ? "#8c5a2e" : "#c99260"}" stroke-width="${1 + rnd() * 5}" fill="none" opacity="0.55"/>`; }
  return s + `<defs><filter id="n"><feTurbulence baseFrequency="0.8 0.02" numOctaves="2"/><feColorMatrix values="0 0 0 0 0.3 0 0 0 0 0.18 0 0 0 0 0.08 0 0 0 -1.5 0.9"/></filter></defs><rect width="1024" height="1024" filter="url(#n)" opacity="0.4"/></svg>`;
};
const layersSvg = (layers) => {
  let y = 0, s = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">`;
  for (const [h, c, noise] of layers) {
    s += `<rect x="0" y="${y}" width="512" height="${h}" fill="${c}"/>`;
    if (noise) s += `<rect x="0" y="${y}" width="512" height="${h}" fill="${noise}" opacity="0.35" filter="url(#n)"/>`;
    y += h;
  }
  return s + `<defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2 1.2"/></filter></defs></svg>`;
};
const flatNoiseSvg = (base, spot, freq = 0.04) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${base}"/>
  <defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="5"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.5 1.3"/></filter></defs>
  <rect width="512" height="512" fill="${spot}" filter="url(#n)" opacity="0.8"/></svg>`;

// ---------- PIZZA (35 cm na tábua de 40 cm) ----------
async function pizza() {
  const doc = new Document(); const buf = doc.createBuffer();
  const mesh = doc.createMesh("pizza");
  const wood = material(doc, "madeira", await svgJpg(woodSvg()), { rough: 0.7, mime: "image/jpeg" });
  const top = material(doc, "cobertura", await svgJpg(pizzaTopSvg()), { rough: 0.55, mime: "image/jpeg" });
  const crust = material(doc, "borda", await svgJpg(crustSvg(), 512, 512), { rough: 0.75, mime: "image/jpeg" });
  const R = 0.2, H = 0.016;
  mesh.addPrimitive(prim(doc, buf, lathe([[R - 0.004, 0], [R, 0.003], [R, H - 0.003], [R - 0.004, H]], 128), wood));
  mesh.addPrimitive(prim(doc, buf, disc(R - 0.004, H, 128, true, 0.95), wood));
  mesh.addPrimitive(prim(doc, buf, disc(R - 0.004, 0, 128, false), wood));
  const r = 0.175 - 0.014; const y0 = H + 0.006;
  mesh.addPrimitive(prim(doc, buf, disc(r + 0.002, y0, 128, true), top));
  // borda com pequenas ondulações
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI;
    prof.push([r + 0.007 + Math.sin(a) * -0.0 + (1 - Math.cos(a)) * 0.0075, H + 0.002 + Math.sin(a) * 0.018 * (k < 8 ? 1 : 0.95)]);
  }
  const crustGeo = lathe(prof, 160, 1);
  for (let i = 0; i < crustGeo.pos.length; i += 3) {
    const x = crustGeo.pos[i], z = crustGeo.pos[i + 2], a = Math.atan2(z, x);
    const bump = 1 + 0.012 * Math.sin(a * 9) + 0.008 * Math.sin(a * 23 + 1.3);
    crustGeo.pos[i] *= bump; crustGeo.pos[i + 2] *= bump;
    crustGeo.pos[i + 1] = H + 0.002 + (crustGeo.pos[i + 1] - H - 0.002) * (1 + 0.07 * Math.sin(a * 13));
  }
  mesh.addPrimitive(prim(doc, buf, crustGeo, crust));
  doc.createScene("Scene").addChild(doc.createNode("pizza").setMesh(mesh));
  await save(doc, "pizza");
}

// ---------- Fatia em camadas sobre prato (lasanha / tiramisù) ----------
async function layered(name, { w, h, d, plateR, sideSvg, topSvg, plateY = 0.0085 }) {
  const doc = new Document(); const buf = doc.createBuffer();
  const mesh = doc.createMesh(name);
  const ceramic = material(doc, "porcelana", null, { rough: 0.25, color: [0.96, 0.95, 0.93, 1] });
  mesh.addPrimitive(prim(doc, buf, plate(plateR), ceramic));
  mesh.addPrimitive(prim(doc, buf, disc(plateR * 0.6, 0.004, 128, false), ceramic));
  const b = box(w, h, d, plateY);
  mesh.addPrimitive(prim(doc, buf, b.top, material(doc, `${name}-topo`, await svgJpg(topSvg, 512, 512), { rough: 0.6, mime: "image/jpeg" })));
  mesh.addPrimitive(prim(doc, buf, b.side, material(doc, `${name}-lado`, await svgJpg(sideSvg, 512, 512), { rough: 0.6, mime: "image/jpeg" })));
  doc.createScene("Scene").addChild(doc.createNode(name).setMesh(mesh));
  await save(doc, name);
}

await pizza();
await layered("lasanha", {
  w: 0.12, h: 0.055, d: 0.09, plateR: 0.13,
  topSvg: flatNoiseSvg("#f0c46a", "#b5521f", 0.06),
  sideSvg: layersSvg([[60, "#d98c3c", "#7a3112"], [45, "#f1dfb0", null], [70, "#b5421f", "#5b1c0c"], [45, "#f3e2b8", null], [70, "#b03f1d", "#5b1c0c"], [45, "#f1dfb0", null], [70, "#b5421f", "#5b1c0c"], [107, "#f3e2b8", null]]),
});
await layered("tiramisu", {
  w: 0.09, h: 0.06, d: 0.075, plateR: 0.11,
  topSvg: flatNoiseSvg("#6b3d22", "#3a1e0f", 0.09),
  sideSvg: layersSvg([[40, "#5a3019", "#2a140a"], [110, "#f5ead2", null], [80, "#9b6236", "#5a3019"], [110, "#f6ecd6", null], [80, "#9b6236", "#5a3019"], [92, "#f3e6cc", null]]),
});
