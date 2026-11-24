import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import HeroStage from "./HeroStage";

// O caminho do cliente é uma sequência de verdade: vira uma régua com três marcas.
const steps = [
  { cm: "0", t: "Lê o QR da mesa", d: "O cardápio abre no navegador do celular. Ninguém baixa aplicativo nem cria conta." },
  { cm: "20", t: "Vê o prato na mesa", d: "Aponta a câmera e o prato aparece ali, do tamanho que vai chegar. Acabou o “achei que era maior”." },
  { cm: "40", t: "Pede pelo celular", d: "Monta o pedido e envia. Chega na hora no seu painel, com o número da mesa." },
];

const scan = [
  { icon: "printer", t: "Imprima o marcador", d: "Uma folha A4 com um quadrado preto. É ela que dá a medida certa do prato." },
  { icon: "camera", t: "Dê uma volta no prato", d: "Coloque a folha ao lado e ande em volta. O celular guia e tira as fotos sozinho." },
  { icon: "cube", t: "O 3D sai na hora", d: "O celular mede largura, profundidade e altura, reconhece o prato e pinta com as cores de verdade." },
];

const features = [
  { icon: "scan", title: "Tamanho real, travado", text: "Funciona no iPhone e no Android, direto do navegador. O cliente não consegue “aumentar” a porção." },
  { icon: "receipt", title: "Pedidos na mesa e na entrega", text: "Painel ao vivo com aviso sonoro, comanda para imprimir e acompanhamento na tela do cliente." },
  { icon: "bell", title: "Chamar atendente e pedir a conta", text: "O cliente toca num botão e o chamado aparece no painel com o número da mesa." },
  { icon: "qr", title: "QR code de cada mesa", text: "Pronto para imprimir. O pedido já chega identificado, sem ninguém anotar mesa errada." },
  { icon: "chart", title: "Você vê o resultado", text: "Quantos clientes viram cada prato na mesa e quanto disso virou pedido." },
  { icon: "phone", title: "Painel no seu celular", text: "Instala como um app, sem loja. Você escaneia os pratos e acompanha os pedidos por ali." },
];

const plans = [
  { n: "Essencial", p: "149", d: ["Cardápio digital ilimitado", "Pedidos na mesa e na entrega", "QR code de cada mesa", "Até 10 pratos em 3D", "Escâner 3D incluso"] },
  { n: "Profissional", p: "299", d: ["Tudo do Essencial", "Até 40 pratos em 3D", "Relatório de quem viu cada prato", "Garçom de IA assim que lançar"], hl: true },
  { n: "Rede", p: "", d: ["Várias unidades", "Pratos em 3D ilimitados", "Escaneamento feito pela nossa equipe", "Suporte prioritário"] },
];

const faq = [
  { q: "O cliente precisa baixar algum aplicativo?", a: "Não. Ele aponta a câmera para o QR da mesa e o cardápio abre no navegador. O prato em 3D na mesa também funciona direto no navegador, no iPhone e no Android." },
  { q: "Preciso de equipamento especial para escanear os pratos?", a: "Só um celular e uma folha A4 impressa (o marcador). Você aponta a câmera, dá uma volta no prato seguindo as dicas da tela, e o 3D é montado no próprio aparelho, de graça." },
  { q: "Funciona com sobremesa, bebida e porção?", a: "O escâner foi feito para o que fica apoiado na mesa: pratos, lanches, pizzas, sobremesas, porções. Vidro e líquidos transparentes são o ponto fraco: nesses casos você confere e corrige a altura com uma régua antes de publicar." },
  { q: "E se eu não quiser receber pedidos pelo celular?", a: "Você pode usar só como cardápio com os pratos em 3D. Os pedidos ligam e desligam com um botão, a qualquer hora." },
];

export default function Home() {
  return (
    <main className="overflow-x-clip">
      {/* Palco: o prato sob a luz da mesa */}
      <section className="relative bg-ink text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_75%_45%,rgba(228,87,46,0.16),transparent_70%)]" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo size={34} />
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Principal">
            <a href="#como-funciona" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-medium text-white/70 transition-colors hover:text-white lg:inline">Como funciona</a>
            <a href="#planos" className="hidden rounded-lg px-3 py-2 text-[14.5px] font-medium text-white/70 transition-colors hover:text-white lg:inline">Planos</a>
            <a href="#perguntas" className="mr-2 hidden rounded-lg px-3 py-2 text-[14.5px] font-medium text-white/70 transition-colors hover:text-white lg:inline">Perguntas</a>
            <Link href="/entrar" className="btn text-white ring-1 ring-white/20 hover:bg-white/10">Entrar</Link>
            <Link href="/cadastro" className="btn-primary hidden sm:inline-flex">Testar grátis</Link>
          </nav>
        </header>

        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-5 pb-14 pt-6 md:grid-cols-[1.08fr_1fr] md:gap-8 md:pb-24 md:pt-10">
          <div>
            <h1 className="display-wide rise text-[42px] leading-[1] sm:text-[56px] lg:text-[68px]">
              Seu cliente vê o prato na mesa antes de pedir.
            </h1>
            <p className="rise rise-1 mt-6 max-w-[34rem] text-[17.5px] leading-relaxed text-white/70">
              Pela câmera do celular, o prato aparece em cima da mesa, no tamanho real. Você mesmo escaneia seus pratos com o celular, e o cliente pede direto por ali.
            </p>
            <div className="rise rise-2 mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro" className="btn-primary h-[54px] px-7 text-[16px]">Criar meu cardápio grátis</Link>
              <Link href="/r/cantina-da-nonna?mesa=7" className="btn h-[54px] px-6 text-[16px] text-white ring-1 ring-white/25 hover:bg-white/10">
                Ver um cardápio de exemplo
              </Link>
            </div>
            <p className="rise rise-3 mt-4 text-[14px] text-white/50">14 dias grátis. Sem cartão de crédito.</p>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* O caminho do cliente, numa régua */}
      <section id="como-funciona" className="scroll-mt-4 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="display-wide max-w-3xl text-[34px] leading-[1.02] md:text-[50px]">Do QR code ao pedido, em três toques.</h2>
          <div className="relative mt-14">
            {/* régua do computador */}
            <div aria-hidden className="ruler hidden h-5 text-black/25 md:block" />
            <ol className="grid gap-10 md:mt-0 md:grid-cols-3 md:gap-8">
              {steps.map((s, i) => (
                <li key={s.t} className="relative pl-12 md:pl-0 md:pt-8">
                  <span aria-hidden className="absolute left-0 top-0 md:-top-5 md:left-0">
                    <span className="tnum grid h-9 w-9 place-items-center rounded-full bg-brand font-display text-[15px] font-bold text-white ring-4 ring-cream md:-translate-x-1/2">
                      {i + 1}
                    </span>
                  </span>
                  <p className="tnum text-[13px] font-semibold text-black/45">{s.cm} cm</p>
                  <h3 className="mt-1 text-[22px] font-bold leading-tight">{s.t}</h3>
                  <p className="mt-2 max-w-sm text-[15.5px] leading-relaxed text-black/65">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Escâner */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 md:grid-cols-[0.9fr_1.1fr]">
          <ScanPhone />
          <div>
            <h2 className="display-wide text-[34px] leading-[1.02] md:text-[46px]">Você mesmo coloca seus pratos em 3D.</h2>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-black/65">
              Sem fotógrafo e sem estúdio. Mudou a apresentação do prato? Escaneie de novo: o trabalho todo é feito no seu celular e não tem custo por prato.
            </p>
            <ol className="mt-9 divide-y divide-line border-y border-line">
              {scan.map((s, i) => (
                <li key={s.t} className="flex gap-4 py-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                    <Icon name={s.icon} size={21} />
                  </span>
                  <div>
                    <h3 className="text-[18px] font-bold">
                      <span className="tnum text-brand">{i + 1}.</span> {s.t}
                    </h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-black/65">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="display-wide max-w-3xl text-[34px] leading-[1.02] md:text-[50px]">Tudo o que o salão precisa, num lugar só.</h2>
          <div className="mt-12 grid overflow-hidden rounded-3xl bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 1 }}>
            {features.map((f) => (
              <div key={f.title} className="group bg-cream p-7 transition-colors duration-300 hover:bg-white">
                <Icon name={f.icon} size={26} className="text-brand" />
                <h3 className="mt-5 text-[19px] font-bold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-black/65">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="scroll-mt-4 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display-wide text-[34px] leading-[1.02] md:text-[50px]">Planos</h2>
            <p className="text-[16px] text-black/60">Comece com 14 dias grátis. Você escolhe o plano depois.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3 md:items-stretch">
            {plans.map((pl) => (
              <div
                key={pl.n}
                className={`relative flex flex-col overflow-hidden rounded-3xl p-7 ${pl.hl ? "bg-ink text-white shadow-[0_30px_60px_-30px_rgba(29,26,22,0.7)] md:-my-3 md:py-10" : "bg-cream"}`}
              >
                {pl.hl && <div aria-hidden className="ruler absolute inset-x-0 top-0 h-3 text-brand" />}
                <p className="flex items-center justify-between font-display text-[18px] font-bold">
                  {pl.n}
                  {pl.hl && <span className="rounded-full bg-brand px-2.5 py-1 text-[12px] font-bold">Recomendado</span>}
                </p>
                <p className="tnum mt-4 font-display font-extrabold leading-none">
                  {pl.p ? (
                    <>
                      <span className="align-top text-[18px]">R$ </span>
                      <span className="display-wide text-[52px]">{pl.p}</span>
                      <span className={`text-[15px] font-medium ${pl.hl ? "text-white/55" : "text-black/50"}`}> por mês</span>
                    </>
                  ) : (
                    <span className="display-wide text-[34px] leading-[1.5]">Sob consulta</span>
                  )}
                </p>
                <ul className={`mt-6 flex-1 space-y-3 text-[15px] ${pl.hl ? "text-white/85" : "text-black/75"}`}>
                  {pl.d.map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <Icon name="check" size={18} stroke={2.4} className={`mt-0.5 shrink-0 ${pl.hl ? "text-ember" : "text-leaf"}`} />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className={`mt-8 h-12 ${pl.hl ? "btn-primary" : "btn-ghost"}`}>
                  {pl.p ? "Testar grátis" : "Criar conta e falar com a gente"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perguntas */}
      <section id="perguntas" className="scroll-mt-4 py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[0.8fr_1.2fr]">
          <h2 className="display-wide text-[34px] leading-[1.02] md:text-[50px]">Perguntas comuns</h2>
          <div className="divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <details key={f.q} className="faq group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[18px] font-bold transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/10 transition-transform duration-300 group-open:rotate-45">
                    <Icon name="plus" size={16} stroke={2.2} />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-black/65">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Fechamento */}
      <section className="relative bg-ink text-white">
        <div aria-hidden className="ruler h-4 text-white/25" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 md:flex-row md:items-end md:justify-between md:py-24">
          <h2 className="display-wide max-w-2xl text-[38px] leading-[1] md:text-[60px]">Coloque o primeiro prato em 3D ainda hoje.</h2>
          <Link href="/cadastro" className="btn-primary h-[56px] shrink-0 px-8 text-[16.5px]">Criar meu cardápio grátis</Link>
        </div>
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-8 text-[14px] text-white/50">
          <Logo size={24} className="text-white" />
          <p>© {new Date().getFullYear()} Visatto. Veja o prato antes de pedir.</p>
        </footer>
      </section>
    </main>
  );
}

/** Celular desenhado no meio do escaneamento: folha-marcador ao lado do prato e a moldura da câmera. */
function ScanPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(228,87,46,0.14),transparent)]" />
      <div className="relative rounded-[46px] bg-ink p-3 shadow-[0_40px_80px_-40px_rgba(29,26,22,0.8)]">
        <div className="relative aspect-[9/18] overflow-hidden rounded-[36px] bg-[#efe7dc]">
          {/* mesa */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#efe7dc_0%,#efe7dc_45%,#d8ccbb_100%)]" />
          {/* folha com o marcador, deitada na mesa */}
          <div className="absolute left-[8%] top-[52%] h-[20%] w-[34%] -skew-x-12 rounded-sm bg-white shadow-md">
            <div className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 bg-ink" />
            <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 bg-white" />
          </div>
          {/* o prato */}
          <img src="/demo/pizza.jpg" alt="" className="absolute left-[30%] top-[30%] w-[66%] mix-blend-multiply" />
          {/* moldura de captura */}
          <svg viewBox="0 0 100 100" className="absolute left-[26%] top-[33%] h-[34%] w-[70%]" preserveAspectRatio="none">
            {["M2 18V6Q2 2 6 2H18", "M82 2H94Q98 2 98 6V18", "M98 82V94Q98 98 94 98H82", "M18 98H6Q2 98 2 94V82"].map((d) => (
              <path key={d} d={d} fill="none" stroke="#E4572E" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {/* topo e barra de progresso da tela do escâner */}
          <p className="absolute inset-x-0 top-6 text-center text-[12.5px] font-semibold text-ink/80">Ande devagar em volta do prato</p>
          <div className="absolute inset-x-4 bottom-5 rounded-2xl bg-ink/90 p-3 text-white backdrop-blur">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>Fotos do prato</span>
              <span className="tnum text-white/70">18 de 24</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-3/4 rounded-full bg-brand" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
