"use client";
// Um prato em 3D para as cenas da página inicial: sem botões, fundo transparente, luz de restaurante.
// Só carrega quando chega perto da tela. A câmera pode ser controlada de fora (rolagem) pelo ref.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadModelViewer } from "@/components/DishViewer";

export type ModelHandle = { orbit: (theta: number, phi: number, radius: string) => void; el: () => any };

type Props = {
  src: string;
  alt: string;
  orbit?: string;
  autoRotate?: boolean;
  rotateSpeed?: string;
  interactive?: boolean;
  exposure?: number;
  shadow?: number;
  className?: string;
  /** suavidade da câmera quando muda pela rolagem (ms) */
  decay?: number;
  onLoad?: () => void;
};

const Model = forwardRef<ModelHandle, Props>(function Model(
  { src, alt, orbit = "0deg 70deg 105%", autoRotate = true, rotateSpeed = "18deg", interactive = false, exposure = 1.05, shadow = 1, className = "", decay = 90, onLoad },
  handle
) {
  const box = useRef<HTMLDivElement>(null);
  const mv = useRef<any>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useImperativeHandle(handle, () => ({
    orbit: (t, p, r) => mv.current?.setAttribute("camera-orbit", `${t.toFixed(1)}deg ${p.toFixed(1)}deg ${r}`),
    el: () => mv.current,
  }));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    loadModelViewer().then(() => alive && setReady(true)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [near]);
  useEffect(() => {
    const el = mv.current;
    if (!el || !ready) return;
    const on = () => {
      setLoaded(true);
      onLoad?.();
    };
    el.addEventListener("load", on);
    if (el.loaded) on();
    return () => el.removeEventListener("load", on);
  }, [ready, onLoad]);

  return (
    <div ref={box} className={`relative ${className}`}>
      {ready && (
        <model-viewer
          ref={mv}
          src={src}
          alt={alt}
          camera-orbit={orbit}
          {...(autoRotate ? { "auto-rotate": "", "auto-rotate-delay": "0", "rotation-per-second": rotateSpeed } : {})}
          {...(interactive ? { "camera-controls": "", "disable-zoom": "", "disable-pan": "" } : {})}
          interaction-prompt="none"
          interpolation-decay={String(decay)}
          shadow-intensity={String(shadow)}
          shadow-softness="0.9"
          exposure={String(exposure)}
          environment-image="neutral"
          tone-mapping="aces"
          loading="eager"
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            opacity: loaded ? 1 : 0,
            transition: "opacity 900ms ease-out",
            ["--poster-color" as string]: "transparent",
            ["--progress-bar-color" as string]: "transparent",
          }}
        />
      )}
    </div>
  );
});

export default Model;
