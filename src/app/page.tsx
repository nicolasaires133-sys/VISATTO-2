// Página inicial do Visatto, escura e cinematográfica: a comida em 3D é a estrela, sob luz de restaurante,
// e a rolagem conduz as cenas (o prato gira e é medido, pousa na mesa, os pratos passam, o escâner fecha o anel).
import { Backdrop, Contours, Divider } from "./home/Backdrop";
import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import Header from "./home/Header";
import Hero from "./home/Hero";
import WordReveal from "./home/WordReveal";
import ARScene from "./home/ARScene";
import Gallery from "./home/Gallery";
import ScanScene from "./home/ScanScene";
import Story, { type StoryStep } from "./home/Story";
import PanelShowcase from "./home/PanelShowcase";
import FinalDish from "./home/FinalDish";

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
    title: "Gira o prato e vê na mesa antes de pedir.",
    text: "Cada prato com 3D tem o botão Ver na mesa. Junto, o cardápio sugere o que combina: a bebida, a sobremesa, a porção.",
    points: ["iPhone e Android, sem aplicativo", "Sugestões do que combina, na hora de adicionar", "Favoritos guardados no celular do cliente"],
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
    points: ["Taxa de serviço opcional, sem nada marcado escondido", "Nenhuma taxa a mais para o cliente", "Cartão ou dinheiro: a equipe recebe o aviso para levar a maquininha"],
  },
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

export default function Home() {
  return (
    <main className="cine isolate overflow-x-clip bg-[#07090d] text-white">
      <Backdrop />
      <div aria-hidden className="cine-grain pointer-events-none fixed inset-0 z-50 hidden md:block" />
      <Header />

      <Hero />

      <WordReveal
        text="Foto engana. O cliente pede a pizza grande achando que é a média, e a reclamação chega junto com a conta. Com o Visatto, ele vê o prato na mesa antes de pedir."
        accent={["Visatto", "antes"]}
      />

      <ARScene />

      <Gallery />

      {/* o caminho completo do cliente, em telas reais */}
      <section id="cliente" className="relative scroll-mt-16 py-24 md:py-36">
        <Divider />
        <Contours seed={1.3} className="-right-40 top-10 w-[720px] opacity-80 md:-right-24" />
        <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
          <p className="cine-kicker">Para o cliente</p>
          <h2 className="cine-title mt-3 max-w-4xl text-[clamp(40px,6vw,88px)] leading-[0.95]">Do QR code à conta paga, sem chamar ninguém.</h2>
          <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/60">As telas são o cardápio de verdade, do restaurante de exemplo. Abra no seu celular e teste.</p>
          <div className="mt-6">
            <Story steps={story} dark />
          </div>
        </div>
      </section>

      <ScanScene />

      {/* o painel do dono */}
      <section id="painel" className="relative scroll-mt-16 py-24 md:py-36">
        <Divider />
        <Contours seed={4.1} tone="#7fa2ff" className="-left-56 top-24 w-[760px] opacity-70" />
        <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
          <p className="cine-kicker">Para você</p>
          <h2 className="cine-title mt-3 max-w-4xl text-[clamp(40px,6vw,88px)] leading-[0.95]">Um painel que se aprende em uma tarde.</h2>
          <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/60">Toque nos números em cima de cada tela para ver para que serve cada parte. No primeiro acesso, um tour guiado mostra o mesmo caminho.</p>
          <div className="mt-12">
            <PanelShowcase dark />
          </div>
        </div>
      </section>

      {/* recursos */}
      <section className="relative py-24 md:py-32">
        <Divider />
        <Contours seed={2.6} className="-right-48 bottom-0 w-[680px] opacity-70" />
        <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
          <h2 className="cine-title max-w-4xl text-[clamp(40px,6vw,88px)] leading-[0.95]">Tudo o que o salão precisa, num lugar só.</h2>
          <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
            {groups.map((g) => (
              <div key={g.t}>
                <h3 className="text-[15px] font-bold text-[#ff7a4d]">{g.t}</h3>
                <ul className="mt-4 border-t border-white/25">
                  {g.items.map(([t, d]) => (
                    <li key={t} className="border-b border-white/10 py-5">
                      <b className="block text-[18px]">{t}</b>
                      <span className="mt-1.5 block text-[15px] leading-relaxed text-white/55">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* preços */}
      <section id="precos" className="relative scroll-mt-16 py-24 md:py-32">
        <Divider />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[min(1100px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,106,61,0.12), transparent 70%)" }} />
        <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="cine-title text-[clamp(40px,6vw,88px)] leading-[0.95]">Preços</h2>
            <p className="text-[16.5px] text-white/55">14 dias grátis em qualquer plano. Sem fidelidade e sem comissão.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {plans.map((pl) => (
              <div key={pl.n} className={`relative flex flex-col rounded-[26px] p-7 ${pl.hl ? "cine-card-hl" : "cine-card"}`}>
                {pl.hl && <span className="absolute -top-3 left-7 rounded-full bg-[#cf4520] px-3 py-1 text-[12.5px] font-bold text-white">O mais escolhido</span>}
                <p className="text-[18px] font-bold">{pl.n}</p>
                <p className="mt-1 text-[14.5px] text-white/55">{pl.sub}</p>
                <p className="tnum mt-7 leading-none">
                  {pl.p ? (
                    <>
                      <span className="align-top text-[17px] font-semibold text-white/70">R$ </span>
                      <span className="cine-title text-[60px]">{pl.p}</span>
                      <span className="text-[15px] text-white/50"> por mês</span>
                    </>
                  ) : (
                    <span className="cine-title text-[40px] leading-[1.5]">Sob consulta</span>
                  )}
                </p>
                <ul className="mt-7 flex-1 space-y-3 border-t border-white/10 pt-6 text-[15px] text-white/85">
                  {pl.d.map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <Icon name="check" size={18} stroke={2.4} className="mt-0.5 shrink-0 text-[#ff7a4d]" />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href="/cadastro" className={`mt-8 ${pl.hl ? "cine-btn" : "cine-btn-ghost"} w-full`}>
                  {pl.p ? "Começar os 14 dias grátis" : "Criar conta e falar com a gente"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* perguntas */}
      <section id="perguntas" className="relative scroll-mt-16 py-24 md:py-32">
        <Divider />
        <Contours seed={5.7} tone="#7fa2ff" className="-left-60 bottom-[-120px] w-[640px] opacity-60" />
        <div className="relative mx-auto grid max-w-[1200px] gap-10 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
          <div>
            <h2 className="cine-title text-[clamp(40px,5vw,72px)] leading-[0.95]">Perguntas comuns</h2>
            <p className="mt-5 max-w-xs text-[16px] leading-relaxed text-white/55">Ficou alguma dúvida? Crie a conta grátis e veja o painel por dentro: não precisa de cartão.</p>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {faq.map((f) => (
              <details key={f.q} className="faq group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 text-[18px] font-bold transition-colors hover:text-[#ff7a4d] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-white/20 transition-transform duration-300 group-open:rotate-45">
                    <Icon name="plus" size={16} stroke={2.2} />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-[16px] leading-relaxed text-white/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <FinalDish />

      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 py-10 text-[14px] text-white/45 md:px-8">
        <Logo size={24} className="text-white" />
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <span>© {new Date().getFullYear()} Visatto</span>
          <Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link>
          <Link href="/termos" className="hover:text-white">Termos de Uso</Link>
          <Link href="/entrar" className="hover:text-white">Entrar</Link>
        </p>
      </footer>
    </main>
  );
}
