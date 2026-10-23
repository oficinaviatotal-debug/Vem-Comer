import { useState } from "react";
import VoiceBubble from "../novo/VoiceBubble";
import { VoiceContext } from "../novo/voice";
import { addConfigured, lineKey, replaceLine, type CartLine } from "../customer/cart";
import { orderMemory, type RememberedOrder } from "../customer/orderMemory";
import { closedState } from "../customer/openness";
import type { Company, Product } from "../customer/types";
import BagScreen, { type SentOrder } from "./BagScreen";
import ChoicesScreen, { initialOf } from "./ChoicesScreen";
import ShopScreen from "./ShopScreen";
import TableScreen from "./TableScreen";
import TrackingScreen from "./TrackingScreen";
import type { ChoicesPick } from "./choicesLogic";
import { SEARCH_FROM } from "./shopLogic";
import { useShop } from "./useShop";
import { useShopVoice } from "./useShopVoice";

type Props = {
  company: Company;
  /** Quem entrou pelo QR da mesa traz o código da mesa; senão null. */
  tableId: string | null;
  jobsHref?: string | null;
  /** O link "Sou da equipe ou dono" no fim do cardápio (o aplicativo de sempre sempre teve). */
  teamHref?: string | null;
  /** O servidor aceitou o pedido (a tela já levou a pessoa ao acompanhamento). */
  onSent?: (order: SentOrder) => void;
};

type Screen = "menu" | "bag" | "tracking" | "table";

/** O prato aberto nas escolhas; com `editKey`, é uma linha da sacola sendo mudada. */
type Picking = { product: Product; editKey?: string; line?: CartLine; quantity?: number };

/**
 * O caminho do cliente no visual novo: mesa, cardápio, escolhas do prato, sacola, envio e acompanhamento (com o Pix).
 * Ainda não está ligado ao aplicativo público: o fluxo antigo continua valendo até o GD dizer "pode". Quem já pediu
 * neste aparelho (e ainda tem o pedido guardado) abre direto no acompanhamento; quem leu o QR da mesa abre na tela da
 * mesa (chamar o garçom, pedir a conta); os outros, no cardápio. Como sempre foi.
 */
export default function OrderFlow({ company, tableId, jobsHref = null, teamHref = null, onSent }: Props) {
  const shop = useShop(company, tableId);
  const [orders, setOrders] = useState<RememberedOrder[]>(() => orderMemory.list(company.slug, tableId));
  const [screenState, setScreen] = useState<Screen>(() => (orders.length > 0 ? "tracking" : tableId ? "table" : "menu"));
  // Mesa que não existe: sem tela da mesa, vai direto ao cardápio (o aviso de "mesa não encontrada" já aparece lá).
  const screen: Screen = screenState === "table" && (!tableId || shop.tableLost) ? "menu" : screenState;
  const [picking, setPicking] = useState<Picking | null>(null);
  // O texto da busca fica aqui para a voz poder escrever nele ("buscar suco") e a pessoa ver e corrigir.
  const [query, setQuery] = useState("");

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

  // A voz do cliente: só mexe na sacola, abre telas e escreve na busca. Nunca envia, paga nem chama o garçom.
  const voice = useShopVoice({
    screen,
    load: shop.load,
    products: shop.products,
    menus: shop.menus,
    cart: shop.cart,
    setCart: shop.setCart,
    closed: closedState(shop.live, Boolean(tableId)) !== null,
    hasTable: Boolean(tableId) && !shop.tableLost,
    ordersCount: orders.length,
    searchable: shop.products.length >= SEARCH_FROM,
    onGo: goTo,
    onChoose: (product, quantity) => setPicking({ product, quantity }),
    onSearch: setQuery,
  });

  return (
    <VoiceContext.Provider value={{ onPress: voice.press, listening: voice.listening }}>
      {screen === "menu" ? (
        <ShopScreen
          shop={shop}
          query={query}
          onQuery={setQuery}
          tableId={tableId}
          jobsHref={jobsHref}
          teamHref={teamHref}
          onChoose={(product) => setPicking({ product })}
          onBag={() => goTo("bag")}
          ordersCount={orders.length}
          onTrack={() => goTo("tracking")}
          onTable={tableId && !shop.tableLost ? () => goTo("table") : undefined}
        />
      ) : null}
      {screen === "table" && tableId ? (
        <TableScreen
          company={shop.live}
          tableId={tableId}
          tableNumber={shop.tableNumber}
          ordersCount={orders.length}
          jobsHref={jobsHref}
          onMenu={() => goTo("menu")}
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
          quantity={picking.quantity}
          onConfirm={(pick) => {
            confirm(pick);
            voice.close();
          }}
          onClose={() => {
            setPicking(null);
            voice.close();
          }}
        />
      ) : null}
      {voice.caption ? (
        <VoiceBubble
          tone={voice.caption.tone}
          text={voice.caption.text}
          heard={voice.caption.heard}
          actions={voice.caption.actions}
          onClose={voice.close}
          top={picking !== null}
        />
      ) : null}
    </VoiceContext.Provider>
  );
}
