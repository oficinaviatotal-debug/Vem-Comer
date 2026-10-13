/**
 * The 4-digit code of a delivery, as the customer sees it on the slip of his order.
 * Pure logic: tests/customer/deliveryCode.test.mjs runs it in Node.
 *
 * The server draws the code when the delivery order is made and sends it only to whoever follows that order (with the
 * tracking link). The courier never receives it: he types what the customer tells him at the door.
 */

export const CODE_LENGTH = 4;

export const CODE_TITLE = "Código de entrega";

export const CODE_HINT =
  "Passe estes 4 números ao entregador só quando ele chegar e você receber o seu pedido. É isso que confirma a entrega. Não envie o código por mensagem a ninguém.";

/** The code to show, or "" when there is none (not a delivery, already delivered, or an older order). */
export function deliveryCodeToShow(order: {
  order_type?: string | null;
  status?: string | null;
  delivery_code?: unknown;
}): string {
  if (order.order_type !== "entrega") return "";
  if (order.status === "concluido") return "";
  const code = order.delivery_code;
  return typeof code === "string" && /^[0-9]{4}$/.test(code) ? code : "";
}

/** "4821" -> "4 8 2 1": read aloud one number at a time by the screen reader. */
export const spokenCode = (code: string): string => code.split("").join(" ");
