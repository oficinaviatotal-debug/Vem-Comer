import test from "node:test";
import assert from "node:assert/strict";

import {
  BUILDING_TEXT,
  SEARCH_FROM,
  dishAction,
  factsOf,
  notFoundText,
  shopViewOf,
} from "../../frontend/src/loja/shopLogic.ts";
import { CLOSED_NOTICE } from "../../frontend/src/customer/labels.ts";
import { PAUSED_NOTICE } from "../../frontend/src/customer/openness.ts";

const media = (path) => (path ? `https://img.example${path}` : "");
const OPEN = { configured: true, open_now: true, message: "Aberto até 23h.", paused: false };
const company = (extra = {}) => ({ name: "Açaí do João", logo_thumb_url: null, accepting_orders: true, hours: undefined, ...extra });
const menus = [
  { id: "m-acai", name: "Açaí" },
  { id: "m-bebidas", name: "Bebidas" },
];
const sizes = [
  {
    id: "g1",
    name: "Tamanho",
    min_choices: 1,
    max_choices: 1,
    items: [
      { id: "o1", name: "300 ml", price_delta: 0 },
      { id: "o2", name: "500 ml", price_delta: "5.00" },
    ],
  },
];
const product = (id, menu_id, name, price, extra = {}) => ({ id, menu_id, name, price, ...extra });
const products = [
  product("p1", "m-acai", "Açaí 300 ml", 14),
  product("p2", "m-acai", "Açaí 500 ml", "19.90", { description: "  Com granola  " }),
  product("p3", "m-bebidas", "Suco de caju", 7, { thumb_url: "/media/c/d.webp" }),
  product("p4", "m-bebidas", "Água", 3),
];
const view = (extra = {}) =>
  shopViewOf({
    company: company(),
    fromTable: false,
    tableNumber: null,
    products,
    menus,
    cart: [],
    query: "",
    media,
    ...extra,
  });
const dishes = (v) => v.groups.flatMap((g) => g.sections.flatMap((s) => s.dishes));
const dish = (v, id) => dishes(v).find((d) => d.id === id);

test("as categorias saem na ordem do restaurante e os pratos dentro delas", () => {
  const v = view();
  assert.deepEqual(v.groups.map((g) => g.title), ["Açaí", "Bebidas"]);
  assert.deepEqual(v.groups[0].sections[0].dishes.map((d) => d.name), ["Açaí 300 ml", "Açaí 500 ml"]);
});

test("prato sem categoria vai por último em Outros; categoria vazia some", () => {
  const v = view({ products: [...products, product("p9", null, "Brinde", 1)], menus: [...menus, { id: "m-vazia", name: "Vazia" }] });
  assert.deepEqual(v.groups.map((g) => g.title), ["Açaí", "Bebidas", "Outros"]);
});

test("o prato leva nome, descrição limpa, preço em reais e foto só quando há foto", () => {
  const v = view();
  assert.equal(dish(v, "p2").price, 19.9);
  assert.equal(dish(v, "p2").description, "Com granola");
  assert.equal(dish(v, "p1").description, undefined);
  assert.equal(dish(v, "p3").photo, "https://img.example/media/c/d.webp");
  assert.equal(dish(v, "p4").photo, undefined, "sem foto, sem endereço inventado");
});

test("tamanho e extras: 'a partir de' só quando as escolhas mudam o preço", () => {
  const withSizes = product("s1", "m-acai", "Açaí no copo", 14, { option_groups: sizes });
  const v = view({ products: [withSizes] });
  assert.equal(dish(v, "s1").priceFrom, true);
  assert.equal(dish(v, "s1").price, 14);
  assert.equal(dish(v, "s1").action, "choose");

  const free = [{ ...sizes[0], items: sizes[0].items.map((item) => ({ ...item, price_delta: 0 })) }];
  const flat = view({ products: [product("s2", "m-acai", "Água", 3, { option_groups: free })] });
  assert.equal(dish(flat, "s2").priceFrom, undefined);
  assert.equal(dish(flat, "s2").action, "choose");

  const dear = [{ ...sizes[0], items: [{ id: "x", name: "Grande", price_delta: 4 }] }];
  const forced = view({ products: [product("s3", "m-acai", "Pizza", 30, { option_groups: dear })] });
  assert.equal(dish(forced, "s3").price, 34, "o grupo obrigatório já entra no preço mínimo");
  assert.equal(dish(forced, "s3").priceFrom, true);
});

test("o que o toque faz: fechado, esgotado, escolhas, simples, nessa ordem", () => {
  const plain = product("a", "m", "A", 1);
  const out = product("b", "m", "B", 1, { sold_out: true });
  const opts = product("c", "m", "C", 1, { option_groups: sizes });
  const none = product("d", "m", "D", 1, { option_groups: [{ id: "g", name: "G", min_choices: 1, max_choices: 1, items: [] }] });
  assert.deepEqual(dishAction(plain, false), { action: "add" });
  assert.deepEqual(dishAction(out, false), { action: "none", stateText: "Esgotado" });
  assert.deepEqual(dishAction(opts, false), { action: "choose" });
  assert.deepEqual(dishAction(none, false), { action: "none", stateText: "Indisponível agora" });
  for (const item of [plain, out, opts, none]) {
    assert.deepEqual(dishAction(item, true), { action: "none", stateText: "Sem pedidos agora" }, "fechado vence tudo");
  }
});

test("quantidade do prato soma todas as linhas dele na sacola", () => {
  const cart = [
    { id: "p1", name: "Açaí 300 ml", price: 14, quantity: 2 },
    { id: "p1", key: "p1#o1#sem granola", name: "Açaí 300 ml", price: 14, quantity: 1, note: "sem granola" },
    { id: "p3", name: "Suco de caju", price: 7, quantity: 1 },
  ];
  const v = view({ cart });
  assert.equal(dish(v, "p1").quantity, 3);
  assert.equal(dish(v, "p3").quantity, 1);
  assert.equal(dish(v, "p2").quantity, 0);
});

test("a sacola soma em centavos exatos", () => {
  const cart = [{ id: "p2", name: "Açaí 500 ml", price: 19.9, quantity: 3 }];
  assert.deepEqual(view({ cart }).cart, { items: 3, total: 59.7 });
  assert.deepEqual(view().cart, { items: 0, total: 0 });
});

test("restaurante em pausa, sem receber pedido ou fora do horário: aviso do servidor e nada se vende", () => {
  const paused = view({ company: company({ hours: { ...OPEN, paused: true } }) });
  assert.equal(paused.closed, true);
  assert.deepEqual(paused.notices, [PAUSED_NOTICE]);
  assert.ok(dishes(paused).every((d) => d.action === "none"));

  const off = view({ company: company({ accepting_orders: false }) });
  assert.deepEqual(off.notices, [CLOSED_NOTICE]);
  assert.equal(off.closed, true);

  const later = view({ company: company({ hours: { configured: true, open_now: false, message: "Fechado agora. Abre hoje às 18h.", paused: false } }) });
  assert.equal(later.closed, true);
  assert.match(later.notices[0], /^Fechado agora\. Abre hoje às 18h\. Você pode ver o cardápio e pedir quando abrir\.$/);

  const seated = view({ company: company({ hours: { configured: true, open_now: false, message: "Fechado agora.", paused: false } }), fromTable: true });
  assert.equal(seated.closed, false, "quem está sentado na mesa nunca vê o restaurante fechado pelo horário");
  assert.deepEqual(seated.notices, []);
});

test("sem horário cadastrado ou de servidor antigo, o restaurante está sempre aberto", () => {
  assert.equal(view().closed, false);
  assert.deepEqual(view().notices, []);
  assert.equal(view({ company: company({ hours: { configured: false, open_now: true, message: "", paused: false } }) }).closed, false);
});

test("a pílula de horário: verde aberto, vermelha fechado, sem ponto final, e some em pausa ou sem horário", () => {
  assert.deepEqual(factsOf({ hours: OPEN }), [{ text: "Aberto até 23h", tone: "open" }]);
  assert.deepEqual(factsOf({ hours: { ...OPEN, open_now: false, message: "Fechado no momento." } }), [{ text: "Fechado no momento", tone: "closed" }]);
  assert.deepEqual(factsOf({ hours: { ...OPEN, paused: true } }), []);
  assert.deepEqual(factsOf({ hours: { configured: false, open_now: true, message: "", paused: false } }), []);
  assert.deepEqual(factsOf({ hours: { ...OPEN, message: "   " } }), []);
  assert.deepEqual(factsOf({}), []);
});

test("o topo: nome, logomarca de verdade e a mesa", () => {
  const plain = view();
  assert.deepEqual(plain.shop, { name: "Açaí do João", logo: undefined, sub: undefined });
  const withLogo = view({ company: company({ logo_thumb_url: "/media/c/logo-thumb.webp" }), tableNumber: 4 });
  assert.equal(withLogo.shop.logo, "https://img.example/media/c/logo-thumb.webp");
  assert.equal(withLogo.shop.sub, "Mesa 4");
  assert.equal(view({ tableNumber: 0 }).shop.sub, undefined);
});

test("a busca só aparece em cardápio comprido e acha sem acento nem maiúscula", () => {
  assert.equal(view().showSearch, false);
  const long = Array.from({ length: SEARCH_FROM }, (_, i) => product(`x${i}`, "m-acai", `Prato ${i}`, 5));
  assert.equal(view({ products: long }).showSearch, true);
  assert.equal(view({ products: long.slice(0, SEARCH_FROM - 1) }).showSearch, false);

  const found = view({ query: "ACAI" });
  assert.deepEqual(dishes(found).map((d) => d.id), ["p1", "p2"]);
  assert.equal(found.emptyText, "");
});

test("sem achar nada a tela diz o que buscou; sem pratos ainda, diz que está sendo montado", () => {
  const none = view({ query: "  pizza " });
  assert.equal(none.groups.length, 0);
  assert.equal(none.emptyText, notFoundText("pizza"));
  assert.equal(none.emptyText, "Nada encontrado para “pizza”. Tente outra palavra.");
  const empty = view({ products: [] });
  assert.equal(empty.emptyText, BUILDING_TEXT);
});

test("os azulejos de categoria: só com mais de uma, sem busca, com a foto do primeiro prato que tem foto", () => {
  const v = view();
  assert.deepEqual(v.categories, [
    { id: "m-acai", label: "Açaí", photo: undefined },
    { id: "m-bebidas", label: "Bebidas", photo: "https://img.example/media/c/d.webp" },
  ]);
  assert.deepEqual(view({ query: "suco" }).categories, [], "buscando, os azulejos saem");
  assert.deepEqual(view({ products: products.slice(0, 2) }).categories, [], "uma categoria só não precisa de azulejo");
});

test("os avisos da tela entram depois do aviso do servidor", () => {
  const v = view({ company: company({ accepting_orders: false }), extraNotices: ["Pizza acabou e saiu do seu pedido."] });
  assert.deepEqual(v.notices, [CLOSED_NOTICE, "Pizza acabou e saiu do seu pedido."]);
});

test("montar a tela não mexe nas listas que recebe", () => {
  const input = { products: products.map((p) => ({ ...p })), menus: menus.map((m) => ({ ...m })), cart: [{ id: "p1", name: "A", price: 1, quantity: 1 }] };
  const before = JSON.stringify(input);
  shopViewOf({ company: company(), fromTable: false, tableNumber: null, ...input, query: "a", media });
  assert.equal(JSON.stringify(input), before);
});

test("nada do que o servidor não tem aparece: sem promoção, sem cidade, sem taxa, sem mais pedidos", () => {
  const v = view();
  assert.ok(!("promo" in v));
  const text = JSON.stringify(v);
  assert.ok(!/promo|taxa|cidade|mais pedidos/i.test(text));
});
