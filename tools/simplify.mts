// Versão mais leve de um .glb (para o arquivo do iPhone). Uso: npx tsx tools/simplify.mts entrada.glb saida.glb 0.4
import { NodeIO } from "@gltf-transform/core";
import { simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
await MeshoptSimplifier.ready;
const [src, out, ratio] = process.argv.slice(2);
const io = new NodeIO(); const d = await io.read(src);
await d.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratio), error: 0.0005 }));
await io.write(out, d);
