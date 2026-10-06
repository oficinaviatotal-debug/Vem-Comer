/**
 * The menu assistant as a plain state machine: no React, no voice, no network.
 * The screen only calls these functions and shows the result, which keeps the
 * conversation easy to test and easy to change.
 *
 *   type -> pick (one category at a time) -> prices (one dish at a time)
 *        -> review -> saving -> done
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import { normalizePrice, type SpokenItems } from "./assistantLogic.ts";

export type TemplateFull = {
  id: string;
  name: string;
  icon: string;
  categories: Array<{ name: string; items: Array<{ name: string }> }>;
};

export type DraftItem = {
  name: string;
  selected: boolean;
  /** Said or typed by the owner, not from the ready-made list. */
  custom: boolean;
  /** "" until a price is given; otherwise "18.50". */
  price: string;
};

export type DraftCategory = { name: string; items: DraftItem[] };

export type Step = "type" | "pick" | "prices" | "review" | "saving" | "done";

export type FlowState = {
  step: Step;
  templateName: string;
  categories: DraftCategory[];
  categoryIndex: number;
  /** Position in the list of selected dishes while the prices are being asked. */
  priceCursor: number;
};

export const MAX_ITEM_NAME = 150;

export function initialFlow(): FlowState {
  return { step: "type", templateName: "", categories: [], categoryIndex: 0, priceCursor: 0 };
}

export function startFromTemplate(template: TemplateFull): FlowState {
  return {
    step: "pick",
    templateName: template.name,
    categoryIndex: 0,
    priceCursor: 0,
    categories: template.categories
      .filter((category) => category.items.length > 0)
      .map((category) => ({
        name: category.name,
        items: category.items.map((item) => ({
          name: item.name,
          selected: false,
          custom: false,
          price: "",
        })),
      })),
  };
}

/* ----------------------------------------------------------------- helpers */

const key = (name: string) => normalizeSpeech(name);

/** Immutable update of one dish. */
function withItem(
  state: FlowState,
  categoryIndex: number,
  itemIndex: number,
  change: (item: DraftItem) => DraftItem
): FlowState {
  const category = state.categories[categoryIndex];
  if (!category || !category.items[itemIndex]) return state;
  return {
    ...state,
    categories: state.categories.map((current, c) =>
      c !== categoryIndex
        ? current
        : { ...current, items: current.items.map((item, i) => (i === itemIndex ? change(item) : item)) }
    ),
  };
}

/** "x-burguer  grande" -> "X-burguer grande". */
export function cleanItemName(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "").trim().slice(0, MAX_ITEM_NAME).trim();
  return text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : "";
}

/* ----------------------------------------------------------------- reading */

export type PickedItem = {
  categoryIndex: number;
  itemIndex: number;
  categoryName: string;
  name: string;
  price: string;
};

/** Every selected dish, in menu order. */
export function selectedItems(state: FlowState): PickedItem[] {
  const picked: PickedItem[] = [];
  state.categories.forEach((category, categoryIndex) => {
    category.items.forEach((item, itemIndex) => {
      if (item.selected) {
        picked.push({
          categoryIndex,
          itemIndex,
          categoryName: category.name,
          name: item.name,
          price: item.price,
        });
      }
    });
  });
  return picked;
}

export function currentCategory(state: FlowState): DraftCategory | undefined {
  return state.categories[state.categoryIndex];
}

export function selectedInCategory(state: FlowState, categoryIndex = state.categoryIndex): number {
  return (state.categories[categoryIndex]?.items ?? []).filter((item) => item.selected).length;
}

export function currentPriceItem(state: FlowState): PickedItem | undefined {
  return selectedItems(state)[state.priceCursor];
}

export function missingPrices(state: FlowState): PickedItem[] {
  return selectedItems(state).filter((item) => !item.price);
}

export function summary(state: FlowState): { items: number; categories: number } {
  const picked = selectedItems(state);
  return { items: picked.length, categories: new Set(picked.map((item) => item.categoryIndex)).size };
}

/* ------------------------------------------------------------- choosing */

export function toggleItem(state: FlowState, categoryIndex: number, itemIndex: number): FlowState {
  return withItem(state, categoryIndex, itemIndex, (item) => ({ ...item, selected: !item.selected }));
}

/** Selects every dish of the category, or clears them all when they were all selected already. */
export function toggleAllInCategory(state: FlowState, categoryIndex = state.categoryIndex): FlowState {
  const category = state.categories[categoryIndex];
  if (!category) return state;
  const everySelected = category.items.every((item) => item.selected);
  return {
    ...state,
    categories: state.categories.map((current, c) =>
      c !== categoryIndex
        ? current
        : { ...current, items: current.items.map((item) => ({ ...item, selected: !everySelected })) }
    ),
  };
}

export type AddResult = { state: FlowState; selected: string[]; added: string[] };

/** Adds one dish by name: selects it if the category already has it, creates it otherwise. */
export function addItem(state: FlowState, categoryIndex: number, rawName: string): AddResult {
  const name = cleanItemName(rawName);
  const category = state.categories[categoryIndex];
  if (!name || !category) return { state, selected: [], added: [] };

  const existing = category.items.findIndex((item) => key(item.name) === key(name));
  if (existing >= 0) {
    const item = category.items[existing];
    return {
      state: withItem(state, categoryIndex, existing, (current) => ({ ...current, selected: true })),
      selected: item.selected ? [] : [item.name],
      added: [],
    };
  }

  return {
    state: {
      ...state,
      categories: state.categories.map((current, c) =>
        c !== categoryIndex
          ? current
          : { ...current, items: [...current.items, { name, selected: true, custom: true, price: "" }] }
      ),
    },
    selected: [],
    added: [name],
  };
}

/** Applies what interpretSpokenItems understood to the category on screen. */
export function applySpoken(state: FlowState, categoryIndex: number, spoken: SpokenItems): AddResult {
  let next = state;
  const selected: string[] = [];
  const added: string[] = [];

  for (const index of spoken.matched) {
    const item = next.categories[categoryIndex]?.items[index];
    if (!item) continue;
    if (!item.selected) selected.push(item.name);
    next = withItem(next, categoryIndex, index, (current) => ({ ...current, selected: true }));
  }

  for (const name of spoken.custom) {
    const result = addItem(next, categoryIndex, name);
    next = result.state;
    selected.push(...result.selected);
    added.push(...result.added);
  }

  return { state: next, selected, added };
}

/* ------------------------------------------------------------ categories */

export function previousCategory(state: FlowState): FlowState {
  return { ...state, categoryIndex: Math.max(0, state.categoryIndex - 1) };
}

/** Moves to the next category, or to the prices after the last one. */
export function nextCategory(state: FlowState): FlowState {
  if (state.categoryIndex < state.categories.length - 1) {
    return { ...state, categoryIndex: state.categoryIndex + 1 };
  }
  return startPrices(state);
}

/** "I do not sell anything here": clears the category and moves on. */
export function skipCategory(state: FlowState): FlowState {
  const cleared: FlowState = {
    ...state,
    categories: state.categories.map((category, c) =>
      c !== state.categoryIndex
        ? category
        : { ...category, items: category.items.map((item) => ({ ...item, selected: false })) }
    ),
  };
  return nextCategory(cleared);
}

/* ---------------------------------------------------------------- prices */

/** Starts asking prices at the first dish that has none. Stays on "pick" when nothing is selected. */
export function startPrices(state: FlowState): FlowState {
  const picked = selectedItems(state);
  if (picked.length === 0) return { ...state, step: "pick" };
  const first = picked.findIndex((item) => !item.price);
  if (first < 0) return { ...state, step: "review" };
  return { ...state, step: "prices", priceCursor: first };
}

/** Sets the price of the dish being asked and moves on. An unusable price changes nothing. */
export function setCurrentPrice(state: FlowState, rawPrice: string): FlowState {
  const price = normalizePrice(rawPrice);
  const current = currentPriceItem(state);
  if (!price || !current) return state;

  const updated = withItem(state, current.categoryIndex, current.itemIndex, (item) => ({ ...item, price }));
  const total = selectedItems(updated).length;
  const cursor = state.priceCursor + 1;
  return cursor >= total ? { ...updated, step: "review", priceCursor: 0 } : { ...updated, priceCursor: cursor };
}

/** Drops the dish being asked (the owner does not want it) and moves on. */
export function skipCurrentPrice(state: FlowState): FlowState {
  const current = currentPriceItem(state);
  if (!current) return state;
  const updated = withItem(state, current.categoryIndex, current.itemIndex, (item) => ({
    ...item,
    selected: false,
    price: "",
  }));
  const total = selectedItems(updated).length;
  if (total === 0) return { ...updated, step: "pick", categoryIndex: 0, priceCursor: 0 };
  return state.priceCursor >= total ? { ...updated, step: "review", priceCursor: 0 } : updated;
}

/** Goes back one dish. From the review it returns to the last dish. */
export function backOnePrice(state: FlowState): FlowState {
  if (state.step === "review") {
    const total = selectedItems(state).length;
    return { ...state, step: "prices", priceCursor: Math.max(0, total - 1) };
  }
  if (state.priceCursor > 0) return { ...state, priceCursor: state.priceCursor - 1 };
  return { ...state, step: "pick", categoryIndex: Math.max(0, state.categories.length - 1) };
}

/** Changes a price from the review screen. An unusable price changes nothing. */
export function editPrice(state: FlowState, categoryIndex: number, itemIndex: number, rawPrice: string): FlowState {
  const price = normalizePrice(rawPrice);
  if (!price) return state;
  return withItem(state, categoryIndex, itemIndex, (item) => ({ ...item, price }));
}

/** Takes a dish off the menu from the review screen. */
export function removeItem(state: FlowState, categoryIndex: number, itemIndex: number): FlowState {
  return withItem(state, categoryIndex, itemIndex, (item) => ({ ...item, selected: false, price: "" }));
}

/* --------------------------------------------------------------- saving */

export type ImportPayload = {
  categories: Array<{ name: string; items: Array<{ name: string; price: string }> }>;
};

/** What the server expects. Only selected dishes with a price; empty categories are left out. */
export function importPayload(state: FlowState): ImportPayload {
  return {
    categories: state.categories
      .map((category) => ({
        name: category.name,
        items: category.items
          .filter((item) => item.selected && item.price)
          .map((item) => ({ name: item.name, price: item.price })),
      }))
      .filter((category) => category.items.length > 0),
  };
}

export function setStep(state: FlowState, step: Step): FlowState {
  return { ...state, step };
}
