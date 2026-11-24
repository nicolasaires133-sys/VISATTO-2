"use client";
import { withCpuCanvas } from "./cpu-canvas";

let scanToken: string | null = null;
/** No escâner pelo celular, as chamadas são autorizadas pelo link (sem login). */
export function setScanToken(t: string | null) {
  scanToken = t;
}
function authHeaders(): Record<string, string> {
  return scanToken ? { "x-scan-token": scanToken } : {};
}

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    const err: any = new Error("Sem conexão com a internet. Confira o sinal e tente de novo.");
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status >= 500 ? "O servidor não conseguiu concluir agora. Tente de novo em alguns segundos." : "Algo deu errado. Tente de novo.";
    const err: any = new Error(data?.error || fallback);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

/** Reduz a foto no próprio celular antes de enviar (economiza banco e deixa o cardápio rápido). */
export function resizeImage(file: File, maxSide = 800, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a imagem."));
    };
    img.src = url;
  });
}

export function emojiFor(name: string, category = "") {
  const s = `${name} ${category}`.toLowerCase();
  const map: [RegExp, string][] = [
    [/pizza/, "🍕"],
    [/hamb|burger|lanche|x-/, "🍔"],
    [/sushi|temaki|japon|sashimi/, "🍣"],
    [/massa|macarr|espaguete|lasanha|nhoque|talharim|penne|ravioli/, "🍝"],
    [/salada|fit|veg/, "🥗"],
    [/frango|galinha|asa/, "🍗"],
    [/carne|picanha|bife|fil[eé]|costela|churras/, "🥩"],
    [/peixe|camar|frutos do mar|salm|til[aá]pia/, "🐟"],
    [/batata|fritas|por[cç][aã]o/, "🍟"],
    [/sobremesa|doce|bolo|torta|pudim|brownie|sorvete|a[cç]a[ií]/, "🍰"],
    [/cerveja|chopp/, "🍺"],
    [/vinho/, "🍷"],
    [/drink|caipi|coquetel|gin/, "🍹"],
    [/suco|refri|bebida|[aá]gua|coca|guaran/, "🥤"],
    [/caf[eé]/, "☕"],
    [/marmita|prato feito|pf|executivo|almo[cç]o|arroz|feij/, "🍱"],
    [/sopa|caldo/, "🍲"],
  ];
  return map.find(([re]) => re.test(s))?.[1] ?? "🍽️";
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

const MIME: Record<string, string> = {
  glb: "model/gltf-binary",
  usdz: "model/vnd.usdz+zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Envia um arquivo do painel e devolve a URL pública.
 * Em produção vai direto do navegador para o Vercel Blob (aceita arquivos grandes);
 * em desenvolvimento vai para o próprio servidor.
 */
export async function uploadFile(body: Blob, name: string, onProgress?: (pct: number) => void): Promise<string> {
  const { mode, prefix } = await api<{ mode: "blob" | "local"; prefix: string }>("/api/painel/upload");
  const ext = (name.split(".").pop() || "").toLowerCase();
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-60);
  if (mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    const res = await upload(prefix + safe, body, {
      access: "public",
      handleUploadUrl: "/api/painel/upload",
      contentType: MIME[ext] || body.type || "application/octet-stream",
      multipart: body.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress ? (e) => onProgress(Math.round(e.percentage)) : undefined,
      headers: authHeaders(),
    });
    return res.url;
  }
  const res = await fetch(`/api/painel/upload?name=${encodeURIComponent(safe)}`, { method: "POST", body, headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Falha no envio do arquivo.");
  onProgress?.(100);
  return data.url as string;
}

/** Converte o modelo GLB em USDZ (formato do iPhone) no próprio navegador, mantendo o tamanho real. */
export async function glbToUsdz(glbUrl: string): Promise<Blob> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const gltf = await new GLTFLoader().loadAsync(glbUrl);
  const arr = await withCpuCanvas(() => new USDZExporter().parseAsync(gltf.scene, {
    quickLookCompatible: true,
    maxTextureSize: 1024, // o USDZ guarda a textura em PNG: 1024 deixa o arquivo ~4× menor
    includeAnchoringProperties: true,
    ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
  } as any));
  return new Blob([arr as any], { type: "model/vnd.usdz+zip" });
}

export function formatDims(d?: { w: number; d: number; h: number } | null) {
  if (!d || !d.w) return "";
  const n = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  return `${n(d.w)} × ${n(d.d)} cm, ${n(d.h)} cm de altura`;
}
