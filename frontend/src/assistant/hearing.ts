/**
 * Listening for one answer, as a small machine that does not touch the browser: the phone's
 * recognizer comes in through `makeListener`, so every rule here can be tested with a fake one.
 *
 * Two ways to listen:
 * - Short answer ("sim", "pronto", "seis reais"): the first phrase the phone closes is the answer.
 * - Dictation (`patienceMs` > 0), for saying a whole menu: the phone closes the microphone at the
 *   first pause (about a second and a half), which cuts the owner while he is still thinking of the
 *   next dish. Here the machine keeps what was heard, opens the microphone again by itself, and only
 *   finishes after `patienceMs` of real silence. The words of every round are joined.
 */

export type Hearing = {
  /** The final words, or null when nothing was heard, the microphone failed, or it was cancelled. */
  result: Promise<string | null>;
  cancel: () => void;
};

export type ListenerLike = { start: () => void; stop: () => void };

export type ListenerFactory = (handlers: {
  partial: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onStateChange: (listening: boolean) => void;
  onError: (code?: string) => void;
}) => ListenerLike | null;

export type HearOptions = {
  /** Receives the words while the person is still talking (all the rounds so far, in dictation). */
  onPartial?: (text: string) => void;
  /** Give up when no words come at all for this long. */
  timeoutMs?: number;
  /** Dictation: finish only after this long without any new words. 0 or missing: one short answer. */
  patienceMs?: number;
  /** Dictation: never listen longer than this in total. */
  maxMs?: number;
};

/** Give up on an answer after this long without any words. */
export const LISTEN_TIMEOUT_MS = 12000;

/** Dictation of a menu: how long a silence must last before the phrase is considered finished. */
export const DICTATION_PATIENCE_MS = 3000;

/** Dictation never goes on longer than this in one go (a stuck microphone ends here). */
export const DICTATION_MAX_MS = 120000;

/** Pause before the microphone is opened again after the phone closed it on a pause. */
export const REOPEN_DELAY_MS = 150;

const MAX_REOPENS = 60;

/** The recognizer says these when the microphone cannot work at all: reopening it would only loop. */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"]);

const join = (...parts: string[]) =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

export function startHearing(makeListener: ListenerFactory, options: HearOptions = {}): Hearing {
  let settle: (value: string | null) => void = () => {};
  const result = new Promise<string | null>((resolve) => {
    settle = resolve;
  });

  const patience = Math.max(0, options.patienceMs ?? 0);
  const dictation = patience > 0;

  let settled = false;
  /** Short answer: the last words heard. */
  let lastWords = "";
  /** Dictation: the rounds the phone already closed, and the round still open. */
  let committed = "";
  let live = "";
  let reopens = 0;
  let listener: ListenerLike | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let patienceTimer: ReturnType<typeof setTimeout> | undefined;
  let hardTimer: ReturnType<typeof setTimeout> | undefined;
  let reopenTimer: ReturnType<typeof setTimeout> | undefined;

  const heardText = () => join(committed, live);

  const finish = (value: string | null) => {
    if (settled) return;
    settled = true;
    for (const timer of [idleTimer, patienceTimer, hardTimer, reopenTimer]) {
      if (timer !== undefined) clearTimeout(timer);
    }
    settle(value);
  };

  const finishWithWords = () => {
    const text = dictation ? heardText() : lastWords;
    finish(text.trim() || null);
    listener?.stop();
  };

  const armPatience = () => {
    if (patienceTimer !== undefined) clearTimeout(patienceTimer);
    patienceTimer = setTimeout(finishWithWords, patience);
  };

  listener = makeListener({
    partial: true,
    onResult: (transcript, isFinal) => {
      if (settled) return;
      if (!dictation) {
        lastWords = transcript;
        options.onPartial?.(transcript);
        if (isFinal) {
          finish(transcript.trim() || null);
          listener?.stop();
        }
        return;
      }
      if (idleTimer !== undefined) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
      live = transcript;
      if (isFinal) {
        committed = join(committed, transcript);
        live = "";
      }
      options.onPartial?.(heardText());
      armPatience();
    },
    onStateChange: (listening) => {
      if (listening || settled) return;
      if (!dictation) {
        // The microphone closed by itself after the last words: use what was heard.
        finish(lastWords.trim() || null);
        return;
      }
      // The phone closed the microphone on a pause: keep the words and listen again.
      if (live) {
        committed = join(committed, live);
        live = "";
      }
      reopens += 1;
      if (reopens > MAX_REOPENS) {
        finishWithWords();
        return;
      }
      if (reopenTimer !== undefined) clearTimeout(reopenTimer);
      reopenTimer = setTimeout(() => {
        if (!settled) listener?.start();
      }, REOPEN_DELAY_MS);
    },
    onError: (code) => {
      if (settled) return;
      if (!dictation) {
        finish(null);
        return;
      }
      // "no-speech" and the like are only a silent round: the reopening above handles them.
      if (code && FATAL_ERRORS.has(code)) finishWithWords();
    },
  });

  if (!listener) {
    finish(null);
    return { result, cancel: () => {} };
  }

  if (dictation) {
    idleTimer = setTimeout(finishWithWords, options.timeoutMs ?? LISTEN_TIMEOUT_MS);
    hardTimer = setTimeout(finishWithWords, options.maxMs ?? DICTATION_MAX_MS);
  } else {
    idleTimer = setTimeout(() => {
      finish(lastWords.trim() || null);
      listener?.stop();
    }, options.timeoutMs ?? LISTEN_TIMEOUT_MS);
  }

  listener.start();

  return {
    result,
    cancel: () => {
      finish(null);
      listener?.stop();
    },
  };
}
