// Teste da folha em branco: acha os cantos e segue a orientação, comparando com a verdade (gt.json)
import sharp from "sharp";
import fs from "node:fs";
import { detectSheet, SheetTracker } from "../../src/lib/scan/sheet.ts";
const dir = process.argv[2];
const gt = JSON.parse(fs.readFileSync(`${dir}/gt.json`, "utf8"));
const sorted = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
// SALTO=1: sem seguir pela posição (cada quadro só pela mesa em volta), em ordem embaralhada
const SALTO = !!process.env.SALTO;
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const files = SALTO ? [...sorted].sort(() => rnd() - 0.5) : sorted;
const tr = new SheetTracker();
let found = 0, errs: number[] = [], orientOk = 0, oriented = 0, visible = 0;
let rot0: number | null = null; // o "norte" escolhido no primeiro quadro (0 ou 2 se o lado comprido estiver certo)
const rotOf = (o: number[][], g: number[][]) => [0, 1, 2, 3].find((r) => Math.max(...o.map((p, i) => Math.hypot(p[0] - g[(i + r) % 4][0], p[1] - g[(i + r) % 4][1]))) < 6) ?? -1;
for (let k = 0; k < files.length; k++) {
  const { data, info } = await sharp(`${dir}/${files[k]}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
  const g: number[][] = gt.frames[sorted.indexOf(files[k])].corners;
  const inside = g.every(([x, y]) => x > 2 && y > 2 && x < info.width - 3 && y < info.height - 3);
  if (inside) visible++;
  const t0 = performance.now();
  const c = detectSheet(img);
  const ms = performance.now() - t0;
  if (!c) { console.log(files[k], inside ? "NÃO ACHOU (visível)" : "fora", ms.toFixed(0) + "ms"); continue; }
  found++;
  // erro de canto (melhor rotação)
  let best = 1e9;
  for (let r = 0; r < 4; r++) best = Math.min(best, Math.max(...[0, 1, 2, 3].map((i) => Math.hypot(c[(i + r) % 4][0] - g[i][0], c[(i + r) % 4][1] - g[i][1]))));
  errs.push(best);
  const o = tr.orient(c, img, k, SALTO ? 0 : 1.5);
  let ok = false;
  if (o) { oriented++; const r = rotOf(o, g); if (rot0 === null) rot0 = r; ok = r === rot0 && r % 2 === 0; if (ok) orientOk++; }
  console.log(files[k], `erro ${best.toFixed(2)}px`, o ? (ok ? "orientação ok" : "ORIENTAÇÃO ERRADA") : "descartado", ms.toFixed(0) + "ms");
}
errs.sort((a, b) => a - b);
console.log(`achou ${found}/${visible} visíveis (${files.length} quadros) · erro mediano ${errs[errs.length >> 1]?.toFixed(2)}px, máx ${errs.at(-1)?.toFixed(2)}px · orientação certa ${orientOk}/${oriented} (norte=${rot0}${rot0 !== null && rot0 % 2 ? " LADO COMPRIDO TROCADO" : ""})`);
