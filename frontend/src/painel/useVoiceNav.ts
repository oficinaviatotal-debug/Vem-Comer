import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canListen, hear, speakAsync, stopSpeaking, type Hearing } from "../assistant/voiceIO";
import { browserStore, createPhraser, type Phraser } from "../novo/phrasing";
import type { Dictate } from "../novo/voice";
import type { VoiceAction, VoiceBubbleTone } from "../novo/VoiceBubble";
import { VOICE_NO, VOICE_YES } from "../novo/copy";
import {
  SAY_BRIEF_FAIL,
  SAY_BRIEF_WAIT,
  SAY_DICTATED,
  SAY_DICTATE_LISTENING,
  SAY_DICTATE_NOT_HEARD,
  SAY_DICTATE_OFF,
  SAY_DISH_CANCELED,
  SAY_DISH_DOING,
  SAY_DISH_LOAD_FAIL,
  SAY_DISH_WAIT,
  SAY_LISTENING,
  SAY_NOT_HEARD,
  SAY_NO_VOICE,
} from "../novo/voiceCopy";
import type { AskedDish } from "./voiceDish";
import { ASK_MS, confirmationOf, type DishAction, type DishOffer } from "./voiceDishLogic";
import { captionMs, interpretVoiceNav } from "./voiceNavLogic";

export type VoiceCaption = { tone: VoiceBubbleTone; heard: string; text: string; actions?: readonly VoiceAction[] };

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
  /** "Acabou o pastel": busca os pratos na hora e devolve a pergunta de confirmação (ou o motivo de não haver). **Só lê, nada muda.** */
  onDish: (action: DishAction, words: string[], phrase: Phraser) => Promise<DishOffer>;
  /** Depois do "sim": marca o prato no servidor e devolve a fala com o que o servidor confirmou. */
  onDishDo: (offer: AskedDish, phrase: Phraser) => Promise<{ say: string; done: boolean }>;
};

/**
 * A bolinha de voz do painel: um toque abre o microfone, a pessoa fala uma tela ("pedidos", "mesas"), o painel abre a
 * tela e responde na tela e em voz alta. Tocar de novo enquanto ouve cancela. O celular só ouve depois do toque, nunca
 * por conta própria. O mesmo microfone serve ao ditado: o microfone ao lado de um campo de escrever (`dictate`) ouve uma
 * frase e entrega ao campo, que a pessoa vê e corrige; só há um microfone por vez. A conta do que fazer com as palavras
 * está em `voiceNavLogic.ts` (com teste); aqui só há o microfone.
 *
 * "Acabou o pastel" é a única coisa que a voz **muda**, e nunca muda na primeira frase: a voz acha o prato, diz o nome que
 * entendeu e **pergunta**. Só o "sim" (no botão da faixa ou falado na bolinha) manda ao servidor. "Não", outra frase,
 * Fechar ou 30 segundos sem resposta esquecem a pergunta: nada muda (regras em `voiceDishLogic.ts`).
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
  /** A pergunta "marcar como esgotado?" que espera o "sim". Só existe uma, e some sozinha. */
  const pending = useRef<AskedDish | null>(null);
  const askTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  /** Esquece a pergunta que esperava o "sim": nada é marcado. */
  const dropPending = useCallback(() => {
    pending.current = null;
    if (askTimer.current !== undefined) clearTimeout(askTimer.current);
    askTimer.current = undefined;
  }, []);

  const close = useCallback(() => {
    clearTimer();
    dropPending();
    setCaption(null);
  }, [clearTimer, dropPending]);

  const markField = useCallback((id: string | null) => {
    fieldNow.current = id;
    setField(id);
  }, []);

  /** Para de ouvir sem fazer nada: a resposta que ainda chegaria é descartada. */
  const cancelHearing = useCallback(() => {
    dropPending();
    turn.current += 1;
    hearing.current?.cancel();
    hearing.current = null;
    setListening(false);
    markField(null);
  }, [dropPending, markField]);

  /** Marcar o prato (depois do "sim", falado ou no botão): vai ao servidor e diz o que ele confirmou. */
  const confirmDish = useCallback(() => {
    const asked = pending.current;
    if (!asked) return;
    dropPending();
    const phrase = phraser();
    // Nenhum microfone aberto, e a resposta velha de antes não cobre esta.
    const mine = ++turn.current;
    hearing.current?.cancel();
    hearing.current = null;
    setListening(false);
    show({ tone: "answer", heard: "", text: phrase.say(SAY_DISH_DOING) }, true);
    void latest.current
      .onDishDo(asked, phrase)
      .catch(() => ({ say: "", done: false }))
      .then((result) => {
        if (mine !== turn.current) return;
        const text = result.say || phrase.say(SAY_DISH_LOAD_FAIL);
        show({ tone: result.done ? "answer" : "warn", heard: "", text });
        void speakAsync(text).catch(() => undefined);
      });
  }, [dropPending, phraser, show]);

  /** Mostra a pergunta com os botões Sim e Não, fala em voz alta e espera (30 s) o "sim". */
  const askDish = useCallback(
    (offer: AskedDish, heard: string) => {
      dropPending();
      pending.current = offer;
      askTimer.current = setTimeout(() => {
        // Sem resposta: a pergunta some e nada é marcado.
        pending.current = null;
        askTimer.current = undefined;
        setCaption((now) => (now?.actions ? null : now));
      }, ASK_MS);
      const actions: VoiceAction[] = [
        { label: VOICE_YES, primary: true, onPress: () => confirmDish() },
        {
          label: VOICE_NO,
          onPress: () => {
            const text = phraser().say(SAY_DISH_CANCELED);
            dropPending();
            show({ tone: "answer", heard: "", text });
          },
        },
      ];
      show({ tone: "answer", heard, text: offer.say, actions }, true);
      void speakAsync(offer.say).catch(() => undefined);
    },
    [confirmDish, dropPending, phraser, show],
  );

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
        // A pergunta saiu da tela enquanto o microfone ouvia: sem resposta clara, ela não vale mais.
        dropPending();
        show({ tone: "warn", heard: "", text: phrase.say(SAY_NOT_HEARD) });
        return;
      }
      const { role, allowed, current, onGo, onBrief, onDish } = latest.current;
      // Havia uma pergunta esperando o "sim"? "Sim" marca, "não" esquece; qualquer outra frase também esquece (nada muda).
      if (pending.current) {
        const reply = confirmationOf(heard);
        if (reply === "yes") {
          confirmDish();
          return;
        }
        dropPending();
        if (reply === "no") {
          const text = phrase.say(SAY_DISH_CANCELED);
          show({ tone: "answer", heard, text });
          void speakAsync(text).catch(() => undefined);
          return;
        }
      }
      const answer = interpretVoiceNav({ transcript: heard, role, allowed, current, phrase });
      if (answer.kind === "dish") {
        // Achar o prato só lê a lista do servidor. A pergunta sai daqui; marcar só depois do "sim".
        show({ tone: "answer", heard, text: phrase.say(SAY_DISH_WAIT) }, true);
        onDish(answer.action, answer.words, phrase)
          .catch((): DishOffer => ({ kind: "info", say: phrase.say(SAY_DISH_LOAD_FAIL), warn: true }))
          .then((offer) => {
            if (mine !== turn.current) return;
            if (offer.kind === "ask") {
              askDish(offer, heard);
              return;
            }
            if (offer.open) latest.current.onGo(offer.open);
            show({ tone: offer.warn ? "warn" : "answer", heard, text: offer.say });
            void speakAsync(offer.say).catch(() => undefined);
          });
        return;
      }
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
  }, [askDish, cancelHearing, close, confirmDish, dropPending, phraser, show]);

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
      if (askTimer.current !== undefined) clearTimeout(askTimer.current);
    },
    [],
  );

  return { press, listening, caption, close, dictate };
}
