/**
 * O acompanhamento do pedido, versão nova: o andamento (enviado, em preparo, pronto ou entregue), a comanda, o código de
 * entrega, o Pix a pagar e a avaliação. Só conta, sem React nem rede: tests/novo/trackingLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado. Cada regra é a da tela antiga (OrderTracking, PixPayment, OrderFeedback, labels, payment,
 * deliveryCode): o andamento, o valor, o código de entrega e o Pix são do servidor; a tela só os mostra.
 */
import { describeAddress, maskPhone, modeOfOrder, whereLabel } from "../customer/delivery.ts";
import { CODE_HINT, CODE_TITLE, deliveryCodeToShow, spokenCode } from "../customer/deliveryCode.ts";
import { customerStatus } from "../customer/labels.ts";
import { keepPolling, orderPaymentView } from "../customer/payment.ts";
import type { OrderView } from "../customer/types.ts";
import { shortOrderCode } from "../service/format.ts";
import type { Option, Pix, Rating, Track, TrackLine, TrackPayment } from "../novo/types.ts";

// As frases fixas moram em novo/copy.ts: a tela e esta conta leem as mesmas.
export {
  OFFLINE_NOTE,
  PIX_AFTER_TEXT,
  PIX_COPIED_TEXT,
  PIX_COPY_MANUAL_TEXT,
  PIX_ERROR_TEXT,
  PIX_MISSING_TEXT,
  PIX_STEPS,
  RATING_THANKS,
  copiedText,
} from "../novo/copy.ts";

/** De quanto em quanto tempo a tela pergunta ao servidor como está o pedido. */
export const POLL_MS = 5000;

export const LOADING_TEXT = "Buscando o seu pedido…";
export const OFFLINE_FIRST_TEXT = "Sem internet. Vamos tentar de novo.";

const toNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** O pedido como a tela mostra. `tableNumber`: quem entrou pelo QR da mesa. `offline`: a última busca falhou. */
export function trackOf(order: OrderView, tableNumber: number | null, offline: boolean): Track {
  const status = customerStatus(order.status, tableNumber, order.order_type);
  const mode = tableNumber ? null : modeOfOrder(order.order_type);

  let handling: Track["handling"] = null;
  if (mode === "entrega") {
    const address = describeAddress(order.delivery_address);
    const zone =
      order.delivery_zone && !address.toLowerCase().includes(order.delivery_zone.toLowerCase()) ? ` (${order.delivery_zone})` : "";
    handling = {
      title: "Entrega em:",
      text: `${address || "o endereço que você informou"}${zone}`,
      phone: order.customer_phone ? maskPhone(order.customer_phone) : undefined,
    };
  } else if (mode === "retirada") {
    handling = { title: "Retirada no local.", text: "Avise o atendente que o pedido é seu." };
  }

  const code = mode === "entrega" ? deliveryCodeToShow(order) : "";
  const lines: TrackLine[] = (order.items ?? []).map((item, index) => {
    const detail = (item.options ?? [])
      .map((option) => option.name)
      .filter(Boolean)
      .join(", ");
    const note = (item.note ?? "").trim();
    return {
      key: `${item.name}-${index}`,
      quantity: item.quantity,
      name: item.name,
      detail: detail || undefined,
      note: note || undefined,
      total: toNumber(item.total),
    };
  });

  const pay = orderPaymentView(order.payment_method, order.payment_status, mode === "entrega" ? "entrega" : null);
  const payment: TrackPayment =
    pay.kind === "paid"
      ? { kind: "paid", title: "Pagamento recebido", text: "Obrigado! O restaurante confirmou o seu pagamento." }
      : pay.kind === "pix-due"
        ? { kind: "pix" }
        : { kind: "later", text: pay.text };

  return {
    code: shortOrderCode(order.id),
    where: whereLabel(mode, tableNumber),
    customerName: (order.customer_name ?? "").trim() || undefined,
    handling,
    status: {
      headline: status.headline,
      hint: status.hint,
      // Pedido pronto ou entregue: todas as etapas ficam marcadas como feitas.
      steps: status.steps.map((label, index) => ({
        label,
        state: status.done || index < status.step ? "done" : index === status.step ? "current" : "todo",
      })),
      done: status.done,
    },
    deliveryCode: code ? { title: CODE_TITLE, digits: code.split(""), spoken: spokenCode(code), hint: CODE_HINT } : null,
    lines,
    fee: mode === "entrega" ? toNumber(order.delivery_fee) : null,
    total: toNumber(order.total_price),
    payment,
    offline,
  };
}

/** O que fazer depois de cada resposta do servidor sobre o pedido. */
export type PollStep = "again" | "stop" | "gone";

/**
 * Chegou o pedido: continua perguntando enquanto há o que esperar (andamento, ou Pix ainda não confirmado) e para quando
 * não há mais. Falhou: 401 ou 404 quer dizer que o servidor não conhece mais o pedido (link vencido), então esquece;
 * qualquer outra falha (sem internet) tenta de novo.
 */
export function afterPoll(result: { order: OrderView } | { failedWith: number | null }): PollStep {
  if ("failedWith" in result) return result.failedWith === 401 || result.failedWith === 404 ? "gone" : "again";
  const { order } = result;
  return keepPolling(customerStatus(order.status, null).done, order.payment_method, order.payment_status) ? "again" : "stop";
}

// ------------------------------------------------------------------------------------------------ Pix

/** O resultado do toque em "Copiar código Pix". */
export const copiedOutcome = (done: boolean): Pix["copied"] => (done ? "ok" : "manual");

/** A imagem do QR Pix vem do servidor como `data:image/png;base64,…`. Só essa forma (e de tamanho razoável) vira imagem na tela; qualquer outra some. */
export const QR_IMAGE_MAX = 200_000;
export function safeQrImage(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length > QR_IMAGE_MAX) return undefined;
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw) ? raw : undefined;
}

/** O que a busca do código Pix devolveu para a tela (404: o restaurante já não tem Pix; outra falha: tenta de novo). */
export function pixOf(
  state: Pix["state"],
  code: { payload: string; qr_data_url: string; receiver_name: string; amount: string | number } | null,
  copied: Pix["copied"],
): Pix {
  if (state !== "ready" || !code) return { state, copied };
  return { state, amount: toNumber(code.amount), receiver: code.receiver_name, payload: code.payload, qr: safeQrImage(code.qr_data_url), copied };
}

/** O erro da busca do Pix vira o estado da tela. */
export const pixStateOfError = (status: number | null): "missing" | "error" => (status === 404 ? "missing" : "error");

// ------------------------------------------------------------------------------------------ avaliação

export const FOOD_RATINGS = ["ótima", "boa", "regular", "ruim"] as const;
export const SERVICE_RATINGS = ["ótimo", "bom", "regular", "ruim"] as const;
export const COMMENT_MAX = 500;
export const RATING_ERROR = "Não deu para enviar a avaliação. Tente de novo.";

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const optionsOf = (values: readonly string[], chosen: string): Option[] =>
  values.map((value) => ({ id: value, label: capital(value), on: chosen === value }));

export function ratingOf(input: { sent: boolean; food: string; service: string; comment: string; busy: boolean; error: string | null }): Rating {
  return {
    sent: input.sent,
    food: optionsOf(FOOD_RATINGS, input.food),
    service: optionsOf(SERVICE_RATINGS, input.service),
    comment: input.comment,
    canSend: Boolean(input.food && input.service) && !input.busy,
    busy: input.busy,
    error: input.error,
  };
}

/**
 * Quem pede a avaliação: uma só por visita, no pedido mais novo que já está pronto e ainda não foi avaliado.
 * `orderIds` vem do mais novo para o mais antigo.
 */
export function ratingTarget(orderIds: readonly string[], isDone: (id: string) => boolean, wasRated: (id: string) => boolean): string | undefined {
  return orderIds.find((id) => isDone(id) && !wasRated(id));
}
