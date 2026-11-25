// Prepara os modelos gerados (tools/out) para o site: demonstração em public/demo, modelos prontos em public/templates.
// Uso: npx tsx tools/prepare-foods.mts
import fs from "node:fs";
import { prepareModel } from "../src/lib/model3d";

const DEMO = ["pizza", "lasanha", "shawarma", "acai", "pudim", "brownie"];
const TEMPLATES = ["pizza-caixa", "acai", "marmita"];
for (const [list, dir] of [[DEMO, "demo"], [TEMPLATES, "templates"]] as const) {
  for (const name of list) {
    const src = fs.readFileSync(new URL(`./out/${name}.glb`, import.meta.url));
    const { glb, dims, triangles } = await prepareModel(src, { keepAnimations: name === "acai" });
    fs.writeFileSync(new URL(`../public/${dir}/${name}.glb`, import.meta.url), glb);
    console.log(dir, name, JSON.stringify(dims), triangles, Math.round(glb.length / 1024) + " KB");
  }
}
