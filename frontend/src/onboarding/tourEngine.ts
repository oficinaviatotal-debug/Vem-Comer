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
};

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
