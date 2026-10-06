/**
 * Thin wrappers over the browser Speech APIs (pt-BR). Both are optional:
 * when the browser does not offer them, the guide keeps working with text
 * and buttons only.
 */

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
export function voiceScore(name: string, lang: string): number {
  const code = lang.toLowerCase().replace("_", "-");
  if (!code.startsWith("pt")) return -1;
  const label = name.toLowerCase();
  let score = code === "pt-br" ? 10 : 2; // pt-PT is understood, but it is not how the user speaks
  if (/natural|neural|online|premium|enhanced|wavenet/.test(label)) score += 8;
  if (/google/.test(label)) score += 5;
  if (/francisca|thalita|antonio|luciana|felipe|fernanda|vitoria|vitória/.test(label)) score += 3;
  if (/compact|espeak|pico/.test(label)) score -= 6;
  return score;
}

export function pickVoice(
  voices: Array<{ name: string; lang: string }>
): { name: string; lang: string } | undefined {
  let best: { name: string; lang: string } | undefined;
  let bestScore = 0;
  for (const voice of voices) {
    const score = voiceScore(voice.name, voice.lang);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

let chosenVoice: SpeechSynthesisVoice | undefined;
let voicesWatched = false;

function refreshVoice() {
  if (!canSpeak()) return;
  chosenVoice = pickVoice(window.speechSynthesis.getVoices()) as SpeechSynthesisVoice | undefined;
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

/** Reads the text aloud, replacing anything still being read. */
export function speak(text: string) {
  if (!canSpeak() || !text) return;
  try {
    prepareVoice();
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    if (chosenVoice) utterance.voice = chosenVoice;
    synth.speak(utterance);
  } catch {
    /* some browsers refuse speech until the user taps something */
  }
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
