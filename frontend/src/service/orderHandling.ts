/**
 * What the kitchen and the counter need to know about HOW an order leaves the restaurant: at the table, picked up,
 * or delivered (and where). Pure logic, no React: tests/ui/orderHandling.test.mjs runs it in Node.
 *
 * The server already sends these fields on every admin order (order_type, delivery_*, customer_phone); an order made
 * before delivery existed has none of them and reads as a counter order.
 */
import { describeAddress, maskCep, maskPhone, modeOfOrder, phoneDigits } from "../customer/delivery.ts";

export type HandlingOrder = {
  table_number?: string | null;
  order_type?: string | null;
  delivery_fee?: number | string | null;
  delivery_zone?: string | null;
  delivery_address?: Record<string, unknown> | null;
  customer_phone?: string | null;
  /** Who took the delivery (a login of the restaurant with the role Entregador); empty until someone takes it. */
  courier_name?: string | null;
  status?: string | null;
};

export type HandlingKind = "mesa" | "entrega" | "retirada" | "balcao";

export type HandlingView = {
  kind: HandlingKind;
  /** The big word on the slip: "Mesa 5", "Entrega", "Retirada", "Balcão". */
  title: string;
  /** "Rua das Flores, 120 · apto 3 · Centro", empty unless it is a delivery. */
  address: string;
  /** "CEP 30110-000 · Região Centro", empty unless it is a delivery. */
  region: string;
  reference: string;
  /** "(31) 99999-8888", empty when the customer left none. */
  phone: string;
  /** "tel:31999998888" so a tap calls the customer, empty when there is no phone. */
  phoneHref: string;
  /** What the server added to the total for delivery, in cents (0 = free or not a delivery). */
  feeCents: number;
  /** One line for people who read the slip without the box: "Retirar no balcão", "Entregar em ...". */
  hint: string;
  /** Who has the delivery: "Com o entregador Ana", "Entregue por Ana"; empty unless a courier took it. */
  courierLine: string;
};

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** The line about the courier on the slip of a delivery; empty when nobody took it or it is not a delivery. */
export function courierLine(order: HandlingOrder): string {
  if (handlingKind(order) !== "entrega") return "";
  const name = clean(order.courier_name);
  if (!name) return "";
  if (order.status === "concluido") return `Entregue por ${name}`;
  if (order.status === "saiu para entrega") return `Com o entregador ${name}`;
  return `Entregador: ${name}`;
}

export function handlingKind(order: HandlingOrder): HandlingKind {
  const mode = modeOfOrder(order.order_type);
  if (mode) return mode;
  return order.table_number ? "mesa" : "balcao";
}

export function handlingView(order: HandlingOrder): HandlingView {
  const kind = handlingKind(order);
  const digits = phoneDigits(clean(order.customer_phone));
  const phone = digits.length >= 10 ? maskPhone(digits) : "";
  const address = kind === "entrega" ? describeAddress(order.delivery_address) : "";

  const cep = kind === "entrega" && order.delivery_address ? maskCep(clean(order.delivery_address.cep)) : "";
  const zone = kind === "entrega" ? clean(order.delivery_zone) : "";
  const region = [cep ? `CEP ${cep}` : "", zone ? `Região ${zone}` : ""].filter(Boolean).join(" · ");
  const reference = kind === "entrega" && order.delivery_address ? clean(order.delivery_address.reference) : "";

  const feeNumber = kind === "entrega" ? Math.round(Number(order.delivery_fee) * 100) : 0;
  const feeCents = Number.isFinite(feeNumber) && feeNumber > 0 ? feeNumber : 0;

  const title =
    kind === "mesa" ? `Mesa ${order.table_number}` : kind === "entrega" ? "Entrega" : kind === "retirada" ? "Retirada" : "Balcão";

  const hint =
    kind === "entrega"
      ? address
        ? `Entregar em ${address}`
        : "Entrega sem endereço: ligue para o cliente"
      : kind === "retirada"
        ? "Cliente retira no balcão"
        : "";

  return {
    kind,
    title,
    address,
    region,
    reference,
    phone,
    phoneHref: phone ? `tel:${digits}` : "",
    feeCents,
    hint,
    courierLine: courierLine(order),
  };
}

/** Items only: the total the server stored already has the fee inside, so the slip shows total minus fee. */
export function itemsSubtotalCents(totalPrice: number | string, feeCents: number): number {
  const total = Math.round(Number(totalPrice) * 100);
  return Number.isFinite(total) ? Math.max(0, total - feeCents) : 0;
}
