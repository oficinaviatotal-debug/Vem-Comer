import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PER_ITEM,
  addConfigured,
  addToCart,
  cartCount,
  cartTotalCents,
  decrementItem,
  incrementLine,
  lineKey,
  lineTotalCents,
  makeKey,
  quantityOf,
  removeLine,
  replaceLine,
  setLineNote,
  toOrderItems,
} from "../../frontend/src/customer/cart.ts";

const pizza = { id: "pz", name: "Pizza", price: "40.00" };
const suco = { id: "su", name: "Suco", price: 8 };
const grande = { id: "s-g", group: "Tamanho", name: "Grande", deltaCents: 850 };
const pequena = { id: "s-p", group: "Tamanho", name: "Pequena", deltaCents: 0 };
const bacon = { id: "e-bacon", group: "Adicionais", name: "Bacon", deltaCents: 400 };

test("a plain dish keeps the product id as its key", () => {
  assert.equal(makeKey("pz", [], undefined), "pz");
  assert.equal(makeKey("pz", [], "   "), "pz");
  const cart = addToCart([], suco);
  assert.equal(lineKey(cart[0]), "su");
  assert.equal("key" in cart[0], false);
});

test("options and a note make a different line from the plain dish", () => {
  assert.notEqual(makeKey("pz", ["s-g"], ""), "pz");
  assert.notEqual(makeKey("pz", [], "sem cebola"), "pz");
  assert.notEqual(makeKey("pz", ["s-g"], ""), makeKey("pz", ["s-p"], ""));
});

test("the key does not depend on the order of the options or on how the note is typed", () => {
  assert.equal(makeKey("pz", ["a", "b"], "Sem  Cebola"), makeKey("pz", ["b", "a"], " sem cebola "));
});

test("the price of a line is the base plus the options, in exact cents", () => {
  const cart = addConfigured([], pizza, { options: [grande, bacon], quantity: 2 });
  assert.equal(cart.length, 1);
  assert.equal(cart[0].price, 52.5);
  assert.equal(lineTotalCents(cart[0]), 10500);
  assert.equal(cartTotalCents(cart), 10500);
  assert.equal(cart[0].quantity, 2);
});

test("the same dish with different choices stays on separate lines", () => {
  let cart = addConfigured([], pizza, { options: [grande] });
  cart = addConfigured(cart, pizza, { options: [pequena] });
  cart = addConfigured(cart, pizza, { options: [grande], note: "sem cebola" });
  assert.equal(cart.length, 3);
  assert.equal(quantityOf(cart, "pz"), 3);
  assert.equal(cartCount(cart), 3);
});

test("the same choices add up on the same line", () => {
  let cart = addConfigured([], pizza, { options: [grande, bacon] });
  cart = addConfigured(cart, pizza, { options: [bacon, grande] });
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);
});

test("a line never goes above the limit the server accepts", () => {
  let cart = addConfigured([], pizza, { options: [grande], quantity: MAX_PER_ITEM - 1 });
  cart = addConfigured(cart, pizza, { options: [grande], quantity: 10 });
  assert.equal(cart[0].quantity, MAX_PER_ITEM);
  assert.equal(addConfigured([], pizza, { quantity: 999 })[0].quantity, MAX_PER_ITEM);
  assert.equal(addConfigured([], pizza, { quantity: 0 })[0].quantity, 1);
});

test("the order goes to the server with the option ids and the note, and no prices", () => {
  let cart = addConfigured([], pizza, { options: [grande, bacon], note: "bem passada", quantity: 2 });
  cart = addToCart(cart, suco);
  assert.deepEqual(toOrderItems(cart), [
    { id: "pz", quantity: 2, options: ["s-g", "e-bacon"], note: "bem passada" },
    { id: "su", quantity: 1 },
  ]);
  const text = JSON.stringify(toOrderItems(cart));
  assert.equal(text.includes("price"), false);
  assert.equal(text.includes("850"), false);
});

test("a plain dish still goes as just id and quantity", () => {
  assert.deepEqual(toOrderItems(addToCart([], suco)), [{ id: "su", quantity: 1 }]);
});

test("more and less work on one line, by its key", () => {
  let cart = addConfigured([], pizza, { options: [grande] });
  cart = addConfigured(cart, pizza, { options: [pequena] });
  const key = lineKey(cart[0]);
  cart = incrementLine(cart, key);
  assert.deepEqual(cart.map((line) => line.quantity), [2, 1]);
  cart = decrementItem(cart, key);
  cart = decrementItem(cart, key);
  assert.deepEqual(cart.map((line) => line.options[0].name), ["Pequena"]);
});

test("the menu's minus, which knows only the dish, takes one from the last line of that dish", () => {
  let cart = addToCart([], pizza);
  cart = setLineNote(cart, "pz", "sem cebola"); // the plain line now has a note, so another key
  assert.equal(cart.length, 1);
  assert.notEqual(lineKey(cart[0]), "pz");
  cart = decrementItem(cart, "pz");
  assert.deepEqual(cart, []);
});

test("removing a line only removes that line", () => {
  let cart = addConfigured([], pizza, { options: [grande] });
  cart = addConfigured(cart, pizza, { options: [pequena] });
  cart = removeLine(cart, lineKey(cart[0]));
  assert.equal(cart.length, 1);
  assert.equal(cart[0].options[0].name, "Pequena");
});

test("writing a note changes the line, and clearing it brings the plain dish back", () => {
  let cart = addToCart([], suco);
  cart = setLineNote(cart, "su", "  sem   gelo ");
  assert.equal(cart[0].note, "sem gelo");
  assert.equal(toOrderItems(cart)[0].note, "sem gelo");
  cart = setLineNote(cart, lineKey(cart[0]), "");
  assert.equal("note" in cart[0], false);
  assert.equal("key" in cart[0], false);
  assert.equal(lineKey(cart[0]), "su");
});

test("a note that makes two lines identical joins them", () => {
  let cart = addToCart([], suco);
  cart = addToCart(setLineNote(addToCart([], suco), "su", "sem gelo"), suco); // [su#sem gelo x1, su x1]
  assert.equal(cart.length, 2);
  const plainKey = "su";
  cart = setLineNote(cart, plainKey, "sem gelo");
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);
});

test("changing a line keeps its place in the order", () => {
  let cart = addConfigured([], pizza, { options: [grande] });
  cart = addToCart(cart, suco);
  cart = replaceLine(cart, lineKey(cart[0]), pizza, { options: [pequena, bacon], quantity: 3 });
  assert.deepEqual(cart.map((line) => line.id), ["pz", "su"]);
  assert.equal(cart[0].quantity, 3);
  assert.equal(cart[0].price, 44);
  assert.deepEqual(cart[0].options.map((option) => option.name), ["Pequena", "Bacon"]);
});

test("changing a line into one that already exists joins them", () => {
  let cart = addConfigured([], pizza, { options: [grande] });
  cart = addConfigured(cart, pizza, { options: [pequena] });
  cart = replaceLine(cart, lineKey(cart[0]), pizza, { options: [pequena], quantity: 2 });
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);
});

test("changing a line that is gone changes nothing", () => {
  const cart = addToCart([], suco);
  assert.equal(replaceLine(cart, "nao-existe", suco, { quantity: 2 }), cart);
});
