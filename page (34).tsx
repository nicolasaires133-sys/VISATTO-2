import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import HeroDish from "./HeroDish";

const steps = [
  { t: "O cliente lê o QR da mesa", d: "O cardápio abre no navegador do celular. Ninguém precisa baixar aplicativo nem criar conta." },
  { t: "Vê o prato na própria mesa", d: "Aponta a câmera e o prato aparece ali, no tamanho real. Acabou o “achei que era maior”." },
  { t: "Pede pelo celular", d: "Monta o pedido e envia. Chega na hora no seu painel, com o número da mesa." },
];

const scan = [
  { icon: "printer", t: "Imprima o marcador", d: "Uma folha A4 com um quadrado preto. É a régua que dá o tamanho real." },
  { icon: "camera", t: "Aponte e dê uma volta", d: "Coloque a folha ao lado do prato e ande em volta. O celular guia e tira as fotos sozinho." },
  { icon: "cube", t: "O 3D sai na hora", d: "O próprio celular mede largura, profundidade e altura e monta o prato com as cores de verdade." },
];

const features = [
  { icon: "scan", title: "Tamanho real, travado", text: "A realidade aumentada funciona no iPhone e no Android, direto do navegador. O cliente não consegue “aumentar” a porção." },
  { icon: "receipt", title: "Pedidos na mesa e na entrega", text: "Painel ao vivo com aviso sonoro, comanda para imprimir e acompanhamento do pedido na tela do cliente." },
  { icon: "bell", title: "Chamar atendente e pedir a conta", text: "O cliente toca num botão e o chamado aparece no painel com o número da mesa." },
  { icon: "qr", title: "QR code de cada mesa", text: "Pronto para imprimir. O pedido já chega identificado, sem ninguém anotar mesa errada." },
  { icon: "chart", title: "Você vê o resultado", text: "Quantos clientes viram cada prato na mesa e quanto isso virou pedido." },
  { icon: "phone", title: "Painel no seu celular", text: "Instala como um app, sem loja. Você escaneia os pratos e acompanha os pedidos por ali." },
];

const plans = [
  { n: "Essencial", p: "R$ 149", d: ["Cardápio digital ilimitado", "Pedidos na mesa e na entrega", "QR code de cada mesa", "Até 10 pratos em 3D na mesa", "Escâner 3D incluso"] },
  { n: "Profissional", p: "R$ 299", d: ["Tudo do Essencial", "Até 40 pratos em 3D na mesa", "Relatório de quem viu cada prato", "Garçom de IA assim que lançar"], hl: true },
  { n: "Rede", p: "Sob consulta", d: ["Várias unidades", "Pratos em 3D ilimitados", "Escaneamento feito pela nossa equipe", "Suporte prioritário"] },
];

const faq = [
  { q: "O cliente precisa baixar algum aplicativo?", a: "Não. Ele aponta a câmera para o QR da mesa e o cardápio abre no navegador. O prato em 3D na mesa também funciona direto no navegador, no iPhone e no Android." },
  { q: "Preciso de equipamento especial para escanear os pratos?", a: "Só um celular e uma folha A4 impressa (o marcador). Você aponta a câmera, dá uma volta no prato seguindo as dicas da tela, e o 3D é montado no próprio aparelho." },
  { q: "Funciona com sobremesa, bebida e porção?", a: "O escâner foi feito para o que fica apoiado na mesa: pratos, lanches, pizzas, sobremesas, porções. Vidro e líquidos transparentes são o ponto fraco: nesses casos você confere e corrige a altura com uma régua antes de publicar." },
  { q: "E se eu não quiser receber pedidos pelo celular?", a: "Você pode usar só como cardápio com os pratos em 3D. Os pedidos ligam e desligam com um botão, a qualquer hora." },
];

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo size={34} />
        <nav className="flex items-center gap-2" aria-label="Conta">
          <Link href="/entrar" className="btn-ghost">Entrar</Link>
          <Link href="/cadastro" className="btn-dark hidden sm:inline-flex">Testar grátis</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-4 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-12">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">
            <Icon name="scan" size={14} stroke={2} /> Cardápio digital com o prato em 3D na mesa
          </p>
          <h1 className="mt-5 text-[42px] font-extrabold leading-[1.02] tracking-tight md:text-[64px]">
            Seu cliente vê o prato <span className="text-brand">na mesa</span> antes de pedir.
          </h1>
          <p className="mt-5 max-w-xl text-[17.5px] leading-relaxed text-black/65">
            Pela câmera do celular, o prato aparece em cima da mesa, no tamanho real. Você mesmo escaneia seus pratos em 20 segundos, só dando uma volta com o celular, e o cliente pede direto pelo celular.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/cadastro" className="btn-primary h-[52px] px-6 text-[16px]">Criar meu cardápio grátis</Link>
            <Link href="/r/cantina-da-nonna?mesa=7" className="btn-ghost h-[52px] px-6 text-[16px]">Ver um cardápio de exemplo</Link>
          </div>
          <p className="mt-3 text-[14px] text-black/50">14 dias grátis. Sem cartão de crédito.</p>
        </div>
        <HeroDish />
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-2xl text-[32px] font-extrabold leading-tight md:text-[40px]">Do QR code ao pedido, em três toques</h2>
          <ol className="mt-9 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="rounded-3xl bg-cream p-6">
                <span className="tnum grid h-9 w-9 place-items-center rounded-full bg-ink font-display text-[15px] font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 text-[19px] font-bold">{s.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-black/65">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink py-16 text-white md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Escâner 3D incluso</p>
            <h2 className="mt-3 text-[32px] font-extrabold leading-tight md:text-[40px]">Você mesmo coloca seus pratos em 3D. Sem fotógrafo, sem estúdio.</h2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-white/70">
              Mudou a apresentação do prato? Escaneie de novo. Não há custo por modelo: o trabalho todo é feito no seu celular.
            </p>
          </div>
          <ol className="space-y-3">
            {scan.map((s, i) => (
              <li key={s.t} className="flex gap-4 rounded-3xl bg-white/[0.07] p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand"><Icon name={s.icon} size={24} /></span>
                <div>
                  <h3 className="text-[18px] font-bold"><span className="tnum text-white/45">{i + 1}.</span> {s.t}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-white/70">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <h2 className="max-w-2xl text-[32px] font-extrabold leading-tight md:text-[40px]">Tudo o que o salão precisa, num lugar só</h2>
        <div className="mt-9 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white ring-1 ring-black/10"><Icon name={f.icon} size={22} /></span>
              <h3 className="mt-4 text-[18px] font-bold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-black/65">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-[32px] font-extrabold leading-tight md:text-[40px]">Planos</h2>
          <p className="mt-2 text-[16px] text-black/60">Comece com 14 dias grátis. Você escolhe o plano depois.</p>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {plans.map((pl) => (
              <div key={pl.n} className={`flex flex-col rounded-3xl p-6 ${pl.hl ? "bg-ink text-white" : "bg-cream"}`}>
                <p className="flex items-center justify-between font-display text-[17px] font-bold">
                  {pl.n}
                  {pl.hl && <span className="rounded-full bg-brand px-2.5 py-1 text-[11.5px] font-bold">Recomendado</span>}
                </p>
                <p className="tnum mt-3 font-display text-[36px] font-extrabold leading-none">
                  {pl.p}
                  {pl.p.startsWith("R$") && <span className={`text-[15px] font-medium ${pl.hl ? "text-white/55" : "text-black/50"}`}> /mês</span>}
                </p>
                <ul className={`mt-5 flex-1 space-y-2.5 text-[14.5px] ${pl.hl ? "text-white/85" : "text-black/75"}`}>
                  {pl.d.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Icon name="check" size={17} stroke={2.4} className={`mt-0.5 ${pl.hl ? "text-brand" : "text-leaf"}`} />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className={`mt-6 h-12 ${pl.hl ? "btn-primary" : "btn-ghost"}`}>{pl.p.startsWith("R$") ? "Testar grátis" : "Criar conta e falar com a gente"}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 md:py-20">
        <h2 className="text-[32px] font-extrabold leading-tight md:text-[40px]">Perguntas comuns</h2>
        <div className="mt-7 divide-y divide-line border-y border-line">
          {faq.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[17.5px] font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon name="down" size={19} className="transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-[15.5px] leading-relaxed text-black/65">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-6xl rounded-[32px] bg-brand px-6 py-14 text-center text-white">
          <h2 className="mx-auto max-w-2xl text-[32px] font-extrabold leading-tight md:text-[42px]">Coloque o primeiro prato em 3D ainda hoje.</h2>
          <Link href="/cadastro" className="btn mt-7 h-[52px] bg-white px-7 text-[16px] text-ink hover:bg-white/90">Criar meu cardápio grátis</Link>
        </div>
      </section>

      <footer className="border-t border-line py-9 text-center text-[14px] text-black/50">
        <Logo size={22} className="text-ink" />
        <p className="mt-2">© {new Date().getFullYear()} Visatto. Veja o prato antes de pedir.</p>
      </footer>
    </main>
  );
}
