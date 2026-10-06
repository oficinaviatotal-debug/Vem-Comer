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

export const MORE_OR_DONE = "Mais algum? Ou diga pronto.";

/** The question for the current step. `intro` adds the first-time explanation of a step. */
export function promptFor(state: FlowState, intro = false): string {
  switch (state.step) {
    case "type":
      return BUSINESS_QUESTION;

    case "pick": {
      const category = currentCategory(state);
      if (!category) return BUSINESS_QUESTION;
      return `${category.name}. Toque nos pratos que você vende, ou fale os nomes. Quando acabar, diga pronto.`;
    }

    case "prices": {
      const item = currentPriceItem(state);
      if (!item) return "Vamos conferir.";
      const ask = `${item.name}. Quanto custa?`;
      return intro ? `Agora os preços, um de cada vez. ${ask}` : ask;
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
  switch (state.step) {
    case "type":
      return "Passo 1 de 4 · Tipo de negócio";
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
