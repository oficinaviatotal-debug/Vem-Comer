import "./styles.css"
import { useState } from "react";

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

export default function App() {
  const [feedback, setFeedback] = useState<Feedback>({
    type: "food-good",
    comment: ""
  });

  const [message, setMessage] = useState("");

  function sendFeedback() {
    console.log(feedback);
    setMessage("Feedback enviado. Obrigado!");
  }

  return (
    <>
      <header className="site-header">
        <a className="site-header__logo" href="/">
          Vem Comer
        </a>

        <nav className="site-header__nav" aria-label="Navegação principal">
          <a href="#restaurantes">Restaurantes</a>
          <a href="#feedback">Avaliar pedido</a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Encontre o que você quer comer</h1>

          <p>
            Consulte o cardápio, faça seu pedido e acompanhe tudo em um só
            lugar.
          </p>

          <form className="search-form">
            <label htmlFor="restaurant-search">
              Buscar restaurante ou comida
            </label>

            <input
              id="restaurant-search"
              name="search"
              type="search"
              placeholder="Ex.: pizza, hambúrguer, comida"
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
          <h2 id="restaurants-title">Restaurantes</h2>

          <article className="restaurant-card">
            <h3 className="restaurant-card__title">
              Restaurante Exemplo
            </h3>

            <p className="restaurant-card__description">
              Hambúrgueres, refeições e bebidas.
            </p>

            <p className="restaurant-card__status">Aberto</p>

            <button className="btn-primary" type="button">
              Ver cardápio
            </button>
          </article>
        </section>

        <section
          className="feedback"
          id="feedback"
          aria-labelledby="feedback-title"
        >
          <h2 id="feedback-title">Como foi sua experiência?</h2>

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

          <label htmlFor="feedback-comment">Comentário</label>

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
        <p>Vem Comer</p>
      </footer>
    </>
  );
}