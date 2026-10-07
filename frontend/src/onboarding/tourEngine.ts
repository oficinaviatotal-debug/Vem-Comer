/**
 * Guided onboarding engine (framework-agnostic, no browser APIs).
 *
 * A tour is a list of steps. Each step names the screen it lives in, the
 * element to highlight (a CSS selector) and a short text that is also read
 * aloud. This file only holds the pure logic so it can be tested in Node and
 * reused by any product (Vem Comer, Vem Trabalhar, future projects).
 */

export type TourStep = {
  id: string;
  /** Short heading shown and read aloud. */
  title: string;
  /** One or two short sentences: what to do here. Read aloud as written. */
  text: string;
  /** CSS selector of the element that must blink. Omit for intro/outro. */
  target?: string;
  /** Screen/tab this step belongs to; the host app navigates there. */
  view?: string;
  /** Example of what the user can say, shown as a hint. */
  say?: string;
  /** Go to the next step as soon as the user taps the highlighted element. */
  advanceOnClick?: boolean;
  /**
   * The highlighted element is a field the user can fill by talking: the guide
   * writes what was heard into it. Leave it out for anything where a wrong word
   * costs money or trust (a Pix key, a password).
   */
  dictate?: DictationKind;
};

/** What a dictated answer becomes: free text, a price, a whole number or one option of a list. */
export type DictationKind = "text" | "price" | "integer" | "choice";

export type TourState = {
  index: number;
  done: boolean;
  /** true when the user reached the last step, false when skipped. */
  finished: boolean;
};

export type TourCommand = "next" | "back" | "repeat" | "skip" | "unknown";

export function startTour(): TourState {
  return { index: 0, done: false, finished: false };
}

export function nextStep(state: TourState, total: number): TourState {
  if (state.done) return state;
  if (state.index >= total - 1) {
    return { index: state.index, done: true, finished: true };
  }
  return { ...state, index: state.index + 1 };
}

export function prevStep(state: TourState): TourState {
  if (state.done) return state;
  return { ...state, index: Math.max(0, state.index - 1) };
}

export function skipTour(state: TourState): TourState {
  if (state.done) return state;
  return { ...state, done: true, finished: false };
}

export function progressLabel(state: TourState, total: number): string {
  const current = Math.min(state.index + 1, Math.max(total, 1));
  return `Passo ${current} de ${Math.max(total, 1)}`;
}

/** Lowercase, remove accents and punctuation so "Próximo!" matches "proximo". */
export function normalizeSpeech(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const hasWord = (text: string, words: string[]) =>
  words.some((word) => new RegExp(`(^| )${word}( |$)`).test(text));

/**
 * Turns what the user said into a tour command. Order matters: "nao entendi"
 * must repeat, not skip, and "voltar" must not be read as "next".
 */
export function parseTourCommand(transcript: string): TourCommand {
  const text = normalizeSpeech(transcript);
  if (!text) return "unknown";

  if (
    hasWord(text, ["repetir", "repete", "repita", "de novo", "nao entendi", "ouvir"])
  ) {
    return "repeat";
  }
  if (hasWord(text, ["voltar", "volta", "anterior", "passo anterior"])) {
    return "back";
  }
  if (
    hasWord(text, ["pular", "pula", "sair", "fechar", "parar", "cancelar", "terminar"])
  ) {
    return "skip";
  }
  if (
    hasWord(text, [
      "proximo",
      "proxima",
      "avancar",
      "avanca",
      "continuar",
      "continua",
      "seguir",
      "ok",
      "pronto",
      "feito",
      "entendi",
      "certo",
      "beleza",
      "sim",
      "vamos",
      "concluir",
    ])
  ) {
    return "next";
  }
  return "unknown";
}

export type SpokenCommand = Exclude<TourCommand, "unknown">;

export type SpeechRoute =
  | { kind: "command"; command: SpokenCommand }
  | { kind: "dictation" }
  | { kind: "unknown" };

/**
 * Decides what a spoken phrase is. On a step that has a field to fill, only a
 * short phrase (one or two words, like "próximo" or "pode seguir") is a command;
 * anything longer is the answer for the field, so "pronto prato do dia" is not
 * read as "next". On any other step the old rule applies.
 */
export function routeSpeech(transcript: string, dictate?: DictationKind): SpeechRoute {
  const command = parseTourCommand(transcript);
  const words = normalizeSpeech(transcript).split(" ").filter(Boolean).length;
  if (command !== "unknown" && (!dictate || words <= 2)) return { kind: "command", command };
  if (dictate && words > 0) return { kind: "dictation" };
  return { kind: "unknown" };
}

/** Phone dictation gives "pratos." in lowercase: tidy it into "Pratos" for a name field. */
export function cleanDictatedText(transcript: string, maxLength = 100): string {
  const text = transcript
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "")
    .trim()
    .slice(0, maxLength)
    .trim();
  if (!text) return "";
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14,
  catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700,
  oitocentos: 800, novecentos: 900,
};

/** Every number word parseSpokenNumber understands ("vinte", "cinco", "cem"...), without accents. */
export const NUMBER_WORDS: ReadonlySet<string> = new Set(Object.keys(UNITS));

/** Words that may sit around a number ("mesa cinco", "vinte reais") without changing it. */
const NUMBER_FILLERS = new Set([
  "e", "com", "de", "o", "a", "reais", "real", "rs", "r", "centavos", "centavo",
  "mesa", "numero", "preco", "valor", "custa", "por",
]);

/** "tens and units" ("vinte" + "cinco") or "hundreds and the rest" ("cento" + "vinte") become one number. */
function joinsWithPrevious(previous: number, current: number): boolean {
  if (current <= 0) return false;
  if (previous >= 100 && previous % 100 === 0 && current < 100) return true;
  return previous % 100 >= 20 && previous % 10 === 0 && current < 10;
}

/**
 * Turns what was said into a number for a form field: "49,90", "R$ 49,90",
 * "49 e 90", "vinte e cinco reais" or "quarenta e nove e noventa". Returns the
 * value with a dot (what a number field wants), or null when it is not a clean
 * number: it is better to ask again than to guess a price.
 */
export function parseSpokenNumber(transcript: string, allowCents = true): string | null {
  // Keep the decimal mark visible to the tokenizer: "49,90" -> "49 virgula 90".
  const marked = transcript.replace(/(\d)\s*[.,]\s*(?=\d)/g, "$1 virgula ");
  const tokens = normalizeSpeech(marked).split(" ").filter(Boolean);

  const numbers: number[] = [];
  let afterComma = false;
  let joinable = false; // the last token was a number word, so "e cinco" may continue it

  for (const token of tokens) {
    if (token === "virgula") {
      if (numbers.length !== 1 || afterComma) return null;
      afterComma = true;
      joinable = false;
      continue;
    }
    if (NUMBER_FILLERS.has(token)) {
      if (token !== "e") joinable = false;
      continue;
    }
    if (/^\d+$/.test(token)) {
      if (token.length > 7) return null;
      // "6,5" is six and a half, not six and five cents.
      numbers.push(afterComma && token.length === 1 ? Number(token) * 10 : Number(token));
      joinable = false;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(UNITS, token)) return null;
    const value = UNITS[token];
    const last = numbers.length - 1;
    if (joinable && last >= 0 && joinsWithPrevious(numbers[last], value)) {
      numbers[last] += value;
    } else {
      numbers.push(afterComma && value > 0 && value < 10 ? value * 10 : value);
    }
    joinable = true;
  }

  if (numbers.length === 1) return String(numbers[0]);
  if (numbers.length === 2 && allowCents && numbers[1] < 100) {
    return `${numbers[0]}.${String(numbers[1]).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Finds which option of a list was said. Returns its index, or -1 when nothing
 * matches or more than one option could be meant (then the user picks by touch).
 */
export function matchChoice(transcript: string, labels: string[]): number {
  // "bebida" and "Bebidas" are the same category: compare words without a final "s".
  const comparable = (value: string) =>
    normalizeSpeech(value)
      .split(" ")
      .map((word) => (word.length > 3 ? word.replace(/s$/, "") : word))
      .join(" ");
  const said = comparable(transcript);
  if (!said) return -1;
  const normalized = labels.map(comparable);

  const exact = normalized.flatMap((label, index) => (label && label === said ? [index] : []));
  if (exact.length === 1) return exact[0];

  const partial = normalized.flatMap((label, index) =>
    label && (` ${said} `.includes(` ${label} `) || ` ${label} `.includes(` ${said} `))
      ? [index]
      : []
  );
  return partial.length === 1 ? partial[0] : -1;
}

/** Applies a spoken command to the tour. "repeat" and "unknown" keep the state. */
export function applyCommand(
  state: TourState,
  command: TourCommand,
  total: number
): TourState {
  if (command === "next") return nextStep(state, total);
  if (command === "back") return prevStep(state);
  if (command === "skip") return skipTour(state);
  return state;
}
