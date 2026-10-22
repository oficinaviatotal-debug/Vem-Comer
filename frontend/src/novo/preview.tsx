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
import DeskTable from "./DeskTable";
import QrScan from "./QrScan";
import PanelMenu from "../painel/PanelMenu";
import { deskTableViewOf, deskViewOf, openTyped, parsePanelCalls } from "../painel/deskLogic";
import { ORDERS_CHANGED, nextStatusOf, ordersViewOf, type PanelOrder } from "../painel/ordersLogic";
import { deliveriesViewOf, pickedText, type CourierOrder } from "../painel/deliveriesLogic";
import { armKey, markedIds, settleViewOf, toggleLeft } from "../painel/settleLogic";
import { codeIsComplete, deliveredText, onlyCodeDigits } from "../courier/courierLogic";
import type { CashView } from "../courier/courierLogic";
import { emptyText, isKitchenTab, kitchenTabs, ticketsFor, type KitchenTabId } from "../cozinha/kitchenLogic";
import { ACAI_PRODUCT, DESK_TABLES, JOBS, PROMO, QUOTE_EXAMPLE, QUOTE_NONE_EXAMPLE, callsExample, cashExample, courierOrders, deskCallsExample, deskOrdersExample, kitchenOrders, orderExample, panelOrders, pixExample, shopExample, todayExample } from "./demo";
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
