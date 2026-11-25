"use client";
// Conversa com o garçom de IA (só aparece quando o garçom está ligado).
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { basePrice } from "@/lib/options";
import { brl, type CartLine, type PublicItem as MenuItem, type PublicRestaurant, type WaiterAction } from "@/lib/format";
import { CloseButton, Sheet, Thumb } from "./parts";

export type ChatEntry = { role: "user" | "assistant"; content: string; cards?: string[]; added?: string[] };

const SUGGESTIONS = ["O que você recomenda?", "Somos em 2, o que pedir?", "Tem opção sem glúten?", "Qual o mais pedido?"];

export default function Waiter(props: {
  slug: string;
  r: PublicRestaurant;
  color: string;
  chat: ChatEntry[];
  setChat: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  cart: CartLine[];
  channel: "mesa" | "delivery";
  table?: string;
  sessionId: string;
  byId: Map<string, MenuItem>;
  catName: Map<string, string>;
  onClose: () => void;
  onAction: (a: WaiterAction) => void;
  onAddCard: (id: string) => void;
  onOpenItem: (id: string) => void;
  onOpenCart: () => void;
}) {
  const { slug, r, color, chat, setChat, cart, channel, sessionId, byId } = props;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatEntry[] = [...chat, { role: "user", content }];
    setChat(next);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ text: string; actions: WaiterAction[] }>(`/api/r/${slug}/chat`, {
        body: {
          sessionId,
          channel,
          table: props.table ?? "",
          cart,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      const cards: string[] = [];
      const added: string[] = [];
      for (const a of res.actions) {
        if (a.type === "show") cards.push(...a.itemIds);
        if (a.type === "add") added.push(a.itemId);
        props.onAction(a);
      }
      setChat((c) => [...c, { role: "assistant", content: res.text, cards: [...new Set(cards)], added }]);
    } catch (e: any) {
      setChat((c) => [...c, { role: "assistant", content: e.message || "Desculpe, não consegui responder agora." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={props.onClose} full label={`Conversa com ${r.ai_name}`}>
      <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: color }}><Icon name="chat" size={20} /></span>
        <div className="flex-1">
          <p className="font-bold leading-tight">{r.ai_name}</p>
          <p className="text-xs text-leaf">{busy ? "digitando..." : "online"}</p>
        </div>
        {chat.length > 0 && (
          <button onClick={() => setChat([])} className="text-xs font-semibold text-black/40">Limpar</button>
        )}
        <CloseButton onClick={props.onClose} />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <Bubble role="assistant">
          Olá! Eu sou o {r.ai_name}, do {r.name}. {channel === "mesa" ? "Posso te ajudar a escolher" : "Posso montar seu pedido de delivery"}: me conta o que está com vontade, quantas pessoas são ou se tem alguma restrição.
        </Bubble>
        {chat.map((m, idx) => (
          <div key={idx} className="space-y-2">
            <Bubble role={m.role}>{m.content}</Bubble>
            {m.cards && m.cards.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {m.cards.map((id) => {
                  const it = byId.get(id);
                  if (!it) return null;
                  const inCart = cart.some((l) => l.itemId === id);
                  return (
                    <div key={id} className="card w-44 shrink-0 overflow-hidden">
                      <Thumb item={it} className="h-24 w-full" />
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-sm font-bold leading-tight">{it.name}</p>
                        <p className="text-xs text-black/50">
                          serve {it.serves}
                          {it.model && (
                            <button onClick={() => props.onOpenItem(id)} className="ml-1 font-bold text-ink underline">
                              ver na mesa
                            </button>
                          )}
                        </p>
                        <button
                          onClick={() => props.onAddCard(id)}
                          className="btn mt-2 w-full py-1.5 text-xs text-white"
                          style={{ background: color }}
                        >
                          {inCart ? "+ mais um" : `Adicionar ${brl(basePrice(it))}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="w-fit rounded-2xl rounded-bl-sm bg-white px-4 py-3 ring-1 ring-black/5">
            <span className="dot">●</span> <span className="dot">●</span> <span className="dot">●</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-black/5 bg-white p-3">
        {chat.length === 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 text-sm font-medium">
                {s}
              </button>
            ))}
          </div>
        )}
        {count > 0 && (
          <button onClick={props.onOpenCart} className="mb-2 w-full rounded-xl bg-black/5 py-2 text-sm font-semibold">
            Ver pedido ({count}) e finalizar
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            className="input flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua pergunta..."
            maxLength={500}
          />
          <button className="btn px-5 text-white" style={{ background: color }} disabled={busy || !input.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </Sheet>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return role === "user" ? (
    <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-ink px-3.5 py-2.5 text-[15px] text-white">{children}</p>
  ) : (
    <p className="w-fit max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[15px] ring-1 ring-black/5">{children}</p>
  );
}

