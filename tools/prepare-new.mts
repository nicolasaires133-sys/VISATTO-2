// Prepara as pizzas e hambúrgueres novos (tools/out) para o site.
// Uso: npx tsx tools/prepare-new.mts
import fs from "node:fs";
import { prepareModel } from "../src/lib/model3d";

const PIZZAS = ["mussarela", "margherita", "frango-catupiry", "frango-bacon", "bacon-cheddar", "portuguesa", "quatro-queijos", "pepperoni", "brigadeiro"];
const BURGERS = ["x-burger", "x-salada", "x-egg", "x-bacon", "x-tudo"];
const jobs: [string, string][] = [
  ...PIZZAS.map((p) => [`pizza-${p}`, "demo"] as [string, string]),
  ...PIZZAS.map((p) => [`pizza-caixa-${p}`, "templates"] as [string, string]),
  ...BURGERS.map((b) => [`burger-${b}`, "demo"] as [string, string]),
];
for (const [name, dir] of jobs) {
  const { glb, dims, triangles } = await prepareModel(fs.readFileSync(new URL(`./out/${name}.glb`, import.meta.url)));
  fs.writeFileSync(new URL(`../public/${dir}/${name}.glb`, import.meta.url), glb);
  console.log(dir, name, JSON.stringify(dims), triangles, Math.round(glb.length / 1024) + " KB");
}
