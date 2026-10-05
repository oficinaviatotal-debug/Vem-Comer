/**
 * How payment is shown to the customer and to the restaurant.
 *
 * Pure rules, no screens: tests/customer/payment.test.mjs runs them in Node.
 * Keep this file free of imports from other project files.
 *
 * Pix works like this: the restaurant types its own Pix key once, the order
 * screen shows a "Pix Copia e Cola" code for the exact total, and a person at
 * the restaurant taps "Pagamento recebido" after seeing the money arrive in
 * the bank app. Money goes straight to the restaurant.
 */

export type PayMethod = "pix" | "cartao" | "dinheiro";

export const PAY_LABELS: Record<PayMethod, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

/** Roles that may tell the system "the money arrived". The server checks it again. */
const CONFIRM_ROLES = ["OWNER", "MANAGER", "CASHIER"];

/** The payment options the cart offers. Pix only appears when the restaurant set a key. */
export function availableMethods(pixOn: boolean): { value: PayMethod; label: string }[] {
  const all: PayMethod[] = pixOn ? ["pix", "cartao", "dinheiro"] : ["cartao", "dinheiro"];
  return all.map((value) => ({ value, label: PAY_LABELS[value] }));
}

/**
 * What is really selected. Until the customer chooses, Pix is the suggestion when it
 * exists. A Pix choice made before the restaurant turned Pix off falls back to card.
 */
export function effectiveMethod(choice: PayMethod | null, pixOn: boolean): PayMethod {
  if (choice === "pix") return pixOn ? "pix" : "cartao";
  if (choice) return choice;
  return pixOn ? "pix" : "cartao";
}

/** The sentence under the payment tiles. */
export function paymentNote(method: PayMethod): string {
  if (method === "pix") {
    return "Depois de enviar o pedido, o código Pix aparece aqui para você pagar.";
  }
  return "Você acerta o pagamento com o atendente.";
}

export type OrderPaymentView =
  | { kind: "pix-due" }
  | { kind: "paid" }
  | { kind: "at-table"; text: string };

function isMethod(value: unknown): value is PayMethod {
  return value === "pix" || value === "cartao" || value === "dinheiro";
}

/** What the order slip shows about payment. */
export function orderPaymentView(method: unknown, status: unknown): OrderPaymentView {
  const paid = String(status ?? "").toUpperCase() === "PAID";
  if (paid) return { kind: "paid" };
  if (method === "pix") return { kind: "pix-due" };
  const label = isMethod(method) ? PAY_LABELS[method].toLowerCase() : "";
  return {
    kind: "at-table",
    text: label ? `Pagamento em ${label}: você acerta com o atendente.` : "Você acerta o pagamento com o atendente.",
  };
}

/**
 * The slip refreshes until there is nothing left to wait for. A Pix order that is
 * ready but not yet marked as paid keeps refreshing, so "Pagamento recebido" shows up.
 */
export function keepPolling(orderDone: boolean, method: unknown, paymentStatus: unknown): boolean {
  if (!orderDone) return true;
  return orderPaymentView(method, paymentStatus).kind === "pix-due";
}

export type PaymentChip = { label: string; tone: "ok" | "wait" | "info" };

/** The small label on each order card in the restaurant panel. */
export function adminPaymentChip(method: unknown, status: unknown): PaymentChip {
  const paid = String(status ?? "").toUpperCase() === "PAID";
  const name = isMethod(method) ? PAY_LABELS[method] : "Pagamento";
  if (paid) return { label: `${name} pago`, tone: "ok" };
  if (method === "pix") return { label: "Pix: aguardando", tone: "wait" };
  return { label: `${name}: receber`, tone: "info" };
}

/** Whether the panel shows "Pagamento recebido" for this order and this person. */
export function canConfirmPayment(role: string | null | undefined, status: unknown): boolean {
  if (String(status ?? "").toUpperCase() === "PAID") return false;
  return CONFIRM_ROLES.includes(String(role ?? "").toUpperCase());
}
