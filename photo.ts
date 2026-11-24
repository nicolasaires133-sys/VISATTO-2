// Carrega uma foto do celular, respeitando a orientação, e lê o foco (EXIF) para a medição.
export type Photo = {
  canvas: HTMLCanvasElement;
  data: ImageData;
  width: number;
  height: number;
  f35: number | null;
  dataUrl: string; // versão reduzida para envio
};

const MAX = 2048;

export async function loadPhoto(file: File): Promise<Photo> {
  let f35: number | null = null;
  try {
    const exifr = (await import("exifr")).default;
    const ex: any = await exifr.parse(file, ["FocalLengthIn35mmFormat", "FocalLength"]);
    if (ex?.FocalLengthIn35mmFormat) f35 = Number(ex.FocalLengthIn35mmFormat);
  } catch {}
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  } catch {
    // navegadores antigos: <img> já aplica a orientação da foto
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    bmp = img;
  }
  const bw = (bmp as any).naturalWidth || bmp.width, bh = (bmp as any).naturalHeight || bmp.height;
  const k = Math.min(1, MAX / Math.max(bw, bh));
  const w = Math.round(bw * k), h = Math.round(bh * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0, w, h);
  (bmp as ImageBitmap).close?.();
  const data = g.getImageData(0, 0, w, h);
  const small = document.createElement("canvas");
  const ks = Math.min(1, 1280 / Math.max(w, h));
  small.width = Math.round(w * ks);
  small.height = Math.round(h * ks);
  small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);
  return { canvas, data, width: w, height: h, f35, dataUrl: small.toDataURL("image/jpeg", 0.88) };
}

/** Amostra bilinear de cor (RGB 0-255). Fora da imagem → null. */
export function sample(img: ImageData, x: number, y: number): [number, number, number] | null {
  if (x < 0 || y < 0 || x > img.width - 1 || y > img.height - 1) return null;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, img.width - 1), y1 = Math.min(y0 + 1, img.height - 1);
  const fx = x - x0, fy = y - y0;
  const d = img.data, w = img.width;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c];
    const e = d[(y1 * w + x0) * 4 + c], f = d[(y1 * w + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
  }
  return out;
}
