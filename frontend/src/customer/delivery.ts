/**
 * Delivery and pickup as the customer meets them: what the restaurant offers, the CEP, the address, the phone and
 * what is sent with the order. Pure rules, no screens: tests/customer/delivery.test.mjs runs them in Node.
 * Keep this file free of imports from other project files.
 *
 * The server decides the fee, the region and the minimum order (backend/delivery.py) and ignores what the phone
 * says about them. The numbers shown here are only a preview of what the server will charge, taken from its own
 * answer to "delivery to this CEP?". The checks below only save a round trip and say what is missing in words.
 */

export type Mode = "retirada" | "entrega";

export type PublicZone = {
  name: string;
  fee: string | number;
  min_order: string | number;
  eta_minutes: number | null;
};

/** GET /api/companies/<id>/delivery */
export type DeliveryInfo = {
  pickup: boolean;
  delivery: boolean;
  /** Delivery was turned off for now, with regions registered. */
  paused: boolean;
  zones: PublicZone[];
};

/** GET /api/companies/<id>/delivery/quote?cep= */
export type Quote =
  | { available: true; zone: string; fee: string | number; min_order: string | number; eta_minutes: number | null }
  | { available: false; reason?: string; message: string };

export type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  reference: string;
};

export const EMPTY_ADDRESS: Address = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  reference: "",
};

/** Same limits as the server. */
export const ADDRESS_LIMITS = { street: 120, number: 20, complement: 60, neighborhood: 80, city: 80, reference: 120 };

// ------------------------------------------------------------------------------------- what is offered

/**
 * The ways to receive the order the customer may pick between. Empty = nothing to pick: a table order, a
 * restaurant without delivery (the order is sent as it always was), or a screen that could not load the answer.
 */
export function offeredModes(info: DeliveryInfo | null | undefined, hasTable: boolean): Mode[] {
  if (hasTable || !info || !info.delivery) return [];
  return info.pickup ? ["retirada", "entrega"] : ["entrega"];
}

/** What is really selected: the choice when it is still offered, otherwise the first offer (pickup first). */
export function effectiveMode(choice: Mode | null, offered: Mode[]): Mode | null {
  if (offered.length === 0) return null;
  return choice && offered.includes(choice) ? choice : offered[0];
}

export const MODE_LABELS: Record<Mode, string> = {
  retirada: "Retirar no local",
  entrega: "Receber em casa",
};

/** Words for the top of the order slip. */
export function whereLabel(mode: Mode | null, tableNumber: number | null): string {
  if (tableNumber) return `Mesa ${tableNumber}`;
  if (mode === "entrega") return "Entrega";
  if (mode === "retirada") return "Retirada";
  return "Pedido";
}

// ------------------------------------------------------------------------------------------ CEP, phone

export const cepDigits = (text: string) => text.replace(/\D/g, "").slice(0, 8);

/** "30140071" -> "30140-071" while typing: never more than 8 digits. */
export function maskCep(text: string): string {
  const digits = cepDigits(text);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export const hasFullCep = (text: string) => cepDigits(text).length === 8;

/** Brazilian phone typed or pasted: only digits, without the country code 55. */
export function phoneDigits(text: string): string {
  let digits = text.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.slice(0, 11);
}

/** "31999998888" -> "(31) 99999-8888", also while typing. */
export function maskPhone(text: string): string {
  const d = phoneDigits(text);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const rest = d.slice(2);
  const cut = d.length === 11 ? 5 : 4;
  return rest.length > cut ? `(${d.slice(0, 2)}) ${rest.slice(0, cut)}-${rest.slice(cut)}` : `(${d.slice(0, 2)}) ${rest}`;
}

/** Same rule as the server: DDD from 11 to 99, 10 or 11 digits, and 11 digits means a mobile (starts with 9). */
export function phoneIsValid(text: string): boolean {
  const d = phoneDigits(text);
  if (d.length !== 10 && d.length !== 11) return false;
  if (d.slice(0, 2) < "11") return false;
  return d.length === 10 || d[2] === "9";
}

// ------------------------------------------------------------------------------------------ the quote

const toCents = (value: string | number | null | undefined): number => {
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
};

/** The fee in cents the server announced for this CEP; zero when there is no valid quote (or the fee is free). */
export function feeCents(quote: Quote | null | undefined): number {
  return quote && quote.available ? toCents(quote.fee) : 0;
}

export function minOrderCents(quote: Quote | null | undefined): number {
  return quote && quote.available ? toCents(quote.min_order) : 0;
}

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** The dishes alone must reach the minimum order of the region (the fee does not count). */
export function minimumProblem(quote: Quote | null | undefined, subtotalCents: number): string | null {
  if (!quote || !quote.available) return null;
  const min = minOrderCents(quote);
  if (min <= subtotalCents) return null;
  return `O pedido mínimo para ${quote.zone} é ${money(min)}. Faltam ${money(min - subtotalCents)}: adicione mais itens ou escolha retirar.`;
}

/** What the CEP answer says, in one line under the field. */
export function quoteLine(quote: Quote | null | undefined): string {
  if (!quote) return "";
  if (!quote.available) return quote.message;
  const fee = toCents(quote.fee);
  const parts = [`Entregamos em ${quote.zone}.`, fee === 0 ? "Entrega grátis." : `Taxa de entrega ${money(fee)}.`];
  if (quote.eta_minutes) parts.push(`Prazo de cerca de ${quote.eta_minutes} min.`);
  return parts.join(" ");
}

// ------------------------------------------------------------------------------------ address and order

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The first thing missing or wrong for a delivery, in words, or null when the order can go. The server checks
 * the same and has the last word.
 */
export function deliveryProblem(input: {
  name: string;
  address: Address;
  phone: string;
  quote: Quote | null | undefined;
  subtotalCents: number;
  /** The answer for the CEP did not come (no internet): there is no fee to show. */
  quoteFailed?: boolean;
}): string | null {
  const { address } = input;
  if (!oneLine(input.name)) return "Escreva o seu nome para a entrega.";
  if (!hasFullCep(address.cep)) return "Escreva o CEP com 8 números para ver a taxa.";
  if (!input.quote && input.quoteFailed) return "Não deu para conferir o CEP. Confira a internet e toque em Tentar de novo, perto do CEP.";
  if (!input.quote) return "Estou conferindo o CEP. Espere um instante e envie de novo.";
  if (!input.quote.available) return input.quote.message;
  if (!oneLine(address.street)) return "Escreva a rua.";
  if (!oneLine(address.number)) return "Escreva o número da casa ou do prédio (use S/N se não tiver).";
  if (!oneLine(address.neighborhood)) return "Escreva o bairro.";
  for (const key of ["street", "number", "complement", "neighborhood", "city", "reference"] as const) {
    if (oneLine(address[key]).length > ADDRESS_LIMITS[key]) return `Endereço: texto grande demais em ${LABELS[key]}.`;
  }
  if (!phoneIsValid(input.phone)) return "Escreva um telefone com DDD, como (31) 99999-8888, para o entregador avisar.";
  return minimumProblem(input.quote, input.subtotalCents);
}

const LABELS = {
  street: "rua",
  number: "número",
  complement: "complemento",
  neighborhood: "bairro",
  city: "cidade",
  reference: "ponto de referência",
} as const;

/** The fields sent with the order (createOrder). A table order and an old-style order send nothing. */
export type OrderExtras = {
  order_type?: Mode;
  address?: Record<string, string>;
  phone?: string;
};

export function orderExtras(mode: Mode | null, address: Address, phone: string): OrderExtras {
  if (mode === "retirada") return { order_type: "retirada" };
  if (mode !== "entrega") return {};
  const sent: Record<string, string> = { cep: cepDigits(address.cep) };
  for (const key of ["street", "number", "complement", "neighborhood", "city", "reference"] as const) {
    const text = oneLine(address[key]);
    if (text) sent[key] = text;
  }
  return { order_type: "entrega", address: sent, phone: phoneDigits(phone) };
}

/** "Rua das Flores, 120 · apto 3 · Centro" for the slip. */
export function describeAddress(address: Partial<Record<string, unknown>> | null | undefined): string {
  if (!address) return "";
  const text = (key: string) => (typeof address[key] === "string" ? oneLine(address[key] as string) : "");
  const street = [text("street"), text("number")].filter(Boolean).join(", ");
  return [street, text("complement"), text("neighborhood"), text("city")].filter(Boolean).join(" · ");
}

/**
 * The server answers delivery problems in clear Portuguese ("O pedido mínimo para Centro é R$ 20,00"): show them as
 * they are. Any other error keeps the generic text the caller already has.
 */
export function deliveryErrorMessage(serverMessage: string | null | undefined, mode: Mode | null): string | null {
  if (mode === null) return null;
  const text = String(serverMessage ?? "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const known = ["entrega", "retirada", "cep", "endereço", "endereco", "telefone", "pedido mínimo", "pedido minimo", "região", "regiao"];
  return known.some((word) => lower.includes(word)) ? text : null;
}

/** "entrega" / "retirada" as the server stored them; anything else (mesa, balcao, an old order) is no mode. */
export function modeOfOrder(type: unknown): Mode | null {
  return type === "entrega" || type === "retirada" ? type : null;
}
