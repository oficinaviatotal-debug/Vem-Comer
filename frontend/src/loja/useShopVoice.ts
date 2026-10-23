import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { canListen, hear, speakAsync, stopSpeaking, type Hearing } from "../assistant/voiceIO";
import type { CartLine } from "../customer/cart";
import type { Menu, Product } from "../customer/types";
import { VOICE_UNDO } from "../novo/copy";
import { browserStore, createPhraser, type Phraser } from "../novo/phrasing";
import { captionMs } from "../novo/speech";
import type { VoiceAction, VoiceBubbleTone } from "../novo/VoiceBubble";
import { SAY_NOT_HEARD, SAY_SHOP_LISTENING, SAY_SHOP_NO_VOICE, SAY_SHOP_REMOVED } from "../novo/voiceCopy";
import { bagText, cartWithAdded, cartWithLess, interpretShopVoice, type ShopScreenName } from "./shopVoiceLogic";
import type { ShopLoad } from "./useShop";

export type ShopVoiceCaption = { tone: VoiceBubbleTone; heard: string; text: string; actions?: readonly VoiceAction[] };

type Input = {
  /** A tela aberta agora. */
  screen: ShopScreenName;
  load: ShopLoad;
  products: readonly Product[];
  menus: readonly Menu[];
  cart: readonly CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  /** O restaurante não recebe pedido agora. */
  closed: boolean;
  hasTable: boolean;
  ordersCount: number;
  /** A caixa de busca existe no cardápio. */
  searchable: boolean;
  /** Abrir a tela que a voz entendeu. */
  onGo: (screen: ShopScreenName) => void;
  /** Abrir as escolhas de um prato (a pessoa toca em Adicionar). */
  onChoose: (product: Product, quantity: number) => void;
  /** Escrever na caixa de busca do cardápio. */
  onSearch: (text: string) => void;
};

/**
 * A bolinha de voz do cliente: um toque abre o microfone, a pessoa fala ("quero dois pastéis de carne", "buscar suco",
 * "abrir a sacola"), a tela faz o que ela pediu e a resposta aparece na faixa e sai em voz alta. Tocar de novo enquanto
 * ouve cancela. O celular só ouve depois do toque, nunca por conta própria. A conta do que fazer com as palavras está em
 * `shopVoiceLogic.ts` (com teste); aqui só há o microfone e a sacola.
 *
 * O que a voz muda é só a **sacola** (que a pessoa vê, e a faixa traz o botão Desfazer). **Ela nunca envia o pedido, nunca
 * paga e nunca chama o garçom**: este arquivo nem conhece essas ações. Prato com escolhas só abre a folha dele.
 *
 * As frases não repetem nem cansam (`novo/phrasing.ts`), com a contagem só no próprio celular.
 */
export function useShopVoice(input: Input) {
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState<ShopVoiceCaption | null>(null);
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
    (next: ShopVoiceCaption) => {
      clearTimer();
      setCaption(next);
      // Quem está ouvindo vê a frase até terminar; só as respostas somem sozinhas, no tempo de ler.
      if (next.tone !== "listening") timer.current = setTimeout(() => setCaption(null), captionMs(next.text));
    },
    [clearTimer],
  );

  const close = useCallback(() => {
    clearTimer();
    setCaption(null);
  }, [clearTimer]);

  /** O "Desfazer" da faixa: tira da sacola o que a voz acabou de pôr, e diz como a sacola ficou. */
  const undo = useCallback(
    (product: Product, quantity: number) => {
      const now = latest.current;
      const phrase = phraser();
      const after = cartWithLess(now.cart, product, quantity);
      now.setCart((current) => cartWithLess(current, product, quantity));
      const text = phrase.say(SAY_SHOP_REMOVED, product.name, bagText(after));
      show({ tone: "answer", heard: "", text });
      void speakAsync(text).catch(() => undefined);
    },
    [phraser, show],
  );

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
    // A tela não fala por cima da pessoa, nem o microfone ouve a tela.
    stopSpeaking();
    const phrase = phraser();
    if (!canListen()) {
      show({ tone: "warn", heard: "", text: phrase.say(SAY_SHOP_NO_VOICE) });
      return;
    }
    const mine = ++turn.current;
    setListening(true);
    // Uma frase só por toque: as palavras que a pessoa vai falando mudam, a frase de cima não pisca em outra.
    const invite = phrase.say(SAY_SHOP_LISTENING);
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
      const now = latest.current;
      const answer = interpretShopVoice({
        transcript: heard,
        screen: now.screen,
        load: now.load,
        products: now.products,
        menus: now.menus,
        cart: now.cart,
        closed: now.closed,
        hasTable: now.hasTable,
        ordersCount: now.ordersCount,
        searchable: now.searchable,
        phrase,
      });
      let actions: VoiceAction[] | undefined;
      switch (answer.kind) {
        case "go":
          now.onGo(answer.screen);
          break;
        case "search":
          if (answer.toMenu) now.onGo("menu");
          if (answer.fill) now.onSearch(answer.text);
          break;
        case "choose":
          if (answer.toMenu) now.onGo("menu");
          now.onChoose(answer.product, answer.quantity);
          break;
        case "add": {
          if (answer.toMenu) now.onGo("menu");
          now.setCart((current) => cartWithAdded(current, answer.product, answer.quantity));
          const { product, quantity } = answer;
          actions = [{ label: VOICE_UNDO, onPress: () => undo(product, quantity) }];
          break;
        }
        case "less":
          now.setCart((current) => cartWithLess(current, answer.product, answer.quantity));
          break;
        default:
          break;
      }
      const warn = answer.kind === "unknown" || (answer.kind === "stay" && answer.warn === true);
      show({ tone: warn ? "warn" : "answer", heard, text: answer.say, actions });
      void speakAsync(answer.say).catch(() => undefined);
    });
  }, [close, phraser, show, undo]);

  // Sair da tela corta o microfone e a fala.
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
