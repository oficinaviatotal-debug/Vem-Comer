import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../ui.css";
import "./customer.css";
import "../logo/logo.css";
import { createOrder, fetchMenus, fetchPaymentOptions, fetchProducts, fetchTable, mediaUrl } from "../service/api";
import { formatMoney, shortOrderCode } from "../service/format";
import { fetchDeliveryInfo } from "./deliveryApi";
import {
  EMPTY_ADDRESS,
  deliveryProblem,
  effectiveMode,
  feeCents,
  offeredModes,
  orderExtras,
  type Address,
  type DeliveryInfo,
  type Mode,
} from "./delivery";
import { deliveryMemory } from "./deliveryMemory";
import type { DeliveryView } from "./DeliveryForm";
import { useQuote } from "./useQuote";
import OnboardingGuide from "../onboarding/OnboardingGuide";
import { hasSeenGuide, markGuideSeen } from "../onboarding/guideStorage";
import VoiceCommandButton from "../voice/VoiceCommandButton";
import {
  addConfigured,
  addToCart,
  cartCount,
  cartTotalCents,
  cashProblem,
  decrementItem,
  incrementLine,
  lineKey,
  parseMoneyInput,
  replaceLine,
  setLineNote,
  toOrderItems,
  type CartLine,
} from "./cart";
import { customerTour, CUSTOMER_TOUR_ID, CUSTOMER_TOUR_USER, PIX_TOUR_ID, pixTour } from "./customerTour";
import {
  cleanCustomerName,
  customerStatus,
  orderCustomerName,
  orderErrorMessage,
  searchTextFromVoice,
} from "./labels";
import { groupProducts } from "./menuGroups";
import { groupsOf, isUnavailable, selectionFromChosen, type Selection } from "./options";
import { orderMemory, type RememberedOrder } from "./orderMemory";
import { effectiveMethod, orderPaymentView } from "./payment";
import type { Company, Menu, OrderView, PaymentMethod, Product } from "./types";
import CartSheet from "./CartSheet";
import MenuView, { CategoryChips } from "./MenuView";
import OptionsSheet, { type OptionsPick } from "./OptionsSheet";
import OrderTracking from "./OrderTracking";
import TableHub from "../mesa/TableHub";

type Props = {
  company: Company;
  tableId: string | null;
  /** Link to the owner panel, shown small at the bottom. */
  panelHref: string;
};

type Load = "loading" | "ready" | "error";
type Screen = "menu" | "tracking" | "table";

/** Endereço do Vem Trabalhar para o botão "Trabalhe aqui" da tela da mesa. Sem ele, o botão não aparece. */
const JOBS_URL = import.meta.env.VITE_VEM_TRABALHAR_URL as string | undefined;

/** Search only helps once the menu is long enough to scroll. */
const SEARCH_FROM = 8;

export default function CustomerApp({ company, tableId, panelHref }: Props) {
  const [load, setLoad] = useState<Load>("loading");
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [tableLost, setTableLost] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  // The dish whose choices (size, extras...) are open, and the cart line being changed when there is one.
  const [picking, setPicking] = useState<{
    product: Product;
    editKey?: string;
    initial?: { selection: Selection; note: string; quantity: number };
  } | null>(null);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState(() => orderMemory.loadName());
  const [choice, setChoice] = useState<PaymentMethod | null>(null);
  const [pixOn, setPixOn] = useState(false);
  // Pickup and delivery: what the restaurant offers, what the customer chose, and the address typed (or remembered)
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [modeChoice, setModeChoice] = useState<Mode | null>(null);
  const [rememberedDelivery] = useState(() => deliveryMemory.load(company.slug));
  const [address, setAddress] = useState<Address>(() => rememberedDelivery?.address ?? EMPTY_ADDRESS);
  const [phone, setPhone] = useState(() => rememberedDelivery?.phone ?? "");
  const [remembered, setRemembered] = useState(rememberedDelivery !== null);
  const [paid, setPaid] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [voiceHint, setVoiceHint] = useState("");

  const [orders, setOrders] = useState<RememberedOrder[]>(() => orderMemory.list(company.slug, tableId));
  // Quem lê o QR da mesa cai na tela da mesa (chamar garçom, cardápio, conta); quem já pediu, no acompanhamento.
  const [screenState, setScreen] = useState<Screen>(() =>
    orders.length ? "tracking" : tableId ? "table" : "menu"
  );
  // Mesa que não existe: sem tela da mesa, vai direto ao cardápio (o aviso de "mesa não encontrada" já aparece lá).
  const screen: Screen = screenState === "table" && (!tableId || tableLost) ? "menu" : screenState;
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [payById, setPayById] = useState<Record<string, string>>({});
  const [, setRated] = useState(0);

  const [guide, setGuide] = useState<"menu" | "pix" | null>(null);
  const autoGuideDone = useRef(false);
  const autoPixGuideDone = useRef(false);

  const loadMenu = useCallback(async () => {
    setLoad("loading");
    try {
      const [productList, menuList] = await Promise.all([
        fetchProducts(company.id),
        fetchMenus(company.id),
      ]);
      setProducts(Array.isArray(productList) ? productList : []);
      setMenus(Array.isArray(menuList) ? menuList : []);
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, [company.id]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (!tableId) return;
    let alive = true;
    fetchTable(company.id, tableId)
      .then((table: { number?: number }) => {
        if (!alive) return;
        const number = Number(table?.number);
        setTableNumber(number > 0 ? number : null);
        setTableLost(!(number > 0));
      })
      .catch(() => {
        if (alive) setTableLost(true);
      });
    return () => {
      alive = false;
    };
  }, [company.id, tableId]);

  // Pix is offered only when the restaurant typed its own key. Any failure means "no Pix".
  useEffect(() => {
    let alive = true;
    fetchPaymentOptions(company.id).then((options) => {
      if (alive) setPixOn(options.pix);
    });
    return () => {
      alive = false;
    };
  }, [company.id]);

  // Delivery only exists for an order that is not at a table; a failed answer means "nothing new to offer"
  useEffect(() => {
    if (tableId) return;
    let alive = true;
    fetchDeliveryInfo(company.id).then((info) => {
      if (alive) setDeliveryInfo(info);
    });
    return () => {
      alive = false;
    };
  }, [company.id, tableId]);

  const payment = effectiveMethod(choice, pixOn);
  const offered = offeredModes(deliveryInfo, Boolean(tableId));
  const mode = effectiveMode(modeChoice, offered);
  const quoteState = useQuote(company.id, address.cep, mode === "entrega");

  const groups = useMemo(() => groupProducts(products, menus, query), [products, menus, query]);
  const allGroups = useMemo(() => groupProducts(products, menus, ""), [products, menus]);
  const showChips = !query.trim() && allGroups.length > 1;
  const count = cartCount(cart);
  const total = cartTotalCents(cart);

  const deliveryView: DeliveryView = {
    offered,
    mode,
    onMode: setModeChoice,
    paused: Boolean(deliveryInfo?.paused) && !tableId,
    address,
    onAddress: setAddress,
    phone,
    onPhone: setPhone,
    quote: quoteState.quote,
    quoting: quoteState.quoting,
    quoteFailed: quoteState.failed,
    onRetryQuote: quoteState.retry,
    remembered,
    onForget: () => {
      deliveryMemory.forget(company.slug);
      setAddress(EMPTY_ADDRESS);
      setPhone("");
      setRemembered(false);
    },
  };

  const steps = useMemo(() => customerTour({ hasCategories: showChips, hasPix: pixOn }), [showChips, pixOn]);
  const payGuideSteps = useMemo(() => pixTour(), []);

  // First visit: offer the guided tour once the menu is on screen.
  useEffect(() => {
    if (autoGuideDone.current) return;
    if (load !== "ready" || screen !== "menu" || products.length === 0) return;
    autoGuideDone.current = true;
    if (orders.length === 0 && !hasSeenGuide(CUSTOMER_TOUR_ID, CUSTOMER_TOUR_USER)) {
      setGuide("menu");
    }
  }, [load, screen, products.length, orders.length]);

  const add = useCallback((product: { id: string; name: string; price: number | string }) => {
    setCart((current) => addToCart(current, product));
  }, []);

  const less = useCallback((key: string) => {
    setCart((current) => decrementItem(current, key));
  }, []);

  const more = useCallback((key: string) => {
    setCart((current) => incrementLine(current, key));
  }, []);

  const changeNote = useCallback((key: string, note: string) => {
    setCart((current) => setLineNote(current, key, note));
  }, []);

  const choose = useCallback((product: Product) => {
    if (isUnavailable(product)) return;
    setPicking({ product });
  }, []);

  function confirmPick(pick: OptionsPick) {
    if (!picking) return;
    const { product, editKey } = picking;
    setCart((current) =>
      editKey ? replaceLine(current, editKey, product, pick) : addConfigured(current, product, pick)
    );
    setPicking(null);
  }

  /** The dish of a cart line, as long as it is still on the menu with the same option groups. */
  const productOf = useCallback(
    (line: CartLine) => {
      const product = products.find((candidate) => candidate.id === line.id);
      return product && groupsOf(product).length > 0 && !isUnavailable(product) ? product : null;
    },
    [products]
  );

  function editLine(line: CartLine) {
    const product = productOf(line);
    if (!product) return;
    setPicking({
      product,
      editKey: lineKey(line),
      initial: {
        selection: selectionFromChosen(groupsOf(product), line.options ?? []),
        note: line.note ?? "",
        quantity: line.quantity,
      },
    });
  }

  function closeSheet() {
    setSheetOpen(false);
    setSendError("");
  }

  async function send() {
    if (sending || cart.length === 0) return;

    if (mode === "entrega") {
      const problem = deliveryProblem({
        name,
        address,
        phone,
        quote: quoteState.quote,
        subtotalCents: total,
        quoteFailed: quoteState.failed,
      });
      if (problem) {
        setSendError(problem);
        return;
      }
    }

    // What the customer will pay: the dishes plus the fee the server announced for the CEP
    const toPay = total + (mode === "entrega" ? feeCents(quoteState.quote) : 0);

    if (payment === "dinheiro") {
      const problem = cashProblem(toPay, paid);
      if (problem) {
        setSendError(problem);
        return;
      }
    }

    setSending(true);
    setSendError("");
    try {
      const change = payment === "dinheiro" ? (parseMoneyInput(paid) ?? 0) / 100 : 0;
      const result = await createOrder(
        company.id,
        orderCustomerName(name),
        toOrderItems(cart),
        payment,
        change,
        tableId,
        orderExtras(mode, address, phone)
      );
      if (!result?.order_id || !result?.tracking_token) throw new Error("incomplete");

      orderMemory.saveName(cleanCustomerName(name));
      if (mode === "entrega") {
        deliveryMemory.save(company.slug, { address, phone });
        setRemembered(true);
      }
      setOrders(
        orderMemory.add({
          orderId: String(result.order_id),
          token: String(result.tracking_token),
          slug: company.slug,
          tableId,
        })
      );
      setCart([]);
      setPaid("");
      setSheetOpen(false);
      setScreen("tracking");
      window.scrollTo({ top: 0 });
    } catch (error) {
      setSendError(orderErrorMessage(error instanceof Error ? error.message : "", mode));
    } finally {
      setSending(false);
    }
  }

  const forget = useCallback(
    (orderId: string) => {
      const next = orderMemory.remove(company.slug, orderId);
      setOrders(next);
      if (next.length === 0) setScreen("menu");
    },
    [company.slug]
  );

  const handleUpdate = useCallback((order: OrderView) => {
    setStatusById((current) =>
      current[order.id] === order.status ? current : { ...current, [order.id]: order.status }
    );
    const payKind = orderPaymentView(order.payment_method, order.payment_status).kind;
    setPayById((current) => (current[order.id] === payKind ? current : { ...current, [order.id]: payKind }));
  }, []);

  function handleVoice(command: { intent: string; fields?: Record<string, unknown> }) {
    if (command.intent === "search_products") {
      setQuery(searchTextFromVoice(String(command.fields?.rawText ?? "")));
      setVoiceHint("Busca preenchida por voz.");
    } else if (command.intent === "create_order") {
      if (cart.length) {
        setSheetOpen(true);
        setVoiceHint("");
      } else {
        setVoiceHint("Toque em Adicionar nos pratos que você quer e depois em Ver pedido.");
      }
    } else if (command.intent === "unknown") {
      setVoiceHint("Não entendi. Tente dizer, por exemplo: buscar suco.");
    } else {
      setVoiceHint("Esse comando é só para o restaurante.");
    }
  }

  function onNavigate(view: string) {
    if (view === "menu") {
      setSheetOpen(false);
      setScreen("menu");
    } else if (view === "cart" && cart.length > 0) {
      setSheetOpen(true);
    }
  }

  function onGuideClose() {
    const tourId = guide === "pix" ? PIX_TOUR_ID : CUSTOMER_TOUR_ID;
    markGuideSeen(tourId, CUSTOMER_TOUR_USER);
    setGuide(null);
  }

  // One feedback form per visit: on the newest ready order nobody rated yet.
  const feedbackOrderId = orders.find(
    (order) =>
      customerStatus(statusById[order.orderId] ?? "", null).done && !orderMemory.feedbackSent(order.orderId)
  )?.orderId;
  const allOrderIds = orders.map((order) => order.orderId);

  // The first slip still waiting for a Pix payment: the one the payment guide points at.
  const pixDueId = orders.find((order) => payById[order.orderId] === "pix-due")?.orderId;

  // First Pix code on this device: offer the short payment guide once.
  useEffect(() => {
    if (autoPixGuideDone.current || !pixDueId || screen !== "tracking" || guide !== null) return;
    autoPixGuideDone.current = true;
    if (!hasSeenGuide(PIX_TOUR_ID, CUSTOMER_TOUR_USER)) setGuide("pix");
  }, [pixDueId, screen, guide]);

  const latest = orders[0];
  const latestStatus = latest ? statusById[latest.orderId] : undefined;
  const banner = latest && latestStatus ? customerStatus(latestStatus, tableNumber) : null;

  const tableChip = tableId ? (
    tableLost ? (
      <span className="chip cust-table cust-table-lost">Mesa não encontrada</span>
    ) : (
      <button
        type="button"
        className="chip chip-wait cust-table cust-table-btn"
        aria-label={tableNumber ? `Mesa ${tableNumber}: chamar o garçom` : "Chamar o garçom"}
        onClick={() => {
          setSheetOpen(false);
          setScreen("table");
          window.scrollTo({ top: 0 });
        }}
      >
        {tableNumber ? `Mesa ${tableNumber}` : "Mesa…"}
      </button>
    )
  ) : null;

  return (
    <div className="cust">
      <header className="cust-top">
        <div className="cust-wrap">
          <div className="cust-bar">
            {mediaUrl(company.logo_thumb_url) && (
              <img className="cust-logo" src={mediaUrl(company.logo_thumb_url)} alt="" width={40} height={40} />
            )}
            <h1 className="cust-name">{company.name}</h1>
            {tableChip}
            {screen === "menu" && load === "ready" && products.length > 0 && (
              <button
                type="button"
                id="cust-help"
                className="btn btn-outline btn-sm"
                onClick={() => setGuide("menu")}
              >
                Ajuda
              </button>
            )}
          </div>
          {screen === "menu" && showChips && <CategoryChips groups={allGroups} />}
        </div>
      </header>

      <main className="cust-wrap cust-main">
        {screen === "table" && tableId ? (
          <TableHub
            companyId={company.id}
            slug={company.slug}
            tableId={tableId}
            tableNumber={tableNumber}
            jobsUrl={JOBS_URL}
            onSeeMenu={() => {
              setScreen("menu");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : screen === "tracking" ? (
          <>
            <h2 className="cust-page-title">Acompanhe o seu pedido</h2>
            {orders.map((order) => (
              <OrderTracking
                key={order.orderId}
                companyId={company.id}
                orderId={order.orderId}
                token={order.token}
                tableNumber={tableNumber}
                askFeedback={order.orderId === feedbackOrderId}
                allOrderIds={allOrderIds}
                onFeedbackSent={() => setRated((n) => n + 1)}
                onUpdate={handleUpdate}
                onGone={() => forget(order.orderId)}
                onDismiss={() => forget(order.orderId)}
                pixGuideTarget={order.orderId === pixDueId}
                onPixHelp={() => setGuide("pix")}
              />
            ))}
            <button type="button" className="btn btn-primary btn-block" onClick={() => setScreen("menu")}>
              Pedir mais
            </button>
          </>
        ) : (
          <>
            {banner && latest && (
              <button type="button" className="cust-banner" onClick={() => setScreen("tracking")}>
                <span>
                  Pedido {shortOrderCode(latest.orderId)}: <strong>{banner.headline}</strong>
                </span>
                <span>Acompanhar</span>
              </button>
            )}

            {tableLost && (
              <p className="cust-note" role="alert">
                Não encontramos esta mesa. Você pode ver o cardápio; para pedir, chame o atendente.
              </p>
            )}

            {load === "loading" && (
              <div className="cust-skeleton" role="status" aria-label="Carregando o cardápio">
                <span />
                <span />
                <span />
                <span />
              </div>
            )}

            {load === "error" && (
              <div className="cust-empty" role="alert">
                <p>Não foi possível carregar o cardápio. Confira a internet.</p>
                <button type="button" className="btn btn-primary" onClick={() => void loadMenu()}>
                  Tentar de novo
                </button>
              </div>
            )}

            {load === "ready" && (
              <MenuView
                groups={groups}
                cart={cart}
                query={query}
                onAdd={add}
                onLess={less}
                onChoose={choose}
                search={
                  products.length >= SEARCH_FROM ? (
                    <div className="cust-search">
                      <form role="search" onSubmit={(event) => event.preventDefault()}>
                        <label className="field">
                          <span className="sr-only">Buscar no cardápio</span>
                          <input
                            id="cust-search"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar no cardápio"
                          />
                        </label>
                      </form>
                      <VoiceCommandButton onCommand={handleVoice} />
                      {voiceHint && (
                        <p className="cust-note" role="status">
                          {voiceHint}
                        </p>
                      )}
                    </div>
                  ) : null
                }
              />
            )}
          </>
        )}
      </main>

      <footer className="cust-wrap cust-foot">
        <img src="/logo-vem-comer.png" alt="Vem Comer" className="cust-foot-logo" />
        <p>Cardápio digital Vem Comer</p>
        <a href={panelHref}>Área do restaurante</a>
      </footer>

      {screen === "menu" && count > 0 && !sheetOpen && (
        <button type="button" id="cust-cartbar" className="cust-cartbar" onClick={() => setSheetOpen(true)}>
          <span className="cust-cartbar-count" aria-hidden="true">
            {count}
          </span>
          <span className="cust-cartbar-label">
            Ver pedido <span className="sr-only">({count} itens)</span>
          </span>
          <span className="money">{formatMoney(total / 100)}</span>
        </button>
      )}

      {sheetOpen && (
        <CartSheet
          cart={cart}
          tableNumber={tableNumber}
          tableLost={tableLost}
          name={name}
          onName={setName}
          payment={payment}
          pixOn={pixOn}
          delivery={deliveryView}
          onPayment={setChoice}
          paid={paid}
          onPaid={setPaid}
          sending={sending}
          error={sendError}
          onMore={more}
          onLess={less}
          onNote={changeNote}
          onEdit={editLine}
          canEdit={(line) => productOf(line) !== null}
          onSend={() => void send()}
          onClose={closeSheet}
        />
      )}

      {picking && (
        <OptionsSheet
          product={picking.product}
          initial={picking.initial}
          onConfirm={confirmPick}
          onClose={() => setPicking(null)}
        />
      )}

      {guide && (
        <OnboardingGuide
          steps={guide === "pix" ? payGuideSteps : steps}
          onClose={onGuideClose}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
