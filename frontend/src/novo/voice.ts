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
};

export const VoiceContext = createContext<VoiceControl | null>(null);

/** O controle da voz do painel, ou `null` fora dele (conferência de imagem, telas do cliente). */
export function useVoice(): VoiceControl | null {
  return useContext(VoiceContext);
}
