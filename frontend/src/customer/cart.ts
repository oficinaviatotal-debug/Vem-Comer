/**
 * Cart logic for the customer screens (pure, no browser APIs).
 *
 * Money is handled in cents so that R$ 19,90 x 3 is exactly R$ 59,70. The
 * server recomputes every price from the database, so the cart only sends
 * product ids, quantities, chosen option ids and a note, never prices.
 */

/** One option the customer chose (copied from the menu so the order slip can show it). */
export type ChosenOption = {
  id: string;
  /** Group name, e.g. "Tamanho". */
  group: string;
  name: string;
  /** Extra price in cents (never negative). */
  deltaCents: number;
};

/**
 * One line of the order. Two lines of the same dish stay apart when their options or note differ
 * ("Pizza grande" and "Pizza pequena"), so a line is identified by its `key`: the product id alone for a
 * plain dish, and the product id plus options plus note otherwise.
 */
export type CartLine = {
  /** Product id: what the server receives. */
  id: string;
  /** Line identity; missing means "the plain dish" (the key is the product id). */
  key?: string;
  name: string;
  /** Unit price in reais WITH the options included. For showing only; the server recomputes it. */
  price: number;
  quantity: number;
  options?: ChosenOption[];
  note?: string;
};

type CartProduct = {
  id: string;
  name: string;
  price: number | string;
};

export type LinePick = {
  options?: ChosenOption[];
  note?: string;
  quantity?: number;
};

/** The server accepts 1 to 100; a table rarely needs more than this per dish. */
export const MAX_PER_ITEM = 50;

export function toCents(value: number | string | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

const oneLine = (note: string | undefined): string => (note ?? "").replace(/\s+/g, " ").trim();

export function lineKey(line: { id: string; key?: string }): string {
  return line.key ?? line.id;
}

/** The plain dish keeps the product id as its key; options and a note make a different line. */
export function makeKey(productId: string, optionIds: string[], note: string | undefined): string {
  const clean = oneLine(note).toLowerCase();
  if (optionIds.length === 0 && !clean) return productId;
  return `${productId}#${[...optionIds].sort().join("+")}#${clean}`;
}

const more = (quantity: number, extra: number) => Math.min(MAX_PER_ITEM, quantity + extra);

export function addToCart(cart: CartLine[], product: CartProduct): CartLine[] {
  const found = cart.find((line) => lineKey(line) === product.id);
  if (!found) {
    return [
      ...cart,
      { id: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1 },
    ];
  }
  return cart.map((line) =>
    lineKey(line) === product.id ? { ...line, quantity: more(line.quantity, 1) } : line
  );
}

/** Adds a dish with the options and note the customer picked; the same choices add up on the same line. */
export function addConfigured(cart: CartLine[], product: CartProduct, pick: LinePick = {}): CartLine[] {
  const options = pick.options ?? [];
  const note = oneLine(pick.note);
  const key = makeKey(product.id, options.map((option) => option.id), note);
  const quantity = Math.max(1, Math.min(MAX_PER_ITEM, Math.floor(pick.quantity ?? 1)));

  if (cart.some((line) => lineKey(line) === key)) {
    return cart.map((line) =>
      lineKey(line) === key ? { ...line, quantity: more(line.quantity, quantity) } : line
    );
  }

  const extra = options.reduce((sum, option) => sum + option.deltaCents, 0);
  const line: CartLine = {
    id: product.id,
    name: product.name,
    price: (toCents(product.price) + extra) / 100,
    quantity,
  };
  if (key !== product.id) line.key = key;
  if (options.length) line.options = options;
  if (note) line.note = note;
  return [...cart, line];
}

/** Changes a line already in the order (other options, note or quantity), keeping its place when it can. */
export function replaceLine(
  cart: CartLine[],
  oldKey: string,
  product: CartProduct,
  pick: LinePick
): CartLine[] {
  const index = cart.findIndex((line) => lineKey(line) === oldKey);
  if (index < 0) return cart;
  const rest = cart.filter((line) => lineKey(line) !== oldKey);
  const rebuilt = addConfigured(rest, product, pick);
  if (rebuilt.length !== rest.length + 1) return rebuilt; // joined a line that already had these choices
  const placed = rebuilt.slice(0, -1);
  placed.splice(index, 0, rebuilt[rebuilt.length - 1]);
  return placed;
}

/** One more of a line (the + in the order slip). */
export function incrementLine(cart: CartLine[], key: string): CartLine[] {
  return cart.map((line) => (lineKey(line) === key ? { ...line, quantity: more(line.quantity, 1) } : line));
}

/**
 * One less of a line; the line disappears when it reaches zero. `key` may also be a product id (the menu's
 * "−" knows only the dish): then the last line of that dish loses one.
 */
export function decrementItem(cart: CartLine[], key: string): CartLine[] {
  let index = -1;
  cart.forEach((line, i) => {
    if (lineKey(line) === key) index = i;
  });
  if (index < 0) {
    cart.forEach((line, i) => {
      if (line.id === key) index = i;
    });
  }
  if (index < 0) return cart;
  return cart
    .map((line, i) => (i === index ? { ...line, quantity: line.quantity - 1 } : line))
    .filter((line) => line.quantity > 0);
}

export function removeLine(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((line) => lineKey(line) !== key);
}

/** How many of a dish are in the order, across all its lines (the menu card shows this). */
export function quantityOf(cart: CartLine[], id: string): number {
  return cart.filter((line) => line.id === id).reduce((sum, line) => sum + line.quantity, 0);
}

/** Writes or clears the note of a line; the line joins another one when both end up identical. */
export function setLineNote(cart: CartLine[], key: string, note: string): CartLine[] {
  const index = cart.findIndex((line) => lineKey(line) === key);
  if (index < 0) return cart;
  const line = cart[index];
  const clean = oneLine(note);
  const newKey = makeKey(line.id, (line.options ?? []).map((option) => option.id), clean);

  const updated: CartLine = { ...line };
  if (clean) updated.note = clean;
  else delete updated.note;
  if (newKey !== line.id) updated.key = newKey;
  else delete updated.key;

  const clash = cart.findIndex((other, i) => i !== index && lineKey(other) === newKey);
  if (clash < 0) return cart.map((other, i) => (i === index ? updated : other));
  return cart
    .map((other, i) => (i === clash ? { ...other, quantity: more(other.quantity, line.quantity) } : other))
    .filter((_, i) => i !== index);
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

/** What the API expects for each item: ids and quantity, plus the chosen option ids and the note when present. No prices on purpose. */
export function toOrderItems(
  cart: CartLine[]
): { id: string; quantity: number; options?: string[]; note?: string }[] {
  return cart.map((line) => {
    const item: { id: string; quantity: number; options?: string[]; note?: string } = {
      id: line.id,
      quantity: line.quantity,
    };
    if (line.options?.length) item.options = line.options.map((option) => option.id);
    if (line.note) item.note = line.note;
    return item;
  });
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
