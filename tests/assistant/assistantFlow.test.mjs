import test from "node:test";
import assert from "node:assert/strict";

import {
  initialFlow,
  startFromTemplate,
  toggleItem,
  toggleAllInCategory,
  addItem,
  applySpoken,
  nextCategory,
  previousCategory,
  skipCategory,
  startPrices,
  setCurrentPrice,
  skipCurrentPrice,
  backOnePrice,
  editPrice,
  removeItem,
  selectedItems,
  selectedInCategory,
  currentPriceItem,
  missingPrices,
  importPayload,
  summary,
  cleanItemName,
} from "../../frontend/src/assistant/assistantFlow.ts";
import { interpretSpokenItems } from "../../frontend/src/assistant/assistantLogic.ts";

const TEMPLATE = {
  id: "lanchonete",
  name: "Lanchonete",
  icon: "🍔",
  categories: [
    { name: "Lanches", items: [{ name: "X-Burguer" }, { name: "X-Salada" }, { name: "Misto quente" }] },
    { name: "Bebidas", items: [{ name: "Suco de laranja" }, { name: "Água mineral" }] },
    { name: "Vazia", items: [] },
  ],
};

const fresh = () => startFromTemplate(TEMPLATE);
const names = (state) => selectedItems(state).map((item) => item.name);

test("starting from a template: nothing is selected, empty categories are dropped", () => {
  const state = fresh();
  assert.equal(state.step, "pick");
  assert.equal(state.templateName, "Lanchonete");
  assert.deepEqual(state.categories.map((c) => c.name), ["Lanches", "Bebidas"]);
  assert.equal(selectedItems(state).length, 0);
  assert.equal(initialFlow().step, "type");
});

test("the template is not mutated and every step returns a new state", () => {
  const before = fresh();
  const snapshot = JSON.stringify(before);
  const after = toggleItem(before, 0, 0);
  assert.equal(JSON.stringify(before), snapshot);
  assert.notEqual(before, after);
  assert.equal(TEMPLATE.categories[0].items.length, 3);
});

test("tapping selects and unselects; unknown positions change nothing", () => {
  let state = toggleItem(fresh(), 0, 1);
  assert.deepEqual(names(state), ["X-Salada"]);
  state = toggleItem(state, 0, 1);
  assert.deepEqual(names(state), []);
  const same = toggleItem(state, 9, 9);
  assert.equal(same, state);
});

test("select all toggles the whole category", () => {
  let state = toggleAllInCategory(fresh(), 0);
  assert.equal(selectedInCategory(state, 0), 3);
  assert.equal(selectedInCategory(state, 1), 0);
  state = toggleAllInCategory(state, 0);
  assert.equal(selectedInCategory(state, 0), 0);
});

test("saying dishes selects the known ones and adds the new ones", () => {
  const state = fresh();
  const spoken = interpretSpokenItems("x burguer misto quente e pão de queijo", state.categories[0].items.map((i) => i.name));
  const result = applySpoken(state, 0, spoken);
  assert.deepEqual(names(result.state), ["X-Burguer", "Misto quente", "Pão de queijo"]);
  assert.deepEqual(result.selected, ["X-Burguer", "Misto quente"]);
  assert.deepEqual(result.added, ["Pão de queijo"]);
  assert.equal(result.state.categories[0].items[3].custom, true);
});

test("adding a dish that exists only selects it; saying it twice does not duplicate", () => {
  const first = addItem(fresh(), 0, "x-burguer");
  assert.deepEqual(first.selected, ["X-Burguer"]);
  assert.equal(first.state.categories[0].items.length, 3);
  const again = addItem(first.state, 0, "  X-BURGUER ");
  assert.deepEqual(again.selected, []);
  assert.deepEqual(again.added, []);

  const custom = addItem(fresh(), 0, "pastel de vento");
  const dup = addItem(custom.state, 0, "Pastel de Vento");
  assert.equal(dup.state.categories[0].items.length, 4);
  assert.equal(dup.state.categories[0].items[3].name, "Pastel de vento");
});

test("blank or oversized names", () => {
  const blank = addItem(fresh(), 0, "   ");
  assert.equal(blank.state.categories[0].items.length, 3);
  assert.equal(cleanItemName("  coxinha,  "), "Coxinha");
  assert.equal(cleanItemName("a".repeat(400)).length, 150);
  assert.equal(addItem(fresh(), 7, "coxinha").added.length, 0);
});

test("moving through the categories and into the prices", () => {
  let state = toggleItem(fresh(), 0, 0);
  state = nextCategory(state);
  assert.equal(state.step, "pick");
  assert.equal(state.categoryIndex, 1);
  assert.equal(previousCategory(state).categoryIndex, 0);
  assert.equal(previousCategory(previousCategory(state)).categoryIndex, 0);
  state = toggleItem(state, 1, 0);
  state = nextCategory(state);
  assert.equal(state.step, "prices");
  assert.equal(state.priceCursor, 0);
});

test("finishing with nothing selected stays on the dishes", () => {
  let state = nextCategory(fresh());
  state = nextCategory(state);
  assert.equal(state.step, "pick");
  assert.equal(startPrices(fresh()).step, "pick");
});

test("skipping a category clears it", () => {
  let state = toggleAllInCategory(fresh(), 0);
  state = skipCategory(state);
  assert.equal(selectedInCategory(state, 0), 0);
  assert.equal(state.categoryIndex, 1);
});

function readyForPrices() {
  let state = toggleItem(toggleItem(fresh(), 0, 0), 0, 2);
  state = toggleItem(state, 1, 0);
  return startPrices({ ...state, categoryIndex: 1 });
}

test("prices are asked one dish at a time and end in the review", () => {
  let state = readyForPrices();
  assert.equal(state.step, "prices");
  assert.equal(currentPriceItem(state).name, "X-Burguer");
  state = setCurrentPrice(state, "18,50");
  assert.equal(currentPriceItem(state).name, "Misto quente");
  state = setCurrentPrice(state, "12");
  assert.equal(currentPriceItem(state).name, "Suco de laranja");
  state = setCurrentPrice(state, "R$ 8");
  assert.equal(state.step, "review");
  assert.deepEqual(selectedItems(state).map((i) => i.price), ["18.50", "12.00", "8.00"]);
  assert.equal(missingPrices(state).length, 0);
});

test("an unusable price changes nothing", () => {
  const state = readyForPrices();
  for (const bad of ["", "abc", "0", "-3", "100000"]) {
    assert.equal(setCurrentPrice(state, bad), state, bad);
  }
});

test("skipping a price drops that dish and shows the next one", () => {
  let state = readyForPrices();
  state = skipCurrentPrice(state);
  assert.deepEqual(names(state), ["Misto quente", "Suco de laranja"]);
  assert.equal(currentPriceItem(state).name, "Misto quente");
  state = setCurrentPrice(state, "10");
  state = skipCurrentPrice(state);
  assert.equal(state.step, "review");
  assert.deepEqual(names(state), ["Misto quente"]);
});

test("dropping every dish returns to the first category", () => {
  let state = toggleItem(fresh(), 1, 1);
  state = startPrices({ ...state, categoryIndex: 1 });
  state = skipCurrentPrice(state);
  assert.equal(state.step, "pick");
  assert.equal(state.categoryIndex, 0);
});

test("going back one dish, from the review and from the first dish", () => {
  let state = readyForPrices();
  state = setCurrentPrice(state, "18");
  state = backOnePrice(state);
  assert.equal(currentPriceItem(state).name, "X-Burguer");
  state = backOnePrice(state);
  assert.equal(state.step, "pick");

  let done = readyForPrices();
  for (const price of ["1", "2", "3"]) done = setCurrentPrice(done, price);
  assert.equal(done.step, "review");
  const back = backOnePrice(done);
  assert.equal(back.step, "prices");
  assert.equal(currentPriceItem(back).name, "Suco de laranja");
});

test("returning to the prices only asks for what is still missing", () => {
  let state = readyForPrices();
  state = setCurrentPrice(state, "18");
  state = setCurrentPrice(state, "12");
  const again = startPrices({ ...state, step: "pick" });
  assert.equal(again.step, "prices");
  assert.equal(currentPriceItem(again).name, "Suco de laranja");
});

test("review: edit a price, remove a dish", () => {
  let state = readyForPrices();
  for (const price of ["18", "12", "8"]) state = setCurrentPrice(state, price);
  state = editPrice(state, 0, 0, "19,90");
  assert.equal(state.categories[0].items[0].price, "19.90");
  assert.equal(editPrice(state, 0, 0, "abc"), state);
  state = removeItem(state, 0, 2);
  assert.deepEqual(names(state), ["X-Burguer", "Suco de laranja"]);
  assert.deepEqual(summary(state), { items: 2, categories: 2 });
});

test("the payload has only selected dishes with a price and no empty category", () => {
  let state = readyForPrices();
  state = setCurrentPrice(state, "18,50");
  state = setCurrentPrice(state, "12");
  // The drink still has no price: it must not be sent.
  assert.deepEqual(importPayload(state), {
    categories: [{ name: "Lanches", items: [{ name: "X-Burguer", price: "18.50" }, { name: "Misto quente", price: "12.00" }] }],
  });
  assert.deepEqual(importPayload(fresh()), { categories: [] });
});
