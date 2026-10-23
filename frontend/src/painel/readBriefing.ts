import { fetchBusiness } from "../business/businessApi";
import { parsePanelCalls } from "../mesa/callsLogic";
import { isManager } from "../nav/navLogic";
import { fetchAdminOrders, fetchTableCalls } from "../service/api";
import { briefOf } from "../hoje/briefLogic";
import type { TodayOrder } from "../hoje/todayLogic";
import type { Phraser } from "../novo/phrasing";

/** Cada busca espera no máximo isto; depois a fala diz que não conseguiu ler aquilo (nunca fica esperando para sempre). */
export const BRIEF_WAIT_MS = 10000;

export function within<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("demorou")), BRIEF_WAIT_MS);
  });
  return Promise.race([work, late]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Pergunta ao servidor, na hora, como está o dia (pedidos, mesas chamando e, para dono e gerente, as vendas) e devolve a
 * fala pronta. Cada busca vale sozinha: se uma falha, a fala diz que não conseguiu ler só aquela. Nenhum dado do restaurante é guardado.
 */
export async function readBriefing(input: {
  companyId: string;
  role: string | null | undefined;
  name: string | null | undefined;
  /** Quem escolhe a forma de dizer cada frase; é o mesmo da bolinha, para a fala não repetir a da vez anterior. */
  phrase?: Phraser;
  /** Esta pessoa abre a tela de pedidos? Só então o fim da fala sugere "diga pedidos". */
  canOpenOrders?: boolean;
}): Promise<string> {
  const manager = isManager(input.role);
  const [orders, calls, business] = await Promise.allSettled([
    within(fetchAdminOrders(input.companyId)),
    within(fetchTableCalls(input.companyId)),
    manager ? within(fetchBusiness(input.companyId, "hoje")) : Promise.resolve(null),
  ]);
  return briefOf({
    name: input.name,
    role: input.role,
    // Resposta que não é uma lista nunca vira "nenhum pedido".
    orders: orders.status === "fulfilled" && Array.isArray(orders.value) ? (orders.value as TodayOrder[]) : null,
    calls: calls.status === "fulfilled" && Array.isArray(calls.value) ? parsePanelCalls(calls.value) : null,
    business: business.status === "fulfilled" ? business.value : null,
    now: Date.now(),
    phrase: input.phrase,
    canOpenOrders: input.canOpenOrders,
  });
}
