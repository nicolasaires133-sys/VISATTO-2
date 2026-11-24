// Reconhecimento de pratos pela imagem, de graça, no próprio servidor do site.
//
// Usa o modelo de visão OpenCLIP (ViT-B/32, pesos abertos), que compara uma foto com descrições em texto.
// As descrições de cada prato já foram convertidas em vetores (modelos/clip/rotulos.json); aqui só a parte das
// imagens roda, com o onnxruntime em WebAssembly (sem binário nativo, funciona igual na Vercel e no computador).
// O arquivo do modelo (89 MB) vem dividido em partes menores que 25 MB, o limite de envio pelo site do GitHub.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

type Table = { ids: string[]; vecs: Float32Array[] };
type Clip = { run: (pixels: Float32Array, n: number) => Promise<Float32Array[]>; pratos: Table; partes: Table; logit: number };

const DIR = path.join(process.cwd(), "modelos", "clip");
let loading: Promise<Clip> | null = null;

function table(t: { ids: string[]; escala: number[]; vetores: string }): Table {
  const raw = Buffer.from(t.vetores, "base64");
  const q = new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const vecs = t.ids.map((_, i) => {
    const v = new Float32Array(512);
    let n = 0;
    for (let k = 0; k < 512; k++) { v[k] = q[i * 512 + k] * t.escala[i]; n += v[k] * v[k]; }
    n = Math.sqrt(n);
    for (let k = 0; k < 512; k++) v[k] /= n;
    return v;
  });
  return { ids: t.ids, vecs };
}

/** O modelo está no projeto? (sem ele, o escâner segue funcionando só com o nome do prato) */
export function clipAvailable() {
  try {
    return fs.existsSync(path.join(DIR, "rotulos.json")) && fs.readdirSync(DIR).some((f) => f.startsWith("visual-int8.onnx.parte"));
  } catch {
    return false;
  }
}

async function load(): Promise<Clip> {
  const ort = await import("onnxruntime-web");
  ort.env.wasm.numThreads = 1;
  // junta as partes do arquivo do modelo (na ordem)
  const parts = fs.readdirSync(DIR).filter((f) => f.startsWith("visual-int8.onnx.parte")).sort();
  const model = Buffer.concat(parts.map((f) => fs.readFileSync(path.join(DIR, f))));
  const session = await ort.InferenceSession.create(new Uint8Array(model.buffer, model.byteOffset, model.byteLength), { executionProviders: ["wasm"] });
  const R = JSON.parse(fs.readFileSync(path.join(DIR, "rotulos.json"), "utf8"));
  // uma análise por vez: dois donos escaneando ao mesmo tempo no mesmo servidor não podem usar o modelo juntos
  let queue: Promise<unknown> = Promise.resolve();
  const run = async (pixels: Float32Array, n: number) => {
    const job = queue.then(() => session.run({ pixels: new ort.Tensor("float32", pixels, [n, 3, 224, 224]) }));
    queue = job.catch(() => {});
    const out = await job;
    const e = out.emb.data as Float32Array;
    return Array.from({ length: n }, (_, i) => {
      const v = e.slice(i * 512, (i + 1) * 512);
      let s = 0;
      for (let k = 0; k < 512; k++) s += v[k] * v[k];
      s = Math.sqrt(s) || 1;
      for (let k = 0; k < 512; k++) v[k] /= s;
      return v;
    });
  };
  return { run, pratos: table(R.pratos), partes: table(R.partes), logit: R.logit || 100 };
}

export function getClip() {
  if (!loading) loading = load().catch((e) => { loading = null; throw e; });
  return loading;
}

const MEAN = [0.48145466, 0.4578275, 0.40821073], STD = [0.26862954, 0.26130258, 0.27577711];

/** Imagem (JPEG/PNG) → pixels no formato do modelo: lado menor em 224, recorte central 224×224, normalizado. */
async function pixelsOf(img: Buffer, out: Float32Array, offset: number) {
  const { data } = await sharp(img).removeAlpha().resize(224, 224, { fit: "cover", kernel: "cubic" }).raw().toBuffer({ resolveWithObject: true });
  const N = 224 * 224;
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 3; c++) out[offset + c * N + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
}

/** Vetores de várias imagens (já normalizados). */
export async function embedImages(imgs: Buffer[]) {
  if (!imgs.length) return [];
  const clip = await getClip();
  const px = new Float32Array(imgs.length * 3 * 224 * 224);
  for (let i = 0; i < imgs.length; i++) await pixelsOf(imgs[i], px, i * 3 * 224 * 224);
  return clip.run(px, imgs.length);
}

export type Score = { id: string; p: number };

/**
 * Probabilidade de cada rótulo para um vetor de imagem. `prior` multiplica a chance de alguns rótulos
 * (ex.: o nome do item no cardápio diz que é pizza; o prato é um PF, então arroz e feijão são esperados).
 */
export function rank(e: Float32Array, t: Table, logit: number, prior: Record<string, number> = {}): Score[] {
  const lg = t.vecs.map((v, i) => {
    let s = 0;
    for (let k = 0; k < 512; k++) s += v[k] * e[k];
    return logit * s + Math.log(prior[t.ids[i]] ?? 1);
  });
  const m = Math.max(...lg);
  const ex = lg.map((x) => Math.exp(x - m)), sum = ex.reduce((a, b) => a + b, 0);
  return t.ids.map((id, i) => ({ id, p: ex[i] / sum })).sort((a, b) => b.p - a.p);
}

/** Média de vários vetores (fotos do mesmo prato de ângulos diferentes), renormalizada. */
export function meanVec(es: Float32Array[]) {
  const m = new Float32Array(512);
  for (const e of es) for (let k = 0; k < 512; k++) m[k] += e[k];
  let s = 0;
  for (let k = 0; k < 512; k++) s += m[k] * m[k];
  s = Math.sqrt(s) || 1;
  for (let k = 0; k < 512; k++) m[k] /= s;
  return m;
}
