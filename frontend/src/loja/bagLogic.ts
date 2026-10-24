/**
 * A sacola, versão nova: a comanda do cliente (pratos, escolhas, total com a taxa), como receber, o nome, o endereço
 * de entrega e o pagamento. Só conta, sem React nem rede: tests/novo/bagLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado. Cada regra é a da tela antiga (customer/CartSheet, cart, delivery, payment, labels): quem decide a
 * taxa, a região, o pedido mínimo e o preço de cada prato é o servidor. A tela só mostra o que ele anunciou e poupa a
 * ida e volta dizendo, em palavras, o que falta.
 */
import {
  cartTotalCents,
  cashProblem,
  lineKey,
  lineTotalCents,
  parseMoneyInput,
  toOrderItems,
  type CartLine,
} from "../customer/cart.ts";
import {
  MODE_LABELS,
  deliveryProblem,
  feeCents,
  hasFullCep,
  maskCep,
  maskPhone,
  orderExtras,
  quoteLine,
  whereLabel,
  type Address,
  type Mode,
  type OrderExtras,
  type Quote,
} from "../customer/delivery.ts";
import { cleanCustomerName, orderCustomerName } from "../customer/labels.ts";
import { chosenText } from "../customer/options.ts";
import { availableMethods, paymentNote, type PayMethod } from "../customer/payment.ts";
import type { Bag, BagDelivery, BagLine } from "../novo/types.ts";

export type BagInput = {
  cart: readonly CartLine[];
  /** Quem entrou pelo QR da mesa. */
  tableNumber: number | null;
  /** O QR trouxe uma mesa que o servidor não conhece. */
  tableLost: boolean;
  /** As formas de receber que o restaurante oferece e a que está valendo (vazio e null: nada a escolher). */
  offered: readonly Mode[];
  mode: Mode | null;
  /** A entrega está pausada agora (o restaurante tem regiões, mas desligou por enquanto). */
  deliveryPaused: boolean;
  quote: Quote | null;
  quoting: boolean;
  quoteFailed: boolean;
  address: Address;
  phone: string;
  /** O endereço da tela veio da memória deste aparelho. */
  remembered: boolean;
  name: string;
  /** A forma de pagar que está valendo (já passou por `effectiveMethod`). */
  payment: PayMethod;
  /** O restaurante cadastrou chave Pix: só então o Pix é oferecido. */
  pixOn: boolean;
  /** O que a pessoa digitou em "vou pagar com". */
  paid: string;
  /** A frase de "não está recebendo pedidos agora" (`closedState`), ou null quando está aberto. */
  closed: string | null;
  /** O prato da linha ainda existe no cardápio? Só então "Mudar opções" aparece. */
  editable: (line: CartLine) => boolean;
  /** Avisos que a tela guarda por conta própria (ex.: "Pizza acabou e saiu do seu pedido."). */
  extraNotices?: readonly string[];
};

export const EMPTY_BAG_TEXT = "Seu pedido está vazio. Volte ao cardápio e toque no prato que quiser.";
export const TABLE_LOST_TEXT = "Não encontramos esta mesa. Se o envio não funcionar, chame o atendente.";
export const DELIVERY_PAUSED_TEXT = "A entrega está pausada agora. Você pode retirar no local.";
export const CEP_HINT = "Digite o CEP para ver a taxa e o prazo.";
export const CEP_CHECKING = "Conferindo o CEP…";
export const CEP_FAILED = "Não deu para conferir o CEP. Confira a internet.";

/** Entrega é só para quem não está na mesa (a mesa nunca entrega). */
const isDelivery = (input: Pick<BagInput, "mode" | "tableNumber">): boolean => input.mode === "entrega" && !input.tableNumber;

/** O total em centavos: os pratos mais a taxa que o servidor anunciou para o CEP (só na entrega). */
export function totalCentsOf(input: Pick<BagInput, "cart" | "mode" | "tableNumber" | "quote">): number {
  const subtotal = cartTotalCents([...input.cart]);
  return subtotal + (isDelivery(input) ? feeCents(input.quote) : 0);
}

/** "R$ 6,00" não pode quebrar entre o "R$" e o número no fim da linha: o espaço vira um espaço que não quebra. */
const noBreakMoney = (text: string): string => text.replace(/R\$ (?=\d)/g, "R$\u00a0");

function deliveryOf(input: BagInput): BagDelivery {
  const full = hasFullCep(input.address.cep);
  let quote: BagDelivery["quote"] = null;
  if (full && input.quoting) quote = { text: CEP_CHECKING, tone: "wait" };
  else if (full && input.quoteFailed) quote = { text: CEP_FAILED, tone: "fail" };
  else if (full && input.quote) quote = { text: noBreakMoney(quoteLine(input.quote)), tone: input.quote.available ? "ok" : "no" };
  const { address } = input;
  return {
    cep: maskCep(address.cep),
    quote,
    hint: full ? undefined : CEP_HINT,
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    reference: address.reference,
    phone: maskPhone(input.phone),
    remembered: input.remembered,
  };
}

export function bagViewOf(input: BagInput): Bag {
  const cart = [...input.cart];
  const delivering = isDelivery(input);
  const subtotal = cartTotalCents(cart);
  const fee = delivering ? feeCents(input.quote) : 0;
  // A taxa só aparece quando o servidor confirmou que entrega naquele CEP.
  const showFee = delivering && input.quote?.available === true;

  const lines: BagLine[] = cart.map((line) => ({
    key: lineKey(line),
    name: line.name,
    detail: chosenText(line.options) || undefined,
    note: line.note || undefined,
    quantity: line.quantity,
    total: lineTotalCents(line) / 100,
    canEdit: Boolean(line.options?.length) && input.editable(line),
  }));

  const modes =
    input.offered.length >= 2
      ? input.offered.map((mode) => ({ id: mode, label: MODE_LABELS[mode], on: input.mode === mode }))
      : [];

  const notices = [
    ...(input.tableLost ? [TABLE_LOST_TEXT] : []),
    ...(input.closed ? [input.closed] : []),
    ...(input.extraNotices ?? []),
  ];

  const total = subtotal + fee;
  return {
    where: whereLabel(input.mode, input.tableNumber),
    lines,
    emptyText: EMPTY_BAG_TEXT,
    subtotal: subtotal / 100,
    fee: showFee ? fee / 100 : null,
    total: total / 100,
    notices,
    modes,
    pausedNote: input.deliveryPaused && !input.tableNumber && input.offered.length === 0 ? DELIVERY_PAUSED_TEXT : null,
    nameLabel: delivering ? "Seu nome" : "Seu nome (opcional)",
    name: input.name,
    delivery: delivering ? deliveryOf(input) : null,
    payments: availableMethods(input.pixOn).map((method) => ({ id: method.value, label: method.label, on: input.payment === method.value })),
    cash: input.payment === "dinheiro" ? { value: input.paid, exact: (total / 100).toFixed(2).replace(".", ",") } : null,
    paymentNote: paymentNote(input.payment),
  };
}

/**
 * A primeira coisa que impede o envio, em palavras, ou null quando o pedido pode ir. A ordem é a da tela antiga: o
 * restaurante fechado, depois a entrega (nome, CEP, endereço, telefone, pedido mínimo) e depois o dinheiro (com quanto
 * vai pagar). O servidor confere de novo e tem a última palavra.
 */
export function bagProblem(input: BagInput): string | null {
  if (input.cart.length === 0) return EMPTY_BAG_TEXT;
  if (input.closed) return input.closed;

  const subtotal = cartTotalCents([...input.cart]);
  if (isDelivery(input)) {
    const problem = deliveryProblem({
      name: input.name,
      address: input.address,
      phone: input.phone,
      quote: input.quote,
      subtotalCents: subtotal,
      quoteFailed: input.quoteFailed,
    });
    if (problem) return problem;
  }

  if (input.payment === "dinheiro") return cashProblem(totalCentsOf(input), input.paid);
  return null;
}

/** O que vai ao servidor quando o pedido é enviado: nunca preço, só códigos e quantidades (o servidor calcula). */
export type OrderPayload = {
  customerName: string;
  items: ReturnType<typeof toOrderItems>;
  payment: PayMethod;
  /** Com quanto vai pagar, em reais, só no dinheiro; 0 nos outros. */
  change: number;
  extras: OrderExtras;
};

export function orderPayloadOf(input: BagInput): OrderPayload {
  const cart = [...input.cart];
  return {
    customerName: orderCustomerName(input.name),
    items: toOrderItems(cart),
    payment: input.payment,
    change: input.payment === "dinheiro" ? (parseMoneyInput(input.paid) ?? 0) / 100 : 0,
    // Pedido de mesa e restaurante sem entrega não mandam nada a mais (como sempre foi).
    extras: orderExtras(input.tableNumber ? null : input.mode, input.address, input.phone),
  };
}

/** O nome que o aparelho guarda para o próximo pedido. */
export const rememberedNameOf = (name: string): string => cleanCustomerName(name);
