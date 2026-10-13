/**
 * Motoqueiro: the deliveries on his phone, the code he types and the cash the cashier settles.
 * Pure logic, no React: tests/courier/courierLogic.test.mjs runs it in Node.
 *
 * The server decides everything (backend/courier.py): who can take what, whether the code is right, how many tries
 * are left, how much cash is open. Here there is only grouping, formatting, links and the words on the screen.
 */
import { reais } from "../service/subscriptionView.ts";

export const CODE_LENGTH = 4;

/** How often the open screen asks for news (a delivery can become ready at any time). */
export const COURIER_POLL_MS = 10_000;

/** One delivery as `GET /api/companies/<id>/courier/orders` sends it. The code of the customer is never in it. */
export type CourierOrder = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  reference: string;
  zone: string;
  status: string;
  total: string;
  payment_method: string;
  /** "0.00" when nothing is to be received at the door. */
  cash_to_receive: string;
  /** What the customer will hand over ("" when he pays the exact amount or does not pay in cash). */
  change_for: string;
  change_back: string;
  mine: boolean;
  taken_by_other: boolean;
  needs_code: boolean;
  picked_up_at: string | null;
  delivered_at: string | null;
  /** The cash he received at the door ("" before delivering or when it was not cash). */
  cash_received: string;
  /** The cashier already counted that cash. */
  settled: boolean;
};

export type Stage = "ready" | "going" | "other" | "done";

const OUT = "saiu para entrega";
const DONE = "concluido";

// ------------------------------------------------------------------------------------------------ money

/** "50.00" -> 5000. Anything that is not a plain amount is 0. */
export function centsOf(value: unknown): number {
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

export const moneyText = (cents: number): string => reais(Math.max(0, Math.round(cents)));

// ------------------------------------------------------------------------------------------------ the list

export function stageOf(order: Pick<CourierOrder, "status" | "mine" | "taken_by_other">): Stage {
  if (order.status === DONE) return "done";
  if (order.taken_by_other) return "other";
  if (order.status === OUT && order.mine) return "going";
  return "ready";
}

export type Groups = Record<Stage, CourierOrder[]>;

/** Splits the list into what he is carrying, what waits for him, what others carry and what is done. */
export function groupOrders(orders: readonly CourierOrder[]): Groups {
  const groups: Groups = { going: [], ready: [], other: [], done: [] };
  for (const order of orders) groups[stageOf(order)].push(order);
  // the ones delivered most recently first; the rest keep the order of arrival (the oldest waits at the top)
  groups.done.sort((a, b) => String(b.delivered_at ?? "").localeCompare(String(a.delivered_at ?? "")));
  return groups;
}

/** "2 para pegar · 1 a caminho". Empty when there is nothing to do. */
export function headline(groups: Groups): string {
  const parts: string[] = [];
  if (groups.ready.length) parts.push(`${groups.ready.length} para pegar`);
  if (groups.going.length) parts.push(`${groups.going.length} a caminho`);
  return parts.join(" · ");
}

export const EMPTY_TEXT =
  "Nenhuma entrega agora. Quando a cozinha deixar um pedido pronto, ele aparece aqui.";

/** The cash he received and has not yet handed to the cashier: what he still owes. */
export function cashHeld(orders: readonly CourierOrder[]): { cents: number; count: number } {
  let cents = 0;
  let count = 0;
  for (const order of orders) {
    if (order.status !== DONE || !order.mine || order.settled || order.cash_received === "") continue;
    cents += centsOf(order.cash_received);
    count += 1;
  }
  return { cents, count };
}

export function cashHeldText(held: { cents: number; count: number }): string {
  if (held.count === 0) return "";
  const word = held.count === 1 ? "entrega" : "entregas";
  return `Você está com ${moneyText(held.cents)} em dinheiro de ${held.count} ${word}. Entregue ao caixa para o acerto.`;
}

// ------------------------------------------------------------------------------------------------ one card

/** Opens the address in the maps app of the phone. Empty when there is no address. */
export function mapsUrl(order: Pick<CourierOrder, "address" | "zone">): string {
  const address = order.address.trim();
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** "(31) 99999-8888" -> "tel:+5531999998888". Empty if it is not a Brazilian phone. */
export function telUrl(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? `tel:+55${digits}` : "";
}

export type CashLine = { receive: string; change: string };

/** What to ask at the door: the amount, and the change to give back. Null when nothing is received in cash. */
export function cashLine(order: Pick<CourierOrder, "cash_to_receive" | "change_back">): CashLine | null {
  const receive = centsOf(order.cash_to_receive);
  if (receive === 0) return null;
  const change = centsOf(order.change_back);
  return { receive: moneyText(receive), change: change > 0 ? moneyText(change) : "" };
}

export function cashLineText(line: CashLine): string {
  return line.change
    ? `Receber ${line.receive} em dinheiro. Leve ${line.change} de troco.`
    : `Receber ${line.receive} em dinheiro (valor exato).`;
}

// ------------------------------------------------------------------------------------------------ the code

/** What the field keeps while he types: only numbers, at most four. */
export function onlyCodeDigits(raw: string): string {
  return String(raw ?? "").replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
}

export const codeIsComplete = (code: string): boolean => code.length === CODE_LENGTH;

export type DeliverResult =
  | { kind: "done"; already: boolean; cashCents: number }
  | { kind: "wrong"; message: string; attemptsLeft: number }
  | { kind: "locked"; message: string }
  | { kind: "error"; message: string }
  | { kind: "offline"; message: string };

export const OFFLINE_DELIVER =
  "Sem sinal. Não sei se a entrega foi registrada. Toque em Entreguei de novo quando o sinal voltar: não tem problema repetir.";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Turns the answer of `.../deliver` into what the screen shows. */
export function deliverResult(status: number, body: unknown): DeliverResult {
  const data = isObject(body) ? body : {};
  const message = typeof data.error === "string" && data.error ? data.error : "";
  if (status >= 200 && status < 300 && data.ok === true) {
    return { kind: "done", already: data.already === true, cashCents: centsOf(data.cash_to_hand_over) };
  }
  if (status === 423 || data.locked === true) {
    return { kind: "locked", message: message || "Código bloqueado. Avise o restaurante." };
  }
  if (data.wrong_code === true) {
    const left = Number(data.attempts_left);
    return { kind: "wrong", message, attemptsLeft: Number.isFinite(left) && left > 0 ? Math.floor(left) : 0 };
  }
  return { kind: "error", message: message || "Não consegui fechar a entrega. Tente de novo." };
}

/** What he is told after delivering. */
export function deliveredText(result: Extract<DeliverResult, { kind: "done" }>): string {
  if (result.already) return "Esta entrega já estava fechada.";
  return result.cashCents > 0
    ? `Entrega concluída. Guarde ${moneyText(result.cashCents)} do cliente para o acerto com o caixa.`
    : "Entrega concluída.";
}

// ------------------------------------------------------------------------------------------------ cash settlement (cashier)

export type CashOrder = { id: string; customer_name: string; amount: string; zone: string; delivered_at: string | null };
export type CashGroup = { courier_id: string; name: string; total: string; count: number; orders: CashOrder[] };
export type CashView = { couriers: CashGroup[]; total: string; count: number };

export const NO_CASH_TEXT = "Nenhum dinheiro de motoqueiro em aberto. Tudo acertado.";

export function selectedCents(group: CashGroup, selected: readonly string[]): number {
  return group.orders.filter((order) => selected.includes(order.id)).reduce((sum, order) => sum + centsOf(order.amount), 0);
}

export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}

export const allIds = (group: CashGroup): string[] => group.orders.map((order) => order.id);

/** What the cashier confirms: "Recebi R$ 62,50 de Ana (2 entregas)". */
export function settleLabel(group: CashGroup, selected: readonly string[]): string {
  const chosen = group.orders.filter((order) => selected.includes(order.id)).length;
  const word = chosen === 1 ? "entrega" : "entregas";
  return `Recebi ${moneyText(selectedCents(group, selected))} de ${group.name} (${chosen} ${word})`;
}

export function settledText(result: { count: number; total: string }): string {
  const word = result.count === 1 ? "entrega acertada" : "entregas acertadas";
  return `${result.count} ${word}: ${moneyText(centsOf(result.total))} no caixa.`;
}

// ------------------------------------------------------------------------------------------------ what the server sent

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Keeps only well-formed rows, so a strange answer never breaks the screen. */
export function normalizeOrders(raw: unknown): CourierOrder[] {
  if (!Array.isArray(raw)) return [];
  const orders: CourierOrder[] = [];
  for (const row of raw) {
    if (!isObject(row) || typeof row.id !== "string" || typeof row.status !== "string") continue;
    orders.push({
      id: row.id,
      customer_name: text(row.customer_name),
      phone: text(row.phone),
      address: text(row.address),
      reference: text(row.reference),
      zone: text(row.zone),
      status: row.status,
      total: text(row.total) || "0.00",
      payment_method: text(row.payment_method),
      cash_to_receive: text(row.cash_to_receive) || "0.00",
      change_for: text(row.change_for),
      change_back: text(row.change_back),
      mine: row.mine === true,
      taken_by_other: row.taken_by_other === true,
      needs_code: row.needs_code === true,
      picked_up_at: typeof row.picked_up_at === "string" ? row.picked_up_at : null,
      delivered_at: typeof row.delivered_at === "string" ? row.delivered_at : null,
      cash_received: text(row.cash_received),
      settled: row.settled === true,
    });
  }
  return orders;
}

export function normalizeCash(raw: unknown): CashView {
  const empty: CashView = { couriers: [], total: "0.00", count: 0 };
  if (!isObject(raw) || !Array.isArray(raw.couriers)) return empty;
  const couriers: CashGroup[] = [];
  for (const group of raw.couriers) {
    if (!isObject(group) || typeof group.courier_id !== "string" || !Array.isArray(group.orders)) continue;
    const orders: CashOrder[] = [];
    for (const order of group.orders) {
      if (!isObject(order) || typeof order.id !== "string") continue;
      orders.push({
        id: order.id,
        customer_name: text(order.customer_name),
        amount: text(order.amount) || "0.00",
        zone: text(order.zone),
        delivered_at: typeof order.delivered_at === "string" ? order.delivered_at : null,
      });
    }
    if (orders.length === 0) continue;
    couriers.push({
      courier_id: group.courier_id,
      name: text(group.name) || "Sem nome",
      total: text(group.total) || "0.00",
      count: orders.length,
      orders,
    });
  }
  const total = couriers.reduce((sum, group) => sum + group.orders.reduce((acc, order) => acc + centsOf(order.amount), 0), 0);
  return { couriers, total: (total / 100).toFixed(2), count: couriers.reduce((sum, group) => sum + group.count, 0) };
}
