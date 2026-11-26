import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { contato } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Termos de Uso · Visatto" };

export default function Termos() {
  return (
    <LegalPage title="Termos de Uso" updated="24 de novembro de 2026">
      <p>
        Estes termos valem para quem cria uma conta no Visatto (o restaurante) e para quem usa os cardápios publicados (o cliente).
        Ao criar a conta, o restaurante declara que leu e aceita estes termos e a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>O serviço</h2>
      <p>
        O Visatto oferece cardápio digital com pratos em 3D e na mesa pela câmera, pedidos pelo celular, painel de pedidos, escâner 3D no navegador e recursos opcionais de inteligência artificial.
        Os recursos podem mudar com o tempo para melhorar o serviço.
      </p>

      <h2>Conta e senha</h2>
      <ul>
        <li>O restaurante informa dados verdadeiros e mantém o e-mail atualizado, porque ele é usado para recuperar a senha.</li>
        <li>A senha é pessoal. Se desconfiar de acesso indevido, troque a senha e use “Sair de todos os outros aparelhos” em Configurações.</li>
        <li>O restaurante responde pelo que é feito na sua conta.</li>
      </ul>

      <h2>Teste grátis, planos e cancelamento</h2>
      <ul>
        <li>Toda conta nova tem 7 dias grátis, sem cartão.</li>
        <li>Depois do teste, o uso continua mediante assinatura mensal do plano escolhido, pelo preço mostrado no momento da contratação.</li>
        <li>O restaurante pode cancelar quando quiser. A exclusão da conta apaga os dados, como explicado na Política de Privacidade.</li>
      </ul>

      <h2>O que é responsabilidade do restaurante</h2>
      <ul>
        <li><strong>Informações do cardápio:</strong> nomes, preços, descrições, porções, disponibilidade e, principalmente, a ficha de alergênicos. O Visatto mostra o que o restaurante cadastra.</li>
        <li><strong>Pedidos, preparo, entrega e pagamento:</strong> a relação de consumo é entre o restaurante e o cliente.</li>
        <li><strong>Fotos e conteúdos enviados:</strong> o restaurante garante que tem direito de usar o que publica.</li>
        <li><strong>Dados dos clientes:</strong> o restaurante usa esses dados só para atender os pedidos e, com consentimento, para enviar novidades, respeitando a LGPD.</li>
      </ul>

      <h2>Medidas em 3D e inteligência artificial</h2>
      <ul>
        <li>O tamanho mostrado em 3D e na mesa é uma aproximação feita a partir do escaneamento. O restaurante deve conferir as medidas antes de publicar.</li>
        <li>O garçom de IA, as traduções e as sugestões de texto podem errar. Eles seguem as informações do cardápio e não substituem a confirmação da equipe, especialmente em casos de alergia.</li>
      </ul>

      <h2>Uso proibido</h2>
      <p>Não é permitido usar o Visatto para conteúdo ilegal ou enganoso, para enviar mensagens em massa sem consentimento, para tentar acessar dados de outras contas ou para atrapalhar o funcionamento do serviço. Contas que fizerem isso podem ser suspensas.</p>

      <h2>Disponibilidade</h2>
      <p>Trabalhamos para manter o serviço no ar o tempo todo, mas podem acontecer interrupções para manutenção ou por falhas de fornecedores. Quando possível, avisamos antes.</p>

      <h2>Limite de responsabilidade</h2>
      <p>O Visatto não responde por perdas causadas por informações erradas cadastradas pelo restaurante, por falhas de internet do usuário ou por uso fora destes termos, nos limites permitidos pela lei, incluindo o Código de Defesa do Consumidor.</p>

      <h2>Contato e lei aplicável</h2>
      <p>Dúvidas sobre estes termos podem ser enviadas {contato()}. Estes termos seguem as leis do Brasil.</p>
    </LegalPage>
  );
}
