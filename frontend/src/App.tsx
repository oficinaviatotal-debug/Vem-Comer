import './styles.css';
import { useState, useEffect } from "react";

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
  const API_URL = "https://github.dev";

  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        // Busca os dados da empresa usando a URL mestre do Codespaces
        const companyRes = await fetch(`${API_URL}/companies/${COMPANY_ID}`);
        if (!companyRes.ok) throw new Error();
        const companyData = await companyRes.json();

        // Busca os produtos usando a URL mestre do Codespaces
        const productsRes = await fetch(`${API_URL}/companies/${COMPANY_ID}/products`);
        if (!productsRes.ok) throw new Error();
        const productsData = await productsRes.json();

        setCompany(companyData);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        setError("Erro ao carregar dados do estabelecimento.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <p>Carregando estabelecimento...</p>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="error-state">
        <p>{error || "Estabelecimento nao encontrado."}</p>
      </div>
    );
  }

  return (
    <>
      <header className="main-header">
        <div className="main-header__container">
          <a className="main-header__logo" href="/">
            {company.name}
          </a>
          <nav className="main-header__nav" aria-label="Navegacao principal">
            <a href="#cardapio">Cardapio</a>
            <a href="#avaliar">Avaliar Pedido</a>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section" aria-labelledby="hero-title">
          <h1 id="hero-title">Encontre o que voce quer comer</h1>
          <p className="hero-section__subtitle">
            Consulte o cardapio real, faca sua escolha de forma direta e sem intermediarios.
          </p>
          <form className="search-form">
            <label className="sr-only" htmlFor="menu-search">Buscar no cardapio</label>
            <input
              id="menu-search"
              name="search"
              type="search"
              placeholder="Ex.: pizza, hamburguer, doce..."
              className="search-form__input"
            />
            <button className="button-action" type="submit">
              Buscar
            </button>
          </form>
        </section>

        <section className="menu-section" id="cardapio" aria-labelledby="menu-title">
          <h2 id="menu-title">Nosso Cardapio</h2>
          <div className="menu-grid">
            {products.length === 0 ? (
              <p className="menu-grid__empty">Nenhum produto disponivel neste momento.</p>
            ) : (
              products.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-card__content">
                    <h3 className="product-card__title">{product.name}</h3>
                    <p className="product-card__description">
                      {product.description || "Sem descricao cadastrada."}
                    </p>
                  </div>
                  <div className="product-card__actions">
                    <span className="product-card__price">
                      R$ {Number(product.price).toFixed(2)}
                    </span>
                    <button className="button-action" type="button">
                      Adicionar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="main-footer">
        <p>{company.name} — Vem Comer</p>
      </footer>
    </>
  );
}
