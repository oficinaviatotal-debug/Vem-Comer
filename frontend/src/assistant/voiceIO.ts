/**
 * Talking and listening as promises, so the assistant can say a question and
 * then listen for the answer by itself, without the person tapping the
 * microphone every time.
 */

import { canListen, canSpeak, createListener, speak, stopSpeaking } from "../onboarding/speech";

export { canListen, canSpeak, stopSpeaking };

/** Pause between the end of the assistant's voice and opening the microphone, so it does not hear itself. */
export const LISTEN_DELAY_MS = 250;

/** Give up on an answer after this long without any words. */
export const LISTEN_TIMEOUT_MS = 12000;

/** Reads the text aloud and resolves when it ends (or at once when speech is not available). */
export function speakAsync(text: string): Promise<void> {
  return new Promise((resolve) => speak(text, resolve));
}

export type Hearing = {
  /** The final words, or null when nothing was heard, the microphone failed, or it was cancelled. */
  result: Promise<string | null>;
  cancel: () => void;
};

/**
 * Opens the microphone for one answer. `onPartial` receives the words while
 * the person is still talking, so the screen can show them right away.
 */
export function hear(handlers: {
  onPartial?: (text: string) => void;
  timeoutMs?: number;
}): Hearing {
  let settle: (value: string | null) => void = () => {};
  const result = new Promise<string | null>((resolve) => {
    settle = resolve;
  });

  let settled = false;
  let lastWords = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = (value: string | null) => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    settle(value);
  };

  const listener = createListener({
    partial: true,
    onResult: (transcript, isFinal) => {
      lastWords = transcript;
      handlers.onPartial?.(transcript);
      if (isFinal) {
        finish(transcript.trim() || null);
        listener?.stop();
      }
    },
    // The microphone closes by itself after the last words: use what was heard.
    onStateChange: (listening) => {
      if (!listening) finish(lastWords.trim() || null);
    },
    onError: () => finish(null),
  });

  if (!listener) {
    finish(null);
    return { result, cancel: () => {} };
  }

  timer = setTimeout(() => {
    finish(lastWords.trim() || null);
    listener.stop();
  }, handlers.timeoutMs ?? LISTEN_TIMEOUT_MS);

  listener.start();

  return {
    result,
    cancel: () => {
      finish(null);
      listener.stop();
    },
  };
}
