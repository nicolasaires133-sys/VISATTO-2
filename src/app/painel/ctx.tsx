"use client";
import { createContext, useContext } from "react";

export type Order = {
  id: string;
  number: number;
  channel: "mesa" | "delivery";
  table_label: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  notes: string;
  status: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  ai_cents: number;
  created_at: string;
  updated_at?: string;
  payment?: string;
  change_for_cents?: number;
  closed_at?: string | null;
  /** prêmio do cartão fidelidade liberado para este cliente */
  reward?: string;
  items: { name: string; qty: number; notes: string; price_cents: number; via_ai?: boolean }[];
};
export type Call = { id: string; table_label: string; type: "atendente" | "conta"; reason?: string; amount_cents?: number; method?: string; created_at: string };

export type PainelState = {
  restaurant: any;
  aiEnabled: boolean;
  waiter?: boolean;
  counts?: { items: number; models: number; orders: number };
  reload: () => Promise<void>;
  /** pedidos e chamados das mesas, atualizados sozinhos em qualquer tela do painel */
  orders: Order[] | null;
  calls: Call[];
  offline: boolean;
  refreshOrders: () => Promise<void>;
  setOrders: React.Dispatch<React.SetStateAction<Order[] | null>>;
  setCalls: React.Dispatch<React.SetStateAction<Call[]>>;
  sound: boolean;
  setSound: (on: boolean) => void;
  /** aviso rápido embaixo da tela ("Prato salvo") */
  toast: (msg: string) => void;
};
export const PainelCtx = createContext<PainelState | null>(null);
export const usePainel = () => useContext(PainelCtx)!;
