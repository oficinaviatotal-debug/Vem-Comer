import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import Kitchen from "./Kitchen";
import OwnerToday from "./OwnerToday";
import JobsHome from "./JobsHome";
import ShopMenu from "./ShopMenu";
import ChoicesSheet from "./Choices";
import BagScreen from "./Bag";
import { TrackSlip, TrackingPage } from "./Tracking";
import TablePage from "./Table";
import Desk from "./Desk";
import Orders from "./Orders";
import Deliveries from "./Deliveries";
import Settle from "./Settle";
import MenuSetup from "./MenuSetup";
import Dishes, { NOT_BUSY } from "./Dishes";
import Categories from "./Categories";
import DeskTable from "./DeskTable";
import QrScan from "./QrScan";
import PanelMenu from "../painel/PanelMenu";
import { deskTableViewOf, deskViewOf, openTyped, parsePanelCalls } from "../painel/deskLogic";
import { ORDERS_CHANGED, nextStatusOf, ordersViewOf, type PanelOrder } from "../painel/ordersLogic";
import { deliveriesViewOf, pickedText, type CourierOrder } from "../painel/deliveriesLogic";
import { armKey, markedIds, settleViewOf, toggleLeft } from "../painel/settleLogic";
import {
  allBack,
  categoriesViewOf,
  categoryAddedText,
  categoryCheck,
  categoryProblemText,
  categoryRemovedText,
  dishAddedText,
  dishCheck,
  dishEditCheck,
  dishProblemText,
  dishRemovedText,
  dishSavedText,
  dishesViewOf,
  emptyDishForm,
  formAfterAdd,
  formOfDish,
  withEdit,
  withSoldOut,
} from "../painel/dishesLogic";
import type { DishForm } from "./types";
import type { Menu, Product } from "../customer/types";
import {
  addUnclear,
  applyEdit,
  doneViewOf,
  doorViewOf,
  pagesViewOf,
  readingViewOf,
  reviewViewOf,
  speakViewOf,
  takeOut,
  takeSpoken,
  useGuess,
  type FlowState,
} from "../painel/menuSetupLogic";
import { selectedItems, startFromParsed, startSpeak } from "../assistant/assistantFlow";
import {
  backPrice,
  dropDish,
  goBackPick,
  goNext,
  modelOf,
  modelTypesOf,
  pickViewOf,
  pricesViewOf,
  startModel,
  takeDish,
  takePrice,
  toggleCategory,
  toggleDish,
  typesViewOf,
  whereOf,
} from "../painel/menuModelLogic";
import { codeIsComplete, deliveredText, onlyCodeDigits } from "../courier/courierLogic";
import type { CashView } from "../courier/courierLogic";
import { emptyText, isKitchenTab, kitchenTabs, ticketsFor, type KitchenTabId } from "../cozinha/kitchenLogic";
import { DISH_MENUS_EXAMPLE, DISH_PRODUCTS_EXAMPLE, MENU_READ_EXAMPLE, MENU_SPOKEN_EXAMPLE, MODEL_EXAMPLE, MODEL_TYPES_EXAMPLE, ACAI_PRODUCT, DESK_TABLES, JOBS, PROMO, QUOTE_EXAMPLE, QUOTE_NONE_EXAMPLE, callsExample, cashExample, courierOrders, deskCallsExample, deskOrdersExample, kitchenOrders, orderExample, panelOrders, pixExample, shopExample, todayExample } from "./demo";
import { choicesViewOf, confirmChoices, nextQuantity, pressOption } from "../loja/choicesLogic";
import { bagProblem, bagViewOf } from "../loja/bagLogic";
import { copiedOutcome, pixOf, ratingOf, trackOf } from "../loja/trackingLogic";
import { NOTICE_MS, tableViewOf, type CallKind, type MyCall } from "../loja/tableLogic";
import type { Pix } from "./types";
import { addConfigured, decrementItem, incrementLine, setLineNote, type CartLine } from "../customer/cart";
import { EMPTY_ADDRESS, hasFullCep, type Address, type Mode, type Quote } from "../customer/delivery";
import { effectiveMethod, type PayMethod } from "../customer/payment";
import type { Selection } from "../customer/options";

/**
 * Página de conferência do visual novo (não faz parte do aplicativo): mostra cada tela com dados de exemplo.
 * Abrir: preview-novo.html#/loja, #/hoje, #/cozinha, #/vagas, #/escolhas (#/escolhas-erro), #/sacola, #/entrega,
 * #/mesas (quem está chamando), #/mesas-calmo (ninguém chamando), #/mesas-qr (câmera do QR), #/mesas-carregando e #/mesas-erro (lista de mesas), #/mesa-aberta (a mesa 4 aberta),
 * #/pedidos (dono), #/pedidos-caixa (abre no dinheiro a receber), #/pedidos-garcom (sem a aba Receber), #/pedidos-cozinha (sem endereço nem telefone), #/pedidos-calmo (nenhum pedido) e #/pedidos-erro (frase de erro ao tocar) e #/pedidos-enviando (o botão esperando o servidor),
 * #/entregas (entregador: na rua), #/entregas-pegar, #/entregas-entregues, #/entregas-codigo (campo dos 4 números; o código de exemplo é 4821), #/entregas-bloqueado, #/entregas-erro, #/entregas-calmo, #/entregas-carregando e #/entregas-gerente (vê também as de outros motoqueiros),
 * #/acerto (caixa), #/acerto-confirmar (primeiro toque dado), #/acerto-calmo, #/acerto-erro e #/acerto-carregando,
 * #/cardapio (a porta), #/cardapio-sem-foto, #/cardapio-sem-ia, #/cardapio-carregando, #/cardapio-erro, #/cardapio-foto, #/cardapio-foto-erro, #/cardapio-lendo, #/cardapio-falar, #/cardapio-ouvindo, #/cardapio-sem-microfone, #/cardapio-conferir, #/cardapio-editando, #/cardapio-sem-preco, #/cardapio-vazio, #/cardapio-erro-cadastro e #/cardapio-cadastrado,
 * #/pratos (dono), #/pratos-cozinha (só esgotou/voltou), #/pratos-novo (formulário do prato novo), #/pratos-novo-erro (preço que não entendi), #/pratos-mudar (o lápis: formulário já preenchido), #/pratos-mudar-erro (nome que já existe), #/pratos-remover (primeiro toque na lixeira), #/pratos-busca, #/pratos-sem-resultado, #/pratos-vazio, #/pratos-vazio-cozinha, #/pratos-sem-categorias, #/pratos-carregando e #/pratos-erro,
 * #/categorias, #/categorias-vazio, #/categorias-remover, #/categorias-repetida, #/categorias-erro e #/categorias-carregando,
 * #/menu (menu geral do dono), #/menu-garcom (o que o garçom vê), #/mesa (QR da mesa), #/mesa-chamada (conta chamada, água atendida, garçom sem resposta), #/loja-mesa (cardápio de quem está na mesa),
 * #/loja-pedido (cardápio de quem já pediu), #/pedido (preparo, Pix a pagar), #/pedido-rua (entrega a caminho) ou #/pedido-pronto (pronto, pago, avaliação).
 */
/** O cardápio da conferência: dados de exemplo passando pela conta de verdade; adicionar e tirar funcionam na tela. */
function ShopPreview({ withOrder = false, withTable = false }: { withOrder?: boolean; withTable?: boolean }) {
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
      tableLabel={withTable ? "Mesa 4" : null}
      onTable={withTable ? () => undefined : undefined}
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
 * Pedidos e caixa da conferência: os pedidos de exemplo passam pela conta de verdade (`ordersViewOf`) e respondem ao toque, sem
 * servidor: o botão grande avança o pedido, "Pagamento recebido" marca como pago, as etapas trocam. `papel` mostra o que cada
 * pessoa vê (dono e caixa recebem; o garçom não tem a aba Receber; a cozinha não vê endereço nem telefone).
 */
function OrdersPreview({ role, stage = "normal" }: { role: string; stage?: "normal" | "calmo" | "erro" | "enviando" }) {
  const [now] = useState(() => Date.now());
  const [orders, setOrders] = useState<PanelOrder[]>(() => (stage === "calmo" ? [] : panelOrders(Date.now())));
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState(stage === "erro" ? "Não deu para mudar o pedido. Confira a internet e toque de novo." : "");
  const view = ordersViewOf({ orders, role, now, chosen, error });
  const busy = stage === "enviando" && view.cards[0] ? { id: view.cards[0].id, kind: "advance" as const } : null;
  const change = (id: string, patch: (order: PanelOrder) => PanelOrder) => setOrders((list) => list.map((order) => (order.id === id ? patch(order) : order)));
  return (
    <Orders
      view={view}
      busy={busy}
      onTab={(id) => {
        setChosen(id);
        setError("");
      }}
      onAction={(id, which) => {
        const order = orders.find((entry) => entry.id === id);
        const next = order ? nextStatusOf(order, which) : null;
        if (!next) return setError(ORDERS_CHANGED);
        setError("");
        change(id, (current) => ({ ...current, status: next }));
      }}
      onReceive={(id) => {
        setError("");
        change(id, (current) => ({ ...current, payment_status: "PAID" }));
      }}
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

/**
 * A mesa da conferência: os botões passam pela conta de verdade (`tableViewOf`) e respondem ao toque, sem servidor:
 * tocar põe o botão em "Chamado" e, depois de um minuto, em "Ainda não veio?". "chamado" já abre com os três estados.
 */
function TablePreview({ stage }: { stage: "novo" | "chamado" }) {
  const [calls, setCalls] = useState<MyCall[]>(() => callsExample(stage, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const view = tableViewOf({
    tableNumber: 4,
    calls,
    now,
    sending: null,
    notice,
    error: "",
    ordersCount: stage === "chamado" ? 1 : 0,
    jobsHref: "https://vemtrabalhar.example/vagas",
  });
  const call = (kind: CallKind) => {
    setCalls((list) => [{ id: `c-${Date.now()}`, kind, status: "open", savedAt: Date.now() }, ...list.filter((item) => item.kind !== kind)]);
    setNow(Date.now());
    setNotice("Avisamos o atendente.");
    window.setTimeout(() => setNotice(""), NOTICE_MS);
  };
  return <TablePage shop={{ name: "Açaí do João", mark: "🍇" }} view={view} onCall={call} onMenu={() => undefined} onTrack={() => undefined} />;
}

/**
 * A tela de mesas da conferência: os chamados e as fichas passam pela conta de verdade (`deskViewOf`) e respondem ao toque, sem
 * servidor: "Já atendi" tira o chamado da lista, a ficha abre a mesa, e o número digitado acha a mesa pelo cadastro de exemplo.
 */
function DeskPreview({ stage }: { stage: "chamando" | "calmo" | "qr" | "carregando" | "erro" | "aberta" }) {
  const [calls, setCalls] = useState(() => parsePanelCalls(stage === "calmo" ? [] : deskCallsExample()));
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<string | null>(stage === "aberta" ? "mesa-4" : null);
  const [now] = useState(() => Date.now());
  const orders = deskOrdersExample(now);
  const tables = stage === "carregando" || stage === "erro" ? null : DESK_TABLES;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const table = open && tables ? tables.find((item) => item.id === open) ?? null : null;
  if (table) {
    return (
      <DeskTable
        view={deskTableViewOf({ table, calls, tables: DESK_TABLES, orders, now, orderHref: "https://exemplo.vem/?mesa=" + table.id })}
        onBack={() => setOpen(null)}
        onAnswer={(id) => setCalls((list) => list.filter((call) => call.id !== id))}
      />
    );
  }
  return (
    <Desk
      view={deskViewOf({ calls, tables, orders, tablesFailed: stage === "erro", message })}
      typed={typed}
      onType={(value) => {
        setTyped(value);
        setMessage("");
      }}
      onSubmitTyped={() => {
        const found = openTyped(DESK_TABLES, typed);
        if ("table" in found) setOpen(found.table.id);
        else setMessage(found.message);
      }}
      onOpen={setOpen}
      onAnswer={(id) => setCalls((list) => list.filter((call) => call.id !== id))}
      onRetry={() => undefined}
      onScan={stage === "qr" ? undefined : () => undefined}
      scanner={stage === "qr" ? <QrScan videoRef={videoRef} onCancel={() => undefined} /> : undefined}
      showMenu
    />
  );
}

/**
 * O menu geral da conferência: abre por cima do "Hoje" pelo botão de menu, passa pela conta de verdade (`menuViewOf`, que usa
 * as regras de sempre do menu antigo) e tem os mesmos cuidados do menu de verdade (Esc, foco, Tab preso, fundo sem rolar).
 * `dono`: vê tudo (e o que é do dono do sistema); `garcom`: só o que o garçom vê.
 */
function MenuPreview({ role }: { role: "OWNER" | "WAITER" }) {
  const [open, setOpen] = useState(true);
  const [current, setCurrent] = useState("inicio");
  const [done, setDone] = useState("");
  return (
    <>
      <OwnerToday today={todayExample(Date.now())} showMenu onMenu={() => setOpen(true)} />
      {done ? (
        <p className="nv-root nv-notice" role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 30, pointerEvents: "none" }}>
          {done}
        </p>
      ) : null}
      {open ? (
        <PanelMenu
          role={role}
          allowed={() => true}
          hasPlanTab={role === "OWNER"}
          platformAdmin={role === "OWNER"}
          openOrders={3}
          helpCount={role === "OWNER" ? 2 : null}
          approvalsCount={role === "OWNER" ? 1 : null}
          current={current}
          place="Açaí do João"
          personName={role === "OWNER" ? "João" : "Marta"}
          canHelp
          onSelect={(view) => {
            setCurrent(view);
            setDone(`Abriria: ${view} (na conferência, nada abre).`);
          }}
          onClose={() => setOpen(false)}
          onCustomer={() => setDone("Abriria o cardápio do cliente.")}
          onHelp={() => setDone("Abriria o pedido de ajuda.")}
          onLogout={() => setDone("Sairia do painel.")}
        />
      ) : null}
    </>
  );
}

type DeliveriesStage = "normal" | "pegar" | "entregues" | "codigo" | "bloqueado" | "erro" | "calmo" | "carregando" | "gerente";

/** As entregas da conferência: passam pela conta de verdade (`deliveriesViewOf`) e respondem ao toque; o código de exemplo é 4821. */
function DeliveriesPreview({ stage = "normal" }: { stage?: DeliveriesStage }) {
  const [orders, setOrders] = useState<CourierOrder[] | null>(() => (stage === "carregando" ? null : stage === "calmo" ? [] : courierOrders(Date.now(), stage === "gerente")));
  const [chosen, setChosen] = useState<string | null>(stage === "pegar" ? "ready" : stage === "entregues" ? "done" : null);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<{ id: string; code: string } | null>(stage === "codigo" || stage === "bloqueado" ? { id: "a1b2-going-1", code: stage === "codigo" ? "48" : "" } : null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(stage === "erro" ? { id: "e5f6-ready-1", text: "Sem sinal. Tente de novo." } : null);
  const view = deliveriesViewOf({ orders, chosen: chosen ?? (stage === "erro" ? "ready" : null), error: stage === "erro" ? "Sem sinal. Mostrando a última lista que carregou." : "", notice });
  const form = open ? { id: open.id, code: open.code, ready: codeIsComplete(open.code), locked: stage === "bloqueado" } : null;
  const update = (id: string, patch: Partial<CourierOrder>) => setOrders((list) => (list ? list.map((order) => (order.id === id ? { ...order, ...patch } : order)) : list));
  return (
    <Deliveries
      view={view}
      form={form}
      note={note}
      onTab={(id) => {
        setChosen(id);
        setNote(null);
        setNotice("");
      }}
      onPick={(id) => {
        const order = orders?.find((entry) => entry.id === id);
        if (!order) return;
        update(id, { status: "saiu para entrega", mine: true });
        setNote(null);
        setNotice(pickedText(order));
      }}
      onOpen={(id) => {
        setOpen({ id, code: "" });
        setNotice("");
      }}
      onCode={(code) => {
        setOpen((current) => (current ? { ...current, code: onlyCodeDigits(code) } : current));
        setNote(null);
      }}
      onConfirm={(id) => {
        const order = orders?.find((entry) => entry.id === id);
        if (!order || !open) return;
        if (open.code !== "4821") {
          setNote({ id, text: "Código errado. Peça de novo ao cliente. Restam 2 tentativas." });
          setOpen({ id, code: "" });
          return;
        }
        update(id, { status: "concluido", delivered_at: new Date().toISOString(), cash_received: order.cash_to_receive === "0.00" ? "" : order.cash_to_receive });
        setNotice(deliveredText({ kind: "done", already: false, cashCents: Math.round(Number(order.cash_to_receive) * 100) }));
        setOpen(null);
        setNote(null);
      }}
      onCloseForm={() => {
        setOpen(null);
        setNote(null);
      }}
      showMenu
    />
  );
}

type SettleStage = "normal" | "confirmar" | "calmo" | "erro" | "carregando";

/** O acerto da conferência: passa pela conta de verdade (`settleViewOf`); o primeiro toque arma o botão e o segundo acerta. */
function SettlePreview({ stage = "normal" }: { stage?: SettleStage }) {
  const [cash, setCash] = useState<CashView | null>(() => (stage === "carregando" ? null : stage === "calmo" ? { couriers: [], total: "0.00", count: 0 } : cashExample(Date.now())));
  const [left, setLeft] = useState<string[]>(stage === "confirmar" ? ["x3"] : []);
  const [armed, setArmed] = useState<string | null>(() => {
    if (stage !== "confirmar") return null;
    const first = cashExample(Date.now()).couriers[0];
    return armKey(first, ["x3"]);
  });
  const [notice, setNotice] = useState("");
  const view = settleViewOf({ cash, left, armed, error: stage === "erro" ? "Sem sinal. Tente de novo." : "", notice });
  return (
    <Settle
      view={view}
      onToggle={(_group, order) => {
        setLeft((current) => toggleLeft(current, order));
        setArmed(null);
        setNotice("");
      }}
      onSettle={(groupId) => {
        const group = cash?.couriers.find((entry) => entry.courier_id === groupId);
        if (!cash || !group) return;
        const key = armKey(group, left);
        if (armed !== key) return setArmed(key);
        const ids = markedIds(group, left);
        setNotice(`${ids.length} ${ids.length === 1 ? "entrega acertada" : "entregas acertadas"}.`);
        setArmed(null);
        setLeft([]);
        setCash({ ...cash, couriers: cash.couriers.filter((entry) => entry.courier_id !== groupId) });
      }}
      onRefresh={() => setNotice("")}
      showMenu
    />
  );
}

/** A "foto" de exemplo do prato: um emoji num quadradinho, no endereço `data:` (só na conferência; na tela de verdade é a foto do restaurante). */
function emojiPhoto(path: string | null | undefined): string {
  if (!path || !path.startsWith("emoji:")) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#fdeedf"/><text x="48" y="64" font-size="52" text-anchor="middle">${path.slice(6)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type DishesStage =
  | "normal"
  | "cozinha"
  | "novo"
  | "novo-erro"
  | "mudar"
  | "mudar-erro"
  | "remover"
  | "busca"
  | "sem-resultado"
  | "vazio"
  | "vazio-cozinha"
  | "sem-categorias"
  | "carregando"
  | "erro";

/** Os pratos da conferência: passam pela conta de verdade (`dishesViewOf`); esgotou, voltou, remover e adicionar funcionam na tela. */
function DishesPreview({ stage = "normal" }: { stage?: DishesStage }) {
  const kitchen = stage === "cozinha" || stage === "vazio-cozinha";
  const [products, setProducts] = useState<Product[] | null>(() => {
    if (stage === "carregando") return null;
    if (stage === "vazio" || stage === "vazio-cozinha") return [];
    if (stage === "sem-categorias") return DISH_PRODUCTS_EXAMPLE.map((dish) => ({ ...dish, menu_id: null })) as Product[];
    return DISH_PRODUCTS_EXAMPLE as Product[];
  });
  const [menus] = useState<Menu[] | null>(() => (stage === "carregando" ? null : stage === "sem-categorias" ? [] : DISH_MENUS_EXAMPLE));
  const [query, setQuery] = useState(stage === "busca" ? "pur" : stage === "sem-resultado" ? "pizza" : "");
  const [armed, setArmed] = useState<string | null>(stage === "remover" ? "d6" : null);
  const [form, setForm] = useState<DishForm | null>(() => {
    if (stage === "novo") return { ...emptyDishForm("m-bebidas"), name: "Guaraná lata", price: "6" };
    if (stage === "novo-erro") return { ...emptyDishForm("m-bebidas"), name: "Guaraná lata", price: "seis", problem: "price" };
    if (stage === "mudar") return formOfDish(DISH_PRODUCTS_EXAMPLE[1] as Product, DISH_MENUS_EXAMPLE);
    if (stage === "mudar-erro") return { ...formOfDish(DISH_PRODUCTS_EXAMPLE[1] as Product, DISH_MENUS_EXAMPLE), name: "x-tudo", problem: "twice" };
    return null;
  });
  const [notice, setNotice] = useState("");
  const view = dishesViewOf({
    products,
    menus,
    canManage: !kitchen,
    query,
    armed,
    media: emojiPhoto,
    error: stage === "erro" ? "Sem sinal. Tente de novo." : "",
    notice,
    editing: form?.editId ?? null,
  });
  return (
    <Dishes
      view={view}
      query={query}
      form={form}
      problemText={form ? dishProblemText(form.problem) : ""}
      busy={NOT_BUSY}
      onQuery={setQuery}
      onToggle={(id) => {
        setNotice("");
        setProducts((list) => (list ? withSoldOut(list, id, !list.find((dish) => dish.id === id)?.sold_out) : list));
      }}
      onRemove={(id) => {
        if (armed !== id) return setArmed(id);
        const gone = products?.find((dish) => dish.id === id);
        setArmed(null);
        setProducts((list) => (list ? list.filter((dish) => dish.id !== id) : list));
        if (gone) setNotice(dishRemovedText(gone.name));
      }}
      onReset={() => {
        setProducts((list) => (list ? allBack(list) : list));
        setNotice("Todos os pratos voltaram.");
      }}
      onOpenForm={() => setForm(emptyDishForm())}
      onEdit={(id) => {
        const dish = products?.find((entry) => entry.id === id);
        if (dish && menus) setForm(formOfDish(dish, menus));
      }}
      onForm={(patch) => setForm((current) => (current ? { ...current, ...patch, problem: "" } : current))}
      onAdd={() => {
        if (!form || !products || !menus) return;
        if (form.editId) {
          const dish = products.find((entry) => entry.id === form.editId);
          if (!dish) return setForm(null);
          const edit = dishEditCheck(form, dish, products, menus);
          if (!edit.ok) return setForm({ ...form, problem: edit.problem });
          setProducts(withEdit(products, dish.id, edit.patch));
          if (Object.keys(edit.patch).length > 0) setNotice(dishSavedText(edit.patch.name ?? dish.name));
          return setForm(null);
        }
        const check = dishCheck(form, products, menus);
        if (!check.ok) return setForm({ ...form, problem: check.problem });
        setProducts([...products, { id: `novo-${products.length}`, menu_id: check.dish.menuId, name: check.dish.name, price: check.dish.price }]);
        setNotice(dishAddedText(check.dish.name));
        setForm(formAfterAdd(form));
      }}
      onCloseForm={() => setForm(null)}
      onMake={() => setNotice("Aqui abriria o montar por foto, arquivo ou voz.")}
      onRefresh={() => setNotice("")}
      showMenu
    />
  );
}

type CategoriesStage = "normal" | "vazio" | "remover" | "repetida" | "erro" | "carregando";

/** As categorias da conferência: passam pela conta de verdade (`categoriesViewOf`); adicionar e remover funcionam na tela. */
function CategoriesPreview({ stage = "normal" }: { stage?: CategoriesStage }) {
  const [menus, setMenus] = useState<Menu[] | null>(() => (stage === "carregando" ? null : stage === "vazio" ? [] : DISH_MENUS_EXAMPLE));
  const products = stage === "carregando" ? null : stage === "vazio" ? [] : (DISH_PRODUCTS_EXAMPLE as Product[]);
  const [name, setName] = useState(stage === "repetida" ? "bebidas" : "");
  const [problem, setProblem] = useState<"" | "name" | "twice">(stage === "repetida" ? "twice" : "");
  const [armed, setArmed] = useState<string | null>(stage === "remover" ? "m-bebidas" : null);
  const [notice, setNotice] = useState("");
  const view = categoriesViewOf({ menus, products, armed, error: stage === "erro" ? "Sem sinal. Tente de novo." : "", notice });
  return (
    <Categories
      view={view}
      name={name}
      problemText={categoryProblemText(problem)}
      onName={(text) => {
        setName(text);
        setProblem("");
      }}
      onAdd={() => {
        if (!menus) return;
        const check = categoryCheck(name, menus);
        if (!check.ok) return setProblem(check.problem);
        setMenus([...menus, { id: `nova-${menus.length}`, name: check.name }]);
        setNotice(categoryAddedText(check.name));
        setName("");
      }}
      onRemove={(id) => {
        if (armed !== id) return setArmed(id);
        const gone = menus?.find((menu) => menu.id === id);
        setArmed(null);
        setMenus((list) => (list ? list.filter((menu) => menu.id !== id) : list));
        if (gone) setNotice(categoryRemovedText(gone.name));
      }}
      onRefresh={() => setNotice("")}
      showMenu
    />
  );
}

type MenuStage =
  | "porta"
  | "porta-sem-foto"
  | "porta-sem-ia"
  | "porta-carregando"
  | "porta-erro"
  | "foto"
  | "foto-erro"
  | "lendo"
  | "falar"
  | "ouvindo"
  | "sem-microfone"
  | "conferir"
  | "editando"
  | "sem-preco"
  | "vazio"
  | "erro-cadastro"
  | "cadastrado"
  | "modelo"
  | "modelo-carregando"
  | "modelo-erro"
  | "modelo-busca"
  | "modelo-sem-resultado"
  | "modelo-abrindo"
  | "modelo-erro-abrir"
  | "modelo-marcar"
  | "modelo-marcar-ultima"
  | "modelo-marcar-nenhum"
  | "modelo-preco"
  | "modelo-preco-erro"
  | "modelo-conferir";

/** Uma "foto de página" de exemplo, só para a miniatura: um endereço blob: de verdade, como o do aparelho. */
function pageUrl(index: number): string {
  const lines = Array.from({ length: 11 }, (_, i) => `<rect x="24" y="${84 + i * 27}" width="${130 + ((i * 41 + index * 17) % 100)}" height="9" rx="4.5" fill="#cfd8cf"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#fffdf6"/><text x="24" y="56" font-size="26" font-family="sans-serif" font-weight="700" fill="#1b4332">Cardápio ${index + 1}</text>${lines}</svg>`;
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

const readFlow = () => startFromParsed(MENU_READ_EXAMPLE);
const spokenFlow = () => {
  let flow = startSpeak();
  let heading = "";
  for (const text of MENU_SPOKEN_EXAMPLE) {
    const out = takeSpoken(flow, text, heading);
    flow = out.flow;
    heading = out.heading;
  }
  return { flow, heading };
};

const MODEL_TYPES = modelTypesOf(MODEL_TYPES_EXAMPLE) ?? [];
const MODEL = modelOf(MODEL_EXAMPLE, "lanchonete");

/** O estado de cada etapa do modelo, chegando lá pelos mesmos passos da pessoa: marcar os 3 primeiros pratos de cada categoria, seguir, pôr preço. */
function modelFlowFor(stage: MenuStage) {
  let flow = MODEL ? startModel(MODEL) : startSpeak();
  const marks = (category: number, many: number) => {
    for (let i = 0; i < many; i += 1) flow = toggleDish(flow, `${category}-${i}`);
  };
  if (stage === "modelo-marcar") {
    marks(0, 3);
    return flow;
  }
  if (stage === "modelo-marcar-nenhum") {
    for (let c = 0; c < flow.categories.length - 1; c += 1) flow = goNext(flow);
    return flow;
  }
  const last = flow.categories.length - 1;
  for (let c = 0; c < last; c += 1) {
    marks(c, 3);
    flow = goNext(flow);
  }
  if (stage === "modelo-marcar-ultima") return flow;
  marks(last, 2);
  flow = goNext(flow);
  if (stage === "modelo-conferir") {
    // Um preço para cada prato; o terceiro fica em branco e sai da lista (é o \"Tirar este prato\"); o 300 vai parecer engano na conferência.
    const prices = ["25", "22", "", "8", "6,5", "300", "12", "18,50", "20", "5", "4", "9", "7", "10"];
    for (const price of prices) {
      const out = takePrice(flow, price);
      flow = out.problem ? dropDish(flow) : out.flow;
      if (flow.step !== "prices") break;
    }
  }
  return flow;
}

/** Montar o cardápio: cada etapa passa pela conta de verdade (`menuSetupLogic`); a leitura da foto é de exemplo e o cadastro não vai a lugar nenhum. */
function MenuSetupPreview({ stage }: { stage: MenuStage }) {
  type Where = "door" | "types" | "pick" | "prices" | "pages" | "reading" | "speak" | "review" | "done";
  const first: Where =
    stage === "modelo" || stage === "modelo-carregando" || stage === "modelo-erro" || stage === "modelo-busca" || stage === "modelo-sem-resultado" || stage === "modelo-abrindo" || stage === "modelo-erro-abrir"
      ? "types"
      : stage === "modelo-marcar" || stage === "modelo-marcar-ultima" || stage === "modelo-marcar-nenhum"
        ? "pick"
        : stage === "modelo-preco" || stage === "modelo-preco-erro"
          ? "prices"
          : stage === "modelo-conferir"
            ? "review"
            : stage === "foto" || stage === "foto-erro" ? "pages" : stage === "lendo" ? "reading" : stage === "falar" || stage === "ouvindo" || stage === "sem-microfone" ? "speak" : stage === "cadastrado" ? "done" : stage === "conferir" || stage === "editando" || stage === "sem-preco" || stage === "vazio" || stage === "erro-cadastro" ? "review" : "door";
  const [where, setWhere] = useState<Where>(first);
  const [pages, setPages] = useState(() => (first === "pages" ? [{ id: 1, url: pageUrl(0) }, { id: 2, url: pageUrl(1) }] : []));
  const [nextPage, setNextPage] = useState(3);
  const [flow, setFlow] = useState<FlowState>(() => {
    if (stage.startsWith("modelo")) return modelFlowFor(stage);
    if (stage === "falar" || stage === "ouvindo" || stage === "sem-microfone") return spokenFlow().flow;
    if (stage === "sem-preco") return startFromParsed({ readable: true, notes: "", categories: [{ name: "Lanches", items: [{ name: "X-tudo", price: "" }, { name: "X-salada", price: "" }] }] });
    if (stage === "vazio") return startFromParsed({ readable: true, notes: "", categories: [] });
    return stage === "conferir" || stage === "editando" || stage === "erro-cadastro" || stage === "cadastrado" ? readFlow() : startSpeak();
  });
  const [heading, setHeading] = useState("");
  const [notice, setNotice] = useState(stage === "falar" ? "Anotei Água mineral. Falta o preço." : "");
  const [unclear, setUnclear] = useState<string[]>([]);
  const [listening, setListening] = useState(stage === "ouvindo");
  const [editing, setEditing] = useState<string | null>(stage === "editando" ? "0-3" : null);
  const [error, setError] = useState(stage === "erro-cadastro" ? "Sem sinal. Nada foi cadastrado. Tente de novo." : "");
  const [models, setModels] = useState<typeof MODEL_TYPES | null>(stage === "modelo-carregando" || stage === "modelo-erro" ? null : MODEL_TYPES);
  const [query, setQuery] = useState(stage === "modelo-busca" ? "pizza" : stage === "modelo-sem-resultado" ? "sushi bar" : "");
  const [typesError, setTypesError] = useState(
    stage === "modelo-erro"
      ? "Sem sinal. Veja se o celular tem internet e toque em Tentar de novo."
      : stage === "modelo-erro-abrir"
        ? "Sem sinal. Veja se o celular tem internet e toque no tipo do seu negócio de novo."
        : "",
  );
  const [opening, setOpening] = useState(stage === "modelo-abrindo");
  const [pickNotice, setPickNotice] = useState(stage === "modelo-marcar" ? "Anotei Pastel de queijo." : "");
  const [priceProblem, setPriceProblem] = useState<"" | "price">(stage === "modelo-preco-erro" ? "price" : "");
  function go(next: FlowState) {
    setFlow(next);
    const target = whereOf(next);
    if (target === "review") setEditing(null);
    setWhere(target);
  }
  const [saving, setSaving] = useState(false);
  const options = stage === "porta-sem-foto" ? { photo: false, file: true, pdf: false } : stage === "porta-sem-ia" ? { photo: false, file: false, pdf: false } : stage === "porta-carregando" ? null : { photo: true, file: true, pdf: true };

  const view =
    where === "types"
      ? typesViewOf({ types: models, query, error: typesError, opening })
      : where === "pick"
        ? pickViewOf({ flow, notice: pickNotice })
        : where === "prices"
          ? (pricesViewOf({ flow, problem: priceProblem }) ?? reviewViewOf({ flow, editing, error }))
          : where === "door"
      ? doorViewOf({ options, voiceWorks: stage !== "sem-microfone", error: stage === "porta-erro" ? "Não consegui falar com o servidor. Mostrei só o que funciona sem ele." : "" })
      : where === "pages"
        ? pagesViewOf({ pages, busy: false, photoEnabled: true, room: 4 - pages.length, failed: stage === "foto-erro", message: stage === "foto-erro" ? "Não consegui ler esta foto. Tire de novo, de frente e com mais luz." : "" })
        : where === "reading"
          ? readingViewOf()
          : where === "speak"
            ? speakViewOf({ flow, listening, canListen: stage !== "sem-microfone", heard: listening ? "coca lata seis reais" : "", notice, unclear })
            : where === "review"
              ? reviewViewOf({ flow, editing, error })
              : doneViewOf({ products_created: 8, products_skipped: 1 });

  function say(text: string) {
    const out = takeSpoken(flow, text, heading);
    setFlow(out.flow);
    setHeading(out.heading);
    setNotice(out.notice);
    setUnclear(out.unclear);
    if (out.finished && selectedItems(out.flow).length > 0) setWhere("review");
  }
  function read() {
    setWhere("reading");
    window.setTimeout(() => {
      setFlow(readFlow());
      setWhere("review");
    }, 1400);
  }

  return (
    <MenuSetup
      view={view}
      busy={saving}
      onPhotos={(files) => {
        setPages(files.map((_, i) => ({ id: i + 1, url: pageUrl(i) })));
        setNextPage(files.length + 1);
        setWhere("pages");
      }}
      onFile={() => read()}
      onSpeak={() => {
        setFlow(startSpeak());
        setWhere("speak");
      }}
      onModel={() => {
        setQuery("");
        setWhere("types");
      }}
      onQuery={(text) => {
        setQuery(text);
        setTypesError("");
      }}
      onChooseType={() => {
        if (!MODEL) return;
        setOpening(true);
        window.setTimeout(() => {
          setOpening(false);
          setPickNotice("");
          go(startModel(MODEL));
        }, 900);
      }}
      onRetryTypes={() => {
        setTypesError("");
        window.setTimeout(() => setModels(MODEL_TYPES), 700);
      }}
      onToggleDish={(id) => {
        setPickNotice("");
        setFlow((current) => toggleDish(current, id));
      }}
      onToggleAll={() => {
        setPickNotice("");
        setFlow(toggleCategory);
      }}
      onAddDish={(text) => {
        const out = takeDish(flow, text);
        setFlow(out.flow);
        setPickNotice(out.notice);
      }}
      onNext={() => {
        setPickNotice("");
        go(goNext(flow));
      }}
      onPrice={(text) => {
        const out = takePrice(flow, text);
        setPriceProblem(out.problem);
        if (!out.problem) go(out.flow);
      }}
      onDropDish={() => {
        setPriceProblem("");
        go(dropDish(flow));
      }}
      onAddPhotos={(files) => {
        setPages((current) => [...current, ...files.map((_, i) => ({ id: nextPage + i, url: pageUrl(nextPage + i) }))].slice(0, 4));
        setNextPage((n) => n + files.length);
      }}
      onRemovePage={(id) => setPages((current) => current.filter((page) => page.id !== id))}
      onRead={read}
      onBack={() => {
        if (where === "types") return setWhere("door");
        if (where === "pick") {
          const earlier = goBackPick(flow);
          return earlier ? go(earlier) : setWhere("types");
        }
        if (where === "prices" || (where === "review" && flow.source === "template")) {
          setPriceProblem("");
          return go(backPrice(flow));
        }
        setWhere(where === "review" && flow.source === "speech" ? "speak" : "door");
      }}
      onCancel={() => setWhere("pages")}
      onMic={() => setListening((on) => !on)}
      onText={say}
      onRemoveDish={(id) => setFlow((current) => takeOut(current, id))}
      onUnclear={(text) => {
        setFlow((current) => addUnclear(current, text, heading));
        setUnclear((current) => current.filter((value) => value !== text));
      }}
      onFinish={() => setWhere("review")}
      onEdit={(id) => {
        setEditing(id);
        setError("");
      }}
      onChange={(id, name, price) => {
        const outcome = applyEdit(flow, id, name, price);
        if (outcome.problem) return setError(outcome.problem === "price" ? "Não entendi esse preço. Escreva só números, por exemplo 18,50." : "Esse nome ficou vazio ou já existe nesta categoria.");
        setFlow(outcome.flow);
        setEditing(null);
        setError("");
      }}
      onUse={(id) => setFlow((current) => useGuess(current, id))}
      onSave={() => {
        setSaving(true);
        window.setTimeout(() => {
          setSaving(false);
          setWhere("done");
        }, 900);
      }}
      onMore={() => setWhere("door")}
      onSeeMenu={() => setWhere("door")}
      showMenu
    />
  );
}

function Screen() {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "entregas") return <DeliveriesPreview />;
  if (route === "entregas-pegar") return <DeliveriesPreview stage="pegar" />;
  if (route === "entregas-entregues") return <DeliveriesPreview stage="entregues" />;
  if (route === "entregas-codigo") return <DeliveriesPreview stage="codigo" />;
  if (route === "entregas-bloqueado") return <DeliveriesPreview stage="bloqueado" />;
  if (route === "entregas-erro") return <DeliveriesPreview stage="erro" />;
  if (route === "entregas-calmo") return <DeliveriesPreview stage="calmo" />;
  if (route === "entregas-carregando") return <DeliveriesPreview stage="carregando" />;
  if (route === "entregas-gerente") return <DeliveriesPreview stage="gerente" />;
  const menuRoutes: Record<string, MenuStage> = {
    cardapio: "porta",
    "cardapio-sem-foto": "porta-sem-foto",
    "cardapio-sem-ia": "porta-sem-ia",
    "cardapio-carregando": "porta-carregando",
    "cardapio-erro": "porta-erro",
    "cardapio-foto": "foto",
    "cardapio-foto-erro": "foto-erro",
    "cardapio-lendo": "lendo",
    "cardapio-falar": "falar",
    "cardapio-ouvindo": "ouvindo",
    "cardapio-sem-microfone": "sem-microfone",
    "cardapio-conferir": "conferir",
    "cardapio-editando": "editando",
    "cardapio-sem-preco": "sem-preco",
    "cardapio-vazio": "vazio",
    "cardapio-erro-cadastro": "erro-cadastro",
    "cardapio-cadastrado": "cadastrado",
    "cardapio-modelo": "modelo",
    "cardapio-modelo-carregando": "modelo-carregando",
    "cardapio-modelo-erro": "modelo-erro",
    "cardapio-modelo-busca": "modelo-busca",
    "cardapio-modelo-sem-resultado": "modelo-sem-resultado",
    "cardapio-modelo-abrindo": "modelo-abrindo",
    "cardapio-modelo-erro-abrir": "modelo-erro-abrir",
    "cardapio-modelo-marcar": "modelo-marcar",
    "cardapio-modelo-marcar-ultima": "modelo-marcar-ultima",
    "cardapio-modelo-marcar-nenhum": "modelo-marcar-nenhum",
    "cardapio-modelo-preco": "modelo-preco",
    "cardapio-modelo-preco-erro": "modelo-preco-erro",
    "cardapio-modelo-conferir": "modelo-conferir",
  };
  if (menuRoutes[route]) return <MenuSetupPreview stage={menuRoutes[route]} />;
  const dishRoutes: Record<string, DishesStage> = {
    pratos: "normal",
    "pratos-cozinha": "cozinha",
    "pratos-novo": "novo",
    "pratos-novo-erro": "novo-erro",
    "pratos-mudar": "mudar",
    "pratos-mudar-erro": "mudar-erro",
    "pratos-remover": "remover",
    "pratos-busca": "busca",
    "pratos-sem-resultado": "sem-resultado",
    "pratos-vazio": "vazio",
    "pratos-vazio-cozinha": "vazio-cozinha",
    "pratos-sem-categorias": "sem-categorias",
    "pratos-carregando": "carregando",
    "pratos-erro": "erro",
  };
  if (dishRoutes[route]) return <DishesPreview stage={dishRoutes[route]} />;
  const categoryRoutes: Record<string, CategoriesStage> = {
    categorias: "normal",
    "categorias-vazio": "vazio",
    "categorias-remover": "remover",
    "categorias-repetida": "repetida",
    "categorias-erro": "erro",
    "categorias-carregando": "carregando",
  };
  if (categoryRoutes[route]) return <CategoriesPreview stage={categoryRoutes[route]} />;
  if (route === "acerto") return <SettlePreview />;
  if (route === "acerto-confirmar") return <SettlePreview stage="confirmar" />;
  if (route === "acerto-calmo") return <SettlePreview stage="calmo" />;
  if (route === "acerto-erro") return <SettlePreview stage="erro" />;
  if (route === "acerto-carregando") return <SettlePreview stage="carregando" />;
  if (route === "pedidos") return <OrdersPreview role="OWNER" />;
  if (route === "pedidos-caixa") return <OrdersPreview role="CASHIER" />;
  if (route === "pedidos-garcom") return <OrdersPreview role="WAITER" />;
  if (route === "pedidos-cozinha") return <OrdersPreview role="KITCHEN" />;
  if (route === "pedidos-calmo") return <OrdersPreview role="OWNER" stage="calmo" />;
  if (route === "pedidos-erro") return <OrdersPreview role="OWNER" stage="erro" />;
  if (route === "pedidos-enviando") return <OrdersPreview role="OWNER" stage="enviando" />;
  if (route === "mesas") return <DeskPreview stage="chamando" />;
  if (route === "mesas-calmo") return <DeskPreview stage="calmo" />;
  if (route === "mesas-qr") return <DeskPreview stage="qr" />;
  if (route === "mesas-carregando") return <DeskPreview stage="carregando" />;
  if (route === "mesas-erro") return <DeskPreview stage="erro" />;
  if (route === "mesa-aberta") return <DeskPreview stage="aberta" />;
  if (route === "menu") return <MenuPreview role="OWNER" />;
  if (route === "menu-garcom") return <MenuPreview role="WAITER" />;
  if (route === "mesa") return <TablePreview stage="novo" />;
  if (route === "mesa-chamada") return <TablePreview stage="chamado" />;
  if (route === "loja-mesa") return <ShopPreview withTable />;
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
