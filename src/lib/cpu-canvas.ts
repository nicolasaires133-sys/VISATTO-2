// Canvas 2D no processador durante exportações de 3D (ver explicação abaixo).

/**
 * Roda `fn` com as telinhas de desenho (canvas 2D) no processador, não na placa de vídeo.
 * Os exportadores de 3D desenham cada textura num canvas e pedem o PNG/JPEG dele: num canvas acelerado essa leitura
 * de volta pode demorar minutos (visto em navegador com a placa de vídeo ocupada); no processador leva milissegundos.
 */
export async function withCpuCanvas<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof HTMLCanvasElement === "undefined") return fn();
  const proto = HTMLCanvasElement.prototype as any, orig = proto.getContext;
  proto.getContext = function (type: string, attrs?: any) {
    return orig.call(this, type, type === "2d" ? { ...(attrs || {}), willReadFrequently: true } : attrs);
  };
  try {
    return await fn();
  } finally {
    proto.getContext = orig;
  }
}
