/**
 * Montar o cardápio, versão nova: foto, arquivo ou falar os pratos, conferir e cadastrar. Só conta, sem React nem rede:
 * tests/novo/menuSetupLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou. Ler a foto ou a planilha é decisão do servidor; entender "x-tudo 25, coca 6",
 * tirar prato, conferir preço que parece engano de escuta e o que vai no cadastro vêm da mesma lógica do assistente antigo
 * (`assistant/assistantFlow`, `spokenMenu`, `menuPhotoLogic`, `doorLogic`, `priceCheck`), que já é testada. Aqui só se
 * transforma esse estado nas telas novas e se escreve a frase.
 *
 * Duas regras de cuidado: prato SEM preço nunca vai para o cardápio (a tela diz quantos ficam de fora), e o preço que
 * parece engano é apontado, nunca trocado sozinho.
 */
import { formatPrice, normalizePrice, parseAssistantCommand } from "../assistant/assistantLogic.ts";
import {
  addSpokenMenu,
  cleanDescription,
  cleanItemName,
  describeItem,
  editPrice,
  importPayload,
  removeItem,
  removeSpoken,
  renameItem,
  selectedItems,
  summary,
  type FlowState,
} from "../assistant/assistantFlow.ts";
import { doorStatuses, fileHint, photoHint } from "../assistant/doorLogic.ts";
import { MENU_FILE_ACCEPT, MENU_SHEET_ACCEPT, readingErrorText, type ReadyMenuOptions } from "../assistant/menuPhotoLogic.ts";
import { priceDoubt } from "../assistant/priceCheck.ts";
import { guessCategory, parseRemoval, parseSpokenMenu, type SpokenMenu } from "../assistant/spokenMenu.ts";
import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import {
  MENU_BADGE_FAST,
  MENU_DOOR_FILE,
  MENU_DOOR_FOOT,
  MENU_DOOR_GALLERY,
  MENU_DOOR_LOADING,
  MENU_DOOR_MODEL,
  MENU_DOOR_PHOTO,
  MENU_DOOR_SPEAK,
  MENU_DOOR_SUB,
  MENU_DOOR_WRITE,
  MENU_DONE_SUB,
  MENU_FINISH,
  MENU_GALLERY_HINT,
  MENU_MODEL_HINT,
  MENU_NOT_HEARD_HELP,
  MENU_NOT_HEARD_ONCE,
  MENU_PHOTO_HINT,
  MENU_READ_TIMEOUT,
  MENU_PAGES_SUB,
  MENU_READ,
  MENU_READ_AGAIN,
  MENU_READING,
  MENU_READING_SUB,
  MENU_REVIEW_INTRO_MODEL,
  MENU_REVIEW_INTRO_READ,
  MENU_REVIEW_INTRO_SPOKEN,
  MENU_REVIEW_SUB,
  MENU_SPEAK_ALREADY,
  MENU_SPEAK_HINT_VOICE,
  MENU_SPEAK_NO_DISH,
  MENU_SPEAK_NOT_HEARD,
  MENU_SPEAK_SUB,
  MENU_WRITE_HINT,
} from "../novo/copy.ts";
import type {
  MenuDoorCard,
  MenuHeardGroup,
  MenuPageThumb,
  MenuReviewDish,
  MenuReviewGroup,
  MenuSetupView,
} from "../novo/types.ts";

export type { FlowState };
export type { MenuDoorCard, MenuSetupView };

/** O que o servidor respondeu ao cadastrar (as chaves são as do servidor). */
export type MenuSaveResult = { products_created: number; products_skipped: number };

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

// ------------------------------------------------------------------------------------------------ a porta

/**
 * Os jeitos de começar. Antes da resposta do servidor não há cartão (a ordem só se decide quando se sabe o que cada um faz:
 * os que funcionam vêm primeiro e a lista não pula depois). Falar os pratos sempre funciona: sem microfone, escreve-se.
 */
export function doorViewOf(input: { options: ReadyMenuOptions | null; voiceWorks: boolean; error: string }): MenuSetupView {
  const statuses = doorStatuses(input.options);
  if (!input.options) {
    return { stage: "door", sub: MENU_DOOR_LOADING, loading: true, cards: [], foot: "", error: input.error };
  }
  const photoReady = statuses.photo === "ready";
  const photo: MenuDoorCard = {
    id: "photo",
    title: MENU_DOOR_PHOTO,
    hint: photoReady ? MENU_PHOTO_HINT : photoHint(statuses),
    state: statuses.photo,
    badge: photoReady ? MENU_BADGE_FAST : "",
    accept: "image/*",
  };
  // A foto que já está no celular: só aparece quando a leitura funciona (o cartão apagado já explica o porquê no da câmera).
  const gallery: MenuDoorCard | null = photoReady
    ? { id: "gallery", title: MENU_DOOR_GALLERY, hint: MENU_GALLERY_HINT, state: "ready", badge: "", accept: "image/*" }
    : null;
  const file: MenuDoorCard = {
    id: "file",
    title: MENU_DOOR_FILE,
    hint: fileHint(statuses),
    state: statuses.file,
    badge: "",
    accept: statuses.pdf ? MENU_FILE_ACCEPT : MENU_SHEET_ACCEPT,
  };
  // Falar só aparece se o celular escuta; escrever aparece sempre.
  const speak: MenuDoorCard | null = input.voiceWorks
    ? { id: "speak", title: MENU_DOOR_SPEAK, hint: MENU_SPEAK_HINT_VOICE, state: "ready", badge: "", accept: "" }
    : null;
  const write: MenuDoorCard = { id: "write", title: MENU_DOOR_WRITE, hint: MENU_WRITE_HINT, state: "ready", badge: "", accept: "" };
  // Começar de um modelo só precisa da lista de tipos, que o servidor sempre tem: está sempre pronto, depois dos que lêem.
  const model: MenuDoorCard = { id: "model", title: MENU_DOOR_MODEL, hint: MENU_MODEL_HINT, state: "ready", badge: "", accept: "" };
  const all = [photo, gallery, speak, write, file, model].filter((card): card is MenuDoorCard => card !== null);
  const cards = [...all.filter((card) => card.state === "ready"), ...all.filter((card) => card.state !== "ready")];
  return { stage: "door", sub: MENU_DOOR_SUB, loading: false, cards, foot: MENU_DOOR_FOOT, error: input.error };
}

// ------------------------------------------------------------------------------------------------ as páginas e a leitura

/** A foto da página só aparece se for do próprio aparelho (`blob:`): nada que veio de fora vira imagem. */
export const isDeviceImage = (src: unknown): src is string => typeof src === "string" && /^blob:/.test(src);

export function pagesViewOf(input: {
  pages: ReadonlyArray<{ id: number; url: string }>;
  busy: boolean;
  photoEnabled: boolean;
  /** Quantas páginas ainda cabem. */
  room: number;
  failed: boolean;
  message: string;
}): MenuSetupView {
  const pages: MenuPageThumb[] = input.pages
    .filter((page) => isDeviceImage(page.url))
    .map((page, index) => ({ id: page.id, src: page.url, label: `Página ${index + 1} do cardápio` }));
  return {
    stage: "pages",
    sub: pages.length > 0 ? plural(pages.length, "página", "páginas") : MENU_PAGES_SUB,
    pages,
    busy: input.busy,
    canAdd: input.photoEnabled && input.room > 0,
    canRead: pages.length > 0 && !input.busy,
    readLabel: input.failed ? MENU_READ_AGAIN : MENU_READ,
    message: input.message,
  };
}

export const readingViewOf = (): MenuSetupView => ({ stage: "reading", sub: MENU_READING_SUB, text: MENU_READING });

// ------------------------------------------------------------------------------------------------ o cardápio falado

/** "d-3" é o prato 3 da categoria `d`: o número que a tela devolve ao tocar. */
export const dishId = (categoryIndex: number, itemIndex: number): string => `${categoryIndex}-${itemIndex}`;

export function parseDishId(id: unknown): { categoryIndex: number; itemIndex: number } | null {
  const found = typeof id === "string" ? /^(\d{1,3})-(\d{1,4})$/.exec(id) : null;
  return found ? { categoryIndex: Number(found[1]), itemIndex: Number(found[2]) } : null;
}

export type SpeakOutcome = {
  flow: FlowState;
  /** O título em vigor no fim da frase ("de bebida…"): passa para a frase seguinte. */
  heading: string;
  notice: string;
  /** Pedaços que parecem vários pratos juntos: a pessoa toca para anotar. */
  unclear: string[];
  /** A frase terminou com "pronto", "só isso", "cadastrar"…: segue para a conferência. */
  finished: boolean;
};

/** O que vai dentro, em uma frase curta: a lista inteira se couber, senão só quantos são. */
function insideNote(description: string): string {
  if (description.length <= 70) return `Dentro: ${description}.`;
  return `Dentro: ${plural(description.split(",").length, "ingrediente", "ingredientes")}.`;
}

/** "Anotei X-tudo, R$ 25,00. Dentro: ovo, bacon." / "Anotei 3 pratos. 1 ficou sem preço.": a frase curta depois de cada fala. */
export function noticeOf(result: {
  added: Array<{ name: string; price: string }>;
  priced: Array<{ name: string; price: string }>;
  described?: Array<{ name: string; description: string }>;
}): string {
  const parts: string[] = [];
  const { added, priced } = result;
  const described = result.described ?? [];
  const announced = new Set<string>();
  if (added.length === 1) {
    const dish = added[0];
    parts.push(dish.price ? `Anotei ${dish.name}, ${formatPrice(dish.price)}.` : `Anotei ${dish.name}. Falta o preço.`);
    const inside = described.find((entry) => entry.name === dish.name);
    if (inside) {
      parts.push(insideNote(inside.description));
      announced.add(dish.name);
    }
  } else if (added.length > 1) {
    const missing = added.filter((dish) => !dish.price).length;
    parts.push(`Anotei ${added.length} pratos.`);
    if (missing > 0) parts.push(missing === 1 ? "1 ficou sem preço." : `${missing} ficaram sem preço.`);
    const withInside = described.filter((entry) => added.some((dish) => dish.name === entry.name));
    if (withInside.length > 0) parts.push(`${plural(withInside.length, "prato com o que vai dentro", "pratos com o que vai dentro")}.`);
    for (const entry of withInside) announced.add(entry.name);
  }
  for (const dish of priced.slice(0, 2)) parts.push(`${dish.name}, ${formatPrice(dish.price)}.`);
  if (priced.length > 2) parts.push(`E mais ${priced.length - 2} preços.`);
  // um prato que já estava na lista e ganhou o que vai dentro
  for (const dish of described.filter((entry) => !announced.has(entry.name)).slice(0, 2)) parts.push(`${dish.name}: anotei o que vai dentro.`);
  return parts.join(" ");
}

/**
 * Tudo o que se faz com uma fala (ou com o que foi escrito): tirar um prato, anotar pratos, anotar um preço solto, ou entender
 * que a pessoa terminou. Prato dito com preço vale antes de comando ("x-tudo" é prato, não "tudo").
 */
export function takeSpoken(flow: FlowState, text: string, heading: string): SpeakOutcome {
  const same = { flow, heading, unclear: [] as string[], finished: false };

  const removal = parseRemoval(text);
  if (removal) {
    const outcome = removeSpoken(flow, removal);
    return outcome.removed
      ? { ...same, flow: outcome.state, notice: `Tirei ${outcome.removed}.` }
      : { ...same, notice: `Não achei ${removal} na lista.` };
  }

  const menu = parseSpokenMenu(text, heading);
  if (menu.dishes.length > 0 || menu.lonePrice || menu.loneDescription) {
    const applied = addSpokenMenu(flow, menu);
    // Um preço ou uma lista dita sozinha, sem prato antes: não foi para lugar nenhum, e a frase diz isso (não "já estavam anotados").
    const nowhere = menu.dishes.length === 0 && applied.priced.length === 0 && applied.described.length === 0;
    const note = noticeOf(applied) || (nowhere ? MENU_SPEAK_NO_DISH : MENU_SPEAK_ALREADY);
    return {
      flow: applied.state,
      heading: menu.heading,
      notice: menu.unclear.length > 0 ? `${note} Uma parte eu não separei, está na tela.` : note,
      unclear: menu.unclear,
      finished: menu.finished,
    };
  }

  const command = parseAssistantCommand(text);
  if (menu.finished || command === "next" || command === "no" || /cadastr|salv|confirm/.test(normalizeSpeech(text))) {
    return { ...same, heading: menu.heading, notice: "", finished: true };
  }
  if (menu.unclear.length > 0) {
    return { ...same, heading: menu.heading, unclear: menu.unclear, notice: "Não consegui separar os pratos. Fale cada um com o preço, ou toque na tela." };
  }
  if (menu.heading && menu.heading !== heading) return { ...same, heading: menu.heading, notice: `Certo, ${menu.heading}. Pode falar.` };
  return { ...same, notice: MENU_SPEAK_NOT_HEARD };
}

export type SpeakInput = {
  flow: FlowState;
  listening: boolean;
  canListen: boolean;
  heard: string;
  notice: string;
  unclear: readonly string[];
};

export function speakViewOf(input: SpeakInput): MenuSetupView {
  const picked = selectedItems(input.flow);
  const groups: MenuHeardGroup[] = [];
  for (const dish of picked) {
    const id = String(dish.categoryIndex);
    let group = groups.find((entry) => entry.id === id);
    if (!group) {
      group = { id, name: dish.categoryName, dishes: [] };
      groups.push(group);
    }
    group.dishes.push({
      id: dishId(dish.categoryIndex, dish.itemIndex),
      name: dish.name,
      price: dish.price ? formatPrice(dish.price) : "",
      missing: !dish.price,
      inside: input.flow.categories[dish.categoryIndex]?.items[dish.itemIndex]?.description ?? "",
    });
  }
  const count = picked.length;
  return {
    stage: "speak",
    sub: count > 0 ? plural(count, "prato anotado", "pratos anotados") : MENU_SPEAK_SUB,
    listening: input.listening,
    canListen: input.canListen,
    heard: input.heard,
    notice: input.notice,
    groups,
    unclear: [...input.unclear],
    count,
    finish: count > 0 ? `${MENU_FINISH} (${count})` : "",
  };
}

// ------------------------------------------------------------------------------------------------ conferir e cadastrar

function reviewDish(categoryName: string, categoryIndex: number, itemIndex: number, name: string, price: string, inside: string): MenuReviewDish {
  const doubt = price ? priceDoubt(name, price) : null;
  return {
    id: dishId(categoryIndex, itemIndex),
    name,
    group: categoryName,
    price: price ? formatPrice(price) : "",
    priceValue: price ? price.replace(".", ",") : "",
    missing: !price,
    inside,
    doubt: doubt
      ? {
          text: doubt.maybe
            ? `Confira: ${formatPrice(price)}. Será que é ${formatPrice(doubt.maybe)}?`
            : `Confira: ${formatPrice(price)} parece alto para este prato.`,
          use: doubt.maybe ?? "",
        }
      : null,
  };
}

export type ReviewInput = { flow: FlowState; editing: string | null; error: string };

/** Quantos pratos vão no cadastro (os marcados que têm preço) e quantos ficam de fora por falta de preço. */
export function saveCounts(flow: FlowState): { saved: number; missing: number } {
  const saved = importPayload(flow).categories.reduce((sum, category) => sum + category.items.length, 0);
  return { saved, missing: selectedItems(flow).length - saved };
}

export function reviewViewOf(input: ReviewInput): MenuSetupView {
  const missing: MenuReviewDish[] = [];
  const groups: MenuReviewGroup[] = [];
  input.flow.categories.forEach((category, categoryIndex) => {
    const dishes: MenuReviewDish[] = [];
    category.items.forEach((item, itemIndex) => {
      if (!item.selected) return;
      const dish = reviewDish(category.name, categoryIndex, itemIndex, item.name, item.price, item.description ?? "");
      if (dish.missing) missing.push(dish);
      else dishes.push(dish);
    });
    if (dishes.length > 0) groups.push({ id: String(categoryIndex), name: category.name, dishes });
  });

  const totals = summary(input.flow);
  const { saved, missing: left } = saveCounts(input.flow);
  return {
    stage: "review",
    sub: totals.items > 0 ? `${plural(totals.items, "prato", "pratos")} em ${plural(totals.categories, "categoria", "categorias")}` : MENU_REVIEW_SUB,
    intro: input.flow.source === "speech" ? MENU_REVIEW_INTRO_SPOKEN : input.flow.source === "template" ? MENU_REVIEW_INTRO_MODEL : MENU_REVIEW_INTRO_READ,
    missing,
    groups,
    editing: input.editing,
    saveLabel: saved > 0 ? `Cadastrar ${plural(saved, "prato", "pratos")}` : "",
    saveNote: left > 0 ? (left === 1 ? "1 prato sem preço não entra." : `${left} pratos sem preço não entram.`) : "",
    canSave: saved > 0,
    error: input.error,
  };
}

/** Cada mudança devolve o mesmo estado quando não vale (nome vazio ou repetido, preço que não é número): a tela diz o porquê. */
export function changeName(flow: FlowState, id: string, text: string): FlowState {
  const at = parseDishId(id);
  const item = at ? flow.categories[at.categoryIndex]?.items[at.itemIndex] : undefined;
  if (!at || !item) return flow;
  // O nome de um prato da lista pronta do modelo a regra do assistente não muda. Quando a pessoa escreve outro, o prato passa a ser dela.
  const own: FlowState = item.custom
    ? flow
    : {
        ...flow,
        categories: flow.categories.map((category, c) =>
          c !== at.categoryIndex ? category : { ...category, items: category.items.map((entry, i) => (i === at.itemIndex ? { ...entry, custom: true } : entry)) },
        ),
      };
  const renamed = renameItem(own, at.categoryIndex, at.itemIndex, text);
  return renamed === own ? flow : renamed;
}

export function changePrice(flow: FlowState, id: string, text: string): FlowState {
  const at = parseDishId(id);
  return at ? editPrice(flow, at.categoryIndex, at.itemIndex, text) : flow;
}

/** Troca o que vai dentro do prato. Texto vazio tira o que havia. */
export function changeInside(flow: FlowState, id: string, text: string): FlowState {
  const at = parseDishId(id);
  return at ? describeItem(flow, at.categoryIndex, at.itemIndex, text) : flow;
}

export function insideOf(flow: FlowState, id: string): string {
  const at = parseDishId(id);
  return at ? (flow.categories[at.categoryIndex]?.items[at.itemIndex]?.description ?? "") : "";
}

export function takeOut(flow: FlowState, id: string): FlowState {
  const at = parseDishId(id);
  return at ? removeItem(flow, at.categoryIndex, at.itemIndex) : flow;
}

/** O preço que está no campo, em texto, para saber se o toque mudou alguma coisa. */
export function priceOf(flow: FlowState, id: string): string {
  const at = parseDishId(id);
  return at ? (flow.categories[at.categoryIndex]?.items[at.itemIndex]?.price ?? "") : "";
}

export function nameOf(flow: FlowState, id: string): string {
  const at = parseDishId(id);
  return at ? (flow.categories[at.categoryIndex]?.items[at.itemIndex]?.name ?? "") : "";
}

/** "Usar R$ 3,00": o palpite de quem confere (ex.: "300" que era "3,00"). Sem palpite, não muda nada. */
export function useGuess(flow: FlowState, id: string): FlowState {
  const price = priceOf(flow, id);
  const name = nameOf(flow, id);
  const maybe = price && name ? priceDoubt(name, price)?.maybe : null;
  return maybe ? changePrice(flow, id, maybe) : flow;
}

export type EditOutcome = { flow: FlowState; problem: "" | "name" | "price" };

/**
 * "Pronto" na conferência: o nome, o preço e o que vai dentro que estão nos campos. Preço que não é número, ou nome que ficou vazio
 * ou já existe na categoria, não muda nada e diz qual dos dois deu problema. Campo de preço vazio deixa o preço como está.
 * `inside` ausente deixa como está; vazio tira o que havia (a pessoa apagou de propósito).
 */
export function applyEdit(flow: FlowState, id: string, name: string, price: string, inside?: string): EditOutcome {
  if (!parseDishId(id)) return { flow, problem: "" };
  const typedPrice = price.trim();
  if (typedPrice && !priceIsUsable(typedPrice)) return { flow, problem: "price" };
  let next = flow;
  const current = nameOf(flow, id);
  const cleaned = cleanItemName(name);
  if (cleaned !== current) {
    const renamed = changeName(next, id, name);
    if (renamed === next) return { flow, problem: "name" };
    next = renamed;
  }
  if (typedPrice) next = changePrice(next, id, typedPrice);
  if (inside !== undefined && cleanDescription(inside) !== insideOf(next, id)) next = changeInside(next, id, inside);
  return { flow: next, problem: "" };
}

/** O preço que a pessoa escreveu vale? ("18,5", "R$ 18" sim; "abc" e "0" não.) */
export const priceIsUsable = (text: string): boolean => normalizePrice(text) !== null;

// ------------------------------------------------------------------------------------------------ cadastrado

export function doneViewOf(result: MenuSaveResult | null): MenuSetupView {
  const created = result?.products_created ?? 0;
  const skipped = result?.products_skipped ?? 0;
  const parts: string[] = [];
  if (result) parts.push(`${plural(created, "prato novo", "pratos novos")}`);
  if (skipped > 0) parts.push(`${skipped} já existiam`);
  return { stage: "done", sub: MENU_DONE_SUB, headline: MENU_DONE_SUB, detail: parts.length > 0 ? `${parts.join(", ")}.` : "" };
}

// ------------------------------------------------------------------------------------------------ frases e peças que a tela usa

/** Passada a palavra: o tempo da leitura esgotou, ou o servidor/rede falhou. Sem prometer o que não se sabe. */
export function readFailureText(reason: unknown): string {
  if (reason instanceof Error && reason.name === "AbortError") return MENU_READ_TIMEOUT;
  return readingErrorText(reason);
}

/** Ninguém falou: na primeira vez pede de novo; na segunda, ajuda a achar o microfone. */
export const SILENT_TURNS_BEFORE_HELP = 2;
export const whenNotHeard = (silentTurns: number): string => (silentTurns >= SILENT_TURNS_BEFORE_HELP ? MENU_NOT_HEARD_HELP : MENU_NOT_HEARD_ONCE);

/** Um trecho que não se separou, anotado como um prato só, sem preço (o preço se acerta na conferência). */
export function addUnclear(flow: FlowState, text: string, heading: string): FlowState {
  const name = text.trim();
  if (!name) return flow;
  const menu: SpokenMenu = {
    dishes: [{ name, price: "", category: guessCategory(name), categorySaid: false, description: "" }],
    unclear: [],
    finished: false,
    lonePrice: "",
    loneDescription: "",
    heading,
  };
  return addSpokenMenu(flow, menu).state;
}

/** O que o servidor respondeu ao cadastrar: "criados" tem de ser um número; sem isso a tela não escreve contagem nenhuma. */
export function saveResultOf(raw: unknown): MenuSaveResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as { products_created?: unknown; products_skipped?: unknown };
  const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
  const created = count(body.products_created);
  if (created === null) return null;
  return { products_created: created, products_skipped: count(body.products_skipped) ?? 0 };
}
