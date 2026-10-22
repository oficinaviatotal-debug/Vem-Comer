/**
 * As escolhas do prato, versão nova: tamanho, extras e observação, com a quantidade. Só conta, sem React nem rede:
 * tests/novo/choicesLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado. As regras são as da tela antiga (customer/options.ts e cart.ts): o restaurante monta os grupos
 * ("Tamanho": escolha 1; "Adicionais": até 5); o preço do prato é o preço base mais o que cada opção soma; o cliente só
 * manda os códigos do que escolheu e uma observação curta; o servidor confere tudo e recalcula o preço. Os números
 * daqui são só para mostrar.
 */
import { MAX_PER_ITEM, toCents, type ChosenOption } from "../customer/cart.ts";
import {
  NOTE_MAX,
  chosenOptions,
  cleanNote,
  countIn,
  deltaLabel,
  firstProblem,
  groupProblem,
  groupsOf,
  noteProblem,
  ruleText,
  toggleChoice,
  unitCents,
  type Selection,
} from "../customer/options.ts";
import type { Product } from "../customer/types.ts";
import type { ChoiceGroup, Choices } from "../novo/types.ts";

export type ChoicesInput = {
  product: Product;
  selection: Selection;
  /** A observação como a pessoa digitou (o contador mostra o que ela digitou, não o texto limpo). */
  note: string;
  quantity: number;
  /** A pessoa já tocou em "Adicionar" uma vez: só então o que falta aparece em vermelho. */
  tried: boolean;
  /** Mudando uma linha que já está na sacola: o botão diz "Salvar" em vez de "Adicionar". */
  editing: boolean;
  /** Escreve o endereço da imagem (ou "" quando não há foto). */
  media: (path: string | null | undefined) => string;
};

/** O que sai da tela quando a pessoa confirma: o que escolheu, a observação limpa e a quantidade. */
export type ChoicesPick = { options: ChosenOption[]; note: string; quantity: number };

export type ChoicesConfirm =
  | { ok: true; pick: ChoicesPick }
  | {
      ok: false;
      /** Frase pronta, para quem lê. */
      problem: string;
      /** O grupo que falta (a tela rola até ele); null quando o problema é a observação. */
      groupId: string | null;
    };

/** De 1 até o máximo por prato; número estranho vira 1. */
export function clampQuantity(value: number): number {
  const whole = Math.floor(Number(value));
  if (!Number.isFinite(whole) || whole < 1) return 1;
  return Math.min(MAX_PER_ITEM, whole);
}

/** Mais um ou menos um, sem passar dos limites. */
export function nextQuantity(current: number, by: 1 | -1): number {
  return clampQuantity(clampQuantity(current) + by);
}

/** O toque numa opção: grupo de escolha única troca, grupo de várias liga e desliga até o máximo. Opção que não existe não muda nada. */
export function pressOption(selection: Selection, product: Pick<Product, "option_groups">, groupId: string, itemId: string): Selection {
  const group = groupsOf(product).find((entry) => entry.id === groupId);
  if (!group || !group.items.some((item) => item.id === itemId)) return selection;
  return toggleChoice(selection, group, itemId);
}

export function choicesViewOf(input: ChoicesInput): Choices {
  const { product, selection, tried } = input;
  const groups = groupsOf(product);
  const quantity = clampQuantity(input.quantity);
  const chosen = chosenOptions(groups, selection);
  const unit = unitCents(toCents(product.price), chosen);

  const shown: ChoiceGroup[] = groups.map((group) => {
    const single = group.max_choices <= 1;
    const picked = selection[group.id] ?? [];
    const full = !single && countIn(selection, group) >= group.max_choices;
    return {
      id: group.id,
      name: group.name,
      rule: ruleText(group),
      required: group.min_choices > 0,
      single,
      items: group.items.map((item) => {
        const on = picked.includes(item.id);
        return { id: item.id, name: item.name, priceText: deltaLabel(item), on, blocked: full && !on };
      }),
      problem: tried ? groupProblem(group, selection) : null,
      emptyText: group.items.length === 0 ? "Indisponível agora." : undefined,
    };
  });

  const photo = input.media(product.thumb_url);
  const description = (product.description ?? "").trim();
  return {
    title: product.name,
    description: description || undefined,
    photo: photo || undefined,
    groups: shown,
    note: {
      value: input.note,
      count: input.note.length,
      max: NOTE_MAX,
      problem: tried ? noteProblem(input.note) : null,
    },
    quantity,
    canLess: quantity > 1,
    canMore: quantity < MAX_PER_ITEM,
    total: (unit * quantity) / 100,
    confirmLabel: input.editing ? "Salvar" : "Adicionar",
  };
}

/** O toque em "Adicionar": ou sai a escolha pronta, ou volta a frase do que falta e o grupo para onde rolar. */
export function confirmChoices(input: Pick<ChoicesInput, "product" | "selection" | "note" | "quantity">): ChoicesConfirm {
  const groups = groupsOf(input.product);
  const problem = firstProblem(groups, input.selection) ?? noteProblem(input.note);
  if (problem) {
    const missing = groups.find((group) => groupProblem(group, input.selection));
    return { ok: false, problem, groupId: missing?.id ?? null };
  }
  return {
    ok: true,
    pick: { options: chosenOptions(groups, input.selection), note: cleanNote(input.note), quantity: clampQuantity(input.quantity) },
  };
}
