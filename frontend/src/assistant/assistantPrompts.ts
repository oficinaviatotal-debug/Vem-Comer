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
} from "./assistantFlow.ts";

export const BUSINESS_QUESTION =
  "Vamos montar o seu cardápio. Qual é o tipo do seu negócio? Lanchonete, pizzaria, restaurante, bar, açaí, padaria, churrasco ou japonês?";

/** The first question when this server can read a photo of a menu. */
export const PHOTO_FIRST_QUESTION =
  "Vamos montar o seu cardápio. Você já tem um cardápio pronto? Então tire uma foto dele. Se não tiver, escolha o tipo do seu negócio.";

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
      return state.source === "photo"
        ? `Faltam alguns preços que não consegui ler. ${ask}`
        : `Agora os preços, um de cada vez. ${ask}`;
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
