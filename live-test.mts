// Teste da captura guiada (lógica): passa quadros sintéticos de uma volta pela LiveSession, como se fosse a câmera
import fs from "node:fs";
import sharp from "sharp";
import { LiveSession } from "../../src/lib/scan/live.ts";

const name = process.argv[2] || "vivo";
const dt = Number(process.argv[3] || 150); // ms entre quadros (velocidade da volta)
const DIR = (process.env.SCAN_DIR || "/home/claude/scantest/") + `orbit-${name}/`;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png")).sort();
const s = new LiveSession();
const load = async (f: string, w?: number) => {
  let img = sharp(DIR + f).ensureAlpha();
  if (w) img = img.resize({ width: w });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: "srgb" } as unknown as ImageData;
};
const hints: Record<string, number> = {};
let doneAt = -1, t0 = 0, ms = 0;
for (let k = 0; k < files.length; k++) {
  const small = await load(files[k], 640), full = await load(files[k]);
  t0 = performance.now();
  const st = s.push(small, () => full, k * dt);
  ms += performance.now() - t0;
  hints[st.hint] = (hints[st.hint] || 0) + 1;
  if (st.done && doneAt < 0) doneAt = k;
  if (k % 12 === 0 || k === files.length - 1) console.log(`q${k} ${st.hint} fatia ${st.bin} · ${st.count}/24 ${st.covered.map((c) => (c ? "#" : ".")).join("")}`);
}
console.log(name, "dicas:", JSON.stringify(hints), "· fechou no quadro", doneAt, "de", files.length, "· guardados", s.frames().length, `· ${(ms / files.length).toFixed(0)} ms/quadro`);
