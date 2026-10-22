/**
 * A cozinha nova: transforma os pedidos que o servidor manda (os mesmos da tela antiga) nas comandas da tela nova.
 * Só conta, sem React nem rede: tests/novo/kitchenLogic.test.mjs roda isto no Node.
 *
 * As palavras do fluxo (Aceitar pedido, Pedido pronto, Pronto para entrega, Saiu para entrega) NÃO são inventadas
 * aqui: vêm de `service/orderStatus.ts`, a mesma regra que o servidor aceita (backend/order_status.py).
 */
import { shortOrderCode } from "../service/format.ts";
import { handlingView, type HandlingOrder } from "../service/orderHandling.ts";
import { STATUS_PENDING, STATUS_PREPARING, STATUS_READY, nextAction } from "../service/orderStatus.ts";
import type { Tab, Ticket } from "../novo/types.ts";

export type KitchenItem = {
  name: string;
  quantity: number;
  options?: { group?: string; name: string; price?: number | string }[] | null;
  /** O que o cliente escreveu para a cozinha ("sem cebola"). */
  note?: string | null;
};

export type KitchenOrder = HandlingOrder & {
  id: string;
  status: string;
  created_at: string;
  items?: KitchenItem[] | null;
};

/** As três etapas que a cozinha enxerga. Pedido já entregue ou a caminho não é assunto de cozinha. */
export type KitchenTabId = "new" | "doing" | "ready";

const TABS: { id: KitchenTabId; label: string; status: string }[] = [
  { id: "new", label: "Novos", status: STATUS_PENDING },
  { id: "doing", label: "Fazendo", status: STATUS_PREPARING },
  { id: "ready", label: "Prontos", status: STATUS_READY },
];

/** O que escrever quando uma etapa está vazia: diz o que fazer ou o que esperar, sem enfeite. */
const EMPTY: Record<KitchenTabId, string> = {
  new: "Nenhum pedido novo. Quando um cliente pedir, a comanda aparece aqui e o aparelho avisa.",
  doing: "Nada no fogo agora. Aceite um pedido novo para começar.",
  ready: "Nenhum pedido esperando o entregador.",
};

export function emptyText(tab: KitchenTabId): string {
  return EMPTY[tab];
}

export function isKitchenTab(value: string): value is KitchenTabId {
  return TABS.some((tab) => tab.id === value);
}

const tabStatus = (tab: KitchenTabId): string => TABS.find((entry) => entry.id === tab)!.status;

/** Minutos inteiros desde que o pedido entrou. Data estragada ou no futuro vira 0: nunca inventa espera. */
export function minutesSince(createdAt: string | null | undefined, now: number): number {
  const start = new Date(createdAt ?? "").getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60000));
}

const created = (order: KitchenOrder): number => {
  const value = new Date(order.created_at).getTime();
  return Number.isNaN(value) ? 0 : value;
};

/** Quem esperou mais vem primeiro. */
function oldestFirst(orders: KitchenOrder[]): KitchenOrder[] {
  return [...orders].sort((a, b) => created(a) - created(b));
}

/** As três abas com a contagem de cada uma. */
export function kitchenTabs(orders: readonly KitchenOrder[]): Tab[] {
  return TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    count: orders.filter((order) => order.status === tab.status).length,
  }));
}

/** A aba que abre sozinha: a primeira que tem pedido, na ordem Novos, Fazendo, Prontos. */
export function firstTabWithOrders(orders: readonly KitchenOrder[]): KitchenTabId {
  const counts = kitchenTabs(orders);
  const found = counts.find((tab) => tab.count > 0);
  return (found?.id as KitchenTabId | undefined) ?? "new";
}

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** "Grande, bacon extra": o que o cliente escolheu no prato, sem preço. */
function detailOf(item: KitchenItem): string | undefined {
  const names = (item.options ?? []).map((option) => clean(option.name)).filter(Boolean);
  return names.length ? names.join(", ") : undefined;
}

/**
 * Observação do cliente para a cozinha. Se só um prato tem observação, vai a frase pura; se são vários, cada frase
 * leva o nome do prato para ninguém errar de quem é.
 */
export function noteOf(items: readonly KitchenItem[]): string | undefined {
  const withNote = items.filter((item) => clean(item.note));
  if (withNote.length === 0) return undefined;
  if (withNote.length === 1 && items.length === 1) return clean(withNote[0].note);
  return withNote.map((item) => `${clean(item.name)}: ${clean(item.note)}`).join(" · ");
}

/** O botão grande da comanda e para qual status ele leva; null quando a cozinha não tem mais o que fazer. */
export function advanceOf(order: KitchenOrder): { label: string; next: string } | null {
  const next = nextAction(order.status, handlingView(order).kind);
  return next ? { label: next.label, next: next.next } : null;
}

/** As linhas da comanda: quantidade, nome e escolhas. Serve à cozinha e ao caixa, para os dois lerem a mesma coisa. */
export function linesOf(items: readonly KitchenItem[]): Ticket["lines"] {
  return items.map((item, index) => ({
    // O servidor sempre manda a quantidade; se faltar, um prato conta como 1 e nunca some da comanda.
    qty: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    name: clean(item.name) || `Item ${index + 1}`,
    detail: detailOf(item),
  }));
}

export function ticketOf(order: KitchenOrder, now: number): Ticket {
  const items = order.items ?? [];
  const step = advanceOf(order);
  return {
    id: order.id,
    number: shortOrderCode(order.id),
    where: handlingView(order).title,
    minutes: minutesSince(order.created_at, now),
    lines: linesOf(items),
    note: noteOf(items),
    action: step?.label ?? "",
  };
}

/** As comandas de uma aba, a mais antiga primeiro. */
export function ticketsFor(orders: readonly KitchenOrder[], tab: KitchenTabId, now: number): Ticket[] {
  const status = tabStatus(tab);
  return oldestFirst(orders.filter((order) => order.status === status)).map((order) => ticketOf(order, now));
}
