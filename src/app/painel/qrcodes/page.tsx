"use client";
import { ComoUsar } from "../ajuda-ui";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePainel } from "../ctx";
import Icon from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import { PageHead } from "../ui";

export default function QRCodes() {
  const { restaurant: r, waiter } = usePainel();
  const [origin, setOrigin] = useState("");
  const [tables, setTables] = useState(10);
  const [codes, setCodes] = useState<{ label: string; url: string; svg: string }[]>([]);
  const [copied, setCopied] = useState("");
  // imprimir uma mesa só: os outros cartões somem da impressão
  const [only, setOnly] = useState<string | null>(null);
  useEffect(() => {
    if (!only) return;
    const done = () => setOnly(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 60);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [only]);
  const tagline = waiter ? "Aponte a câmera, veja o cardápio e peça ajuda ao nosso garçom virtual" : "Aponte a câmera do celular, veja os pratos na sua mesa e faça o pedido";

  /** Cartão da mesa em imagem (PNG, 1200 × 1600) para mandar para a gráfica ou imprimir em tamanho maior. */
  async function download(c: { label: string; url: string }) {
    const W = 1200, H = 1600, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.fillStyle = r.primary_color || "#cc4a24"; g.fillRect(0, 0, W, 26);
    g.fillStyle = "#172033"; g.textAlign = "center";
    g.font = "800 66px system-ui, sans-serif"; g.fillText(r.name.slice(0, 28), W / 2, 150);
    const img = new Image();
    img.src = await QRCode.toDataURL(c.url, { margin: 1, width: 860, errorCorrectionLevel: "M" });
    await img.decode();
    g.drawImage(img, (W - 860) / 2, 210, 860, 860);
    g.font = "800 128px system-ui, sans-serif"; g.fillText(c.label, W / 2, 1230);
    g.fillStyle = "#555"; g.font = "500 40px system-ui, sans-serif";
    const words = tagline.split(" "); let line = "", y = 1320;
    for (const w of words) { if (g.measureText(line + w).width > 1000) { g.fillText(line.trim(), W / 2, y); line = ""; y += 54; } line += w + " "; }
    g.fillText(line.trim(), W / 2, y);
    g.fillStyle = "#888"; g.font = "600 30px system-ui, sans-serif"; g.fillText("Visatto · cardápio em 3D", W / 2, H - 60);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = `qr-${c.label.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
  }

  useEffect(() => setOrigin(window.location.origin), []);

  const deliveryUrl = `${origin}/r/${r.slug}?modo=delivery`;

  useEffect(() => {
    if (!origin) return;
    (async () => {
      const list = [];
      for (let i = 1; i <= tables; i++) {
        const url = `${origin}/r/${r.slug}?mesa=${i}`;
        list.push({ label: `Mesa ${i}`, url, svg: await QRCode.toString(url, { type: "svg", margin: 1, width: 220 }) });
      }
      setCodes(list);
    })();
  }, [origin, tables, r.slug]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  }

  return (
    <div>
      <PageHead title="QR codes e links" sub="Um QR por mesa: o pedido já chega com o número da mesa."><ComoUsar tela="qrcodes" /></PageHead>
      <div className="no-print">
        {r.delivery_enabled && (
          <div className="card mt-6 space-y-3 p-5">
            <h2 className="text-[17px] font-bold">Link para entrega</h2>
            <p className="text-[14px] text-black/60">Coloque na bio do Instagram, no status do WhatsApp e nas sacolas de entrega.</p>
            <div className="flex gap-2">
              <input readOnly aria-label="Link do cardápio para entrega" className="input" value={deliveryUrl} onFocus={(e) => e.target.select()} />
              <button onClick={() => copy(deliveryUrl)} className="btn-dark shrink-0">
                <Icon name={copied === deliveryUrl ? "check" : "copy"} size={16} />
                {copied === deliveryUrl ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="q-mesas">Quantas mesas?</label>
            <input id="q-mesas" className="input w-28" type="number" inputMode="numeric" min={1} max={100} value={tables} onChange={(e) => setTables(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <button onClick={() => window.print()} className="btn-primary h-[46px]">
            <Icon name="printer" size={17} /> Imprimir todos
          </button>
        </div>
        <p className="mt-2 text-[13px] text-black/60">Cada QR abre o cardápio já na mesa certa: o pedido chega na cozinha com o número da mesa. Imprima todos de uma vez, uma mesa só (botão em cada cartão) ou baixe a imagem para mandar à gráfica. Dica: papel mais grosso ou plastificado.</p>
      </div>

      <div className={`mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:gap-3 ${only ? "print:block" : "print:grid-cols-3"}`}>
        {codes.map((c) => (
          <div key={c.label} className={`card break-inside-avoid p-4 text-center print:rounded-none print:ring-1 print:ring-black/40 ${only && only !== c.label ? "print:hidden" : ""} ${only === c.label ? "print:mx-auto print:w-[100mm] print:p-8" : ""}`}>
            <p className="truncate font-display text-[15px] font-bold">{r.name}</p>
            <div className="mx-auto my-2 w-full max-w-[180px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className="font-display text-[22px] font-extrabold leading-none">{c.label}</p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-black/65">{tagline}</p>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-black/60"><LogoMark size={11} /> Visatto</p>
            <div className="no-print mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setOnly(c.label)} className="btn-ghost h-9 min-w-[6rem] flex-1 px-2 text-[13px]" aria-label={`Imprimir só o QR da ${c.label}`}>
                <Icon name="printer" size={15} /> Imprimir
              </button>
              <button type="button" onClick={() => download(c)} className="btn-ghost h-9 min-w-[6rem] flex-1 px-2 text-[13px]" aria-label={`Baixar a imagem do QR da ${c.label}`}>
                <Icon name="download" size={15} /> Baixar
              </button>
            </div>
            <a href={c.url} target="_blank" rel="noopener" className="no-print mt-2 block truncate text-[11.5px] text-black/65 underline-offset-2 hover:underline">{c.url.replace(/^https?:\/\//, "")}</a>
          </div>
        ))}
      </div>
    </div>
  );
}
