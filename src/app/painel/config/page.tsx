"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import { usePainel } from "../ctx";
import { PageHead, SwitchRow } from "../ui";

const TONES = [
  "simpático e direto",
  "descontraído e brincalhão",
  "animado, de boteco, sem formalidade",
  "elegante e sofisticado",
  "acolhedor, como em casa de vó",
  "rápido e objetivo, de lanchonete",
];

export default function Config() {
  const { restaurant: r, reload, waiter, aiEnabled } = usePainel();
  const router = useRouter();
  const [f, setF] = useState({
    ...r,
    accepting_orders: r.accepting_orders !== false,
    pix_key: r.pix_key || "",
    google_review_url: r.google_review_url || "",
    delivery_fee: (r.delivery_fee_cents / 100).toFixed(2).replace(".", ","),
    min_order: (r.min_order_cents / 100).toFixed(2).replace(".", ","),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (patch: Record<string, unknown>) => {
    setF((x: any) => ({ ...x, ...patch }));
    setDirty(true);
    setMsg(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.dine_in_enabled && !f.delivery_enabled) return setMsg({ ok: false, text: "Deixe pelo menos uma forma de atendimento ligada: na mesa ou entrega." });
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/painel/restaurant", {
        method: "PUT",
        body: { ...f, delivery_fee_cents: f.delivery_fee, min_order_cents: f.min_order },
      });
      await reload();
      setDirty(false);
      setMsg({ ok: true, text: "Alterações salvas." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5 pb-24">
      <PageHead title="Configurações" />

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Restaurante</h2>
        <div>
          <label className="label" htmlFor="c-nome">Nome</label>
          <input id="c-nome" className="input" required maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="c-end">Endereço</label>
          <input id="c-end" className="input" maxLength={200} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-zap">WhatsApp do restaurante (com DDD)</label>
            <input id="c-zap" className="input" inputMode="tel" value={f.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="11999990000" />
            <p className="mt-1.5 text-[13px] text-black/50">O cliente usa para falar com você sobre o pedido.</p>
          </div>
          <div>
            <label className="label" htmlFor="c-cor">Cor da marca</label>
            <div className="flex gap-2">
              <input type="color" aria-label="Escolher cor" className="h-[46px] w-14 shrink-0 cursor-pointer rounded-xl border border-black/15 bg-white p-1" value={f.primary_color} onChange={(e) => set({ primary_color: e.target.value })} />
              <input id="c-cor" className="input" value={f.primary_color} onChange={(e) => set({ primary_color: e.target.value })} />
            </div>
            <p className="mt-1.5 text-[13px] text-black/50">Usada nos preços e nos botões do seu cardápio.</p>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Pedidos</h2>
        <SwitchRow on={f.accepting_orders} onChange={(v) => set({ accepting_orders: v })} title="Receber pedidos pelo celular" text="Desligado, o cliente só vê o cardápio e os pratos em 3D (bom para dias de casa cheia)." />
        <hr className="border-line" />
        <SwitchRow on={f.dine_in_enabled} onChange={(v) => set({ dine_in_enabled: v })} title="Pedidos na mesa" text="O cliente lê o QR da mesa, pede e pode chamar o atendente ou a conta." />
        <SwitchRow on={f.delivery_enabled} onChange={(v) => set({ delivery_enabled: v })} title="Entrega (delivery)" text="Pelo link do cardápio, com endereço e forma de pagamento." />
        {f.delivery_enabled && (
          <div className="space-y-4 rounded-2xl bg-cream p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="c-taxa">Taxa de entrega (R$)</label>
                <input id="c-taxa" className="input" inputMode="decimal" value={f.delivery_fee} onChange={(e) => set({ delivery_fee: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="c-min">Pedido mínimo (R$)</label>
                <input id="c-min" className="input" inputMode="decimal" value={f.min_order} onChange={(e) => set({ min_order: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="c-pix">Chave Pix (opcional)</label>
              <input id="c-pix" className="input" maxLength={120} value={f.pix_key} onChange={(e) => set({ pix_key: e.target.value })} placeholder="CNPJ, celular, e-mail ou chave aleatória" />
              <p className="mt-1.5 text-[13px] text-black/55">Quem escolher Pix na entrega vê esta chave com um botão de copiar. O Visatto não processa o pagamento: você confere o comprovante.</p>
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Avaliações no Google</h2>
        <p className="text-[14px] text-black/60">Depois do pedido, o cliente dá uma nota. Quem der 4 ou 5 estrelas é levado para avaliar no Google; quem der nota baixa escreve só para você, em Resultados.</p>
        <div>
          <label className="label" htmlFor="c-google">Link de avaliação do Google</label>
          <input id="c-google" className="input" inputMode="url" value={f.google_review_url} onChange={(e) => set({ google_review_url: e.target.value })} placeholder="https://g.page/r/..." />
          <p className="mt-1.5 text-[13px] text-black/50">No Google, abra o perfil do restaurante, toque em <b>Pedir avaliações</b> e copie o link.</p>
        </div>
      </section>

      <Languages initial={r.languages ?? []} aiEnabled={aiEnabled} />

      {waiter && <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Seu garçom de IA</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-ai-nome">Nome do garçom</label>
            <input id="c-ai-nome" className="input" value={f.ai_name} onChange={(e) => set({ ai_name: e.target.value })} placeholder="Ex.: Seu Zé, Nonna, Chef Bot" />
          </div>
          <div>
            <label className="label">Jeito de falar</label>
            <select className="input" value={TONES.includes(f.ai_tone) ? f.ai_tone : "custom"} onChange={(e) => set({ ai_tone: e.target.value === "custom" ? "" : e.target.value })}>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="custom">Outro...</option>
            </select>
            {!TONES.includes(f.ai_tone) && (
              <input className="input mt-2" value={f.ai_tone} onChange={(e) => set({ ai_tone: e.target.value })} placeholder="Descreva o tom" />
            )}
          </div>
        </div>
        <div>
          <label className="label">Instruções para o garçom</label>
          <textarea
            className="input"
            rows={5}
            value={f.ai_instructions}
            onChange={(e) => set({ ai_instructions: e.target.value })}
            placeholder={"Ex.:\n- Sempre ofereça a sobremesa do dia (pudim).\n- Nossa pizza grande tem 8 fatias e 35 cm.\n- Às terças, chopp em dobro.\n- Não temos estacionamento, mas há zona azul na rua."}
          />
          <p className="mt-1.5 text-[13px] text-black/50">Tudo o que você escrever aqui o garçom vai saber e usar na conversa.</p>
        </div>
      </section>}

      <section className="card p-5">
        <h2 className="text-[18px] font-extrabold">Conta</h2>
        <p className="mt-1 text-[14px] text-black/60">Entrou como <b className="text-ink">{r.email}</b></p>
        <button
          type="button"
          className="btn-ghost mt-3"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" }).catch(() => {});
            router.push("/entrar");
          }}
        >
          <Icon name="logout" size={17} /> Sair da conta
        </button>
      </section>

      {/* barra de salvar: fica sempre à vista */}
      <div className="no-print fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-[260px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 md:px-4">
          <button className="btn-primary h-12 px-6 text-[15px]" disabled={busy || !dirty}>{busy ? "Salvando..." : "Salvar alterações"}</button>
          {msg ? (
            <span role={msg.ok ? "status" : "alert"} className={`flex min-w-0 items-center gap-1.5 text-[14px] font-semibold ${msg.ok ? "text-leaf" : "text-red-700"}`}>
              <Icon name={msg.ok ? "check" : "alert"} size={16} stroke={2.2} /> {msg.text}
            </span>
          ) : dirty ? (
            <span className="text-[14px] text-black/55">Você tem alterações não salvas.</span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

/** Idiomas do cardápio: liga inglês e espanhol e traduz pratos e categorias com a IA. */
function Languages({ initial, aiEnabled }: { initial: string[]; aiEnabled: boolean }) {
  const [langs, setLangs] = useState<string[]>(Array.isArray(initial) ? initial : []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (l: string) => setLangs((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));
  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      if (!langs.length) {
        await api("/api/painel/translate", { method: "DELETE" });
        setMsg({ ok: true, text: "O cardápio volta a aparecer só em português." });
      } else {
        const res = await api<{ translated: number }>("/api/painel/translate", { body: { langs } });
        setMsg({ ok: true, text: res.translated ? `Pronto: ${res.translated} ${res.translated === 1 ? "item traduzido" : "itens traduzidos"}. O cliente escolhe o idioma no topo do cardápio.` : "Tudo já estava traduzido. O cliente escolhe o idioma no topo do cardápio." });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-[18px] font-extrabold">Idiomas do cardápio</h2>
      <p className="text-[14px] text-black/60">Para turistas: o cardápio aparece em inglês ou espanhol, conforme o idioma do celular, e o garçom de IA responde na língua do cliente.</p>
      <div className="flex flex-wrap gap-2">
        {[["en", "Inglês"], ["es", "Espanhol"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={langs.includes(id)} onClick={() => toggle(id)} className={`rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${langs.includes(id) ? "bg-ink text-white" : "bg-black/[0.06] text-black/70"}`}>
            {label}
          </button>
        ))}
      </div>
      {!aiEnabled && langs.length > 0 ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13.5px] text-amber-950">A tradução automática usa a IA paga, que ainda não está ligada neste site. Peça para ligar a chave da Anthropic.</p>
      ) : (
        <button type="button" className="btn-dark h-11" disabled={busy} onClick={run}>
          {busy ? "Traduzindo o cardápio..." : langs.length ? "Traduzir o cardápio agora" : "Usar só português"}
        </button>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[14px] font-semibold ${msg.ok ? "text-leaf" : "text-red-700"}`}>{msg.text}</p>}
      <p className="text-[12.5px] text-black/45">Quando você muda o nome ou a descrição de um prato, toque aqui de novo para traduzir as mudanças.</p>
    </section>
  );
}
