"use client";
// Captura guiada: a câmera fica aberta, o dono dá a volta no produto e o Visatto guarda sozinho as fotos certas.
// Não há botão de gravar, nem vídeo para enviar: o anel na tela fecha conforme os ângulos vão sendo vistos.
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { HINT_TEXT, LIVE_BINS, LiveSession, type LiveHint, type LiveStatus } from "@/lib/scan/live";
import type { Frame } from "@/lib/scan/video";

const SMALL = 640; // lado maior do quadro usado para achar a folha (rápido)
const WORK = 1280; // lado maior do quadro guardado para o 3D

type Props = {
  onDone: (frames: Frame[]) => void;
  onCancel: () => void;
  /** a câmera não abriu (sem permissão, navegador de dentro de outro app...): cai para o vídeo comum */
  onUnavailable: (reason: string) => void;
};

export default function LiveCapture({ onDone, onCancel, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [geom, setGeom] = useState({ vw: 0, vh: 0, sw: 0, sh: 0 });
  const [turn, setTurn] = useState(0); // giro do anel (graus, sem dar salto na passagem de 360°)
  const sessionRef = useRef<LiveSession | null>(null);
  const doneRef = useRef(false);
  const finishRef = useRef<(() => void) | null>(null);
  const cbRef = useRef({ onDone, onUnavailable });
  cbRef.current = { onDone, onUnavailable };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let lock: any = null;
    let timer: any = null;
    const session = new LiveSession();
    sessionRef.current = session;
    const small = document.createElement("canvas");
    const work = document.createElement("canvas");
    const gs = small.getContext("2d", { willReadFrequently: true })!;
    const gw = work.getContext("2d", { willReadFrequently: true })!;
    let lastTurn = 0;

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      stop = true;
      setFinishing(true);
      try { navigator.vibrate?.([40, 60, 40]); } catch {}
      const frames = session.frames();
      stream?.getTracks().forEach((t) => t.stop());
      setTimeout(() => cbRef.current.onDone(frames), 450);
    }
    finishRef.current = finish;

    function step() {
      const v = videoRef.current;
      if (stop || !v) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      if (vw && vh && v.readyState >= 2) {
        const ks = Math.min(1, SMALL / Math.max(vw, vh));
        const sw = Math.round(vw * ks), sh = Math.round(vh * ks);
        if (small.width !== sw || small.height !== sh) {
          small.width = sw;
          small.height = sh;
          setGeom({ vw, vh, sw, sh });
        }
        gs.drawImage(v, 0, 0, sw, sh);
        const st = session.push(
          gs.getImageData(0, 0, sw, sh),
          () => {
            const kw = Math.min(1, WORK / Math.max(vw, vh));
            const ww = Math.round(vw * kw), wh = Math.round(vh * kw);
            if (work.width !== ww || work.height !== wh) {
              work.width = ww;
              work.height = wh;
            }
            gw.drawImage(v, 0, 0, ww, wh);
            return gw.getImageData(0, 0, ww, wh);
          },
          performance.now(),
        );
        if (st.captured) try { navigator.vibrate?.(12); } catch {}
        if (st.bin !== null) {
          // o anel gira para a posição do dono ficar sempre embaixo, como num mapa visto de cima
          const target = 90 + ((st.bin + 0.5) / LIVE_BINS) * 360 - 180;
          let d = (target - lastTurn) % 360;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          lastTurn += d;
          setTurn(lastTurn);
        }
        setStatus(st);
        if (st.done) return finish();
      }
      timer = setTimeout(step, 110);
    }

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return cbRef.current.onUnavailable("Este navegador não deixa abrir a câmera aqui dentro.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch (e: any) {
        const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
        return cbRef.current.onUnavailable(
          denied ? "A câmera não foi liberada. Toque em “Permitir” quando o navegador perguntar, ou grave um vídeo comum." : "Não consegui abrir a câmera deste aparelho.",
        );
      }
      if (stop) return stream.getTracks().forEach((t) => t.stop());
      const v = videoRef.current!;
      v.srcObject = stream;
      try { await v.play(); } catch {}
      try { lock = await (navigator as any).wakeLock?.request("screen"); } catch {}
      setReady(true);
      step();
    })();

    return () => {
      stop = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      lock?.release?.().catch(() => {});
    };
  }, []);

  const hint: LiveHint = status?.hint ?? "procurando";
  const count = status?.count ?? 0;
  const good = hint === "bom";
  const pct = Math.min(100, Math.round((count / (LIVE_BINS - 2)) * 100));

  // contorno do quadrado desenhado por cima do vídeo (o vídeo preenche a tela cortando as sobras)
  let poly = "";
  const box = boxRef.current;
  if (status?.corners && box && geom.vw) {
    const cw = box.clientWidth, ch = box.clientHeight;
    const k = Math.max(cw / geom.vw, ch / geom.vh);
    const ox = (cw - geom.vw * k) / 2, oy = (ch - geom.vh * k) / 2;
    const up = geom.vw / geom.sw;
    poly = status.corners.map(([x, y]) => `${(x * up * k + ox).toFixed(1)},${(y * up * k + oy).toFixed(1)}`).join(" ");
  }

  return (
    <div ref={boxRef} className="fixed inset-0 z-50 overflow-hidden bg-black text-white" data-live={ready ? "on" : "abrindo"} data-count={count}>
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
      {poly && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polygon points={poly} fill="none" stroke={good ? "#4ade80" : "#fbbf24"} strokeWidth="3" strokeLinejoin="round" />
        </svg>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/65 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/75 to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-start gap-3 px-4 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <button onClick={onCancel} aria-label="Fechar a câmera" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/45 backdrop-blur">
          <Icon name="close" size={20} />
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`mx-auto mt-0.5 rounded-full px-4 py-2.5 text-center text-[16px] font-bold leading-tight shadow-lg backdrop-blur ${
            finishing ? "bg-green-500 text-black" : good ? "bg-white/92 text-ink" : "bg-amber-400 text-black"
          }`}
        >
          {finishing ? "Pronto! Montando o 3D" : !ready ? "Abrindo a câmera..." : HINT_TEXT[hint]}
        </p>
        <span className="w-11 shrink-0" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-[max(1.1rem,env(safe-area-inset-bottom))]">
        <Ring covered={status?.covered ?? []} turn={turn} active={status?.bin != null && good} pct={finishing ? 100 : pct} />
        <p className="mt-2 text-center text-[13.5px] font-medium text-white/85">
          {count === 0 ? "Dê uma volta devagar em torno do produto. O anel vai fechando." : "Cada pedaço verde é um lado já fotografado."}
        </p>
        <button
          className="mt-3 h-12 w-full max-w-xs rounded-full bg-white text-[15.5px] font-bold text-ink transition disabled:bg-white/25 disabled:text-white/70"
          disabled={!status?.canFinish || finishing}
          onClick={() => finishRef.current?.()}
        >
          {status?.canFinish ? "Concluir agora" : "Continue dando a volta"}
        </button>
      </div>
    </div>
  );
}

/** Anel de progresso: um mapa visto de cima, com o dono sempre embaixo e o produto no meio. */
function Ring({ covered, turn, active, pct }: { covered: boolean[]; turn: number; active: boolean; pct: number }) {
  const R = 54, gap = 2.2;
  const segs = [];
  for (let i = 0; i < LIVE_BINS; i++) {
    // fatia i cobre o azimute de -180° + i·15°; na tela o y cresce para baixo, por isso o sinal trocado
    const a0 = -(-180 + (i * 360) / LIVE_BINS) - gap, a1 = -(-180 + ((i + 1) * 360) / LIVE_BINS) + gap;
    const p = (a: number) => `${(70 + R * Math.cos((a * Math.PI) / 180)).toFixed(2)},${(70 + R * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
    segs.push(<path key={i} d={`M${p(a0)}A${R},${R} 0 0 0 ${p(a1)}`} stroke={covered[i] ? "#4ade80" : "rgba(255,255,255,.28)"} strokeWidth="9" strokeLinecap="round" fill="none" />);
  }
  return (
    <div className="relative h-[140px] w-[140px]" aria-label={`${pct}% da volta`}>
      <svg viewBox="0 0 140 140" className="h-full w-full drop-shadow-lg">
        <g style={{ transform: `rotate(${turn}deg)`, transformOrigin: "70px 70px", transition: "transform .18s linear" }}>{segs}</g>
        {/* onde o dono está */}
        <path d="M70 137l-7-11h14z" fill={active ? "#4ade80" : "#fff"} />
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-[26px] font-extrabold">{pct}%</span>
    </div>
  );
}
