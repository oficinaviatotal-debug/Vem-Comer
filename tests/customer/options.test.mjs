import test from "node:test";
import assert from "node:assert/strict";

import {
  NOTE_MAX,
  chosenOptions,
  chosenText,
  cleanNote,
  countIn,
  deltaLabel,
  firstProblem,
  groupProblem,
  hasOptions,
  isUnavailable,
  noteProblem,
  ruleText,
  selectionFromChosen,
  toggleChoice,
  unitCents,
} from "../../frontend/src/customer/options.ts";

const size = {
  id: "g-size",
  name: "Tamanho",
  min_choices: 1,
  max_choices: 1,
  items: [
    { id: "s-p", name: "Pequena", price_delta: 0 },
    { id: "s-g", name: "Grande", price_delta: "8.50" },
  ],
};
const extras = {
  id: "g-extra",
  name: "Adicionais",
  min_choices: 0,
  max_choices: 2,
  items: [
    { id: "e-bacon", name: "Bacon", price_delta: 4 },
    { id: "e-queijo", name: "Queijo extra", price_delta: "3.00" },
    { id: "e-ovo", name: "Ovo", price_delta: 2.5 },
  ],
};
const groups = [size, extras];

test("a dish with groups has options; one without does not", () => {
  assert.equal(hasOptions({ option_groups: groups }), true);
  assert.equal(hasOptions({ option_groups: [] }), false);
  assert.equal(hasOptions({}), false);
  assert.equal(hasOptions({ option_groups: null }), false);
});

test("a required group with every option turned off makes the dish unavailable", () => {
  assert.equal(isUnavailable({ option_groups: groups }), false);
  assert.equal(isUnavailable({ option_groups: [{ ...size, items: [] }] }), true);
  // An optional group with nothing in it does not block the sale.
  assert.equal(isUnavailable({ option_groups: [{ ...extras, items: [] }] }), false);
});

test("a single-choice group swaps the choice and keeps one when it is required", () => {
  let selection = toggleChoice({}, size, "s-p");
  assert.deepEqual(selection, { "g-size": ["s-p"] });
  selection = toggleChoice(selection, size, "s-g");
  assert.deepEqual(selection, { "g-size": ["s-g"] });
  // Tapping the chosen one again does not leave a required group empty.
  assert.deepEqual(toggleChoice(selection, size, "s-g"), { "g-size": ["s-g"] });
});

test("an optional single-choice group can be cleared by tapping the choice again", () => {
  const optional = { ...size, id: "g-opt", min_choices: 0 };
  let selection = toggleChoice({}, optional, "s-g");
  assert.deepEqual(selection, { "g-opt": ["s-g"] });
  selection = toggleChoice(selection, optional, "s-g");
  assert.deepEqual(selection, { "g-opt": [] });
});

test("a multiple group adds, removes and stops at the maximum", () => {
  let selection = toggleChoice({}, extras, "e-bacon");
  selection = toggleChoice(selection, extras, "e-queijo");
  assert.deepEqual(selection["g-extra"], ["e-bacon", "e-queijo"]);
  // The third is ignored: the maximum is 2.
  assert.deepEqual(toggleChoice(selection, extras, "e-ovo"), selection);
  selection = toggleChoice(selection, extras, "e-bacon");
  assert.deepEqual(selection["g-extra"], ["e-queijo"]);
  selection = toggleChoice(selection, extras, "e-ovo");
  assert.deepEqual(selection["g-extra"], ["e-queijo", "e-ovo"]);
});

test("toggleChoice never changes the selection it received", () => {
  const before = { "g-extra": ["e-bacon"] };
  toggleChoice(before, extras, "e-queijo");
  assert.deepEqual(before, { "g-extra": ["e-bacon"] });
});

test("countIn only counts options that still exist in the group", () => {
  assert.equal(countIn({ "g-extra": ["e-bacon", "sumiu"] }, extras), 1);
  assert.equal(countIn({}, extras), 0);
});

test("the rule text says what the customer must do", () => {
  assert.equal(ruleText(size), "Escolha 1");
  assert.equal(ruleText({ ...size, min_choices: 2, max_choices: 2 }), "Escolha 2");
  assert.equal(ruleText({ ...extras, min_choices: 1, max_choices: 3 }), "Escolha de 1 a 3");
  assert.equal(ruleText(extras), "Opcional, até 2");
  assert.equal(ruleText({ ...extras, max_choices: 1 }), "Opcional");
});

test("a required group without a choice stops the order, with words for the customer", () => {
  assert.equal(groupProblem(size, {}), "Escolha uma opção em Tamanho.");
  assert.equal(groupProblem(size, { "g-size": ["s-g"] }), null);
  assert.equal(groupProblem(extras, {}), null);
  assert.equal(
    groupProblem({ ...extras, min_choices: 2 }, { "g-extra": ["e-bacon"] }),
    "Escolha pelo menos 2 em Adicionais."
  );
  assert.equal(groupProblem({ ...size, items: [] }, {}), "Tamanho: indisponível agora.");
  assert.equal(firstProblem(groups, {}), "Escolha uma opção em Tamanho.");
  assert.equal(firstProblem(groups, { "g-size": ["s-p"] }), null);
});

test("what was chosen comes out in screen order with prices in cents", () => {
  const chosen = chosenOptions(groups, { "g-extra": ["e-queijo", "e-bacon"], "g-size": ["s-g"] });
  assert.deepEqual(
    chosen.map((option) => [option.group, option.name, option.deltaCents]),
    [
      ["Tamanho", "Grande", 850],
      ["Adicionais", "Bacon", 400],
      ["Adicionais", "Queijo extra", 300],
    ]
  );
});

test("the unit price is the base plus every option, exact in cents", () => {
  const chosen = chosenOptions(groups, { "g-size": ["s-g"], "g-extra": ["e-bacon", "e-ovo"] });
  assert.equal(unitCents(3990, chosen), 3990 + 850 + 400 + 250);
  assert.equal(unitCents(3990, []), 3990);
});

test("a negative or broken price on an option counts as free, never as a discount", () => {
  const weird = { ...extras, items: [{ id: "x", name: "X", price_delta: -5 }, { id: "y", name: "Y", price_delta: "abc" }] };
  const chosen = chosenOptions([weird], { "g-extra": ["x", "y"] });
  assert.deepEqual(chosen.map((option) => option.deltaCents), [0, 0]);
  assert.equal(deltaLabel(weird.items[0]), "");
});

test("the price label shows only the extra", () => {
  assert.equal(deltaLabel(size.items[0]), "");
  assert.equal(deltaLabel(size.items[1]), "+ R$ 8,50");
  assert.equal(deltaLabel(extras.items[2]), "+ R$ 2,50");
});

test("the order slip text lists the chosen names", () => {
  const chosen = chosenOptions(groups, { "g-size": ["s-g"], "g-extra": ["e-bacon"] });
  assert.equal(chosenText(chosen), "Grande, Bacon");
  assert.equal(chosenText(undefined), "");
  assert.equal(chosenText([]), "");
});

test("a line already in the order gives back its selection to be changed", () => {
  const chosen = chosenOptions(groups, { "g-size": ["s-g"], "g-extra": ["e-ovo"] });
  assert.deepEqual(selectionFromChosen(groups, chosen), { "g-size": ["s-g"], "g-extra": ["e-ovo"] });
  // An option the restaurant removed from the menu in the meantime is not brought back.
  const gone = [...chosen, { id: "sumiu", group: "Adicionais", name: "Sumiu", deltaCents: 100 }];
  assert.deepEqual(selectionFromChosen(groups, gone), { "g-size": ["s-g"], "g-extra": ["e-ovo"] });
});

test("the note is one line with single spaces, and a long one is refused, not cut", () => {
  assert.equal(cleanNote("  sem   cebola\n e sem tomate "), "sem cebola e sem tomate");
  assert.equal(cleanNote(null), "");
  assert.equal(cleanNote(undefined), "");
  assert.equal(noteProblem("sem cebola"), null);
  assert.equal(noteProblem("a".repeat(NOTE_MAX)), null);
  assert.equal(noteProblem("a".repeat(NOTE_MAX + 1)), "A observação pode ter até 140 letras.");
  // The text itself is never trimmed by cleanNote.
  assert.equal(cleanNote("a".repeat(NOTE_MAX + 5)).length, NOTE_MAX + 5);
});

test("the menu price is 'from' the cheapest legal combination", async () => {
  const { minPriceCents, hasPriceVariation } = await import("../../frontend/src/customer/options.ts");
  const pizza = { price: "40.00", option_groups: groups };
  // Size is required (1): the cheapest is Pequena (+0). Extras are optional: not counted.
  assert.equal(minPriceCents(pizza), 4000);
  assert.equal(hasPriceVariation(pizza), true);

  const onlyBig = { price: 40, option_groups: [{ ...size, items: [{ id: "a", name: "A", price_delta: 5 }, { id: "b", name: "B", price_delta: 9 }] }] };
  assert.equal(minPriceCents(onlyBig), 4500);

  const pickTwo = { price: 10, option_groups: [{ ...extras, min_choices: 2, max_choices: 3 }] };
  // The two cheapest extras: Ovo (2.50) and Queijo (3.00).
  assert.equal(minPriceCents(pickTwo), 1000 + 250 + 300);

  const free = { price: 10, option_groups: [{ ...extras, items: [{ id: "x", name: "Sem cebola", price_delta: 0 }] }] };
  assert.equal(hasPriceVariation(free), false);
  assert.equal(hasPriceVariation({}), false);
});
