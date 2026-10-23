import "./novo.css";
import { fitDictation, joinDictation } from "./dictation";
import NvIcon from "./Icons";
import { useVoice } from "./voice";

type Props = {
  /** Identifica o campo (o `id` dele): só o campo que está ouvindo fica marcado. */
  id: string;
  /** O que o leitor de tela fala ("Falar o nome do prato"). */
  label: string;
  /** Recebe o que a pessoa disse, já arrumado, para escrever no campo no lugar do que estava. */
  onText: (text: string) => void;
  /** O limite de letras do campo. */
  max?: number;
  /** Campo de várias linhas: o que a pessoa fala vai depois do que já está escrito (`value`), em vez de trocar tudo. */
  append?: boolean;
  /** O que está escrito no campo agora (só importa com `append`). */
  value?: string;
  /** Campo ocupado (salvando): o microfone some, como o campo fica só de leitura. */
  disabled?: boolean;
};

/**
 * O microfone ao lado de um campo de escrever. Só visual e só props: quem ouve é o painel (`novo/voice.ts`).
 * Fora do painel (conferência de imagem, telas do cliente) e em celular que não escuta, o botão **não aparece**:
 * botão que não leva a lugar nenhum não entra. O que a pessoa fala **substitui** o que estava no campo (ela vê o resultado
 * na hora e pode corrigir à mão), a não ser em campo de várias linhas (`append`), onde vai depois do que já está escrito.
 * Se o celular não ouvir nada, o campo fica como estava.
 */
export default function DictateButton({ id, label, onText, max, append = false, value = "", disabled = false }: Props) {
  const dictate = useVoice()?.dictate;
  if (!dictate || disabled) return null;
  const hearing = dictate.active === id;
  return (
    <button
      type="button"
      className={`nv-dictate${hearing ? " is-listening" : ""}`}
      aria-label={label}
      aria-pressed={hearing}
      onClick={() =>
        dictate.press(id, (words) => {
          const text = fitDictation(words, append ? undefined : max);
          if (text) onText(append ? joinDictation(value, words, max) : text);
          return text;
        })
      }
    >
      <NvIcon name="mic" />
    </button>
  );
}
