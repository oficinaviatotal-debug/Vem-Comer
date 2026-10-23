import { useCallback, useEffect, useRef, useState } from "react";
import { canListen, hear, speakAsync, stopSpeaking, type Hearing } from "../assistant/voiceIO";
import { BRIEF_FAIL, VOICE_BRIEF_WAIT, VOICE_LISTENING, VOICE_NOT_HEARD, VOICE_OFF } from "../novo/copy";
import type { VoiceBubbleTone } from "../novo/VoiceBubble";
import { captionMs, interpretVoiceNav } from "./voiceNavLogic";

export type VoiceCaption = { tone: VoiceBubbleTone; heard: string; text: string };


type Input = {
  role: string | null | undefined;
  /** As telas que o menu mostra a esta pessoa agora. */
  allowed: readonly string[];
  /** A tela aberta agora. */
  current: string;
  /** Abrir a tela que a voz entendeu. */
  onGo: (view: string) => void;
  /** Busca os números do dia e devolve a fala pronta ("como está o dia?"). Se falhar, a bolinha diz que não conseguiu. */
  onBrief: () => Promise<string>;
};

/**
 * A bolinha de voz do painel: um toque abre o microfone, a pessoa fala uma tela ("pedidos", "mesas"), o painel abre a
 * tela e responde na tela e em voz alta. Tocar de novo enquanto ouve cancela. O celular só ouve depois do toque, nunca
 * por conta própria. A conta do que fazer com as palavras está em `voiceNavLogic.ts` (com teste); aqui só há o microfone.
 */
export function useVoiceNav(input: Input) {
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState<VoiceCaption | null>(null);
  const hearing = useRef<Hearing | null>(null);
  const turn = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(input);

  useEffect(() => {
    latest.current = input;
  });

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const show = useCallback(
    (next: VoiceCaption, stays = false) => {
      clearTimer();
      setCaption(next);
      // Quem está ouvindo (ou esperando os números) vê a frase até terminar; só as respostas somem sozinhas, no tempo de ler.
      if (next.tone !== "listening" && !stays) timer.current = setTimeout(() => setCaption(null), captionMs(next.text));
    },
    [clearTimer],
  );

  const close = useCallback(() => {
    clearTimer();
    setCaption(null);
  }, [clearTimer]);

  const press = useCallback(() => {
    if (hearing.current) {
      // Tocar de novo enquanto ouve: cancela sem fazer nada.
      turn.current += 1;
      hearing.current.cancel();
      hearing.current = null;
      setListening(false);
      close();
      return;
    }
    // O painel não fala por cima da pessoa, nem o microfone ouve o painel.
    stopSpeaking();
    if (!canListen()) {
      show({ tone: "warn", heard: "", text: VOICE_OFF });
      return;
    }
    const mine = ++turn.current;
    setListening(true);
    show({ tone: "listening", heard: "", text: VOICE_LISTENING });
    const listener = hear({
      onPartial: (words) => {
        if (mine === turn.current) show({ tone: "listening", heard: words, text: VOICE_LISTENING });
      },
    });
    hearing.current = listener;
    void listener.result.then((words) => {
      if (mine !== turn.current) return;
      hearing.current = null;
      setListening(false);
      const heard = (words ?? "").trim();
      if (!heard) {
        show({ tone: "warn", heard: "", text: VOICE_NOT_HEARD });
        return;
      }
      const { role, allowed, current, onGo, onBrief } = latest.current;
      const answer = interpretVoiceNav({ transcript: heard, role, allowed, current });
      if (answer.kind === "brief") {
        // A resposta vem do servidor, na hora. Se a pessoa tocar na bolinha de novo antes, a resposta velha é descartada.
        show({ tone: "answer", heard, text: VOICE_BRIEF_WAIT }, true);
        onBrief()
          .catch(() => BRIEF_FAIL)
          .then((text) => {
            if (mine !== turn.current) return;
            show({ tone: "answer", heard, text });
            void speakAsync(text).catch(() => undefined);
          });
        return;
      }
      if (answer.kind === "go") onGo(answer.view);
      show({ tone: answer.kind === "unknown" ? "warn" : "answer", heard, text: answer.say });
      void speakAsync(answer.say).catch(() => undefined);
    });
  }, [close, show]);

  // Sair do painel (ou a tela sumir) corta o microfone e a fala.
  useEffect(
    () => () => {
      turn.current += 1;
      hearing.current?.cancel();
      hearing.current = null;
      stopSpeaking();
      if (timer.current !== undefined) clearTimeout(timer.current);
    },
    [],
  );

  return { press, listening, caption, close };
}
