import { useState } from "react";
import { addConfigured, lineKey, replaceLine, type CartLine } from "../customer/cart";
import { orderMemory, type RememberedOrder } from "../customer/orderMemory";
import type { Company, Product } from "../customer/types";
import BagScreen, { type SentOrder } from "./BagScreen";
import ChoicesScreen, { initialOf } from "./ChoicesScreen";
import ShopScreen from "./ShopScreen";
import TrackingScreen from "./TrackingScreen";
import type { ChoicesPick } from "./choicesLogic";
import { useShop } from "./useShop";

type Props = {
  company: Company;
  /** Quem entrou pelo QR da mesa traz o código da mesa; senão null. */
  tableId: string | null;
  jobsHref?: string | null;
  /** O servidor aceitou o pedido (a tela já levou a pessoa ao acompanhamento). */
  onSent?: (order: SentOrder) => void;
};

type Screen = "menu" | "bag" | "tracking";

/** O prato aberto nas escolhas; com `editKey`, é uma linha da sacola sendo mudada. */
type Picking = { product: Product; editKey?: string; line?: CartLine };

/**
 * O caminho do cliente no visual novo: cardápio, escolhas do prato, sacola, envio e acompanhamento (com o Pix). Ainda
 * não está ligado ao aplicativo público: o fluxo antigo continua valendo até o GD dizer "pode". Quem já pediu neste
 * aparelho (e ainda tem o pedido guardado) abre direto no acompanhamento, como sempre foi.
 */
export default function OrderFlow({ company, tableId, jobsHref = null, onSent }: Props) {
  const shop = useShop(company, tableId);
  const [orders, setOrders] = useState<RememberedOrder[]>(() => orderMemory.list(company.slug, tableId));
  const [screen, setScreen] = useState<Screen>(() => (orders.length > 0 ? "tracking" : "menu"));
  const [picking, setPicking] = useState<Picking | null>(null);

  const goTo = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0 });
  };

  const confirm = (pick: ChoicesPick) => {
    if (!picking) return;
    const { product, editKey } = picking;
    shop.setCart((current) => (editKey ? replaceLine(current, editKey, product, pick) : addConfigured(current, product, pick)));
    setPicking(null);
  };

  // O pedido que o servidor não conhece mais, ou que a pessoa fechou: o aparelho o esquece; sem pedidos, volta ao cardápio.
  const forget = (orderId: string) => {
    const next = orderMemory.remove(company.slug, orderId);
    setOrders(next);
    if (next.length === 0) goTo("menu");
  };

  return (
    <>
      {screen === "menu" ? (
        <ShopScreen
          shop={shop}
          tableId={tableId}
          jobsHref={jobsHref}
          onChoose={(product) => setPicking({ product })}
          onBag={() => goTo("bag")}
          ordersCount={orders.length}
          onTrack={() => goTo("tracking")}
        />
      ) : null}
      {screen === "bag" ? (
        <BagScreen
          company={company}
          tableId={tableId}
          shop={shop}
          onBack={() => goTo("menu")}
          onEditLine={(line) => {
            const product = shop.products.find((entry) => entry.id === line.id);
            if (product) setPicking({ product, editKey: lineKey(line), line });
          }}
          onSent={(order) => {
            setOrders(order.orders);
            goTo("tracking");
            onSent?.(order);
          }}
        />
      ) : null}
      {screen === "tracking" ? (
        <TrackingScreen company={shop.live} tableNumber={shop.tableNumber} orders={orders} onBack={() => goTo("menu")} onForget={forget} />
      ) : null}
      {picking ? (
        <ChoicesScreen
          key={picking.editKey ?? picking.product.id}
          product={picking.product}
          initial={picking.line ? initialOf(picking.product, picking.line) : undefined}
          onConfirm={confirm}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );
}
