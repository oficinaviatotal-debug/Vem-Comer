import { useState } from "react";
import NvIcon from "./Icons";
import { Photo, TopBar, VoiceOrb } from "./parts";
import { money } from "./format";
import type { Cart, Category, Dish, DishGroup, Fact, Promo, Shop } from "./types";

type Props = {
  shop: Shop;
  /** Informações em pílula embaixo do nome ("Aberto até 23h"). Só entra o que o servidor sabe. */
  facts?: Fact[];
  /** Avisos acima do cardápio (restaurante fechado, em pausa, prato que saiu do pedido). */
  notices?: string[];
  /** Mostra o campo de busca (só vale a pena quando o cardápio é longo). */
  showSearch?: boolean;
  query?: string;
  onQuery?: (query: string) => void;
  categories: Category[];
  /** Promoções: o servidor ainda não tem esse dado, então com dados de verdade vem null e a seção some. */
  promo?: Promo | null;
  groups: DishGroup[];
  /** O que escrever quando não há prato para mostrar. */
  emptyText?: string;
  cart: Cart;
  onAdd?: (id: string) => void;
  onLess?: (id: string) => void;
  onChoose?: (id: string) => void;
  onBag?: () => void;
  /** Pedidos que este aparelho já enviou: com pelo menos um, aparece "Acompanhar o seu pedido". */
  ordersCount?: number;
  onTrack?: () => void;
  /** Quem está na mesa: "Mesa 4" e o toque que volta à tela da mesa (chamar o garçom, pedir a conta). */
  tableLabel?: string | null;
  onTable?: () => void;
  /** Toque na promoção (no cartão inteiro) e em "Ver todas". Sem promoção de verdade no servidor, a seção nem aparece. */
  onPromo?: () => void;
  onPromos?: () => void;
  onMenu?: () => void;
  /** Endereço do Vem Trabalhar para o balãozinho. Sem endereço configurado, o balão não aparece. */
  jobsHref?: string | null;
  /** Para onde vai quem é da equipe ou dono e abriu o cardápio do cliente por engano. Sem endereço, o link não aparece. */
  teamHref?: string | null;
  /** Só a conferência mostra o botão de menu sem ele levar a lugar nenhum. */
  showMenu?: boolean;
};

function scrollToGroup(key: string) {
  const target = document.getElementById(`nv-cat-${key}`);
  if (!target) return;
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

/**
 * O cardápio que o cliente vê ao tocar no link do restaurante. É a casa do restaurante, não um catálogo: o nome e a
 * marca dele vêm primeiro; o Vem fica por trás.
 * Pedir é com o dedo ou com a bolinha de voz. O balãozinho do Vem Trabalhar é pequeno, fecha com um toque e fica
 * longe do botão de pedir.
 * Facilidade de comprar (pedido do GD em 22/10/2026): o cartão do prato inteiro é o botão. Tocar em qualquer lugar
 * dele põe um na sacola (ou abre as escolhas, se o prato tem tamanho ou extras); o − e o + ficam por cima.
 */
export default function ShopMenu({
  shop,
  facts = [],
  notices = [],
  showSearch = false,
  query = "",
  onQuery,
  categories,
  promo = null,
  groups,
  emptyText,
  cart,
  onAdd,
  onLess,
  onChoose,
  onBag,
  ordersCount = 0,
  onTrack,
  tableLabel = null,
  onTable,
  onPromo,
  onPromos,
  onMenu,
  jobsHref = null,
  teamHref = null,
  showMenu = false,
}: Props) {
  const [crossOpen, setCrossOpen] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const cross = Boolean(jobsHref) && crossOpen;

  return (
    <div className="nv-root">
      <main className="nv-screen" style={cross ? { paddingBottom: 188 } : undefined}>
        <TopBar mark={shop.mark} logo={shop.logo} title={shop.name} sub={shop.sub} onMenu={onMenu} showMenu={showMenu} />

        {facts.length > 0 ? (
          <div className="nv-facts" role="group" aria-label="Informações do restaurante">
            {facts.map((fact) => (
              <span key={fact.text} className={`nv-fact ${fact.tone === "open" ? "is-open" : "is-closed"}`}>
                <NvIcon name="clock" /> {fact.text}
              </span>
            ))}
          </div>
        ) : null}

        {notices.map((text) => (
          <p key={text} className="nv-notice" role="status">
            {text}
          </p>
        ))}

        {tableLabel && onTable ? (
          <button type="button" className="nv-btn is-ghost is-small nv-table-btn" onClick={onTable}>
            <NvIcon name="bell" />
            {tableLabel}: chamar o garçom
          </button>
        ) : null}

        {ordersCount > 0 && onTrack ? (
          <button type="button" className="nv-btn is-ghost is-block" onClick={onTrack}>
            <NvIcon name="receipt" />
            Acompanhar o seu pedido{ordersCount > 1 ? ` (${ordersCount})` : ""}
          </button>
        ) : null}

        {showSearch ? (
          <label className="nv-search">
            <NvIcon name="search" />
            <input
              type="search"
              className="nv-search-input"
              placeholder="Buscar no cardápio"
              aria-label="Buscar no cardápio"
              value={query}
              onChange={(event) => onQuery?.(event.target.value)}
            />
          </label>
        ) : null}

        {categories.length > 0 ? (
          <nav className="nv-cats" aria-label="Categorias">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`nv-cat${cat.on || activeCat === cat.id ? " is-on" : ""}`}
                onClick={() => {
                  setActiveCat(cat.id);
                  scrollToGroup(cat.id);
                }}
              >
                <span className="nv-cat-tile" aria-hidden="true">
                  {cat.photo ? <img src={cat.photo} alt="" loading="lazy" /> : (cat.art ?? <NvIcon name="fork" />)}
                </span>
                {cat.label}
              </button>
            ))}
          </nav>
        ) : null}

        {promo ? (
          <section aria-labelledby="nv-promo-h">
            <div className="nv-h2-row">
              <h2 className="nv-h2" id="nv-promo-h">
                Promoções da semana
              </h2>
              <button type="button" className="nv-link" onClick={onPromos}>
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
              {/* nv-hit: o cartão inteiro da promoção é o botão de pedir. */}
              <button type="button" className="nv-btn nv-hit" aria-label={`Pedir agora: ${promo.title}`} onClick={onPromo}>
                Pedir agora
              </button>
            </article>
          </section>
        ) : null}

        {groups.length === 0 && emptyText ? <p className="nv-empty">{emptyText}</p> : null}

        {groups.map((group) => (
          <section key={group.key} id={`nv-cat-${group.key}`} className="nv-group" aria-labelledby={`nv-h-${group.key}`}>
            <div className="nv-h2-row">
              <h2 className="nv-h2" id={`nv-h-${group.key}`}>
                {group.title}
              </h2>
            </div>
            {group.sections.map((section) => (
              <div key={section.title || "_"} className="nv-section">
                {section.title ? <h3 className="nv-h3">{section.title}</h3> : null}
                <div className="nv-grid">
                  {section.dishes.map((dish) => (
                    <DishTile key={dish.id} dish={dish} onAdd={onAdd} onLess={onLess} onChoose={onChoose} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        {teamHref ? (
          <p className="nv-team">
            <a className="nv-team-link" href={teamHref}>
              Sou da equipe ou dono
            </a>
          </p>
        ) : null}
      </main>

      {cross ? (
        <nav className="nv-cross" aria-label="Outro caminho">
          <span className="nv-cross-bubble">
            <NvIcon name="briefcase" />
            <a className="nv-cross-link nv-hit" href={jobsHref ?? undefined}>
              Precisa de trabalho? Toque aqui
            </a>
            <button type="button" className="nv-cross-close" aria-label="Fechar o aviso" onClick={() => setCrossOpen(false)}>
              <NvIcon name="close" />
            </button>
          </span>
        </nav>
      ) : null}

      <div className="nv-dock">
        <button type="button" className="nv-bag" onClick={onBag} disabled={cart.items === 0}>
          <span>
            {cart.items === 0 ? "Sacola vazia" : "Ver sacola"}
            <small>{cart.items === 1 ? "1 item" : `${cart.items} itens`}</small>
          </span>
          <strong>{money(cart.total)}</strong>
        </button>
        <VoiceOrb label="Falar o pedido" />
      </div>
    </div>
  );
}

/**
 * Um prato: foto, nome, o que é, preço. O cartão inteiro é um botão só (o nome do prato é o texto dele e a área de toque
 * cobre tudo); o "+" da foto é desenho do que o toque faz. Prato que não se pede agora (esgotado, fechado) não é botão.
 */
function DishTile({
  dish,
  onAdd,
  onLess,
  onChoose,
}: {
  dish: Dish;
  onAdd?: (id: string) => void;
  onLess?: (id: string) => void;
  onChoose?: (id: string) => void;
}) {
  const stepper = dish.action === "add" && dish.quantity > 0;
  const showPlus = (dish.action === "add" && !stepper) || dish.action === "choose";
  return (
    <div className={`nv-dish${dish.action === "none" ? " is-off" : ""}`}>
      <div className="nv-dish-box">
        <Photo src={dish.photo} art={dish.art} alt={dish.name} />
        {showPlus ? (
          <span className="nv-add" aria-hidden="true">
            <NvIcon name="plus" />
          </span>
        ) : null}
        {dish.action === "none" && dish.stateText ? <span className="nv-dish-state">{dish.stateText}</span> : null}
      </div>
      {dish.action === "none" ? (
        <span className="nv-dish-name">{dish.name}</span>
      ) : (
        <button
          type="button"
          className="nv-dish-hit nv-hit"
          aria-label={dish.action === "choose" ? `Escolher opções de ${dish.name}` : `Colocar ${dish.name} na sacola`}
          onClick={() => (dish.action === "choose" ? onChoose?.(dish.id) : onAdd?.(dish.id))}
        >
          <span className="nv-dish-name">{dish.name}</span>
        </button>
      )}
      {dish.description ? <span className="nv-dish-desc">{dish.description}</span> : null}
      <span className="nv-dish-price">
        {dish.priceFrom ? <small>a partir de </small> : null}
        {money(dish.price)}
      </span>
      {stepper ? (
        <span className="nv-step">
          <button type="button" aria-label={`Tirar um ${dish.name}`} onClick={() => onLess?.(dish.id)}>
            −
          </button>
          <b aria-live="polite">{dish.quantity}</b>
          <button type="button" aria-label={`Colocar mais um ${dish.name}`} onClick={() => onAdd?.(dish.id)}>
            +
          </button>
        </span>
      ) : null}
      {dish.action === "choose" && dish.quantity > 0 ? <span className="nv-inorder">{dish.quantity} na sacola</span> : null}
    </div>
  );
}
