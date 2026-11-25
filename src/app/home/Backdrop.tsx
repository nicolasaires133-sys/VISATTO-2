// Fundo da página inicial: em vez de um preto chapado, luzes quentes de salão que se movem devagar,
// uma malha de pontos (lembra a medição do 3D), linhas de contorno como as de um escaneamento
// e um piso em perspectiva atrás do prato (a "mesa").

/** Camada fixa atrás de todo o conteúdo. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="cine-aurora cine-aurora-a" />
      <div className="cine-aurora cine-aurora-b" />
      <div className="cine-aurora cine-aurora-c" />
      <div className="cine-dots absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(3,4,7,0.85) 100%)" }} />
    </div>
  );
}

// linhas de contorno (como um mapa de relevo), feitas por conta: sem imagem para baixar
function contours(seed: number, rings = 11) {
  const paths: string[] = [];
  for (let k = 1; k <= rings; k++) {
    const base = 26 + k * 22;
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r =
        base +
        Math.sin(a * 3 + seed + k * 0.35) * (6 + k * 1.6) +
        Math.sin(a * 5 - seed * 1.7 + k * 0.2) * (3 + k * 0.7) +
        Math.cos(a * 2 + seed * 0.6) * k * 1.4;
      const x = 300 + Math.cos(a) * r * 1.18;
      const y = 300 + Math.sin(a) * r;
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(d + "Z");
  }
  return paths;
}

/** Linhas de contorno num canto da seção. */
export function Contours({ seed = 1, className = "", tone = "#ff7a4d" }: { seed?: number; className?: string; tone?: string }) {
  const id = `ct-${seed}`;
  return (
    <svg aria-hidden viewBox="0 0 600 600" className={`pointer-events-none absolute max-md:opacity-30! ${className}`} fill="none">
      <defs>
        <radialGradient id={id} gradientUnits="userSpaceOnUse" cx="300" cy="300" r="300">
          <stop offset="0" stopColor={tone} stopOpacity="0.95" />
          <stop offset="0.55" stopColor={tone} stopOpacity="0.42" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      {contours(seed).map((d, i) => (
        <path key={i} d={d} stroke={`url(#${id})`} strokeWidth={i % 4 === 3 ? 1.5 : 0.9} />
      ))}
    </svg>
  );
}

/** Linha de luz fina separando as seções. */
export function Divider() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      <div className="h-px w-full max-w-[1200px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -top-8 h-16 w-[50%] max-w-[560px]" style={{ background: "radial-gradient(closest-side, rgba(255,106,61,0.14), transparent)" }} />
    </div>
  );
}

/** Piso em perspectiva (a mesa) com o horizonte aceso, atrás do prato do topo da página. */
export function TableFloor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] overflow-hidden [perspective:520px]">
      <div className="cine-floor absolute inset-x-[-40%] bottom-[-10%] top-0 origin-bottom" />
      <div className="absolute inset-x-0 top-0 h-24" style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(255,122,77,0.22), transparent 70%)" }} />
    </div>
  );
}
