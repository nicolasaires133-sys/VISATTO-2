export const BRAND = "Visatto";
export const TAGLINE = "Veja o prato na sua mesa antes de pedir";

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  preparo: "Em preparo",
  pronto: "Pronto",
  saiu: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const TAG_OPTIONS = [
  "vegano",
  "vegetariano",
  "sem glúten",
  "sem lactose",
  "picante",
  "mais pedido",
  "novidade",
  "fit",
  "kids",
];

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price_cents: number;
  image: string;
  serves: number;
  tags: string[];
  available: boolean;
  featured: boolean;
  position: number;
  model_status?: ModelStatus;
  model_glb_url?: string;
  model_usdz_url?: string;
  model_width_cm?: number;
  model_dims?: { w: number; d: number; h: number } | null;
  model_progress?: number;
  model_published?: boolean;
  model_error?: string;
  allergens?: string[];
  allergens_known?: boolean;
  pairs?: string[];
  promote?: boolean;
  substitute_id?: string;
  dayparts?: string[];
  cost_cents?: number;
  translations?: import("./sell").Translations;
  /** opções e adicionais (tamanho, ponto, adicionais...) */
  options?: import("./options").OptionGroup[];
  /** preço promocional, com dias e horário opcionais */
  promo?: import("./options").Promo;
};

/** nenhum → gerando (IA) → processando → revisar (dono confere) → pronto | erro */
export type ModelStatus = "nenhum" | "gerando" | "processando" | "revisar" | "pronto" | "erro";

/** Item como o cliente recebe (sem dados internos). */
export type PublicItem = Omit<MenuItem, `model_${string}` | "cost_cents"> & {
  model: { glb: string; usdz: string; dims: { w: number; d: number; h: number } | null } | null;
  /** pratos que os clientes mais pedem junto com este (calculado dos pedidos) */
  bought?: string[];
  /** um dos mais pedidos do restaurante nos últimos 30 dias */
  popular?: boolean;
};

export type Category = { id: string; name: string; position: number; translations?: import("./sell").Translations };

export type PublicRestaurant = {
  slug: string;
  name: string;
  primary_color: string;
  whatsapp: string;
  address: string;
  delivery_enabled: boolean;
  dine_in_enabled: boolean;
  delivery_fee_cents: number;
  min_order_cents: number;
  ai_name: string;
  accepting_orders?: boolean;
  pix_key?: string;
  google_review_url?: string;
  languages?: string[];
  service_pct?: number;
  loyalty?: import("./loyalty").Loyalty;
  hours?: import("./hours").Hours;
};

export const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", cartao: "Cartão na entrega", dinheiro: "Dinheiro" };

export type CartLine = { itemId: string; qty: number; notes: string; viaAi: boolean; viaSuggest?: boolean; opts?: import("./options").Picks };

export type WaiterAction =
  | { type: "add"; itemId: string; qty: number; notes?: string }
  | { type: "remove"; itemId: string }
  | { type: "show"; itemIds: string[] }
  | { type: "call"; reason: string };
