// Serve arquivos salvos localmente (apenas em desenvolvimento; em produção os arquivos ficam no Vercel Blob).
import path from "node:path";
import { contentTypeFor } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  if (process.env.VERCEL) return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const rel = key.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_")).filter((p) => p && p !== "." && p !== "..").join("/");
  const fs = await import("node:fs/promises");
  try {
    const data = await fs.readFile(path.join(process.cwd(), ".data", "files", rel));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeFor(rel),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
