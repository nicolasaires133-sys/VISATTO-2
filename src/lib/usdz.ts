// Ajustes no arquivo USDZ (o 3D que o iPhone abre na câmera, pelo Quick Look da Apple).
//
// 1. Ancoragem de verdade: o arquivo já pedia "pousar numa superfície horizontal", mas faltava declarar o
//    esquema Preliminary_AnchoringAPI no nó da cena. Sem isso o iPhone ignora o pedido, mostra o prato
//    pequeno e transparente voando na frente da câmera e larga ele na primeira coisa que encontrar.
//    Com o esquema, o iPhone espera achar a mesa (com a animação de "mova o celular") e só então mostra o prato.
// 2. Texturas em JPEG em vez de PNG: o arquivo fica bem menor e a câmera abre mais rápido.
// 3. Alinhamento de 64 bytes exigido pelo formato USDZ (zip sem compressão).
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export type JpegEncoder = (png: Uint8Array) => Promise<Uint8Array>;

export function fixUsdaText(text: string) {
  // declara o esquema de ancoragem no nó que tem as propriedades preliminary:anchoring
  if (!text.includes("Preliminary_AnchoringAPI")) {
    text = text.replace(/def Xform "Scene" \(\n/, 'def Xform "Scene" (\n\t\t\tprepend apiSchemas = ["Preliminary_AnchoringAPI"]\n');
  }
  // a Apple declara essas propriedades como "uniform token"
  text = text.replace(/(\n\s*)token preliminary:(anchoring:type|planeAnchoring:alignment)/g, "$1uniform token preliminary:$2");
  return text;
}

/** Monta o zip do USDZ com cada arquivo começando num múltiplo de 64 bytes (exigência do formato). */
export function zipUsdz(files: Record<string, Uint8Array>) {
  const out: Record<string, [Uint8Array, { extra?: Record<number, Uint8Array>; level: 0 }]> = {};
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameLen = strToU8(name).length;
    // cabeçalho local = 30 bytes + nome + campo extra (4 bytes de cabeçalho + enchimento)
    const base = offset + 30 + nameLen + 4;
    const pad = (64 - (base % 64)) % 64;
    out[name] = [data, { extra: { 12345: new Uint8Array(pad) }, level: 0 }];
    offset = base + pad + data.length;
  }
  return zipSync(out as never, { level: 0 });
}

export async function fixUsdz(bytes: Uint8Array, toJpeg?: JpegEncoder) {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const model = names.find((n) => n.endsWith(".usda") && !n.includes("/")) ?? "model.usda";
  let usda = strFromU8(files[model]);
  usda = fixUsdaText(usda);
  // textura usada como transparência não pode virar JPEG (JPEG não tem transparência)
  if (/opacity\.connect/.test(usda)) toJpeg = undefined;
  const result: Record<string, Uint8Array> = {};
  const renamed: Record<string, Uint8Array> = {};
  for (const n of names) {
    if (n === model) continue;
    if (toJpeg && /\.png$/i.test(n)) {
      try {
        const jpg = await toJpeg(files[n]);
        if (jpg.length < files[n].length) {
          const jn = n.replace(/\.png$/i, ".jpg");
          usda = usda.split(n).join(jn);
          renamed[jn] = jpg;
          continue;
        }
      } catch {
        // textura com transparência ou erro: fica o PNG original
      }
    }
    renamed[n] = files[n];
  }
  // o arquivo principal precisa ser o primeiro do pacote
  result[model] = strToU8(usda);
  // as geometrias também são .usda e podem citar as texturas
  for (const [n, d] of Object.entries(renamed)) {
    if (n.endsWith(".usda")) {
      let t = strFromU8(d);
      for (const k of names) if (/\.png$/i.test(k) && renamed[k.replace(/\.png$/i, ".jpg")]) t = t.split(k).join(k.replace(/\.png$/i, ".jpg"));
      result[n] = strToU8(t);
    } else result[n] = d;
  }
  return zipUsdz(result);
}
