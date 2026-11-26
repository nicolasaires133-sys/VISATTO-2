"use client";
import { ComoUsar } from "../ajuda-ui";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_NAMES, DEFAULT_HOURS, openState, readHours, type Hours } from "@/lib/hours";
import { api } from "@/lib/client";
import Icon from "@/components/Icon";
import PasswordField from "@/components/PasswordField";
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
  const { restaurant: r, reload, waiter, aiEnabled, toast } = usePainel();
  const router = useRouter();
  const [f, setF] = useState({
    ...r,
    accepting_orders: r.accepting_orders !== false,
    pix_key: r.pix_key || "",
    google_review_url: r.google_review_url || "",
    delivery_fee: (r.delivery_fee_cents / 100).toFixed(2).replace(".", ","),
    min_order: (r.min_order_cents / 100).toFixed(2).replace(".", ","),
    service_pct: String(r.service_pct ?? 10),
    l_on: Boolean(r.loyalty?.on),
    l_goal: String(r.loyalty?.goal ?? 10),
    l_min: ((r.loyalty?.min_cents ?? 0) / 100).toFixed(2).replace(".", ","),
    l_reward: r.loyalty?.reward ?? "",
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
        body: {
          ...f,
          delivery_fee_cents: f.delivery_fee,
          min_order_cents: f.min_order,
          service_pct: f.service_pct,
          loyalty: { on: f.l_on, goal: f.l_goal, min_cents: f.l_min, reward: f.l_reward },
        },
      });
      await reload();
      setDirty(false);
      setMsg({ ok: true, text: "Alterações salvas." });
      toast("Alterações salvas");
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  }

  return (
    <>
    <form onSubmit={save} className="max-w-2xl space-y-5 pb-24">
      <PageHead title="Configurações" sub="Pagamento, fidelidade, entrega e a cara do seu cardápio."><ComoUsar tela="config" /></PageHead>

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
            <p className="mt-1.5 text-[13px] text-black/60">O cliente usa para falar com você sobre o pedido.</p>
          </div>
          <div>
            <label className="label" htmlFor="c-cor">Cor da marca</label>
            <div className="flex gap-2">
              <input type="color" aria-label="Escolher cor" className="h-[46px] w-14 shrink-0 cursor-pointer rounded-xl border border-black/15 bg-white p-1" value={f.primary_color} onChange={(e) => set({ primary_color: e.target.value })} />
              <input id="c-cor" className="input" value={f.primary_color} onChange={(e) => set({ primary_color: e.target.value })} />
            </div>
            <p className="mt-1.5 text-[13px] text-black/60">Usada nos preços e nos botões do seu cardápio.</p>
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
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Pagamento e conta da mesa</h2>
        <p className="text-[14px] text-black/60">Na mesa, o cliente abre a conta pelo celular, confere tudo o que pediu, divide com os amigos e avisa como vai pagar. Você recebe o aviso aqui em Pedidos.</p>
        <div>
          <label className="label" htmlFor="c-pix">Chave Pix (opcional)</label>
          <input id="c-pix" className="input" maxLength={120} value={f.pix_key} onChange={(e) => set({ pix_key: e.target.value })} placeholder="CNPJ, celular, e-mail ou chave aleatória" />
          <p className="mt-1.5 text-[13px] text-black/55">Com a chave, o cliente paga a conta (ou a parte dele) com um Pix já com o valor certo, e na entrega vê a chave para copiar. O dinheiro cai direto na sua conta, sem taxa do Visatto. Confira no seu banco antes de fechar a mesa.</p>
        </div>
        <div>
          <label className="label" htmlFor="c-serv">Taxa de serviço sugerida na conta da mesa (%)</label>
          <input id="c-serv" className="input max-w-28" inputMode="numeric" value={f.service_pct} onChange={(e) => set({ service_pct: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
          <p className="mt-1.5 text-[13px] text-black/60">Aparece como opcional, e o cliente pode tirar. Coloque 0 se o restaurante não cobra.</p>
        </div>
      </section>

      <HoursEditor h={(f as any).hours ?? DEFAULT_HOURS} onChange={(hours) => set({ hours })} />

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Cartão fidelidade</h2>
        <SwitchRow on={f.l_on} onChange={(v) => set({ l_on: v })} title="Dar selos a cada pedido" text="O cliente informa o WhatsApp no pedido e junta um selo por pedido entregue. Ao completar o cartão, o pedido chega aqui com o aviso do prêmio." />
        {f.l_on && (
          <div className="space-y-4 rounded-2xl bg-cream p-4">
            <div>
              <label className="label" htmlFor="c-premio">Prêmio</label>
              <input id="c-premio" className="input" maxLength={80} value={f.l_reward} onChange={(e) => set({ l_reward: e.target.value })} placeholder="Ex.: uma sobremesa da casa" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="c-meta">Selos para ganhar</label>
                <input id="c-meta" className="input" inputMode="numeric" value={f.l_goal} onChange={(e) => set({ l_goal: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              </div>
              <div>
                <label className="label" htmlFor="c-lmin">Valor mínimo do pedido (R$)</label>
                <input id="c-lmin" className="input" inputMode="decimal" value={f.l_min} onChange={(e) => set({ l_min: e.target.value })} />
              </div>
            </div>
            <p className="text-[13px] text-black/55">Restaurantes com cartão fidelidade costumam ver os clientes voltarem mais. Só pedidos marcados como entregues contam selo.</p>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-[18px] font-extrabold">Avaliações no Google</h2>
        <p className="text-[14px] text-black/60">Depois do pedido, o cliente dá uma nota e todos recebem o convite para avaliar no Google. Quem der nota baixa também pode escrever só para você, em Resultados.</p>
        <div>
          <label className="label" htmlFor="c-google">Link de avaliação do Google</label>
          <input id="c-google" className="input" inputMode="url" value={f.google_review_url} onChange={(e) => set({ google_review_url: e.target.value })} placeholder="https://g.page/r/..." />
          <p className="mt-1.5 text-[13px] text-black/60">No Google, abra o perfil do restaurante, toque em <b>Pedir avaliações</b> e copie o link.</p>
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
          <p className="mt-1.5 text-[13px] text-black/60">Tudo o que você escrever aqui o garçom vai saber e usar na conversa.</p>
        </div>
      </section>}

      

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
    <div className="max-w-2xl pb-28 -mt-20"><Account email={r.email} /></div>
    </>
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
      <p className="text-[12.5px] text-black/60">Quando você muda o nome ou a descrição de um prato, toque aqui de novo para traduzir as mudanças.</p>
    </section>
  );
}

/** Conta: trocar senha, sair de todos os aparelhos, sair, excluir a conta. */
function Account({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"" | "senha" | "excluir">("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-[18px] font-extrabold">Conta e segurança</h2>
        <p className="mt-1 text-[14px] text-black/60">Entrou como <b className="text-ink">{email}</b></p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => { setOpen(open === "senha" ? "" : "senha"); setMsg(null); }}>
          <Icon name="lock" size={17} /> Trocar senha
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => run(async () => {
            await api("/api/auth/logout-all", { method: "POST" });
            setMsg({ ok: true, text: "Pronto: todos os outros aparelhos saíram da conta. Este continua conectado." });
          })}
        >
          <Icon name="shield" size={17} /> Sair de todos os outros aparelhos
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" }).catch(() => {});
            router.push("/entrar");
          }}
        >
          <Icon name="logout" size={17} /> Sair da conta
        </button>
      </div>

      {open === "senha" && (
        <form
          className="animate-enter space-y-3 rounded-2xl bg-cream p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/auth/password", { body: { current: cur, next } });
              setCur("");
              setNext("");
              setOpen("");
              setMsg({ ok: true, text: "Senha trocada. Os outros aparelhos vão precisar entrar de novo." });
            });
          }}
        >
          <PasswordField id="pw-atual" label="Senha atual" value={cur} onChange={setCur} />
          <PasswordField id="pw-nova" label="Senha nova" isNew value={next} onChange={setNext} />
          <button className="btn-dark h-11" disabled={busy}>{busy ? "Salvando..." : "Salvar senha nova"}</button>
        </form>
      )}

      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[14px] font-semibold ${msg.ok ? "text-leaf" : "text-red-700"}`}>{msg.text}</p>}

      <div className="border-t border-line pt-4">
        {open !== "excluir" ? (
          <button type="button" className="text-[14px] font-semibold text-red-700 underline-offset-2 hover:underline" onClick={() => { setOpen("excluir"); setMsg(null); }}>
            Excluir minha conta
          </button>
        ) : (
          <form
            className="animate-enter space-y-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/api/auth/delete", { body: { password: cur, confirm: conf } });
                router.push("/?conta=excluida");
              });
            }}
          >
            <p className="text-[14.5px] font-bold text-red-900">Excluir a conta apaga tudo, para sempre</p>
            <p className="text-[13.5px] text-red-900/80">Cardápio, fotos, pratos em 3D, pedidos, avaliações e os dados dos seus clientes. Não dá para desfazer.</p>
            <PasswordField id="del-pw" label="Sua senha" value={cur} onChange={setCur} />
            <div>
              <label className="label" htmlFor="del-conf">Digite EXCLUIR para confirmar</label>
              <input id="del-conf" className="input h-12" value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn h-11 bg-red-700 text-white hover:bg-red-800" disabled={busy || conf.trim().toUpperCase() !== "EXCLUIR" || !cur}>
                {busy ? "Excluindo..." : "Excluir conta para sempre"}
              </button>
              <button type="button" className="btn-ghost h-11" onClick={() => { setOpen(""); setCur(""); setConf(""); }}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/** Horário de funcionamento: um horário por dia (pode passar da meia-noite) e a chave para usar. */
function HoursEditor({ h, onChange }: { h: Hours; onChange: (h: Hours) => void }) {
  const hours = readHours(h);
  const on = Boolean(h.on);
  const setDay = (i: number, d: Hours["days"][number]) => onChange({ on, days: hours.days.map((x, k) => (k === i ? d : x)) });
  const st = openState({ on: true, days: hours.days });
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-[18px] font-extrabold">Horário de funcionamento</h2>
      <SwitchRow
        on={on}
        onChange={(v) => onChange({ on: v, days: hours.days })}
        title="Usar horário de funcionamento"
        text="O cardápio mostra “Aberto até 23h” ou “Fechado, abre às 18h”. Fora do horário, o cliente vê o cardápio e os pratos em 3D, mas não envia pedidos pelo celular."
      />
      {on && (
        <>
          <ul className="divide-y divide-black/[0.07] rounded-2xl ring-1 ring-black/10">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => {
              const d = hours.days[i];
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  <label className="flex w-28 items-center gap-2.5 text-[15px] font-semibold capitalize">
                    <input type="checkbox" className="h-5 w-5 accent-[#172033]" checked={!!d} onChange={(e) => setDay(i, e.target.checked ? { from: "11:00", to: "23:00" } : null)} />
                    {DAY_NAMES[i]}
                  </label>
                  {d ? (
                    <span className="flex items-center gap-2 text-[14px]">
                      <input aria-label={`Abre ${DAY_NAMES[i]}`} type="time" className="input h-10 w-auto" value={d.from} onChange={(e) => setDay(i, { ...d, from: e.target.value })} />
                      às
                      <input aria-label={`Fecha ${DAY_NAMES[i]}`} type="time" className="input h-10 w-auto" value={d.to} onChange={(e) => setDay(i, { ...d, to: e.target.value })} />
                    </span>
                  ) : (
                    <span className="text-[14px] text-black/55">Fechado</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[13.5px] text-black/60">Agora: <b>{st.label || "—"}</b>. Se fecha depois da meia-noite, é só pôr, por exemplo, 18:00 às 02:00.</p>
        </>
      )}
    </section>
  );
}
