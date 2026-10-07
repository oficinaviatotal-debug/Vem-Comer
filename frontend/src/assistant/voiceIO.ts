/**
 * Talking and listening as promises, so the assistant can say a question and
 * then listen for the answer by itself, without the person tapping the
 * microphone every time.
 *
 * Talking picks the best voice this phone and this connection can carry (voice/voiceQuality.ts):
 * the server's natural voice on a good connection when the server has one, otherwise the phone's
 * own voice. The natural voice has a short time budget; when it is slow or fails, the phone speaks
 * the same sentence, so the guide never waits.
 */

import {
  canListen,
  canSpeak as canSpeakPhone,
  chooseNextVoice,
  createListener,
  currentVoiceName,
  speak,
  speakingTimeoutMs,
  stopSpeaking as stopPhoneVoice,
  voiceCount,
} from "../onboarding/speech";
import { fetchNaturalVoiceUrl } from "../service/api";
import { currentVoiceTier, serverVoiceBudgetMs, usesNaturalVoice } from "../voice/voiceQuality";
import { smoothForSpeech } from "./assistantLogic";

export { canListen, chooseNextVoice, currentVoiceName, voiceCount };

/** Pause between the end of the assistant's voice and opening the microphone, so it does not hear itself. */
export const LISTEN_DELAY_MS = 250;

/** Give up on an answer after this long without any words. */
export const LISTEN_TIMEOUT_MS = 12000;

/* ------------------------------------------------------------ natural voice */

/** From the server's capabilities: true when it has a natural voice turned on. */
let naturalVoiceOn = false;
/** Sentence -> address of its audio, for this visit (the browser also keeps the files). */
const naturalUrls = new Map<string, string>();
let playing: HTMLAudioElement | null = null;
/** Bumped by every new sentence and by stopSpeaking(), so a late answer never speaks over a newer one. */
let generation = 0;

export function setNaturalVoice(on: boolean) {
  naturalVoiceOn = on;
}

/** True when this browser can speak at all (natural voice or the phone's). */
export function canSpeak(): boolean {
  return canSpeakPhone() || (naturalVoiceOn && typeof Audio !== "undefined");
}

/** Stops whatever is being said, by either voice. */
export function stopSpeaking() {
  generation += 1;
  if (playing) {
    try {
      playing.pause();
    } catch {
      /* already stopped */
    }
    playing = null;
  }
  stopPhoneVoice();
}

/**
 * Plays the sentence in the natural voice. Resolves true when it was spoken, false when it could not
 * start in time (then the phone's voice says it instead).
 */
async function speakNatural(text: string, mine: number, budgetMs: number): Promise<boolean> {
  let url = naturalUrls.get(text);
  if (!url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);
    try {
      url = (await fetchNaturalVoiceUrl(text, controller.signal)) ?? undefined;
    } finally {
      clearTimeout(timer);
    }
    if (!url) return false;
    naturalUrls.set(text, url);
  }
  if (mine !== generation) return true; // a newer sentence or a stop came first: say nothing

  return new Promise<boolean>((resolve) => {
    const audio = new Audio(url);
    playing = audio;
    let started = false;
    let done = false;
    const finish = (spoken: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(startTimer);
      clearTimeout(endTimer);
      if (playing === audio) playing = null;
      resolve(spoken);
    };
    const startTimer = setTimeout(() => {
      if (!started) {
        audio.pause();
        finish(false);
      }
    }, budgetMs);
    // some phones never report the end: a generous ceiling, like the phone's voice has
    const endTimer = setTimeout(() => finish(true), speakingTimeoutMs(text) + budgetMs);
    audio.onplaying = () => {
      started = true;
    };
    audio.onended = () => finish(true);
    audio.onpause = () => {
      if (started) finish(true);
    };
    audio.onerror = () => finish(started);
    audio.play().catch(() => finish(false));
  });
}

function speakWithPhone(text: string): Promise<void> {
  return new Promise((resolve) => speak(smoothForSpeech(text), resolve));
}

/** Reads the text aloud and resolves when it ends (or at once when speech is not available). */
export async function speakAsync(text: string): Promise<void> {
  // a new sentence replaces the one being said, by either voice
  if (playing) {
    try {
      playing.pause();
    } catch {
      /* already stopped */
    }
    playing = null;
  }
  generation += 1;
  const mine = generation;
  const tier = currentVoiceTier();
  if (usesNaturalVoice(tier, naturalVoiceOn) && typeof Audio !== "undefined") {
    stopPhoneVoice();
    let spoken = false;
    try {
      spoken = await speakNatural(text, mine, serverVoiceBudgetMs(tier));
    } catch {
      spoken = false;
    }
    if (spoken || mine !== generation) return;
  }
  await speakWithPhone(text);
}

/* ----------------------------------------------------------------- listening */

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
