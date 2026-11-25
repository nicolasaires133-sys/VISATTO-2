// Cor do restaurante com contraste suficiente (WCAG AA, 4,5:1) para texto branco em cima dela
// e para ela mesma como texto em fundo branco. Cores claras demais são escurecidas aos poucos.

function lum(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrastWithWhite = (hex: string) => 1.05 / (lum(hex) + 0.05);

export function readable(hex: string | null | undefined, fallback = "#CC4A24") {
  let h = String(hex || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  if (!/^#[0-9a-f]{6}$/i.test(h)) h = fallback;
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < 40 && contrastWithWhite(toHex(r, g, b)) < 4.6; i++) {
    r = Math.round(r * 0.94);
    g = Math.round(g * 0.94);
    b = Math.round(b * 0.94);
  }
  return toHex(r, g, b);
}
const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
