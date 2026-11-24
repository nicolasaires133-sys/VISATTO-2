// Prepara um modelo 3D (GLB) para realidade aumentada no celular:
// - aceita arquivos com compressão Draco/Meshopt e texturas WebP;
// - limpa, reduz polígonos e texturas para abrir rápido em qualquer celular;
// - coloca o prato com a base em cima da mesa (y = 0) e centralizado;
// - ajusta a escala para o tamanho REAL informado (1 unidade = 1 metro), que é o que o
//   AR usa com ar-scale="fixed" (Android: WebXR/Scene Viewer; iPhone: Quick Look).
import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { center, dedup, getBounds, prune, simplify, textureCompress, weld, flatten } from "@gltf-transform/functions";

const MAX_TRIANGLES = 120_000;
const MAX_TEXTURE = 2048;

let ioPromise: Promise<NodeIO> | null = null;

async function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      const { MeshoptDecoder, MeshoptEncoder } = await import("meshoptimizer");
      await MeshoptDecoder.ready;
      await MeshoptEncoder.ready;
      // @ts-expect-error módulo sem tipos
      const draco3d = (await import("draco3dgltf")).default;
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          "draco3d.decoder": await draco3d.createDecoderModule(),
          "meshopt.decoder": MeshoptDecoder,
          "meshopt.encoder": MeshoptEncoder,
        });
    })().catch((e) => {
      ioPromise = null;
      throw e;
    });
  }
  return ioPromise;
}

export type ModelDims = { w: number; d: number; h: number }; // centímetros

function triangleCount(doc: Document) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute("POSITION");
      const mode = prim.getMode();
      if (mode !== 4) continue; // só TRIANGLES
      n += idx ? idx.getCount() / 3 : (pos?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(n);
}

function dims(doc: Document): ModelDims {
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const r = (v: number) => Math.round(v * 1000) / 10; // m -> cm com 1 casa
  return { w: r(max[0] - min[0]), d: r(max[2] - min[2]), h: r(max[1] - min[1]) };
}

export type PrepareOptions = {
  /** Maior medida horizontal real do prato/travessa em centímetros. Se ausente, mantém a escala do arquivo. */
  widthCm?: number | null;
  /** Medidas reais do escâner (cm). Ajusta a largura e também a ALTURA (o 3D da IA costuma errar a profundidade). */
  targetDims?: { w: number; d: number; h: number } | null;
};

export async function prepareModel(input: Uint8Array, opts: PrepareOptions = {}): Promise<{ glb: Uint8Array; dims: ModelDims; triangles: number }> {
  const io = await getIO();
  let doc: Document;
  try {
    doc = await io.readBinary(input);
  } catch {
    throw new Error("Arquivo 3D inválido. Envie um arquivo .glb (glTF binário).");
  }
  const root = doc.getRoot();
  if (!root.listMeshes().length) throw new Error("O arquivo não tem nenhum objeto 3D.");

  // Uma única cena
  let scene = root.getDefaultScene() || root.listScenes()[0];
  if (!scene) {
    scene = doc.createScene("Scene");
    for (const n of root.listNodes()) if (!n.getParentNode()) scene.addChild(n);
  }
  root.setDefaultScene(scene);
  for (const s of root.listScenes()) if (s !== scene) s.dispose();

  // Animações e câmeras não fazem sentido para um prato
  for (const a of root.listAnimations()) a.dispose();
  for (const c of root.listCameras()) c.dispose();

  await doc.transform(dedup(), flatten(), weld(), prune());

  // Reduz polígonos se o modelo for pesado demais para o celular
  const tris = triangleCount(doc);
  if (tris > MAX_TRIANGLES) {
    const { MeshoptSimplifier } = await import("meshoptimizer");
    await MeshoptSimplifier.ready;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / tris, error: 0.002 }));
  }

  // Texturas: no máximo 2048px e formatos aceitos por todos (PNG/JPEG); WebP/KTX2 viram PNG.
  const sharp = (await import("sharp")).default;
  const needsConversion = root.listTextures().some((t) => !["image/png", "image/jpeg"].includes(t.getMimeType()));
  await doc.transform(
    textureCompress({ encoder: sharp, resize: [MAX_TEXTURE, MAX_TEXTURE], ...(needsConversion ? { targetFormat: "png" } : {}) })
  );
  for (const ext of root.listExtensionsUsed()) {
    const name = ext.extensionName;
    if (["EXT_texture_webp", "EXT_texture_avif", "KHR_draco_mesh_compression", "EXT_meshopt_compression"].includes(name)) ext.dispose();
  }

  // Base do prato em y=0 e centro em x=z=0
  await doc.transform(center({ pivot: "below" }));

  // Escala real
  const scene2 = root.getDefaultScene()!;
  const before = getBounds(scene2);
  const horizontal = Math.max(before.max[0] - before.min[0], before.max[2] - before.min[2]);
  if (!(horizontal > 0)) throw new Error("Não foi possível medir o modelo.");
  const target = opts.targetDims && opts.targetDims.w > 0 && opts.targetDims.h > 0 ? opts.targetDims : null;
  const widthCm = target ? Math.max(target.w, target.d) : opts.widthCm;
  if (widthCm && widthCm > 0) {
    const factor = widthCm / 100 / horizontal;
    let fy = factor;
    if (target) {
      const height = before.max[1] - before.min[1];
      if (height > 0) {
        // altura medida, limitada a no máximo 2x de diferença em relação à proporção original (evita deformar demais)
        fy = Math.min(factor * 2, Math.max(factor * 0.5, target.h / 100 / height));
      }
    }
    const wrapper = doc.createNode("Visatto_Escala").setScale([factor, fy, factor]);
    for (const child of scene2.listChildren()) {
      scene2.removeChild(child);
      wrapper.addChild(child);
    }
    scene2.addChild(wrapper);
  }

  const d = dims(doc);
  if (d.w > 300 || d.d > 300 || d.h > 300) {
    throw new Error(`O modelo ficou com ${Math.max(d.w, d.d, d.h)} cm. Informe a largura real do prato em centímetros.`);
  }
  const glb = await io.writeBinary(doc);
  return { glb, dims: d, triangles: triangleCount(doc) };
}
