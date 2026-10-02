/**
 * Vem Comer — voice intent backbone.
 *
 * Speech-to-text is intentionally separated from business actions.
 * This layer turns a transcript into a safe, reviewable command.
 */
export type VoiceIntent =
  | "search_products"
  | "create_order"
  | "add_stock"
  | "create_menu_item"
  | "open_admin"
  | "unknown";

export type VoiceCommand = {
  version: "1.0";
  intent: VoiceIntent;
  confidence: number;
  requiresConfirmation: boolean;
  fields: Record<string, unknown>;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const has = (text: string, words: string[]) =>
  words.some((word) => text.includes(word));

export function interpretVoiceCommand(transcript: string): VoiceCommand {
  const raw = transcript.trim();
  const text = normalize(raw);

  let intent: VoiceIntent = "unknown";

  if (has(text, ["estoque", "dar entrada", "lancar estoque", "adicionar estoque"])) {
    intent = "add_stock";
  } else if (has(text, ["adicionar prato", "criar prato", "novo item", "novo produto"])) {
    intent = "create_menu_item";
  } else if (has(text, ["abrir administracao", "abrir admin", "painel administrativo"])) {
    intent = "open_admin";
  } else if (has(text, ["fazer pedido", "quero pedir", "meu pedido"])) {
    intent = "create_order";
  } else if (has(text, ["buscar", "procurar", "encontrar"])) {
    intent = "search_products";
  }

  return {
    version: "1.0",
    intent,
    confidence: intent === "unknown" ? 0 : 0.8,
    requiresConfirmation: intent !== "unknown",
    fields: {
      rawText: raw,
      source: "voice",
    },
  };
}
