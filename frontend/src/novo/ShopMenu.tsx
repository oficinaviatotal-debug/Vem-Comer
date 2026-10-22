import { useState } from "react";
import NvIcon from "./Icons";
import { Photo, TopBar, VoiceOrb } from "./parts";
import { money } from "./format";
import type { Cart, Category, Dish, Promo, Shop } from "./types";

type Props = {
  shop: Shop;
  categories: Category[];
  promo: Promo | null;
  dishes: Dish[];
  cart: Cart;
};

/**
 * O cardápio que o cliente vê ao tocar no link do restaurante. É a casa do restaurante, não um catálogo: o nome e a
 * marca dele vêm primeiro; o Vem fica por trás.
 * Pedir é com o dedo ou com a bolinha de voz. O balãozinho do Vem Trabalhar é pequeno, fecha com um toque e fica
 * longe do botão de pedir.
 */
export default function ShopMenu({ shop, categories, promo, dishes, cart }: Props) {
  const [crossOpen, setCrossOpen] = useState(true);

  return (
    <div className="nv-root">
      <main className="nv-screen" style={crossOpen ? { paddingBottom: 188 } : undefined}>
        <TopBar mark={shop.mark} title={shop.name} sub={shop.city} />

        <div className="nv-facts" aria-label="Informações do restaurante">
          <span className="nv-fact is-open">
            <NvIcon name="clock" /> Aberto até {shop.openUntil}
          </span>
          <span className="nv-fact">
            <NvIcon name="bike" /> {shop.eta}
          </span>
          <span className="nv-fact">Taxa {money(shop.fee).replace(",00", "")}</span>
        </div>

        <label className="nv-search">
          <NvIcon name="search" />
          <span>Buscar no cardápio</span>
        </label>

        <nav className="nv-cats" aria-label="Categorias">
          {categories.map((cat) => (
            <button key={cat.id} type="button" className={`nv-cat${cat.on ? " is-on" : ""}`}>
              <span className="nv-cat-tile" aria-hidden="true">
                {cat.art}
              </span>
              {cat.label}
            </button>
          ))}
        </nav>

        {promo ? (
          <section aria-labelledby="nv-promo-h">
            <div className="nv-h2-row">
              <h2 className="nv-h2" id="nv-promo-h">
                Promoções da semana
              </h2>
              <button type="button" className="nv-link">
                Ver todas
              </button>
            </div>
            <article className="nv-promo" style={{ marginTop: 14 }}>
              <span className="nv-promo-art" aria-hidden="true">
                {promo.art}
              </span>
              <div>
                <h3>{promo.title}</h3>
                <p className="nv-promo-price">{money(promo.price)}</p>
                <p className="nv-promo-note">{promo.note}</p>
              </div>
              <button type="button" className="nv-btn">
                Pedir agora
              </button>
            </article>
          </section>
        ) : null}

        <section aria-labelledby="nv-top-h">
          <div className="nv-h2-row">
            <h2 className="nv-h2" id="nv-top-h">
              Mais pedidos
            </h2>
          </div>
          <div className="nv-grid" style={{ marginTop: 14 }}>
            {dishes.map((dish) => (
              <div key={dish.id} className="nv-dish">
                <div style={{ position: "relative" }}>
                  <Photo src={dish.photo} art={dish.art} alt={dish.name} />
                  <button type="button" className="nv-add" aria-label={`Colocar ${dish.name} na sacola`}>
                    <NvIcon name="plus" />
                  </button>
                </div>
                <span className="nv-dish-name">{dish.name}</span>
                <span className="nv-dish-price">{money(dish.price)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {crossOpen ? (
        <div className="nv-cross">
          <span className="nv-cross-bubble">
            <NvIcon name="briefcase" />
            Precisa de trabalho? Toque aqui
            <button type="button" className="nv-cross-close" aria-label="Fechar o aviso" onClick={() => setCrossOpen(false)}>
              <NvIcon name="close" />
            </button>
          </span>
        </div>
      ) : null}

      <div className="nv-dock">
        <button type="button" className="nv-bag">
          <span>
            Ver sacola
            <small>{cart.items === 1 ? "1 item" : `${cart.items} itens`}</small>
          </span>
          <strong>{money(cart.total)}</strong>
        </button>
        <VoiceOrb label="Falar o pedido" />
      </div>
    </div>
  );
}
