import "../ui.css";
import "./sales.css";
import { ownerLoginUrl, signupUrl, termsUrl } from "../service/links";

const BENEFITS = ["Cardápio digital", "Pedidos online", "Mais clientes", "Mais vendas"];

const STEPS = [
  {
    title: "Monte o cardápio falando",
    text: "Diga os pratos e os preços, ou fotografe o cardápio impresso. O sistema escreve e você só confere.",
  },
  {
    title: "Imprima o QR das mesas",
    text: "Cada mesa ganha um cartaz com QR code. O cliente aponta a câmera e já pede, sem chamar o garçom.",
  },
  {
    title: "Receba os pedidos no celular",
    text: "O pedido aparece no painel, com aviso. Você acompanha do preparo até a entrega.",
  },
];

const FEATURES = [
  "Cardápio digital no celular do cliente",
  "Pedido pelo QR da mesa, para entrega ou retirada",
  "Pagamento por Pix",
  "Chamar o garçom e pedir a conta pelo celular",
  "Painel de pedidos para a cozinha e para o salão",
  "Custo e lucro de cada prato",
];

/**
 * Página de venda para donos de restaurante: o que o "QR code para compra do sistema" da prancha de modelos abre.
 * Não mostra preço: o valor de lançamento ainda é decisão do GD.
 */
export default function SalesPage() {
  const { origin, pathname } = window.location;
  const signup = signupUrl(origin, pathname);

  return (
    <div className="sales">
      <header className="sales-bar">
        <img className="sales-logo" src="/logo-vem-comer.png" alt="Vem Comer" />
        <a className="sales-enter" href={ownerLoginUrl(origin, pathname)}>Entrar</a>
      </header>

      <main>
        <section className="sales-hero" aria-labelledby="sales-title">
          <p className="sales-eyebrow">Para restaurantes, lanchonetes, bares e sorveterias</p>
          <h1 id="sales-title" className="sales-title">Seu restaurante no próximo nível!</h1>
          <ul className="sales-ticks">
            {BENEFITS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a className="btn btn-primary btn-block sales-cta" href={signup}>Quero meu sistema</a>
        </section>

        <section className="sales-section" aria-labelledby="sales-how">
          <h2 id="sales-how" className="sales-h2">Como funciona</h2>
          <ol className="sales-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="sales-n" aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="sales-section" aria-labelledby="sales-has">
          <h2 id="sales-has" className="sales-h2">O que vem no sistema</h2>
          <ul className="sales-list">
            {FEATURES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="sales-end" aria-labelledby="sales-end-title">
          <h2 id="sales-end-title" className="sales-h2">Pronto para começar?</h2>
          <a className="btn btn-primary btn-block sales-cta" href={signup}>Quero meu sistema</a>
          <p className="sales-small">Já tem cadastro? <a href={ownerLoginUrl(origin, pathname)}>Entrar</a></p>
        </section>
      </main>

      <footer className="sales-foot">
        <p>Vem Comer · Pedido fácil, comida que chega.</p>
        <a href={termsUrl(origin, pathname)}>Termos de uso e privacidade</a>
        <a href="/api/privacidade">Seus direitos sobre os dados</a>
      </footer>
    </div>
  );
}
