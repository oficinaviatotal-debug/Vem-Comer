/**
 * Thin wrappers over the browser Speech APIs (pt-BR). Both are optional:
 * when the browser does not offer them, the guide keeps working with text
 * and buttons only.
 */

type RecognitionEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Reads the text aloud, replacing anything still being read. */
export function speak(text: string) {
  if (!canSpeak() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    const voice = synth
      .getVoices()
      .find((item) => item.lang.toLowerCase().replace("_", "-") === "pt-br");
    if (voice) utterance.voice = voice;
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
 */
export function createListener(handlers: {
  onResult: (transcript: string) => void;
  onStateChange: (listening: boolean) => void;
  onError: () => void;
}): Listener | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => handlers.onStateChange(true);
  recognition.onend = () => handlers.onStateChange(false);
  recognition.onerror = (event) => {
    handlers.onStateChange(false);
    // "aborted" is just the user tapping stop; not worth a warning.
    const code = (event as { error?: string } | null)?.error;
    if (code !== "aborted") handlers.onError();
  };
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    handlers.onResult(transcript);
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
