/**
 * Options per dish for the customer screens (pure, no browser APIs): size, extras, "no onion", note.
 *
 * The restaurant builds groups for a dish ("Tamanho": choose 1; "Adicionais": up to 5). The dish price is the
 * base price and every option adds its `price_delta`. The customer only sends the ids of what was chosen and a
 * short note; the server checks everything and recomputes the price, so the numbers here are for showing only.
 */

import type { ChosenOption } from "./cart.ts";

export type OptionItem = {
  id: string;
  name: string;
  /** Extra price in reais (a number or text such as "3.50"); never negative. */
  price_delta: number | string;
};

export type OptionGroup = {
  id: string;
  name: string;
  min_choices: number;
  max_choices: number;
  items: OptionItem[];
};

/** Group id -> ids of the options chosen in it. */
export type Selection = Record<string, string[]>;

/** The server refuses a longer note (it never cuts one: "allergic to peanuts" cut in half is a danger). */
export const NOTE_MAX = 140;

const cents = (value: number | string | null | undefined): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : 0;
};

const money = (valueCents: number): string =>
  `R$ ${(valueCents / 100).toFixed(2).replace(".", ",")}`;

export function groupsOf(product: { option_groups?: OptionGroup[] | null }): OptionGroup[] {
  return Array.isArray(product.option_groups) ? product.option_groups : [];
}

export function hasOptions(product: { option_groups?: OptionGroup[] | null }): boolean {
  return groupsOf(product).length > 0;
}

/**
 * A required group with no option turned on: the dish cannot be sold now (the server refuses it too),
 * so the menu says "unavailable" instead of letting the customer order without the required choice.
 */
export function isUnavailable(product: { option_groups?: OptionGroup[] | null }): boolean {
  return groupsOf(product).some((group) => group.min_choices > 0 && group.items.length === 0);
}

/** Taps an option: a single-choice group swaps the choice, a multiple one adds or removes it up to the maximum. */
export function toggleChoice(selection: Selection, group: OptionGroup, itemId: string): Selection {
  const current = selection[group.id] ?? [];
  if (group.max_choices <= 1) {
    // Tapping the chosen one again clears it only when the group is optional.
    if (current.includes(itemId)) {
      return group.min_choices > 0 ? selection : { ...selection, [group.id]: [] };
    }
    return { ...selection, [group.id]: [itemId] };
  }
  if (current.includes(itemId)) {
    return { ...selection, [group.id]: current.filter((id) => id !== itemId) };
  }
  if (current.length >= group.max_choices) return selection;
  return { ...selection, [group.id]: [...current, itemId] };
}

export function countIn(selection: Selection, group: OptionGroup): number {
  return (selection[group.id] ?? []).filter((id) => group.items.some((item) => item.id === id)).length;
}

/** The short rule shown next to the group name. */
export function ruleText(group: OptionGroup): string {
  const { min_choices: min, max_choices: max } = group;
  if (min > 0 && min === max) return min === 1 ? "Escolha 1" : `Escolha ${min}`;
  if (min > 0) return `Escolha de ${min} a ${max}`;
  return max === 1 ? "Opcional" : `Opcional, até ${max}`;
}

/** What is missing in one group, in words for the customer; null when it is fine. */
export function groupProblem(group: OptionGroup, selection: Selection): string | null {
  if (group.min_choices <= 0) return null;
  if (group.items.length === 0) return `${group.name}: indisponível agora.`;
  const chosen = countIn(selection, group);
  if (chosen >= group.min_choices) return null;
  if (group.min_choices === 1) return `Escolha uma opção em ${group.name}.`;
  return `Escolha pelo menos ${group.min_choices} em ${group.name}.`;
}

export function firstProblem(groups: OptionGroup[], selection: Selection): string | null {
  for (const group of groups) {
    const problem = groupProblem(group, selection);
    if (problem) return problem;
  }
  return null;
}

/** What was chosen, in the order the groups and options appear on screen. */
export function chosenOptions(groups: OptionGroup[], selection: Selection): ChosenOption[] {
  const out: ChosenOption[] = [];
  for (const group of groups) {
    const picked = selection[group.id] ?? [];
    for (const item of group.items) {
      if (picked.includes(item.id)) {
        out.push({ id: item.id, group: group.name, name: item.name, deltaCents: cents(item.price_delta) });
      }
    }
  }
  return out;
}

/** Selection that already holds the options of a cart line (to change a line already in the order). */
export function selectionFromChosen(groups: OptionGroup[], chosen: ChosenOption[]): Selection {
  const selection: Selection = {};
  for (const group of groups) {
    const ids = chosen.filter((option) => group.items.some((item) => item.id === option.id)).map((o) => o.id);
    if (ids.length) selection[group.id] = ids;
  }
  return selection;
}

export function unitCents(baseCents: number, chosen: ChosenOption[]): number {
  return baseCents + chosen.reduce((sum, option) => sum + option.deltaCents, 0);
}

/**
 * The least the dish can cost: the base plus, in every required group, the cheapest options it forces
 * the customer to take. The menu shows "a partir de" with this when the options change the price.
 */
export function minPriceCents(product: { price: number | string; option_groups?: OptionGroup[] | null }): number {
  let total = cents(product.price);
  for (const group of groupsOf(product)) {
    if (group.min_choices <= 0) continue;
    const cheapest = group.items.map((item) => cents(item.price_delta)).sort((a, b) => a - b);
    total += cheapest.slice(0, group.min_choices).reduce((sum, value) => sum + value, 0);
  }
  return total;
}

/** True when some option costs extra, so the price on the menu is not the final one. */
export function hasPriceVariation(product: { option_groups?: OptionGroup[] | null }): boolean {
  return groupsOf(product).some((group) => group.items.some((item) => cents(item.price_delta) > 0));
}

/** "+ R$ 3,00", or an empty text for a free option. */
export function deltaLabel(item: OptionItem): string {
  const value = cents(item.price_delta);
  return value > 0 ? `+ ${money(value)}` : "";
}

/** "Grande, Bacon, Queijo extra" for the order slip. */
export function chosenText(chosen: ChosenOption[] | undefined): string {
  return (chosen ?? []).map((option) => option.name).join(", ");
}

/** Note as typed: one line, single spaces. Empty stays empty. Never cut here (see NOTE_MAX). */
export function cleanNote(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** A note over the limit is refused with a message, never trimmed. */
export function noteProblem(text: string | null | undefined): string | null {
  return cleanNote(text).length > NOTE_MAX ? `A observação pode ter até ${NOTE_MAX} letras.` : null;
}
