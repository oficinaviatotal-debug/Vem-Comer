/**
 * O "Hoje" do dono, versão nova: junta o que o painel já sabe (pedidos, mesas chamando, vendas do dia) nos números
 * que a tela nova mostra. Só conta, sem React nem rede: tests/novo/todayLogic.test.mjs roda isto no Node.
 *
 * Nada é estimado. Cada número vem da mesma regra da tela antiga (nav/navLogic.ts) e das mesmas contas do servidor
 * (backend/insights.py). Onde o servidor não tem número, a tela diz isso em vez de preencher o vazio.
 */
import { moneyText, type BusinessView } from "../business/businessLogic.ts";
import { formatWaiting, type PanelCall } from "../mesa/callsLogic.ts";
import {
  STATUS,
  canConfirmPix,
  firstName,
  greeting,
  isManager,
  isPixToCheck,
  oldestWait,
  shortcutsFor,
  type OrderLite,
} from "../nav/navLogic.ts";
import type { GuideItem, Sales, Shortcut, TodoItem, Today } from "../novo/types.ts";

export type TodayOrder = OrderLite & { total_price?: number | string | null };

export type TodayInput = {
  name: string | null | undefined;
  role: string | null | undefined;
  orders: readonly TodayOrder[];
  /** As chamadas abertas das mesas, já lidas por `parsePanelCalls`. */
  calls: readonly PanelCall[];
  /** As vendas do dia; null enquanto não chegaram ou quando quem olha não vê vendas. */
  business: Pick<BusinessView, "summary" | "hours"> | null;
  /** Frase de erro das vendas, quando a busca falhou e não há número antigo para mostrar. */
  businessError?: string | null;
  /** O que o servidor já confirmou do restaurante, para a lista "O que falta". Sem isto, ou com `null` em cada campo, a lista fica vazia. */
  setup?: SetupFacts | null;
  now: number;
};

/**
 * Fatos do restaurante, cada um só quando o servidor respondeu. `null` quer dizer "não sei" (a busca falhou ou ainda não voltou): nunca vira "falta".
 */
export type SetupFacts = {
  /** Quantos pratos o cardápio tem. */
  products: number | null;
  /** Quantos desses pratos estão sem foto. */
  withoutPhoto: number | null;
  /** Quantas mesas estão cadastradas. */
  tables: number | null;
  /** Se a chave Pix já está cadastrada. */
  pix: boolean | null;
};

export const NO_FACTS: SetupFacts = { products: null, withoutPhoto: null, tables: null, pix: null };

/** Quantos itens a resposta do servidor tem; `null` se ela não é uma lista. */
export function countOf(list: unknown): number | null {
  return Array.isArray(list) ? list.length : null;
}

/** Quantos pratos da lista não têm foto (`thumb_url` vazio ou ausente); `null` se a resposta não é uma lista. */
export function withoutPhotoOf(list: unknown): number | null {
  if (!Array.isArray(list)) return null;
  return list.filter((item) => {
    const thumb = (item as { thumb_url?: unknown } | null)?.thumb_url;
    return typeof thumb !== "string" || thumb.trim() === "";
  }).length;
}

const MAX_GUIDE = 3;

/**
 * "O que falta": o que o sistema diz ao dono, em ordem, para o restaurante poder vender. Só dono e gerente, só com fato confirmado.
 * Cada passo diz o que falta, como resolver e leva à tela certa; quando nada falta, não diz nada (não finge que está tudo pronto).
 */
export function guideOf(role: string | null | undefined, facts: SetupFacts | null | undefined): GuideItem[] {
  if (!isManager(role) || !facts) return [];
  const items: GuideItem[] = [];
  if (facts.products === 0) {
    items.push({
      id: "menu",
      title: "Seu cardápio está vazio",
      note: "Tire uma foto do cardápio, fale os pratos ou comece de um modelo.",
      action: "Montar",
      view: "assistente",
    });
  }
  if (facts.pix === false) {
    items.push({
      id: "pix",
      title: "Você ainda não recebe Pix pelo sistema",
      note: "Cadastre a sua chave. O cliente paga pelo celular e o dinheiro vai para a sua conta.",
      action: "Cadastrar",
      view: "pagamento",
    });
  }
  if (facts.tables === 0) {
    items.push({
      id: "tables",
      title: "Nenhuma mesa cadastrada",
      note: "Cadastre as mesas e imprima o QR Code. Se você só entrega, pode deixar assim.",
      action: "Cadastrar",
      view: "mesas",
    });
  }
  if (facts.withoutPhoto !== null && facts.withoutPhoto > 0 && (facts.products ?? 0) > 0) {
    const n = facts.withoutPhoto;
    items.push({
      id: "photos",
      title: n === 1 ? "1 prato sem foto" : `${n} pratos sem foto`,
      note: "A foto ajuda o cliente a escolher. Toque para pôr.",
      action: "Pôr fotos",
      view: "produtos",
    });
  }
  return items.slice(0, MAX_GUIDE);
}

/** O restaurante vive no horário de Brasília; o servidor conta as horas assim, então a tela também. */
const ZONE = "America/Sao_Paulo";

/** Hora cheia (0 a 23) em Brasília. */
export function hourOf(now: number): number {
  const part = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: ZONE })
    .formatToParts(new Date(now))
    .find((entry) => entry.type === "hour");
  const hour = Number(part?.value);
  return Number.isInteger(hour) ? hour % 24 : 0;
}

/** "Quarta-feira, 21 de outubro". */
export function dateLineOf(now: number): string {
  const text = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE }).format(
    new Date(now),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Bom dia, João" (ou só "Bom dia" quando não há nome). */
export function greetingOf(name: string | null | undefined, now: number): string {
  const hello = greeting(hourOf(now));
  const first = firstName(name);
  return first ? `${hello}, ${first}` : hello;
}

/** Os nomes das telas do painel para onde os dois botões fixos do Hoje levam (os mesmos da navegação atual). */
export const VIEWS = { orders: "pedidos", numbers: "dashboard", deliveries: "entregas", tables: "mesas" } as const;

const MIN_BARS = 6;

/**
 * As barras de pedidos por hora: da primeira hora com venda (ou da hora de agora, se for antes) até agora, com pelo
 * menos seis barras para o gráfico não virar um pingo. Sem nenhuma venda não há barra nenhuma.
 */
export function salesOf(view: Pick<BusinessView, "summary" | "hours">, now: number): Sales {
  const nowHour = hourOf(now);
  const rows = Array.from({ length: 24 }, (_, hour) => view.hours.find((row) => row.hour === hour)?.orders ?? 0);
  const active = rows.map((orders, hour) => (orders > 0 ? hour : -1)).filter((hour) => hour >= 0);
  const base = {
    total: Number.isFinite(Number(view.summary.revenue)) ? Number(view.summary.revenue) : 0,
    orders: Number.isFinite(Number(view.summary.orders)) ? Number(view.summary.orders) : 0,
    averageTicket:
      view.summary.avg_ticket !== null && Number.isFinite(Number(view.summary.avg_ticket)) ? Number(view.summary.avg_ticket) : null,
  };
  if (active.length === 0) return { ...base, hours: [], hoursFrom: nowHour, nowIndex: -1 };

  let first = Math.min(active[0], nowHour);
  let last = Math.max(active[active.length - 1], nowHour);
  while (last - first + 1 < MIN_BARS && (first > 0 || last < 23)) {
    if (first > 0) first -= 1;
    if (last - first + 1 < MIN_BARS && last < 23) last += 1;
  }
  return { ...base, hours: rows.slice(first, last + 1), hoursFrom: first, nowIndex: nowHour - first };
}

const MAX_CALLS_SHOWN = 4;

/** O que o dono precisa fazer agora: atender as mesas que chamam e conferir os Pix. */
export function todoOf(input: Pick<TodayInput, "role" | "orders" | "calls" | "now">): TodoItem[] {
  const items: TodoItem[] = input.calls.slice(0, MAX_CALLS_SHOWN).map((call) => ({
    id: call.id,
    kind: "call" as const,
    title: call.text,
    note: call.repeats > 0 ? `${formatWaiting(call.waiting_seconds)}, chamou de novo` : formatWaiting(call.waiting_seconds),
    action: "Atender",
    view: VIEWS.tables,
  }));

  if (canConfirmPix(input.role)) {
    const pix = input.orders.filter((order) => isPixToCheck(order, input.now));
    if (pix.length > 0) {
      const cents = pix.reduce((sum, order) => {
        const value = Math.round(Number(order.total_price) * 100);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      items.push({
        id: "pix",
        kind: "pix",
        title: pix.length === 1 ? "1 Pix para conferir" : `${pix.length} Pix para conferir`,
        note: `${moneyText(cents / 100)} no total`,
        action: "Conferir",
        view: VIEWS.orders,
      });
    }
  }
  return items;
}

/**
 * Os botões grandes: o que esta pessoa mais faz. Ficam de fora os que a tela já tem em outro lugar: "Ver pedidos" é o
 * botão do topo e "Ver os números" está embaixo das vendas do dia. O dono e o gerente ganham "Preços e fotos" no lugar.
 */
export function shortcutsOf(role: string | null | undefined): Shortcut[] {
  const items: Shortcut[] = shortcutsFor(role)
    .filter((item) => item.view !== VIEWS.numbers && item.view !== VIEWS.orders)
    .map((item) => ({ view: item.view, label: item.label }));
  if (isManager(role) && !items.some((item) => item.view === "produtos")) items.push({ view: "produtos", label: "Preços e fotos" });
  return items.slice(0, 4);
}

export function todayOf(input: TodayInput): Today {
  const orders = input.orders;
  const waiting = orders.filter((order) => order.status === STATUS.pending);
  const oldest = oldestWait([...waiting], input.now);

  let sales: Sales | null = null;
  let salesMessage: string | undefined;
  if (isManager(input.role)) {
    if (input.business) sales = salesOf(input.business, input.now);
    else salesMessage = input.businessError?.trim() || "Carregando as vendas…";
  }

  return {
    greeting: greetingOf(input.name, input.now),
    dateLine: dateLineOf(input.now),
    waiting: waiting.length,
    oldestMinutes: oldest ?? 0,
    cooking: orders.filter((order) => order.status === STATUS.preparing).length,
    // "A caminho" é só o que já saiu; o que espera o entregador está na etapa Prontos da cozinha.
    onTheWay: orders.filter((order) => order.status === STATUS.out).length,
    calling: input.calls.length,
    todo: todoOf(input),
    guide: guideOf(input.role, input.setup),
    sales,
    salesMessage,
    shortcuts: shortcutsOf(input.role),
    // Entregas é tela de gerente (nav/navLogic.ts); Mesas é de toda a equipe.
    views: {
      orders: VIEWS.orders,
      numbers: VIEWS.numbers,
      deliveries: isManager(input.role) ? VIEWS.deliveries : null,
      tables: VIEWS.tables,
    },
  };
}
