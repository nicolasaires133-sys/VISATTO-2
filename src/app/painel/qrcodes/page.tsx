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
            <Icon name="printer" size={17} /> Imprimir os QR codes
          </button>
        </div>
        <p className="mt-2 text-[13px] text-black/60">Dica: imprima em papel mais grosso ou plastifique. Cada cartão sai com cerca de 6 × 8 cm.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-3">
        {codes.map((c) => (
          <div key={c.label} className="card break-inside-avoid p-4 text-center print:rounded-none print:ring-1 print:ring-black/40">
            <p className="truncate font-display text-[15px] font-bold">{r.name}</p>
            <div className="mx-auto my-2 w-full max-w-[180px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className="font-display text-[22px] font-extrabold leading-none">{c.label}</p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-black/65">
              {waiter ? "Aponte a câmera, veja o cardápio e peça ajuda ao nosso garçom virtual" : "Aponte a câmera do celular e veja os pratos na sua mesa, em tamanho real"}
            </p>
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-black/60"><LogoMark size={11} /> Visatto</p>
          </div>
        ))}
      </div>
    </div>
  );
}
