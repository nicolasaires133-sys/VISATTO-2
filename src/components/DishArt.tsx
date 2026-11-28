// Ilustração do prato quando o restaurante ainda não pôs foto.
// Escolhe o desenho pelo nome e pela descrição (pizza, massa, salada, bebida, sobremesa...), para o cardápio
// não ficar cheio de quadrados vazios. Desenhos simples, sem marca nenhuma, iguais em todo celular.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type Art =
  | "pizza" | "massa" | "nhoque" | "lasanha" | "salada" | "torrada" | "queijo" | "hamburguer" | "carne" | "frango"
  | "peixe" | "sushi" | "sopa" | "batata" | "bolo" | "pudim" | "sorvete" | "acai" | "refri" | "suco" | "vinho"
  | "cerveja" | "agua" | "cafe" | "drink" | "prato";

const RULES: [Art, RegExp][] = [
  ["pizza", /pizza|calzone|esfiha|esfirra/],
  ["lasanha", /lasanha|lasagna|parmegian/],
  ["nhoque", /nhoque|gnocchi|ravioli|capeletti|cappelletti|tortel/],
  ["massa", /massa|espaguete|spaghetti|penne|talharim|fettuccine|macarr|risoto|risotto|yakisoba|lamen|ramen|carbonara|pasta/],
  ["hamburguer", /hamburg|burger|x-|cheese ?(bacon|salada|tudo)|sanduich|lanche|hot ?dog|cachorro/],
  ["sushi", /sushi|sashimi|temaki|uramaki|hossomaki|niguiri|poke/],
  ["peixe", /peixe|salm[aã]o|til[aá]pia|bacalhau|camar[aã]o|moqueca|lula|polvo|fruto/],
  ["frango", /frango|galinha|coxinha|asinha|chicken|nugget/],
  ["carne", /carne|picanha|fil[eé]|bife|costela|maminha|alcatra|steak|churrasc|cupim|fraldinha|lombo|porco|bisteca|parrilla|feijoada|strogonoff|estrogonofe|prato feito|executivo|pf\b/],
  ["sopa", /sopa|caldo|creme de|consom/],
  ["batata", /batata|fritas|mandioca|aipim|polenta|onion|isca/],
  ["salada", /salada|salad|caprese|verde|folhas|bowl|ceviche/],
  ["torrada", /bruschett|torrada|p[aã]o|crostini|focaccia|toast|panini|baguete|croissant|misto/],
  ["queijo", /burrata|queijo|mu[cç]arela|provolone|brie|fondue|t[aá]bua|frios|antepasto/],
  ["sorvete", /sorvete|gelato|picol[eé]|sundae|milk ?shake|casquinha/],
  ["acai", /a[cç]a[ií]|cupua/],
  ["pudim", /pudim|panna ?cotta|flan|mousse|creme brul|pav[eê]|brigadeiro|quindim/],
  ["bolo", /bolo|torta|tiramis|cheesecake|brownie|petit|doce|sobremesa|cake|cookie|churros|waffle|panqueca|crepe/],
  ["vinho", /vinho|wine|ta[cç]a|espumante|champagne|prosecco|ros[eé]|sangria/],
  ["cerveja", /cerveja|chope|chopp|beer|ipa\b|lager|pilsen/],
  ["drink", /caipirinha|caipiroska|drink|gin|mojito|negroni|spritz|coquetel|whisky|dose|martini|margarita/],
  ["cafe", /caf[eé]|espresso|cappuccino|capuccino|latte|ch[aá]\b|chocolate quente|mocha/],
  ["suco", /suco|limonada|vitamina|smoothie|laranja|juice/],
  ["agua", /[aá]gua|water|t[oô]nica/],
  ["refri", /refri|coca|guaran[aá]|soda|lata|cola|fanta|sprite|pepsi|kuat|mate/],
];

export function artFor(name: string, extra = ""): Art {
  const n = norm(name);
  for (const [a, re] of RULES) if (re.test(n)) return a;
  const e = norm(extra);
  for (const [a, re] of RULES) if (re.test(e)) return a;
  return "prato";
}

const BG: Record<Art, string> = {
  pizza: "#F6E2CF", massa: "#F6E7C8", nhoque: "#F6E7C8", lasanha: "#F4E0CC", salada: "#E2EDD6", torrada: "#F3E4CF",
  queijo: "#EFEBDF", hamburguer: "#F5E1CB", carne: "#F1DFD6", frango: "#F5E6CC", peixe: "#DDEAF0", sushi: "#E6ECE4",
  sopa: "#F5E5CF", batata: "#F7EAC6", bolo: "#F3E0E3", pudim: "#F6E7CF", sorvete: "#F2E2EA", acai: "#E9E0EE",
  refri: "#F3DEDA", suco: "#FBE8CD", vinho: "#F0DEE3", cerveja: "#F7EBC8", agua: "#DCEBF2", cafe: "#EEE3D8",
  drink: "#E2EFDF", prato: "#ECE9E2",
};

const plate = (r = 38) => (
  <>
    <ellipse cx="50" cy="54" rx={r} ry={r} fill="#000" opacity=".06" />
    <circle cx="50" cy="50" r={r} fill="#fff" />
    <circle cx="50" cy="50" r={r - 7} fill="#f6f4ef" />
  </>
);
const shadow = (cx = 50, cy = 88, rx = 26) => <ellipse cx={cx} cy={cy} rx={rx} ry="4.5" fill="#000" opacity=".08" />;
const leaf = (x: number, y: number, r: number) => (
  <ellipse cx={x} cy={y} rx="4.2" ry="2.3" fill="#4f8a3a" transform={`rotate(${r} ${x} ${y})`} />
);

function Drawing({ art }: { art: Art }) {
  switch (art) {
    case "pizza":
      return (
        <>
          <circle cx="50" cy="53" r="38" fill="#000" opacity=".07" />
          <circle cx="50" cy="50" r="38" fill="#d9954a" />
          <circle cx="50" cy="50" r="32" fill="#c8402b" />
          <path d="M22 46c6-10 18-16 30-15 12 1 22 8 26 19-3 12-14 20-27 20-14 0-26-9-29-24Z" fill="#f4cf74" />
          {[[38, 40], [60, 38], [47, 58], [66, 57], [32, 58], [54, 48]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4.6" fill="#b93226" />)}
          {leaf(45, 44, 30)}{leaf(62, 64, -20)}{leaf(30, 50, 70)}
        </>
      );
    case "massa":
      return (
        <>
          {plate()}
          <circle cx="50" cy="50" r="24" fill="#efc56a" />
          {[20, 16, 12, 8].map((r, k) => (
            <path key={r} d={`M${50 - r} ${50 + k}a${r} ${r - 2} 0 1 1 ${r * 2} 0a${r - 3} ${r - 4} 0 1 1 ${-(r * 2 - 4)} 0`} fill="none" stroke={k % 2 ? "#e2ad4c" : "#f7d98d"} strokeWidth="2.6" strokeLinecap="round" />
          ))}
          <path d="M40 46c3-7 17-7 20 0 2 5-4 10-10 10s-12-5-10-10Z" fill="#c8402b" />
          <circle cx="46" cy="47" r="1.6" fill="#fff" opacity=".6" />
          {leaf(54, 44, 20)}{leaf(47, 43, -30)}
        </>
      );
    case "nhoque":
      return (
        <>
          {plate()}
          <path d="M24 50c2-14 16-22 26-22s24 8 26 22c-2 14-14 22-26 22S26 64 24 50Z" fill="#c8402b" />
          {[[38, 42], [50, 38], [62, 43], [34, 54], [47, 52], [60, 55], [42, 63], [55, 64]].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="6" ry="4.2" fill="#f3dc9a" stroke="#d9b35d" strokeWidth="1" />
          ))}
          {leaf(50, 46, -10)}
        </>
      );
    case "lasanha":
      return (
        <>
          {plate()}
          <path d="M28 44l24-9 20 9v18l-24 9-20-9Z" fill="#e7b14d" />
          <path d="M28 44l24-9 20 9-24 9Z" fill="#f2cc6f" />
          {[49, 55, 61].map((y) => <path key={y} d={`M28 ${y - 2}l20 9 24-9`} fill="none" stroke="#b93226" strokeWidth="2.6" />)}
          <path d="M33 44l18-6 14 5" fill="none" stroke="#c97f2f" strokeWidth="2" strokeLinecap="round" opacity=".6" />
        </>
      );
    case "salada":
      return (
        <>
          <circle cx="50" cy="54" r="36" fill="#000" opacity=".06" />
          <circle cx="50" cy="50" r="36" fill="#fff" />
          {[[38, 40, 20], [56, 36, -30], [64, 52, 60], [40, 60, -60], [52, 62, 10], [30, 50, 90], [48, 48, 45]].map(([x, y, r]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="11" ry="6.5" fill={r > 0 ? "#78b04e" : "#5c9a3d"} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          {[[46, 38], [60, 58], [36, 54]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#d8432f" />)}
          <circle cx="54" cy="46" r="3.5" fill="#f3e3a6" />
        </>
      );
    case "torrada":
      return (
        <>
          {shadow(50, 74, 36)}
          {[[18, 36], [52, 40]].map(([x, y], k) => (
            <g key={k} transform={`rotate(${k ? 8 : -6} ${x + 16} ${y + 14})`}>
              <rect x={x} y={y} width="32" height="28" rx="9" fill="#c98a42" />
              <rect x={x + 3} y={y + 3} width="26" height="22" rx="7" fill="#e9b765" />
              {[[8, 8], [17, 10], [12, 17], [21, 18]].map(([a, b]) => <rect key={`${a}${b}`} x={x + a} y={y + b} width="5" height="5" rx="1.2" fill="#d23a2a" />)}
              {leaf(x + 14, y + 13, 25)}
            </g>
          ))}
        </>
      );
    case "queijo":
      return (
        <>
          {plate()}
          <circle cx="50" cy="51" r="17" fill="#000" opacity=".06" />
          <circle cx="50" cy="48" r="16" fill="#fff6dd" stroke="#e4d3a8" strokeWidth="1.6" />
          <path d="M41 45c4-5 13-5 17 1" fill="none" stroke="#ecdcb2" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M46 54c3 2 7 2 9 0" fill="none" stroke="#e9d39c" strokeWidth="2" strokeLinecap="round" />
          {[[30, 58], [68, 58], [50, 70], [33, 40], [68, 38]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="5.2" fill="#d8432f" />)}
          {leaf(60, 66, 30)}{leaf(40, 66, -30)}
          <circle cx="47" cy="44" r="2" fill="#5f9a40" opacity=".8" />
        </>
      );
    case "hamburguer":
      return (
        <>
          {shadow(50, 84, 30)}
          <path d="M22 64h56c0 6-5 12-12 12H34c-7 0-12-6-12-12Z" fill="#d9954a" />
          <rect x="20" y="55" width="60" height="10" rx="5" fill="#6b3a24" />
          <path d="M20 54c6 4 10-2 15 2s9-2 15 2 10-2 15 2 9-2 15 0v-3H20Z" fill="#f2c13d" />
          <path d="M19 51c5 3 9-1 13 2s8-2 13 1 9-2 13 1 9-2 13 1 6-1 9-2v-4H19Z" fill="#6fae46" />
          <path d="M22 48c0-14 12-22 28-22s28 8 28 22Z" fill="#e2a052" />
          {[[38, 36], [50, 33], [61, 37], [45, 42], [57, 43]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.8" ry="1" fill="#fbe9c4" />)}
        </>
      );
    case "carne":
      return (
        <>
          {plate()}
          <path d="M30 44c4-10 22-14 34-6 8 6 6 18-4 22-10 5-26 4-30-4-2-4-2-8 0-12Z" fill="#8c3b25" />
          <path d="M34 46c4-6 18-9 27-4" fill="none" stroke="#6d2a18" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M36 54c6 2 16 2 22-2" fill="none" stroke="#6d2a18" strokeWidth="2.4" strokeLinecap="round" />
          {[[64, 64], [70, 58], [60, 70]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 4} y={y - 2} width="9" height="4" rx="2" fill="#f2c96a" transform={`rotate(-30 ${x} ${y})`} />)}
          {leaf(34, 64, 40)}{leaf(40, 68, -10)}
        </>
      );
    case "frango":
      return (
        <>
          {plate()}
          <path d="M33 56c-6-10 2-24 16-24 12 0 20 8 18 18-2 9-10 13-18 13-6 0-12-2-16-7Z" fill="#d79a45" />
          <path d="M60 58l9 9" stroke="#efe3cc" strokeWidth="5" strokeLinecap="round" />
          <circle cx="71" cy="68" r="4" fill="#efe3cc" />
          <path d="M40 44c4-5 12-6 18-2" fill="none" stroke="#b9772c" strokeWidth="2.2" strokeLinecap="round" />
          {leaf(36, 66, 20)}
        </>
      );
    case "peixe":
      return (
        <>
          {plate()}
          <path d="M24 50c8-12 30-14 42-4l10-8v24l-10-8c-12 10-34 8-42-4Z" fill="#f0a27c" />
          <path d="M36 44c4 4 4 8 0 12M46 42c4 5 4 11 0 16M56 43c3 5 3 9 0 14" fill="none" stroke="#fbe1d2" strokeWidth="2" />
          <path d="M30 66h14" stroke="#f2d74e" strokeWidth="5" strokeLinecap="round" />
          {leaf(58, 66, 15)}
        </>
      );
    case "sushi":
      return (
        <>
          <rect x="14" y="40" width="72" height="30" rx="6" fill="#4b3a2c" opacity=".9" />
          {[24, 44, 64].map((x, k) => (
            <g key={x}>
              <rect x={x - 8} y="38" width="22" height="16" rx="7" fill="#fbfaf5" />
              <path d={`M${x - 9} 40c4-8 18-8 24 0v4h-24Z`} fill={k === 1 ? "#e9603e" : "#f08a63"} />
              <path d={`M${x - 4} 37l4 4M${x + 4} 37l4 4`} stroke="#fff" strokeWidth="1.5" opacity=".7" />
            </g>
          ))}
          <ellipse cx="72" cy="64" rx="6" ry="3" fill="#7fbf4e" />
        </>
      );
    case "sopa":
      return (
        <>
          {shadow(50, 80, 32)}
          <path d="M16 46h68c0 18-15 32-34 32S16 64 16 46Z" fill="#fff" />
          <ellipse cx="50" cy="46" rx="34" ry="10" fill="#fff" />
          <ellipse cx="50" cy="46" rx="29" ry="7.5" fill="#e39a3b" />
          <path d="M38 44c3 2 7 2 10 0M54 47c3 2 7 2 10 0" fill="none" stroke="#f5c46e" strokeWidth="2" strokeLinecap="round" />
          {leaf(50, 44, 0)}
          <path d="M40 30c-3-4 3-6 0-10M52 30c-3-4 3-6 0-10M64 30c-3-4 3-6 0-10" fill="none" stroke="#000" opacity=".12" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "batata":
      return (
        <>
          {shadow(50, 84, 24)}
          {[[34, -10], [40, -4], [46, -12], [52, 2], [58, -6], [64, 8], [44, 6], [56, 12]].map(([x, r], k) => (
            <rect key={k} x={x - 3} y="20" width="7" height="42" rx="2" fill={k % 2 ? "#f3c64f" : "#e9b33d"} transform={`rotate(${r} ${x} 60)`} />
          ))}
          <path d="M28 46h44l-5 34H33Z" fill="#d23a2a" />
          <path d="M28 46h44l-1 7H29Z" fill="#b52b1f" />
        </>
      );
    case "bolo":
      return (
        <>
          {shadow(50, 82, 30)}
          <path d="M20 54l52-20 10 10v22L30 82 20 72Z" fill="#7b4a2f" />
          <path d="M20 54l52-20 10 10-52 22Z" fill="#f3e4c9" />
          <path d="M20 62l10 4 52-22M20 68l10 4 52-22" fill="none" stroke="#f3e4c9" strokeWidth="3" />
          <path d="M30 66v16" stroke="#5d3520" strokeWidth="1.2" />
          <circle cx="60" cy="42" r="4.5" fill="#c8302b" />
          {leaf(66, 40, 30)}
        </>
      );
    case "pudim":
      return (
        <>
          {plate(36)}
          <path d="M32 62c0-14 6-26 18-26s18 12 18 26Z" fill="#f5e3b8" />
          <path d="M32 62c0-6 2-11 4-14 4 3 9 4 14 4s10-1 14-4c2 3 4 8 4 14Z" fill="#f5e3b8" />
          <path d="M36 40c4-4 9-5 14-5s10 1 14 5c-4 4-9 6-14 6s-10-2-14-6Z" fill="#c8302b" />
          <path d="M37 42c-1 6-1 10 0 14M63 42c1 6 1 10 0 14" stroke="#c8302b" strokeWidth="3" strokeLinecap="round" />
          {[[44, 38], [54, 37]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill="#7b1e3a" />)}
          {leaf(50, 34, 0)}
        </>
      );
    case "sorvete":
      return (
        <>
          {shadow(50, 88, 14)}
          <path d="M38 50h24L50 88Z" fill="#dca45a" />
          <path d="M40 54l18 12M42 62l13 9M58 54l-16 14" stroke="#b98238" strokeWidth="1.5" />
          <circle cx="42" cy="44" r="11" fill="#f5c5d2" />
          <circle cx="58" cy="44" r="11" fill="#fbf1d6" />
          <circle cx="50" cy="31" r="11" fill="#8b5a3c" />
          <circle cx="50" cy="20" r="3.5" fill="#c8302b" />
        </>
      );
    case "acai":
      return (
        <>
          {shadow(50, 82, 28)}
          <path d="M22 46h56c0 18-12 32-28 32S22 64 22 46Z" fill="#fff" />
          <ellipse cx="50" cy="46" rx="28" ry="9" fill="#5b2a5e" />
          {[[38, 44], [46, 41], [56, 43], [62, 47]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.2" fill="#f2d36b" />)}
          <circle cx="44" cy="48" r="3.5" fill="#c8302b" />
          <rect x="52" y="44" width="10" height="4" rx="2" fill="#f5e7b8" />
        </>
      );
    case "refri":
      return (
        <>
          {shadow(50, 88, 18)}
          <path d="M58 10l-8 32" stroke="#172033" strokeWidth="3" strokeLinecap="round" opacity=".75" />
          <path d="M32 30h36l-4 54c0 2-2 4-4 4H40c-2 0-4-2-4-4Z" fill="#fff" opacity=".8" />
          <path d="M33.4 38h33.2l-3.6 46c0 1.4-1.4 2.4-2.8 2.4H39.8c-1.4 0-2.8-1-2.8-2.4Z" fill="#5a2a1d" />
          {[[42, 48], [55, 56], [46, 66]].map(([x, y]) => <rect key={x} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill="#fff" opacity=".45" transform={`rotate(12 ${x} ${y})`} />)}
          {[[40, 78], [58, 72], [52, 80], [60, 46]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill="#fff" opacity=".6" />)}
          <path d="M33 38h34" stroke="#fff" strokeWidth="1.5" opacity=".5" />
        </>
      );
    case "suco":
      return (
        <>
          {shadow(50, 88, 18)}
          <path d="M60 12l-6 28" stroke="#172033" strokeWidth="3" strokeLinecap="round" opacity=".75" />
          <path d="M32 30h36l-4 54c0 2-2 4-4 4H40c-2 0-4-2-4-4Z" fill="#fff" opacity=".8" />
          <path d="M33.4 40h33.2l-3.2 44c0 1.4-1.4 2.4-2.8 2.4H39.4c-1.4 0-2.8-1-2.8-2.4Z" fill="#f4a531" />
          <path d="M38 44l2 30" stroke="#fff" strokeWidth="2.4" opacity=".4" strokeLinecap="round" />
          <circle cx="68" cy="30" r="10" fill="#f6b23a" />
          <circle cx="68" cy="30" r="7" fill="#fbd07a" />
          <path d="M68 23v14M61 30h14M63 25l10 10M73 25 63 35" stroke="#f6b23a" strokeWidth="1" />
        </>
      );
    case "vinho":
      return (
        <>
          {shadow(50, 88, 16)}
          <path d="M34 14h32c0 22-6 34-16 34S34 36 34 14Z" fill="#fff" opacity=".85" />
          <path d="M35 26h30c-1 14-7 22-15 22s-14-8-15-22Z" fill="#8e1f3b" />
          <rect x="48.5" y="47" width="3" height="32" fill="#e8e2d8" />
          <ellipse cx="50" cy="82" rx="13" ry="3.5" fill="#e8e2d8" />
          <path d="M39 30c1 6 3 10 6 13" stroke="#fff" strokeWidth="2" opacity=".35" strokeLinecap="round" />
        </>
      );
    case "cerveja":
      return (
        <>
          {shadow(50, 88, 20)}
          <path d="M64 38h6c5 0 8 4 8 9v12c0 5-3 9-8 9h-6v-7h5c2 0 2-1 2-3V48c0-2 0-3-2-3h-5Z" fill="#fff" opacity=".85" />
          <rect x="28" y="30" width="38" height="56" rx="5" fill="#fff" opacity=".85" />
          <rect x="31" y="36" width="32" height="47" rx="3" fill="#efb22e" />
          <path d="M26 32c0-8 6-12 12-10 3-6 13-6 16 0 6-2 12 2 12 10 0 4-4 6-8 6H34c-4 0-8-2-8-6Z" fill="#fbf7ea" />
          {[[38, 54], [50, 64], [44, 74], [56, 50]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#fbe3a0" />)}
        </>
      );
    case "agua":
      return (
        <>
          {shadow(50, 90, 16)}
          <path d="M44 10h12v8c0 6 8 10 8 20v46c0 3-2 5-5 5H41c-3 0-5-2-5-5V38c0-10 8-14 8-20Z" fill="#cfe7f2" />
          <rect x="43" y="6" width="14" height="6" rx="2" fill="#3b7fb6" />
          <rect x="36" y="50" width="28" height="16" fill="#3b7fb6" />
          <path d="M44 58h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 36c0-6 4-10 6-14" stroke="#fff" strokeWidth="2.4" opacity=".7" strokeLinecap="round" />
        </>
      );
    case "cafe":
      return (
        <>
          <ellipse cx="50" cy="72" rx="32" ry="10" fill="#fff" />
          <ellipse cx="50" cy="71" rx="24" ry="6.5" fill="#efe9de" />
          <path d="M66 46h4c6 0 9 4 9 8s-3 8-9 8h-5v-5h5c2 0 4-1 4-3s-2-3-4-3h-4Z" fill="#fff" />
          <path d="M30 40h38l-4 26c-1 4-4 6-8 6H42c-4 0-7-2-8-6Z" fill="#fff" />
          <ellipse cx="49" cy="40" rx="19" ry="5" fill="#7a4a2c" />
          <path d="M43 39c3 2 9 2 12 0" stroke="#d9b38c" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M42 30c-3-4 3-6 0-10M52 30c-3-4 3-6 0-10" fill="none" stroke="#000" opacity=".12" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "drink":
      return (
        <>
          {shadow(50, 88, 18)}
          <path d="M30 30h40l-4 54c0 2-2 4-4 4H38c-2 0-4-2-4-4Z" fill="#fff" opacity=".8" />
          <path d="M31.4 42h37.2l-3.2 42c0 1.4-1.4 2.4-2.8 2.4H37.4c-1.4 0-2.8-1-2.8-2.4Z" fill="#cfe6b6" />
          {[[42, 52], [55, 60], [46, 70]].map(([x, y]) => <rect key={x} x={x - 5} y={y - 5} width="10" height="10" rx="2" fill="#fff" opacity=".7" transform={`rotate(15 ${x} ${y})`} />)}
          <circle cx="62" cy="36" r="9" fill="#7fbf4e" />
          <circle cx="62" cy="36" r="6" fill="#bfe08f" />
          {leaf(44, 40, -20)}
        </>
      );
    default:
      return (
        <>
          {plate()}
          <path d="M34 54c0-10 7-18 16-18s16 8 16 18Z" fill="#e2a052" />
          <path d="M30 56h40" stroke="#c97f2f" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="35" r="2.6" fill="#c97f2f" />
          {leaf(40, 62, 20)}{leaf(58, 63, -20)}
        </>
      );
  }
}

/** Todos os itens citados (na ordem em que aparecem), para desenhar combos com mais de uma coisa. */
export function artsFor(text: string): Art[] {
  // "X-Salada", "X-Bacon"... são lanches (não salada nem bacon à parte)
  const n = norm(text).replace(/\bx-?\s?(salada|bacon|egg|tudo|burger|frango|calabresa)\b/g, "burger");
  const found: { a: Art; at: number }[] = [];
  for (const [a, re] of RULES) {
    const m = new RegExp(re.source, "g").exec(n);
    if (m && !found.some((f) => f.a === a)) found.push({ a, at: m.index });
  }
  // "massas à escolha" e "lasanha" no mesmo combo: fica um desenho de massa só
  const list = found.sort((x, y) => x.at - y.at).map((f) => f.a);
  return list.filter((a, i) => !(a === "nhoque" && list.includes("massa")) && list.indexOf(a) === i);
}
const isCombo = (name: string, tags?: string[]) => /\bcombo|\bkit\b/.test(norm(name)) || Boolean(tags?.includes("combo"));

/** Combo: 2 ou 3 itens juntos no mesmo quadro (o principal na frente). */
function ComboDrawing({ arts }: { arts: Art[] }) {
  const [a, b, c] = arts;
  if (!c)
    return (
      <>
        <svg x="40" y="8" width="58" height="58" viewBox="0 0 100 100"><Drawing art={b} /></svg>
        <svg x="0" y="30" width="70" height="70" viewBox="0 0 100 100"><Drawing art={a} /></svg>
      </>
    );
  return (
    <>
      <svg x="-2" y="2" width="52" height="52" viewBox="0 0 100 100"><Drawing art={b} /></svg>
      <svg x="50" y="2" width="52" height="52" viewBox="0 0 100 100"><Drawing art={c} /></svg>
      <svg x="17" y="32" width="66" height="66" viewBox="0 0 100 100"><Drawing art={a} /></svg>
    </>
  );
}

/** Desenho do prato sobre um fundo da cor dele. `size` controla o tamanho do desenho dentro do quadro. */
export function DishArt({ name, description = "", className = "", size = 0.72, tags }: { name: string; description?: string; className?: string; size?: number; tags?: string[] }) {
  if (isCombo(name, tags)) {
    let arts = artsFor(`${name} ${description}`).slice(0, 3);
    if (arts.length < 2) arts = [...arts, ...(["hamburguer", "batata", "refri"] as Art[]).filter((x) => !arts.includes(x))].slice(0, 3);
    return (
      <div className={`grid place-items-center overflow-hidden ${className}`} style={{ background: BG[arts[0]] }} aria-hidden="true" data-art={`combo:${arts.join("+")}`}>
        <svg viewBox="0 0 100 100" style={{ width: `${Math.min(0.96, size + 0.2) * 100}%`, height: `${Math.min(0.96, size + 0.2) * 100}%`, maxWidth: 300, maxHeight: 300 }}>
          <ComboDrawing arts={arts} />
        </svg>
      </div>
    );
  }
  const art = artFor(name, description);
  return (
    <div className={`grid place-items-center overflow-hidden ${className}`} style={{ background: BG[art] }} aria-hidden="true" data-art={art}>
      <svg viewBox="0 0 100 100" style={{ width: `${size * 100}%`, height: `${size * 100}%`, maxWidth: 260, maxHeight: 260 }}>
        <Drawing art={art} />
      </svg>
    </div>
  );
}
