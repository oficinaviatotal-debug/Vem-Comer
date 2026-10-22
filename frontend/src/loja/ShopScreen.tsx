import { useMemo, useState } from "react";
import ShopMenu from "../novo/ShopMenu";
import { TopBar } from "../novo/parts";
import { addToCart, decrementItem } from "../customer/cart";
import type { Product } from "../customer/types";
import { mediaUrl } from "../service/api";
import { shopViewOf } from "./shopLogic";
import type { ShopState } from "./useShop";

type Props = {
  shop: ShopState;
  /** Quem entrou pelo QR da mesa traz o código da mesa; senão null. */
  tableId: string | null;
  /** Endereço do Vem Trabalhar para o balãozinho. Sem endereço configurado, o balão não aparece. */
  jobsHref?: string | null;
  /** Toque num prato com tamanho ou extras: abre as escolhas dele. */
  onChoose: (product: Product) => void;
  /** Toque em "Ver sacola". */
  onBag: () => void;
  /** Quantos pedidos este aparelho já enviou, e o toque em "Acompanhar o seu pedido". */
  ordersCount?: number;
  onTrack?: () => void;
};

/**
 * O cardápio de verdade: mostra o que o servidor disse (aberto, fechado, em pausa, prato esgotado) e mexe na sacola.
 * Quem busca os dados é `useShop`; aqui só se desenha e se toca.
 */
export default function ShopScreen({ shop, tableId, jobsHref = null, onChoose, onBag, ordersCount = 0, onTrack }: Props) {
  const [query, setQuery] = useState("");
  const { live, products, menus, cart, tableNumber, soldOutNote, setCart } = shop;

  const view = useMemo(
    () =>
      shopViewOf({
        company: live,
        fromTable: Boolean(tableId),
        tableNumber,
        products,
        menus,
        cart,
        query,
        media: mediaUrl,
        extraNotices: soldOutNote ? [soldOutNote] : [],
      }),
    [live, tableId, tableNumber, products, menus, cart, query, soldOutNote],
  );

  if (shop.load !== "ready") {
    return (
      <div className="nv-root">
        <main className="nv-screen">
          <TopBar title={live.name} showMenu={false} />
          {shop.load === "loading" ? (
            <p className="nv-empty" role="status">
              Abrindo o cardápio…
            </p>
          ) : (
            <>
              <p className="nv-error" role="alert">
                Não consegui abrir o cardápio. Confira a internet e tente de novo.
              </p>
              <button type="button" className="nv-btn is-green is-block" onClick={shop.reload}>
                Tentar de novo
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <ShopMenu
      {...view}
      query={query}
      onQuery={setQuery}
      onAdd={(id) => {
        const product = products.find((entry) => entry.id === id);
        if (product && !view.closed) setCart((current) => addToCart(current, product));
      }}
      onLess={(id) => setCart((current) => decrementItem(current, id))}
      onChoose={(id) => {
        const product = products.find((entry) => entry.id === id);
        if (product && !view.closed) onChoose(product);
      }}
      onBag={onBag}
      ordersCount={ordersCount}
      onTrack={onTrack}
      jobsHref={jobsHref}
    />
  );
}
