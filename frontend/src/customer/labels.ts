/** Words the customer reads: order status, errors, name and voice helpers. */

// Same values as ../service/orderStatus.ts (a test checks they still match).
const PENDING = "PENDING_PAYMENT";
const PREPARING = "em preparo";
const DONE = "concluido";

export const STEP_LABELS = ["Enviado", "Em preparo", "Pronto"] as const;

export type CustomerStatus = {
  headline: string;
  hint: string;
  /** 0 = sent, 1 = preparing, 2 = ready. */
  step: 0 | 1 | 2;
  done: boolean;
};

export function customerStatus(status: string, tableNumber: number | null): CustomerStatus {
  if (status === PREPARING) {
    return {
      headline: "Em preparo",
      hint: "A cozinha está preparando o seu pedido.",
      step: 1,
      done: false,
    };
  }
  if (status === DONE) {
    return {
      headline: "Pronto!",
      hint: tableNumber ? `Já já chega na mesa ${tableNumber}.` : "Pode retirar no balcão.",
      step: 2,
      done: true,
    };
  }
  if (status === PENDING) {
    return {
      headline: "Pedido enviado",
      hint: "Estamos esperando o restaurante aceitar.",
      step: 0,
      done: false,
    };
  }
  return { headline: "Pedido enviado", hint: "", step: 0, done: false };
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

/** Friendly text for the few errors the order endpoint can return. */
export function orderErrorMessage(serverMessage: string | null | undefined): string {
  const text = String(serverMessage ?? "").toLowerCase();
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
