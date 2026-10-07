/**
 * "Como foi?" no fim de cada tarefa: três rostinhos e, se a pessoa quiser, o que melhorar.
 * Sem React aqui, para os testes. A tela está em FeedbackAsk.tsx.
 */

export type Rating = 1 | 2 | 3;

/** Same list as backend/feedback.py CONTEXTS. */
export type FeedbackContext =
  | "cardapio_falado"
  | "cardapio_foto"
  | "cardapio_modelo"
  | "fotos"
  | "custos"
  | "logomarca"
  | "pedidos"
  | "geral";

export const FACES: ReadonlyArray<{ rating: Rating; face: string; label: string }> = [
  { rating: 1, face: "😞", label: "Ruim" },
  { rating: 2, face: "😐", label: "Mais ou menos" },
  { rating: 3, face: "😀", label: "Bom" },
];

export const MAX_COMMENT = 500;

/** After the face: an invitation that fits the answer. */
export function followUp(rating: Rating): string {
  if (rating === 3) return "Que bom! Quer sugerir alguma coisa? Pode falar ou escrever.";
  return "O que podemos melhorar? Pode falar ou escrever: a voz, um botão, uma palavra, qualquer coisa.";
}

export function feedbackPayload(context: FeedbackContext, rating: Rating, comment: string) {
  const text = comment.replace(/[ \t]+/g, " ").trim().slice(0, MAX_COMMENT).trim();
  return { context, rating, comment: text };
}

/** The question comes back for the same task only after this long, so nobody is asked twice a day. */
export const ASK_AGAIN_AFTER_MS = 20 * 60 * 60 * 1000;

/** True when this task was asked within ASK_AGAIN_AFTER_MS. `stored` is what markAsked saved. */
export function askedRecently(stored: string | null, context: FeedbackContext, now: number): boolean {
  if (!stored) return false;
  try {
    const when = (JSON.parse(stored) as Record<string, unknown>)[context];
    return typeof when === "number" && now - when >= 0 && now - when < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

/** The new value to keep after asking about `context`. */
export function markAsked(stored: string | null, context: FeedbackContext, now: number): string {
  let map: Record<string, number> = {};
  try {
    const parsed = stored ? JSON.parse(stored) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) map = parsed as Record<string, number>;
  } catch {
    map = {};
  }
  return JSON.stringify({ ...map, [context]: now });
}
