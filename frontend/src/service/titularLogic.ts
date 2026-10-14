/**
 * Regras puras da caixa de pedidos do titular dos dados (LGPD) e de denúncias, só para o administrador da
 * plataforma: o que mostrar, como falar do prazo, quais contatos viram link e o que impede de salvar uma resposta.
 * Sem API de navegador, para tests/ui/titularLogic.test.mjs rodar no Node puro.
 */

export type TitularStatus = "recebida" | "em_analise" | "respondida" | "negada" | "encerrada";

export type TitularItem = {
  id: string;
  protocol: string;
  kind: string;
  kind_label: string;
  channel: string;
  contact: string | null;
  description: string | null;
  target_url: string | null;
  identity_verified: boolean;
  status: TitularStatus;
  due_at: string;
  hours_left: number;
  overdue: boolean;
};

export type TitularList = { items: TitularItem[]; overdue: number };

export type AnswerStatus = Exclude<TitularStatus, "recebida">;

/** Mesmos nomes de backend/titular.py (ANSWER_STATUSES): um teste compara os dois. */
export const ANSWER_OPTIONS: ReadonlyArray<{ id: AnswerStatus; label: string }> = [
  { id: "em_analise", label: "Estou analisando" },
  { id: "respondida", label: "Responder (atendido)" },
  { id: "negada", label: "Não atender (explicando o motivo)" },
  { id: "encerrada", label: "Encerrar" },
];

export const RESPONSE_MAX = 4000;

/** Pedidos de eliminação podem ser executados daqui (simular primeiro, executar depois). */
export const CAN_ERASE_KINDS: ReadonlyArray<string> = ["eliminacao"];

export const ERASE_WORD = "ANONIMIZAR";

function span(hours: number): string {
  const total = Math.abs(hours);
  if (total < 24) return total === 1 ? "1 hora" : `${total} horas`;
  const days = Math.floor(total / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** "Venceu há 3 dias" / "Vence em 5 horas": o que o administrador precisa ver primeiro. */
export function deadlineText(item: Pick<TitularItem, "overdue" | "hours_left">): string {
  return item.overdue ? `Venceu há ${span(item.hours_left)}` : `Vence em ${span(item.hours_left)}`;
}

export function deadlineTone(item: Pick<TitularItem, "overdue" | "hours_left">): "bad" | "warn" | "ok" {
  if (item.overdue) return "bad";
  return item.hours_left < 72 ? "warn" : "ok";
}

/** E-mail vira mailto:, WhatsApp vira wa.me. Qualquer outra coisa não vira link. */
export function contactLink(contact: unknown): { href: string; label: string } | null {
  if (typeof contact !== "string") return null;
  const text = contact.trim();
  if (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(text)) return { href: `mailto:${text}`, label: text };
  if (/^55\d{10,11}$/.test(text)) return { href: `https://wa.me/${text}`, label: `WhatsApp ${text}` };
  return null;
}

/** Só endereço de internet de verdade vira link (o texto da denúncia vem de qualquer pessoa). */
export function safeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return /^https?:\/\/[^\s<>"']+$/i.test(text) ? text : "";
}

/** O que impede de salvar a resposta, em palavras simples. "" quer dizer que pode ir. */
export function answerProblem(status: string, response: string): string {
  if (!ANSWER_OPTIONS.some((option) => option.id === status)) return "Escolha o que fazer com o pedido.";
  const text = response.trim();
  if (text.length > RESPONSE_MAX) return `A resposta passou de ${RESPONSE_MAX} letras. Resuma um pouco.`;
  if ((status === "respondida" || status === "negada") && text.length < 5) {
    return status === "negada" ? "Escreva o motivo de não atender." : "Escreva a resposta.";
  }
  return "";
}

export function listHeadline(list: Pick<TitularList, "items" | "overdue">): string {
  if (list.items.length === 0) return "Nenhum pedido aberto.";
  const open = list.items.length === 1 ? "1 pedido aberto" : `${list.items.length} pedidos abertos`;
  if (list.overdue === 0) return open;
  return `${open}, ${list.overdue === 1 ? "1 com prazo vencido" : `${list.overdue} com prazo vencido`}`;
}

/** O que o administrador digita para executar uma eliminação. Qualquer outra coisa só simula. */
export function eraseConfirmed(typed: string): boolean {
  return typed.trim() === ERASE_WORD;
}
