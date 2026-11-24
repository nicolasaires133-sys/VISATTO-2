// Busca do cardápio que entende o jeito de falar: sinônimos ("refri" acha Coca e Guaraná),
// sem acento, e com um errinho de digitação ("lazanha", "piza", "cappucino").

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// palavra buscada → palavras que também valem
const SYN: Record<string, string[]> = {
  refri: ["refrigerante", "coca", "guarana", "soda", "fanta", "sprite", "pepsi", "lata"],
  refrigerante: ["refri", "coca", "guarana", "soda", "lata"],
  bebida: ["refrigerante", "suco", "agua", "cerveja", "vinho", "chope", "drink", "cafe", "cha"],
  cerveja: ["chope", "chopp", "beer", "long neck"],
  chope: ["cerveja", "chopp"],
  doce: ["sobremesa", "bolo", "torta", "pudim", "sorvete", "mousse", "tiramisu", "brownie", "petit"],
  sobremesa: ["doce", "bolo", "torta", "pudim", "sorvete", "mousse", "tiramisu"],
  massa: ["macarrao", "espaguete", "penne", "talharim", "nhoque", "lasanha", "ravioli", "fettuccine", "spaghetti"],
  macarrao: ["massa", "espaguete", "penne", "talharim", "spaghetti"],
  lanche: ["hamburguer", "burger", "sanduiche", "x-"],
  hamburguer: ["burger", "lanche", "x-"],
  vegetariano: ["vegano", "veg", "sem carne"],
  vegano: ["vegetariano", "veg", "plant"],
  "sem carne": ["vegetariano", "vegano"],
  carne: ["picanha", "file", "bife", "costela", "alcatra", "maminha", "boi"],
  frango: ["galinha", "chicken"],
  peixe: ["salmao", "tilapia", "bacalhau", "atum"],
  agua: ["water", "com gas", "sem gas"],
  cafe: ["espresso", "expresso", "cappuccino", "capuccino", "latte"],
  suco: ["juice", "limonada", "laranja"],
  vinho: ["taca", "tinto", "branco", "rose", "espumante"],
  drink: ["caipirinha", "gin", "coquetel", "drinque"],
  crianca: ["kids", "infantil", "kid"],
  infantil: ["kids", "crianca"],
  entrada: ["petisco", "porcao", "aperitivo", "bruschetta"],
  petisco: ["entrada", "porcao", "aperitivo"],
  porcao: ["petisco", "entrada"],
  gluten: ["sem gluten", "celiaco"],
  lactose: ["sem lactose", "zero lactose"],
  picante: ["apimentado", "pimenta", "spicy"],
};

function dist(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Quão bem uma palavra buscada casa com o texto (0 = não casa). */
function wordScore(w: string, text: string, words: string[]) {
  if (text.includes(w)) return 3;
  for (const s of SYN[w] ?? []) {
    // sinônimo precisa casar com a palavra inteira ("bolo" não pode achar "bolonhesa")
    if (s.includes(" ") || s.endsWith("-") ? text.includes(s) : words.some((t) => t === s || (t.startsWith(s) && t.length - s.length <= 3))) return 2;
  }
  if (w.length >= 4) {
    const max = w.length >= 8 ? 2 : 1;
    for (const t of words) {
      if (t.length < 3) continue;
      // compara com a palavra inteira e com o começo dela ("lazan" → "lasanha")
      if (dist(w, t, max) <= max || (t.length > w.length && dist(w, t.slice(0, w.length), max) <= max)) return 1;
    }
  }
  return 0;
}

/** Filtra e ordena: nome casando vale mais que descrição; todas as palavras precisam casar. */
export function searchMenu<T>(list: T[], query: string, fields: (x: T) => { name: string; rest: string }): T[] {
  const q = norm(query).replace(/[^a-z0-9\s-]/g, " ").trim();
  if (q.length < 2) return [];
  const phrase = SYN[q] ? [q] : null;
  const ws = phrase ?? q.split(/\s+/).filter((w) => w.length > 1 && !["de", "da", "do", "com", "sem", "e", "o", "a", "um", "uma"].includes(w));
  const terms = ws.length ? ws : [q];
  const scored: { x: T; s: number }[] = [];
  for (const x of list) {
    const f = fields(x);
    const name = norm(f.name);
    const all = `${name} ${norm(f.rest)}`;
    const words = all.split(/[^a-z0-9]+/).filter(Boolean);
    let s = 0;
    let okAll = true;
    for (const w of terms) {
      const sc = wordScore(w, all, words);
      if (!sc) { okAll = false; break; }
      s += sc + (name.includes(w) ? 3 : 0);
    }
    if (okAll) scored.push({ x, s });
  }
  return scored.sort((a, b) => b.s - a.s).map((r) => r.x);
}
