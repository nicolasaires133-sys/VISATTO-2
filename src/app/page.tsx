// Página inicial do Visatto. Direção visual: "ficha técnica do prato". Porcelana clara, tinta azul-marinho,
// cotas de medida como assinatura (o produto entrega o tamanho real) e telas reais do produto no lugar de ilustrações.
import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import HeroStage from "./HeroStage";
import Header from "./home/Header";
import Story, { type StoryStep } from "./home/Story";
import PanelShowcase from "./home/PanelShowcase";

const story: StoryStep[] = [
  {
    img: "/landing/cli-cardapio.webp",
    alt: "Cardápio aberto no celular, com o cartão fidelidade e os pratos da noite",
    title: "Lê o QR da mesa e o cardápio abre.",
    text: "Sem baixar aplicativo e sem criar conta. O cardápio já sabe a mesa, mostra o que combina com o horário e traz o cartão fidelidade de quem já veio.",
    points: ["Funciona em qualquer celular, direto no navegador", "Filtros de vegetariano, vegano e sem glúten", "Português, inglês e espanhol"],
  },
  {
    img: "/landing/cli-prato.webp",
    alt: "Pizza calabresa em 3D na tela do prato, com o botão Adicionar",
    title: "Vê o prato no tamanho real, antes de pedir.",
    text: "Toca em Ver na mesa e a pizza aparece em cima da mesa, pela câmera, do tamanho que vai chegar. Acaba o “achei que era maior”.",
    points: ["iPhone e Android, sem aplicativo", "O tamanho fica travado: ninguém aumenta a porção", "Sugestões do que combina, na hora de adicionar"],
  },
  {
    img: "/landing/cli-pedido.webp",
    alt: "Tela de acompanhamento do pedido com a previsão de ficar pronto",
    title: "Pede pelo celular e acompanha o preparo.",
    text: "O pedido cai na hora no painel da cozinha, com o número da mesa. O cliente vê cada etapa e a previsão de quando fica pronto.",
    points: ["Previsão feita com o tempo real da sua cozinha", "Chamar o garçom com um toque", "Cada pedido entregue vale selo no cartão fidelidade"],
  },
  {
    img: "/landing/cli-conta.webp",
    alt: "Conta da mesa dividida em duas pessoas, com a taxa de serviço opcional e o botão de Pix",
    title: "Divide a conta e paga no Pix, sem esperar.",
    text: "A mesa confere tudo o que pediu, divide igual ou cada um paga o seu. O Pix já sai com o valor certo e cai direto na sua conta.",
    points: ["Taxa de serviço aparece como opcional, sem nada marcado escondido", "Nenhuma taxa a mais para o cliente", "Cartão ou dinheiro: a equipe recebe o aviso para levar a maquininha"],
  },
];

const scan = [
  { t: "Uma folha A4 em branco", d: "Sulfite comum, sem imprimir nada, a um palmo do prato. É ela que dá a medida certa." },
  { t: "Uma volta devagar", d: "O celular guia e tira as fotos sozinho. Mesa branca? Um pano escuro embaixo da folha." },
  { t: "O 3D sai no próprio celular", d: "Mede largura, profundidade e altura, reconhece o prato e pinta com as cores de verdade." },
];

const groups = [
  {
    t: "Vender mais",
    items: [
      ["Sugestões na hora certa", "“Combina com” ao adicionar e antes de enviar o pedido."],
      ["Destaques por horário", "Almoço mostra o executivo; a noite, as pizzas e o vinho."],
      ["Cartão fidelidade", "Um selo por pedido. O prêmio é você quem escolhe."],
      ["Avaliações no Google", "Todo cliente recebe o convite depois de comer."],
    ],
  },
  {
    t: "Atender melhor",
    items: [
      ["Pedidos ao vivo com som", "Mesa e entrega na mesma tela, com comanda para imprimir."],
      ["Chamar o garçom", "O chamado chega no painel com o número da mesa."],
      ["Previsão de preparo", "O cliente sabe quando fica pronto e para de perguntar."],
      ["Busca que entende", "“Refri” acha a Coca; “lazanha” acha a lasanha."],
    ],
  },
  {
    t: "Receber e controlar",
    items: [
      ["Conta da mesa e Pix", "O dinheiro cai direto na sua conta, sem comissão."],
      ["Lucro de cada prato", "O que destacar, onde subir o preço e o que rever."],
      ["QR code de cada mesa", "Pronto para imprimir, com o número já marcado."],
      ["Painel no seu celular", "Instala como app, sem loja, e funciona no caixa."],
    ],
  },
];

const plans = [
  { n: "Essencial", p: "149", sub: "Para começar com o cardápio e os pedidos.", d: ["Cardápio digital ilimitado", "Pedidos na mesa e na entrega", "Conta da mesa com Pix", "Até 10 pratos em 3D", "Escâner 3D incluso"] },
  { n: "Profissional", p: "299", sub: "Para vender mais com 3D e fidelidade.", d: ["Tudo do Essencial", "Até 40 pratos em 3D", "Cartão fidelidade", "Lucro de cada prato", "Garçom de IA assim que lançar"], hl: true },
  { n: "Rede", p: "", sub: "Para várias unidades.", d: ["Várias unidades", "Pratos em 3D ilimitados", "Escaneamento feito pela nossa equipe", "Suporte prioritário"] },
];

const faq = [
  { q: "O cliente precisa baixar algum aplicativo?", a: "Não. Ele aponta a câmera para o QR da mesa e o cardápio abre no navegador. O prato em 3D na mesa também funciona direto no navegador, no iPhone e no Android." },
  { q: "Preciso de equipamento especial para escanear os pratos?", a: "Só um celular e uma folha A4 em branco, de sulfite comum. Você dá uma volta no prato seguindo as dicas da tela e o 3D é montado no próprio aparelho, de graça." },
  { q: "Como recebo o Pix da conta da mesa?", a: "Você coloca a sua chave Pix nas configurações. O cliente gera um Pix com o valor certo e o dinheiro cai direto na sua conta, sem passar pelo Visatto e sem comissão. Você confere no seu banco e fecha a mesa no painel." },
  { q: "É difícil de aprender?", a: "O painel tem um tour de um minuto no primeiro acesso, um botão Como usar em cada tela e uma página de ajuda com o passo a passo de cada tarefa, com os mesmos nomes dos botões. Dá para aprender sozinho e ensinar a equipe." },
  { q: "Funciona com sobremesa, bebida e porção?", a: "O escâner foi feito para o que fica apoiado na mesa: pratos, lanches, pizzas, sobremesas, porções. Vidro e líquidos transparentes são o ponto fraco: nesses casos você confere a altura antes de publicar." },
  { q: "E se eu não quiser receber pedidos pelo celular?", a: "Você pode usar só como cardápio com os pratos em 3D. Os pedidos ligam e desligam com um botão, a qualquer hora." },
];

/** Cota de desenho técnico: uma linha com as pontas marcadas e a medida no meio. */
function Cota({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div aria-hidden className={`flex items-center gap-3 text-current ${className}`}>
      <span className="h-3 w-px bg-current" />
      <span className="h-px flex-1 bg-current" />
      <span className="tnum shrink-0 text-[12.5px] font-semibold">{label}</span>
      <span className="h-px flex-1 bg-current" />
      <span className="h-3 w-px bg-current" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="overflow-x-clip bg-porcelain">
      <Header />

      {/* Início: a promessa e o prato medido */}
      <section className="relative">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-20 pt-8 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-14">
          <div>
            <h1 className="display-wide rise text-[44px] leading-[0.98] text-ink sm:text-[60px] lg:text-[72px]">
              O prato aparece na mesa antes do pedido.
            </h1>
            <p className="rise rise-1 mt-6 max-w-[33rem] text-[18px] leading-relaxed text-slate">
              Cardápio por QR code com o prato em 3D, no tamanho real, pela câmera do cliente. E tudo o que vem depois: pedido, conta dividida com Pix e cartão fidelidade.
            </p>
            <div className="rise rise-2 mt-9 flex flex-wrap gap-3">
              <Link href="/cadastro" className="btn-primary h-[54px] px-7 text-[16px]">Criar meu cardápio grátis</Link>
              <Link href="/r/cantina-da-nonna?mesa=7" className="btn-ghost h-[54px] px-6 text-[16px]">
                <Icon name="phone" size={18} /> Abrir o cardápio de exemplo
              </Link>
            </div>
            <p className="rise rise-3 mt-4 text-[14px] text-slate">14 dias grátis, sem cartão de crédito. Pronto para usar no mesmo dia.</p>

            <ul className="rise rise-3 mt-12 flex max-w-[34rem] flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-[14.5px] text-ink/80">
              {["Sem aplicativo para o cliente", "Escâner 3D no seu celular", "Sem comissão por pedido"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" size={16} stroke={2.6} className="text-leaf" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* O caminho do cliente */}
      <section id="cliente" className="scroll-mt-16 border-t border-line bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="max-w-3xl">
            <h2 className="display-wide text-[36px] leading-[1.02] md:text-[52px]">Do QR code à conta paga, sem chamar ninguém.</h2>
            <p className="mt-4 text-[18px] leading-relaxed text-slate">As telas abaixo são o cardápio de verdade, do restaurante de exemplo. Abra no seu celular e teste.</p>
          </div>
          <div className="mt-8 lg:mt-4">
            <Story steps={story} />
          </div>
        </div>
      </section>

      {/* O painel do dono */}
      <section id="painel" className="scroll-mt-16 border-t border-line py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <h2 className="display-wide text-[36px] leading-[1.02] md:text-[52px]">Um painel que se aprende em uma tarde.</h2>
              <p className="mt-4 text-[18px] leading-relaxed text-slate">Toque nos números em cima de cada tela para ver para que serve cada parte. É o mesmo caminho que o tour mostra no primeiro acesso.</p>
            </div>
          </div>
          <div className="mt-10">
            <PanelShowcase />
          </div>
        </div>
      </section>

      {/* Escâner */}
      <section id="escaner" className="relative scroll-mt-16 overflow-hidden bg-ink py-20 text-white md:py-28">
        <div aria-hidden className="mm-grid-dark absolute inset-0 [mask-image:linear-gradient(90deg,transparent,#000_30%,#000_70%,transparent)] opacity-60" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <ScanPhone />
          <div>
            <h2 className="display-wide text-[36px] leading-[1.02] md:text-[50px]">Você mesmo coloca os pratos em 3D.</h2>
            <p className="mt-4 max-w-lg text-[17.5px] leading-relaxed text-white/70">
              Sem fotógrafo, sem estúdio e sem custo por prato. Mudou a apresentação? Escaneie de novo em cinco minutos.
            </p>
            <ol className="mt-10 space-y-0">
              {scan.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-white/12 py-5 last:border-b">
                  <span className="tnum font-wide text-[15px] font-bold text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-[19px] font-bold">{s.t}</h3>
                    <p className="mt-1 text-[15.5px] leading-relaxed text-white/65">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Recursos, agrupados pelo que o dono quer resolver */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <h2 className="display-wide max-w-3xl text-[36px] leading-[1.02] md:text-[52px]">Tudo o que o salão precisa, num lugar só.</h2>
          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            {groups.map((g) => (
              <div key={g.t}>
                <h3 className="text-[15px] font-bold text-brand">{g.t}</h3>
                <ul className="mt-4 border-t border-ink">
                  {g.items.map(([t, d]) => (
                    <li key={t} className="border-b border-line py-4">
                      <b className="block text-[17px]">{t}</b>
                      <span className="mt-1 block text-[15px] leading-relaxed text-slate">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="scroll-mt-16 border-t border-line bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display-wide text-[36px] leading-[1.02] md:text-[52px]">Preços</h2>
            <p className="text-[16.5px] text-slate">14 dias grátis em qualquer plano. Sem fidelidade e sem comissão.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {plans.map((pl) => (
              <div key={pl.n} className={`relative flex flex-col rounded-[22px] p-7 ${pl.hl ? "bg-white ring-2 ring-ink" : "bg-porcelain ring-1 ring-line"}`}>
                {pl.hl && <span className="absolute -top-3 left-7 rounded-full bg-ink px-3 py-1 text-[12.5px] font-bold text-white">O mais escolhido</span>}
                <p className="text-[18px] font-bold">{pl.n}</p>
                <p className="mt-1 text-[14.5px] text-slate">{pl.sub}</p>
                <p className="tnum mt-6 leading-none">
                  {pl.p ? (
                    <>
                      <span className="align-top text-[17px] font-semibold">R$ </span>
                      <span className="display-wide text-[54px]">{pl.p}</span>
                      <span className="text-[15px] text-slate"> por mês</span>
                    </>
                  ) : (
                    <span className="display-wide text-[38px] leading-[1.42]">Sob consulta</span>
                  )}
                </p>
                <ul className="mt-7 flex-1 space-y-3 border-t border-line pt-6 text-[15px]">
                  {pl.d.map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <Icon name="check" size={18} stroke={2.4} className="mt-0.5 shrink-0 text-leaf" />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className={`mt-8 h-12 ${pl.hl ? "btn-primary" : "btn-ghost"}`}>
                  {pl.p ? "Começar os 14 dias grátis" : "Criar conta e falar com a gente"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perguntas */}
      <section id="perguntas" className="scroll-mt-16 border-t border-line py-20 md:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
          <div>
            <h2 className="display-wide text-[36px] leading-[1.02] md:text-[52px]">Perguntas comuns</h2>
            <p className="mt-4 max-w-xs text-[16px] leading-relaxed text-slate">Ficou alguma dúvida? Crie a conta grátis e veja o painel por dentro: não precisa de cartão.</p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <details key={f.q} className="faq group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[18px] font-bold transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white ring-1 ring-black/10 transition-transform duration-300 group-open:rotate-45">
                    <Icon name="plus" size={16} stroke={2.2} />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-slate">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Fechamento */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-20 md:px-8 md:pt-28">
          <h2 className="display-wide max-w-4xl text-[42px] leading-[0.98] md:text-[76px]">Seu primeiro prato em 3D ainda hoje.</h2>
          <Cota label="leva uns 5 minutos" className="mt-10 max-w-4xl text-white/40" />
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/cadastro" className="btn-primary h-[56px] px-8 text-[16.5px]">Criar meu cardápio grátis</Link>
            <Link href="/r/cantina-da-nonna?mesa=7" className="btn h-[56px] px-6 text-[16px] text-white ring-1 ring-white/20 hover:bg-white/10">Ver o exemplo antes</Link>
          </div>
          <footer className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-[14px] text-white/50">
            <Logo size={24} className="text-white" />
            <p className="flex flex-wrap gap-x-5 gap-y-1">
              <span>© {new Date().getFullYear()} Visatto</span>
              <Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link>
              <Link href="/termos" className="hover:text-white">Termos de Uso</Link>
              <Link href="/entrar" className="hover:text-white">Entrar</Link>
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}

/** Celular no meio do escaneamento: folha A4 em branco ao lado do prato e a moldura da câmera. */
function ScanPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="relative rounded-[46px] bg-[#0b101b] p-[9px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.1)]">
        <div className="relative aspect-[9/18.5] overflow-hidden rounded-[38px] bg-[#e9e3d8]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#ece6dc_0%,#e6dfd2_50%,#d6ccbd_100%)]" />
          {/* folha A4 em branco deitada na mesa, com a cota de 21 cm */}
          <div className="scan-sheet absolute left-[7%] top-[54%] h-[20%] w-[32%] -skew-x-12 rounded-[3px] bg-white shadow-md ring-1 ring-black/5" />
          <p className="tnum absolute left-[8%] top-[76%] text-[10.5px] font-bold text-ink/60">21 cm</p>
          <img src="/demo/pizza.jpg" alt="" className="absolute left-[30%] top-[30%] w-[66%] mix-blend-multiply [mask-image:radial-gradient(closest-side,#000_72%,transparent)]" />
          <svg viewBox="0 0 100 100" className="scan-frame absolute left-[26%] top-[33%] h-[34%] w-[70%]" preserveAspectRatio="none" aria-hidden>
            {["M2 18V6Q2 2 6 2H18", "M82 2H94Q98 2 98 6V18", "M98 82V94Q98 98 94 98H82", "M18 98H6Q2 98 2 94V82"].map((d) => (
              <path key={d} d={d} fill="none" stroke="#E4572E" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <p className="absolute inset-x-0 top-8 text-center text-[12.5px] font-semibold text-ink/80">Ande devagar em volta do prato</p>
          <div className="absolute inset-x-4 bottom-5 rounded-2xl bg-ink/90 p-3 text-white backdrop-blur">
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span>Fotos do prato</span>
              <span className="tnum text-white/70">18 de 24</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="scan-progress h-full w-3/4 rounded-full bg-brand" />
            </div>
          </div>
          <span aria-hidden className="absolute left-1/2 top-2.5 h-[22px] w-[30%] -translate-x-1/2 rounded-full bg-[#0b101b]" />
        </div>
      </div>
    </div>
  );
}
