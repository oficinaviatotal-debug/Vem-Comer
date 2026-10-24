import { useRef, useState } from "react";
import BagView from "../novo/Bag";
import { decrementItem, incrementLine, lineKey, setLineNote, type CartLine } from "../customer/cart";
import { EMPTY_ADDRESS, effectiveMode, offeredModes, type Address, type Mode } from "../customer/delivery";
import { deliveryMemory } from "../customer/deliveryMemory";
import { orderErrorMessage } from "../customer/labels";
import { closedState, isSoldOut } from "../customer/openness";
import { orderMemory, type RememberedOrder } from "../customer/orderMemory";
import { effectiveMethod, type PayMethod } from "../customer/payment";
import type { Company } from "../customer/types";
import { useQuote } from "../customer/useQuote";
import { createOrder } from "../service/api";
import { bagProblem, bagViewOf, orderPayloadOf, rememberedNameOf, type BagInput } from "./bagLogic";
import type { ShopState } from "./useShop";

/**
 * O pedido que o servidor aceitou: o código dele, a chave para acompanhar e a lista de pedidos deste aparelho já com ele
 * (vem da memória do aparelho; mesmo com o armazenamento bloqueado, a lista traz o pedido que acabou de ser enviado).
 */
export type SentOrder = { orderId: string; token: string; payment: PayMethod; orders: RememberedOrder[] };

type Props = {
  company: Company;
  tableId: string | null;
  shop: ShopState;
  onBack: () => void;
  /** "Mudar opções" de uma linha: quem monta o fluxo abre a folha do prato. */
  onEditLine: (line: CartLine) => void;
  onSent: (order: SentOrder) => void;
};

const isPayMethod = (id: string): id is PayMethod => id === "pix" || id === "cartao" || id === "dinheiro";

/**
 * A sacola de verdade: guarda o que a pessoa escreve (nome, endereço, telefone, como paga), pergunta ao servidor a
 * taxa do CEP e envia o pedido. O servidor confere tudo de novo e recalcula os preços; aqui só se poupa a ida e volta.
 */
export default function BagScreen({ company, tableId, shop, onBack, onEditLine, onSent }: Props) {
  const [name, setName] = useState(() => orderMemory.loadName());
  const [modeChoice, setModeChoice] = useState<Mode | null>(null);
  const [rememberedDelivery] = useState(() => deliveryMemory.load(company.slug));
  const [address, setAddress] = useState<Address>(() => rememberedDelivery?.address ?? EMPTY_ADDRESS);
  const [phone, setPhone] = useState(() => rememberedDelivery?.phone ?? "");
  const [remembered, setRemembered] = useState(rememberedDelivery !== null);
  const [payChoice, setPayChoice] = useState<PayMethod | null>(null);
  const [paid, setPaid] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const { cart, setCart } = shop;
  const offered = offeredModes(shop.deliveryInfo, Boolean(tableId));
  const mode = effectiveMode(modeChoice, offered);
  const quote = useQuote(company.id, address.cep, mode === "entrega" && !tableId);
  const payment = effectiveMethod(payChoice, shop.pixOn);

  const input: BagInput = {
    cart,
    tableNumber: shop.tableNumber,
    tableLost: shop.tableLost,
    offered,
    mode,
    deliveryPaused: Boolean(shop.deliveryInfo?.paused) && !tableId,
    quote: quote.quote,
    quoting: quote.quoting,
    quoteFailed: quote.failed,
    address,
    phone,
    remembered,
    name,
    payment,
    pixOn: shop.pixOn,
    paid,
    closed: closedState(shop.live, Boolean(tableId))?.message ?? null,
    editable: (line) => shop.products.some((product) => product.id === line.id && !isSoldOut(product)),
    extraNotices: shop.soldOutNote ? [shop.soldOutNote] : [],
  };

  // Mexeu em qualquer coisa: o aviso de antes já não vale.
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    setError(null);
    set(value);
  };

  async function send() {
    if (sendingRef.current) return;
    const problem = bagProblem(input);
    if (problem) {
      setError(problem);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const order = orderPayloadOf(input);
      const result = await createOrder(company.id, order.customerName, order.items, order.payment, order.change, tableId, order.extras);
      if (!result?.order_id || !result?.tracking_token) throw new Error("incomplete");
      orderMemory.saveName(rememberedNameOf(name));
      if (mode === "entrega" && !tableId) {
        deliveryMemory.save(company.slug, { address, phone });
        setRemembered(true);
      }
      const orderId = String(result.order_id);
      const token = String(result.tracking_token);
      const orders = orderMemory.add({ orderId, token, slug: company.slug, tableId });
      setCart([]);
      setPaid("");
      onSent({ orderId, token, payment: order.payment, orders });
    } catch (err) {
      setError(orderErrorMessage(err instanceof Error ? err.message : "", mode));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <BagView
      bag={bagViewOf(input)}
      sending={sending}
      error={error}
      onBack={onBack}
      onMore={(key) => setCart((current) => incrementLine(current, key))}
      onLess={(key) => setCart((current) => decrementItem(current, key))}
      onEditLine={(key) => {
        const line = cart.find((entry) => lineKey(entry) === key);
        if (line) onEditLine(line);
      }}
      onNote={(key, text) => setCart((current) => setLineNote(current, key, text))}
      onMode={edit((id: string) => setModeChoice(id === "entrega" ? "entrega" : "retirada"))}
      onName={edit(setName)}
      onAddress={edit((patch: Partial<Address>) => setAddress((current) => ({ ...current, ...patch })))}
      onPhone={edit(setPhone)}
      onRetryQuote={quote.retry}
      onForget={() => {
        deliveryMemory.forget(company.slug);
        setAddress(EMPTY_ADDRESS);
        setPhone("");
        setRemembered(false);
      }}
      onPayment={edit((id: string) => setPayChoice(isPayMethod(id) ? id : null))}
      onPaid={edit(setPaid)}
      onSend={() => void send()}
    />
  );
}
