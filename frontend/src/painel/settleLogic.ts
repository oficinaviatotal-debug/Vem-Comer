/**
 * O acerto do caixa, versão nova: o dinheiro que cada motoqueiro recebeu na porta e ainda não entregou ao caixa. Só conta,
 * sem React nem rede: tests/novo/settleLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou. Quanto cada motoqueiro deve, quais entregas entram e quem pode acertar é decisão
 * do servidor (backend/courier.py); as contas de dinheiro vêm de `courier/courierLogic` (a mesma da tela antiga, testada).
 * Aqui só se marca o que o caixa conferiu, se escreve a frase e se guarda o primeiro dos dois toques de confirmação.
 *
 * Dinheiro pede cuidado dobrado: tudo vem MARCADO (o caixa tira o que o motoqueiro não trouxe), o botão de acertar pede um
 * segundo toque para o valor que ele está vendo, e se a marcação mudar entre os dois toques o primeiro se perde. Antes de
 * mandar, a tela olha o servidor de novo: se alguma entrega marcada já foi acertada ou mudou de valor, não manda e avisa.
 */
import {
  centsOf,
  moneyText,
  selectedCents,
  settleLabel,
  toggleId,
  type CashGroup,
  type CashView,
} from "../courier/courierLogic.ts";
import { SETTLE_ARMED, SETTLE_EMPTY, SETTLE_LOADING, SETTLE_QUIET } from "../novo/copy.ts";
import type { SettleGroup, SettleRow, SettleView } from "../novo/types.ts";
import { formatTime } from "../service/format.ts";

export type { SettleGroup, SettleRow, SettleView };
export type { CashGroup, CashView };

/** Por quanto tempo o primeiro toque espera o segundo (como o botão de confirmar da tela antiga). */
export const ARM_MS = 4000;

const clean = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** As entregas que continuam marcadas: todas, menos as que o caixa tirou (`left`). */
export function markedIds(group: CashGroup, left: readonly string[]): string[] {
  return group.orders.map((order) => order.id).filter((id) => !left.includes(id));
}

/** Tirar ou pôr de volta uma entrega. */
export const toggleLeft = (left: readonly string[], id: string): string[] => toggleId(left, id);

/** A chave do primeiro toque: o motoqueiro e as entregas marcadas. Mexer na marcação muda a chave e desarma o botão. */
export function armKey(group: CashGroup, left: readonly string[]): string {
  return `${group.courier_id}|${markedIds(group, left).join(",")}`;
}

/**
 * O que o caixa está vendo ainda vale no servidor? Cada entrega marcada precisa continuar em aberto com o mesmo valor
 * (outro caixa pode ter acertado, ou o motoqueiro ter sido corrigido). Entrega NOVA do mesmo motoqueiro não muda nada:
 * só as marcadas são mandadas.
 */
export function settleCheck(group: CashGroup, left: readonly string[], fresh: CashView): "same" | "changed" {
  const now = fresh.couriers.find((entry) => entry.courier_id === group.courier_id);
  if (!now) return "changed";
  for (const order of group.orders) {
    if (left.includes(order.id)) continue;
    const found = now.orders.find((entry) => entry.id === order.id);
    if (!found || centsOf(found.amount) !== centsOf(order.amount)) return "changed";
  }
  return "same";
}

function rowOf(order: CashGroup["orders"][number], left: readonly string[]): SettleRow {
  return {
    id: order.id,
    label: [clean(order.customer_name) || "Cliente", clean(order.zone), formatTime(order.delivered_at)].filter(Boolean).join(" · "),
    amount: moneyText(centsOf(order.amount)),
    checked: !left.includes(order.id),
  };
}

export type SettleInput = {
  /** Null até a primeira resposta do servidor: a tela diz que está abrindo, e não que tudo está acertado. */
  cash: CashView | null;
  left: readonly string[];
  /** A chave do botão que já levou o primeiro toque, ou null. */
  armed: string | null;
  error: string;
  notice: string;
};

export function groupOf(group: CashGroup, left: readonly string[], armed: string | null): SettleGroup {
  const chosen = markedIds(group, left);
  return {
    id: group.courier_id,
    name: clean(group.name) || "Sem nome",
    total: moneyText(centsOf(group.total)),
    rows: group.orders.map((order) => rowOf(order, left)),
    marked: moneyText(selectedCents(group, chosen)),
    count: chosen.length,
    button: chosen.length > 0 ? settleLabel(group, chosen) : "",
    armed: chosen.length > 0 && armed === armKey(group, left),
  };
}

export function settleViewOf(input: SettleInput): SettleView {
  const cash = input.cash;
  const groups = (cash?.couriers ?? []).map((group) => groupOf(group, input.left, input.armed));
  const count = groups.length;
  const total = cash && cash.count > 0 ? moneyText(centsOf(cash.total)) : "";
  const asking = groups.find((group) => group.armed);
  let sub = SETTLE_LOADING;
  if (cash) sub = count === 0 ? SETTLE_QUIET : `${total} com ${count} ${count === 1 ? "motoqueiro" : "motoqueiros"}`;
  return {
    sub,
    live: asking ? `${SETTLE_ARMED}. ${asking.button}.` : input.notice || sub,
    total,
    groups,
    empty: cash && count === 0 ? SETTLE_EMPTY : "",
    error: input.error,
    notice: input.notice,
  };
}
