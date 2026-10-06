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

/* ------------------------------------------------------ menu read from a photo */

import {
  startPhoto,
  startFromParsed,
  renameItem,
} from "../../frontend/src/assistant/assistantFlow.ts";
import {
  promptFor,
  progressText,
  PHOTO_FIRST_QUESTION,
  PHOTO_QUESTION,
  BUSINESS_QUESTION,
} from "../../frontend/src/assistant/assistantPrompts.ts";

const PARSED = {
  readable: true,
  notes: "",
  categories: [
    { name: "Pizzas", items: [{ name: "Calabresa", price: "52.00" }, { name: "Mussarela", price: "" }, { name: "Portuguesa", price: "55.00" }] },
    { name: "Bebidas", items: [{ name: "Coca-Cola 2L", price: "" }, { name: "Guaraná", price: "9.50" }] },
  ],
};
const parsedFlow = () => startFromParsed(PARSED);

test("the photo step starts from nothing", () => {
  const state = startPhoto();
  assert.equal(state.step, "photo");
  assert.equal(state.source, "template");
  assert.equal(state.categories.length, 0);
});

test("a read menu has every dish selected and goes to the missing prices", () => {
  const state = parsedFlow();
  assert.equal(state.source, "photo");
  assert.equal(state.step, "prices");
  assert.equal(selectedItems(state).length, 5);
  assert.ok(selectedItems(state).every((item) => state.categories[item.categoryIndex].items[item.itemIndex].custom));
  assert.equal(currentPriceItem(state).name, "Mussarela");
  assert.deepEqual(missingPrices(state).map((item) => item.name), ["Mussarela", "Coca-Cola 2L"]);
});

test("a read menu with every price goes straight to the review", () => {
  const state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "10.00" }, { name: "Y", price: "12.50" }] }],
  });
  assert.equal(state.step, "review");
});

test("only the dishes without a price are asked, in order, then the review", () => {
  let state = parsedFlow();
  state = setCurrentPrice(state, "49,90");
  assert.equal(state.step, "prices");
  assert.equal(currentPriceItem(state).name, "Coca-Cola 2L"); // skipped Portuguesa, which had a price
  state = setCurrentPrice(state, "12");
  assert.equal(state.step, "review");
  assert.equal(missingPrices(state).length, 0);
  assert.equal(importPayload(state).categories[0].items.find((i) => i.name === "Mussarela").price, "49.90");
  assert.equal(importPayload(state).categories[0].items.find((i) => i.name === "Calabresa").price, "52.00"); // untouched
});

test("an unusable price changes nothing in a read menu", () => {
  const state = parsedFlow();
  assert.equal(setCurrentPrice(state, "grátis"), state);
});

test("taking out the dish being asked moves to the next missing one, or to the review", () => {
  let state = parsedFlow();
  state = skipCurrentPrice(state); // Mussarela out
  assert.equal(state.step, "prices");
  assert.equal(currentPriceItem(state).name, "Coca-Cola 2L");
  assert.equal(selectedItems(state).length, 4);
  state = skipCurrentPrice(state); // Coca-Cola out
  assert.equal(state.step, "review");
  assert.deepEqual(names(state), ["Calabresa", "Portuguesa", "Guaraná"]);
});

test("taking out the only missing dish at the end of the list goes to the review", () => {
  const state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "10.00" }, { name: "Y", price: "" }] }],
  });
  assert.equal(currentPriceItem(state).name, "Y");
  const after = skipCurrentPrice(state);
  assert.equal(after.step, "review");
  assert.deepEqual(names(after), ["X"]);
});

test("taking out every dish goes back to the list", () => {
  let state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "" }] }],
  });
  state = skipCurrentPrice(state);
  assert.equal(state.step, "pick");
  assert.equal(selectedItems(state).length, 0);
});

test("back from a missing price goes to the previous missing one, then to the list of dishes", () => {
  let state = parsedFlow();
  state = setCurrentPrice(state, "49,90");
  assert.equal(currentPriceItem(state).name, "Coca-Cola 2L");
  // Mussarela now has a price, so there is no earlier missing dish: back opens the list
  const back = backOnePrice(state);
  assert.equal(back.step, "pick");
  assert.equal(back.categoryIndex, 0);

  const fresh2 = parsedFlow();
  assert.equal(backOnePrice(fresh2).step, "pick");
});

test("back from the review of a read menu opens the list of dishes", () => {
  let state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "10.00" }] }],
  });
  assert.equal(state.step, "review");
  state = backOnePrice(state);
  assert.equal(state.step, "pick");
  assert.equal(state.source, "photo");
});

test("from the list of dishes the owner can add a dish and go on to the review", () => {
  let state = backOnePrice(startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "10.00" }] }],
  }));
  state = addItem(state, 0, "pão de queijo").state;
  assert.deepEqual(names(state), ["X", "Pão de queijo"]);
  state = nextCategory(state); // last category: asks the price of what has none
  assert.equal(state.step, "prices");
  assert.equal(currentPriceItem(state).name, "Pão de queijo");
  state = setCurrentPrice(state, "6");
  assert.equal(state.step, "review");
  assert.equal(summary(state).items, 2);
});

test("names and categories read from the photo are cleaned, duplicates and empties dropped", () => {
  const state = startFromParsed({
    readable: true, notes: "",
    categories: [
      { name: "  lanches  ", items: [{ name: " x-burguer ", price: "20.00" }, { name: "X-BURGUER", price: "21.00" }, { name: "  ", price: "5.00" }] },
      { name: "Vazia", items: [] },
      { name: "", items: [{ name: "Perdido", price: "1.00" }] },
    ],
  });
  assert.deepEqual(state.categories.map((c) => c.name), ["Lanches"]);
  assert.deepEqual(state.categories[0].items.map((i) => i.name), ["X-burguer"]);
  assert.equal(state.categories[0].items[0].price, "20.00");
});

test("a bad price coming from outside is dropped, not saved", () => {
  const state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "X", price: "-5" }, { name: "Y", price: "abc" }, { name: "Z", price: "7.5" }] }],
  });
  assert.deepEqual(state.categories[0].items.map((i) => i.price), ["", "", "7.50"]);
  assert.equal(state.step, "prices");
});

test("renaming a dish from the review fixes the reading", () => {
  let state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "Calabrsa", price: "10.00" }, { name: "Mussarela", price: "11.00" }] }],
  });
  state = renameItem(state, 0, 0, "  calabresa ");
  assert.equal(state.categories[0].items[0].name, "Calabresa");
  assert.equal(state.categories[0].items[0].price, "10.00");
});

test("renaming refuses empty names, duplicates and ready-made dishes", () => {
  const state = startFromParsed({
    readable: true, notes: "",
    categories: [{ name: "A", items: [{ name: "Calabresa", price: "10.00" }, { name: "Mussarela", price: "11.00" }] }],
  });
  assert.equal(renameItem(state, 0, 0, "   "), state);
  assert.equal(renameItem(state, 0, 0, "mussarela"), state);
  assert.equal(renameItem(state, 0, 0, "Calabresa"), state);
  assert.equal(renameItem(state, 5, 0, "X"), state);
  const templated = toggleItem(fresh(), 0, 0);
  assert.equal(renameItem(templated, 0, 0, "Outro nome"), templated);
});

test("the old road is unchanged: ready-made dishes are asked in order, even if they already have a price", () => {
  let state = fresh();
  state = toggleItem(toggleItem(toggleItem(state, 0, 0), 0, 1), 0, 2);
  state = startPrices(state);
  assert.equal(state.source, "template");
  state = setCurrentPrice(state, "10");
  assert.equal(currentPriceItem(state).name, "X-Salada");
});

test("prompts and progress for the photo road", () => {
  assert.equal(promptFor(initialFlow()), BUSINESS_QUESTION);
  assert.equal(promptFor(initialFlow(), false, true), PHOTO_FIRST_QUESTION);
  assert.match(PHOTO_FIRST_QUESTION, /cardápio pronto/);
  assert.equal(promptFor(startPhoto()), PHOTO_QUESTION);
  assert.equal(progressText(startPhoto()), "Passo 1 de 3 · Foto do cardápio");

  const state = parsedFlow();
  assert.equal(promptFor(state, true), "Faltam alguns preços que não consegui ler. Mussarela. Quanto custa?");
  assert.equal(promptFor(state, false), "Mussarela. Quanto custa?");
  assert.equal(progressText(state), "Passo 2 de 3 · Preços que faltam · faltam 2");
  assert.equal(progressText(setCurrentPrice(state, "40")), "Passo 2 de 3 · Preços que faltam · falta 1");
  const review = setCurrentPrice(setCurrentPrice(state, "40"), "9");
  assert.equal(progressText(review), "Passo 3 de 3 · Conferir");
  assert.match(promptFor(review), /São 5 pratos/);

  const list = backOnePrice(review);
  assert.match(promptFor(list), /Estes são os pratos que li/);
  assert.match(progressText(list), /^Pratos · Pizzas \(1 de 2\)$/);
});
