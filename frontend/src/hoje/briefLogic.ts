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
import { waitTone } from "../novo/format.ts";
import { momentOf, plainPhraser, type Phraser } from "../novo/phrasing.ts";
import {
  SAY_BRIEF_COOKING,
  SAY_BRIEF_GREETING,
  SAY_BRIEF_HINT_ORDERS,
  SAY_BRIEF_LATE,
  SAY_BRIEF_NONE_WAITING,
  SAY_BRIEF_NO_CALLS,
  SAY_BRIEF_NO_ORDERS,
  SAY_BRIEF_NO_SALES,
  SAY_BRIEF_ON_THE_WAY,
  SAY_BRIEF_WAITING,
  noSalesBankFor,
  salesBankFor,
} from "../novo/voiceCopy.ts";
import { greetingOf, hourOf, todayOf, weekdayOf, type TodayOrder } from "./todayLogic.ts";

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
  /** Quem escolhe a forma de dizer cada frase (sem repetir, mais curta com o uso). Sem ele, sempre a forma de referência. */
  phrase?: Phraser;
  /** Esta pessoa abre a tela de pedidos? Só então o fim da fala sugere "diga pedidos". */
  canOpenOrders?: boolean;
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

/**
 * A fala inteira, em frases curtas, na ordem do que mais pesa: pedidos, mesas, vendas. O que muda de uma vez para outra
 * é só o jeito de dizer (`phrase`); os fatos são os mesmos. Quando o pedido mais antigo já passou de 20 minutos (a cor
 * vermelha da comanda) a fala puxa a atenção para ele, em vez de só contar. As vendas usam o jeito da hora ("até agora"
 * de manhã, "no dia" à noite). O "diga pedidos" do fim só vem enquanto a pessoa ainda está aprendendo.
 */
export function briefOf(input: BriefInput): string {
  const phrase = input.phrase ?? plainPhraser;
  const today = todayOf({
    name: input.name,
    role: input.role,
    orders: input.orders ?? [],
    calls: input.calls ?? [],
    business: input.business,
    now: input.now,
  });
  const moment = momentOf(hourOf(input.now));
  const parts: string[] = [phrase.say(SAY_BRIEF_GREETING, greetingOf(input.name, input.now), weekdayOf(input.now))];

  if (input.orders === null) {
    parts.push(phrase.say(SAY_BRIEF_NO_ORDERS));
  } else {
    if (today.waiting === 0) {
      parts.push(phrase.say(SAY_BRIEF_NONE_WAITING));
    } else {
      const oldest = spokenMinutes(today.oldestMinutes);
      const late = oldest !== "" && waitTone(today.oldestMinutes) === "late";
      parts.push(late ? phrase.say(SAY_BRIEF_LATE, today.waiting, oldest) : phrase.say(SAY_BRIEF_WAITING, today.waiting, oldest));
    }
    if (today.cooking > 0) parts.push(phrase.say(SAY_BRIEF_COOKING, today.cooking));
    if (today.onTheWay > 0) parts.push(phrase.say(SAY_BRIEF_ON_THE_WAY, today.onTheWay));
    // O Pix para conferir sai da mesma conta do Hoje (só quem confere Pix, só o do último dia).
    for (const item of today.todo) if (item.kind === "pix") parts.push(`${item.title}, ${item.note}.`);
  }

  if (canOpenTable(input.role)) {
    if (input.calls === null) parts.push(phrase.say(SAY_BRIEF_NO_CALLS));
    else if (input.calls.length > 0) parts.push(`${barTitle(input.calls.length)}.`);
  }

  if (isManager(input.role)) {
    if (input.business === null) parts.push(phrase.say(SAY_BRIEF_NO_SALES));
    else if (today.sales) {
      parts.push(
        today.sales.orders === 0
          ? phrase.say(noSalesBankFor(moment))
          : phrase.say(salesBankFor(moment), moneyText(today.sales.total), today.sales.orders),
      );
    }
  }

  if (input.canOpenOrders && input.orders !== null && today.waiting > 0) {
    const hint = phrase.say(SAY_BRIEF_HINT_ORDERS);
    if (hint) parts.push(hint);
  }

  return parts.join(" ");
}
