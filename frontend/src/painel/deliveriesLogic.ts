/**
 * A tela de entregas do painel, versão nova: transforma as entregas que o servidor manda (as mesmas da tela antiga do
 * entregador) nos cartões da tela nova. Só conta, sem React nem rede: tests/novo/deliveriesLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou. Quem pode pegar, se o código está certo, quantas tentativas sobram e quanto
 * dinheiro está em aberto é decisão do servidor (backend/courier.py). Aqui só se agrupa, se escreve a frase e se monta o
 * link: as contas de dinheiro, telefone, mapa e código vêm de `courier/courierLogic`, a mesma da tela antiga e testada.
 *
 * Uma correção em relação à tela antiga: "ainda com você" só vale para o dinheiro do próprio entregador. Para o gerente,
 * que também vê as entregas fechadas por outros, a frase diz "ainda com o motoqueiro".
 */
import {
  COURIER_POLL_MS,
  cashHeld,
  cashHeldText,
  cashLine,
  centsOf,
  groupOrders,
  headline,
  mapsUrl,
  moneyText,
  stageOf,
  telUrl,
  type CourierOrder,
  type Groups,
} from "../courier/courierLogic.ts";
import {
  DELIVERIES_CASH_DONE,
  DELIVERIES_DELIVER,
  DELIVERIES_EMPTY,
  DELIVERIES_LOADING,
  DELIVERIES_NO_ADDRESS,
  DELIVERIES_PICK,
  DELIVERIES_QUIET,
  DELIVERIES_TAB,
} from "../novo/copy.ts";
import type { DeliveriesView, DeliveryCard, Tab } from "../novo/types.ts";
import { formatTime, shortOrderCode } from "../service/format.ts";

export type { DeliveriesView, DeliveryCard };
export type { CourierOrder };

/** De quanto em quanto tempo a tela pergunta as entregas (a mesma da tela antiga: uma entrega pode ficar pronta a qualquer hora). */
export const DELIVERIES_POLL_MS = COURIER_POLL_MS;

export type DeliveriesTabId = "ready" | "route" | "done";

const TAB_IDS: DeliveriesTabId[] = ["ready", "route", "done"];

export const isDeliveriesTab = (id: unknown): id is DeliveriesTabId => TAB_IDS.includes(id as DeliveriesTabId);

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** As entregas de cada aba: o que espera o entregador, o que está na rua (as dele primeiro) e o que já foi entregue. */
export function ordersOfDeliveriesTab(groups: Groups, tab: DeliveriesTabId): CourierOrder[] {
  if (tab === "ready") return groups.ready;
  if (tab === "route") return [...groups.going, ...groups.other];
  return groups.done;
}

export function deliveriesTabs(groups: Groups): Tab[] {
  return TAB_IDS.map((id) => ({ id, label: DELIVERIES_TAB[id], count: ordersOfDeliveriesTab(groups, id).length }));
}

/**
 * A aba que abre sozinha: a que tem trabalho. Quem já está com um pedido na rua vê a rua; senão, o que espera para
 * pegar; senão, o que os outros levam. Sem nada, "Para pegar" (é onde o próximo aparece).
 */
export function firstDeliveriesTab(groups: Groups): DeliveriesTabId {
  if (groups.going.length > 0) return "route";
  if (groups.ready.length > 0) return "ready";
  if (groups.other.length > 0) return "route";
  return "ready";
}

/** O botão grande do momento. Entrega de outro motoqueiro e entrega fechada não têm botão. */
export function actionOf(order: Pick<CourierOrder, "status" | "mine" | "taken_by_other">): "pick" | "deliver" | null {
  const stage = stageOf(order);
  if (stage === "ready") return "pick";
  if (stage === "going") return "deliver";
  return null;
}

function moneyOf(order: CourierOrder): DeliveryCard["money"] {
  const cents = centsOf(order.cash_received);
  if (cents === 0) return null;
  const amount = moneyText(cents);
  if (order.settled) return { text: `Dinheiro ${amount}: ${DELIVERIES_CASH_DONE}`, tone: "settled" };
  return { text: `Dinheiro ${amount}: ${order.mine ? "ainda com você" : "ainda com o motoqueiro"}`, tone: "owe" };
}

/** "O pedido de Ana está com você. Boa entrega!": o que a tela diz depois de pegar. */
export function pickedText(order: Pick<CourierOrder, "customer_name">): string {
  return `O pedido de ${clean(order.customer_name) || "cliente"} está com você. Boa entrega!`;
}

export function cardOf(order: CourierOrder): DeliveryCard {
  const stage = stageOf(order);
  const who = clean(order.customer_name) || "Cliente";
  const number = shortOrderCode(order.id);
  const action = actionOf(order);
  const line = cashLine(order);
  const zone = clean(order.zone);
  const reference = clean(order.reference);
  const hands = stage === "ready" || stage === "going";
  return {
    id: order.id,
    number,
    who,
    address: clean(order.address) || DELIVERIES_NO_ADDRESS,
    sub: [zone ? `Região: ${zone}` : "", reference ? `Referência: ${reference}` : ""].filter(Boolean),
    stage,
    cash: hands && line ? { main: `Receber ${line.receive} em dinheiro`, sub: line.change ? `Leve ${line.change} de troco` : "Valor exato, sem troco" } : null,
    // O telefone e o mapa só vão para quem está com a entrega ou vai pegar; a de outro motoqueiro fica só para ver.
    phoneHref: hands ? telUrl(order.phone) : "",
    mapHref: hands ? mapsUrl(order) : "",
    action: action === "pick" ? DELIVERIES_PICK : action === "deliver" ? DELIVERIES_DELIVER : "",
    actionSpoken:
      action === "pick"
        ? `${DELIVERIES_PICK} o pedido de ${who}, ${number}`
        : action === "deliver"
          ? `${DELIVERIES_DELIVER} o pedido de ${who}, ${number}`
          : "",
    needsCode: order.needs_code,
    time: stage === "done" ? formatTime(order.delivered_at) : "",
    money: stage === "done" ? moneyOf(order) : null,
  };
}

export type DeliveriesInput = {
  /** Null até a primeira resposta do servidor: a tela diz que está abrindo, e não que não há entregas. */
  orders: readonly CourierOrder[] | null;
  chosen: string | null;
  error: string;
  notice: string;
};

export function deliveriesViewOf(input: DeliveriesInput): DeliveriesView {
  const loaded = input.orders !== null;
  const groups = groupOrders(input.orders ?? []);
  const active: DeliveriesTabId = isDeliveriesTab(input.chosen) ? input.chosen : firstDeliveriesTab(groups);
  const cards = ordersOfDeliveriesTab(groups, active).map(cardOf);
  return {
    sub: loaded ? headline(groups) || DELIVERIES_QUIET : DELIVERIES_LOADING,
    held: cashHeldText(cashHeld(input.orders ?? [])),
    tabs: deliveriesTabs(groups),
    active,
    cards,
    empty: loaded ? DELIVERIES_EMPTY[active] : "",
    error: input.error,
    notice: input.notice,
  };
}
