// Marca Visatto: o "V" em 3D pousado no anel da realidade aumentada — o prato aparecendo na mesa.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#141B2D" /><ellipse cx="256" cy="388" rx="158" ry="42" fill="none" stroke="#E4572E" strokeWidth="12" strokeLinecap="round" strokeDasharray="126 40" strokeDashoffset="63"/><ellipse cx="256" cy="384" rx="62" ry="13" fill="#05080F" opacity=".5"/><path d="M124 98H214L204 118H114Z" fill="#FFB08E"/><path d="M318 98H408L398 118H308Z" fill="#F47A4E"/><path d="M408 98 398 118 256 372 266 352Z" fill="#7A250C"/><path d="M114 118H204L256 266V372Z" fill="#FF6A3B"/><path d="M256 266 308 118H398L256 372Z" fill="#C93F17"/>
    </svg>
  );
}

export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <LogoMark size={size} />
      <span style={{ fontSize: size * 0.62, letterSpacing: "-0.02em" }}>Visatto</span>
    </span>
  );
}
