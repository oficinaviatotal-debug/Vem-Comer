import './styles/styles.css';
import { useState, useEffect } from "react";
import { fetchCompany, fetchProducts } from "./service/api";

type FeedbackType =
  | "food-good"
  | "food-salt"
  | "food-too-salty"
  | "service-good"
  | "service-improve"
  | "order-fast"
  | "order-slow";

type Feedback = {
  type: FeedbackType;
  comment: string;
};

type Company = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export default function App() {
  const COMPANY_ID = "e63e3538-e71e-4921-baa7-c4ce755a27ed";

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>({
    type: "food-good",
    comment: ""
  });

  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [companyData, productsData] = await Promise.all([
          fetchCompany(COMPANY_ID),
          fetchProducts(COMPANY_ID)
        ]);
        setCompany(companyData);
        setProducts(productsData);
      } catch (err) {
        setError("Erro ao carregar dados do estabelecimento.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function sendFeedback() {
    console.log(feedback);
    setMessage("Feedback enviado. Obrigado!");
  }

  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando estabelecimento...</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="error-container">
        <p>{error || "Estabelecimento nao encontrado."}</p>
      </div>
    );
  }

  return (
    <>
      <header className="site-header">
        <a className="site-header__logo" href="/">
          {company.name}
        </a>

        <nav className="site-header__nav" aria-label="Navegacao principal">
          <a href="#restaurantes">Cardapio</a>
          <a href="#feedback">Avaliar pedido</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Encontre o que voce quer comer</h1>

          <p>
            Consulte o cardapio, faca seu pedido e acompanhe tudo em um so
            lugar.
          </p>

          <form className="search-form">
            <label htmlFor="restaurant-search">
              Buscar no cardapio
            </label>

            <input
              id="restaurant-search"
              name="search"
              type="search"
              placeholder="Ex.: pizza, hamburguer, comida"
            />

            <button className="btn-primary" type="submit">
              Buscar
            </button>
          </form>
        </section>

        <section
          className="restaurants"
          id="restaurantes"
          aria-labelledby="restaurants-title"
        >
          <h2 id="restaurants-title">Nosso Cardapio</h2>

          <div className="products-grid">
            {products.length === 0 ? (
              <p>Nenhum produto cadastrado no momento.</p>
            ) : (
              products.map((product) => (
                <article key={product.id} className="restaurant-card">
                  <h3 className="restaurant-card__title">
                    {product.name}
                  </h3>

                  <p className="restaurant-card__description">
                    {product.description || "Sem descricao disponivel."}
                  </p>

                  <p className="restaurant-card__status">
                    R$ {Number(product.price).toFixed(2)}
                  </p>

                  <button className="btn-primary" type="button">
                    Adicionar ao carrinho
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section
          className="feedback"
          id="feedback"
          aria-labelledby="feedback-title"
        >
          <h2 id="feedback-title">Como foi sua experiencia?</h2>

          <p>
            Seu feedback ajuda o estabelecimento a melhorar.
          </p>

          <fieldset>
            <legend>Comida</legend>

            <label>
              <input
                type="radio"
                name="food"
                value="food-good"
                checked={feedback.type === "food-good"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "food-good" })
                }
              />
              A comida estava boa
            </label>

            <label>
              <input
                type="radio"
                name="food"
                value="food-salt"
                checked={feedback.type === "food-salt"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "food-salt" })
                }
              />
              Faltou sal
            </label>

            <label>
              <input
                type="radio"
                name="food"
                value="food-too-salty"
                checked={feedback.type === "food-too-salty"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "food-too-salty" })
                }
              />
              Estava muito salgada
            </label>
          </fieldset>

          <fieldset>
            <legend>Atendimento</legend>

            <label>
              <input
                type="radio"
                name="service"
                value="service-good"
                checked={feedback.type === "service-good"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "service-good" })
                }
              />
              Fui bem atendido
            </label>

            <label>
              <input
                type="radio"
                name="service"
                value="service-improve"
                checked={feedback.type === "service-improve"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "service-improve" })
                }
              />
              O atendimento pode melhorar
            </label>
          </fieldset>

          <fieldset>
            <legend>Pedido</legend>

            <label>
              <input
                type="radio"
                name="order"
                value="order-fast"
                checked={feedback.type === "order-fast"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "order-fast" })
                }
              />
              O pedido chegou rápido
            </label>

            <label>
              <input
                type="radio"
                name="order"
                value="order-slow"
                checked={feedback.type === "order-slow"}
                onChange={() =>
                  setFeedback({ ...feedback, type: "order-slow" })
                }
              />
              O pedido demorou
            </label>
          </fieldset>

          <label htmlFor="feedback-comment">Comentario</label>

          <textarea
            id="feedback-comment"
            name="comment"
            rows={4}
            maxLength={500}
            value={feedback.comment}
            onChange={(event) =>
              setFeedback({
                ...feedback,
                comment: event.target.value
              })
            }
            placeholder="Conte algo que possa ajudar..."
          />

          <button
            className="btn-primary"
            type="button"
            onClick={sendFeedback}
          >
            Enviar feedback
          </button>

          <p role="status">{message}</p>
        </section>
      </main>

      <footer className="site-footer">
        <p>{company.name}</p>
      </footer>
    </>
  );
}
