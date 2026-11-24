// Teste da reconstrução por vídeo com quadros sintéticos de medidas conhecidas
import fs from "node:fs";
import sharp from "sharp";
import { AR } from "../../src/lib/scan/vendor/aruco.mjs";
import { calibrate, focalFromHomography, homography, type Vec2 } from "../../src/lib/scan/geometry.ts";
import { applyFlatTopPrior, applyRoundPrior, reconstructHeightfield, segmentDish, selectViews, sharpness, estimateCenter, type View } from "../../src/lib/scan/recon.ts";
import { checkDims, profileFromName, reconParams } from "../../src/lib/scan/profile.ts";

const name = process.argv[2] || "baixo";
const DIR = (process.env.SCAN_DIR || "/home/claude/scantest/") + `orbit-${name}/`;
const gt = JSON.parse(fs.readFileSync(DIR + "gt.json", "utf8"));
const det = new AR.Detector({ dictionaryName: "ARUCO_MIP_36h12" });
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png")).sort();
const t0 = Date.now();
const raw: { img: any; corners: Vec2[]; f: number | null }[] = [];
for (const f of files) {
  const { data, info } = await sharp(DIR + f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const m = det.detect(img).find((x: any) => x.id === 7);
  if (!m) continue;
  const corners: Vec2[] = m.corners.map((c: any) => [c.x, c.y]);
  const H = homography([[-7.5, 7.5], [7.5, 7.5], [7.5, -7.5], [-7.5, -7.5]], corners);
  raw.push({ img, corners, f: focalFromHomography(H, info.width / 2, info.height / 2) });
}
const fs_ = raw.map((r) => r.f).filter(Boolean).sort((a, b) => a! - b!) as number[];
const fMed = fs_[fs_.length >> 1];
console.log(`${raw.length}/${files.length} quadros com marcador • foco estimado ${fMed?.toFixed(0)} px (real ${gt.frames[0].fpx.toFixed(0)}, erro ${(100 * (fMed - gt.frames[0].fpx) / gt.frames[0].fpx).toFixed(1)}%)`);
const all = raw.map((r) => ({ img: r.img, cam: calibrate({ corners: r.corners, refW: 15, refH: 15, width: r.img.width, height: r.img.height, fKnown: fMed }).cam, sharp: sharpness(r.img) }));
const center = estimateCenter(all as View[]);
const views = selectViews(all, center, 20);
console.log(`centro estimado (${center[0].toFixed(1)}, ${center[1].toFixed(1)}) • ${views.length} quadros usados`);
// mesmo caminho do app: ficha do produto (aqui só pelo nome) → parâmetros → reconstrução → simetria
const NAMES: Record<string, string> = { baixo: "Nhoque da Nonna", burger: "X-Burger da casa", fatia: "Fatia de bolo de chocolate", taca: "Pavê no copo", sundae: "Taça de sorvete 2 bolas", cupcake: "Cupcake de morango", cupcakebaixo: "Cupcake de morango" };
const profile = profileFromName(process.env.NOME || NAMES[name] || name);
const prm = reconParams(profile);
console.log(`ficha: ${profile.produto} → ${profile.kind}, ${profile.formato}, topo ${profile.topo} • zMax ${prm.zMax} cm, área ±${prm.half} cm`);
const hf = await reconstructHeightfield(views, { center, half: prm.half, zMax: prm.zMax, exclude: { x0: -10.5, x1: 10.5, y0: -19.2, y1: 10.5 } });
let dish = segmentDish(hf);
if (prm.round) { applyRoundPrior(hf, dish); dish = segmentDish(hf); }
if (prm.flatTop) { applyFlatTopPrior(hf, dish, 0.75); dish = segmentDish(hf); }
console.log("avisos:", JSON.stringify(checkDims(profile, dish.dims)));
const t1 = Date.now();
const d = gt.dish;
// volume real (para comparar o 3D completo, não só o relevo)
const gtOcc = (x: number, y: number, z: number): boolean => {
  const r = Math.hypot(x - d.x, y - d.y);
  if (d.type === "cupcake") {
    if (z < 4 && r < 2.4 + (z / 4) * 0.6) return true;
    if ((r / 4.3) ** 2 + ((z - 4.3) / (4.3 * 0.55)) ** 2 < 1) return true;
    return z >= 6.4 && z <= 9.8 && r < 2.6 * (1 - (z - 6.4) / 3.4);
  }
  if (d.type === "sundae") {
    if (z < 0.6) return r < 4;
    if (z < 6) return r < 0.9;
    if (z < 10 && r < 1.5 + ((z - 6) / 4) * 4) return true;
    return Math.hypot(x - d.x - 1.6, y - d.y, z - 11.4) < 2.6 || Math.hypot(x - d.x + 1.6, y - d.y, z - 11.4) < 2.6;
  }
  return z < gtH(x, y);
};
const gtH = (x: number, y: number): number => {
  const r = Math.hypot(x - d.x, y - d.y);
  if (d.type === "burger") {
    if (r < d.r) return 6 + 4 * Math.sqrt(Math.max(0, 1 - (r / d.r) ** 2));
    if (r < d.r + 0.5) return 6;
    return r < d.plateR ? 1.5 : 0;
  }
  if (d.type === "fatia") {
    const a = -0.4, dx = x - d.x, dy = y - d.y;
    const u = dx * Math.cos(a) - dy * Math.sin(a) + 0.55 * d.r, v = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.hypot(u, v) <= d.r && Math.abs(Math.atan2(v, u)) <= Math.PI / 6) return d.h;
    return r < d.plateR ? 1.5 : 0;
  }
  if (d.type === "taca") return r < d.r ? 0.6 + d.fill : 0; // o recheio (o vidro é transparente)
  if (d.type === "sundae" || d.type === "cupcake") { let t = 0; for (let z = 0; z < 14.5; z += 0.25) if (gtOcc(x, y, z)) t = z; return t; }
  return r < d.r ? d.h : r < d.plateR ? 1.5 : 0;
};
let se = 0, n = 0, seFood = 0, nFood = 0;
for (let j = 0; j < hf.ny; j++) for (let i = 0; i < hf.nx; i++) {
  const x = hf.x0 + (i + 0.5) * hf.cell, y = hf.y0 + (j + 0.5) * hf.cell;
  const r = Math.hypot(x - d.x, y - d.y);
  if (r > Math.max(d.plateR, d.r) + 3) continue;
  const e = hf.h[j * hf.nx + i] - gtH(x, y);
  se += e * e; n++;
  if (gtH(x, y) > 2 && gtH(x + 1, y) > 2 && gtH(x - 1, y) > 2 && gtH(x, y + 1) > 2 && gtH(x, y - 1) > 2) { seFood += e * e; nFood++; }
}
console.log(`MEDIDAS: ${dish.dims.w} × ${dish.dims.d} cm, altura ${dish.dims.h} cm  (real: ${2 * Math.max(d.plateR, d.r) + ' × ' + 2 * Math.max(d.plateR, d.r)} cm, altura ${d.h} cm${d.type === 'taca' ? ', recheio ' + (0.6 + d.fill) + ' cm' : ''})`);
console.log(`centro do prato (${dish.centroid[0].toFixed(1)}, ${dish.centroid[1].toFixed(1)}) real (${d.x}, ${d.y})`);
console.log(`erro médio da forma (RMS): prato inteiro ${Math.sqrt(se / n).toFixed(2)} cm • só a comida ${Math.sqrt(seFood / nFood).toFixed(2)} cm`);
console.log(`tempo de cálculo: ${((t1 - t0) / 1000).toFixed(1)} s (Node, CPU)`);
// perfil ao longo do diâmetro (para ver a forma)
const row: string[] = [];
for (let k = -18; k <= 18; k += 2) {
  const x = d.x + k, i = Math.floor((x - hf.x0) / hf.cell), j = Math.floor((d.y - hf.y0) / hf.cell);
  row.push(`${k}:${hf.h[j * hf.nx + i].toFixed(1)}/${gtH(x, d.y).toFixed(1)}`);
}
console.log("perfil (dx: medido/real):", row.join("  "));
fs.writeFileSync(`/tmp/hf-${name}.json`, JSON.stringify({ ...hf, h: Array.from(hf.h), conf: Array.from(hf.conf), mask: Array.from(dish.mask) }));

// volume: IoU (quanto do volume real e do medido coincidem)
const { finalVolume, buildVolumeMesh } = await import("../../src/lib/scan/volume.ts");
const F = finalVolume(hf, dish);
let inter = 0, uni = 0;
for (let k = 0; k < hf.nz!; k++) for (let q = 0; q < hf.nx * hf.ny; q++) {
  const x = hf.x0 + ((q % hf.nx) + 0.5) * hf.cell, y = hf.y0 + (((q / hf.nx) | 0) + 0.5) * hf.cell, z = k * hf.dz! + hf.dz! / 2;
  if (Math.hypot(x - d.x, y - d.y) > Math.max(d.plateR, d.r) + 4) continue;
  const a = F[k * hf.nx * hf.ny + q] === 1, b = gtOcc(x, y, z);
  if (a && b) inter++;
  if (a || b) uni++;
}
if (process.env.SLICES) for (let k = 0; k < hf.nz!; k += 4) {
  let a = 0, b = 0, o = 0;
  for (let q = 0; q < hf.nx * hf.ny; q++) {
    const x = hf.x0 + ((q % hf.nx) + 0.5) * hf.cell, y = hf.y0 + (((q / hf.nx) | 0) + 0.5) * hf.cell, z = k * hf.dz! + hf.dz! / 2;
    if (Math.hypot(x - d.x, y - d.y) > Math.max(d.plateR, d.r) + 4) continue;
    if (F[k * hf.nx * hf.ny + q]) a++;
    if (gtOcc(x, y, z)) b++;
    if (hf.occ![k * hf.nx * hf.ny + q]) o++;
  }
  if (a || b) console.log(`z=${(k * hf.dz!).toFixed(1)} medido ${a} casco ${o} real ${b}`);
}
console.log(`volume 3D: IoU ${(100 * inter / uni).toFixed(1)}% (100% = idêntico)`);

// malha + textura
const { buildHeightMesh } = await import("../../src/lib/scan/heightmesh.ts");
const tm = Date.now();
const mesh = process.env.RELEVO ? await buildHeightMesh(hf, dish, views as View[], undefined, { texW: 768, texH: 384, round: prm.round }) : await buildVolumeMesh(hf, dish, views as View[]);
console.log(`malha: ${mesh.indices.length / 3} triângulos, ${mesh.positions.length / 3} vértices • textura ${mesh.texture.width}×${mesh.texture.height} em ${((Date.now() - tm) / 1000).toFixed(1)} s`);
await sharp(Buffer.from(mesh.texture.data), { raw: { width: mesh.texture.width, height: mesh.texture.height, channels: 4 } }).png().toFile(`/tmp/tex-${name}.png`);
// GLB para inspeção visual
const { Document, NodeIO } = await import("@gltf-transform/core");
const doc = new Document();
const buf = doc.createBuffer();
const png = await sharp(Buffer.from(mesh.texture.data), { raw: { width: mesh.texture.width, height: mesh.texture.height, channels: 4 } }).jpeg({ quality: 88 }).toBuffer();
const texture = doc.createTexture("t").setImage(new Uint8Array(png)).setMimeType("image/jpeg");
const mat = doc.createMaterial("m").setBaseColorTexture(texture).setRoughnessFactor(0.75).setMetallicFactor(0);
const prim = doc.createPrimitive()
  .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(mesh.positions).setBuffer(buf))
  .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(Array.from(mesh.uvs, (v, i) => (i % 2 ? 1 - v : v)))).setBuffer(buf))
  .setIndices(doc.createAccessor().setType("SCALAR").setArray(mesh.indices).setBuffer(buf))
  .setMaterial(mat);
doc.createScene().addChild(doc.createNode("n").setMesh(doc.createMesh().addPrimitive(prim)));
await new NodeIO().writeBinary(doc).then((b) => fs.writeFileSync(`/tmp/recon-${name}.glb`, b));
