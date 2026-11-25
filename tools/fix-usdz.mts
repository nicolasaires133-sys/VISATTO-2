// Corrige os USDZ de demonstração (ancoragem na mesa + texturas JPEG + alinhamento). Uso: npx tsx tools/fix-usdz.mts arquivo.usdz ...
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { fixUsdz } from "../src/lib/usdz.ts";

for (const f of process.argv.slice(2)) {
  const before = readFileSync(f);
  const out = await fixUsdz(new Uint8Array(before), async (png) => new Uint8Array(await sharp(Buffer.from(png)).jpeg({ quality: 86, mozjpeg: true }).toBuffer()));
  writeFileSync(f, out);
  console.log(f, `${(before.length / 1e6).toFixed(2)} MB → ${(out.length / 1e6).toFixed(2)} MB`);
}
