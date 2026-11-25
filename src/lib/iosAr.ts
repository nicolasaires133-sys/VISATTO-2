"use client";
// Câmera própria no iPhone, com o Variant Launch.
// O Safari do iPhone não abre a câmera de realidade aumentada para sites (só a da Apple, o Quick Look,
// que mostra o prato apagado e pequeno antes de pousar). O Variant Launch abre um "App Clip" (um
// cartãozinho da Apple, sem instalar nada) que dá ao site a mesma câmera do Android. Aí o nosso
// carregamento de bolinhas aparece e o prato só surge pronto, no tamanho real, em cima da mesa.
//
// Liga sozinho quando existir a variável NEXT_PUBLIC_VARIANT_KEY (a chave do projeto no launchar.app).
// Sem a chave, nada muda: o iPhone continua usando o Quick Look.

export const VARIANT_KEY = (process.env.NEXT_PUBLIC_VARIANT_KEY || "").trim();

export type IosXr = {
  /** "supported": já dá para abrir a câmera aqui; "launch-required": precisa abrir o App Clip primeiro */
  status: "supported" | "launch-required" | "unsupported";
  getLaunchUrl?: (target: string) => string;
};

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

let pending: Promise<IosXr> | null = null;

/** Carrega o SDK do Variant Launch (só no iPhone e só se tiver a chave). Nunca demora mais que alguns segundos. */
export function prepareIosXr(): Promise<IosXr> {
  if (pending) return pending;
  if (typeof window === "undefined" || !VARIANT_KEY || !isIOS()) return (pending = Promise.resolve({ status: "unsupported" }));
  pending = new Promise<IosXr>((resolve) => {
    let done = false;
    const finish = (r: IosXr) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    window.addEventListener(
      "vlaunch-initialized",
      (e: any) => {
        const st = e?.detail?.webXRStatus;
        const VL = (window as any).VLaunch;
        finish({
          status: st === "supported" || st === "launch-required" ? st : "unsupported",
          getLaunchUrl: VL?.getLaunchUrl ? (t: string) => VL.getLaunchUrl(t) : e?.detail?.launchUrl ? () => e.detail.launchUrl : undefined,
        });
      },
      { once: true },
    );
    const s = document.createElement("script");
    s.src = `https://launchar.app/sdk/v1?key=${encodeURIComponent(VARIANT_KEY)}`;
    s.async = true;
    s.onerror = () => finish({ status: "unsupported" });
    document.head.appendChild(s);
    setTimeout(() => finish({ status: "unsupported" }), 6000);
  });
  return pending;
}

/** Endereço do modelo só pode ser deste site ou do nosso armazenamento (evita abrir arquivos de outros lugares). */
export function safeModelUrl(u: string | null | undefined) {
  if (!u) return "";
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const url = new URL(u);
    if (url.protocol === "https:" && /\.public\.blob\.vercel-storage\.com$/.test(url.hostname)) return url.toString();
  } catch {}
  return "";
}
