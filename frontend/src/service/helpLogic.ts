/**
 * Pure rules of "Preciso de ajuda": what the owner can pick, what is checked before sending, how a spoken sentence
 * is recognised as a call for help, and how the administrator's inbox is summed up.
 * No browser APIs here, so tests/ui/helpLogic.test.mjs runs it from plain Node.
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import { normalizePhone } from "../signup/signupLogic.ts";

export type HelpTopic = "cardapio" | "foto" | "logo" | "pedidos" | "plano" | "erro" | "outro";

/** Same keys and words as backend/help_requests.py (TOPICS): a test compares the two. */
export const HELP_TOPICS: ReadonlyArray<{ id: HelpTopic; label: string }> = [
  { id: "cardapio", label: "Cadastrar o cardápio" },
  { id: "foto", label: "Foto de prato" },
  { id: "logo", label: "Logomarca" },
  { id: "pedidos", label: "Pedidos" },
  { id: "plano", label: "Plano e pagamento" },
  { id: "erro", label: "Deu erro" },
  { id: "outro", label: "Outra coisa" },
];

export const HELP_MAX_MESSAGE = 500;

export type HelpDraft = { topic: HelpTopic | ""; message: string; phone: string };

export const blankHelp = (topic: HelpTopic | "" = ""): HelpDraft => ({ topic, message: "", phone: "" });

/** The topic that most likely fits the screen the owner is on, so one tap less. */
export function suggestedTopic(view: string): HelpTopic | "" {
  switch (view) {
    case "assistente":
    case "produtos":
    case "categorias":
      return "cardapio";
    case "marca":
      return "logo";
    case "pedidos":
      return "pedidos";
    case "plano":
      return "plano";
    default:
      return "";
  }
}

/** What stops the request from being sent, in plain words. "" means it can go. */
export function helpProblem(draft: HelpDraft): string {
  if (!draft.topic) return "Escolha o assunto da sua dúvida.";
  const message = draft.message.trim();
  if (draft.topic === "outro" && message.length < 3) return "Conte em poucas palavras o que você precisa.";
  if (message.length > HELP_MAX_MESSAGE) return `O texto passou de ${HELP_MAX_MESSAGE} letras. Resuma um pouco.`;
  if (draft.phone.trim() && normalizePhone(draft.phone) === null) {
    return "Confira o WhatsApp: precisa ter o DDD, por exemplo (84) 99999-1234.";
  }
  return "";
}

/** The body sent to the server. The screen name only helps whoever answers to know where the owner was. */
export function helpBody(draft: HelpDraft, screen: string): { topic: string; message: string; screen: string; phone?: string } {
  const phone = draft.phone.trim() ? normalizePhone(draft.phone) : null;
  return {
    topic: draft.topic,
    message: draft.message.trim().slice(0, HELP_MAX_MESSAGE),
    screen: screen.slice(0, 40),
    ...(phone ? { phone } : {}),
  };
}

/** Only a WhatsApp link is ever opened from the panel, whatever the server sends. */
export function safeWhatsappUrl(url: unknown): string {
  return typeof url === "string" && /^https:\/\/wa\.me\/\d{10,15}(\?text=[^\s]*)?$/.test(url) ? url : "";
}

const HELP_PHRASES = [
  "preciso de ajuda",
  "preciso de uma ajuda",
  "quero ajuda",
  "pedir ajuda",
  "me ajuda",
  "me ajude",
  "socorro",
  "estou travado",
  "estou travada",
  "travei",
  "chamar uma pessoa",
  "chamar alguem",
  "falar com uma pessoa",
  "falar com alguem",
  "falar com o suporte",
  "falar com um atendente",
  "falar com atendente",
  "chama o suporte",
];
const NEGATIONS = new Set(["nao", "nunca", "sem"]);

/**
 * Whether the owner said, in any words, that he is stuck and wants a person. Spoken sentences are long and messy,
 * so this looks for the phrase anywhere, but "não preciso de ajuda" is the opposite.
 */
export function wantsHelp(transcript: string): boolean {
  const said = ` ${normalizeSpeech(transcript)} `;
  if (said.trim() === "ajuda") return true;
  return HELP_PHRASES.some((phrase) => {
    const at = said.indexOf(` ${phrase} `);
    if (at < 0) return false;
    const before = said.slice(0, at).trim().split(" ").slice(-2);
    return !before.some((word) => NEGATIONS.has(word));
  });
}

/* ------------------------------------------------------------------ the administrator's inbox */

export type InboxRequest = {
  id: string;
  company_id: string;
  company_name: string | null;
  owner_name: string | null;
  topic: string;
  topic_label: string;
  screen: string;
  message: string;
  repeats: number;
  waiting_seconds: number;
  waiting_label: string;
  phone: string;
  whatsapp_url: string;
};

export type TrackingState = "ok" | "watch" | "late" | "over" | "done";

export type TrackingRow = {
  company_id: string;
  company_name: string | null;
  owner_name: string | null;
  products: number;
  age_label: string;
  state: TrackingState;
  ready: boolean;
  text: string;
  has_open_help: boolean;
  phone: string;
  whatsapp_url: string;
};

export type TrackingSummary = {
  total: number;
  done: number;
  done_within_deadline: number;
  stalled: number;
  over_deadline: number;
  median_label: string;
};

export type PlatformHelp = {
  open: InboxRequest[];
  open_count: number;
  tracking: TrackingRow[];
  summary: TrackingSummary;
  deadline_days: number;
  ready_products: number;
};

/** One line for the top of the inbox. */
export function inboxHeadline(data: Pick<PlatformHelp, "open_count" | "summary">): string {
  const n = data.open_count;
  const late = data.summary.over_deadline;
  const asks = n === 0 ? "Nenhum pedido de ajuda aberto" : n === 1 ? "1 pedido de ajuda aberto" : `${n} pedidos de ajuda abertos`;
  if (late === 0) return asks;
  return `${asks} · ${late === 1 ? "1 cadastro passou" : `${late} cadastros passaram`} do prazo`;
}

/** The stopwatch of the 3-day promise, in a sentence. Empty when nobody signed up by themselves yet. */
export function stopwatchText(summary: TrackingSummary, deadlineDays: number): string {
  if (summary.total === 0) return "";
  const days = `${deadlineDays} ${deadlineDays === 1 ? "dia" : "dias"}`;
  if (summary.done === 0) {
    return `${summary.total === 1 ? "1 restaurante se cadastrou" : `${summary.total} restaurantes se cadastraram`} e ainda nenhum terminou o cardápio.`;
  }
  const typical = summary.median_label ? ` Tempo típico: ${summary.median_label}.` : "";
  return `${summary.done_within_deadline} de ${summary.total} cadastraram o cardápio dentro de ${days}.${typical}`;
}

/** The colour of a signup in the follow-up list. */
export function trackingTone(state: TrackingState): "ok" | "warn" | "bad" | "quiet" {
  switch (state) {
    case "over":
      return "bad";
    case "late":
    case "watch":
      return "warn";
    case "done":
      return "ok";
    default:
      return "quiet";
  }
}

export function trackingChip(state: TrackingState): string {
  switch (state) {
    case "over":
      return "Passou do prazo";
    case "late":
      return "Falta pouco";
    case "watch":
      return "Parado";
    case "done":
      return "Cardápio pronto";
    default:
      return "Chegou agora";
  }
}
