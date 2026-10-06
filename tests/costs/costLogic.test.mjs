import test from "node:test";
import assert from "node:assert/strict";

import {
  PACKAGE_UNITS,
  cmvOf,
  draftCost,
  formatPercent,
  formatQuantity,
  ingredientFormProblem,
  packageLabel,
  parseDecimal,
  periodSentence,
  productSentence,
  recipePayload,
  recipeProblem,
  sortForAttention,
  statusChip,
  statusLabel,
  toBase,
  toInput,
  unitsFor,
} from "../../frontend/src/costs/costLogic.ts";

test("numbers typed the Brazilian way", () => {
  assert.equal(parseDecimal("18,90"), 18.9);
  assert.equal(parseDecimal("R$ 1.234,50"), 1234.5);
  assert.equal(parseDecimal("0,25"), 0.25);
  assert.equal(parseDecimal("18.9"), 18.9);
  assert.equal(parseDecimal(" 250 "), 250);
  assert.equal(parseDecimal(""), null);
  assert.equal(parseDecimal("abc"), null);
  assert.equal(parseDecimal("-3"), null);
  assert.equal(parseDecimal("1.2.3"), null);
  assert.equal(parseDecimal("1.000"), 1000);
  assert.equal(parseDecimal("2.500"), 2500);
  assert.equal(parseDecimal("0.250"), 0.25);
  assert.equal(parseDecimal("1.5"), 1.5);
});

test("units convert to what the database keeps", () => {
  assert.equal(toBase("1", "kg"), 1000);
  assert.equal(toBase("0,25", "kg"), 250);
  assert.equal(toBase("2", "l"), 2000);
  assert.equal(toBase("1", "dz"), 12);
  assert.equal(toBase("0", "g"), null);
  assert.equal(toBase("x", "g"), null);
});

test("only matching units are offered for an ingredient", () => {
  assert.deepEqual(unitsFor("g").map((u) => u.value), ["kg", "g"]);
  assert.deepEqual(unitsFor("ml").map((u) => u.value), ["l", "ml"]);
  assert.deepEqual(unitsFor("un").map((u) => u.value), ["un", "dz"]);
  assert.equal(PACKAGE_UNITS.length, 6);
});

test("quantities read naturally", () => {
  assert.equal(formatQuantity(250, "g"), "250 g");
  assert.equal(formatQuantity(1000, "g"), "1 kg");
  assert.equal(formatQuantity(1500, "ml"), "1,5 L");
  assert.equal(formatQuantity(1, "un"), "1 unidade");
  assert.equal(formatQuantity(12, "un"), "12 unidades");
  assert.equal(packageLabel(18.9, 1000, "g"), "R$ 18,90 por 1 kg");
});

test("stored quantity goes back to the friendliest edit unit", () => {
  assert.deepEqual(toInput(1000, "g"), { quantity: "1", unit: "kg" });
  assert.deepEqual(toInput(250, "g"), { quantity: "250", unit: "g" });
  assert.deepEqual(toInput(1500, "ml"), { quantity: "1,5", unit: "l" });
  assert.deepEqual(toInput(12, "un"), { quantity: "12", unit: "un" });
  assert.deepEqual(toInput(2500000, "g"), { quantity: "2500", unit: "kg" });
  // not whole grams: stays in grams so saving again keeps the exact number
  assert.deepEqual(toInput(2267.96, "g"), { quantity: "2267,96", unit: "g" });
  assert.deepEqual(toInput(1234.5, "ml"), { quantity: "1234,5", unit: "ml" });
});

test("live cost of the recipe card matches the server's example", () => {
  const lines = [
    { quantity: "250", unit: "g", packageQty: 1000, packagePrice: 18.9 },
    { quantity: "0,2", unit: "kg", packageQty: 2000, packagePrice: 12 },
    { quantity: "", unit: "g", packageQty: 1000, packagePrice: 5 },
  ];
  assert.equal(draftCost(lines, "1,50"), 7.43);
  assert.equal(cmvOf(7.43, 25), 29.7);
  assert.equal(draftCost([], ""), null);
  assert.equal(draftCost([], "2"), 2);
  assert.equal(cmvOf(null, 25), null);
  assert.equal(cmvOf(5, 0), null);
});

test("status names and chips", () => {
  assert.equal(statusLabel("ok"), "Na meta");
  assert.equal(statusLabel("alto"), "Custo alto");
  assert.equal(statusLabel("sem_custo"), "Sem ficha");
  assert.equal(statusChip("alto"), "chip chip-alto");
  assert.equal(statusChip("sem_preco"), "chip");
});

test("most urgent dishes come first", () => {
  const sorted = sortForAttention([
    { name: "Suco", status: "sem_custo", cmv: null },
    { name: "Frango", status: "ok", cmv: 29.7 },
    { name: "Peixe", status: "alto", cmv: 52 },
    { name: "Bife", status: "atencao", cmv: 40 },
    { name: "Arroz", status: "alto", cmv: 60 },
  ]);
  assert.deepEqual(sorted.map((p) => p.name), ["Arroz", "Peixe", "Bife", "Suco", "Frango"]);
});

test("the sentence under each dish says what to do", () => {
  const plain = (text) => text.replace(/ /g, " ");
  assert.equal(
    plain(productSentence({ name: "Frango", price: 25, cost: 7.43, cmv: 29.7, status: "ok", suggested_price: 21.23 }, 35)),
    "Custa R$ 7,43 e vende por R$ 25,00: CMV de 29,7%, dentro da meta de 35%.",
  );
  assert.equal(
    plain(productSentence({ name: "Frango", price: 15, cost: 7.43, cmv: 49.5, status: "alto", suggested_price: 21.23 }, 35)),
    "Custa R$ 7,43 e vende por R$ 15,00: CMV de 49,5%, acima da meta de 35%. Para ficar na meta de 35%, o preço seria R$ 21,23, ou o custo precisa cair.",
  );
  assert.match(productSentence({ name: "Suco", price: 8, cost: null, cmv: null, status: "sem_custo", suggested_price: null }, 35), /Monte a ficha/);
});

test("ingredient form problems, one at a time", () => {
  const ok = { name: "Frango", quantity: "1", unit: "kg", price: "18,90" };
  assert.equal(ingredientFormProblem(ok), "");
  assert.match(ingredientFormProblem({ ...ok, name: " " }), /nome/);
  assert.match(ingredientFormProblem({ ...ok, quantity: "0" }), /embalagem/);
  assert.match(ingredientFormProblem({ ...ok, price: "" }), /pagou/);
  assert.equal(ingredientFormProblem({ ...ok, price: "0" }), "");
});

test("recipe problems and payload", () => {
  const lines = [
    { ingredientId: "a", quantity: "250", unit: "g" },
    { ingredientId: "b", quantity: "0,2", unit: "kg" },
  ];
  assert.equal(recipeProblem(lines, "1,50"), "");
  assert.match(recipeProblem([...lines, { ingredientId: "", quantity: "1", unit: "g" }], ""), /Escolha/);
  assert.match(recipeProblem([...lines, { ingredientId: "a", quantity: "1", unit: "g" }], ""), /duas vezes/);
  assert.match(recipeProblem([{ ingredientId: "a", quantity: "", unit: "g" }], ""), /quanto vai/);
  assert.match(recipeProblem(lines, "abc"), /Outros custos/);
  assert.deepEqual(recipePayload(" 1 pessoa ", "1,50", lines), {
    portion: "1 pessoa",
    extra_cost: 1.5,
    items: [
      { ingredient_id: "a", quantity: 250, unit: "g" },
      { ingredient_id: "b", quantity: 0.2, unit: "kg" },
    ],
  });
});

test("headline of the last 30 days", () => {
  assert.match(periodSentence({ days: 30, revenue: 0, cost: 0, cmv: null, coverage: null }, 35), /ainda não houve/);
  assert.equal(
    periodSentence({ days: 30, revenue: 58, cost: 14.86, cmv: 29.7, coverage: 86 }, 35),
    "Nos últimos 30 dias, o CMV pela ficha foi 29,7%, dentro da meta de 35%. 86% das vendas tinham ficha.",
  );
  assert.equal(formatPercent(null), "");
});
