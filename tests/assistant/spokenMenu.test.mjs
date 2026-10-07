import test from "node:test";
import assert from "node:assert/strict";

import {
  parseSpokenMenu,
  parseRemoval,
  soundsLikeMenu,
  tidyDishName,
  guessCategory,
} from "../../frontend/src/assistant/spokenMenu.ts";
import {
  addSpokenMenu,
  finishSpeak,
  removeSpoken,
  startSpeak,
  selectedItems,
  setCurrentPrice,
  backOnePrice,
  skipCurrentPrice,
  importPayload,
  currentPriceItem,
} from "../../frontend/src/assistant/assistantFlow.ts";
import {
  promptFor,
  progressText,
  spokenFeedback,
  SPEAK_QUESTION,
  SPEAK_MORE,
} from "../../frontend/src/assistant/assistantPrompts.ts";

/** [name, price, category] of every dish, to compare in one line. */
const read = (text, heading) =>
  parseSpokenMenu(text, heading).dishes.map((dish) => [dish.name, dish.price, dish.category]);

test("a whole menu said in one breath, the way the phone writes it", () => {
  assert.deepEqual(
    read(
      "Eu vendo x tudo a vinte e cinco reais x salada vinte e dois cachorro quente doze e de bebida coca-cola lata seis reais e guaraná cinco"
    ),
    [
      ["X-Tudo", "25.00", "Lanches"],
      ["X-Salada", "22.00", "Lanches"],
      ["Cachorro quente", "12.00", "Lanches"],
      ["Coca-cola lata", "6.00", "Bebidas"],
      ["Guaraná", "5.00", "Bebidas"],
    ]
  );
});

test("digits, R$, commas and cents", () => {
  assert.deepEqual(read("x-tudo 25 reais, x-salada 22 e de bebida coca lata 6"), [
    ["X-Tudo", "25.00", "Lanches"],
    ["X-Salada", "22.00", "Lanches"],
    ["Coca lata", "6.00", "Bebidas"],
  ]);
  assert.deepEqual(read("x-bacon R$ 28,50"), [["X-Bacon", "28.50", "Lanches"]]);
  assert.deepEqual(read("pastel dezoito e cinquenta coxinha seis"), [
    ["Pastel", "18.50", "Salgados"],
    ["Coxinha", "6.00", "Salgados"],
  ]);
  assert.deepEqual(read("x-salada vinte, x-egg vinte e dois e cinquenta"), [
    ["X-Salada", "20.00", "Lanches"],
    ["X-Egg", "22.50", "Lanches"],
  ]);
  assert.deepEqual(read("coxinha um real e cinquenta"), [["Coxinha", "1.50", "Salgados"]]);
});

test("numbers that are part of the dish are not prices", () => {
  assert.deepEqual(read("coca 2 litros 12 e coca lata 6"), [
    ["Coca 2 litros", "12.00", "Bebidas"],
    ["Coca lata", "6.00", "Bebidas"],
  ]);
  assert.deepEqual(read("pizza quatro queijos 45, pizza calabresa 40"), [
    ["Pizza quatro queijos", "45.00", "Pizzas"],
    ["Pizza calabresa", "40.00", "Pizzas"],
  ]);
  assert.deepEqual(read("coca 1,5 litro 10"), [["Coca 1,5 litro", "10.00", "Bebidas"]]);
  assert.deepEqual(read("açaí 500 ml 18"), [["Açaí 500 ml", "18.00", "Açaí"]]);
  assert.deepEqual(read("duas coxinhas 10"), [["Duas coxinhas", "10.00", "Salgados"]]);
  assert.deepEqual(read("x-tudo com 2 carnes 30"), [["X-Tudo com 2 carnes", "30.00", "Lanches"]]);
});

test("a singular word after a price starts a new dish", () => {
  assert.deepEqual(read("coxinha 6 queijo quente 8"), [
    ["Coxinha", "6.00", "Salgados"],
    ["Queijo quente", "8.00", "Lanches"],
  ]);
  assert.deepEqual(read("batata frita 18 porção de calabresa 30"), [
    ["Batata frita", "18.00", "Porções"],
    ["Porção de calabresa", "30.00", "Porções"],
  ]);
});

test("'vinte e cinco e cinco coxinhas': the last five is how many, not five cents", () => {
  assert.deepEqual(read("x-salada vinte e cinco e cinco coxinhas dez"), [
    ["X-Salada", "25.00", "Lanches"],
    ["Cinco coxinhas", "10.00", "Salgados"],
  ]);
});

test("headings put the dishes in the category the owner said, also in the next phrase", () => {
  assert.deepEqual(read("pizzas: calabresa 40, mussarela 38"), [
    ["Calabresa", "40.00", "Pizzas"],
    ["Mussarela", "38.00", "Pizzas"],
  ]);
  assert.deepEqual(read("na parte de lanches tem x-tudo 25 e x-egg 20"), [
    ["X-Tudo", "25.00", "Lanches"],
    ["X-Egg", "20.00", "Lanches"],
  ]);
  const first = parseSpokenMenu("agora as bebidas");
  assert.deepEqual(first.dishes, []);
  assert.equal(first.heading, "Bebidas");
  assert.deepEqual(read("suco de laranja 8", first.heading), [["Suco de laranja", "8.00", "Bebidas"]]);
  // a dish that starts with a category word is still a dish
  assert.deepEqual(read("pizza calabresa 40"), [["Pizza calabresa", "40.00", "Pizzas"]]);
  assert.deepEqual(read("o suco é 8"), [["Suco", "8.00", "Bebidas"]]);
});

test("the words around the dish are dropped", () => {
  assert.deepEqual(read("tenho uma lanchonete e vendo x-tudo a 25"), [["X-Tudo", "25.00", "Lanches"]]);
  assert.deepEqual(read("uma coca seis e um guaraná cinco"), [
    ["Coca", "6.00", "Bebidas"],
    ["Guaraná", "5.00", "Bebidas"],
  ]);
  assert.deepEqual(read("água sem gás 3 água com gás 4"), [
    ["Água sem gás", "3.00", "Bebidas"],
    ["Água com gás", "4.00", "Bebidas"],
  ]);
});

test("'cada' gives the price to every dish of the phrase", () => {
  assert.deepEqual(read("pastel e coxinha a seis cada"), [
    ["Pastel", "6.00", "Salgados"],
    ["Coxinha", "6.00", "Salgados"],
  ]);
});

test("'pronto' at the end closes the menu; in the middle it does not", () => {
  const closed = parseSpokenMenu("Marmita grande 22, marmita pequena 18, só isso");
  assert.equal(closed.finished, true);
  assert.equal(closed.dishes.length, 2);
  assert.equal(parseSpokenMenu("x-tudo 25 pronto").finished, true);
  assert.equal(parseSpokenMenu("x-tudo 25").finished, false);
});

test("talk is not saved as a dish, and a long list without prices is shown as unclear", () => {
  assert.deepEqual(read("eu já tenho um cardápio pronto e gostaria de mandar uma foto"), []);
  assert.deepEqual(read("agora vou falar as bebidas"), []);
  assert.deepEqual(read("bom dia"), []);
  const list = parseSpokenMenu("coxinha pastel empada quibe esfirra enroladinho");
  assert.deepEqual(list.dishes, []);
  assert.deepEqual(list.unclear, ["coxinha pastel empada quibe esfirra enroladinho"]);
});

test("a dish without price, and a price said alone after a pause", () => {
  assert.deepEqual(read("dois x-tudo e uma coca"), [
    ["Dois x-tudo", "", "Lanches"],
    ["Coca", "", "Bebidas"],
  ]);
  const alone = parseSpokenMenu("vinte e cinco reais");
  assert.deepEqual(alone.dishes, []);
  assert.equal(alone.lonePrice, "25.00");
  assert.equal(parseSpokenMenu("seis").lonePrice, "6.00");
});

test("a price that is not a clean number is left empty, never guessed", () => {
  assert.deepEqual(read("x-tudo 25 18:50 x-egg"), [
    ["X-Tudo", "", "Lanches"],
    ["X-Egg", "", "Lanches"],
  ]);
});

test("soundsLikeMenu, removals, names and categories", () => {
  assert.equal(soundsLikeMenu("x-tudo 25"), true);
  assert.equal(soundsLikeMenu("lanchonete"), false);
  assert.equal(soundsLikeMenu("quero mandar a foto do cardápio"), false);
  assert.equal(parseRemoval("tira a coca"), "coca");
  assert.equal(parseRemoval("apaga o x-tudo"), "x tudo");
  assert.equal(parseRemoval("remove pastel do cardápio"), "pastel");
  assert.equal(parseRemoval("coca 6"), null);
  assert.equal(tidyDishName("x tudo"), "X-Tudo");
  assert.equal(tidyDishName("xis-salada"), "X-Salada");
  assert.equal(tidyDishName("suco de laranja."), "Suco de laranja");
  assert.equal(guessCategory("Heineken"), "Bebidas");
  assert.equal(guessCategory("Baião de dois"), "Pratos");
  assert.equal(guessCategory("Hot dog"), "Lanches");
  assert.equal(guessCategory("Bolo de pote"), "Sobremesas");
});

/* ------------------------------------------------------------- the road */

test("the speaking road: dishes pile up, a repeated dish gets the new price, a lone price fills the last one", () => {
  let state = startSpeak();
  assert.equal(state.step, "speak");
  assert.equal(promptFor(state), SPEAK_QUESTION);
  assert.equal(progressText(state), "Passo 1 de 3 · Fale os pratos");

  let result = addSpokenMenu(state, parseSpokenMenu("x-tudo 25, x-salada 22 e de bebida coca lata 6"));
  state = result.state;
  assert.equal(selectedItems(state).length, 3);
  assert.deepEqual(state.categories.map((c) => c.name), ["Lanches", "Bebidas"]);
  assert.equal(spokenFeedback(result), "Anotei 3 pratos.");
  assert.equal(promptFor(state), SPEAK_MORE);
  assert.equal(progressText(state), "Passo 1 de 3 · Fale os pratos · 3 anotados");

  result = addSpokenMenu(state, parseSpokenMenu("não, o x-tudo é 26"));
  state = result.state;
  assert.deepEqual(result.priced, [{ name: "X-Tudo", price: "26.00" }]);
  assert.equal(spokenFeedback(result), "X-Tudo, 26 reais.");
  assert.equal(selectedItems(state).length, 3);

  result = addSpokenMenu(state, parseSpokenMenu("pastel"));
  state = result.state;
  assert.equal(spokenFeedback(result), "Anotei Pastel. Quanto custa?");
  result = addSpokenMenu(state, parseSpokenMenu("sete e cinquenta"));
  state = result.state;
  assert.deepEqual(result.priced, [{ name: "Pastel", price: "7.50" }]);
  assert.equal(spokenFeedback(result), "Pastel, 7 reais e 50 centavos.");
});

test("removing by voice, and finishing asks only the prices that were not said", () => {
  let state = addSpokenMenu(startSpeak(), parseSpokenMenu("x-tudo 25 coca lata 6 e coxinha")).state;
  const removed = removeSpoken(state, "coca");
  assert.equal(removed.removed, "Coca lata");
  state = removed.state;
  assert.equal(removeSpoken(state, "pizza").removed, "");

  state = finishSpeak(state);
  assert.equal(state.step, "prices");
  assert.equal(currentPriceItem(state).name, "Coxinha");
  assert.equal(promptFor(state, true), "Faltou o preço de alguns. Coxinha. Quanto custa?");

  // "voltar" before the first missing price returns to the list that was said
  assert.equal(backOnePrice(state).step, "speak");

  state = setCurrentPrice(state, "6");
  assert.equal(state.step, "review");
  assert.deepEqual(importPayload(state), {
    categories: [
      { name: "Lanches", items: [{ name: "X-Tudo", price: "25.00" }] },
      { name: "Salgados", items: [{ name: "Coxinha", price: "6.00" }] },
    ],
  });
  assert.equal(backOnePrice(state).step, "speak");
});

test("finishing with nothing said stays on the speaking screen; skipping the last price returns there", () => {
  assert.equal(finishSpeak(startSpeak()).step, "speak");
  let state = finishSpeak(addSpokenMenu(startSpeak(), parseSpokenMenu("coxinha")).state);
  assert.equal(state.step, "prices");
  state = skipCurrentPrice(state);
  assert.equal(state.step, "speak");
});
