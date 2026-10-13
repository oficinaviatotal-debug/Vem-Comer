/**
 * Order status words used by the backend, and what to show people.
 * The backend only accepts these values (see backend/order_status.py): "pronto" and "saiu para entrega" exist only
 * for delivery orders. Table, counter and pickup orders go: waiting -> preparing -> done.
 */

export const STATUS_PENDING = "PENDING_PAYMENT";
export const STATUS_PREPARING = "em preparo";
export const STATUS_DONE = "concluido";
/** Delivery only: the food is ready and waits for whoever takes it. */
export const STATUS_READY = "pronto";
/** Delivery only: the courier left with it. */
export const STATUS_OUT = "saiu para entrega";

/** Every status, in the order an order goes through them. */
export const ALL_STATUSES = [STATUS_PENDING, STATUS_PREPARING, STATUS_READY, STATUS_OUT, STATUS_DONE] as const;

/** `kind` is the order type ("entrega", "retirada", "mesa", "balcao"); without it the words are the generic ones. */
export function statusLabel(status: string, kind?: string | null): string {
  switch (status) {
    case STATUS_PENDING:
      return "Aguardando";
    case STATUS_PREPARING:
      return "Em preparo";
    case STATUS_READY:
      return "Pode sair";
    case STATUS_OUT:
      return "A caminho";
    case STATUS_DONE:
      return kind === "entrega" ? "Entregue" : "Pronto";
    default:
      return status;
  }
}

export type NextAction = {
  label: string;
  next: string;
  /** A shortcut for a small shop where the same person cooks and delivers: skips the "ready" step. */
  skip?: { label: string; next: string };
};

/** The one thing staff should do next with an order, or null when nothing is left. */
export function nextAction(status: string, kind?: string | null): NextAction | null {
  if (status === STATUS_PENDING) {
    return { label: "Aceitar pedido", next: STATUS_PREPARING };
  }
  if (status === STATUS_PREPARING) {
    if (kind === "entrega") {
      return {
        label: "Pronto para entrega",
        next: STATUS_READY,
        skip: { label: "Já saiu para entrega", next: STATUS_OUT },
      };
    }
    return { label: "Pedido pronto", next: STATUS_DONE };
  }
  // These two only exist for deliveries, whatever `kind` says.
  if (status === STATUS_READY) {
    return { label: "Saiu para entrega", next: STATUS_OUT };
  }
  if (status === STATUS_OUT) {
    return { label: "Entregue", next: STATUS_DONE };
  }
  return null;
}

/** The colour family of the chip: waiting, in the kitchen, on its way out, finished. */
export function statusTone(status: string): "wait" | "prep" | "go" | "done" {
  if (status === STATUS_DONE) return "done";
  if (status === STATUS_PREPARING) return "prep";
  if (status === STATUS_READY || status === STATUS_OUT) return "go";
  return "wait";
}

export function isActiveStatus(status: string): boolean {
  return status !== STATUS_DONE;
}

type Sortable = { status: string; created_at: string };

/**
 * Kitchen order: open orders first, oldest first (whoever waited longest is
 * served first); finished orders after them, newest first.
 */
export function sortForKitchen<T extends Sortable>(orders: T[]): T[] {
  const time = (order: T) => {
    const value = new Date(order.created_at).getTime();
    return Number.isNaN(value) ? 0 : value;
  };
  const open = orders
    .filter((order) => isActiveStatus(order.status))
    .sort((a, b) => time(a) - time(b));
  const done = orders
    .filter((order) => !isActiveStatus(order.status))
    .sort((a, b) => time(b) - time(a));
  return [...open, ...done];
}
