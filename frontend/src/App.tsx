import { useEffect, useState } from "react";
import "./styles.css";
import {
  API_URL,
  createFeedback,
  createOrder,
  fetchCompany,
  fetchMenus,
  fetchProducts,
  fetchOrder,
} from "./service/api";

type Company = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  company_id: string;
  menu_id: string | null;
  name: string;
  description: string;
  price: number;
};

type Menu = {
  id: string;
  name: string;
  active: boolean;
};

type CartItem = Product & {
  quantity: number;
};

export default function App() {
  const COMPANY_ID = "e63e3538-e71e-4921-baa7-c4ce755a27ed";

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [foodRating, setFoodRating] = useState("boa");
  const [serviceRating, setServiceRating] = useState("bom");
  const [deliveryRating, setDeliveryRating] = useState("rapido");
  const [comment, setComment] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [companyData, productsData, menusData] = await Promise.all([
          fetchCompany(COMPANY_ID),
          fetchProducts(COMPANY_ID),
          fetchMenus(COMPANY_ID),
        ]);

        setCompany(companyData);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setMenus(Array.isArray(menusData) ? menusData : []);
      } catch {
        setError("Erro ao carregar dados do estabelecimento.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function addToCart(product: Product) {
    setOrderMessage("");
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);

      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleOrderSubmit() {
    try {
      const response = await createOrder(
        COMPANY_ID,
        "Cliente Balcão",
        cartTotal,
        cart
      );

      if (!response) {
        throw new Error();
      }

      setOrderMessage("Pedido realizado com sucesso!");
      setCart([]);
    } catch {
      setOrderMessage("Erro ao fechar o pedido. Tente novamente.");
    }
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createFeedback(
        COMPANY_ID,
        foodRating,
        serviceRating,
        deliveryRating,
        comment
      );

      setFeedbackMessage(
        "Avaliação enviada com sucesso! Obrigado."
      );
      setComment("");
    } catch {
      setFeedbackMessage(
        "Erro ao enviar avaliação. Tente novamente."
      );
    }
  }

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  );

  if (loading) {
    return (
      <main className="loading-state">
        <p>Carregando estabelecimento...</p>
      </main>
    );
  }

  if (error || !company) {
    return (
      <main className="error-state">
        <p>{error || "Estabelecimento não encontrado."}</p>
      </main>
    );
  }

  return (
    <>
      <header className="main-header">
        <div className="main-header__container">
          <a className="main-header__logo" href="/">
            {company.name}
          </a>

          <nav
            className="main-header__nav"
            aria-label="Navegação principal"
          >
            <a href="#cardapio">Cardápio</a>
            <a href="#pedido">
              Meu pedido (
              {cart.reduce((sum, item) => sum + item.quantity, 0)})
            </a>
            <a href="#feedback">Avaliar</a>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <section
          className="hero-section"
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title">
            Encontre o que você quer comer
          </h1>

          <p className="hero-section__subtitle">
            Consulte o cardápio, escolha seus produtos e faça seu
            pedido de forma rápida.
          </p>

          <form className="search-form">
            <label className="sr-only" htmlFor="menu-search">
              Buscar no cardápio
            </label>

            <input
              id="menu-search"
              name="search"
              type="search"
              placeholder="Ex.: pizza, hambúrguer, doce..."
              className="search-form__input"
            />

            <button
              className="button-action"
              type="submit"
            >
              Buscar
            </button>
          </form>
        </section>

        {menus.length > 0 && (
          <nav
            className="categories-nav"
            aria-label="Categorias do cardápio"
          >
            {menus.map((menu) => (
              <a
                key={menu.id}
                href={`#cat-${menu.id}`}
                className="categories-nav__link"
              >
                {menu.name}
              </a>
            ))}
          </nav>
        )}

        <section
          className="menu-section"
          id="cardapio"
          aria-labelledby="menu-title"
        >
          <h2 id="menu-title">Nosso Cardápio</h2>

          {menus.length === 0 ? (
            <div className="menu-grid">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="product-card"
                >
                  <div className="product-card__content">
                    <h3 className="product-card__title">
                      {product.name}
                    </h3>

                    <p className="product-card__description">
                      {product.description ||
                        "Sem descrição cadastrada."}
                    </p>
                  </div>

                  <div className="product-card__actions">
                    <span className="product-card__price">
                      R$ {Number(product.price).toFixed(2)}
                    </span>

                    <button
                      className="button-action"
                      type="button"
                      onClick={() => addToCart(product)}
                    >
                      Adicionar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            menus.map((menu) => {
              const categoryProducts = products.filter(
                (product) => product.menu_id === menu.id
              );

              if (categoryProducts.length === 0) {
                return null;
              }

              return (
                <section
                  key={menu.id}
                  id={`cat-${menu.id}`}
                  className="menu-category"
                  aria-labelledby={`cat-title-${menu.id}`}
                >
                  <h3
                    id={`cat-title-${menu.id}`}
                    className="menu-category__title"
                  >
                    {menu.name}
                  </h3>

                  <div className="menu-grid">
                    {categoryProducts.map((product) => (
                      <article
                        key={product.id}
                        className="product-card"
                      >
                        <div className="product-card__content">
                          <h4 className="product-card__title">
                            {product.name}
                          </h4>

                          <p className="product-card__description">
                            {product.description ||
                              "Sem descrição cadastrada."}
                          </p>
                        </div>

                        <div className="product-card__actions">
                          <span className="product-card__price">
                            R$ {Number(product.price).toFixed(2)}
                          </span>

                          <button
                            className="button-action"
                            type="button"
                            onClick={() => addToCart(product)}
                          >
                            Adicionar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </section>

                <aside
          className="cart-panel"
          id="pedido"
          aria-labelledby="cart-title"
        >
          <h2 id="cart-title">Seu pedido</h2>

          {orderMessage && (
            <p className="cart-panel__message" role="status" style={{ marginBottom: "1.5rem", color: "var(--color-accent)", fontWeight: "600" }}>
              {orderMessage}
            </p>
          )}

          {cart.length === 0 ? (
            <p>Seu carrinho está vazio.</p>
          ) : (
            <>
              <ul className="cart-panel__items">
                {cart.map((item) => (
                  <li
                    key={item.id}
                    className="cart-panel__item"
                  >
                    <div className="cart-panel__item-info">
                      <span className="cart-panel__item-name">
                        {item.name}
                      </span>

                      <span className="cart-panel__item-price">
                        {item.quantity}x R${" "}
                        {Number(item.price).toFixed(2)}
                      </span>
                    </div>

                    <button
                      className="button-action cart-panel__remove"
                      type="button"
                      onClick={() =>
                        removeFromCart(item.id)
                      }
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>

              <p className="cart-panel__total">
                <strong>
                  Total: R$ {cartTotal.toFixed(2)}
                </strong>
              </p>

              <button
                className="button-action cart-panel__submit"
                type="button"
                onClick={handleOrderSubmit}
              >
                Continuar pedido
              </button>
            </>
          )}
        </aside>


        <section
          className="feedback-section"
          id="feedback"
          aria-labelledby="feedback-title"
        >
          <h2 id="feedback-title">
            Como foi sua experiência?
          </h2>

          <p className="feedback-section__intro">
            Seu feedback ajuda o estabelecimento a melhorar.
          </p>

          <form
            onSubmit={handleFeedbackSubmit}
            className="feedback-form"
          >
            <fieldset className="feedback-form__fieldset">
              <legend className="feedback-form__legend">
                Sobre a comida
              </legend>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="food"
                  value="boa"
                  checked={foodRating === "boa"}
                  onChange={(e) =>
                    setFoodRating(e.target.value)
                  }
                />
                A comida estava boa
              </label>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="food"
                  value="faltou-sal"
                  checked={foodRating === "faltou-sal"}
                  onChange={(e) =>
                    setFoodRating(e.target.value)
                  }
                />
                Faltou sal
              </label>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="food"
                  value="muito-sal"
                  checked={foodRating === "muito-sal"}
                  onChange={(e) =>
                    setFoodRating(e.target.value)
                  }
                />
                Estava muito salgada
              </label>
            </fieldset>

            <fieldset className="feedback-form__fieldset">
              <legend className="feedback-form__legend">
                Sobre o atendimento
              </legend>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="service"
                  value="bom"
                  checked={serviceRating === "bom"}
                  onChange={(e) =>
                    setServiceRating(e.target.value)
                  }
                />
                Fui bem atendido
              </label>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="service"
                  value="melhorar"
                  checked={serviceRating === "melhorar"}
                  onChange={(e) =>
                    setServiceRating(e.target.value)
                  }
                />
                O atendimento pode melhorar
              </label>
            </fieldset>

            <fieldset className="feedback-form__fieldset">
              <legend className="feedback-form__legend">
                Sobre o pedido
              </legend>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="delivery"
                  value="rapido"
                  checked={deliveryRating === "rapido"}
                  onChange={(e) =>
                    setDeliveryRating(e.target.value)
                  }
                />
                O pedido chegou rápido
              </label>

              <label className="feedback-form__option">
                <input
                  type="radio"
                  name="delivery"
                  value="demorado"
                  checked={deliveryRating === "demorado"}
                  onChange={(e) =>
                    setDeliveryRating(e.target.value)
                  }
                />
                O pedido demorou
              </label>
            </fieldset>

            <div className="feedback-form__comment">
              <label
                htmlFor="feedback-comment"
                className="feedback-form__label"
              >
                Comentário
              </label>

              <textarea
                id="feedback-comment"
                rows={4}
                maxLength={500}
                value={comment}
                onChange={(e) =>
                  setComment(e.target.value)
                }
                placeholder="Conte algo que possa ajudar..."
              />
            </div>

            <button
              className="button-action feedback-form__submit"
              type="submit"
            >
              Enviar feedback
            </button>

            {feedbackMessage && (
              <p
                className="feedback-form__message"
                role="status"
              >
                {feedbackMessage}
              </p>
            )}
          </form>
        </section>
      </main>

      <footer className="main-footer">
        <p>{company.name} — Vem Comer</p>
      </footer>
    </>
  );
}