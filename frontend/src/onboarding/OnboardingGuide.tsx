import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyCommand,
  nextStep,
  parseTourCommand,
  prevStep,
  progressLabel,
  skipTour,
  startTour,
  type TourState,
  type TourStep,
} from "./tourEngine";
import {
  isGuideVoiceEnabled,
  setGuideVoiceEnabled,
} from "./guideStorage";
import {
  canListen,
  canSpeak,
  createListener,
  speak,
  stopSpeaking,
  type Listener,
} from "./speech";

type Props = {
  steps: TourStep[];
  /** Called once when the tour ends. finished=false means it was skipped. */
  onClose: (finished: boolean) => void;
  /** Called when a step lives in another screen/tab of the host app. */
  onNavigate?: (view: string) => void;
};

type Box = { top: number; left: number; width: number; height: number };

const RING_PADDING = 6;
const FIND_ATTEMPTS = 20;
const FIND_INTERVAL_MS = 100;

function findTarget(selector: string | undefined): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function measure(element: HTMLElement): Box | null {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top - RING_PADDING,
    left: rect.left - RING_PADDING,
    width: rect.width + RING_PADDING * 2,
    height: rect.height + RING_PADDING * 2,
  };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Talking, blinking guide. It reads each step aloud, blinks on the exact
 * element to touch, and understands what the user says ("próximo", "voltar",
 * "repetir", "pular"). The host app only supplies the steps.
 */
export default function OnboardingGuide({ steps, onClose, onNavigate }: Props) {
  const total = steps.length;
  const [state, setState] = useState<TourState>(startTour);
  const [box, setBox] = useState<Box | null>(null);
  const [voiceOn, setVoiceOn] = useState<boolean>(() => isGuideVoiceEnabled());
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState("");
  const [micAvailable] = useState<boolean>(() => canListen());
  const [voiceAvailable] = useState<boolean>(() => canSpeak());

  const step: TourStep | undefined = steps[Math.min(state.index, total - 1)];
  const closedRef = useRef(false);
  const listenerRef = useRef<Listener | null>(null);
  const onCloseRef = useRef(onClose);
  const onNavigateRef = useRef(onNavigate);
  const stateRef = useRef(state);

  useEffect(() => {
    onCloseRef.current = onClose;
    onNavigateRef.current = onNavigate;
  }, [onClose, onNavigate]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Tell the host once when the tour is over.
  useEffect(() => {
    if (state.done && !closedRef.current) {
      closedRef.current = true;
      stopSpeaking();
      onCloseRef.current(state.finished);
    }
  }, [state.done, state.finished]);

  // Stop talking and listening when the guide goes away.
  useEffect(() => {
    return () => {
      stopSpeaking();
      listenerRef.current?.stop();
    };
  }, []);

  const readStep = useCallback(
    (target: TourStep | undefined) => {
      if (!voiceOn || !target) return;
      speak(`${target.title}. ${target.text}`);
    },
    [voiceOn]
  );

  // New step: go to its screen, then read it aloud.
  useEffect(() => {
    if (!step) return;
    setNotice("");
    setHeard("");
    if (step.view) onNavigateRef.current?.(step.view);
    readStep(step);
    // Only a change of step should re-read; toggling voice is handled in toggleVoice.
  }, [state.index]);

  // Find the element to blink on. The screen may still be rendering, so retry
  // briefly before giving up (the card still works without the ring).
  useEffect(() => {
    if (!step?.target) {
      setBox(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const locate = () => {
      if (cancelled) return;
      const element = findTarget(step.target);
      if (element) {
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
        setBox(measure(element));
        return;
      }
      attempts += 1;
      if (attempts < FIND_ATTEMPTS) {
        timer = window.setTimeout(locate, FIND_INTERVAL_MS);
      } else {
        setBox(null);
      }
    };

    setBox(null);
    locate();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [step?.target, state.index]);

  // Keep the ring glued to the element while the page scrolls or resizes.
  useEffect(() => {
    if (!step?.target) return;
    const selector = step.target;
    let frame = 0;

    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const element = findTarget(selector);
        if (!element) return;
        const next = measure(element);
        setBox((current) => (sameBox(current, next) ? current : next));
      });
    };

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const interval = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.clearInterval(interval);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [step?.target, state.index]);

  // Tapping the highlighted element moves the guide forward by itself.
  useEffect(() => {
    if (!step?.target || !step.advanceOnClick) return;
    const element = findTarget(step.target);
    if (!element) return;
    const index = state.index;
    let timer: number | undefined;

    const onTap = () => {
      timer = window.setTimeout(() => {
        // Ignore if the user already moved on with voice or buttons.
        if (stateRef.current.index === index) {
          setState((current) => nextStep(current, total));
        }
      }, 350);
    };

    element.addEventListener("click", onTap);
    return () => {
      element.removeEventListener("click", onTap);
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // box changes once the element exists, so listen again if it appears late.
  }, [step?.target, step?.advanceOnClick, state.index, total, box !== null]);

  // Esc closes the guide.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setState((current) => skipTour(current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSpeech = useCallback(
    (transcript: string) => {
      setHeard(transcript);
      const command = parseTourCommand(transcript);
      if (command === "unknown") {
        setNotice("Não entendi. Tente dizer: próximo, voltar, repetir ou pular.");
        return;
      }
      setNotice("");
      if (command === "repeat") {
        readStep(steps[Math.min(stateRef.current.index, total - 1)]);
        return;
      }
      setState((current) => applyCommand(current, command, total));
    },
    [readStep, steps, total]
  );

  const handleSpeechRef = useRef(handleSpeech);
  useEffect(() => {
    handleSpeechRef.current = handleSpeech;
  }, [handleSpeech]);

  // The listener is created once and always calls the latest handler.
  useEffect(() => {
    listenerRef.current = createListener({
      onResult: (transcript) => handleSpeechRef.current(transcript),
      onStateChange: setListening,
      onError: () =>
        setNotice(
          "Não consegui usar o microfone. Libere o microfone no navegador ou use os botões."
        ),
    });
    return () => {
      listenerRef.current?.stop();
      listenerRef.current = null;
    };
  }, []);

  function toggleMic() {
    if (!listenerRef.current) return;
    if (listening) {
      listenerRef.current.stop();
      return;
    }
    stopSpeaking(); // so the microphone does not hear the guide itself
    setNotice("");
    listenerRef.current.start();
  }

  function toggleVoice() {
    const enabled = !voiceOn;
    setVoiceOn(enabled);
    setGuideVoiceEnabled(enabled);
    if (!enabled) stopSpeaking();
    else if (step) speak(`${step.title}. ${step.text}`);
  }

  const placement = useMemo<"top" | "bottom">(() => {
    if (!box) return "bottom";
    const center = box.top + box.height / 2;
    return center > window.innerHeight / 2 ? "top" : "bottom";
  }, [box]);

  if (!step) return null;

  const isLast = state.index >= total - 1;
  const percent = Math.round(((state.index + 1) / Math.max(total, 1)) * 100);

  return (
    <div className="tour-root" role="dialog" aria-label="Guia passo a passo">
      {box && (
        <div
          className="tour-ring"
          aria-hidden="true"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        />
      )}

      <div className={`tour-card tour-card-${placement}`}>
        <div className="tour-top">
          <span className="tour-progress-label">{progressLabel(state, total)}</span>
          {voiceAvailable && (
            <button
              type="button"
              className="tour-link-button"
              onClick={() => speak(`${step.title}. ${step.text}`)}
            >
              Ouvir de novo
            </button>
          )}
          {voiceAvailable && (
            <button
              type="button"
              className="tour-icon-button"
              onClick={toggleVoice}
              aria-pressed={voiceOn}
              aria-label={voiceOn ? "Desligar a voz do guia" : "Ligar a voz do guia"}
              title={voiceOn ? "Desligar a voz" : "Ligar a voz"}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
          )}
        </div>

        <div className="tour-bar" aria-hidden="true">
          <div className="tour-bar-fill" style={{ width: `${percent}%` }} />
        </div>

        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-text" aria-live="polite">
          {step.text}
        </p>

        {step.say && micAvailable && (
          <p className="tour-say">
            Você pode dizer: <strong>“{step.say}”</strong>
          </p>
        )}
        {heard && <p className="tour-heard">Ouvi: “{heard}”</p>}
        {notice && <p className="tour-notice">{notice}</p>}

        <div className="tour-actions">
          <button
            type="button"
            className="tour-button tour-button-secondary"
            onClick={() => setState((current) => prevStep(current))}
            disabled={state.index === 0}
          >
            Voltar
          </button>

          {micAvailable && (
            <button
              type="button"
              className={
                listening
                  ? "tour-button tour-button-mic tour-listening"
                  : "tour-button tour-button-mic"
              }
              onClick={toggleMic}
              aria-label={listening ? "Parar de ouvir" : "Falar com o guia"}
            >
              {listening ? "Ouvindo…" : "🎙️ Falar"}
            </button>
          )}

          <button
            type="button"
            className="tour-button tour-button-primary"
            onClick={() => setState((current) => nextStep(current, total))}
          >
            {isLast ? "Concluir" : "Próximo"}
          </button>
        </div>

        <button
          type="button"
          className="tour-skip"
          onClick={() => setState((current) => skipTour(current))}
        >
          Pular guia
        </button>
      </div>
    </div>
  );
}
