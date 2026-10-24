/**
 * A tela de pedidos e caixa do painel, versão nova: transforma os pedidos que o servidor manda (os mesmos da tela
 * antiga) nos cartões da tela nova. Só conta, sem React nem rede: tests/novo/ordersLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou: as palavras e o próximo passo do pedido vêm de `service/orderStatus.ts`
 * (o mesmo que o servidor aceita, backend/order_status.py); como o pedido sai (mesa, entrega, retirada) vem de
 * `service/orderHandling.ts`; o que o chip de pagamento diz e quem confirma o dinheiro vêm de `customer/payment.ts`.
 * O valor, a taxa e o total são os que o servidor gravou: aqui só se soma o troco a devolver, que é "o que o cliente
 * entrega menos o total".
 */
import { adminPaymentChip, canConfirmPayment } from "../customer/payment.ts";
import { linesOf, minutesSince, noteOf, type KitchenItem } from "../cozinha/kitchenLogic.ts";
import { waitTone } from "../novo/format.ts";
import {
  ORDERS_CHANGED,
  ORDERS_EMPTY,
  ORDERS_NO_ADDRESS,
  ORDERS_PICKUP,
  ORDERS_QUIET,
  ORDERS_RECEIVE,
} from "../novo/copy.ts";
import type { OrderCard, OrdersView, Tab } from "../novo/types.ts";
import { formatMoney, formatTime, shortOrderCode } from "../service/format.ts";
import { handlingView, itemsSubtotalCents, type HandlingOrder } from "../service/orderHandling.ts";
import { STATUS_DONE, STATUS_PENDING, nextAction, statusLabel, statusTone } from "../service/orderStatus.ts";

export type { OrderCard, OrdersView };

export type PanelOrder = HandlingOrder & {
  id: string;
  customer_name?: string | null;
  total_price: number | string;
  status: string;
  created_at: string;
  payment_method?: string | null;
  /** "PENDING" até alguém do restaurante confirmar que o dinheiro chegou; depois "PAID". */
  payment_status?: string | null;
  payment_change?: number | string | null;
  items?: KitchenItem[] | null;
};

/** De quanto em quanto tempo a tela pergunta os pedidos (a tela antiga e a cozinha fazem o mesmo: 5 s) e o relógio anda. */
export const ORDERS_POLL_MS = 5000;
export const CLOCK_MS = 30000;
/** Os encerrados são só para conferir: os 20 mais novos bastam. */
export const DONE_LIMIT = 20;

export type OrdersTabId = "new" | "doing" | "receive" | "done";

const LABELS: Record<OrdersTabId, string> = { new: "Novos", doing: "Andamento", receive: "Receber", done: "Feitos" };

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const isPaid = (order: Pick<PanelOrder, "payment_status">): boolean => String(order.payment_status ?? "").toUpperCase() === "PAID";

/** Quem vê o botão "Pagamento recebido" e a aba Receber: a mesma regra da tela antiga (o servidor confere de novo). */
export const canReceive = (role: string | null | undefined): boolean => canConfirmPayment(role, null);

const CONTACT_ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER"];

/**
 * Quem vê endereço e telefone de quem pediu: quem despacha e atende. A cozinha não precisa e fica só com o bairro.
 * Isto é o mínimo na tela; quem limita o que sai do servidor é o servidor.
 */
export const seesContact = (role: string | null | undefined): boolean => CONTACT_ROLES.includes(String(role ?? "").toUpperCase());

export function isOrdersTab(value: string): value is OrdersTabId {
  return value === "new" || value === "doing" || value === "receive" || value === "done";
}

/** As abas desta pessoa, na ordem em que o pedido anda. Quem não confirma pagamento não tem a aba Receber. */
export function tabIdsFor(role: string | null | undefined): OrdersTabId[] {
  return canReceive(role) ? ["new", "doing", "receive", "done"] : ["new", "doing", "done"];
}

function inTab(order: PanelOrder, tab: OrdersTabId, role: string | null | undefined): boolean {
  switch (tab) {
    case "new":
      return order.status === STATUS_PENDING;
    case "doing":
      // Estado que o painel não conhece também fica à vista aqui: um pedido nunca some da tela.
      return order.status !== STATUS_PENDING && order.status !== STATUS_DONE;
    case "receive":
      return !isPaid(order);
    case "done":
      // Quem tem a aba Receber vê o pedido entregue e ainda não pago lá; quem não tem, vê aqui.
      return order.status === STATUS_DONE && (!canReceive(role) || isPaid(order));
  }
}

const time = (order: PanelOrder): number => {
  const value = new Date(order.created_at).getTime();
  return Number.isNaN(value) ? 0 : value;
};

/** Os pedidos de uma aba: quem esperou mais vem primeiro; nos encerrados, o mais novo primeiro. */
export function ordersOfTab(orders: readonly PanelOrder[], tab: OrdersTabId, role: string | null | undefined): PanelOrder[] {
  const found = orders.filter((order) => inTab(order, tab, role));
  if (tab === "done") return found.sort((a, b) => time(b) - time(a)).slice(0, DONE_LIMIT);
  return found.sort((a, b) => time(a) - time(b));
}

export function ordersTabs(orders: readonly PanelOrder[], role: string | null | undefined): Tab[] {
  return tabIdsFor(role).map((id) => ({ id, label: LABELS[id], count: ordersOfTab(orders, id, role).length }));
}

/**
 * A aba que abre sozinha: a primeira que tem pedido. O caixa começa pelo dinheiro a receber; os outros, pelo pedido
 * novo. Se nenhuma tem, a de pedidos novos.
 */
export function firstTab(orders: readonly PanelOrder[], role: string | null | undefined): OrdersTabId {
  const order: OrdersTabId[] = String(role ?? "").toUpperCase() === "CASHIER" ? ["receive", "new", "doing"] : ["new", "doing", "receive"];
  const allowed = tabIdsFor(role);
  return order.find((id) => allowed.includes(id) && ordersOfTab(orders, id, role).length > 0) ?? "new";
}

/** "2 pedidos novos para aceitar", "1 pedido em andamento", ou a frase de sossego. */
export function subOf(orders: readonly PanelOrder[]): string {
  const fresh = orders.filter((order) => order.status === STATUS_PENDING).length;
  if (fresh > 0) return fresh === 1 ? "1 pedido novo para aceitar" : `${fresh} pedidos novos para aceitar`;
  const doing = orders.filter((order) => order.status !== STATUS_DONE).length;
  if (doing > 0) return doing === 1 ? "1 pedido em andamento" : `${doing} pedidos em andamento`;
  return ORDERS_QUIET;
}

/** Os centavos de um valor que o servidor mandou; 0 quando não é número. */
const cents = (value: unknown): number => {
  const number = Math.round(Number(value) * 100);
  return Number.isFinite(number) ? number : 0;
};

/** "Cliente paga com R$ 50,00 · devolver R$ 8,00": só no dinheiro que ainda não foi recebido e quando o cliente disse com quanto paga. */
export function changeText(order: Pick<PanelOrder, "payment_method" | "payment_status" | "payment_change" | "total_price">): string {
  if (order.payment_method !== "dinheiro" || isPaid(order)) return "";
  const paysWith = cents(order.payment_change);
  if (paysWith <= 0) return "";
  const back = paysWith - cents(order.total_price);
  const tail = back > 0 ? `devolver ${formatMoney(back / 100)}` : "sem troco";
  return `Cliente paga com ${formatMoney(paysWith / 100)} · ${tail}`;
}

/** O código curto dito em voz alta: "#A1B2" vira "pedido A1B2" (o leitor de tela não soletra o jogo da velha). */
const codeSpoken = (number: string): string => (number ? number.replace("#", "pedido ") : "");

const spokenOf = (label: string, parts: string[]): string => `${label}. ${parts.filter(Boolean).join(", ")}.`;

export function cardOf(order: PanelOrder, role: string | null | undefined, now: number): OrderCard {
  const handling = handlingView(order);
  const closed = order.status === STATUS_DONE;
  const step = nextAction(order.status, handling.kind);
  const items = order.items ?? [];
  const contact = seesContact(role);
  const minutes = minutesSince(order.created_at, now);
  const number = shortOrderCode(order.id);
  const name = clean(order.customer_name);
  const who = name && name !== "Cliente Balcão" ? name : "";
  const chip = adminPaymentChip(order.payment_method, order.payment_status);
  const zone = clean(order.delivery_zone);

  let ship: OrderCard["ship"] = null;
  if (handling.kind === "entrega") {
    ship = contact
      ? {
          main: handling.address || ORDERS_NO_ADDRESS,
          sub: [handling.region, handling.reference ? `Referência: ${handling.reference}` : ""].filter(Boolean),
          phone: handling.phone,
          phoneHref: handling.phoneHref,
          courier: handling.courierLine,
        }
      : { main: zone ? `Região ${zone}` : "", sub: [], phone: "", phoneHref: "", courier: handling.courierLine };
  } else if (handling.kind === "retirada") {
    ship = {
      main: ORDERS_PICKUP,
      sub: [],
      phone: contact ? handling.phone : "",
      phoneHref: contact ? handling.phoneHref : "",
      courier: "",
    };
  }

  const total = formatMoney(Number(order.total_price) || 0);
  const receive = canConfirmPayment(role, order.payment_status) ? ORDERS_RECEIVE : "";
  const action = step?.label ?? "";
  const skip = step?.skip?.label ?? "";
  const moneyParts = [handling.title, who, total];
  const placeParts = [handling.title, codeSpoken(number)];

  return {
    id: order.id,
    number,
    where: handling.title,
    kind: handling.kind,
    who,
    time: formatTime(order.created_at),
    minutes,
    wait: closed ? "ok" : waitTone(minutes),
    status: statusLabel(order.status, handling.kind),
    tone: statusTone(order.status),
    ship,
    lines: linesOf(items),
    note: noteOf(items),
    total,
    split:
      handling.feeCents > 0
        ? `Itens ${formatMoney(itemsSubtotalCents(order.total_price, handling.feeCents) / 100)} + entrega ${formatMoney(handling.feeCents / 100)}`
        : "",
    pay: { chip: chip.label, chipTone: chip.tone, extra: changeText(order) },
    receive,
    action,
    skip,
    receiveSpoken: receive ? spokenOf(receive, moneyParts) : "",
    actionSpoken: action ? spokenOf(action, placeParts) : "",
    skipSpoken: skip ? spokenOf(skip, placeParts) : "",
  };
}

export type OrdersInput = {
  orders: readonly PanelOrder[];
  role: string | null | undefined;
  now: number;
  /** A aba que a pessoa tocou; se ela não existe para este papel, abre a primeira com pedido. */
  chosen?: string | null;
  error?: string;
};

export function ordersViewOf(input: OrdersInput): OrdersView {
  const allowed = tabIdsFor(input.role);
  const active: OrdersTabId = input.chosen && isOrdersTab(input.chosen) && allowed.includes(input.chosen) ? input.chosen : firstTab(input.orders, input.role);
  return {
    sub: subOf(input.orders),
    tabs: ordersTabs(input.orders, input.role),
    active,
    cards: ordersOfTab(input.orders, active, input.role).map((order) => cardOf(order, input.role, input.now)),
    empty: ORDERS_EMPTY[active],
    error: input.error ?? "",
  };
}

/** O estado para onde o toque leva o pedido, tirado do que o servidor mandou (nunca do que a tela mostra); null quando não há mais o que fazer. */
export function nextStatusOf(order: PanelOrder, which: "advance" | "skip"): string | null {
  const step = nextAction(order.status, handlingView(order).kind);
  if (!step) return null;
  return which === "skip" ? (step.skip?.next ?? null) : step.next;
}

/**
 * Antes de mandar o toque, a tela olha de novo o pedido no servidor. O servidor aceita qualquer estado vindo de qualquer
 * estado, então um toque velho (outra pessoa já aceitou, ou o pedido já saiu) levaria o pedido para trás.
 * "go": o pedido está como a pessoa viu, pode mandar. "changed": mudou nesse meio tempo, mostra a tela nova sem mandar.
 */
export function moveCheck(seen: PanelOrder, fresh: readonly PanelOrder[]): "go" | "changed" {
  const now = fresh.find((order) => order.id === seen.id);
  return now && now.status === seen.status ? "go" : "changed";
}

/** O mesmo cuidado para "Pagamento recebido": se já foi pago nesse meio tempo, não manda de novo. */
export function payCheck(seen: PanelOrder, fresh: readonly PanelOrder[]): "go" | "changed" {
  const now = fresh.find((order) => order.id === seen.id);
  return now && !isPaid(now) ? "go" : "changed";
}

export { ORDERS_CHANGED };
