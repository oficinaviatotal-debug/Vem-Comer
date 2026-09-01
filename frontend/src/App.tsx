import { useEffect, useState } from "react";
import "./styles.css";

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
  
  const PROTOCOLO = "https://";
  const DOMINIO = "organic-space-winner-vxprqwv646vhrvp-5000.app.github.dev";
  const API_URL = PROTOCOLO + DOMINIO + "/api";

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

  useEffect(() => {
    async function loadData() {
      try {
        const [companyRes, productsRes, menusRes] = await Promise.all([
          fetch(`${API_URL}/companies/${COMPANY_ID}`),
          fetch(`${API_URL}/companies/${COMPANY_ID}/products`),
          fetch(`${API_URL}/companies/${COMPANY_ID}/menus`)
        ]);

        if (!companyRes.ok || !productsRes.ok || !menusRes.ok) throw new Error();

        const companyData = await companyRes.json();
        const productsData = await productsRes.json();
        const menusData = await menusRes.json();

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
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...currentCart, { ...product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/companies/${COMPANY_ID}/feedbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          food: foodRating,
          service: serviceRating,
          delivery: deliveryRating,
          comment: comment,
        }),
      });

      if (!response.ok) throw new Error();

      setFeedbackMessage("Avaliação enviada com sucesso! Obrigado.");
      setComment("");
    } catch {
      setFeedbackMessage("Erro ao enviar avaliação. Tente novamente.");
    }
  }

  const cartTotal = cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
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
          <nav className="main-header__nav" aria-label="Navegação principal">
            <a href="#cardapio">Cardápio</a>
            <a href="#pedido">Meu pedido ({cart.reduce((sum, item) => sum + item.quantity, 0)})</a>
            <a href="#feedback">Avaliar</a>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section" aria-labelledby="hero-title">
          <h1 id="hero-title">Encontre o que você quer comer</h1>
          <p className="hero-section__subtitle">
            Consulte o cardápio, escolha seus produtos e faça seu pedido de forma rápida.
          </p>
          <form className="search-form">
            <label className="sr-only" htmlFor="menu-search">Buscar no cardápio</label>
            <input
              id="menu-search"
              name="search"
              type="search"
              placeholder="Ex.: pizza, hambúrguer, doce..."
              className="search-form__input"
            />
            <button className="button-action" type="submit">Buscar</button>
          </form>
        </section>

        {menus.length > 0 && (
          <nav className="categories-nav" aria-label="Categorias do cardápio" style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', overflowX: 'auto' }}>
            {menus.map((menu) => (
              <a key={menu.id} href={`#cat-${menu.id}`} style={{ textDecoration: 'none', color: 'var(--text-main)', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                {menu.name}
              </a>
            ))}
          </nav>
        )}

        <section className="menu-section" id="cardapio" aria-labelledby="menu-title" style={{ marginBottom: '4rem' }}>
          <h2 id="menu-title">Nosso Cardápio</h2>
          <div className="menu-grid">
            {products.length === 0 ? (
              <p className="menu-grid__empty">Nenhum produto disponível neste momento.</p>
            ) : (
              products.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-card__content">
                    <h3 className="product-card__title">{product.name}</h3>
                    <p className="product-card__description">
                      {product.description || "Sem descrição cadastrada."}
                    </p>
                  </div>
                  <div className="product-card__actions">
                    <span className="product-card__price">R$ {Number(product.price).toFixed(2)}</span>
                    <button className="button-action" type="button" onClick={() => addToCart(product)}>
                      Adicionar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="cart-panel" id="pedido" aria-labelledby="cart-title" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '3rem', paddingBottom: '3rem' }}>
          <h2 id="cart-title">Seu pedido</h2>
          {cart.length === 0 ? (
            <p>Seu carrinho está vazio.</p>
          ) : (
            <>
              <ul className="cart-panel__items" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
                {cart.map((item) => (
                  <li key={item.id} className="cart-panel__item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '4px' }}>
                    <div>
                      <span style={{ fontWeight: 600, display: 'block' }}>{item.name}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{item.quantity}x R$ {Number(item.price).toFixed(2)}</span>
                    </div>
                    <button className="button-action" type="button" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => removeFromCart(item.id)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
              <p className="cart-panel__total" style={{ fontSize: '1.25rem', margin: '1.5rem 0' }}>
                <strong>Total: R$ {cartTotal.toFixed(2)}</strong>
              </p>
              <button className="button-action" type="button" style={{ width: '100%' }}>Continuar pedido</button>
            </>
          )}
        </aside>

        <section className="feedback-section" id="feedback" aria-labelledby="feedback-title" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '3rem', paddingBottom: '4rem' }}>
          <h2 id="feedback-title">Como foi sua experiência?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Seu feedback ajuda o estabelecimento a melhorar.</p>

          <form onSubmit={handleFeedbackSubmit} className="feedback-form" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
            <fieldset style={{ border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <legend style={{ padding: '0 0.5rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sobre a comida</legend>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="food" value="boa" checked={foodRating === "boa"} onChange={(e) => setFoodRating(e.target.value)} /> A comida estava boa
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="food" value="faltou-sal" checked={foodRating === "faltou-sal"} onChange={(e) => setFoodRating(e.target.value)} /> Faltou sal
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="food" value="muito-sal" checked={foodRating === "muito-sal"} onChange={(e) => setFoodRating(e.target.value)} /> Estava muito salgada
              </label>
            </fieldset>

            <fieldset style={{ border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <legend style={{ padding: '0 0.5rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sobre o atendimento</legend>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="service" value="bom" checked={serviceRating === "bom"} onChange={(e) => setServiceRating(e.target.value)} /> Fui bem atendido
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="service" value="melhorar" checked={serviceRating === "melhorar"} onChange={(e) => setServiceRating(e.target.value)} /> O atendimento pode melhorar
              </label>
            </fieldset>

            <fieldset style={{ border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <legend style={{ padding: '0 0.5rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sobre o pedido</legend>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="delivery" value="rapido" checked={deliveryRating === "rapido"} onChange={(e) => setDeliveryRating(e.target.value)} /> O pedido chegou rápido
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="delivery" value="demorado" checked={deliveryRating === "demorado"} onChange={(e) => setDeliveryRating(e.target.value)} /> O pedido demorou
              </label>
            </fieldset>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor="feedback-comment" style={{ fontWeight: 600 }}>Comentário</label>
              <textarea
                id="feedback-comment"
                rows={4}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte algo que possa ajudar..."
                style={{ width: '100%', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', fontFamily: 'inherit', fontSize: '1rem' }}
              />
            </div>

            <button className="button-action" type="submit" style={{ width: '100%' }}>Enviar feedback</button>
            {feedbackMessage && <p style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-accent)' }} role="status">{feedbackMessage}</p>}
          </form>
        </section>
      </main>

      <footer className="main-footer">
        <p>{company.name} — Vem Comer</p>
      </footer>
    </>
  );
}
