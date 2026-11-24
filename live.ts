// Captura guiada ao vivo: o dono só aponta a câmera e dá a volta no prato.
//
// A cada quadro da câmera o Visatto acha a folha, calcula de que lado o celular está e guarda sozinho a foto
// mais nítida de cada ângulo. Um anel na tela vai fechando; quando fecha, já tem tudo para montar o 3D.
// Aqui fica só a lógica (sem tela), para poder ser testada com quadros sintéticos.
import { calibrate, cameraCenter, focalFromHomography, homography, pixelToPlane, type Vec2 } from "./geometry";
import { detectMarker, MARKER_CM } from "./marker";
import { sharpness } from "./recon";
import type { Frame } from "./video";

export const LIVE_BINS = 24; // fatias de 15° em volta do prato
/** fatias que precisam estar preenchidas para terminar sozinho / para liberar o botão "Concluir" */
export const LIVE_DONE = 22;
export const LIVE_MIN = 12;

export type LiveHint =
  | "procurando" // ainda não achou a folha
  | "sem-folha" // perdeu a folha de vista
  | "perto" // está longe demais
  | "longe" // está perto demais (prato e folha não cabem)
  | "levantar" // celular baixo demais (quase na altura da mesa)
  | "inclinar" // celular reto de cima: precisa ver os lados
  | "devagar" // movendo rápido demais (foto tremida)
  | "bom"; // tudo certo: continue dando a volta

export type LiveStatus = {
  hint: LiveHint;
  /** cantos do quadrado no quadro analisado (para desenhar por cima do vídeo), ou null */
  corners: Vec2[] | null;
  /** fatia em que o celular está agora (0..LIVE_BINS-1), ou null */
  bin: number | null;
  covered: boolean[];
  count: number;
  /** acabou de guardar um ângulo novo neste quadro */
  captured: boolean;
  canFinish: boolean;
  done: boolean;
};

type Slot = { frame: ImageData; sharp: number };

export class LiveSession {
  private slots = new Map<number, Slot>(); // chave: fatia * 2 + faixa de altura (0 baixa, 1 alta)
  private focals: number[] = [];
  private centers: Vec2[] = [];
  private lastSeen = 0;
  private last: { az: number; t: number } | null = null;
  private everFound = false;
  private speed = 0;

  /**
   * @param small quadro reduzido (≈480 px) para achar a folha rápido
   * @param full função que devolve o quadro em resolução de trabalho (só é chamada quando vale guardar)
   * @param t relógio em milissegundos
   */
  push(small: ImageData, full: () => ImageData, t: number): LiveStatus {
    const base = (hint: LiveHint, corners: Vec2[] | null = null, bin: number | null = null, captured = false): LiveStatus => {
      const covered = this.coverage();
      const count = covered.filter(Boolean).length;
      return { hint, corners, bin, covered, count, captured, canFinish: count >= LIVE_MIN, done: count >= LIVE_DONE };
    };
    const corners = detectMarker(small);
    if (!corners) {
      this.last = null;
      return base(!this.everFound ? "procurando" : t - this.lastSeen > 500 ? "sem-folha" : "bom");
    }
    this.everFound = true;
    this.lastSeen = t;
    const w = small.width, h = small.height, m = MARKER_CM / 2;

    // foco da câmera: mediana das estimativas até aqui (fica estável depois de poucos quadros)
    const H = homography([[-m, m], [m, m], [m, -m], [-m, -m]], corners);
    const f = focalFromHomography(H, w / 2, h / 2);
    if (f && this.focals.length < 200) this.focals.push(f / Math.max(w, h));
    const fs = [...this.focals].sort((a, b) => a - b);
    const fKnown = fs.length >= 5 ? fs[fs.length >> 1] * Math.max(w, h) : null;
    const cam = calibrate({ corners, refW: MARKER_CM, refH: MARKER_CM, width: w, height: h, fKnown }).cam;
    const C = cameraCenter(cam);

    // centro da cena: para onde o celular costuma apontar (o prato e a folha)
    const g = pixelToPlane(cam, [w / 2, h / 2], 0);
    if (g && Math.hypot(g[0], g[1]) < 90 && this.centers.length < 300) this.centers.push([g[0], g[1]]);
    const med = (k: 0 | 1) => {
      const a = this.centers.map((c) => c[k]).sort((x, y) => x - y);
      return a.length ? a[a.length >> 1] : 0;
    };
    const cx = med(0), cy = med(1);
    const dx = C[0] - cx, dy = C[1] - cy, flat = Math.hypot(dx, dy);
    const az = Math.atan2(dy, dx);
    const elev = (Math.atan2(C[2], flat) * 180) / Math.PI;
    const dist = Math.hypot(flat, C[2]);
    const bin = Math.min(LIVE_BINS - 1, Math.floor(((az + Math.PI) / (2 * Math.PI)) * LIVE_BINS));

    // velocidade em volta do prato (graus por segundo)
    let speed = 0;
    if (this.last && t > this.last.t) {
      let d = Math.abs(az - this.last.az);
      if (d > Math.PI) d = 2 * Math.PI - d;
      // suavizado: a posição calculada treme um pouco de um quadro para o outro
      speed = this.speed = this.speed * 0.6 + ((d * 180) / Math.PI / (t - this.last.t)) * 1000 * 0.4;
    } else this.speed = 0;
    this.last = { az, t };

    // tamanho do quadrado na imagem: muito pequeno = longe demais para medir bem
    const side = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
    const sideFrac = side / Math.max(w, h);

    if (C[2] < 4 || elev < 14) return base("levantar", corners, bin);
    if (elev > 80) return base("inclinar", corners, bin);
    if (sideFrac < 0.05 || dist > 130) return base("perto", corners, bin);
    if (dist < 22) return base("longe", corners, bin);
    if (speed > 95) return base("devagar", corners, bin);

    // guarda o quadro se for o primeiro (ou o mais nítido) deste ângulo
    const band = elev >= 45 ? 1 : 0;
    const key = bin * 2 + band;
    const sharp = sharpness(small);
    const cur = this.slots.get(key);
    let captured = false;
    if (!cur || sharp > cur.sharp * 1.15) {
      // só guarda se a folha também é encontrada no quadro em resolução de trabalho (é ele que vai para o 3D)
      const fr = full();
      if (detectMarker(fr)) {
        const isNewAngle = !this.slots.has(bin * 2) && !this.slots.has(bin * 2 + 1);
        this.slots.set(key, { frame: fr, sharp });
        captured = isNewAngle;
      }
    }
    return base("bom", corners, bin, captured);
  }

  coverage(): boolean[] {
    const c = new Array<boolean>(LIVE_BINS).fill(false);
    for (const k of this.slots.keys()) c[k >> 1] = true;
    return c;
  }

  /** Quadros guardados, prontos para reconstructFromFrames. */
  frames(): Frame[] {
    return [...this.slots.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => ({ data: s.frame }));
  }
}

export const HINT_TEXT: Record<LiveHint, string> = {
  procurando: "Aponte para a folha e o prato",
  "sem-folha": "Mostre a folha inteira",
  perto: "Chegue mais perto",
  longe: "Afaste um pouco",
  levantar: "Levante o celular",
  inclinar: "Incline: filme mais de lado",
  devagar: "Mais devagar",
  bom: "Isso! Continue dando a volta",
};
