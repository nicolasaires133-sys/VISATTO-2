import bcrypt from "bcryptjs";
import { getDB, newId } from "@/lib/db";

// Cria o restaurante de demonstração "Cantina da Nonna" (usado no botão "Ver demonstração" do site).
// Em produção ele é criado sozinho na primeira visita ao cardápio de exemplo, com senha aleatória
// (ninguém consegue entrar no painel dele, a não ser que DEMO_PASSWORD esteja definida na Vercel).
const MENU: [string, [string, string, number, number, string[], boolean][]][] = [
  ["Pizzas", [
    ["Pizza Margherita Grande", "Molho de tomate italiano, muçarela de búfala, manjericão fresco e azeite. 35 cm, 8 fatias.", 79.9, 3, ["vegetariano", "mais pedido"], true],
    ["Pizza Calabresa Grande", "Calabresa artesanal fatiada, cebola roxa, muçarela e orégano. 35 cm, 8 fatias.", 74.9, 3, [], false],
    ["Pizza Quatro Queijos Grande", "Muçarela, gorgonzola, parmesão e catupiry. 35 cm, 8 fatias.", 84.9, 3, ["vegetariano"], false],
    ["Pizza Broto Margherita", "A clássica em tamanho individual. 25 cm, 4 fatias.", 44.9, 1, ["vegetariano"], false],
  ]],
  ["Massas", [
    ["Lasanha à Bolonhesa", "Massa fresca, ragu de carne cozido por 6 horas, bechamel e parmesão gratinado.", 62.0, 1, ["mais pedido"], true],
    ["Espaguete ao Pomodoro", "Molho de tomate fresco, alho, manjericão e parmesão.", 48.0, 1, ["vegetariano"], false],
    ["Nhoque da Nonna (para 2)", "Nhoque de batata artesanal com molho de tomate e muçarela gratinada. Serve bem 2 pessoas.", 89.0, 2, ["vegetariano"], false],
    ["Penne Sem Glúten ao Pesto", "Penne de arroz, pesto de manjericão e castanhas, tomate-cereja.", 54.0, 1, ["sem glúten", "vegano"], false],
  ]],
  ["Entradas", [
    ["Bruschetta Tradicional (4 un.)", "Pão italiano tostado, tomate, alho, manjericão e azeite.", 32.0, 2, ["vegano"], false],
    ["Burrata com Tomates", "Burrata cremosa, tomates confitados, pesto e torradas.", 58.0, 2, ["vegetariano"], true],
  ]],
  ["Sobremesas", [
    ["Tiramisù da Casa", "Mascarpone, café espresso, biscoito champagne e cacau.", 29.0, 1, [], false],
    ["Panna Cotta com Frutas Vermelhas", "Creme de baunilha com calda de frutas vermelhas.", 24.0, 1, ["sem glúten"], false],
    ["Pudim de Leite", "Pudim cremoso de leite condensado com calda de caramelo. Fatia generosa.", 22.0, 1, ["sem glúten"], false],
    ["Brownie com Sorvete", "Brownie de chocolate meio amargo, sorvete de creme e calda quente de chocolate.", 27.0, 1, [], false],
  ]],
  ["Bebidas", [
    ["Coca-Cola 2L", "Gelada.", 16.0, 4, [], false],
    ["Suco de Laranja Natural 500ml", "Feito na hora.", 12.0, 1, ["vegano"], false],
    ["Vinho Tinto da Casa (taça)", "Montepulciano d'Abruzzo.", 26.0, 1, [], false],
    ["Água com gás", "Garrafa 500ml.", 6.0, 1, [], false],
  ]],
];

export const DEMO_SLUG = "cantina-da-nonna";
export const DEMO_EMAIL = "demo@cantinadanonna.com.br";

let checkedOnce = false;
/** Uma vez por servidor: cria a demonstração se faltar, ou completa a de versões antigas. */
export async function ensureDemoOnce() {
  if (checkedOnce) return;
  checkedOnce = true;
  await ensureDemo(true).catch(() => (checkedOnce = false));
}

let running: Promise<{ created: boolean; password: string | null }> | null = null;

/** Cria a demonstração se ainda não existir. Devolve a senha só quando acabou de criar. */
export function ensureDemo(randomPassword = false) {
  if (!running) running = create(randomPassword).finally(() => (running = null));
  return running;
}

async function create(randomPassword: boolean): Promise<{ created: boolean; password: string | null }> {
  const db = await getDB();
  const exists = await db.query(`SELECT id FROM restaurants WHERE slug = 'cantina-da-nonna'`);
  if (exists.length) {
    // demonstração criada antes da inteligência de venda: completa uma vez
    const [k] = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM items WHERE restaurant_id=$1 AND allergens_known`, [exists[0].id]);
    if (!k?.n) await applySell(db, exists[0].id);
    await applyLoyalty(db, exists[0].id);
    await applyOptions(db, exists[0].id);
    await ensureItems(db, exists[0].id);
    await applyModels(db, exists[0].id, true);
    return { created: false, password: null };
  }

  const rid = newId();
  const email = DEMO_EMAIL;
  const password =
    process.env.DEMO_PASSWORD || (randomPassword ? Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url") : "demo1234");
  await db.query(
    `INSERT INTO restaurants (id, slug, name, email, password_hash, whatsapp, address, primary_color, delivery_fee_cents,
                              min_order_cents, ai_name, ai_tone, ai_instructions, plan)
     VALUES ($1,'cantina-da-nonna','Cantina da Nonna',$2,$3,'11999990000','Rua dos Italianos, 120 • Bixiga, São Paulo','#C0392B',700,4000,
             'Nonna Bot','acolhedor, como em casa de vó',$4,'demo')`,
    [
      rid,
      email,
      await bcrypt.hash(password, 10),
      "Sempre que fizer sentido, ofereça o Tiramisù da casa como sobremesa. A pizza grande tem 8 fatias e serve bem 3 pessoas. Às terças o vinho da casa tem 20% de desconto no salão.",
    ]
  );
  let cpos = 0;
  let ipos = 0;
  for (const [cat, items] of MENU) {
    const cid = newId();
    await db.query(`INSERT INTO categories (id, restaurant_id, name, position) VALUES ($1,$2,$3,$4)`, [cid, rid, cat, cpos++]);
    for (const [name, description, price, serves, tags, featured] of items) {
      await db.query(
        `INSERT INTO items (id, restaurant_id, category_id, name, description, price_cents, serves, tags, featured, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [newId(), rid, cid, name, description, Math.round(price * 100), serves, JSON.stringify(tags), featured, ipos++]
      );
    }
  }
  await applyModels(db, rid, false);
  await applySell(db, rid);
  await applyLoyalty(db, rid);
  await applyOptions(db, rid);
  return { created: true, password };
}

// Pratos com 3D (modelos de demonstração em tamanho real, em /public/demo). Trocou um arquivo? Aumente DEMO_V.
const DEMO_V = 6;
const MODELS: [string, string, number, { w: number; d: number; h: number }][] = [
  ["Pizza Calabresa Grande", "pizza", 43.2, { w: 43.2, d: 43.2, h: 4 }],
  ["Lasanha à Bolonhesa", "lasanha", 26, { w: 26, d: 26, h: 7.6 }],
  ["Tiramisù da Casa", "tiramisu", 22, { w: 22, d: 22, h: 7.8 }],
  ["Panna Cotta com Frutas Vermelhas", "pannacotta", 18, { w: 18, d: 18, h: 6.8 }],
  ["Pudim de Leite", "pudim", 26, { w: 26, d: 26, h: 6.6 }],
  ["Brownie com Sorvete", "brownie", 20, { w: 20, d: 20, h: 9.5 }],
];

/** Demonstração antiga: acrescenta os pratos novos do cardápio que ainda não existem nela. */
async function ensureItems(db: Awaited<ReturnType<typeof getDB>>, rid: string) {
  for (const [cat, items] of MENU) {
    const [c] = await db.query<{ id: string }>(`SELECT id FROM categories WHERE restaurant_id=$1 AND name=$2`, [rid, cat]);
    if (!c) continue;
    for (const [name, description, price, serves, tags, featured] of items) {
      const [has] = await db.query(`SELECT 1 FROM items WHERE restaurant_id=$1 AND name=$2`, [rid, name]);
      if (has) continue;
      const [mx] = await db.query<{ p: number }>(`SELECT COALESCE(MAX(position),0)::int AS p FROM items WHERE restaurant_id=$1 AND category_id=$2`, [rid, c.id]);
      await db.query(
        `INSERT INTO items (id, restaurant_id, category_id, name, description, price_cents, serves, tags, featured, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [newId(), rid, c.id, name, description, Math.round(price * 100), serves, JSON.stringify(tags), featured, (mx?.p ?? 0) + 1]
      );
    }
  }
}
/** Põe os modelos 3D nos pratos. onlyMissing: só nos pratos que ainda não têm 3D (demonstração antiga). */
async function applyModels(db: Awaited<ReturnType<typeof getDB>>, rid: string, onlyMissing: boolean) {
  for (const [name, file, width, dims] of MODELS) {
    await db.query(
      `UPDATE items SET model_status='pronto', model_published=TRUE, model_glb_url=$3, model_usdz_url=$4, model_width_cm=$5,
              model_dims=$6::jsonb, model_progress=100, image=$7, model_updated_at=NOW()
        WHERE restaurant_id=$1 AND name=$2 ${onlyMissing ? "AND (model_glb_url IS NULL OR model_glb_url='')" : ""}`,
      [rid, name, `/demo/${file}.glb?v=${DEMO_V}`, `/demo/${file}.usdz?v=${DEMO_V}`, width, JSON.stringify(dims), `/demo/${file}.jpg?v=${DEMO_V}`]
    );
  }
  // medidas dos modelos refeitos (pizza, lasanha e tiramisù novos)
  for (const [, file, width, dims] of MODELS)
    // versão nova do arquivo (?v=) para o celular não mostrar o modelo antigo guardado
    await db.query(
      `UPDATE items SET model_dims=$2::jsonb, model_width_cm=$3, model_glb_url=$5, model_usdz_url=$6, image=$7
        WHERE restaurant_id=$1 AND (model_glb_url=$4 OR model_glb_url LIKE $4 || '?v=%')`,
      [rid, JSON.stringify(dims), width, `/demo/${file}.glb`, `/demo/${file}.glb?v=${DEMO_V}`, `/demo/${file}.usdz?v=${DEMO_V}`, `/demo/${file}.jpg?v=${DEMO_V}`]
    );
}

/** Opções, adicionais e promoções de exemplo (só em pratos que ainda não têm nada disso). */
async function applyOptions(db: Awaited<ReturnType<typeof getDB>>, rid: string) {
  const list: [string, unknown[], unknown][] = [
    ["Pizza Calabresa Grande", [{ id: "borda", name: "Borda recheada", min: 0, max: 1, choices: [{ id: "cat", name: "Catupiry", price_cents: 1200 }, { id: "ched", name: "Cheddar", price_cents: 1200 }] }], {}],
    ["Pizza Margherita Grande", [{ id: "borda", name: "Borda recheada", min: 0, max: 1, choices: [{ id: "cat", name: "Catupiry", price_cents: 1200 }, { id: "ched", name: "Cheddar", price_cents: 1200 }] }], {}],
    ["Espaguete ao Pomodoro", [
      { id: "massa", name: "Massa", min: 1, max: 1, choices: [{ id: "esp", name: "Espaguete", price_cents: 0 }, { id: "pen", name: "Penne", price_cents: 0 }, { id: "tal", name: "Talharim fresco", price_cents: 600 }] },
      { id: "add", name: "Adicionais", min: 0, max: 2, choices: [{ id: "parm", name: "Parmesão extra", price_cents: 500 }, { id: "bac", name: "Bacon crocante", price_cents: 700 }, { id: "alm", name: "Almôndegas (3 un.)", price_cents: 1400 }] },
    ], {}],
    ["Bruschetta Tradicional (4 un.)", [], { price_cents: 2790, days: [], from: "", to: "" }],
    ["Vinho Tinto da Casa (taça)", [], { price_cents: 1900, days: [1, 2, 3, 4, 5], from: "17:00", to: "20:00" }],
  ];
  for (const [n, options, promo] of list) {
    await db.query(
      `UPDATE items SET options = CASE WHEN options IS NULL OR options='[]'::jsonb THEN $3::jsonb ELSE options END,
                        promo = CASE WHEN promo IS NULL OR promo='{}'::jsonb THEN $4::jsonb ELSE promo END
        WHERE restaurant_id=$1 AND name=$2`,
      [rid, n, JSON.stringify(options), JSON.stringify(promo)]
    );
  }
}

/** Combinações, alergênicos, horários e custo dos pratos da demonstração. */
/** Cartão fidelidade ligado no exemplo, para quem visita ver como fica (só se o dono ainda não mexeu). */
async function applyLoyalty(db: Awaited<ReturnType<typeof getDB>>, rid: string) {
  await db.query(
    `UPDATE restaurants SET loyalty=$2::jsonb WHERE id=$1 AND (loyalty IS NULL OR loyalty='{}'::jsonb)`,
    [rid, JSON.stringify({ on: true, goal: 8, min_cents: 3000, reward: "uma sobremesa da casa" })]
  );
}

async function applySell(db: Awaited<ReturnType<typeof getDB>>, rid: string) {
  const ids = new Map((await db.query<{ id: string; name: string }>(`SELECT id, name FROM items WHERE restaurant_id=$1`, [rid])).map((r) => [r.name, r.id]));
  const id = (n: string) => ids.get(n) ?? "";
  const sell: [string, { allergens: string[]; pairs?: string[]; promote?: boolean; dayparts?: string[]; cost: number; sub?: string }][] = [
    ["Pizza Margherita Grande", { allergens: ["gluten", "leite"], pairs: ["Coca-Cola 2L", "Tiramisù da Casa"], dayparts: ["noite"], cost: 22 }],
    ["Pizza Calabresa Grande", { allergens: ["gluten", "leite"], pairs: ["Coca-Cola 2L", "Tiramisù da Casa"], dayparts: ["noite"], cost: 21 }],
    ["Pizza Quatro Queijos Grande", { allergens: ["gluten", "leite"], pairs: ["Vinho Tinto da Casa (taça)"], cost: 27, sub: "Pizza Margherita Grande" }],
    ["Pizza Broto Margherita", { allergens: ["gluten", "leite"], pairs: ["Suco de Laranja Natural 500ml"], cost: 12 }],
    ["Lasanha à Bolonhesa", { allergens: ["gluten", "leite", "ovo"], pairs: ["Vinho Tinto da Casa (taça)", "Panna Cotta com Frutas Vermelhas"], dayparts: ["almoco"], cost: 17, promote: true }],
    ["Espaguete ao Pomodoro", { allergens: ["gluten", "leite"], dayparts: ["almoco"], cost: 9 }],
    ["Nhoque da Nonna (para 2)", { allergens: ["gluten", "leite", "ovo"], pairs: ["Burrata com Tomates"], cost: 20 }],
    ["Penne Sem Glúten ao Pesto", { allergens: ["castanhas"], dayparts: ["almoco"], cost: 15 }],
    ["Bruschetta Tradicional (4 un.)", { allergens: ["gluten"], cost: 7 }],
    ["Burrata com Tomates", { allergens: ["leite", "castanhas", "gluten"], pairs: ["Vinho Tinto da Casa (taça)"], cost: 24, promote: true }],
    ["Tiramisù da Casa", { allergens: ["gluten", "leite", "ovo"], cost: 7, promote: true }],
    ["Panna Cotta com Frutas Vermelhas", { allergens: ["leite"], cost: 6 }],
    ["Pudim de Leite", { allergens: ["leite", "ovo"], cost: 5 }],
    ["Brownie com Sorvete", { allergens: ["gluten", "leite", "ovo"], cost: 8 }],
    ["Coca-Cola 2L", { allergens: [], cost: 7 }],
    ["Suco de Laranja Natural 500ml", { allergens: [], dayparts: ["almoco"], cost: 3 }],
    ["Vinho Tinto da Casa (taça)", { allergens: [], dayparts: ["noite"], cost: 8 }],
    ["Água com gás", { allergens: [], cost: 1.5 }],
  ];
  for (const [n, v] of sell) {
    if (!id(n)) continue;
    await db.query(
      `UPDATE items SET allergens=$2::jsonb, allergens_known=TRUE, pairs=$3::jsonb, promote=$4, dayparts=$5::jsonb, cost_cents=$6, substitute_id=$7 WHERE id=$1`,
      [id(n), JSON.stringify(v.allergens), JSON.stringify((v.pairs ?? []).map(id).filter(Boolean)), Boolean(v.promote), JSON.stringify(v.dayparts ?? []), Math.round(v.cost * 100), v.sub ? id(v.sub) : ""]
    );
  }
}
