import { createContext, useContext } from "react";

/**
 * O que a bolinha de voz faz em qualquer tela do painel. O painel (a casca) liga a escuta uma vez e entrega aqui; cada
 * tela só desenha a bolinha, sem saber de onde vem a voz. Uma tela que tem a própria escuta (o Assistente do cardápio,
 * por exemplo) passa o `onPress` dela e a bolinha ignora o que vem daqui.
 */
export type VoiceControl = {
  /** Tocar na bolinha: começa a ouvir (ou para, se já está ouvindo). */
  onPress: () => void;
  /** O celular está ouvindo agora. */
  listening: boolean;
  /** Ditar num campo de escrever. Falta quando o celular não escuta (aí o microfone do campo nem aparece). */
  dictate?: Dictate;
};

/**
 * O microfone ao lado de um campo de escrever. A pessoa toca, fala, e o que ela disse vai para o campo (que ela vê e
 * pode corrigir); nada é salvo até ela tocar no botão de salvar de sempre. Só há um microfone por vez no painel.
 */
export type Dictate = {
  /** O `id` do campo que está ouvindo agora, ou `null`. */
  active: string | null;
  /**
   * Toque no microfone do campo `id`: ouve uma frase e entrega `apply(palavras)`, que escreve no campo e devolve o texto
   * que de fato escreveu (para o painel ler de volta). Tocar de novo enquanto ouve cancela e não escreve nada.
   */
  press: (id: string, apply: (words: string) => string) => void;
};

export const VoiceContext = createContext<VoiceControl | null>(null);

/** O controle da voz do painel, ou `null` fora dele (conferência de imagem, telas do cliente). */
export function useVoice(): VoiceControl | null {
  return useContext(VoiceContext);
}
