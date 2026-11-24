// Teste da conferência automática de escala (largura da folha A4) com quadros sintéticos
import fs from "node:fs";
import sharp from "sharp";
import { AR } from "../../src/lib/scan/vendor/aruco.mjs";
import { checkPrintScale } from "../../src/lib/scan/sheetscale.ts";
import type { Vec2 } from "../../src/lib/scan/geometry.ts";

const det = new AR.Detector({ dictionaryName: "ARUCO_MIP_36h12" });
for (const name of process.argv.slice(2)) {
  const DIR = (process.env.SCAN_DIR || "/home/claude/scantest/") + `orbit-${name}/`;
  const gt = JSON.parse(fs.readFileSync(DIR + "gt.json", "utf8"));
  const shots: any[] = [];
  for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".png")).sort()) {
    const { data, info } = await sharp(DIR + f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const img = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    const m = det.detect(img).find((x: any) => x.id === 7);
    if (m) shots.push({ data: img, corners: m.corners.map((c: any) => [c.x, c.y] as Vec2) });
  }
  const r = checkPrintScale(shots);
  console.log(`${name}: quadrado real ${gt.dish.marker ?? 15} cm → medido ${r.markerCm} cm (${r.source}) em ${shots.length} quadros`);
}
