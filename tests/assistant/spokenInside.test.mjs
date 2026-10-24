import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenMenu, joinIngredients, MAX_DESCRIPTION_CHARS } from "../../frontend/src/assistant/spokenMenu.ts";
import { addSpokenMenu, importPayload, selectedItems, startSpeak } from "../../frontend/src/assistant/assistantFlow.ts";

/** [name, price, description] of every dish. */
const read = (text, heading) =>
  parseSpokenMenu(text, heading).dishes.map((dish) => [dish.name, dish.price, dish.description]);

test("o dono fala uma ordem inteira: cadastre um prato, o preço e o que vai dentro", () => {
  const sentence = "eu quero que você cadastre um X-Tudo, no X-Tudo custa R$25, vai ter ovo, bacon, hambúrguer, salame, e etc.";
  const menu = parseSpokenMenu(sentence);
  assert.deepEqual(menu.dishes, [
    { name: "X-Tudo", price: "25.00", category: "Lanches", categorySaid: false, description: "Ovo, bacon, hambúrguer, salame" },
  ]);
  assert.deepEqual(menu.unclear, []);
  assert.equal(menu.loneDescription, "");

  // o celular quase nunca põe vírgula: a mesma frase corrida dá o mesmo prato
  assert.deepEqual(
    read("eu quero que você cadastre um x-tudo no x-tudo custa 25 reais vai ter ovo bacon hambúrguer salame e etc"),
    [["X-Tudo", "25.00", "Ovo, bacon, hambúrguer, salame"]]
  );
  assert.deepEqual(
    read("cadastre um x tudo custa vinte e cinco reais vai ter ovo bacon hamburguer salame"),
    [["X-Tudo", "25.00", "Ovo, bacon, hamburguer, salame"]]
  );
});

test("as palavras da ordem não ficam no nome do prato", () => {
  assert.deepEqual(read("cadastre um x-tudo que custa 25"), [["X-Tudo", "25.00", ""]]);
  assert.deepEqual(read("registre o x-salada 22"), [["X-Salada", "22.00", ""]]);
  assert.deepEqual(read("gostaria de cadastrar um x-bacon por 28"), [["X-Bacon", "28.00", ""]]);
  assert.deepEqual(read("por favor adicione a coxinha 6"), [["Coxinha", "6.00", ""]]);
  // o mesmo nome dito duas vezes em volta de uma pausa é um prato só
  assert.deepEqual(read("um x-tudo, o x-tudo custa 25"), [["X-Tudo", "25.00", ""]]);
});

test("o que vai dentro pode vir depois do preço ou antes dele", () => {
  assert.deepEqual(read("x-tudo 25, tem ovo bacon hamburguer e salame"), [["X-Tudo", "25.00", "Ovo, bacon, hamburguer, salame"]]);
  assert.deepEqual(read("x-tudo tem ovo e bacon custa 25"), [["X-Tudo", "25.00", "Ovo, bacon"]]);
  assert.deepEqual(read("x-salada leva alface, tomate e queijo por 22"), [["X-Salada", "22.00", "Alface, tomate, queijo"]]);
  assert.deepEqual(read("x-tudo 25 com ovo e bacon"), [["X-Tudo", "25.00", "Ovo, bacon"]]);
  assert.deepEqual(read("hot dog 12 vai ter salsicha, purê, milho e batata palha"), [["Hot dog", "12.00", "Salsicha, purê, milho, batata palha"]]);
});

test("vários pratos na mesma fala: cada lista fica com o seu prato", () => {
  assert.deepEqual(
    read("x-tudo 25 vai ter ovo, bacon, x-salada 22 leva alface e tomate"),
    [
      ["X-Tudo", "25.00", "Ovo, bacon"],
      ["X-Salada", "22.00", "Alface, tomate"],
    ]
  );
  assert.deepEqual(
    read("x-tudo tem ovo e bacon 25 x-salada tem alface e tomate 22"),
    [
      ["X-Tudo", "25.00", "Ovo, bacon"],
      ["X-Salada", "22.00", "Alface, tomate"],
    ]
  );
  // ponto final fecha a lista
  assert.deepEqual(
    read("x-tudo 25 leva ovo e bacon. x-salada 22 leva alface"),
    [
      ["X-Tudo", "25.00", "Ovo, bacon"],
      ["X-Salada", "22.00", "Alface"],
    ]
  );
});

test("quantidades dentro da lista não viram preço", () => {
  assert.deepEqual(read("x-tudo custa 25 vai ter 2 ovos, 2 hambúrgueres, queijo e presunto"), [
    ["X-Tudo", "25.00", "2 ovos, 2 hambúrgueres, queijo, presunto"],
  ]);
  assert.deepEqual(read("x-egg 20 leva 200 g de carne e ovo"), [["X-Egg", "20.00", "200 g de carne, ovo"]]);
});

test("de, com e dois nomes seguidos ficam juntos quando o celular não pôs vírgula", () => {
  assert.deepEqual(read("x-tudo 25 vai ter pão de forma ovo 2 fatias de queijo bacon"), [
    ["X-Tudo", "25.00", "Pão de forma, ovo, 2 fatias de queijo, bacon"],
  ]);
  assert.deepEqual(read("x-tudo 25 vai ter queijo coalho"), [["X-Tudo", "25.00", "Queijo coalho"]]);
});

test("'com' continua no nome do prato quando não vem depois do preço", () => {
  assert.deepEqual(read("pizza com catupiry 40"), [["Pizza com catupiry", "40.00", ""]]);
  assert.deepEqual(read("água com gás 4"), [["Água com gás", "4.00", ""]]);
  assert.deepEqual(read("x-tudo com 2 carnes 30"), [["X-Tudo com 2 carnes", "30.00", ""]]);
});

test("'tem' que abre uma lista de pratos não vira ingrediente", () => {
  assert.deepEqual(read("tem coca 6"), [["Coca", "6.00", ""]]);
  assert.deepEqual(read("tenho x-tudo 25 e tem coca 6"), [
    ["X-Tudo", "25.00", ""],
    ["Coca", "6.00", ""],
  ]);
  assert.deepEqual(read("na parte de lanches tem x-tudo 25 e x-egg 20"), [
    ["X-Tudo", "25.00", ""],
    ["X-Egg", "20.00", ""],
  ]);
  assert.deepEqual(read("vai ter coca 6 e guaraná 5"), [
    ["Coca", "6.00", ""],
    ["Guaraná", "5.00", ""],
  ]);
});

test("lista sem como saber onde acaba: nada é cortado e nenhum preço some", () => {
  const menu = parseSpokenMenu("x-tudo 25 leva ovo e bacon x-salada 22");
  assert.deepEqual(menu.dishes.map((dish) => [dish.name, dish.price, dish.description]), [["X-Tudo", "25.00", ""]]);
  assert.deepEqual(menu.unclear, ["leva ovo e bacon x-salada"]);
});

test("o que vai dentro dito sozinho, depois de uma pausa, fica para o último prato", () => {
  const menu = parseSpokenMenu("vai ter ovo e bacon");
  assert.deepEqual(menu.dishes, []);
  assert.equal(menu.loneDescription, "Ovo, bacon");

  // custa 25 vai ter ovo: o preço e a lista, sem o nome
  const both = parseSpokenMenu("custa 25 vai ter ovo e bacon");
  assert.equal(both.lonePrice, "25.00");
  assert.equal(both.loneDescription, "Ovo, bacon");

  let state = startSpeak();
  state = addSpokenMenu(state, parseSpokenMenu("cadastre um x-tudo")).state;
  const result = addSpokenMenu(state, both);
  assert.deepEqual(result.priced, [{ name: "X-Tudo", price: "25.00" }]);
  assert.deepEqual(result.described, [{ name: "X-Tudo", description: "Ovo, bacon" }]);
  assert.deepEqual(importPayload(result.state), {
    categories: [{ name: "Lanches", items: [{ name: "X-Tudo", price: "25.00", description: "Ovo, bacon" }] }],
  });
});

test("o fim da fala ('pronto') continua valendo com a lista", () => {
  const menu = parseSpokenMenu("x-tudo 25 vai ter ovo e bacon pronto");
  assert.equal(menu.finished, true);
  assert.deepEqual(menu.dishes.map((dish) => [dish.name, dish.price, dish.description]), [["X-Tudo", "25.00", "Ovo, bacon"]]);
});

test("a lista segue com o prato para o servidor; dita de novo, troca; sem lista, não apaga", () => {
  let state = startSpeak();
  let result = addSpokenMenu(state, parseSpokenMenu("x-tudo 25 vai ter ovo e bacon"));
  assert.deepEqual(result.described, [{ name: "X-Tudo", description: "Ovo, bacon" }]);
  assert.deepEqual(selectedItems(result.state).map((item) => item.name), ["X-Tudo"]);

  // só o preço é corrigido: a lista fica
  result = addSpokenMenu(result.state, parseSpokenMenu("o x-tudo 26"));
  assert.deepEqual(result.described, []);
  assert.deepEqual(importPayload(result.state).categories[0].items, [{ name: "X-Tudo", price: "26.00", description: "Ovo, bacon" }]);

  // a lista nova troca a antiga
  result = addSpokenMenu(result.state, parseSpokenMenu("x-tudo 26 leva ovo, bacon e salame"));
  assert.deepEqual(importPayload(result.state).categories[0].items, [{ name: "X-Tudo", price: "26.00", description: "Ovo, bacon, salame" }]);
});

test("a lista é arrumada: sem repetir, sem passar do tamanho do cardápio", () => {
  assert.equal(joinIngredients(["Ovo", "ovo", " bacon ", "", "X-Bacon"]), "Ovo, bacon, X-Bacon");
  assert.equal(joinIngredients([]), "");
  const many = Array.from({ length: 80 }, (_, i) => `ingrediente${i}`);
  const text = joinIngredients(many);
  assert.ok(text.length <= MAX_DESCRIPTION_CHARS);
  assert.ok(!text.endsWith(","));
});

test("escrito em linhas (ou com ponto e vírgula): cada linha é um prato, e depois do único preço da linha vem o que vai dentro", () => {
  assert.deepEqual(read("x-tudo 25 ovo, bacon, salame\nx-salada 22 alface e tomate\ncoca 6"), [
    ["X-Tudo", "25.00", "Ovo, bacon, salame"],
    ["X-Salada", "22.00", "Alface, tomate"],
    ["Coca", "6.00", ""],
  ]);
  assert.deepEqual(read("x-tudo 25 com ovo e bacon; coca 6"), [
    ["X-Tudo", "25.00", "Ovo, bacon"],
    ["Coca", "6.00", ""],
  ]);
  // o título dito numa linha vale para as seguintes
  const menu = parseSpokenMenu("de bebida\ncoca 6\nguaraná 5");
  assert.deepEqual(menu.dishes.map((dish) => [dish.name, dish.category]), [
    ["Coca", "Bebidas"],
    ["Guaraná", "Bebidas"],
  ]);
});

test("linha com mais de um preço, ou sem nada depois do preço, é lida como sempre", () => {
  assert.deepEqual(read("coca 6 guaraná 5\npastel 8"), [
    ["Coca", "6.00", ""],
    ["Guaraná", "5.00", ""],
    ["Pastel", "8.00", ""],
  ]);
  // "duas coxinhas 10": a quantidade antes do prato fica no nome e não vira preço nem lista
  assert.deepEqual(read("duas coxinhas 10\ncoca 6"), [
    ["Duas coxinhas", "10.00", ""],
    ["Coca", "6.00", ""],
  ]);
  // sem quebra de linha, o que vem depois do preço continua sendo o próximo prato (a fala corrida não tem como saber)
  assert.deepEqual(read("x-tudo 25 coca"), [
    ["X-Tudo", "25.00", ""],
    ["Coca", "", ""],
  ]);
});

test("um preço ou uma lista dita sozinha numa linha vai para o prato da linha de cima", () => {
  const menu = parseSpokenMenu("x-tudo\ncusta 25\nvai ter ovo e bacon");
  assert.deepEqual(menu.dishes.map((dish) => [dish.name, dish.price, dish.description]), [["X-Tudo", "25.00", "Ovo, bacon"]]);
});
