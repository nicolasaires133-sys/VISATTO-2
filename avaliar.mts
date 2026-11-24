// Testa o reconhecimento em fotos de uma pasta (uso: node ... tools/clip/avaliar.mts pasta [prato|partes])
import fs from "node:fs";
import path from "node:path";
import { embedImages, getClip, rank } from "../../src/lib/clip.ts";
const dir = process.argv[2], mode = process.argv[3] || "prato";
const clip = await getClip();
for (const f of fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()) {
  const [e] = await embedImages([fs.readFileSync(path.join(dir, f))]);
  const r = rank(e, mode === "prato" ? clip.pratos : clip.partes, clip.logit).slice(0, 3);
  console.log(f.padEnd(34), r.map((s) => `${s.id} ${s.p.toFixed(2)}`).join(" | "));
}
