// Marca Visatto: o prato dentro da moldura de escaneamento da câmera — 3D e realidade aumentada à primeira vista.
// (As outras opções de ícone estão no quadro "Ícone do Visatto".)
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="#172033" /><path d="M92 172V124Q92 92 124 92H172M340 92H388Q420 92 420 124V172M420 340V388Q420 420 388 420H340M172 420H124Q92 420 92 388V340" fill="none" stroke="#E4572E" strokeWidth="28" strokeLinecap="round" /><ellipse cx="256" cy="330" rx="132" ry="40" fill="#FFFFFF" /><ellipse cx="256" cy="326" rx="92" ry="25" fill="#EFE6DD" /><path d="M164 322C164 250 206 206 256 206S348 250 348 322Z" fill="#E4572E" /><ellipse cx="256" cy="322" rx="92" ry="16" fill="#C9461F" /><path d="M204 262Q218 232 248 222" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <LogoMark size={size} />
      <span style={{ fontSize: size * 0.62 }}>Visatto</span>
    </span>
  );
}
