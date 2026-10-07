import type { ReactNode } from "react";
import { mediaUrl } from "../service/api";
import { formatMoney } from "../service/format";
import { quantityOf, type CartLine } from "./cart";
import type { MenuGroup } from "./menuGroups";
import type { Product } from "./types";
import QuantityStepper from "./QuantityStepper";

type Props = {
  groups: MenuGroup<Product>[];
  cart: CartLine[];
  query: string;
  /** Slot for the search field and microphone, shown above the dishes. */
  search: ReactNode;
  onAdd: (product: Product) => void;
  onLess: (id: string) => void;
};

function scrollToGroup(key: string) {
  const target = document.getElementById(`cat-${key}`);
  if (!target) return;
  const calm =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

/** Category chips. Rendered inside the sticky header by the parent. */
export function CategoryChips({ groups }: { groups: MenuGroup<Product>[] }) {
  if (groups.length < 2) return null;
  return (
    <nav id="cust-categories" className="cust-chips" aria-label="Categorias do cardápio">
      {groups.map((group) => (
        <button key={group.key} type="button" onClick={() => scrollToGroup(group.key)}>
          {group.title}
        </button>
      ))}
    </nav>
  );
}

export default function MenuView({ groups, cart, query, search, onAdd, onLess }: Props) {
  const firstId = groups[0]?.items[0]?.id;

  return (
    <>
      {search}

      {groups.length === 0 && (
        <p className="cust-empty">
          {query.trim()
            ? `Nada encontrado para “${query.trim()}”. Tente outra palavra.`
            : "O cardápio ainda está sendo montado. Chame o atendente para pedir."}
        </p>
      )}

      {groups.map((group) => (
        <section className="cust-group" id={`cat-${group.key}`} key={group.key}>
          <h2>{group.title}</h2>
          <ul className="cust-items">
            {group.items.map((product) => {
              const quantity = quantityOf(cart, product.id);
              const photo = mediaUrl(product.thumb_url);
              return (
                <li className={photo ? "cust-item has-photo" : "cust-item"} key={product.id}>
                  <div className="cust-item-main">
                    <div className="cust-item-text">
                      <h3 className="cust-item-name">{product.name}</h3>
                      {product.description && <p className="cust-item-desc">{product.description}</p>}
                    </div>

                    {photo && (
                      <img
                        className="cust-item-photo"
                        src={photo}
                        alt=""
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>

                  <div className="cust-item-foot">
                    <span className="money">{formatMoney(product.price)}</span>
                    <div className="cust-qty" id={product.id === firstId ? "cust-first-add" : undefined}>
                      {quantity === 0 ? (
                        <button
                          type="button"
                          className="btn btn-add btn-sm"
                          onClick={() => onAdd(product)}
                          aria-label={`Adicionar ${product.name}`}
                        >
                          Adicionar
                        </button>
                      ) : (
                        <QuantityStepper
                          label={product.name}
                          quantity={quantity}
                          onMore={() => onAdd(product)}
                          onLess={() => onLess(product.id)}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
