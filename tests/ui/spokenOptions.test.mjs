import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenOptions, SPOKEN_OPTIONS_HELP } from "../../frontend/src/service/spokenOptions.ts";
import { groupFrom, mergeGroups, toPayload, validate, starter, fromApi } from "../../frontend/src/service/optionsDraft.ts";

const shape = (groups) =>
  groups.map((g) => ({ name: g.name, min: g.min, max: g.max, items: g.items.map((i) => [i.name, i.cents]) }));

test("a whole phrase becomes size, extras and removals", () => {
  const out = parseSpokenOptions(
    "tamanho pequeno, médio mais 5, grande mais 10. adicionais bacon 4, ovo 2 e meio. sem cebola",
    2850
  );
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["Pequeno", 0], ["Médio", 500], ["Grande", 1000]] },
    { name: "Adicionais", min: 0, max: 2, items: [["Bacon", 400], ["Ovo", 250]] },
    { name: "Retirar", min: 0, max: 1, items: [["Sem cebola", 0]] },
  ]);
  assert.deepEqual(out.notes, []);
  assert.equal(out.lines[0], "Tamanho: Pequeno, Médio (+ R$ 5,00), Grande (+ R$ 10,00)");
});

test("the same thing without commas and with numbers in words", () => {
  const out = parseSpokenOptions(
    "tamanho pequeno médio mais cinco grande mais dez adicionais bacon quatro reais ovo dois e cinquenta queijo três",
    2850
  );
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["Pequeno", 0], ["Médio", 500], ["Grande", 1000]] },
    { name: "Adicionais", min: 0, max: 3, items: [["Bacon", 400], ["Ovo", 250], ["Queijo", 300]] },
  ]);
});

test("prices as the phone writes them: R$ 4,50, 4,5 and 5 reais a mais", () => {
  const out = parseSpokenOptions("adicionais bacon R$ 4,50, ovo 2,5, queijo 3 reais a mais, presunto 1 real", 0);
  assert.deepEqual(shape(out.groups)[0].items, [["Bacon", 450], ["Ovo", 250], ["Queijo", 300], ["Presunto", 100]]);
  assert.deepEqual(parseSpokenOptions("tamanho médio +5, grande +10", 3000).groups[0].items.map((i) => i.cents), [500, 1000]);
});

test("a size with a bare number is the price of the whole dish when it is at least the dish price", () => {
  const out = parseSpokenOptions("pizza pequena 30, média 40, grande 50", 3000);
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["Pizza pequena", 0], ["Média", 1000], ["Grande", 2000]] },
  ]);
});

test("a size with a bare number far below the dish price is an extra", () => {
  const out = parseSpokenOptions("tamanho pequeno, grande 10", 2850);
  assert.deepEqual(out.groups[0].items.map((i) => i.cents), [0, 1000]);
  assert.deepEqual(out.notes, []);
});

test("a size with a bare number in the gray zone is left empty and the owner is told", () => {
  const out = parseSpokenOptions("tamanho pequeno 20, grande 40", 2850);
  assert.deepEqual(out.groups[0].items.map((i) => i.cents), [0, 1150]);
  assert.equal(out.notes.length, 1);
  assert.match(out.notes[0], /Pequeno: ouvi R\$ 20,00, e o prato custa R\$ 28,50/);
});

test("a bare number in extras is always an extra", () => {
  const out = parseSpokenOptions("adicionais bacon 40", 20);
  assert.equal(out.groups[0].items[0].cents, 4000);
});

test("measures stay in the name: 300 ml, 500 ml mais 6", () => {
  const out = parseSpokenOptions("300 ml, 500 ml mais 6, 700 ml mais 11", 1800);
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["300 ml", 0], ["500 ml", 600], ["700 ml", 1100]] },
  ]);
  assert.deepEqual(parseSpokenOptions("pizza de 4 fatias mais 3, de 8 fatias mais 9", 0).groups[0].items.map((i) => i.name), ["Pizza de 4 fatias", "8 fatias"]);
});

test("removals: 'tirar' lists ingredients, 'sem' says them one by one, prices are ignored", () => {
  const a = parseSpokenOptions("tirar cebola, tomate e picles");
  assert.deepEqual(shape(a.groups), [
    { name: "Retirar", min: 0, max: 3, items: [["Sem cebola", 0], ["Sem tomate", 0], ["Sem picles", 0]] },
  ]);
  const b = parseSpokenOptions("sem cebola e sem tomate, sem maionese");
  assert.deepEqual(b.groups[0].items.map((i) => i.name), ["Sem cebola", "Sem tomate", "Sem maionese"]);
  const c = parseSpokenOptions("sem queijo 3");
  assert.deepEqual(c.groups[0].items.map((i) => i.cents), [0]);
  assert.match(c.notes[0], /não custa nada/);
});

test("sizes said in a row with no commas are separate options and make a size group by themselves", () => {
  const out = parseSpokenOptions("pequeno médio grande");
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["Pequeno", 0], ["Médio", 0], ["Grande", 0]] },
  ]);
});

test("'mais' between options with no number is only a separator", () => {
  const out = parseSpokenOptions("adicionais mais bacon mais ovo mais queijo 3");
  assert.deepEqual(shape(out.groups)[0].items, [["Bacon", 0], ["Ovo", 0], ["Queijo", 300]]);
});

test("the end of the phrase ('pronto', 'só isso') is not an option", () => {
  assert.deepEqual(parseSpokenOptions("adicionais bacon 4 pronto").groups[0].items.map((i) => i.name), ["Bacon"]);
  assert.deepEqual(parseSpokenOptions("adicionais bacon 4, ovo 2, só isso").groups[0].items.map((i) => i.name), ["Bacon", "Ovo"]);
});

test("a group said twice is one group", () => {
  const out = parseSpokenOptions("adicionais bacon 4. tamanho pequeno, grande mais 5. adicionais ovo 2");
  assert.deepEqual(out.groups.map((g) => g.name), ["Adicionais", "Tamanho"]);
  assert.deepEqual(out.groups[0].items.map((i) => i.name), ["Bacon", "Ovo"]);
});

test("other group names: sabor is required, borda is optional", () => {
  const out = parseSpokenOptions("sabor chocolate, morango. borda catupiry mais 8");
  assert.deepEqual(shape(out.groups), [
    { name: "Sabor", min: 1, max: 1, items: [["Chocolate", 0], ["Morango", 0]] },
    { name: "Borda", min: 0, max: 1, items: [["Catupiry", 800]] },
  ]);
});

test("options said with no heading and no size, but with prices, are kept in a group the owner is asked to name", () => {
  const out = parseSpokenOptions("bacon 4, ovo 2");
  assert.equal(out.groups[0].name, "Opções");
  assert.ok(out.notes.some((note) => /Não ouvi o nome do grupo/.test(note)));
});

test("words with no heading, no size and no price are talk, not options", () => {
  const out = parseSpokenOptions("bom dia tudo bem");
  assert.deepEqual(out.groups, []);
  assert.match(out.notes[0], /Não entendi onde colocar: Dia tudo bem/);
});

test("a long run of words is flagged, not hidden", () => {
  const out = parseSpokenOptions("adicionais bacon crocante defumado com queijo derretido e muito molho especial da casa 4");
  assert.ok(out.notes.some((note) => /ficou comprido/.test(note)));
});

test("a number that is not clean is left out with a warning, never guessed", () => {
  const out = parseSpokenOptions("adicionais bacon 99999999999");
  assert.equal(out.groups[0].items[0].cents, 0);
  assert.ok(out.notes.some((note) => /Não entendi o número/.test(note)));
});

test("a price with no option before it is reported", () => {
  const out = parseSpokenOptions("mais 5");
  assert.deepEqual(out.groups, []);
  assert.match(out.notes[0], /sem saber de qual opção/);
});

test("nothing understood gives an empty result and the help sentence exists", () => {
  assert.deepEqual(parseSpokenOptions("").groups, []);
  assert.deepEqual(parseSpokenOptions("   ").groups, []);
  assert.match(SPOKEN_OPTIONS_HELP, /tamanho pequeno/);
});

test("words that are names of JavaScript things are plain words", () => {
  const out = parseSpokenOptions("adicionais constructor 3, toString 2");
  assert.deepEqual(out.groups[0].items.map((i) => i.name), ["Constructor", "ToString"]);
});

test("what was understood passes the same checks as typed options and goes to the server as typed ones do", () => {
  const out = parseSpokenOptions("tamanho pequeno, médio mais 5, grande mais 10. adicionais bacon 4, ovo 2 e meio. sem cebola", 2850);
  const drafts = out.groups.map(groupFrom);
  assert.deepEqual(validate(drafts), []);
  assert.deepEqual(toPayload(drafts).groups[1], {
    name: "Adicionais",
    min_choices: 0,
    max_choices: 2,
    items: [
      { name: "Bacon", price_delta: "4.00", active: true },
      { name: "Ovo", price_delta: "2.50", active: true },
    ],
  });
});

test("saying more adds to the group on the screen and keeps what is there", () => {
  const onScreen = fromApi([
    {
      id: "g1",
      name: "Adicionais",
      min_choices: 0,
      max_choices: 1,
      items: [{ id: "i1", name: "Bacon", price_delta: "4.00", active: false }],
    },
  ]);
  const said = parseSpokenOptions("adicionais bacon 9, ovo 2. tamanho pequeno, grande mais 5", 3000).groups.map(groupFrom);
  const merged = mergeGroups(onScreen, said);
  assert.deepEqual(merged.map((g) => g.name), ["Adicionais", "Tamanho"]);
  const extras = merged[0];
  assert.equal(extras.id, "g1");
  // Bacon was said again with a price: the new price, and still "Acabou"
  assert.deepEqual(extras.items.map((i) => [i.id, i.name, i.price, i.active]), [["i1", "Bacon", "9,00", false], [undefined, "Ovo", "2,00", true]]);
  assert.equal(extras.max, 1); // the rule the owner already had is kept; only the options are added
});

test("a ready-made group waiting for its first name gives its place to the first thing said", () => {
  const waiting = [starter("adicionais")];
  const merged = mergeGroups(waiting, parseSpokenOptions("adicionais bacon 4").groups.map(groupFrom));
  assert.deepEqual(merged[0].items.map((i) => i.name), ["Bacon"]);
});

test("merging never goes past 8 groups", () => {
  const many = Array.from({ length: 8 }, (_, n) => groupFrom({ name: `G${n}`, min: 0, max: 1, items: [{ name: "A", cents: 0 }] }));
  const merged = mergeGroups(many, [groupFrom({ name: "Novo", min: 0, max: 1, items: [{ name: "A", cents: 0 }] })]);
  assert.equal(merged.length, 8);
});

test("natural speech: talk before the heading, the size said again with its price, 'a mais'", () => {
  const out = parseSpokenOptions(
    "a pizza tem tamanho pequeno médio e grande o médio é 5 reais a mais e o grande 10 reais a mais",
    3000
  );
  assert.deepEqual(shape(out.groups), [
    { name: "Tamanho", min: 1, max: 1, items: [["Pequeno", 0], ["Médio", 500], ["Grande", 1000]] },
  ]);
  assert.deepEqual(out.notes, []);
});

test("'cada' gives one price to every option still without one, before or after the number", () => {
  const before = parseSpokenOptions("os adicionais são bacon, ovo e queijo, cada um 3 reais");
  const after = parseSpokenOptions("adicionais bacon, ovo e queijo 3 reais cada");
  for (const out of [before, after]) {
    assert.deepEqual(shape(out.groups), [
      { name: "Adicionais", min: 0, max: 3, items: [["Bacon", 300], ["Ovo", 300], ["Queijo", 300]] },
    ]);
  }
  // an option that already has its own price keeps it
  const mixed = parseSpokenOptions("adicionais bacon 5, ovo, queijo, cada um 3 reais");
  assert.deepEqual(shape(mixed.groups)[0].items, [["Bacon", 500], ["Ovo", 300], ["Queijo", 300]]);
});

test("prices in words for each size, 'e' that is not part of a price", () => {
  const out = parseSpokenOptions("tem pequena trinta reais média quarenta reais e grande cinquenta reais", 3000);
  assert.deepEqual(out.groups[0].items.map((i) => [i.name, i.cents]), [["Pequena", 0], ["Média", 1000], ["Grande", 2000]]);
});

test("'e' before a measure does not join the price: 6 reais e 700 ml", () => {
  const out = parseSpokenOptions("tamanho 300 ml, 500 ml mais seis reais e 700 ml mais onze reais", 1800);
  assert.deepEqual(out.groups[0].items.map((i) => [i.name, i.cents]), [["300 ml", 0], ["500 ml", 600], ["700 ml", 1100]]);
  assert.deepEqual(out.notes, []);
});

test("cents spoken after reais still join: 5 reais e 50 centavos, dois e cinquenta", () => {
  const out = parseSpokenOptions("adicionais bacon 5 reais e 50 centavos, ovo dois e cinquenta, queijo três e meio");
  assert.deepEqual(out.groups[0].items.map((i) => i.cents), [550, 250, 350]);
});

test("'pode tirar', 'ponto da carne' and a phrase that starts with 'sem' before the extras", () => {
  assert.deepEqual(parseSpokenOptions("pode tirar cebola e tomate").groups[0].items.map((i) => i.name), ["Sem cebola", "Sem tomate"]);
  const meat = parseSpokenOptions("ponto da carne mal passada, ao ponto, bem passada");
  assert.deepEqual(shape(meat.groups), [
    { name: "Ponto da carne", min: 1, max: 1, items: [["Mal passada", 0], ["Ao ponto", 0], ["Bem passada", 0]] },
  ]);
  const mixed = parseSpokenOptions("sem cebola, sem tomate, adicionais bacon 4");
  assert.deepEqual(mixed.groups.map((g) => g.name), ["Retirar", "Adicionais"]);
});

test("two different prices for the same option: the first stays and the owner is told", () => {
  const out = parseSpokenOptions("adicionais bacon 4. bacon 6");
  assert.equal(out.groups[0].items[0].cents, 400);
  assert.ok(out.notes.some((note) => /dois preços/.test(note)));
});

test("an option said again with no price keeps the price it had", () => {
  const onScreen = [groupFrom({ name: "Adicionais", min: 0, max: 2, items: [{ name: "Bacon", cents: 400 }, { name: "Ovo", cents: 200 }] })];
  const merged = mergeGroups(onScreen, parseSpokenOptions("adicionais bacon, queijo 3").groups.map(groupFrom));
  assert.deepEqual(merged[0].items.map((i) => [i.name, i.price]), [["Bacon", "4,00"], ["Ovo", "2,00"], ["Queijo", "3,00"]]);
});
