/** Words the customer reads: order status, errors, name and voice helpers. */

import { deliveryErrorMessage, type Mode } from "./delivery.ts";

// Same values as ../service/orderStatus.ts (a test checks they still match).
const PENDING = "PENDING_PAYMENT";
const PREPARING = "em preparo";
const READY = "pronto";
const OUT = "saiu para entrega";
const DONE = "concluido";

/** Table, counter and pickup: three steps. */
export const STEP_LABELS = ["Enviado", "Em preparo", "Pronto"] as const;
/** Delivery: "pronto" (waiting for the courier) is still the "Preparo" step; the next one is the courier leaving. */
export const DELIVERY_STEP_LABELS = ["Enviado", "Preparo", "Na rua", "Entregue"] as const;

export type CustomerStatus = {
  headline: string;
  hint: string;
  /** Position in `steps`: 0 = sent, 1 = preparing, 2 = ready (or on its way), 3 = delivered. */
  step: 0 | 1 | 2 | 3;
  /** The words under the progress bar. */
  steps: readonly string[];
  done: boolean;
};

export function customerStatus(status: string, tableNumber: number | null, orderType?: string | null): CustomerStatus {
  // "pronto" and "saiu para entrega" exist only for deliveries; a finished delivery says "Entregue".
  const delivery = status === READY || status === OUT || (orderType === "entrega" && !tableNumber);
  const steps: readonly string[] = delivery ? DELIVERY_STEP_LABELS : STEP_LABELS;

  if (status === PREPARING) {
    return {
      headline: "Em preparo",
      hint: "A cozinha está preparando o seu pedido.",
      step: 1,
      steps,
      done: false,
    };
  }
  if (status === READY) {
    return {
      headline: "Pronto!",
      hint: "Seu pedido está pronto e já vai sair para o seu endereço.",
      step: 1,
      steps,
      done: false,
    };
  }
  if (status === OUT) {
    return {
      headline: "Saiu para entrega",
      hint: "O entregador está a caminho do seu endereço.",
      step: 2,
      steps,
      done: false,
    };
  }
  if (status === DONE) {
    if (delivery) {
      return {
        headline: "Entregue!",
        hint: "Bom proveito! Se algo não chegou como esperado, fale com o restaurante.",
        step: 3,
        steps,
        done: true,
      };
    }
    return {
      headline: "Pronto!",
      hint: tableNumber ? `Já já chega na mesa ${tableNumber}.` : "Pode retirar no balcão.",
      step: 2,
      steps,
      done: true,
    };
  }
  if (status === PENDING) {
    return {
      headline: "Pedido enviado",
      hint: "Estamos esperando o restaurante aceitar.",
      step: 0,
      steps,
      done: false,
    };
  }
  return { headline: "Pedido enviado", hint: "", step: 0, steps, done: false };
}

const NAME_LIMIT = 60;

/** Removes control characters and extra spaces; keeps accents. */
export function cleanCustomerName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_LIMIT)
    .trim();
}

/** The name the kitchen sees. Naming yourself is optional. */
export function orderCustomerName(raw: string): string {
  return cleanCustomerName(raw) || "Cliente";
}

/** The menu of a restaurant that cannot take orders now. It never says why (the plan is the owner's business). */
export const CLOSED_NOTICE = "Este restaurante não está recebendo pedidos agora. Você pode ver o cardápio; tente pedir mais tarde.";

/** Only an explicit `false` from the server closes the menu. */
export function isClosed(acceptingOrders: boolean | null | undefined): boolean {
  return acceptingOrders === false;
}

/** Friendly text for the few errors the order endpoint can return. */
export function orderErrorMessage(serverMessage: string | null | undefined, mode?: Mode | null): string {
  const said = deliveryErrorMessage(serverMessage, mode ?? null);
  if (said) return said;
  const text = String(serverMessage ?? "").toLowerCase();
  if (text.includes("não está recebendo pedidos")) return CLOSED_NOTICE;
  if (text.includes("mesa")) {
    return "Não encontramos esta mesa. Chame o atendente para te ajudar.";
  }
  if (text.includes("produto") || text.includes("item")) {
    return "Algum item saiu do cardápio. Atualize a página e confira o pedido.";
  }
  if (text.includes("troco")) {
    return "Digite com quanto você vai pagar. O valor precisa cobrir o total.";
  }
  return "Não deu para enviar o pedido. Confira a internet e tente de novo.";
}

/** "buscar sushi" -> "sushi" (what the voice button hears). */
export function searchTextFromVoice(raw: string): string {
  return raw.replace(/^\s*(buscar|procurar|encontrar)\s*/i, "").trim();
}
