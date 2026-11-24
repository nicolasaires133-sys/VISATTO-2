import bcrypt from "bcryptjs";
import { getDB, newId } from "@/lib/db";
import { ok, fail } from "@/lib/http";

// Cria o restaurante de demonstração "Cantina da Nonna" (usado no botão "Ver demonstração" do site).
// Para usar em produção: defina SETUP_KEY na Vercel e abra /api/setup-demo?chave=SUA_CHAVE uma vez.
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
  ]],
  ["Bebidas", [
    ["Coca-Cola 2L", "Gelada.", 16.0, 4, [], false],
    ["Suco de Laranja Natural 500ml", "Feito na hora.", 12.0, 1, ["vegano"], false],
    ["Vinho Tinto da Casa (taça)", "Montepulciano d'Abruzzo.", 26.0, 1, [], false],
    ["Água com gás", "Garrafa 500ml.", 6.0, 1, [], false],
  ]],
];

export async function GET(req: Request) {
  const key = process.env.SETUP_KEY || (process.env.NODE_ENV !== "production" ? "dev" : "");
  const given = new URL(req.url).searchParams.get("chave");
  if (!key || given !== key) return fail("Acesso negado.", 403);

  const db = await getDB();
  const exists = await db.query(`SELECT id FROM restaurants WHERE slug = 'cantina-da-nonna'`);
  if (exists.length) return ok({ ok: true, message: "A demonstração já existe.", url: "/r/cantina-da-nonna?mesa=7" });

  const rid = newId();
  const email = "demo@cantinadanonna.com.br";
  const password = process.env.DEMO_PASSWORD || "demo1234";
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
  // Pratos com 3D (modelos de demonstração em tamanho real, em /public/demo)
  const models: [string, string, number, { w: number; d: number; h: number }][] = [
    ["Pizza Calabresa Grande", "pizza", 40, { w: 40, d: 40, h: 3.7 }],
    ["Lasanha à Bolonhesa", "lasanha", 26, { w: 26, d: 26, h: 6 }],
    ["Tiramisù da Casa", "tiramisu", 22, { w: 22, d: 22, h: 6.4 }],
  ];
  for (const [name, file, width, dims] of models) {
    await db.query(
      `UPDATE items SET model_status='pronto', model_published=TRUE, model_glb_url=$3, model_usdz_url=$4, model_width_cm=$5,
              model_dims=$6::jsonb, model_progress=100, image=$7, model_updated_at=NOW()
        WHERE restaurant_id=$1 AND name=$2`,
      [rid, name, `/demo/${file}.glb`, `/demo/${file}.usdz`, width, JSON.stringify(dims), `/demo/${file}.jpg`]
    );
  }
  return ok({ ok: true, message: "Demonstração criada.", url: "/r/cantina-da-nonna?mesa=7", painel: { email, senha: password } });
}
