// Armazenamento de arquivos (fotos, modelos 3D).
// - Produção: Vercel Blob (variável BLOB_READ_WRITE_TOKEN, criada ao ligar o Blob no projeto).
// - Desenvolvimento local: pasta ./.data/files servida por /api/files/...
import path from "node:path";

export const LOCAL_PREFIX = "/api/files/";

export function storageMode(): "blob" | "local" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.VERCEL) {
    throw new Error("Armazenamento não configurado: crie um Blob Store no projeto da Vercel (aba Storage).");
  }
  return "local";
}

export const CONTENT_TYPES: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".usdz": "model/vnd.usdz+zip",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function contentTypeFor(name: string) {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";
}

function safeKey(key: string) {
  return key
    .split("/")
    .map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter((p) => p && p !== "." && p !== "..")
    .join("/");
}

/** Salva um arquivo e devolve a URL pública. */
export async function putFile(key: string, data: Buffer | Uint8Array, contentType?: string): Promise<string> {
  const clean = safeKey(key);
  const type = contentType || contentTypeFor(clean);
  if (storageMode() === "blob") {
    const { put } = await import("@vercel/blob");
    const res = await put(clean, Buffer.from(data), {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return res.url;
  }
  const fs = await import("node:fs/promises");
  const ext = path.extname(clean);
  const unique = `${clean.slice(0, clean.length - ext.length)}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const full = path.join(process.cwd(), ".data", "files", unique);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return LOCAL_PREFIX + unique;
}

/** Lê um arquivo salvo (URL do Blob, URL local ou arquivo estático em /public). */
export async function readFile(url: string, maxBytes = 120 * 1024 * 1024): Promise<Buffer> {
  if (url.startsWith(LOCAL_PREFIX)) {
    const fs = await import("node:fs/promises");
    const rel = safeKey(decodeURIComponent(url.slice(LOCAL_PREFIX.length)));
    return fs.readFile(path.join(process.cwd(), ".data", "files", rel));
  }
  if (url.startsWith("/")) {
    const fs = await import("node:fs/promises");
    return fs.readFile(path.join(process.cwd(), "public", safeKey(url)));
  }
  const httpOk = process.env.DEV_ALLOW_HTTP === "1" && /^http:\/\/(localhost|127\.0\.0\.1)/.test(url); // só para testes locais
  if (!/^https:\/\//.test(url) && !httpOk) throw new Error("URL de arquivo inválida.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (${res.status}).`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error("Arquivo grande demais.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Arquivo grande demais.");
  return buf;
}

/** Apaga um arquivo (sem erro se já não existir). */
export async function deleteFile(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(LOCAL_PREFIX)) {
      const fs = await import("node:fs/promises");
      await fs.unlink(path.join(process.cwd(), ".data", "files", safeKey(decodeURIComponent(url.slice(LOCAL_PREFIX.length)))));
    } else if (/^https:\/\/.*blob\.vercel-storage\.com\//.test(url) && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch {}
}

/** Garante que uma URL recebida do navegador é de um arquivo nosso. */
export function isOwnFileUrl(url: string) {
  if (url.startsWith(LOCAL_PREFIX)) return true;
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i.test(url);
}

export function dataUrlToBuffer(dataUrl: string): { buf: Buffer; type: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return { type: m[1].toLowerCase(), buf: Buffer.from(m[2], "base64") };
}
