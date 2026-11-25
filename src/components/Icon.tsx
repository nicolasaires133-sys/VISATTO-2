// Ícones do Visatto: traço simples, um peso só. (Nada de emoji na interface: cada celular desenha de um jeito.)
const P: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4",
  bag: "M6 8h12l1 12H5L6 8ZM9 8V6a3 3 0 0 1 6 0v2",
  plus: "M12 5v14M5 12h14",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  right: "m9 5 7 7-7 7",
  left: "m15 5-7 7 7 7",
  down: "m5 9 7 7 7-7",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0",
  chef: "M7 14a4 4 0 1 1 1.4-7.7A4 4 0 0 1 16 6.3 4 4 0 1 1 17 14v6H7v-6ZM7 17h10",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6",
  refresh: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  pix: "M12 3.5 20.5 12 12 20.5 3.5 12Z M8.5 9.5l3.5 3.5 3.5-3.5",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  cash: "M3 7h18v10H3zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 10v4M18 10v4",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 0 6.5 21H20M8 7h8",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.5 3 8 3.5 7.5 7 12 7Zm0 0s1.5-4 4-3.5S16.5 7 12 7Z",
  split: "M12 3v18M4 8h5M4 12h5M15 12h5M15 16h5",
  scan: "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 14.5h10M8.5 14.5a3.5 3.5 0 0 1 7 0",
  cube: "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2",
  check: "m5 12 5 5 9-10",
  printer: "M7 8V3h10v5M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7Z",
  qr: "M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  chart: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8ZM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  video: "M3 7h12v10H3V7ZM15 10l6-3v10l-6-3",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4",
  star: "m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8L12 3Z",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  ruler: "M3 15 15 3l6 6L9 21l-6-6ZM7 11l2 2M10 8l2 2M13 5l2 2",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21a8 8 0 0 1 16 0",
  table: "M3 8h18M5 8v11M19 8v11M3 8l2-3h14l2 3",
  bike: "M6 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM18 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM6 17l4-8h5l3 8M10 9 8 6H6M14 5h3",
  sound: "M4 10v4h4l5 4V6l-5 4H4ZM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  mute: "M4 10v4h4l5 4V6l-5 4H4ZM17 10l4 4M21 10l-4 4",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7.5h.01",
  alert: "M12 4 2.5 20h19L12 4ZM12 10v5M12 17.5h.01",
  image: "M4 5h16v14H4V5ZM4 16l5-5 4 4 3-3 4 4M15 9.5h.01",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  menu: "M4 7h16M4 12h16M4 17h16",
  rotate: "M4 12a8 8 0 0 1 14-5.3L20 8M20 4v4h-4M20 12a8 8 0 0 1-14 5.3L4 16M4 20v-4h4",
  chat: "M4 5h16v11H9l-5 4V5Z",
  pause: "M8 5v14M16 5v14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.7 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  lock: "M6 11h12v10H6V11ZM8 11V8a4 4 0 0 1 8 0v3",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 7l10-3v3M16 13.5h.01",
  copy: "M9 9h11v11H9V9ZM5 15H4V4h11v1",
  sparkle: "M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8L12 4Z",
};

export type IconName = keyof typeof P;

export default function Icon({ name, size = 20, className = "", stroke = 1.8, filled = false }: { name: string; size?: number; className?: string; stroke?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={P[name] || P.info} />
    </svg>
  );
}
