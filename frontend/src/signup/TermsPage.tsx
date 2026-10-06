import "../ui.css";
import "../admin.css";
import "./signup.css";
import { signupUrl } from "../service/links";
import { TERMS_VERSION } from "./signupLogic";

/**
 * Antes de abrir o cadastro ao público:
 *  1. um advogado revisa o texto abaixo; depois disso, mude TERMS_REVIEWED para true;
 *  2. preencha SUPPORT_CONTACT (e-mail ou WhatsApp de suporte);
 *  3. se o texto mudou, mude também a versão (TERMS_VERSION em signupLogic.ts e em backend/signup.py).
 */
const TERMS_REVIEWED = false;
const SUPPORT_CONTACT = "";

/** "2026-10-06" -> "06/10/2026" */
function brDate(version: string): string {
  const [year, month, day] = version.split("-");
  return `${day}/${month}/${year}`;
}

export default function TermsPage() {
  return (
    <main className="adm">
      <article className="terms">
        <h1 className="adm-title">Termos de uso e privacidade</h1>
        <p className="adm-muted">Vem Comer · versão de {brDate(TERMS_VERSION)}</p>

        {!TERMS_REVIEWED && (
          <p className="terms-draft" role="note">
            Versão preliminar: este texto ainda vai ser revisado por um advogado.
          </p>
        )}

        <h2>O que é o Vem Comer</h2>
        <p>
          O Vem Comer é um sistema para restaurantes, bares, lanchonetes e carrinhos organizarem o cardápio e
          receberem pedidos. Quem vende a comida é o restaurante. O Vem Comer só fornece o sistema.
        </p>

        <h2>O seu cadastro</h2>
        <p>
          Para criar o cadastro pedimos o nome do restaurante, o seu nome, o seu e-mail, uma senha e, se você
          quiser, o seu WhatsApp. Guardamos também o dia em que você aceitou estes termos e a versão que você
          leu. A sua senha é guardada de forma protegida: ninguém consegue ler a senha, nem nós.
        </p>

        <h2>Cardápio, fotos e pedidos</h2>
        <p>
          O que você cadastra (pratos, preços, fotos e logomarca) e os pedidos dos seus clientes ficam guardados
          para o sistema funcionar. Os dados dos seus clientes são do seu restaurante. Nós só guardamos e
          protegemos esses dados para você, e não os vendemos.
        </p>

        <h2>Foto do cardápio lida por inteligência artificial</h2>
        <p>
          Se você usar a leitura do cardápio por foto, a imagem é enviada a um serviço de inteligência artificial
          (a Anthropic) só para ler os pratos e os preços. Você confere tudo antes de salvar.
        </p>

        <h2>Pix e pagamentos</h2>
        <p>
          O Vem Comer não recebe o dinheiro dos pedidos. O Pix vai direto para a chave que você cadastrar, e é
          você quem confirma o recebimento no painel.
        </p>

        <h2>Mensagens</h2>
        <p>
          Só enviaremos e-mail ou WhatsApp para você, ou para clientes do seu restaurante, com permissão de
          quem recebe, e sempre com um jeito de parar de receber.
        </p>

        <h2>Divulgação do Vem Comer</h2>
        <p>
          As imagens de divulgação que o sistema criar para o seu restaurante levam um QR Code pequeno do Vem
          Comer e do Vem Trabalhar. Quem decide se publica, e onde, é você.
        </p>

        <h2>Preço</h2>
        <p>
          Hoje este cadastro não tem cobrança. Se um dia houver, avisaremos antes e você escolhe se quer
          continuar.
        </p>

        <h2>Os seus direitos</h2>
        <p>
          Você pode pedir para ver, corrigir ou apagar os seus dados, e cancelar o cadastro, quando quiser.{" "}
          {SUPPORT_CONTACT
            ? `Fale com o suporte: ${SUPPORT_CONTACT}.`
            : "É só pedir ao suporte do Vem Comer, pelo mesmo canal em que você recebeu o link do cadastro."}
        </p>

        <h2>Se estes termos mudarem</h2>
        <p>Pediremos que você leia e aceite de novo.</p>

        <p>
          <a className="btn btn-outline" href={signupUrl(window.location.origin, window.location.pathname)}>
            Voltar ao cadastro
          </a>
        </p>
      </article>
    </main>
  );
}
