import test from "node:test";
import assert from "node:assert/strict";

import { groupProducts, matchesSearch, OTHER_KEY } from "../../frontend/src/customer/menuGroups.ts";

const menus = [
  { id: "m1", name: "Combinados" },
  { id: "m2", name: "Bebidas" },
];

const products = [
  { id: "1", menu_id: "m2", name: "Suco de laranja", description: "Natural" },
  { id: "2", menu_id: "m1", name: "Combinado 20 peças", description: "Variado" },
  { id: "3", menu_id: null, name: "Pudim", description: "" },
  { id: "4", menu_id: "inativa", name: "Prato escondido", description: "" },
  { id: "5", menu_id: "m1", name: "Temaki salmão", description: "Com cream cheese" },
];

test("sections follow the order the restaurant created the categories", () => {
  const groups = groupProducts(products, menus);
  assert.deepEqual(groups.map((group) => group.title), ["Combinados", "Bebidas", "Outros"]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["2", "5"]);
});

test("dishes without a category are not lost; dishes of a turned-off category stay hidden", () => {
  const groups = groupProducts(products, menus);
  const ids = groups.flatMap((group) => group.items.map((item) => item.id));
  assert.ok(ids.includes("3"));
  assert.equal(ids.includes("4"), false);
  assert.equal(groups.at(-1).key, OTHER_KEY);
});

test("a restaurant with no categories gets a single section called Cardápio", () => {
  const groups = groupProducts(products.filter((item) => item.menu_id === null), []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, "Cardápio");
});

test("search ignores accents and case, and looks in the description too", () => {
  assert.equal(matchesSearch(products[4], "SALMAO"), true);
  assert.equal(matchesSearch(products[4], "cream"), true);
  assert.equal(matchesSearch(products[4], "pizza"), false);
  assert.equal(matchesSearch(products[4], "   "), true);
});

test("searching removes sections that end up empty", () => {
  const groups = groupProducts(products, menus, "suco");
  assert.deepEqual(groups.map((group) => group.title), ["Bebidas"]);
  assert.deepEqual(groupProducts(products, menus, "xyz"), []);
});
