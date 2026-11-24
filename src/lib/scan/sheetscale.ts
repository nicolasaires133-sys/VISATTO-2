// Conferência automática da escala de impressão, sem régua.
//
// A folha A4 tem sempre 21 × 29,7 cm, não importa como foi impressa. Se a impressora encolheu ou esticou a página
// ("ajustar à página"), o quadrado preto sai um pouco diferente de 15 cm. Medindo o papel em "unidades do
// quadrado" nos próprios quadros do vídeo, dá para saber o tamanho real do quadrado.
// Mede a largura e a altura separadamente: se o prato estiver por cima de uma borda, a outra direção resolve.
import { applyH, homography, type Vec2 } from "./geometry";
import { MARKER_CM } from "./marker";

const A4 = { w: 21, h: 29.7 };

type Shot = { data: ImageData | { data: Uint8ClampedArray; width: number; height: number }; corners: Vec2[] };

/** Medidas do papel num quadro, em cm "supondo quadrado de 15 cm". */
function measure(s: Shot): { w: number[]; h: number[] } {
  const m = MARKER_CM / 2;
  const H = homography([[-m, m], [m, m], [m, -m], [-m, -m]], s.corners);
  const { data: d, width: w, height: h } = s.data;
  const lum = (x: number, y: number): number => {
    const [u, v] = applyH(H, [x, y]);
    const i = Math.round(u), j = Math.round(v);
    if (i < 1 || j < 1 || i >= w - 1 || j >= h - 1) return NaN;
    const o = (j * w + i) * 4;
    return d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11;
  };
  /** Anda do quadrado para fora, na direção (dx,dy), até o papel acabar. Devolve a distância do centro. */
  const edge = (ox: number, oy: number, dx: number, dy: number, max: number): number | null => {
    const at = (t: number) => lum(ox + dx * t, oy + dy * t);
    // brilho do papel: na margem branca logo ao lado do quadrado
    const ref: number[] = [];
    for (let t = 8.0; t <= 8.9; t += 0.15) ref.push(at(t));
    if (ref.some((v) => v !== v)) return null;
    ref.sort((a, b) => a - b);
    let paper = ref[ref.length >> 1];
    if (paper < 110) return null; // margem escura: sombra forte ou algo em cima da folha
    const step = 0.1;
    const recent: number[] = []; // o brilho do papel muda devagar (sombra suave): a referência acompanha
    for (let t = 8.9; t < max; t += step) {
      const a = at(t);
      if (a !== a) return null;
      const drop = Math.max(30, paper * 0.28);
      if (a >= paper - drop) {
        recent.push(a);
        if (recent.length > 8) recent.shift();
        if (recent.length >= 5) paper = [...recent].sort((p, q) => p - q)[recent.length >> 1];
        continue;
      }
      // precisa continuar escuro por mais 0,8 cm (não é um risco, uma letra ou a régua impressa)
      let table = 0, n = 0;
      for (let k = 1; k <= 8; k++) {
        const b = at(t + k * step);
        if (b !== b || b >= paper - drop) { n = -1; break; }
        table += b; n++;
      }
      if (n < 0) continue;
      table /= n;
      // posição da borda: onde o brilho cruza o meio do caminho entre papel e mesa
      const mid = (paper + table) / 2;
      const before = at(t - step);
      const k = before > a ? Math.min(1, Math.max(0, (before - mid) / (before - a))) : 0.5;
      return t - step + k * step;
    }
    return null;
  };
  const out = { w: [] as number[], h: [] as number[] };
  // largura: linhas horizontais na altura do quadrado. Folha de 21 cm → até 12,6 de cada lado se encolhida
  for (const y of [-6, -4, -2, 0, 2, 4, 6]) {
    const r = edge(0, y, 1, 0, 12.8), l = edge(0, y, -1, 0, 12.8);
    if (r != null && l != null) out.w.push(r + l);
  }
  // altura: linhas verticais (fora das marcas da régua e do retângulo do cartão impressos na folha)
  for (const x of [-6.6, -5.5, -3.5, -1.5, 0.5, 2.5, 5.5, 6.6]) {
    const t = edge(x, 0, 0, 1, 13), b = edge(x, 0, 0, -1, 23.5);
    if (t != null && b != null) out.h.push(t + b);
  }
  return out;
}

export type ScaleCheck = {
  /** tamanho real do quadrado preto (cm) */
  markerCm: number;
  /** "folha": medido pelo tamanho do A4; "padrao": não deu para medir, assumiu 15 cm */
  source: "folha" | "padrao";
};

/** Escala de uma direção (1 = impresso em 100%), ou null se as medidas forem poucas ou discordarem. */
function scaleOf(values: number[], real: number): number | null {
  if (values.length < 8) return null;
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
  const med = q(0.5);
  if ((q(0.75) - q(0.25)) / med > 0.04) return null;
  const s = real / med;
  return s >= 0.86 && s <= 1.12 ? s : null; // fora disso não é uma folha A4 (ou a mesa confunde)
}

/** Estima o tamanho real do quadrado impresso a partir de vários quadros com o marcador. */
export function checkPrintScale(shots: Shot[]): ScaleCheck {
  const w: number[] = [], h: number[] = [];
  const stepN = Math.max(1, Math.floor(shots.length / 16));
  for (let i = 0; i < shots.length; i += stepN) {
    const m = measure(shots[i]);
    w.push(...m.w);
    h.push(...m.h);
  }
  const sw = scaleOf(w, A4.w), sh = scaleOf(h, A4.h);
  const fallback: ScaleCheck = { markerCm: MARKER_CM, source: "padrao" };
  let scale: number;
  if (sw != null && sh != null) {
    if (Math.abs(sw - sh) > 0.035) return fallback; // as duas direções discordam: melhor não mexer
    scale = (sw + sh) / 2;
  } else if (sw != null) scale = sw;
  else if (sh != null) scale = sh;
  else return fallback;
  // o detector acha os cantos do quadrado um fio para dentro (≈1%, medido nos testes sintéticos): compensa
  scale *= 1.011;
  // diferença menor que 1,5%: é só ruído de medida, considera impresso certo
  const markerCm = Math.abs(scale - 1) < 0.015 ? MARKER_CM : Math.round(MARKER_CM * scale * 100) / 100;
  return { markerCm, source: "folha" };
}
