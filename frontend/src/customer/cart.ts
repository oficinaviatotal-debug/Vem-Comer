/**
 * Cart logic for the customer screens (pure, no browser APIs).
 *
 * Money is handled in cents so that R$ 19,90 x 3 is exactly R$ 59,70. The
 * server recomputes every price from the database, so the cart only sends
 * product ids and quantities, never prices.
 */

export type CartLine = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type CartProduct = {
  id: string;
  name: string;
  price: number | string;
};

/** The server accepts 1 to 100; a table rarely needs more than this per dish. */
export const MAX_PER_ITEM = 50;

export function toCents(value: number | string | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function addToCart(cart: CartLine[], product: CartProduct): CartLine[] {
  const found = cart.find((line) => line.id === product.id);
  if (!found) {
    return [
      ...cart,
      { id: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1 },
    ];
  }
  return cart.map((line) =>
    line.id === product.id
      ? { ...line, quantity: Math.min(MAX_PER_ITEM, line.quantity + 1) }
      : line
  );
}

/** One less of a dish; the line disappears when it reaches zero. */
export function decrementItem(cart: CartLine[], id: string): CartLine[] {
  return cart
    .map((line) => (line.id === id ? { ...line, quantity: line.quantity - 1 } : line))
    .filter((line) => line.quantity > 0);
}

export function removeLine(cart: CartLine[], id: string): CartLine[] {
  return cart.filter((line) => line.id !== id);
}

export function quantityOf(cart: CartLine[], id: string): number {
  return cart.find((line) => line.id === id)?.quantity ?? 0;
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartTotalCents(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + toCents(line.price) * line.quantity, 0);
}

export function lineTotalCents(line: CartLine): number {
  return toCents(line.price) * line.quantity;
}

/** Payload the API expects for the items. No prices on purpose. */
export function toOrderItems(cart: CartLine[]): { id: string; quantity: number }[] {
  return cart.map((line) => ({ id: line.id, quantity: line.quantity }));
}

/**
 * Reads what a person typed for "I will pay with": "50", "50,00", "R$ 50,5",
 * "1.250,00". Returns cents, or null when it is not a usable amount.
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",")) {
    // Brazilian style: dots group thousands, the comma is the decimal mark.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/**
 * Cash orders must say how much the customer will hand over, and it has to
 * cover the total (the server enforces the same rule). Returns a message for
 * the customer, or null when everything is fine.
 */
export function cashProblem(totalCents: number, paidText: string): string | null {
  const paid = parseMoneyInput(paidText);
  if (paid === null) return "Digite com quanto você vai pagar. Por exemplo: 50";
  if (paid < totalCents) return "O valor precisa ser igual ou maior que o total do pedido.";
  return null;
}
