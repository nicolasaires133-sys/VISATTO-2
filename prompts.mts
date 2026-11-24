// Gera a lista de frases (em inglês) que viram vetores no rotulos.py.
import fs from "node:fs";
import { DISHES, PARTS, DISH_TEMPLATES, PART_TEMPLATES } from "../../src/lib/scan/pratos.ts";
const fill = (ts: string[], en: string[]) => en.flatMap((e) => ts.map((t) => t.replace("{}", e)));
const out = {
  pratos: DISHES.map((d) => ({ id: d.id, frases: fill(DISH_TEMPLATES, d.en) })),
  partes: PARTS.map((p) => ({ id: p.id, frases: fill(PART_TEMPLATES, p.en) })),
};
fs.writeFileSync(process.argv[2] || "/tmp/frases.json", JSON.stringify(out, null, 1));
console.log("pratos", out.pratos.length, "partes", out.partes.length, "frases", out.pratos.reduce((s, d) => s + d.frases.length, 0) + out.partes.reduce((s, d) => s + d.frases.length, 0));
