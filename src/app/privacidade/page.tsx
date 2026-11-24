import type { Metadata } from "next";
import LegalPage, { contato } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de Privacidade · Visatto" };

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade" updated="24 de novembro de 2026">
      <p>
        Esta política explica quais dados o Visatto usa, para quê e como você controla esses dados, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
        O Visatto é uma plataforma de cardápio digital: restaurantes criam o cardápio, colocam pratos em 3D e recebem pedidos; os clientes dos restaurantes veem o cardápio e pedem pelo celular.
      </p>

      <h2>Quem cuida de cada dado</h2>
      <ul>
        <li><strong>Dados da conta do restaurante</strong> (quem assina o Visatto): o Visatto decide como esses dados são usados, e por isso é o controlador.</li>
        <li><strong>Dados dos clientes do restaurante</strong> (quem pede pelo cardápio): o restaurante é o controlador, e o Visatto trata esses dados em nome dele, como operador. Pedidos sobre esses dados devem ser feitos ao restaurante.</li>
      </ul>

      <h2>Quais dados usamos</h2>
      <h3>Do restaurante</h3>
      <ul>
        <li>Nome do restaurante, e-mail, WhatsApp e endereço.</li>
        <li>Senha, guardada apenas em forma embaralhada (bcrypt): ninguém, nem a equipe do Visatto, consegue ler a senha.</li>
        <li>Cardápio, fotos e modelos 3D dos pratos, configurações e resultados de vendas.</li>
      </ul>
      <h3>Do cliente do restaurante</h3>
      <ul>
        <li>No pedido na mesa: número da mesa, itens e observações.</li>
        <li>No pedido de entrega: nome, telefone, endereço e forma de pagamento.</li>
        <li>Conversas com o garçom de IA, quando o restaurante usa esse recurso.</li>
        <li>Nota e comentário de avaliação, quando o cliente decide avaliar.</li>
        <li>Aceite para receber novidades pelo WhatsApp, só quando o cliente marca essa opção.</li>
      </ul>
      <h3>Dados técnicos</h3>
      <ul>
        <li>Um código aleatório do aparelho, para manter o carrinho e o histórico do pedido. Ele não identifica a pessoa.</li>
        <li>Endereço IP, só para segurança (limitar tentativas de senha e abusos).</li>
        <li>Uso do cardápio (por exemplo, quantas vezes um prato foi visto em 3D), em números somados, para mostrar resultados ao restaurante.</li>
      </ul>
      <h3>Câmera</h3>
      <p>
        Ao ver um prato na mesa, a imagem da câmera é usada só no próprio celular e não é enviada a ninguém.
        Ao escanear um prato, o restaurante envia as fotos necessárias para montar e guardar o modelo 3D.
      </p>

      <h2>Para que usamos e com qual base legal</h2>
      <ul>
        <li><strong>Prestar o serviço</strong> (mostrar o cardápio, enviar pedidos, manter a conta): execução de contrato.</li>
        <li><strong>Segurança e prevenção de fraude</strong> (limite de tentativas, registros de acesso): legítimo interesse e cumprimento de obrigação legal.</li>
        <li><strong>Resultados para o restaurante</strong> (vendas, pratos mais vistos), sempre dentro da conta dele: legítimo interesse.</li>
        <li><strong>Novidades e promoções pelo WhatsApp</strong>: consentimento do cliente, que pode ser retirado a qualquer momento.</li>
      </ul>
      <p>O Visatto não vende dados e não usa dados de clientes de um restaurante para outro restaurante.</p>

      <h2>Com quem compartilhamos</h2>
      <p>Usamos empresas que fornecem a estrutura do serviço, sempre só com o necessário:</p>
      <ul>
        <li>Vercel (hospedagem do site e armazenamento de arquivos);</li>
        <li>Neon (banco de dados);</li>
        <li>Resend (envio de e-mails, como o de recuperação de senha);</li>
        <li>Anthropic (inteligência artificial), apenas quando o restaurante usa o garçom de IA, a tradução ou a importação de cardápio por foto: são enviados o cardápio e a conversa necessária para gerar a resposta.</li>
      </ul>
      <p>
        Algumas dessas empresas guardam dados fora do Brasil, principalmente nos Estados Unidos. Essa transferência segue o artigo 33 da LGPD, com contratos que exigem proteção equivalente.
      </p>

      <h2>Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e do cardápio: enquanto a conta existir.</li>
        <li>Pedidos e avaliações: enquanto a conta do restaurante existir, ou até o restaurante pedir a exclusão.</li>
        <li>Links de recuperação de senha: valem por 1 hora e funcionam uma vez só.</li>
        <li>Quando o restaurante exclui a conta (Configurações → Conta e segurança), apagamos cardápio, fotos, modelos 3D, pedidos, avaliações e dados de clientes daquela conta. Cópias de segurança dos fornecedores são apagadas no ciclo normal deles.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>Pela LGPD, você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, exclusão, informação sobre compartilhamento e revogação do consentimento.</p>
      <ul>
        <li><strong>Se você é o restaurante:</strong> corrija os dados em Configurações e exclua a conta em Configurações → Conta e segurança. Para outros pedidos, fale com a gente {contato()}.</li>
        <li><strong>Se você pediu por um cardápio:</strong> fale com o restaurante, que é o responsável pelos seus dados. Para parar de receber novidades, basta pedir ao restaurante pelo WhatsApp.</li>
      </ul>
      <p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>Como protegemos</h2>
      <ul>
        <li>Toda a conexão com o site é criptografada (HTTPS).</li>
        <li>Senhas são guardadas embaralhadas e há limite de tentativas de login.</li>
        <li>O restaurante pode sair de todos os aparelhos e trocar a senha a qualquer momento.</li>
        <li>Cada restaurante só acessa os dados da própria conta.</li>
      </ul>

      <h2>Cookies e armazenamento no aparelho</h2>
      <p>
        Usamos um único cookie, para manter o restaurante conectado ao painel. No celular do cliente, o cardápio guarda o carrinho, o idioma e o último pedido no próprio aparelho.
        Não usamos cookies de publicidade nem de rastreamento de terceiros.
      </p>

      <h2>Menores de idade</h2>
      <p>O Visatto é feito para restaurantes. Os cardápios podem ser usados por qualquer pessoa, mas não coletamos dados com o objetivo de identificar menores de idade.</p>

      <h2>Mudanças nesta política</h2>
      <p>Quando esta política mudar, a data no topo é atualizada. Mudanças importantes são avisadas no painel dos restaurantes.</p>
    </LegalPage>
  );
}
