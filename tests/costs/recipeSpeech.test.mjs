import test from "node:test";
import assert from "node:assert/strict";

import { mergeSpokenLines, parseRecipeSpeech } from "../../frontend/src/costs/recipeSpeech.ts";

const INGREDIENTS = [
  { id: "peito", name: "Peito de frango", unit: "g" },
  { id: "farinha", name: "Farinha de rosca", unit: "g" },
  { id: "trigo", name: "Farinha de trigo", unit: "g" },
  { id: "ovo", name: "Ovo", unit: "un" },
  { id: "oleo", name: "Óleo de soja", unit: "ml" },
  { id: "batata", name: "Batata", unit: "g" },
];

test("the whole card in one sentence, with digits", () => {
  const spoken = parseRecipeSpeech(
    "Frango à milanesa: 1,2 kg de peito de frango, 300 gramas de farinha de rosca, 4 ovos, 200 ml de óleo, rende 6 porções, porção de 250 gramas",
    INGREDIENTS,
  );
  assert.deepEqual(spoken.lines, [
    { ingredientId: "peito", quantity: "1,2", unit: "kg" },
    { ingredientId: "farinha", quantity: "300", unit: "g" },
    { ingredientId: "ovo", quantity: "4", unit: "un" },
    { ingredientId: "oleo", quantity: "200", unit: "ml" },
  ]);
  assert.equal(spoken.yieldPortions, 6);
  assert.equal(spoken.portionGrams, 250);
  assert.deepEqual(spoken.unknown, []);
});

test("numbers said as words and compound weights", () => {
  const spoken = parseRecipeSpeech(
    "um quilo e meio de peito de frango e duzentos e cinquenta gramas de farinha de rosca e quatro ovos, serve oito pessoas",
    INGREDIENTS,
  );
  assert.deepEqual(spoken.lines, [
    { ingredientId: "peito", quantity: "1,5", unit: "kg" },
    { ingredientId: "farinha", quantity: "250", unit: "g" },
    { ingredientId: "ovo", quantity: "4", unit: "un" },
  ]);
  assert.equal(spoken.yieldPortions, 8);

  const kgAndGrams = parseRecipeSpeech("1 kg e 200 gramas de peito de frango", INGREDIENTS);
  assert.deepEqual(kgAndGrams.lines, [{ ingredientId: "peito", quantity: "1,2", unit: "kg" }]);

  const half = parseRecipeSpeech("meio quilo de batata, meia dúzia de ovos", INGREDIENTS);
  assert.deepEqual(half.lines, [
    { ingredientId: "batata", quantity: "0,5", unit: "kg" },
    { ingredientId: "ovo", quantity: "0,5", unit: "dz" },
  ]);
});

test("short names find the registered ingredient", () => {
  const spoken = parseRecipeSpeech("200 g de frango, 1 litro de óleo", INGREDIENTS);
  assert.deepEqual(spoken.lines, [
    { ingredientId: "peito", quantity: "200", unit: "g" },
    { ingredientId: "oleo", quantity: "1", unit: "l" },
  ]);
});

test("explains what it could not use", () => {
  const spoken = parseRecipeSpeech("300 g de queijo, um peito de frango, 2 litros de farinha de trigo, sal a gosto", INGREDIENTS);
  assert.deepEqual(spoken.lines, []);
  assert.equal(spoken.unknown.length, 3);
  assert.match(spoken.unknown[0], /queijo: não está nos insumos/);
  assert.match(spoken.unknown[1], /Peito de frango: diga em gramas ou quilos/);
  assert.match(spoken.unknown[2], /Farinha de trigo: diga em gramas ou quilos/);
});

test("ambiguous short name picks the one that matches every word", () => {
  const spoken = parseRecipeSpeech("100 g de farinha de trigo", INGREDIENTS);
  assert.deepEqual(spoken.lines, [{ ingredientId: "trigo", quantity: "100", unit: "g" }]);
});

test("spoken lines replace the same ingredient and add the new ones", () => {
  const merged = mergeSpokenLines(
    [
      { ingredientId: "peito", quantity: "1", unit: "kg" },
      { ingredientId: "batata", quantity: "500", unit: "g" },
      { ingredientId: "", quantity: "", unit: "g" },
    ],
    [
      { ingredientId: "peito", quantity: "1,2", unit: "kg" },
      { ingredientId: "ovo", quantity: "4", unit: "un" },
    ],
  );
  assert.deepEqual(merged, [
    { ingredientId: "peito", quantity: "1,2", unit: "kg" },
    { ingredientId: "batata", quantity: "500", unit: "g" },
    { ingredientId: "ovo", quantity: "4", unit: "un" },
  ]);
});
