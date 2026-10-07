/**
 * Thin wrappers over the browser Speech APIs (pt-BR). Both are optional:
 * when the browser does not offer them, the guide keeps working with text
 * and buttons only.
 */

import { currentVoiceTier, type VoiceTier } from "../voice/voiceQuality.ts";

type RecognitionResult = ArrayLike<{ transcript?: string }> & { isFinal?: boolean };

type RecognitionEvent = {
  results?: ArrayLike<RecognitionResult>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
};

export function canSpeak(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.speechSynthesis) &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/**
 * Higher is better. Phones list several Portuguese voices: the plain system one
 * sounds robotic, the "Google"/"Natural"/"Neural" ones sound like a person. The
 * browser's default pick is often the robotic one, so choose on purpose.
 */
export function voiceScore(name: string, lang: string, localService?: boolean, tier: VoiceTier = "plena"): number {
  const code = lang.toLowerCase().replace("_", "-");
  if (!code.startsWith("pt")) return -1;
  const label = name.toLowerCase();
  let score = code === "pt-br" ? 10 : 2; // pt-PT is understood, but it is not how the user speaks
  if (/natural|neural|online|premium|enhanced|wavenet/.test(label)) score += 8;
  if (/google/.test(label)) score += 5;
  if (/francisca|thalita|antonio|luciana|felipe|fernanda|vitoria|vitória/.test(label)) score += 3;
  if (/compact|espeak|pico/.test(label)) score -= 6;
  // On phones the voices that are not "local" are the ones the browser streams from
  // the network, and they sound much more natural than the ones stored on the device.
  // On 2G they make every sentence wait for the network, so the stored voice wins there.
  if (localService === false) score += tier === "leve" ? -12 : 4;
  return score;
}

export type VoiceInfo = { name: string; lang: string; localService?: boolean };

/** Portuguese voices, best first, for the connection tier. */
export function rankVoices<T extends VoiceInfo>(voices: T[], tier: VoiceTier = "plena"): T[] {
  return voices
    .map((voice) => ({ voice, score: voiceScore(voice.name, voice.lang, voice.localService, tier) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.voice);
}

/**
 * The voice the person chose by name when it is still available, otherwise the best-sounding one.
 * On 2G a chosen network voice gives way to the best stored one (the choice stays saved for later).
 */
export function pickVoice<T extends VoiceInfo>(
  voices: T[],
  preferredName?: string,
  tier: VoiceTier = "plena"
): T | undefined {
  const ranked = rankVoices(voices, tier);
  if (preferredName) {
    const chosen = ranked.find((voice) => voice.name === preferredName);
    const stored = ranked.some((voice) => voice.localService !== false);
    if (chosen && !(tier === "leve" && chosen.localService === false && stored)) return chosen;
  }
  return ranked[0];
}

/** The voice after `currentName` in the ranking, wrapping around. Used by the "Trocar voz" button. */
export function nextVoiceName(voices: VoiceInfo[], currentName?: string, tier: VoiceTier = "plena"): string | undefined {
  const ranked = rankVoices(voices, tier);
  if (ranked.length === 0) return undefined;
  const index = ranked.findIndex((voice) => voice.name === currentName);
  return ranked[(index + 1) % ranked.length].name;
}

let chosenVoice: SpeechSynthesisVoice | undefined;
let voicesWatched = false;

const VOICE_KEY = "vc_voice_name";

function savedVoiceName(): string | undefined {
  try {
    return window.localStorage.getItem(VOICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function refreshVoice() {
  if (!canSpeak()) return;
  chosenVoice = pickVoice(window.speechSynthesis.getVoices(), savedVoiceName(), currentVoiceTier());
}

/** Name of the voice being used, to show on screen. */
export function currentVoiceName(): string | undefined {
  prepareVoice();
  return chosenVoice?.name;
}

/** How many Portuguese voices this phone offers. */
export function voiceCount(): number {
  if (!canSpeak()) return 0;
  return rankVoices(window.speechSynthesis.getVoices(), currentVoiceTier()).length;
}

/**
 * Switches to the next Portuguese voice of the phone and remembers the choice in
 * this browser. Returns its name, or undefined when the phone has no other voice.
 */
export function chooseNextVoice(): string | undefined {
  if (!canSpeak()) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const next = nextVoiceName(voices, chosenVoice?.name, currentVoiceTier());
  if (!next) return undefined;
  try {
    window.localStorage.setItem(VOICE_KEY, next);
  } catch {
    /* the choice only lasts until the page is closed */
  }
  refreshVoice();
  return chosenVoice?.name;
}

/**
 * Chrome fills the voice list a moment after the page loads, so asking for it
 * right away returns nothing and the default (robotic) voice gets used. Listen
 * for the list to arrive and pick again.
 */
export function prepareVoice() {
  if (!canSpeak()) return;
  refreshVoice();
  if (voicesWatched) return;
  voicesWatched = true;
  try {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoice);
  } catch {
    /* very old browsers: the default voice is still used */
  }
}

/** A little faster than the default: the slow, pausing delivery is what makes a voice feel robotic. */
const SPEECH_RATE = 1.12;

/**
 * Reads the text aloud, replacing anything still being read. `onDone` runs once
 * when the reading ends, fails, or is cut by another speak(); it also runs from a
 * safety timer, because some phones never report the end of an utterance.
 */
export function speak(text: string, onDone?: () => void) {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    onDone?.();
  };

  if (!canSpeak() || !text) {
    finish();
    return;
  }
  try {
    prepareVoice(); // also picks again: the connection may have changed since the last sentence
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = SPEECH_RATE;
    utterance.pitch = 1;
    if (chosenVoice) utterance.voice = chosenVoice;
    if (onDone) {
      utterance.onend = finish;
      utterance.onerror = finish;
      timer = setTimeout(finish, speakingTimeoutMs(text));
    }
    synth.speak(utterance);
  } catch {
    /* some browsers refuse speech until the user taps something */
    finish();
  }
}

/** Generous upper bound for reading a text aloud: about 3 words a second, plus a margin. */
export function speakingTimeoutMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return 2500 + Math.ceil((words / 3) * 1000) * 2;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const holder = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return holder.SpeechRecognition || holder.webkitSpeechRecognition || null;
}

export function canListen(): boolean {
  return recognitionConstructor() !== null;
}

export type Listener = {
  start: () => void;
  stop: () => void;
};

/**
 * One-shot listener: the user taps the microphone, says one phrase, and the
 * transcript comes back through onResult. It never listens on its own.
 *
 * With `partial: true` the transcript is also delivered while the person is
 * still talking (isFinal=false). That lets a short command like "pular" act
 * right away instead of waiting for the silence that ends the phrase, which on
 * a phone takes a few seconds.
 */
export function createListener(handlers: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onStateChange: (listening: boolean) => void;
  onError: () => void;
  partial?: boolean;
}): Listener | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = Boolean(handlers.partial);
  recognition.maxAlternatives = 1;
  recognition.onstart = () => handlers.onStateChange(true);
  recognition.onend = () => handlers.onStateChange(false);
  recognition.onerror = (event) => {
    handlers.onStateChange(false);
    // "aborted" is just the user tapping stop; not worth a warning.
    const code = (event as { error?: string } | null)?.error;
    if (code !== "aborted") handlers.onError();
  };
  recognition.onresult = (event) => {
    const results = event.results;
    if (!results || results.length === 0) return;
    const last = results[results.length - 1];
    const transcript = last?.[0]?.transcript ?? "";
    handlers.onResult(transcript, Boolean(last?.isFinal));
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        handlers.onError();
      }
    },
    stop: () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}
