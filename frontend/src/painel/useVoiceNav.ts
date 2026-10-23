import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canListen, hear, speakAsync, stopSpeaking, type Hearing } from "../assistant/voiceIO";
import { browserStore, createPhraser, type Phraser } from "../novo/phrasing";
import type { Dictate } from "../novo/voice";
import type { VoiceBubbleTone } from "../novo/VoiceBubble";
import {
  SAY_BRIEF_FAIL,
  SAY_BRIEF_WAIT,
  SAY_DICTATED,
  SAY_DICTATE_LISTENING,
  SAY_DICTATE_NOT_HEARD,
  SAY_DICTATE_OFF,
  SAY_LISTENING,
  SAY_NOT_HEARD,
  SAY_NO_VOICE,
} from "../novo/voiceCopy";
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
  /** Busca os números do dia e devolve a fala pronta ("como está o dia?"). Se falhar, a bolinha diz que não conseguiu. Recebe o mesmo falador da bolinha. */
  onBrief: (phrase: Phraser) => Promise<string>;
};

/**
 * A bolinha de voz do painel: um toque abre o microfone, a pessoa fala uma tela ("pedidos", "mesas"), o painel abre a
 * tela e responde na tela e em voz alta. Tocar de novo enquanto ouve cancela. O celular só ouve depois do toque, nunca
 * por conta própria. O mesmo microfone serve ao ditado: o microfone ao lado de um campo de escrever (`dictate`) ouve uma
 * frase e entrega ao campo, que a pessoa vê e corrige; só há um microfone por vez. A conta do que fazer com as palavras está em `voiceNavLogic.ts` (com teste); aqui só há o microfone.
 *
 * As frases não repetem nem cansam: o falador (`novo/phrasing.ts`) sorteia entre várias formas sem repetir e encurta com
 * o uso. Ele guarda só a contagem de vezes de cada frase, no próprio celular; nenhum dado do restaurante.
 */
export function useVoiceNav(input: Input) {
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState<VoiceCaption | null>(null);
  /** O campo que está ouvindo agora (ditado), ou `null` (a bolinha comum ou ninguém). */
  const [field, setField] = useState<string | null>(null);
  const fieldNow = useRef<string | null>(null);
  const hearing = useRef<Hearing | null>(null);
  const turn = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(input);
  const talker = useRef<Phraser | null>(null);
  const phraser = useCallback((): Phraser => {
    if (!talker.current) talker.current = createPhraser({ store: browserStore() });
    return talker.current;
  }, []);

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

  const markField = useCallback((id: string | null) => {
    fieldNow.current = id;
    setField(id);
  }, []);

  /** Para de ouvir sem fazer nada: a resposta que ainda chegaria é descartada. */
  const cancelHearing = useCallback(() => {
    turn.current += 1;
    hearing.current?.cancel();
    hearing.current = null;
    setListening(false);
    markField(null);
  }, [markField]);

  const press = useCallback(() => {
    if (hearing.current) {
      // Tocar de novo enquanto ouve: cancela sem fazer nada.
      cancelHearing();
      close();
      return;
    }
    // O painel não fala por cima da pessoa, nem o microfone ouve o painel.
    stopSpeaking();
    const phrase = phraser();
    if (!canListen()) {
      show({ tone: "warn", heard: "", text: phrase.say(SAY_NO_VOICE) });
      return;
    }
    const mine = ++turn.current;
    setListening(true);
    // Uma frase só por toque: as palavras que a pessoa vai falando mudam, a frase de cima não pisca em outra.
    const invite = phrase.say(SAY_LISTENING);
    show({ tone: "listening", heard: "", text: invite });
    const listener = hear({
      onPartial: (words) => {
        if (mine === turn.current) show({ tone: "listening", heard: words, text: invite });
      },
    });
    hearing.current = listener;
    void listener.result.then((words) => {
      if (mine !== turn.current) return;
      hearing.current = null;
      setListening(false);
      const heard = (words ?? "").trim();
      if (!heard) {
        show({ tone: "warn", heard: "", text: phrase.say(SAY_NOT_HEARD) });
        return;
      }
      const { role, allowed, current, onGo, onBrief } = latest.current;
      const answer = interpretVoiceNav({ transcript: heard, role, allowed, current, phrase });
      if (answer.kind === "brief") {
        // A resposta vem do servidor, na hora. Se a pessoa tocar na bolinha de novo antes, a resposta velha é descartada.
        show({ tone: "answer", heard, text: phrase.say(SAY_BRIEF_WAIT) }, true);
        onBrief(phrase)
          .catch(() => phrase.say(SAY_BRIEF_FAIL))
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
  }, [cancelHearing, close, phraser, show]);

  /** O microfone ao lado de um campo: ouve uma frase e entrega ao campo (`apply` escreve e devolve o que escreveu). */
  const pressField = useCallback(
    (id: string, apply: (words: string) => string) => {
      if (hearing.current) {
        cancelHearing();
        close();
        return;
      }
      stopSpeaking();
      const phrase = phraser();
      if (!canListen()) {
        show({ tone: "warn", heard: "", text: phrase.say(SAY_DICTATE_OFF) });
        return;
      }
      const mine = ++turn.current;
      setListening(true);
      markField(id);
      const invite = phrase.say(SAY_DICTATE_LISTENING);
      show({ tone: "listening", heard: "", text: invite });
      const listener = hear({
        onPartial: (words) => {
          if (mine === turn.current) show({ tone: "listening", heard: words, text: invite });
        },
      });
      hearing.current = listener;
      void listener.result.then((words) => {
        if (mine !== turn.current) return;
        hearing.current = null;
        setListening(false);
        markField(null);
        const heard = (words ?? "").trim();
        // Escrever só depois de ouvir de verdade: sem fala, o campo fica como estava.
        const written = heard ? apply(heard) : "";
        if (!written) {
          show({ tone: "warn", heard: "", text: phrase.say(SAY_DICTATE_NOT_HEARD) });
          return;
        }
        const text = phrase.say(SAY_DICTATED, written);
        show({ tone: "answer", heard: "", text });
        void speakAsync(text).catch(() => undefined);
      });
    },
    [cancelHearing, close, markField, phraser, show],
  );

  // Se a tela muda enquanto um campo ouve, o campo que ia receber a fala já não está ali: para de ouvir.
  useEffect(() => {
    if (fieldNow.current === null) return;
    cancelHearing();
    close();
  }, [input.current, cancelHearing, close]);

  const dictate = useMemo<Dictate | undefined>(() => (canListen() ? { active: field, press: pressField } : undefined), [field, pressField]);

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

  return { press, listening, caption, close, dictate };
}
