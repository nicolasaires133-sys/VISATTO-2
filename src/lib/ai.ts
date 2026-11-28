// Toda a inteligência do produto fica aqui.
// Com ANTHROPIC_API_KEY configurada usa o Claude; sem a chave entra em "modo demonstração"
// (respostas simples por palavra-chave) para dar para testar o app sem custo.
import { basePrice } from "./options";
import Anthropic from "@anthropic-ai/sdk";
import type { MenuItem, Category, CartLine, WaiterAction } from "./format";
import { brl } from "./format";
import { KINDS, profileFromName, sanitizeProfile, type ProductProfile } from "./scan/profile";
import { allergenLabel, DAYPARTS } from "./sell";

const CHAT_MODEL = process.env.AI_MODEL || "claude-haiku-5-5";
const VISION_MODEL = process.env.AI_VISION_MODEL || "claude-sonnet-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

type RestaurantCtx = {
  name: string;
  ai_name: string;
  ai_tone: string;
  ai_instructions: string;
  delivery_fee_cents: number;
  min_order_cents: number;
  address: string;
};

export type ChatMsg = { role: "user" | "assistant"; content: string };

function menuText(categories: Category[], items: MenuItem[]) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  return items
    .map((i) =>
      [
        `id=${i.id}`,
        `categoria=${catName.get(i.category_id ?? "") ?? "Outros"}`,
        `nome=${i.name}`,
        `preço=${brl(basePrice(i))}${basePrice(i) < i.price_cents ? ` (EM PROMOÇÃO agora, normal ${brl(i.price_cents)})` : ""}`,
        i.options?.length
          ? `opções=${i.options.map((g) => `${g.name}${g.min ? " (obrigatório)" : ""}: ${g.choices.map((c) => c.name + (c.price_cents ? ` +${brl(c.price_cents)}` : "")).join(", ")}`).join("; ")} (o cliente escolhe na tela do prato)`
          : "",
        `serve=${i.serves} pessoa(s)`,
        i.tags?.length ? `tags=${i.tags.join(", ")}` : "",
        i.featured ? "destaque da casa" : "",
        i.model_published && i.model_glb_url ? "TEM 3D: cliente pode ver na mesa em tamanho real" : "",
        i.available ? "" : "ESGOTADO HOJE",
        !i.available && i.substitute_id && nameOf.get(i.substitute_id) ? `se acabar, oferecer=${nameOf.get(i.substitute_id)}` : "",
        i.description ? `descrição=${i.description}` : "",
        i.allergens_known
          ? `alergênicos=${i.allergens?.length ? `contém ${i.allergens.map((a) => allergenLabel(a)).join(", ")}` : "nenhum dos principais"} (ficha conferida)`
          : "alergênicos=FICHA NÃO CONFERIDA",
        i.promote ? "VENDER MAIS (o dono quer que este prato seja oferecido)" : "",
        i.pairs?.length ? `combina com=${i.pairs.map((id) => nameOf.get(id)).filter(Boolean).join(", ")}` : "",
        i.dayparts?.length ? `bom para=${i.dayparts.map((d) => DAYPARTS.find((p) => p.id === d)?.label).filter(Boolean).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n");
}

function cartText(cart: CartLine[], items: MenuItem[]) {
  if (!cart.length) return "Carrinho vazio.";
  const byId = new Map(items.map((i) => [i.id, i]));
  return cart
    .map((l) => {
      const it = byId.get(l.itemId);
      return it ? `${l.qty}x ${it.name} (id=${it.id})${l.notes ? ` obs: ${l.notes}` : ""}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

const WAITER_TOOLS: any[] = [
  {
    name: "adicionar_ao_carrinho",
    description:
      "Coloca um item do cardápio no carrinho do cliente. Use SOMENTE quando o cliente deixar claro que quer pedir aquele item (ex.: 'quero', 'pode colocar', 'manda um', 'fecha', 'sim' depois de você oferecer).",
    input_schema: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "id exato do item no cardápio" },
        quantidade: { type: "integer", minimum: 1, maximum: 20 },
        observacao: { type: "string", description: "ex.: sem cebola, ponto da carne" },
      },
      required: ["item_id", "quantidade"],
    },
  },
  {
    name: "remover_do_carrinho",
    description: "Remove um item do carrinho quando o cliente pedir.",
    input_schema: {
      type: "object",
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
    },
  },
  {
    name: "chamar_atendente",
    description:
      "Chama uma pessoa da equipe até a mesa (aparece na hora no painel do restaurante). Use quando: o cliente pedir; a pergunta for sobre alergia e a ficha do prato não estiver conferida; houver reclamação; ou você não souber responder algo importante.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "frase curta para a equipe, ex.: 'Dúvida sobre glúten na lasanha'" } },
      required: ["motivo"],
    },
  },
  {
    name: "mostrar_pratos",
    description:
      "Mostra cartões com foto e preço de 1 a 3 pratos dentro da conversa. Use sempre que recomendar ou citar pratos específicos.",
    input_schema: {
      type: "object",
      properties: { item_ids: { type: "array", items: { type: "string" }, maxItems: 3 } },
      required: ["item_ids"],
    },
  },
];

export async function waiterReply(opts: {
  restaurant: RestaurantCtx;
  categories: Category[];
  items: MenuItem[];
  messages: ChatMsg[];
  cart: CartLine[];
  channel: "mesa" | "delivery";
  /** o que esta mesa já pediu hoje (para não oferecer de novo e saber a hora da sobremesa) */
  ordered?: { name: string; qty: number; minutesAgo: number }[];
  daypart?: string;
}): Promise<{ text: string; actions: WaiterAction[] }> {
  const { restaurant: r, categories, items, messages, cart, channel } = opts;
  if (!aiEnabled()) return mockWaiter(items, messages);

  const validIds = new Set(items.map((i) => i.id));
  const system = [
    {
      type: "text",
      text: `Você é ${r.ai_name}, o garçom virtual do restaurante "${r.name}". Seu jeito: ${r.ai_tone}.
Você conversa com clientes pelo cardápio digital e seu objetivo é ajudar a escolher bem e vender mais, sem ser chato.

Regras:
- Responda no idioma da última mensagem do cliente (português, inglês, espanhol...). Curto: 1 a 3 frases. Nada de listas longas.
- Só fale de pratos que estão no cardápio abaixo. Nunca invente pratos, preços, ingredientes, promoções, certificações (halal, kosher, orgânico) ou horários.
- Ao recomendar ou citar pratos, chame a ferramenta mostrar_pratos com eles.
- Quantidade: se perguntarem quanto pedir, pergunte quantas pessoas são e use o campo "serve" (ex.: serve 2 pessoas). Se o prato TEM 3D, convide o cliente a tocar no prato e em "Ver na minha mesa" para ver o tamanho real pela câmera.
- ALERGIA E RESTRIÇÃO: use só o campo "alergênicos" do prato. Se estiver "FICHA NÃO CONFERIDA", diga que não tem essa informação confirmada${channel === "mesa" ? ", chame a equipe com chamar_atendente" : " e sugira falar com o restaurante pelo WhatsApp"} e não afirme nada. Mesmo com ficha conferida, lembre que pode haver contato cruzado na cozinha quando a alergia for grave.
- Itens ESGOTADO HOJE não podem ser pedidos; ofereça o prato de "se acabar, oferecer" ou outro parecido.
- Só adicione ao carrinho quando o cliente confirmar.
- VENDA: depois de adicionar, ofereça UMA vez um complemento. Prefira, nesta ordem: o "combina com" do prato, um prato marcado VENDER MAIS, e o que falta no pedido (bebida, entrada, sobremesa). Se o cliente recusar, não ofereça de novo o mesmo item. Nunca mais de uma oferta por resposta.
- Se o cliente quiser finalizar, diga para tocar em "Ver pedido" e enviar.
- Não fale sobre assuntos fora do restaurante.
- Reclamação, pedido de falar com alguém ou dúvida que você não consegue resolver: ${channel === "mesa" ? "chame a equipe com chamar_atendente e avise o cliente que alguém já vem" : "sugira falar com o restaurante pelo WhatsApp"}.
${opts.daypart ? `- Agora é hora de: ${DAYPARTS.find((p) => p.id === opts.daypart)?.label ?? opts.daypart}. Pratos "bom para" esse horário têm preferência.` : ""}
${opts.ordered?.length ? `- Esta mesa já pediu: ${opts.ordered.map((o) => `${o.qty}x ${o.name} (há ${o.minutesAgo} min)`).join("; ")}. Não ofereça de novo o que já foi pedido; se o prato principal já saiu há uns 25 minutos, é um bom momento para sugerir sobremesa ou café.` : ""}
${channel === "delivery" ? `- O cliente está pedindo para entrega ou retirada. Taxa de entrega: ${(r as any).delivery_mode === "bairro" ? "depende do bairro (aparece na sacola)" : brl(r.delivery_fee_cents)}.${r.min_order_cents ? ` Pedido mínimo: ${brl(r.min_order_cents)}.` : ""}` : "- O cliente está sentado à mesa no restaurante."}
${r.ai_instructions ? `\nInstruções do dono do restaurante:\n${r.ai_instructions}` : ""}

CARDÁPIO:
${menuText(categories, items)}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  const convo: any[] = messages.slice(-16).map((m) => ({ role: m.role, content: m.content }));
  // contexto do carrinho vai junto da última mensagem do cliente
  const last = convo[convo.length - 1];
  if (last?.role === "user") {
    last.content = `${last.content}\n\n[Carrinho atual do cliente:\n${cartText(cart, items)}]`;
  }

  const actions: WaiterAction[] = [];
  let text = "";
  const anthropic = client();

  for (let step = 0; step < 4; step++) {
    const res: any = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 600,
      system: system as any,
      tools: WAITER_TOOLS,
      messages: convo,
    });
    const blocks: any[] = res.content || [];
    const stepText = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (stepText) text = text ? `${text}\n${stepText}` : stepText;

    const toolUses = blocks.filter((b) => b.type === "tool_use");
    if (!toolUses.length || res.stop_reason !== "tool_use") break;

    convo.push({ role: "assistant", content: blocks });
    const results: any[] = [];
    for (const t of toolUses) {
      let result = "ok";
      const input = t.input || {};
      if (t.name === "adicionar_ao_carrinho") {
        if (validIds.has(input.item_id) && items.find((i) => i.id === input.item_id)?.available) {
          actions.push({
            type: "add",
            itemId: input.item_id,
            qty: Math.min(20, Math.max(1, Number(input.quantidade) || 1)),
            notes: input.observacao || "",
          });
          result = "Adicionado ao carrinho.";
        } else result = "Erro: item inexistente ou esgotado.";
      } else if (t.name === "remover_do_carrinho") {
        actions.push({ type: "remove", itemId: input.item_id });
        result = "Removido.";
      } else if (t.name === "chamar_atendente") {
        if (channel === "mesa") {
          actions.push({ type: "call", reason: String(input.motivo || "").slice(0, 140) });
          result = "Equipe chamada. Avise o cliente que alguém já vem até a mesa.";
        } else result = "Não há mesa: sugira falar com o restaurante pelo WhatsApp.";
      } else if (t.name === "mostrar_pratos") {
        const ids = (input.item_ids || []).filter((id: string) => validIds.has(id)).slice(0, 3);
        if (ids.length) actions.push({ type: "show", itemIds: ids });
        result = ids.length ? "Cartões exibidos ao cliente." : "Nenhum id válido.";
      }
      results.push({ type: "tool_result", tool_use_id: t.id, content: result });
    }
    convo.push({ role: "user", content: results });
  }

  return { text: text || "Posso ajudar com mais alguma coisa?", actions };
}

// ---------- Modo demonstração (sem chave de API) ----------
function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function mockWaiter(items: MenuItem[], messages: ChatMsg[]) {
  const q = norm(messages[messages.length - 1]?.content || "");
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const avail = items.filter((i) => i.available);
  const score = (i: MenuItem) => {
    const hay = norm(`${i.name} ${i.description} ${(i.tags || []).join(" ")}`);
    return words.reduce((s, w) => s + (hay.includes(w) ? (norm(i.name).includes(w) ? 3 : 1) : 0), 0);
  };
  const ranked = avail
    .map((i) => ({ i, s: score(i) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);
  const wantsToOrder = /\b(quero|manda|coloca|adiciona|pode por|vou querer|me ve|fecha)\b/.test(q);
  const actions: WaiterAction[] = [];

  if (wantsToOrder && ranked[0]) {
    actions.push({ type: "add", itemId: ranked[0].id, qty: 1 });
    const extra = avail.find(
      (i) => i.id !== ranked[0].id && /bebida|suco|refri|sobremesa|doce/.test(norm(`${i.name} ${(i.tags || []).join(" ")}`))
    );
    actions.push({ type: "show", itemIds: extra ? [ranked[0].id, extra.id] : [ranked[0].id] });
    return {
      text: `Pronto, coloquei 1 ${ranked[0].name} no seu carrinho!${extra ? ` Que tal acompanhar com ${extra.name}?` : ""} (modo demonstração)`,
      actions,
    };
  }
  if (ranked.length) {
    actions.push({ type: "show", itemIds: ranked.slice(0, 3).map((i) => i.id) });
    const top = ranked[0];
    return {
      text: `Recomendo ${top.name} (${brl(top.price_cents)}, serve ${top.serves}). Quer que eu coloque no carrinho? (modo demonstração)`,
      actions,
    };
  }
  const featured = avail.filter((i) => i.featured).slice(0, 3);
  const pick = featured.length ? featured : avail.slice(0, 3);
  if (pick.length) actions.push({ type: "show", itemIds: pick.map((i) => i.id) });
  return {
    text:
      "Estou em modo demonstração (falta configurar a chave da IA), mas posso te mostrar os destaques da casa. Me diga o que você está com vontade de comer!",
    actions,
  };
}

// ---------- Importar cardápio por foto ----------
export type ImportedMenu = {
  categories: { name: string; items: { name: string; description: string; price_cents: number; serves: number; tags: string[] }[] }[];
};

export async function importMenuFromImages(images: { data: string; mediaType: string }[]): Promise<ImportedMenu> {
  if (!aiEnabled()) throw new Error("Configure a ANTHROPIC_API_KEY para importar cardápios por foto.");
  const res: any = await client().messages.create({
    model: VISION_MODEL,
    max_tokens: 8000,
    tools: [
      {
        name: "salvar_cardapio",
        description: "Salva o cardápio extraído das fotos.",
        input_schema: {
          type: "object",
          properties: {
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string", description: "descrição curta e apetitosa; se não houver no cardápio, escreva uma com base no nome, sem inventar ingredientes improváveis" },
                        price_reais: { type: "number", description: "preço em reais, ex.: 39.9; 0 se não houver" },
                        serves: { type: "integer", description: "quantas pessoas serve; 1 se não indicado" },
                        tags: { type: "array", items: { type: "string" }, description: "apenas se for evidente: vegano, vegetariano, sem glúten, sem lactose, picante, kids" },
                      },
                      required: ["name", "price_reais"],
                    },
                  },
                },
                required: ["name", "items"],
              },
            },
          },
          required: ["categories"],
        },
      },
    ] as any,
    tool_choice: { type: "tool", name: "salvar_cardapio" } as any,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.data },
          })),
          {
            type: "text",
            text: "Estas são fotos do cardápio de um restaurante brasileiro. Extraia TODAS as categorias e itens com preço, mantendo os nomes como estão escritos. Corrija apenas erros óbvios de leitura.",
          },
        ] as any,
      },
    ],
  });
  const tool = (res.content || []).find((b: any) => b.type === "tool_use");
  const cats = tool?.input?.categories || [];
  return {
    categories: cats.map((c: any) => ({
      name: String(c.name || "Outros").slice(0, 60),
      items: (c.items || []).map((i: any) => ({
        name: String(i.name || "").slice(0, 100),
        description: String(i.description || "").slice(0, 400),
        price_cents: Math.round((Number(i.price_reais) || 0) * 100),
        serves: Math.max(1, Number(i.serves) || 1),
        tags: Array.isArray(i.tags) ? i.tags.map(String).slice(0, 5) : [],
      })),
    })),
  };
}

// ---------- Tradução do cardápio ----------
export type ToTranslate = { id: string; name: string; description: string };
/** Traduz nomes e descrições para inglês e espanhol. Nomes próprios de pratos brasileiros ficam como são, com explicação na descrição. */
export async function translateMenu(entries: ToTranslate[], langs: ("en" | "es")[]): Promise<Record<string, Partial<Record<"en" | "es", { name: string; description: string }>>>> {
  if (!aiEnabled()) throw new Error("A tradução automática usa a IA. Configure a ANTHROPIC_API_KEY para traduzir o cardápio.");
  const out: Record<string, Partial<Record<"en" | "es", { name: string; description: string }>>> = {};
  for (let i = 0; i < entries.length; i += 40) {
    const batch = entries.slice(i, i + 40);
    const res: any = await client().messages.create({
      model: CHAT_MODEL,
      max_tokens: 8000,
      tools: [
        {
          name: "salvar_traducoes",
          description: "Salva as traduções de cada item.",
          input_schema: {
            type: "object",
            properties: {
              itens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    ...Object.fromEntries(langs.map((l) => [l, { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name", "description"] }])),
                  },
                  required: ["id", ...langs],
                },
              },
            },
            required: ["itens"],
          },
        },
      ] as any,
      tool_choice: { type: "tool", name: "salvar_traducoes" } as any,
      messages: [
        {
          role: "user",
          content: `Traduza estes itens de um cardápio brasileiro para ${langs.map((l) => (l === "en" ? "inglês" : "espanhol")).join(" e ")}.
Regras: tradução natural de cardápio, curta; não invente ingredientes; nomes típicos sem tradução (ex.: feijoada, coxinha, pão de queijo, caipirinha) ficam como estão no nome e ganham uma explicação curta na descrição; preços e números não mudam; descrição vazia continua vazia, a não ser que o nome precise de explicação.

${JSON.stringify(batch)}`,
        },
      ],
    });
    const tool = (res.content || []).find((b: any) => b.type === "tool_use");
    for (const it of tool?.input?.itens ?? []) {
      if (!batch.some((b) => b.id === it.id)) continue;
      out[it.id] = {};
      for (const l of langs) {
        const v = it[l];
        if (v?.name) out[it.id][l] = { name: String(v.name).slice(0, 120), description: String(v.description || "").slice(0, 600) };
      }
    }
  }
  return out;
}

// ---------- Descrição que dá vontade ----------
export async function improveDescription(opts: { name: string; description: string; category: string; restaurant: string }): Promise<string> {
  if (!aiEnabled()) throw new Error("A sugestão de descrição usa a IA. Configure a ANTHROPIC_API_KEY.");
  const res: any = await client().messages.create({
    model: CHAT_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Escreva a descrição de um prato para o cardápio digital do restaurante "${opts.restaurant}".
Prato: ${opts.name}
Categoria: ${opts.category || "não informada"}
Descrição atual: ${opts.description || "(vazia)"}

Regras: português do Brasil, no máximo 2 frases e 180 caracteres; dê vontade de pedir; use SÓ ingredientes que estão no nome ou na descrição atual (não invente nada); diga para quantos serve só se já estiver escrito. Responda apenas com a descrição, sem aspas.`,
      },
    ],
  });
  const text = (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").trim();
  return text.replace(/^["“]|["”]$/g, "").slice(0, 300);
}

/** Legenda curta e vendedora (cria do zero ou melhora a que o dono escreveu ou ditou). */
export async function improveCaption(opts: { name: string; caption: string; description: string; category: string; restaurant: string }): Promise<string> {
  if (!aiEnabled()) throw new Error("A ajuda da IA na legenda precisa da ANTHROPIC_API_KEY configurada.");
  const res: any = await client().messages.create({
    model: CHAT_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Escreva a LEGENDA de um prato para o cardápio digital do restaurante "${opts.restaurant}". A legenda é uma frase curta em destaque logo abaixo do nome do prato.
Prato: ${opts.name}
Categoria: ${opts.category || "não informada"}
Descrição: ${opts.description || "(vazia)"}
Legenda que o dono escreveu ou ditou: ${opts.caption || "(vazia: crie uma)"}

Regras: português do Brasil; no máximo 110 caracteres; pode usar " · " para separar duas ideias; destaque o que faz o prato especial e informações práticas que o dono citou (quantidade de peças ou fatias, para quantas pessoas serve, peso, acompanhamentos); corrija erros de digitação e de ditado; NÃO invente ingredientes, quantidades ou números que não estejam no texto acima; sem emoji, sem aspas, sem ponto final. Responda só com a legenda.`,
      },
    ],
  });
  const text = (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").trim();
  return text.replace(/^["“]|["”]$/g, "").replace(/\.$/, "").slice(0, 160);
}

// ---------- Resumo das perguntas dos clientes ----------
export async function summarizeQuestions(restaurantName: string, questions: string[]): Promise<string> {
  if (!aiEnabled()) throw new Error("Configure a ANTHROPIC_API_KEY para gerar o resumo.");
  const res: any = await client().messages.create({
    model: CHAT_MODEL,
    max_tokens: 900,
    messages: [
      {
        role: "user",
        content: `Você é consultor de restaurantes. Abaixo estão perguntas que clientes do "${restaurantName}" fizeram ao garçom virtual nos últimos dias.
Escreva para o dono, em português, no máximo 6 tópicos curtos: o que os clientes mais querem saber, o que estão procurando e não encontram no cardápio, e 2 ou 3 ações práticas para vender mais. Seja direto, sem introdução.

PERGUNTAS:
${questions.slice(0, 400).map((q) => `- ${q}`).join("\n")}`,
      },
    ],
  });
  return (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
}

/** Garçom de IA ligado? Só com a chave da Anthropic (ou GARCOM_DEMO=1 para testes/demonstração com respostas prontas).
 * Sem isso, o cardápio funciona normalmente, só sem o botão do garçom. */
export const waiterEnabled = () => aiEnabled() || process.env.GARCOM_DEMO === "1";

// ---------- Escâner: entender o que é o produto ----------
export const scanAIEnabled = () => aiEnabled() && process.env.SCAN_IA_PAGA === "1";

/** Olha um quadro do vídeo do escâner e diz o que é o produto, o recipiente e o tamanho típico. */
export async function identifyProduct(opts: { image?: { data: string; mediaType: string }; name: string; note?: string }): Promise<ProductProfile> {
  const fallback = profileFromName(opts.name, opts.note);
  // O escâner é grátis: só usa a IA paga se o dono do sistema ligar de propósito (SCAN_IA_PAGA=1).
  // Sem isso, o produto é reconhecido pelo nome e pela descrição — sem custo nenhum.
  if (!scanAIEnabled() || !opts.image) return fallback;
  const res: any = await client().messages.create({
    model: CHAT_MODEL,
    max_tokens: 700,
    tools: [
      {
        name: "ficha_do_produto",
        description: "Registra o que é o produto da foto, para montar o 3D dele em tamanho real.",
        input_schema: {
          type: "object",
          properties: {
            produto: { type: "string", description: "nome curto do produto como o cliente entenderia, ex.: 'Petit gâteau com sorvete'" },
            kind: { type: "string", enum: Object.keys(KINDS), description: "categoria mais próxima (só ajusta detalhes; o escâner monta qualquer formato). Se nenhuma servir, use outro. " + Object.entries(KINDS).map(([k, v]) => `${k} = ${v.label}`).join("; ") },
            formato: { type: "string", enum: ["redondo", "retangular", "irregular"], description: "formato visto de cima, contando o prato/recipiente" },
            topo: { type: "string", enum: ["reto", "arredondado", "irregular"], description: "como é o topo: reto (fatia de bolo, copo, taça, pizza, torta), arredondado (pão de hambúrguer, bola de sorvete, cúpula), irregular (massa, salada, porção)" },
            recipiente: { type: "string", description: "ex.: 'prato raso branco', 'taça de vidro', 'copo long drink', 'tábua de madeira', 'sem recipiente'" },
            transparente: { type: "boolean", description: "o recipiente é de vidro ou acrílico transparente" },
            altura_cm: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: "faixa típica de altura total (da mesa ao topo), em cm, para ESTE tipo de produto servido assim" },
            largura_cm: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: "faixa típica da maior largura vista de cima (com o recipiente), em cm" },
            dica: { type: "string", description: "uma dica curta para gravar ESTE produto melhor, se houver (ex.: copo alto: filme também bem de lado)" },
          },
          required: ["produto", "kind", "formato", "topo", "recipiente", "transparente", "altura_cm", "largura_cm"],
        },
      },
    ] as any,
    tool_choice: { type: "tool", name: "ficha_do_produto" } as any,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } },
          {
            type: "text",
            text:
              `Foto tirada pelo dono de um restaurante para escanear um item do cardápio em 3D. Ao lado há uma folha A4 branca, às vezes com um quadrado preto impresso (é só a régua, ignore).\n` +
              `Nome no cardápio: "${opts.name}".` +
              (opts.note ? `\nO dono descreveu assim: "${opts.note}".` : "") +
              `\nIdentifique o produto, seja ele qual for: prato, sobremesa, doce, salgado, bebida, porção, lanche, fruta, pão... Diga a altura e a largura típicas de verdade para ESTE produto do jeito que aparece (com o recipiente), porque elas guiam a medição. Se a foto e o nome discordarem, confie na foto, mas use o nome para dar o nome certo.`,
          },
        ] as any,
      },
    ],
  });
  const tool = (res.content || []).find((b: any) => b.type === "tool_use");
  return tool ? sanitizeProfile(tool.input, fallback) : fallback;
}
