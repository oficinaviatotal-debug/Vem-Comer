import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import Kitchen from "./Kitchen";
import OwnerToday from "./OwnerToday";
import JobsHome from "./JobsHome";
import ShopMenu from "./ShopMenu";
import ChoicesSheet from "./Choices";
import BagScreen from "./Bag";
import { TrackSlip, TrackingPage } from "./Tracking";
import { emptyText, isKitchenTab, kitchenTabs, ticketsFor, type KitchenTabId } from "../cozinha/kitchenLogic";
import { ACAI_PRODUCT, JOBS, PROMO, QUOTE_EXAMPLE, QUOTE_NONE_EXAMPLE, kitchenOrders, orderExample, pixExample, shopExample, todayExample } from "./demo";
import { choicesViewOf, confirmChoices, nextQuantity, pressOption } from "../loja/choicesLogic";
import { bagProblem, bagViewOf } from "../loja/bagLogic";
import { copiedOutcome, pixOf, ratingOf, trackOf } from "../loja/trackingLogic";
import type { Pix } from "./types";
import { addConfigured, decrementItem, incrementLine, setLineNote, type CartLine } from "../customer/cart";
import { EMPTY_ADDRESS, hasFullCep, type Address, type Mode, type Quote } from "../customer/delivery";
import { effectiveMethod, type PayMethod } from "../customer/payment";
import type { Selection } from "../customer/options";

/**
 * Página de conferência do visual novo (não faz parte do aplicativo): mostra cada tela com dados de exemplo.
 * Abrir: preview-novo.html#/loja, #/hoje, #/cozinha, #/vagas, #/escolhas (#/escolhas-erro), #/sacola, #/entrega,
 * #/loja-pedido (cardápio de quem já pediu), #/pedido (preparo, Pix a pagar), #/pedido-rua (entrega a caminho) ou #/pedido-pronto (pronto, pago, avaliação).
 */
/** O cardápio da conferência: dados de exemplo passando pela conta de verdade; adicionar e tirar funcionam na tela. */
function ShopPreview({ withOrder = false }: { withOrder?: boolean }) {
  const view = shopExample();
  const [quantities, setQuantities] = useState<Record<string, number>>({ a2: 2 });
  const groups = view.groups.map((group) => ({
    ...group,
    sections: group.sections.map((section) => ({
      ...section,
      dishes: section.dishes.map((dish) => ({ ...dish, quantity: quantities[dish.id] ?? 0 })),
    })),
  }));
  const price = new Map(groups.flatMap((g) => g.sections.flatMap((s) => s.dishes)).map((dish) => [dish.id, dish.price]));
  const items = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const total = Object.entries(quantities).reduce((sum, [id, n]) => sum + (price.get(id) ?? 0) * n, 0);
  const change = (id: string, by: number) => setQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + by) }));
  return (
    <ShopMenu
      {...view}
      promo={PROMO}
      groups={groups}
      cart={{ items, total }}
      onAdd={(id) => change(id, 1)}
      onLess={(id) => change(id, -1)}
      onPromo={() => change("a1", 1)}
      onPromos={() => undefined}
      ordersCount={withOrder ? 1 : 0}
      onTrack={() => undefined}
      showMenu
      jobsHref="#"
    />
  );
}

/** A cozinha da conferência: pedidos de exemplo passando pela conta de verdade; as etapas respondem ao toque. */
function KitchenPreview() {
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<KitchenTabId>("new");
  const orders = kitchenOrders(now);
  return (
    <Kitchen
      tabs={kitchenTabs(orders)}
      activeTab={tab}
      tickets={ticketsFor(orders, tab, now)}
      onTab={(id) => (isKitchenTab(id) ? setTab(id) : undefined)}
      emptyText={emptyText(tab)}
      showMenu
    />
  );
}

/**
 * As escolhas do prato da conferência: os dados de exemplo passam pela mesma conta da tela de verdade; as teclas respondem.
 * `erro` abre já com o "Adicionar" tocado sem escolher o tamanho, para ver o aviso em vermelho.
 */
function ChoicesPreview({ erro }: { erro: boolean }) {
  const [selection, setSelection] = useState<Selection>(erro ? {} : { "g-size": ["o2"], "g-extra": ["e2", "e3"] });
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(erro);
  const [done, setDone] = useState<string | null>(null);
  const view = { ...choicesViewOf({ product: ACAI_PRODUCT, selection, note, quantity, tried, editing: false, media: () => "" }), art: "🍇" };
  return (
    <>
      <ShopPreview />
      {done ? (
        <p className="nv-root nv-notice" role="status" style={{ position: "fixed", left: 16, right: 16, top: 12, zIndex: 30 }}>
          {done}
        </p>
      ) : (
        <ChoicesSheet
          choices={view}
          onPress={(group, item) => setSelection((current) => pressOption(current, ACAI_PRODUCT, group, item))}
          onNote={setNote}
          onMore={() => setQuantity((n) => nextQuantity(n, 1))}
          onLess={() => setQuantity((n) => nextQuantity(n, -1))}
          onConfirm={() => {
            setTried(true);
            const result = confirmChoices({ product: ACAI_PRODUCT, selection, note, quantity });
            if (result.ok) setDone(`Adicionado: ${result.pick.quantity} × ${ACAI_PRODUCT.name}.`);
          }}
          onClose={() => setDone("Fechou sem adicionar.")}
        />
      )}
    </>
  );
}

/** A sacola da conferência: tudo que se toca funciona (mais, menos, observação, como receber, CEP, pagamento). */
function BagPreview({ delivery }: { delivery: boolean }) {
  const [cart, setCart] = useState<CartLine[]>(() => {
    const acai = { id: ACAI_PRODUCT.id, name: ACAI_PRODUCT.name, price: ACAI_PRODUCT.price };
    const groups = ACAI_PRODUCT.option_groups ?? [];
    const pick = (ids: string[]) => groups.flatMap((g) => g.items.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, group: g.name, name: i.name, deltaCents: Math.round(Number(i.price_delta) * 100) })));
    let next = addConfigured([], acai, { options: pick(["o2", "e2", "e3"]), note: "Sem granola em cima", quantity: 1 });
    next = addConfigured(next, { id: "l1", name: "X-Burguer", price: 18 }, { quantity: 2 });
    return addConfigured(next, { id: "b1", name: "Suco de caju", price: 7 }, { quantity: 1 });
  });
  const [mode, setMode] = useState<Mode>(delivery ? "entrega" : "retirada");
  const [address, setAddress] = useState<Address>(delivery ? { ...EMPTY_ADDRESS, cep: "59000000", street: "Rua das Flores", number: "120", neighborhood: "Centro" } : EMPTY_ADDRESS);
  const [phone, setPhone] = useState(delivery ? "84999998888" : "");
  const [name, setName] = useState(delivery ? "Maria" : "");
  const [payment, setPayment] = useState<PayMethod | null>(delivery ? "dinheiro" : null);
  const [paid, setPaid] = useState("");
  const [sentText, setSentText] = useState<string | null>(null);
  const method = effectiveMethod(payment, true);
  const quote: Quote | null = hasFullCep(address.cep) ? (address.cep.replace(/\D/g, "") === "00000000" ? { ...QUOTE_NONE_EXAMPLE } : { ...QUOTE_EXAMPLE }) : null;
  const input = {
    cart,
    tableNumber: null,
    tableLost: false,
    offered: ["retirada", "entrega"] as Mode[],
    mode,
    deliveryPaused: false,
    quote,
    quoting: false,
    quoteFailed: false,
    address,
    phone,
    remembered: delivery,
    name,
    payment: method,
    pixOn: true,
    paid,
    closed: null,
    editable: () => true,
  };
  return (
    <BagScreen
      bag={bagViewOf(input)}
      error={sentText}
      onBack={() => setSentText("Voltar ao cardápio (exemplo).")}
      onMore={(key) => setCart((c) => incrementLine(c, key))}
      onLess={(key) => setCart((c) => decrementItem(c, key))}
      onEditLine={() => setSentText("Mudar opções abre a folha do prato (exemplo).")}
      onNote={(key, text) => setCart((c) => setLineNote(c, key, text))}
      onMode={(id) => setMode(id === "entrega" ? "entrega" : "retirada")}
      onName={setName}
      onAddress={(patch) => setAddress((a) => ({ ...a, ...patch }))}
      onPhone={setPhone}
      onForget={() => {
        setAddress(EMPTY_ADDRESS);
        setPhone("");
      }}
      onPayment={(id) => setPayment(id === "pix" || id === "cartao" || id === "dinheiro" ? id : null)}
      onPaid={setPaid}
      onSend={() => setSentText(bagProblem(input) ?? "Pronto: o pedido iria para o restaurante (exemplo).")}
    />
  );
}

/** O acompanhamento da conferência: pedidos de exemplo passando pela conta de verdade; copiar e avaliar respondem ao toque. */
function TrackingPreview({ kind }: { kind: "preparo" | "rua" | "pronto" }) {
  const [copied, setCopied] = useState<Pix["copied"]>("");
  const [food, setFood] = useState("");
  const [service, setService] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [closed, setClosed] = useState(false);
  const track = trackOf(orderExample(kind), null, false);
  const rating = kind === "pronto" ? ratingOf({ sent, food, service, comment, busy: false, error: null }) : null;
  return (
    <TrackingPage sub="Açaí do João" onBack={() => undefined}>
      {closed ? (
        <p className="nv-empty">Pedido fechado (exemplo).</p>
      ) : (
        <TrackSlip
          track={track}
          pix={pixOf("ready", pixExample(), copied)}
          onCopy={() => setCopied(copiedOutcome(true))}
          rating={rating}
          onFood={setFood}
          onService={setService}
          onComment={setComment}
          onSendRating={() => setSent(true)}
          onDismiss={() => setClosed(true)}
        />
      )}
    </TrackingPage>
  );
}

function Screen() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "loja-pedido") return <ShopPreview withOrder />;
  if (route === "pedido") return <TrackingPreview kind="preparo" />;
  if (route === "pedido-rua") return <TrackingPreview kind="rua" />;
  if (route === "pedido-pronto") return <TrackingPreview kind="pronto" />;
  if (route === "escolhas") return <ChoicesPreview erro={false} />;
  if (route === "escolhas-erro") return <ChoicesPreview erro />;
  if (route === "sacola") return <BagPreview delivery={false} />;
  if (route === "entrega") return <BagPreview delivery />;
  if (route === "hoje") return <OwnerToday today={todayExample(Date.now())} showMenu />;
  if (route === "vagas") return <JobsHome jobs={JOBS} city="Natal - RN" showMenu />;
  if (route === "cozinha") return <KitchenPreview />;
  return <ShopPreview />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Screen />
  </React.StrictMode>,
);
