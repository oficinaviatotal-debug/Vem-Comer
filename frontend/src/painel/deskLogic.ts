/**
 * A tela de mesas do painel, versão nova: junta o que o painel já sabe (as mesas cadastradas, os chamados abertos e os
 * pedidos andando) nas fichas e nos cartões que a tela mostra. Só conta, sem React nem rede:
 * tests/novo/deskLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou: quem diz se um chamado está demorando ou urgente é o servidor
 * (backend/table_calls.py); a mesa vem do cadastro; os pedidos são os que o painel já busca; ler o QR, achar a mesa
 * pelo número e contar chamados e pedidos são as contas da tela antiga (mesa/tableDeskLogic).
 */
import { formatWaiting, freshCalls, becameUrgent, parsePanelCalls, type PanelCall, type Urgency } from "../mesa/callsLogic.ts";
import {
  activeOrdersOfTable,
  callsOfTable,
  codeMessage,
  deskTiles,
  readTableCode,
  tableById,
  tableByNumber,
  tableHeadline,
  tableTitle,
  type DeskOrder as RawOrder,
  type TableRef,
} from "../mesa/tableDeskLogic.ts";
import { statusLabel, statusTone } from "../service/orderStatus.ts";
import { waitText, waitingMinutes } from "../nav/navLogic.ts";
import { formatMoney } from "../service/format.ts";
import {
  DESK_AGAIN,
  DESK_LOADING,
  DESK_NO_NAME,
  DESK_NO_TABLES,
  DESK_QUIET,
  DESK_TABLES_ERROR,
  DESK_TYPE_EMPTY,
  DESK_TYPE_UNKNOWN,
  DESK_WORD,
} from "../novo/copy.ts";
import type { DeskCall, DeskOrder, DeskTableView, DeskTile, DeskView } from "../novo/types.ts";

export type { PanelCall, TableRef, RawOrder };
/** Quem monta a tela lê o que o servidor mandou por aqui: só entra o que veio direito. */
export { parsePanelCalls };

/** De quanto em quanto tempo a tela pergunta os chamados (o painel antigo fazia o mesmo: 6 s) e os pedidos. */
export const CALLS_MS = 6000;
export const ORDERS_MS = 8000;

/** "1 mesa chamando", "3 mesas chamando", ou a frase de sossego. */
export function subOf(count: number): string {
  if (count <= 0) return DESK_QUIET;
  return count === 1 ? "1 mesa chamando" : `${count} mesas chamando`;
}

const RANK: Record<Urgency, number> = { urgent: 2, late: 1, normal: 0 };

/**
 * Quem está pior fica em cima: urgente (esperou 7 min ou o cliente tocou de novo), depois demorando (3 min), depois o
 * resto; dentro de cada grupo, quem espera há mais tempo. A ordem não depende de como o servidor mandou.
 */
export function sortCalls(calls: readonly PanelCall[]): PanelCall[] {
  return [...calls].sort((a, b) => RANK[b.urgency] - RANK[a.urgency] || b.waiting_seconds - a.waiting_seconds);
}

/** A cor da fita pelo que o servidor disse: normal é verde, demorando é amarela, urgente é vermelha. */
export const toneOf = (urgency: Urgency): DeskCall["tone"] => (urgency === "urgent" ? "late" : urgency === "late" ? "warn" : "ok");

/**
 * O que a mesa quer, só a parte que o servidor escreve depois do número: "Mesa 4 chama o garçom" vira "Chama o garçom".
 * Se o servidor mudar o jeito de escrever, a frase inteira aparece, e nunca fica vazio.
 */
export function whatOf(call: Pick<PanelCall, "text" | "table_number" | "label">): string {
  const prefix = `Mesa ${call.table_number} `;
  const rest = call.text.startsWith(prefix) ? call.text.slice(prefix.length).trim() : call.text.trim();
  const text = rest || call.label;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Termina em ponto, sem dobrar. */
const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

export function deskCallOf(call: PanelCall, tables: readonly TableRef[] | null): DeskCall {
  const where = tableTitle(call.table_number);
  const what = whatOf(call);
  const wait = formatWaiting(call.waiting_seconds);
  const again = call.repeats > 0;
  const word = DESK_WORD[call.urgency];
  const table = tables?.find((item) => item.number === call.table_number) ?? null;
  return {
    id: call.id,
    kind: call.kind,
    where,
    what,
    wait,
    again,
    tone: toneOf(call.urgency),
    word,
    tableId: table ? table.id : null,
    // O botão é lido por inteiro: o que ele faz, a mesa, o que ela quer e há quanto tempo espera.
    spoken: [`Já atendi. ${where}`, what, wait + (again ? `, ${DESK_AGAIN}` : ""), word].filter(Boolean).map(sentence).join(" "),
  };
}

export type DeskInput = {
  /** Os chamados abertos, já lidos por `parsePanelCalls`. */
  calls: readonly PanelCall[];
  /** As mesas cadastradas; null enquanto a lista não chegou. */
  tables: readonly TableRef[] | null;
  orders: readonly RawOrder[];
  tablesFailed?: boolean;
  message?: string;
  error?: string;
};

function tileOf(tile: ReturnType<typeof deskTiles>[number]): DeskTile {
  return {
    id: tile.id,
    number: tile.number,
    note: tile.note,
    tone: tile.tone,
    spoken: `${tableTitle(tile.number)}: ${tile.note}`,
  };
}

export function deskViewOf(input: DeskInput): DeskView {
  const calls = sortCalls(input.calls);
  const tiles = input.tables === null ? null : deskTiles([...input.tables], [...input.orders], [...input.calls]).map(tileOf);
  const tilesMessage = input.tablesFailed
    ? DESK_TABLES_ERROR
    : tiles === null
      ? DESK_LOADING
      : tiles.length === 0
        ? DESK_NO_TABLES
        : "";
  return {
    sub: subOf(calls.length),
    calls: calls.map((call) => deskCallOf(call, input.tables)),
    tiles,
    tilesMessage,
    tilesFailed: Boolean(input.tablesFailed),
    message: input.message ?? "",
    error: input.error ?? "",
  };
}

/** O que a pessoa digitou na caixa do número: a mesa, ou a frase de por que não abriu. */
export function openTyped(tables: readonly TableRef[], typed: string): { table: TableRef } | { message: string } {
  const found = tableByNumber([...tables], typed);
  if (found) return { table: found };
  return { message: typed.trim() ? DESK_TYPE_UNKNOWN : DESK_TYPE_EMPTY };
}

/** O que o QR lido quer dizer: a mesa deste restaurante, ou a frase de por que não abriu (outro restaurante, não é de mesa, mesa fora do cadastro). */
export function openCode(tables: readonly TableRef[], text: string, slug: string): { table: TableRef } | { message: string } {
  const read = readTableCode(text, slug);
  const found = read.kind === "table" ? tableById([...tables], read.tableId) : null;
  return found ? { table: found } : { message: codeMessage(read, false) };
}

export { tableById };

/** Só endereço http ou https de verdade vira o botão "Fazer um pedido para esta mesa"; o resto some. */
export function orderHrefOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function deskOrderOf(order: RawOrder, now: number): DeskOrder {
  const minutes = waitingMinutes(order.created_at, now);
  return {
    id: order.id,
    name: (order.customer_name ?? "").trim() || DESK_NO_NAME,
    status: statusLabel(order.status, "mesa"),
    tone: statusTone(order.status),
    wait: minutes === null ? "" : waitText(minutes),
    price: formatMoney(Number(order.total_price) || 0),
  };
}

export type DeskTableInput = {
  table: TableRef;
  calls: readonly PanelCall[];
  tables: readonly TableRef[];
  orders: readonly RawOrder[];
  now: number;
  /** O endereço do cardápio desta mesa, montado por quem sabe o endereço do aplicativo. */
  orderHref: string | null | undefined;
  error?: string;
};

export function deskTableViewOf(input: DeskTableInput): DeskTableView {
  const calls = sortCalls(callsOfTable([...input.calls], input.table.number));
  const orders = activeOrdersOfTable([...input.orders], input.table.number);
  return {
    title: tableTitle(input.table.number),
    headline: tableHeadline(calls.length, orders.length),
    calls: calls.map((call) => deskCallOf(call, input.tables)),
    orders: orders.map((order) => deskOrderOf(order, input.now)),
    orderHref: orderHrefOf(input.orderHref),
    error: input.error ?? "",
  };
}

/**
 * Depois de "Já atendi" o chamado some da lista na hora; uma busca que já tinha saído antes do toque ainda pode trazê-lo de volta.
 * Esta conta tira da resposta o que já foi atendido e esquece os que o servidor já deixou de mandar.
 */
export function withoutAnswered(calls: readonly PanelCall[], answered: ReadonlySet<string>): { calls: PanelCall[]; answered: Set<string> } {
  const sent = new Set(calls.map((call) => call.id));
  return {
    calls: calls.filter((call) => !answered.has(call.id)),
    answered: new Set([...answered].filter((id) => sent.has(id))),
  };
}

// ---------------------------------------------------------------- o apito

export type AlertState = {
  /** Os chamados que a tela já conhecia; null antes da primeira busca (o que já estava aberto ao abrir não faz alarde). */
  known: ReadonlySet<string> | null;
  urgencies: ReadonlyMap<string, Urgency>;
};

export const FIRST_LOOK: AlertState = { known: null, urgencies: new Map() };

/**
 * O que fazer com os chamados que acabaram de chegar: chamado novo apita ("call"; "urgent" se algum já chegou urgente),
 * e um chamado conhecido que acabou de virar urgente apita uma vez ("urgent"). Devolve também o que a tela passa a conhecer.
 */
export function nextAlert(state: AlertState, calls: readonly PanelCall[]): { alert: "call" | "urgent" | null; state: AlertState } {
  const arrived = freshCalls(state.known as ReadonlySet<string> | null, [...calls]);
  const urgent = becameUrgent(state.urgencies, [...calls]);
  const alert = arrived.length > 0 ? (arrived.some((call) => call.urgency === "urgent") ? "urgent" : "call") : urgent.length > 0 ? "urgent" : null;
  return {
    alert,
    state: {
      known: new Set(calls.map((call) => call.id)),
      urgencies: new Map(calls.map((call) => [call.id, call.urgency])),
    },
  };
}
