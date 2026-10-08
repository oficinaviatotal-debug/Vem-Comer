import test from "node:test";
import assert from "node:assert/strict";

import {
  LIMITS,
  blankItem,
  fitGroup,
  fromApi,
  groupsBadge,
  parsePriceCents,
  priceToInput,
  sentence,
  starter,
  toPayload,
  validate,
} from "../../frontend/src/service/optionsDraft.ts";

const apiGroups = [
  {
    id: "g1",
    name: "Tamanho",
    min_choices: 1,
    max_choices: 1,
    items: [
      { id: "i1", name: "Pequena", price_delta: "0.00", active: true },
      { id: "i2", name: "Grande", price_delta: "8.50", active: true },
    ],
  },
  {
    id: "g2",
    name: "Adicionais",
    min_choices: 0,
    max_choices: 2,
    items: [{ id: "i3", name: "Bacon", price_delta: 4, active: false }],
  },
];

test("prices are read the way a person types them", () => {
  assert.equal(parsePriceCents(""), 0);
  assert.equal(parsePriceCents("   "), 0);
  assert.equal(parsePriceCents("6,50"), 650);
  assert.equal(parsePriceCents("6.5"), 650);
  assert.equal(parsePriceCents("R$ 6,5"), 650);
  assert.equal(parsePriceCents("1.250,00"), null); // reads as 1250,00, above the 999,99 limit
  assert.equal(parsePriceCents("1.5"), 150);
  assert.equal(parsePriceCents("999,99"), 99999);
  assert.equal(parsePriceCents("1000"), null);
  assert.equal(parsePriceCents("abc"), null);
  assert.equal(parsePriceCents("-3"), null);
  assert.equal(parsePriceCents("3,456"), null);
});

test("a price from the server comes back as the owner types it, free as empty", () => {
  assert.equal(priceToInput("8.50"), "8,50");
  assert.equal(priceToInput(4), "4,00");
  assert.equal(priceToInput("0.00"), "");
  assert.equal(priceToInput(null), "");
  assert.equal(priceToInput("lixo"), "");
});

test("groups from the server keep their ids, the off switch and the prices as text", () => {
  const drafts = fromApi(apiGroups);
  assert.equal(drafts.length, 2);
  assert.deepEqual(
    drafts[0].items.map((item) => [item.id, item.name, item.price, item.active]),
    [["i1", "Pequena", "", true], ["i2", "Grande", "8,50", true]]
  );
  assert.equal(drafts[1].items[0].active, false);
  assert.equal(drafts[0].id, "g1");
  assert.equal(new Set([...drafts.map((g) => g.uid), ...drafts.flatMap((g) => g.items.map((i) => i.uid))]).size, 5);
  assert.deepEqual(fromApi(undefined), []);
  assert.deepEqual(fromApi(null), []);
});

test("reading from the server and sending back changes nothing but the price format", () => {
  const payload = toPayload(fromApi(apiGroups));
  assert.deepEqual(payload, {
    groups: [
      {
        id: "g1",
        name: "Tamanho",
        min_choices: 1,
        max_choices: 1,
        items: [
          { id: "i1", name: "Pequena", price_delta: "0.00", active: true },
          { id: "i2", name: "Grande", price_delta: "8.50", active: true },
        ],
      },
      {
        id: "g2",
        name: "Adicionais",
        min_choices: 0,
        max_choices: 1, // only one option exists, so "up to 2" is cut to what is possible
        items: [{ id: "i3", name: "Bacon", price_delta: "4.00", active: false }],
      },
    ],
  });
});

test("new groups and options go without an id, so the server makes them", () => {
  const group = starter("tamanho");
  const payload = toPayload([group]);
  assert.equal("id" in payload.groups[0], false);
  assert.equal("id" in payload.groups[0].items[0], false);
});

test("the size starter is required, one choice, three options to rename", () => {
  const group = starter("tamanho");
  assert.equal(group.name, "Tamanho");
  assert.deepEqual([group.min, group.max], [1, 1]);
  assert.deepEqual(group.items.map((item) => item.name), ["Pequeno", "Médio", "Grande"]);
  assert.deepEqual(validate([group]), []);
});

test("the extras starter is optional and waits for the first option to be typed", () => {
  const group = starter("adicionais");
  assert.deepEqual([group.min, group.max], [0, 1]); // one empty option: max fits to 1
  assert.equal(validate([group]).length, 1);
  assert.match(validate([group])[0], /escreva o nome da opção 1/);
});

test("the remove starter has free options for 'no onion'", () => {
  const group = starter("retirar");
  assert.deepEqual(group.items.map((item) => item.name), ["Sem cebola", "Sem tomate"]);
  assert.deepEqual(validate([group]), []);
  assert.deepEqual(toPayload([group]).groups[0].items.map((item) => item.price_delta), ["0.00", "0.00"]);
});

test("min and max follow the number of options", () => {
  const group = { uid: "x", name: "G", min: 3, max: 9, items: [blankItem(), blankItem()] };
  const fitted = fitGroup(group);
  assert.deepEqual([fitted.min, fitted.max], [2, 2]);
  // Nothing to fix returns the very same object.
  const ok = { uid: "y", name: "G", min: 1, max: 2, items: [blankItem(), blankItem()] };
  assert.equal(fitGroup(ok), ok);
  // An empty group keeps a possible rule.
  assert.deepEqual([fitGroup({ ...ok, items: [] }).min, fitGroup({ ...ok, items: [] }).max], [0, 1]);
});

test("the owner is told everything that is wrong, in words", () => {
  const draft = [
    { uid: "a", name: "", min: 0, max: 1, items: [{ uid: "i", name: "", price: "x", active: true }] },
    { uid: "b", name: "Tamanho", min: 1, max: 1, items: [] },
    {
      uid: "c",
      name: "tamanho",
      min: 0,
      max: 2,
      items: [
        { uid: "j", name: "Bacon", price: "3", active: true },
        { uid: "k", name: "BACON", price: "", active: true },
      ],
    },
  ];
  const problems = validate(draft);
  assert.ok(problems.includes("Grupo 1: escreva o nome do grupo."));
  assert.ok(problems.includes("Grupo 1: escreva o nome da opção 1."));
  assert.ok(problems.some((p) => p.includes("preço inválido")));
  assert.ok(problems.includes("Tamanho: coloque pelo menos uma opção."));
  assert.ok(problems.includes("Dois grupos com o nome tamanho. Use nomes diferentes."));
  assert.ok(problems.includes("tamanho: a opção BACON está repetida."));
});

test("limits: too many groups, too many options, too long names", () => {
  const many = Array.from({ length: LIMITS.groups + 1 }, (_, n) => ({
    uid: `g${n}`,
    name: `Grupo ${n}`,
    min: 0,
    max: 1,
    items: [{ uid: `i${n}`, name: "A", price: "", active: true }],
  }));
  assert.ok(validate(many).some((p) => p.includes("no máximo 8 grupos")));

  const long = { uid: "l", name: "x".repeat(LIMITS.name + 1), min: 0, max: 1, items: [{ uid: "m", name: "y".repeat(LIMITS.name + 1), price: "", active: true }] };
  const problems = validate([long]);
  assert.equal(problems.length, 2);

  const huge = { uid: "h", name: "G", min: 0, max: 1, items: Array.from({ length: LIMITS.items + 1 }, (_, n) => ({ uid: `z${n}`, name: `Op ${n}`, price: "", active: true })) };
  assert.ok(validate([huge]).some((p) => p.includes("no máximo 30 opções")));
});

test("spaces and line breaks in names are collapsed before sending", () => {
  const group = { uid: "s", name: "  Retirar   ingredientes ", min: 0, max: 1, items: [{ uid: "t", name: " Sem \n cebola ", price: " 1,5 ", active: true }] };
  const sent = toPayload([group]).groups[0];
  assert.equal(sent.name, "Retirar ingredientes");
  assert.deepEqual(sent.items[0], { name: "Sem cebola", price_delta: "1.50", active: true });
});

test("the sentence says what the customer will be asked", () => {
  assert.equal(sentence({ min: 1, max: 1 }), "O cliente escolhe 1.");
  assert.equal(sentence({ min: 2, max: 2 }), "O cliente escolhe 2.");
  assert.equal(sentence({ min: 1, max: 3 }), "O cliente escolhe de 1 a 3.");
  assert.equal(sentence({ min: 0, max: 1 }), "O cliente pode escolher 1, se quiser.");
  assert.equal(sentence({ min: 0, max: 3 }), "O cliente pode escolher até 3, se quiser.");
});

test("the dish row badge counts the groups", () => {
  assert.equal(groupsBadge(0), "");
  assert.equal(groupsBadge(undefined), "");
  assert.equal(groupsBadge(1), "1 grupo de opções");
  assert.equal(groupsBadge(3), "3 grupos de opções");
});
