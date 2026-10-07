/**
 * What the assistant says. Kept apart from the screen so every sentence can be
 * read, tested and changed in one place. Short on purpose: people who are in a
 * hurry stop listening to long sentences.
 */

import {
  currentCategory,
  currentPriceItem,
  selectedItems,
  type FlowState,
  type SpokenResult,
} from "./assistantFlow.ts";
import { spokenPrice } from "./assistantLogic.ts";

export const BUSINESS_QUESTION =
  "Vamos montar o seu cardápio. Fale os pratos com o preço, por exemplo: X-tudo, 25 reais. Ou diga o tipo do seu negócio: lanchonete, pizzaria, restaurante, bar, açaí, padaria, churrasco ou japonês.";

/** The first question when this server can read a photo of a menu. */
export const PHOTO_FIRST_QUESTION =
  "Vamos montar o seu cardápio. Fale os pratos com o preço, por exemplo: X-tudo, 25 reais. Se já tem um cardápio pronto, tire uma foto. Ou escolha o tipo do seu negócio.";

/** The speaking screen, before anything was said. */
export const SPEAK_QUESTION =
  "Pode falar. Diga cada prato com o preço, por exemplo: X-tudo, 25 reais. Coca lata, 6. Quando acabar, diga pronto.";

/** The speaking screen, after the first dishes. */
export const SPEAK_MORE = "Mais algum? Quando acabar, diga pronto.";

/** Nothing usable in what was said on the speaking screen. */
export const SPEAK_NOT_UNDERSTOOD = "Não peguei o prato. Fale o nome e o preço, por exemplo: Coca lata, 6.";

/** On the first screen, when the phrase is neither dishes, a photo nor a type of business. */
export const TYPE_NOT_UNDERSTOOD =
  "Não entendi. Pode falar os pratos com o preço, por exemplo: X-tudo, 25 reais. Ou toque numa das opções.";

/** What the assistant says back after a phrase on the speaking screen. Short: the list is on the screen. */
export function spokenFeedback(result: Pick<SpokenResult, "added" | "priced">): string {
  const parts: string[] = [];
  const { added, priced } = result;
  if (added.length === 1) {
    const dish = added[0];
    parts.push(dish.price ? `Anotei ${dish.name}, ${spokenPrice(dish.price)}.` : `Anotei ${dish.name}. Quanto custa?`);
  } else if (added.length > 1) {
    const missing = added.filter((dish) => !dish.price).length;
    parts.push(`Anotei ${added.length} pratos.`);
    if (missing === 1) parts.push("Um ficou sem preço.");
    else if (missing > 1) parts.push(`${missing} ficaram sem preço.`);
  }
  for (const dish of priced.slice(0, 2)) parts.push(`${dish.name}, ${spokenPrice(dish.price)}.`);
  if (priced.length > 2) parts.push(`E mais ${priced.length - 2} preços.`);
  return parts.join(" ");
}

export const PHOTO_QUESTION =
  "Tire uma foto do seu cardápio, de frente e com boa luz. Se ele tiver mais de uma página, tire uma foto de cada.";

/** After the owner gives up on the photo and goes back to the list of business types. */
export const CHOOSE_TYPE_QUESTION =
  "Tudo bem. Qual é o tipo do seu negócio? Lanchonete, pizzaria, restaurante, bar, açaí, padaria, churrasco ou japonês?";

export const PHOTO_NOT_AVAILABLE =
  "Ainda não leio foto de cardápio por aqui. Escolha o tipo do seu negócio e marque os pratos que você vende.";

export const PHOTO_STEP_HINT =
  "Toque em Tirar foto do cardápio. Se preferir, diga o tipo do seu negócio.";

export const READING_NOTICE = "Estou lendo o seu cardápio. Pode levar até um minuto.";

export const MORE_OR_DONE = "Mais algum? Ou diga pronto.";

/** The question for the current step. `intro` adds the first-time explanation of a step. */
export function promptFor(state: FlowState, intro = false, photoMenu = false): string {
  switch (state.step) {
    case "type":
      return photoMenu ? PHOTO_FIRST_QUESTION : BUSINESS_QUESTION;

    case "photo":
      return PHOTO_QUESTION;

    case "speak":
      return selectedItems(state).length === 0 ? SPEAK_QUESTION : SPEAK_MORE;

    case "pick": {
      const category = currentCategory(state);
      if (!category) return BUSINESS_QUESTION;
      if (state.source === "photo") {
        return `${category.name}. Estes são os pratos que li. Toque nos que você não vende para tirar, ou fale o que faltou. Quando acabar, diga pronto.`;
      }
      return `${category.name}. Toque nos pratos que você vende, ou fale os nomes. Quando acabar, diga pronto.`;
    }

    case "prices": {
      const item = currentPriceItem(state);
      if (!item) return "Vamos conferir.";
      const ask = `${item.name}. Quanto custa?`;
      if (!intro) return ask;
      if (state.source === "photo") return `Faltam alguns preços que não consegui ler. ${ask}`;
      if (state.source === "speech") return `Faltou o preço de alguns. ${ask}`;
      return `Agora os preços, um de cada vez. ${ask}`;
    }

    case "review": {
      const total = selectedItems(state).length;
      return `Confira o cardápio. São ${total} ${total === 1 ? "prato" : "pratos"}. Se estiver certo, diga cadastrar.`;
    }

    case "saving":
      return "Cadastrando o seu cardápio…";

    case "done": {
      const total = selectedItems(state).length;
      return `Pronto! ${total} ${total === 1 ? "prato cadastrado" : "pratos cadastrados"}. O seu cardápio já está no ar.`;
    }
  }
}

/** Short label for the progress line at the top. */
export function progressText(state: FlowState): string {
  if (state.source === "speech") {
    const missing = selectedItems(state).filter((item) => !item.price).length;
    switch (state.step) {
      case "speak": {
        const total = selectedItems(state).length;
        return `Passo 1 de 3 · Fale os pratos${total > 0 ? ` · ${total} anotado${total === 1 ? "" : "s"}` : ""}`;
      }
      case "prices":
        return `Passo 2 de 3 · Preços que faltam · ${missing === 1 ? "falta 1" : `faltam ${missing}`}`;
      case "review":
      case "saving":
        return "Passo 3 de 3 · Conferir";
      case "done":
        return "Cardápio cadastrado";
      default:
        break;
    }
  }
  if (state.source === "photo") {
    const missing = selectedItems(state).filter((item) => !item.price).length;
    switch (state.step) {
      case "prices":
        return `Passo 2 de 3 · Preços que faltam · ${missing === 1 ? "falta 1" : `faltam ${missing}`}`;
      case "pick": {
        const category = currentCategory(state);
        return `Pratos${category ? ` · ${category.name} (${state.categoryIndex + 1} de ${state.categories.length})` : ""}`;
      }
      case "review":
      case "saving":
        return "Passo 3 de 3 · Conferir";
      case "done":
        return "Cardápio cadastrado";
      default:
        break;
    }
  }
  switch (state.step) {
    case "type":
      return "Passo 1 de 4 · Tipo de negócio";
    case "photo":
      return "Passo 1 de 3 · Foto do cardápio";
    case "speak":
      return "Passo 1 de 3 · Fale os pratos";
    case "pick": {
      const category = currentCategory(state);
      return `Passo 2 de 4 · Pratos${category ? ` · ${category.name} (${state.categoryIndex + 1} de ${state.categories.length})` : ""}`;
    }
    case "prices": {
      const total = selectedItems(state).length;
      return `Passo 3 de 4 · Preços · ${Math.min(state.priceCursor + 1, total)} de ${total}`;
    }
    case "review":
    case "saving":
      return "Passo 4 de 4 · Conferir";
    case "done":
      return "Cardápio cadastrado";
  }
}
