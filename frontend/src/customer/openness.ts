/**
 * Whether the customer can order now, and what to tell him when not. Pure logic: tests/customer/openness.test.mjs
 * runs it in Node.
 *
 * The server decides (backend/hours.py and the plan): the menu only shows what it says. Three reasons close the menu,
 * from the most to the least specific:
 *  - the owner paused the orders ("Estamos com uma pausa nos pedidos...") - it applies to the table too;
 *  - the restaurant cannot take orders (its plan, never explained to the customer);
 *  - it is outside its opening hours ("Fechado agora. Abre hoje às 18h.") - never for someone sitting at a table.
 * A server that does not send `hours` (an older one) closes nothing.
 */

import { CLOSED_NOTICE, isClosed } from "./labels.ts";
import type { Company, Product } from "./types.ts";
import type { CartLine } from "./cart.ts";

export const PAUSED_NOTICE = "Estamos com uma pausa nos pedidos. Tente de novo em alguns minutos.";

export type Closed = {
  kind: "paused" | "off" | "hours";
  /** Shown above the menu and when the customer tries to send. */
  message: string;
};

export function closedState(company: Pick<Company, "accepting_orders" | "hours">, fromTable: boolean): Closed | null {
  const hours = company.hours;
  if (hours?.paused === true) return { kind: "paused", message: PAUSED_NOTICE };
  if (isClosed(company.accepting_orders)) return { kind: "off", message: CLOSED_NOTICE };
  if (!fromTable && hours?.configured === true && hours.open_now === false) {
    const said = String(hours.message ?? "").trim() || "Fechado agora.";
    return { kind: "hours", message: `${said} Você pode ver o cardápio e pedir quando abrir.` };
  }
  return null;
}

/** A dish that ran out stays on the menu, marked. Only an explicit `true` counts. */
export function isSoldOut(product: Pick<Product, "sold_out">): boolean {
  return product.sold_out === true;
}

/**
 * The cart without the dishes that ran out while the customer was choosing, and their names (for the notice). The
 * server refuses an order with a sold-out dish anyway; this just spares the customer the failed try.
 */
export function dropSoldOut(
  cart: CartLine[],
  products: Pick<Product, "id" | "sold_out">[]
): { cart: CartLine[]; removed: string[] } {
  const gone = new Set(products.filter(isSoldOut).map((product) => product.id));
  if (gone.size === 0) return { cart, removed: [] };
  const removed: string[] = [];
  const kept = cart.filter((line) => {
    if (!gone.has(line.id)) return true;
    if (!removed.includes(line.name)) removed.push(line.name);
    return false;
  });
  return removed.length === 0 ? { cart, removed } : { cart: kept, removed };
}

/** "Pizza acabou e saiu do seu pedido." / "Pizza e Suco acabaram e saíram do seu pedido." */
export function soldOutNotice(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} acabou e saiu do seu pedido.`;
  const list = `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return `${list} acabaram e saíram do seu pedido.`;
}
