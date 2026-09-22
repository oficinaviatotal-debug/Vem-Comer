import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  createFeedback,
  createOrder,
  fetchCompanyBySlug,
  fetchMenus,
  fetchProducts,
  fetchOrder,
  fetchTable,
} from "./service/api";
import AdminPanel from "./service/AdminPanel";

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

type Order = {
  id: string;
  company_id: string;
  customer_name: string;
  total_price: number;
  status: string;
  items: {
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
};

const categories = [
  { name: "Pizzas", image: "/images/pizza.png" },
  {
    name: "Hambúrguer",
    image: "/images/hero-burguer.png",
  },
  { name: "Sushi", image: null },
  { name: "Massas", image: null },
  {
    name: "Self Service",
    image: "/images/self-service.png",
  },
  { name: "Saudável", image: null },
  { name: "Doces", image: null },
  { name: "Bebidas", image: "/images/bebidas.png" },
];

function getCategoryImage(name?: string | null) {
  const value = (name || "").toLowerCase();

  if (value.includes("pizza")) {
    return "/images/pizza.png";
  }

  if (
    value.includes("hamb") ||
    value.includes("burger")
  ) {
    return "/images/hero-burguer.png";
  }

  if (
    value.includes("self") ||
    value.includes("executivo")
  ) {
    return "/images/self-service.png";
  }

  if (
    value.includes("bebida") ||
    value.includes("drink")
  ) {
    return "/images/bebidas.png";
  }

  return null;
}

export default function App() {
  const params = new URLSearchParams(location.search);

  const slug = params.get("empresa");
  const tableId = params.get("mesa");

  const [company, setCompany] =
    useState<Company | null>(null);

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [menus, setMenus] =
    useState<Menu[]>([]);

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [tableNumber, setTableNumber] =
    useState<number | null>(null);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [admin, setAdmin] =
    useState(false);

  const [activeOrder, setActiveOrder] =
    useState<Order | null>(null);

  const [orderId, setOrderId] =
    useState<string | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [orderMsg, setOrderMsg] =
    useState("");

  const [payment, setPayment] =
    useState("pix");

  const [change, setChange] =
    useState("");

  const [food, setFood] =
    useState("boa");

  const [service, setService] =
    useState("bom");

  const [delivery, setDelivery] =
    useState("rapido");

  const [comment, setComment] =
    useState("");

  const [feedbackMsg, setFeedbackMsg] =
    useState("");

  useEffect(() => {
    if (!tableId || !companyId) return;

    fetchTable(companyId, tableId)
      .then((x: any) =>
        setTableNumber(x.number)
      )
      .catch(() =>
        setTableNumber(null)
      );
  }, [companyId, tableId]);

  useEffect(() => {
    (async () => {
      try {
        if (!slug) {
          throw new Error();
        }

        const c =
          await fetchCompanyBySlug(slug);

        setCompany(c);
        setCompanyId(c.id);

        const [p, m] =
          await Promise.all([
            fetchProducts(c.id),
            fetchMenus(c.id),
          ]);

        setProducts(
          Array.isArray(p) ? p : []
        );

        setMenus(
          Array.isArray(m) ? m : []
        );
      } catch {
        setError(
          "Estabelecimento não encontrado."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!orderId || !token) return;

    const poll = async () => {
      try {
        const order =
          await fetchOrder(
            orderId,
            token
          );

        setActiveOrder(order);
      } catch {}
    };

    poll();

    const interval =
      setInterval(poll, 5000);

    return () =>
      clearInterval(interval);
  }, [orderId, token]);

  const filtered = useMemo(() => {
    const q =
      search.trim().toLowerCase();

    if (!q) return products;

    return products.filter(
      (p) =>
        p.name
          .toLowerCase()
          .includes(q) ||
        (p.description || "")
          .toLowerCase()
          .includes(q)
    );
  }, [products, search]);

  const total = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price) *
        item.quantity,
    0
  );

  const count = cart.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  const add = (product: Product) => {
    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.id === product.id
        );

      if (existing) {
        return current.map(
          (item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  };

  const remove = (id: string) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  };

  async function checkout() {
    if (!companyId || !cart.length) {
      return;
    }

    try {
      const result =
        await createOrder(
          companyId,
          "Cliente Balcão",
          cart,
          payment,
          Number(change) || 0,
          tableId
        );

      if (
        !result?.order_id ||
        !result?.tracking_token
      ) {
        throw new Error();
      }

      setCart([]);
      setOrderId(result.order_id);
      setToken(result.tracking_token);

      setOrderMsg(
        "Pedido realizado com sucesso!"
      );
    } catch {
      setOrderMsg(
        "Erro ao fechar o pedido. Tente novamente."
      );
    }
  }

  async function feedback(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!companyId) return;

    try {
      await createFeedback(
        companyId,
        food,
        service,
        delivery,
        comment
      );

      setFeedbackMsg(
        "Avaliação enviada com sucesso! Obrigado."
      );

      setComment("");
    } catch {
      setFeedbackMsg(
        "Erro ao enviar avaliação. Tente novamente."
      );
    }
  }

  if (loading) {
    return (
      <main className="loading-state">
        Carregando estabelecimento...
      </main>
    );
  }

  if (
    error ||
    !company ||
    !companyId
  ) {
    return (
      <main className="error-state">
        {error ||
          "Estabelecimento não encontrado."}
      </main>
    );
  }

  const groups = menus.length
    ? menus.map((menu) => ({
        menu,
        items: filtered.filter(
          (product) =>
            product.menu_id ===
            menu.id
        ),
      }))
    : [
        {
          menu: null,
          items: filtered,
        },
      ];

  return (
    <>
      <header className="main-header">
        <div className="header-inner">
          <a
            className="brand"
            href="/"
            aria-label="Vem Comer"
          >
            <img
              src="/logo-vem-comer.png"
              alt="Vem Comer"
              className="brand-logo"
            />
          </a>

          <span className="location">
            Natal - RN
          </span>

          <button
            className="hamb"
            onClick={() =>
              setMenuOpen(
                !menuOpen
              )
            }
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <nav
            className={
              menuOpen
                ? "nav open"
                : "nav"
            }
          >
            <a href="#inicio">
              Início
            </a>

            <a href="#cardapio">
              Restaurantes
            </a>

            <a href="#promocoes">
              Promoções
            </a>

            <a href="#como-funciona">
              Como funciona
            </a>

            <a href="#contato">
              Contato
            </a>
          </nav>

          <div className="header-actions">
            <a href="#pedido">
              Entrar
            </a>

            <a
              className="header-cta"
              href="#cardapio"
            >
              Cadastrar
            </a>
          </div>
        </div>
      </header>

      <main className="main-content">
        {admin ? (
          <AdminPanel
            companyId={companyId}
            companySlug={company.slug}
            onBack={() =>
              setAdmin(false)
            }
          />
        ) : activeOrder ? (
          <section className="tracking">
            <span className="kicker">
              PEDIDO ENVIADO
            </span>

            <h2>
              Acompanhe seu pedido
            </h2>

            <p>
              ID: {activeOrder.id}
            </p>

            <div className="status">
              <small>
                Status atual
              </small>

              <strong>
                {activeOrder.status}
              </strong>
            </div>

            {activeOrder.items?.map(
              (item, index) => (
                <div
                  className="order-line"
                  key={index}
                >
                  <span>
                    {item.quantity}x{" "}
                    {item.name}
                  </span>

                  <b>
                    R${" "}
                    {Number(
                      item.total
                    ).toFixed(2)}
                  </b>
                </div>
              )
            )}

            <div className="order-total">
              <b>Total</b>

              <b>
                R${" "}
                {Number(
                  activeOrder.total_price
                ).toFixed(2)}
              </b>
            </div>

            <button
              className="button-action"
              onClick={() => {
                setActiveOrder(null);
                setOrderId(null);
                setToken(null);
              }}
            >
              Fazer novo pedido
            </button>
          </section>
        ) : (
          <>
            <section
              className="hero"
              id="inicio"
            >
              <div className="hero-content">
                <span className="kicker">
                  VEM COMER • NATAL - RN
                </span>

                <h1>
                  Comida boa,
                  <br />
                  <span>
                    mais perto de você!
                  </span>
                </h1>

                <p>
                  Descubra os melhores
                  restaurantes da sua região.
                </p>

                {tableId && (
                  <span className="table-badge">
                    {tableNumber
                      ? `Pedido para a Mesa ${tableNumber}`
                      : "Carregando mesa..."}
                  </span>
                )}

                <form
                  className="search"
                  onSubmit={(event) =>
                    event.preventDefault()
                  }
                >
                  <span
                    aria-hidden="true"
                    className="search-icon"
                  >
                    ⌕
                  </span>

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Buscar restaurantes, pratos..."
                  />

                  <button>
                    Buscar
                  </button>
                </form>
              </div>

              <div className="hero-food">
                <img
                  src="/images/hero-burguer.png"
                  alt="Hambúrguer artesanal"
                />

                <em>
                  Qualidade em cada mordida!
                </em>
              </div>
            </section>

            <section className="categories">
              {categories.map(
                (category) => (
                  <a
                    key={category.name}
                    href="#cardapio"
                  >
                    {category.image ? (
                      <img
                        src={category.image}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="category-placeholder">
                        {category.name.charAt(
                          0
                        )}
                      </span>
                    )}

                    <b>
                      {category.name}
                    </b>
                  </a>
                )
              )}
            </section>

            <section
              className="promo"
              id="promocoes"
            >
              <div>
                <span className="kicker">
                  OFERTA ESPECIAL
                </span>

                <h2>
                  Combo Especial R$ 29,90
                </h2>

                <p>
                  Uma combinação deliciosa
                  para deixar seu pedido
                  ainda melhor.
                </p>
              </div>

              <a href="#cardapio">
                Pedir agora →
              </a>
            </section>

            <section
              id="como-funciona"
              className="how-it-works"
            >
              <div className="section-head">
                <div>
                  <span className="kicker">
                    COMO FUNCIONA
                  </span>

                  <h2>
                    Escolha. Peça. Aproveite.
                  </h2>
                </div>
              </div>

              <div className="steps">
                <article>
                  <span>01</span>

                  <h3>
                    Escolha seu restaurante
                  </h3>

                  <p>
                    Encontre opções próximas
                    e escolha o que deseja
                    comer.
                  </p>
                </article>

                <article>
                  <span>02</span>

                  <h3>
                    Monte seu pedido
                  </h3>

                  <p>
                    Escolha seus pratos
                    favoritos e adicione ao
                    carrinho.
                  </p>
                </article>

                <article>
                  <span>03</span>

                  <h3>
                    Peça e aproveite
                  </h3>

                  <p>
                    Finalize seu pedido e
                    acompanhe tudo.
                  </p>
                </article>
              </div>
            </section>

            <section
              id="cardapio"
              className="menu"
            >
              <div className="section-head">
                <div>
                  <span className="kicker">
                    CARDÁPIO
                  </span>

                  <h2>
                    {company.name}
                  </h2>
                </div>

                <span className="open-tag">
                  ● Aberto para pedidos
                </span>
              </div>

              {menus.length > 0 && (
                <div className="menu-tabs">
                  {menus.map(
                    (menu) => (
                      <a
                        key={menu.id}
                        href={`#cat-${menu.id}`}
                      >
                        {menu.name}
                      </a>
                    )
                  )}
                </div>
              )}

              {groups.map((group) => (
                <div
                  className="group"
                  id={
                    group.menu
                      ? `cat-${group.menu.id}`
                      : undefined
                  }
                  key={
                    group.menu?.id ||
                    "all"
                  }
                >
                  {group.menu && (
                    <h3>
                      {group.menu.name}
                    </h3>
                  )}

                  <div className="grid">
                    {group.items.map(
                      (product) => {
                        const image =
                          getCategoryImage(
                            group.menu
                              ?.name
                          );

                        return (
                          <article
                            className="product"
                            key={
                              product.id
                            }
                          >
                            <div className="product-image">
                              {image ? (
                                <img
                                  src={image}
                                  alt=""
                                  aria-hidden="true"
                                />
                              ) : (
                                <span className="product-placeholder">
                                  {product.name.charAt(
                                    0
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="product-body">
                              <h3>
                                {product.name}
                              </h3>

                              <p>
                                {product.description ||
                                  "Produto disponível no cardápio."}
                              </p>

                              <div className="product-footer">
                                <strong>
                                  R${" "}
                                  {Number(
                                    product.price
                                  ).toFixed(
                                    2
                                  )}
                                </strong>

                                <button
                                  className="add-product"
                                  onClick={() =>
                                    add(
                                      product
                                    )
                                  }
                                  aria-label={`Adicionar ${product.name}`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>

                  {!group.items.length && (
                    <div className="empty">
                      Nenhum produto encontrado.
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section
              id="pedido"
              className="cart"
            >
              <div className="section-head">
                <div>
                  <span className="kicker">
                    SEU PEDIDO
                  </span>

                  <h2>
                    Confira antes de enviar
                  </h2>
                </div>

                <b>
                  {count} item(ns)
                </b>
              </div>

              {!cart.length ? (
                <div className="empty">
                  Seu carrinho está vazio.
                  Adicione um produto ao
                  pedido.
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cart.map(
                      (item) => (
                        <div
                          className="cart-item"
                          key={item.id}
                        >
                          <div>
                            <b>
                              {item.quantity}x{" "}
                              {item.name}
                            </b>

                            <span>
                              R${" "}
                              {(
                                Number(
                                  item.price
                                ) *
                                item.quantity
                              ).toFixed(
                                2
                              )}
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              remove(
                                item.id
                              )
                            }
                          >
                            Remover
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  <div className="checkout">
                    <label>
                      Pagamento

                      <select
                        value={payment}
                        onChange={(event) =>
                          setPayment(
                            event.target
                              .value
                          )
                        }
                      >
                        <option value="pix">
                          PIX
                        </option>

                        <option value="dinheiro">
                          Dinheiro
                        </option>

                        <option value="cartao">
                          Cartão
                        </option>
                      </select>
                    </label>

                    {payment ===
                      "dinheiro" && (
                      <label>
                        Troco para

                        <input
                          type="number"
                          value={change}
                          onChange={(
                            event
                          ) =>
                            setChange(
                              event.target
                                .value
                            )
                          }
                          placeholder="Ex.: 50"
                        />
                      </label>
                    )}
                  </div>

                  <div className="total">
                    <span>Total</span>

                    <b>
                      R${" "}
                      {total.toFixed(
                        2
                      )}
                    </b>
                  </div>

                  <button
                    className="button-action full"
                    onClick={
                      checkout
                    }
                  >
                    Finalizar pedido
                  </button>

                  {orderMsg && (
                    <p className="message">
                      {orderMsg}
                    </p>
                  )}
                </>
              )}
            </section>

            <section
              id="feedback"
              className="feedback"
            >
              <span className="kicker">
                SUA OPINIÃO
              </span>

              <h2>
                Como foi sua experiência?
              </h2>

              <p>
                Seu feedback ajuda o
                estabelecimento a melhorar.
              </p>

              <form
                onSubmit={feedback}
              >
                <fieldset>
                  <legend>
                    Comida
                  </legend>

                  {[
                    "ótima",
                    "boa",
                    "regular",
                    "ruim",
                  ].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        checked={
                          food ===
                          value
                        }
                        onChange={() =>
                          setFood(
                            value
                          )
                        }
                      />

                      {value}
                    </label>
                  ))}
                </fieldset>

                <fieldset>
                  <legend>
                    Atendimento
                  </legend>

                  {[
                    "ótimo",
                    "bom",
                    "regular",
                    "ruim",
                  ].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        checked={
                          service ===
                          value
                        }
                        onChange={() =>
                          setService(
                            value
                          )
                        }
                      />

                      {value}
                    </label>
                  ))}
                </fieldset>

                <fieldset>
                  <legend>
                    Entrega
                  </legend>

                  {[
                    "rápida",
                    "normal",
                    "demorada",
                  ].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        checked={
                          delivery ===
                          value
                        }
                        onChange={() =>
                          setDelivery(
                            value
                          )
                        }
                      />

                      {value}
                    </label>
                  ))}
                </fieldset>

                <label className="comment">
                  Comentário

                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(event) =>
                      setComment(
                        event.target
                          .value
                      )
                    }
                    placeholder="Conte como foi..."
                  />
                </label>

                <button className="button-action">
                  Enviar avaliação
                </button>

                {feedbackMsg && (
                  <p className="message">
                    {feedbackMsg}
                  </p>
                )}
              </form>
            </section>
          </>
        )}
      </main>

      {count > 0 && !admin && (
        <a
          href="#pedido"
          className="mobile-cart"
        >
          <span className="mobile-cart-count">
            {count}
          </span>

          <span>
            Ver carrinho
          </span>

          <strong>
            R$ {total.toFixed(2)}
          </strong>
        </a>
      )}

      <footer id="contato">
        <div className="brand">
          <img
            src="/logo-vem-comer.png"
            alt="Vem Comer"
            className="brand-logo"
          />
        </div>

        <p>
          Mais que comida, são momentos
          que importam.
        </p>

        <span className="footer-copy">
          ©{" "}
          {new Date().getFullYear()}{" "}
          Vem Comer • Natal - RN
        </span>
      </footer>
    </>
  );
}