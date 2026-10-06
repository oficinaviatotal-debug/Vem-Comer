import {
  cleanDictatedText,
  matchChoice,
  parseSpokenNumber,
  type DictationKind,
} from "./tourEngine.ts";

/**
 * Writes what the person said into the form field the guide is pointing at.
 * Pure DOM, no React: the field's own React state is updated through the same
 * event a keyboard would fire, so the form behaves as if it had been typed.
 */

export type FillOutcome = {
  ok: boolean;
  /** Shown on the guide card. */
  message: string;
  /** Read aloud when the guide's voice is on (numbers written out, no symbols). */
  spoken: string;
};

/** Sets the value the way a person typing would, so React notices the change. */
export function setFieldValue(element: HTMLElement, value: string): boolean {
  let prototype: object | null = null;
  let eventName = "input";
  if (element instanceof HTMLInputElement) {
    prototype = HTMLInputElement.prototype;
  } else if (element instanceof HTMLTextAreaElement) {
    prototype = HTMLTextAreaElement.prototype;
  } else if (element instanceof HTMLSelectElement) {
    prototype = HTMLSelectElement.prototype;
    eventName = "change";
  }
  if (!prototype) return false;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) return false;
  setter.call(element, value);
  element.dispatchEvent(new Event(eventName, { bubbles: true }));
  return true;
}

function failure(message: string): FillOutcome {
  return { ok: false, message, spoken: message };
}

/** "49.90" -> "49 reais e 90 centavos", so the voice does not read symbols. */
function priceInWords(value: string): string {
  const [reais, cents] = value.split(".");
  const money = `${reais} ${reais === "1" ? "real" : "reais"}`;
  return cents && cents !== "00" ? `${money} e ${Number(cents)} centavos` : money;
}

export const DICTATE_HINT: Record<DictationKind, string> = {
  text: "Toque em Falar e diga o nome.",
  price: "Toque em Falar e diga o preço. Exemplo: quarenta e nove e noventa.",
  integer: "Toque em Falar e diga o número.",
  choice: "Toque em Falar e diga o nome da categoria.",
};

export function fillFromSpeech(
  element: HTMLElement | null,
  kind: DictationKind,
  transcript: string
): FillOutcome {
  if (!element) return failure("Não achei o campo na tela. Escreva com o teclado.");

  if (kind === "text") {
    const value = cleanDictatedText(transcript);
    if (!value || !setFieldValue(element, value)) {
      return failure("Não consegui escrever. Use o teclado.");
    }
    return {
      ok: true,
      message: `Escrevi: “${value}”. Se estiver certo, toque em Próximo.`,
      spoken: `Escrevi ${value}. Se estiver certo, diga próximo.`,
    };
  }

  if (kind === "price" || kind === "integer") {
    const value = parseSpokenNumber(transcript, kind === "price");
    if (value === null) {
      return failure(
        kind === "price"
          ? "Não entendi o preço. Diga só o valor, por exemplo: quarenta e nove e noventa."
          : "Não entendi o número. Diga só o número, por exemplo: cinco."
      );
    }
    if (!setFieldValue(element, value)) return failure("Não consegui escrever. Use o teclado.");
    return kind === "price"
      ? {
          ok: true,
          message: `Escrevi o preço: R$ ${value.replace(".", ",")}. Se estiver certo, toque em Próximo.`,
          spoken: `Escrevi o preço: ${priceInWords(value)}. Se estiver certo, diga próximo.`,
        }
      : {
          ok: true,
          message: `Escrevi o número ${value}. Se estiver certo, toque em Próximo.`,
          spoken: `Escrevi o número ${value}. Se estiver certo, diga próximo.`,
        };
  }

  // kind === "choice"
  if (!(element instanceof HTMLSelectElement)) {
    return failure("Toque no campo e escolha na lista.");
  }
  const options = Array.from(element.options).filter((option) => option.value !== "");
  if (options.length === 0) {
    return failure("Ainda não há categoria para escolher. Volte e cadastre uma.");
  }
  const index = matchChoice(
    transcript,
    options.map((option) => option.text)
  );
  if (index < 0) return failure("Não achei essa categoria. Toque no campo e escolha na lista.");
  const chosen = options[index];
  if (!setFieldValue(element, chosen.value)) return failure("Toque no campo e escolha na lista.");
  return {
    ok: true,
    message: `Escolhi: “${chosen.text}”. Se estiver certo, toque em Próximo.`,
    spoken: `Escolhi ${chosen.text}. Se estiver certo, diga próximo.`,
  };
}
