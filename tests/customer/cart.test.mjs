import test from "node:test";
import assert from "node:assert/strict";

import {
  addToCart,
  cartCount,
  cartTotalCents,
  cashProblem,
  decrementItem,
  MAX_PER_ITEM,
  parseMoneyInput,
  quantityOf,
  removeLine,
  toCents,
  toOrderItems,
} from "../../frontend/src/customer/cart.ts";

const sushi = { id: "a", name: "Combinado 20 peças", price: "89.90" };
const suco = { id: "b", name: "Suco de laranja", price: 12 };

test("adding the same dish twice makes one line with quantity 2", () => {
  let cart = addToCart([], sushi);
  cart = addToCart(cart, sushi);
  assert.equal(cart.length, 1);
  assert.equal(quantityOf(cart, "a"), 2);
  assert.equal(cart[0].price, 89.9);
});

test("the cart never goes above the per-dish limit the server accepts", () => {
  let cart = [];
  for (let i = 0; i < MAX_PER_ITEM + 10; i += 1) cart = addToCart(cart, suco);
  assert.equal(quantityOf(cart, "b"), MAX_PER_ITEM);
  assert.ok(MAX_PER_ITEM <= 100);
});

test("taking one away removes the line when it reaches zero", () => {
  let cart = addToCart(addToCart([], sushi), suco);
  cart = decrementItem(cart, "a");
  assert.deepEqual(cart.map((line) => line.id), ["b"]);
  assert.equal(quantityOf(cart, "a"), 0);
  assert.deepEqual(removeLine(cart, "b"), []);
});

test("totals are exact in cents (no floating point drift)", () => {
  const cheap = { id: "c", name: "Pastel", price: 19.9 };
  let cart = [];
  for (let i = 0; i < 3; i += 1) cart = addToCart(cart, cheap);
  assert.equal(cartTotalCents(cart), 5970);
  assert.equal(cartCount(cart), 3);

  const odd = { id: "d", name: "Doce", price: 0.1 };
  let sweet = [];
  for (let i = 0; i < 3; i += 1) sweet = addToCart(sweet, odd);
  assert.equal(cartTotalCents(sweet), 30);
});

test("bad prices count as zero instead of breaking the total", () => {
  assert.equal(toCents("abc"), 0);
  assert.equal(toCents(null), 0);
  assert.equal(toCents("12.345"), 1235);
});

test("the order payload sends ids and quantities only, never prices", () => {
  const cart = addToCart(addToCart([], sushi), sushi);
  assert.deepEqual(toOrderItems(cart), [{ id: "a", quantity: 2 }]);
});

test("money typed by hand: Brazilian and plain formats are understood", () => {
  assert.equal(parseMoneyInput("50"), 5000);
  assert.equal(parseMoneyInput("50,00"), 5000);
  assert.equal(parseMoneyInput("R$ 50,5"), 5050);
  assert.equal(parseMoneyInput("1.250,00"), 125000);
  assert.equal(parseMoneyInput("50.5"), 5050);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("cinquenta"), null);
  assert.equal(parseMoneyInput("0"), null);
  assert.equal(parseMoneyInput("-5"), null);
  assert.equal(parseMoneyInput("10,999"), null);
});

test("cash must cover the total, exactly like the server checks", () => {
  assert.equal(cashProblem(5970, "60"), null);
  assert.equal(cashProblem(5970, "59,70"), null);
  assert.match(cashProblem(5970, "50"), /igual ou maior/);
  assert.match(cashProblem(5970, ""), /Digite/);
});
