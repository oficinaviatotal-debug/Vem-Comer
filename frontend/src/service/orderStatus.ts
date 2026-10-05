/**
 * Order status words used by the backend, and what to show people.
 * The backend only accepts these three values (see update_order_status).
 */

export const STATUS_PENDING = "PENDING_PAYMENT";
export const STATUS_PREPARING = "em preparo";
export const STATUS_DONE = "concluido";

export function statusLabel(status: string): string {
  switch (status) {
    case STATUS_PENDING:
      return "Aguardando";
    case STATUS_PREPARING:
      return "Em preparo";
    case STATUS_DONE:
      return "Pronto";
    default:
      return status;
  }
}

/** The one thing staff should do next with an order, or null when nothing is left. */
export function nextAction(
  status: string
): { label: string; next: string } | null {
  if (status === STATUS_PENDING) {
    return { label: "Aceitar pedido", next: STATUS_PREPARING };
  }
  if (status === STATUS_PREPARING) {
    return { label: "Pedido pronto", next: STATUS_DONE };
  }
  return null;
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
