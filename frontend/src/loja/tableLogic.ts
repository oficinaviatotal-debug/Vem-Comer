/**
 * A mesa do cliente, versão nova: transforma "o que este aparelho já chamou" (guardado aqui, por restaurante e mesa) e
 * o que o servidor respondeu nos botões que a tela nova mostra. Só conta, sem React nem rede:
 * tests/novo/tableLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou: quem decide se a chamada foi atendida é o servidor; quanto tempo a chamada
 * vale (2 horas) e quando o botão deixa chamar de novo (1 minuto) são as constantes da mesa antiga (mesa/callsLogic).
 */
import {
  CALL_AGAIN_AFTER_MS,
  MAIN_CALLS,
  SMALL_CALLS,
  callErrorMessage,
  isKind,
  safeJobsUrl,
  type CallKind,
  type CallOption,
  type MyCall,
} from "../mesa/callsLogic.ts";
import { CALL_NOTES, CALL_STATUS, TABLE_SENT_TEXT, TABLE_SUB } from "../novo/copy.ts";
import type { CallTile, TableView } from "../novo/types.ts";

export { CALL_POLL_MS } from "../mesa/callsLogic.ts";
export type { CallKind, MyCall } from "../mesa/callsLogic.ts";
/** Por quanto tempo a confirmação do toque fica na tela. */
export const NOTICE_MS = 6000;

/** "Mesa 4"; enquanto o número não chegou do servidor, "Sua mesa". */
export const tableTitle = (tableNumber: number | null): string =>
  tableNumber !== null && tableNumber > 0 ? `Mesa ${tableNumber}` : "Sua mesa";

type TileState = CallTile["state"];

/**
 * Em que pé está o botão: a mesma regra da mesa antiga (`buttonState`): quem acabou de chamar espera um minuto; passado
 * isso, o botão deixa chamar de novo; chamada atendida deixa chamar outra vez na hora.
 */
export function stateOf(call: MyCall | undefined, now: number, sending: boolean): TileState {
  if (sending) return "busy";
  if (!call) return "ready";
  if (call.status === "answered") return "answered";
  return now - call.savedAt < CALL_AGAIN_AFTER_MS ? "called" : "again";
}

const STATUS_OF: Record<TileState, string> = {
  ready: "",
  busy: CALL_STATUS.busy,
  called: CALL_STATUS.called,
  answered: CALL_STATUS.answered,
  again: CALL_STATUS.again,
};

const noteOf = (state: TileState, option: CallOption): string =>
  state === "ready" ? option.hint : state === "busy" ? "" : CALL_NOTES[state];

/** Junta as partes em frases separadas por ponto, sem ponto dobrado e sem reticências ("Avisando…" vira "Avisando."). */
const spokenOf = (parts: string[]): string =>
  parts
    .map((part) => part.replace(/[….]+$/, "").trim())
    .filter(Boolean)
    .join(". ") + ".";

export function tileOf(option: CallOption, call: MyCall | undefined, now: number, sending: boolean): CallTile {
  const state = stateOf(call, now, sending);
  const status = STATUS_OF[state];
  const note = noteOf(state, option);
  return {
    kind: option.kind,
    title: option.label,
    status,
    note,
    state,
    locked: state === "busy" || state === "called",
    // O leitor de tela não vê a cor: lê o nome, depois o estado, depois o que fazer.
    spoken: spokenOf([option.label, status, note]),
  };
}

export type TableInput = {
  tableNumber: number | null;
  calls: readonly MyCall[];
  now: number;
  /** O tipo que está sendo enviado agora ao servidor (ou null). */
  sending: CallKind | null;
  notice: string;
  error: string;
  ordersCount: number;
  jobsHref?: string | null;
};

export function tableViewOf(input: TableInput): TableView {
  const tile = (option: CallOption) =>
    tileOf(
      option,
      input.calls.find((call) => call.kind === option.kind),
      input.now,
      input.sending === option.kind,
    );
  return {
    title: tableTitle(input.tableNumber),
    sub: TABLE_SUB,
    main: MAIN_CALLS.map(tile),
    small: SMALL_CALLS.map(tile),
    notice: input.notice,
    error: input.error,
    ordersCount: input.ordersCount,
    jobsHref: safeJobsUrl(input.jobsHref),
  };
}

/**
 * O que fazer com a resposta do servidor à pergunta "já atenderam?":
 * - atendida → marca como atendida;
 * - o servidor não conhece mais a chamada (404) → também some o "Chamado": o botão volta ao normal;
 * - qualquer outra falha (sem internet) → espera e pergunta de novo.
 */
export function afterCheck(input: { status?: unknown } | { failedWith: number | null }): "answered" | "gone" | "wait" {
  if ("failedWith" in input) return input.failedWith === 404 ? "gone" : "wait";
  return input.status === "answered" ? "answered" : "wait";
}

/** O que o servidor devolveu ao toque: só vale com código e tipo certos. A frase é a dele, ou "Avisamos o atendente.". */
export function savedCall(result: unknown): { id: string; kind: CallKind; message: string } | null {
  if (!result || typeof result !== "object") return null;
  const data = result as Record<string, unknown>;
  if (!data.id || !isKind(data.kind)) return null;
  const message = typeof data.message === "string" && data.message.trim() ? data.message.trim() : TABLE_SENT_TEXT;
  return { id: String(data.id), kind: data.kind, message };
}

/** A frase de erro ao tocar. Serve o texto do servidor só quando é "espere um pouco" (429); o resto é frase fixa. */
export const errorTextOf = (status: number | null, serverMessage: string | null | undefined): string =>
  callErrorMessage(status, serverMessage);
