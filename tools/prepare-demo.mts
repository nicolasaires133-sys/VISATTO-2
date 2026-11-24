// Passa os modelos de demonstração pelo mesmo preparo usado para os restaurantes
import fs from "node:fs";
import { prepareModel } from "../src/lib/model3d.ts";
const sizes: Record<string, number> = { pizza: 40, lasanha: 26, tiramisu: 22 };
fs.mkdirSync("public/demo", { recursive: true });
for (const [name, width] of Object.entries(sizes)) {
  const src = fs.readFileSync(`tools/out/${name}.glb`);
  const { glb, dims, triangles } = await prepareModel(src, { widthCm: width });
  fs.writeFileSync(`public/demo/${name}.glb`, glb);
  console.log(name, dims, triangles, "triângulos", Math.round(glb.length / 1024), "KB");
}
