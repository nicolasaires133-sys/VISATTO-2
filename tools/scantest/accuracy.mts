// Teste de precisão do escâner com fotos sintéticas de medidas conhecidas
import fs from "node:fs";
import sharp from "sharp";
import { createRequire } from "node:module";
import { calibrate, pixelToPlane, heightOnVertical, viewElevation, cameraCenter, type Vec2 } from "../../src/lib/scan/geometry.ts";
const require = createRequire(import.meta.url);
const { AR } = require("js-aruco2");
// Fotos sintéticas geradas com three.js (marcador + prato de medidas conhecidas) e o arquivo gt.json com a verdade.
const DIR = process.env.SCAN_DIR || "./tools/scantest/fotos/";
const gt = JSON.parse(fs.readFileSync(DIR + "gt.json", "utf8"));
const det = new AR.Detector({ dictionaryName: "ARUCO_MIP_36h12" });

function fitCircle(pts: [number, number][]) { // mínimos quadrados (Kåsa)
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = pts.length;
  for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [sxz, syz, sz];
  const det3 = (m: number[][]) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D = det3(A); const col = (i: number) => A.map((r, k) => r.map((v, j) => (j === i ? b[k] : v)));
  const a1 = det3(col(0)) / D, a2 = det3(col(1)) / D, a3 = det3(col(2)) / D;
  const cx = a1 / 2, cy = a2 / 2; return { cx, cy, r: Math.sqrt(a3 + cx * cx + cy * cy) };
}

const d = gt.dish;
console.log(`Prato real: largura ${2 * d.r} cm, altura ${d.h} cm, centro (${d.x}, ${d.y})\n`);
const results: any[] = [];
for (const [name, s] of Object.entries<any>(gt.scenes)) {
  const { data, info } = await sharp(DIR + name + ".png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const markers = det.detect({ width: info.width, height: info.height, data: new Uint8ClampedArray(data) });
  const m = markers.find((x: any) => x.id === 7);
  if (!m) { console.log(name, "MARCADOR NÃO DETECTADO"); continue; }
  const corners: Vec2[] = m.corners.map((c: any) => [c.x, c.y]);
  const cornerErr = Math.max(...corners.map((c, i) => Math.hypot(c[0] - s.corners[i][0], c[1] - s.corners[i][1])));
  for (const mode of ["sem EXIF", "com EXIF"] as const) {
    const f35 = mode === "com EXIF" ? (s.fpx * Math.hypot(36, 24)) / Math.hypot(info.width, info.height) : null;
    const { cam, focalSource } = calibrate({ corners, refW: 15, refH: 15, width: info.width, height: info.height, f35 });
    // largura: borda de cima da comida (z = h) marcada pelo usuário → plano z = h
    const rim = s.rimTop.map((p: Vec2) => pixelToPlane(cam, p, d.h)!).map((P: number[]) => [P[0], P[1]] as [number, number]);
    const c = fitCircle(rim);
    const height = heightOnVertical(cam, s.topCenter, c.cx, c.cy);
    const C = cameraCenter(cam);
    results.push({ foto: name, modo: mode, foco: focalSource, "erro foco %": +((100 * (cam.f - s.fpx)) / s.fpx).toFixed(1), "elev°": +viewElevation(cam).toFixed(0), "largura cm": +(2 * c.r).toFixed(2), "centro": `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`, "altura cm": +height.toFixed(2), "cam z": +C[2].toFixed(1), "erro canto px": +cornerErr.toFixed(2) });
  }
}
console.table(results);
