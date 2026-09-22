import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  createFeedback,
  createOrder,
  fetchCompanyBySlug,
  fetchMenus,
  fetchProducts,
  fetchOrder,
  getUser,
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

const icons = [
  "🍕",
  "🍔",
  "🍣",
  "🍝",
  "🍛",
  "🥗",
  "🍰",
  "🥤",
];

export default function App() {
  const slug = new URLSearchParams(location.search).get("empresa");
  const tableId = new URLSearchParams(location.search).get("mesa");

  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [admin, setAdmin] = useState(false);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [orderMsg, setOrderMsg] = useState("");

  const [payment, setPayment] = useState("pix");
  const [change, setChange] = useState("");

  const [food, setFood] = useState("boa");
  const [service, setService] = useState("bom");
  const [delivery, setDelivery] = useState("rapido");
  const [comment, setComment] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  useEffect(() => {
    if (!tableId || !companyId) return;

    fetchTable(companyId, tableId)
      .then((x: any) => setTableNumber(x.number))
      .catch(() => setTableNumber(null));
  }, [companyId, tableId]);

  useEffect(() => {
    (async () => {
      try {
        if (!slug) throw 0;

        const c = await fetchCompanyBySlug(slug);

        setCompany(c);
        setCompanyId(c.id);

        const [p, m] = await Promise.all([
          fetchProducts(c.id),
          fetchMenus(c.id),
        ]);

        setProducts(Array.isArray(p) ? p : []);
        setMenus(Array.isArray(m) ? m : []);
      } catch {
        setError("Estabelecimento não encontrado.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!orderId || !token) return;

    const poll = async () => {
      try {
        setActiveOrder(await fetchOrder(orderId, token));
      } catch {}
    };

    poll();

    const i = setInterval(poll, 5000);

    return () => clearInterval(i);
  }, [orderId, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q)
        )
      : products;
  }, [products, search]);

  const total = cart.reduce(
    (s, p) => s + Number(p.price) * p.quantity,
    0
  );

  const count = cart.reduce((s, p) => s + p.quantity, 0);

  const add = (p: Product) =>
    setCart((c) => {
      const x = c.find((i) => i.id === p.id);

      return x
        ? c.map((i) =>
            i.id === p.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...c, { ...p, quantity: 1 }];
    });

  const remove = (id: string) =>
    setCart((c) =>
      c
        .map((i) =>
          i.id === id
            ? { ...i, quantity: i.quantity - 1 }
            : i
        )
        .filter((i) => i.quantity > 0)
    );

  async function checkout() {
    if (!companyId || !cart.length) return;

    try {
      const r = await createOrder(
        companyId,
        "Cliente Balcão",
        cart,
        payment,
        Number(change) || 0,
        tableId
      );

      if (!r?.order_id || !r?.tracking_token) throw 0;

      setCart([]);
      setOrderId(r.order_id);
      setToken(r.tracking_token);
      setOrderMsg("Pedido realizado com sucesso!");
    } catch {
      setOrderMsg(
        "Erro ao fechar o pedido. Tente novamente."
      );
    }
  }

  async function feedback(e: React.FormEvent) {
    e.preventDefault();

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

  if (error || !company || !companyId) {
    return (
      <main className="error-state">
        {error || "Estabelecimento não encontrado."}
      </main>
    );
  }

  const groups = menus.length
    ? menus.map((m) => ({
        menu: m,
        items: filtered.filter(
          (p) => p.menu_id === m.id
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
      {/* HEADER */}
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
            📍 Natal - RN
          </span>

          <button
            className="hamb"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <nav
            className={
              menuOpen ? "nav open" : "nav"
            }
          >
            <a href="#inicio">Início</a>
            <a href="#cardapio">Restaurantes</a>
            <a href="#promocoes">Promoções</a>
            <a href="#como-funciona">
              Como funciona
            </a>
            <a href="#contato">Contato</a>
          </nav>

          <div className="header-actions">
            <a href="#pedido">Entrar</a>

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
            onBack={() => setAdmin(false)}
          />
        ) : activeOrder ? (
          /* PEDIDO EM ANDAMENTO */
          <section className="tracking">
            <span className="kicker">
              PEDIDO ENVIADO
            </span>

            <h2>Acompanhe seu pedido</h2>

            <p>ID: {activeOrder.id}</p>

            <div className="status">
              <small>Status atual</small>
              <strong>{activeOrder.status}</strong>
            </div>

            {activeOrder.items?.map((i, n) => (
              <div
                className="order-line"
                key={n}
              >
                <span>
                  {i.quantity}x {i.name}
                </span>

                <b>
                  R$ {Number(i.total).toFixed(2)}
                </b>
              </div>
            ))}

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
            {/* HERO */}
            <section
              className="hero"
              id="inicio"
            >
              <div>
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
                  Descubra restaurantes, encontre
                  seus pratos favoritos e peça de
                  forma simples, rápida e do seu
                  jeito.
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
                  onSubmit={(e) =>
                    e.preventDefault()
                  }
                >
                  <span>⌕</span>

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="O que você está com vontade de comer?"
                  />

                  <button>Buscar</button>
                </form>
              </div>

              <div className="hero-food">
                <div>
                  🍔
                  <small>🍟</small>

                  <em>
                    Qualidade em cada mordida!
                  </em>
                </div>
              </div>
            </section>

            {/* CATEGORIAS */}
            <section className="categories">
              {(menus.length
                ? menus
                : [
                    "Pizzas",
                    "Hambúrguer",
                    "Sushi",
                    "Massas",
                    "Self Service",
                    "Saudável",
                    "Doces",
                    "Bebidas",
                  ]
              ).map((m: any, i) => (
                <a
                  key={m.id || m}
                  href={
                    menus.length
                      ? `#cat-${m.id}`
                      : "#cardapio"
                  }
                >
                  <span>
                    {icons[i % icons.length]}
                  </span>

                  <b>{m.name || m}</b>
                </a>
              ))}
            </section>

            {/* PROMOÇÃO */}
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
                  Uma combinação deliciosa para
                  deixar seu pedido ainda melhor.
                </p>
              </div>

              <a href="#cardapio">
                Pedir agora →
              </a>
            </section>

            {/* COMO FUNCIONA */}
            <section
              id="como-funciona"
              className="promo"
            >
              <div>
                <span className="kicker">
                  COMO FUNCIONA
                </span>

                <h2>
                  Escolha. Peça. Aproveite.
                </h2>

                <p>
                  Encontre seu prato, monte seu
                  pedido e acompanhe tudo de forma
                  simples.
                </p>
              </div>

              <a href="#cardapio">
                Ver cardápio →
              </a>
            </section>

            {/* CARDÁPIO */}
            <section
              id="cardapio"
              className="menu"
            >
              <div className="section-head">
                <div>
                  <span className="kicker">
                    CARDÁPIO
                  </span>

                  <h2>{company.name}</h2>
                </div>

                <span className="open-tag">
                  ● Aberto para pedidos
                </span>
              </div>

              {groups.map((g) => (
                <div
                  className="group"
                  id={
                    g.menu
                      ? `cat-${g.menu.id}`
                      : undefined
                  }
                  key={
                    g.menu?.id || "all"
                  }
                >
                  {g.menu && (
                    <h3>{g.menu.name}</h3>
                  )}

                  <div className="grid">
                    {g.items.map((p) => (
                      <article
                        className="product"
                        key={p.id}
                      >
                        <div className="product-image">
                          🍽️
                        </div>

                        <div className="product-body">
                          <h3>{p.name}</h3>

                          <p>
                            {p.description ||
                              "Sem descrição cadastrada."}
                          </p>

                          <div>
                            <b>
                              R${" "}
                              {Number(
                                p.price
                              ).toFixed(2)}
                            </b>

                            <button
                              className="button-action"
                              onClick={() =>
                                add(p)
                              }
                            >
                              + Adicionar
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {!g.items.length && (
                    <div className="empty">
                      Nenhum produto encontrado.
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* CARRINHO */}
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
                  Adicione algo gostoso! 🍴
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cart.map((i) => (
                      <div
                        className="cart-item"
                        key={i.id}
                      >
                        <div>
                          <b>
                            {i.quantity}x{" "}
                            {i.name}
                          </b>

                          <span>
                            R${" "}
                            {(
                              Number(i.price) *
                              i.quantity
                            ).toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            remove(i.id)
                          }
                        >
                          − Remover
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="checkout">
                    <label>
                      Pagamento

                      <select
                        value={payment}
                        onChange={(e) =>
                          setPayment(
                            e.target.value
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

                    {payment === "dinheiro" && (
                      <label>
                        Troco para

                        <input
                          type="number"
                          value={change}
                          onChange={(e) =>
                            setChange(
                              e.target.value
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
                      R$ {total.toFixed(2)}
                    </b>
                  </div>

                  <button
                    className="button-action full"
                    onClick={checkout}
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

            {/* AVALIAÇÃO */}
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

              <form onSubmit={feedback}>
                <fieldset>
                  <legend>Comida</legend>

                  {[
                    "ótima",
                    "boa",
                    "regular",
                    "ruim",
                  ].map((x) => (
                    <label key={x}>
                      <input
                        type="radio"
                        checked={food === x}
                        onChange={() =>
                          setFood(x)
                        }
                      />

                      {x}
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
                  ].map((x) => (
                    <label key={x}>
                      <input
                        type="radio"
                        checked={service === x}
                        onChange={() =>
                          setService(x)
                        }
                      />

                      {x}
                    </label>
                  ))}
                </fieldset>

                <fieldset>
                  <legend>Entrega</legend>

                  {[
                    "rápida",
                    "normal",
                    "demorada",
                  ].map((x) => (
                    <label key={x}>
                      <input
                        type="radio"
                        checked={delivery === x}
                        onChange={() =>
                          setDelivery(x)
                        }
                      />

                      {x}
                    </label>
                  ))}
                </fieldset>

                <label className="comment">
                  Comentário

                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) =>
                      setComment(e.target.value)
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

      {/* FOOTER */}
      <footer id="contato">
        <div className="brand">
          <img
            src="/logo-vem-comer.png"
            alt="Vem Comer"
            className="brand-logo"
          />
        </div>

        <p>
          Mais que comida, são momentos que
          importam.
        </p>

        <small>
          © {new Date().getFullYear()} Vem Comer
          {" • "}
          Natal - RN
        </small>
      </footer>
    </>
  );
}