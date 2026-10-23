/**
 * "Como está o dia?": a frase que a bolinha de voz lê em voz alta. Junta o que o Hoje já mostra (pedidos esperando, na
 * cozinha, a caminho, Pix para conferir, mesas chamando, vendas do dia) numa fala curta. Só conta, sem React nem rede:
 * tests/novo/briefLogic.test.mjs roda isto no Node. Quem busca os números é `painel/readBriefing.ts`.
 *
 * Honestidade: cada pedaço vem do servidor ou não entra. **Busca que falhou nunca vira "nenhum pedido"** nem "sem
 * vendas": a fala diz que não conseguiu ler aquilo. Vendas só para dono e gerente; mesas só para quem vai a uma mesa.
 */
import type { BusinessView } from "../business/businessLogic.ts";
import { moneyText } from "../business/businessLogic.ts";
import type { PanelCall } from "../mesa/callsLogic.ts";
import { barTitle } from "../mesa/callsLogic.ts";
import { canOpenTable, isManager } from "../nav/navLogic.ts";
import {
  BRIEF_COOKING,
  BRIEF_NONE_WAITING,
  BRIEF_NO_CALLS,
  BRIEF_NO_ORDERS,
  BRIEF_NO_SALES,
  BRIEF_NO_SALES_YET,
  BRIEF_ON_THE_WAY,
  BRIEF_SALES,
  BRIEF_WAITING,
} from "../novo/copy.ts";
import { greetingOf, todayOf, type TodayOrder } from "./todayLogic.ts";

export type BriefInput = {
  name: string | null | undefined;
  role: string | null | undefined;
  /** Os pedidos; `null` quando a busca falhou ou não veio uma lista. */
  orders: readonly TodayOrder[] | null;
  /** As mesas chamando; `null` quando a busca falhou. */
  calls: readonly PanelCall[] | null;
  /** As vendas do dia; `null` quando a busca falhou (só se pergunta para dono e gerente). */
  business: Pick<BusinessView, "summary" | "hours"> | null;
  now: number;
};

/** "3 minutos", "1 minuto", "1 hora e 5 minutos", "2 horas": como se fala, não como se escreve. */
export function spokenMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const total = Math.floor(minutes);
  if (total < 1) return "menos de 1 minuto";
  if (total < 60) return total === 1 ? "1 minuto" : `${total} minutos`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const hoursText = hours === 1 ? "1 hora" : `${hours} horas`;
  if (rest === 0) return hoursText;
  return `${hoursText} e ${rest === 1 ? "1 minuto" : `${rest} minutos`}`;
}

/** A fala inteira, em frases curtas, na ordem do que mais pesa: pedidos, mesas, vendas. */
export function briefOf(input: BriefInput): string {
  const today = todayOf({
    name: input.name,
    role: input.role,
    orders: input.orders ?? [],
    calls: input.calls ?? [],
    business: input.business,
    now: input.now,
  });
  const parts: string[] = [`${greetingOf(input.name, input.now)}.`];

  if (input.orders === null) {
    parts.push(BRIEF_NO_ORDERS);
  } else {
    parts.push(today.waiting === 0 ? BRIEF_NONE_WAITING : BRIEF_WAITING(today.waiting, spokenMinutes(today.oldestMinutes)));
    if (today.cooking > 0) parts.push(BRIEF_COOKING(today.cooking));
    if (today.onTheWay > 0) parts.push(BRIEF_ON_THE_WAY(today.onTheWay));
    // O Pix para conferir sai da mesma conta do Hoje (só quem confere Pix, só o do último dia).
    for (const item of today.todo) if (item.kind === "pix") parts.push(`${item.title}, ${item.note}.`);
  }

  if (canOpenTable(input.role)) {
    if (input.calls === null) parts.push(BRIEF_NO_CALLS);
    else if (input.calls.length > 0) parts.push(`${barTitle(input.calls.length)}.`);
  }

  if (isManager(input.role)) {
    if (input.business === null) parts.push(BRIEF_NO_SALES);
    else if (today.sales) parts.push(today.sales.orders === 0 ? BRIEF_NO_SALES_YET : BRIEF_SALES(moneyText(today.sales.total), today.sales.orders));
  }

  return parts.join(" ");
}
