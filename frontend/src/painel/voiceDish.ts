import { setSoldOut } from "../service/hoursApi";
import type { Phraser } from "../novo/phrasing";
import { SAY_DISH_DONE_BACK, SAY_DISH_DONE_SOLD, SAY_DISH_DO_FAIL, SAY_DISH_LOAD_FAIL } from "../novo/voiceCopy";
import { loadDishes } from "./dishesApi";
import { wordsOf } from "./dishesLogic";
import { within } from "./readBriefing";
import { offerFor, type DishAction, type DishOffer } from "./voiceDishLogic";

/** A tela de pratos escuta isto: um prato foi marcado pela voz, vale buscar a lista de novo. */
export const DISHES_CHANGED = "vem:dishes-changed";

export type AskedDish = Extract<DishOffer, { kind: "ask" }>;

/**
 * Busca os pratos **na hora** e acha o que a pessoa falou. Só lê: nada muda aqui. Se a lista não vier, a voz diz isso
 * (nunca "nenhum prato"). A pergunta de confirmação sai pronta em `say`.
 */
export async function askDish(input: { companyId: string; action: DishAction; words: string[]; phrase: Phraser }): Promise<DishOffer> {
  try {
    const { products } = await within(loadDishes(input.companyId));
    return offerFor({ action: input.action, words: input.words, products, phrase: input.phrase });
  } catch {
    return { kind: "info", say: input.phrase.say(SAY_DISH_LOAD_FAIL), warn: true };
  }
}

/**
 * Marca (ou desmarca) o prato **depois do "sim"**. A voz só afirma o que o servidor confirmou; se não confirmou, manda
 * conferir na tela de produtos (o pedido pode ter chegado), sem jurar que nada mudou. Aqui não há tempo limite: um
 * pedido de escrita não é abandonado no meio.
 */
export async function doDish(offer: AskedDish, phrase: Phraser): Promise<{ say: string; done: boolean }> {
  const soldOut = offer.action === "soldout";
  try {
    const confirmed = await setSoldOut(offer.dish.id, soldOut);
    if (confirmed !== soldOut) return { say: phrase.say(SAY_DISH_DO_FAIL), done: false };
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DISHES_CHANGED));
    return { say: phrase.say(soldOut ? SAY_DISH_DONE_SOLD : SAY_DISH_DONE_BACK, offer.dish.name), done: true };
  } catch (failure) {
    // O servidor recusou com um motivo (4xx): a frase dele vale. Falha de rede ou do servidor: a frase de sempre.
    return { say: wordsOf(failure, "") || phrase.say(SAY_DISH_DO_FAIL), done: false };
  }
}
