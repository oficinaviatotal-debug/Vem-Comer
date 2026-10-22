import test from "node:test";
import assert from "node:assert/strict";

import { importPayload, selectedItems, startFromParsed, startSpeak } from "../../frontend/src/assistant/assistantFlow.ts";
import {
  applyEdit,
  changeInside,
  insideOf,
  noticeOf,
  reviewViewOf,
  speakViewOf,
  takeSpoken,
} from "../../frontend/src/painel/menuSetupLogic.ts";

/** O dinheiro sai com espaço que não quebra linha ("R$ 25,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/ /g, " ");

const say = (flow, text, heading = "") => takeSpoken(flow, text, heading);

/** O cardápio como o servidor o lê da foto: um prato com o que vai dentro (do papel), um sem. */
const fromPhoto = () =>
  startFromParsed({
    readable: true,
    notes: "",
    categories: [
      {
        name: "Lanches",
        items: [
          { name: "X-Tudo", price: "25.00", description: "Hambúrguer, ovo, bacon, salame" },
          { name: "X-Salada", price: "22.00" },
          { name: "X-Bacon", price: "", description: "Pão, bacon, queijo" },
        ],
      },
    ],
  });

test("a ordem inteira dita ao microfone vira um prato com preço e o que vai dentro, e a tela diz o que anotou", () => {
  const out = say(startSpeak(), "eu quero que você cadastre um X-Tudo, no X-Tudo custa R$25, vai ter ovo, bacon, hambúrguer, salame, e etc.");
  const [dish] = selectedItems(out.flow);
  assert.equal(selectedItems(out.flow).length, 1);
  assert.equal(dish.name, "X-Tudo");
  assert.equal(dish.price, "25.00");
  assert.equal(out.unclear.length, 0);
  assert.equal(n(out.notice), "Anotei X-Tudo, R$ 25,00. Dentro: Ovo, bacon, hambúrguer, salame.");
  assert.deepEqual(importPayload(out.flow).categories, [
    { name: "Lanches", items: [{ name: "X-Tudo", price: "25.00", description: "Ovo, bacon, hambúrguer, salame" }] },
  ]);
});

test("lista comprida: a frase conta quantos são em vez de ler tudo", () => {
  const list = "ovo, bacon, hambúrguer, salame, queijo, presunto, tomate, alface, cebola, milho, batata palha";
  const out = say(startSpeak(), `x-tudo 25 vai ter ${list}`);
  assert.equal(n(out.notice), "Anotei X-Tudo, R$ 25,00. Dentro: 11 ingredientes.");
});

test("dito em duas falas: primeiro o prato, depois o preço e o que vai dentro", () => {
  let out = say(startSpeak(), "cadastre um x-tudo");
  assert.equal(out.notice, "Anotei X-Tudo. Falta o preço.");
  out = say(out.flow, "custa 25, vai ter ovo e bacon");
  assert.equal(n(out.notice), "X-Tudo, R$ 25,00. X-Tudo: anotei o que vai dentro.");
  assert.deepEqual(importPayload(out.flow).categories[0].items, [{ name: "X-Tudo", price: "25.00", description: "Ovo, bacon" }]);
});

test("o que vai dentro dito sem prato antes não vai para lugar nenhum, e a tela diz isso", () => {
  const out = say(startSpeak(), "vai ter ovo e bacon");
  assert.equal(out.flow.categories.length, 0);
  assert.match(out.notice, /^Não achei de qual prato é isso\. Diga o nome do prato primeiro/);
  // o preço sozinho, sem prato antes, também: antes a tela dizia "já estavam anotados", o que não era verdade
  const price = say(startSpeak(), "custa 25");
  assert.match(price.notice, /^Não achei de qual prato é isso/);
});

test("o prato dito de novo só com o preço mantém a lista; com outra lista, troca", () => {
  let out = say(startSpeak(), "x-tudo 25 leva ovo e bacon");
  out = say(out.flow, "o x-tudo 26");
  assert.equal(insideOf(out.flow, "0-0"), "Ovo, bacon");
  assert.equal(n(out.notice), "X-Tudo, R$ 26,00.");
  out = say(out.flow, "x-tudo 26 leva ovo, bacon e salame");
  assert.equal(insideOf(out.flow, "0-0"), "Ovo, bacon, salame");
  assert.equal(out.notice, "X-Tudo: anotei o que vai dentro.");
});

test("escrito em linhas: cada linha é um prato e o que vem depois do preço é o que vai dentro", () => {
  const out = say(startSpeak(), "x-tudo 25 ovo, bacon, salame\nx-salada 22 alface e tomate\ncoca 6");
  const items = selectedItems(out.flow);
  assert.deepEqual(
    items.map((item) => [item.name, item.price]),
    [
      ["X-Tudo", "25.00"],
      ["X-Salada", "22.00"],
      ["Coca", "6.00"],
    ],
  );
  const payload = importPayload(out.flow);
  const all = payload.categories.flatMap((category) => category.items);
  assert.equal(all.find((item) => item.name === "X-Tudo").description, "Ovo, bacon, salame");
  assert.equal(all.find((item) => item.name === "X-Salada").description, "Alface, tomate");
  assert.equal(all.find((item) => item.name === "Coca").description, undefined);
  assert.equal(out.notice, "Anotei 3 pratos. 2 pratos com o que vai dentro.");
});

test("a frase curta de cada fala: o que vai dentro entra só quando foi dito", () => {
  assert.equal(
    n(noticeOf({ added: [{ name: "Coca", price: "6.00" }], priced: [], described: [] })),
    "Anotei Coca, R$ 6,00.",
  );
  assert.equal(
    n(noticeOf({ added: [{ name: "X-Tudo", price: "25.00" }], priced: [], described: [{ name: "X-Tudo", description: "Ovo, bacon" }] })),
    "Anotei X-Tudo, R$ 25,00. Dentro: Ovo, bacon.",
  );
  // quem chama sem a lista (a tela antiga) continua igual
  assert.equal(n(noticeOf({ added: [{ name: "Coca", price: "6.00" }], priced: [] })), "Anotei Coca, R$ 6,00.");
});

test("a lista de quem fala mostra o que vai dentro de cada prato, e deixa vazio quando não há", () => {
  const out = say(startSpeak(), "x-tudo 25 leva ovo e bacon. coca 6");
  const view = speakViewOf({ flow: out.flow, listening: false, canListen: true, heard: "", notice: "", unclear: [] });
  assert.equal(view.stage, "speak");
  const dishes = view.groups.flatMap((group) => group.dishes);
  assert.deepEqual(
    dishes.map((dish) => [dish.name, dish.inside]),
    [
      ["X-Tudo", "Ovo, bacon"],
      ["Coca", ""],
    ],
  );
});

test("a conferência mostra o que a foto leu dentro de cada prato; o prato sem lista fica sem nada, nunca inventado", () => {
  const view = reviewViewOf({ flow: fromPhoto(), editing: null, error: "" });
  assert.equal(view.stage, "review");
  const dishes = [...view.missing, ...view.groups.flatMap((group) => group.dishes)];
  const inside = Object.fromEntries(dishes.map((dish) => [dish.name, dish.inside]));
  assert.deepEqual(inside, {
    "X-Tudo": "Hambúrguer, ovo, bacon, salame",
    "X-Salada": "",
    "X-Bacon": "Pão, bacon, queijo",
  });
  // o prato sem preço continua separado no alto, agora também com o que vai dentro
  assert.deepEqual(view.missing.map((dish) => [dish.name, dish.inside]), [["X-Bacon", "Pão, bacon, queijo"]]);
});

test("'Pronto' no lápis muda o que vai dentro; apagar o campo tira; campo que não veio não mexe em nada", () => {
  const flow = fromPhoto();
  const edited = applyEdit(flow, "0-0", "X-Tudo", "25,00", "Hambúrguer, ovo, bacon");
  assert.equal(edited.problem, "");
  assert.equal(insideOf(edited.flow, "0-0"), "Hambúrguer, ovo, bacon");

  const cleared = applyEdit(edited.flow, "0-0", "X-Tudo", "25,00", "   ");
  assert.equal(insideOf(cleared.flow, "0-0"), "");
  assert.deepEqual(importPayload(cleared.flow).categories[0].items[0], { name: "X-Tudo", price: "25.00" }, "sem lista, o cadastro não manda campo nenhum");

  const untouched = applyEdit(flow, "0-0", "X-Tudo", "25,00");
  assert.deepEqual(untouched.flow, flow, "sem mexer em nada, o mesmo cardápio");
  assert.equal(insideOf(untouched.flow, "0-0"), "Hambúrguer, ovo, bacon, salame");
});

test("espaços de sobra e linhas quebradas viram uma linha só; o tamanho cabe no cardápio", () => {
  const flow = fromPhoto();
  const spaced = changeInside(flow, "0-1", "  alface \n  tomate   e cebola ");
  assert.equal(insideOf(spaced, "0-1"), "alface tomate e cebola");
  const long = changeInside(flow, "0-1", "ovo ".repeat(200));
  assert.ok(insideOf(long, "0-1").length <= 300);
});

test("preço recusado: nada muda, nem a lista que veio junto", () => {
  const flow = fromPhoto();
  const refused = applyEdit(flow, "0-0", "X-Tudo", "abc", "só isso");
  assert.equal(refused.problem, "price");
  assert.equal(refused.flow, flow);
  assert.equal(insideOf(refused.flow, "0-0"), "Hambúrguer, ovo, bacon, salame");
});

test("número de prato que não existe: mudar o que vai dentro não faz nada", () => {
  const flow = fromPhoto();
  assert.equal(changeInside(flow, "9-9", "ovo"), flow);
  assert.equal(changeInside(flow, "nada", "ovo"), flow);
  assert.equal(insideOf(flow, "9-9"), "");
});

test("o cadastro leva a lista do papel como veio, e a que a pessoa corrigiu no lugar dela", () => {
  const before = importPayload(fromPhoto());
  assert.deepEqual(before.categories[0].items.map((item) => [item.name, item.description]), [
    ["X-Tudo", "Hambúrguer, ovo, bacon, salame"],
    ["X-Salada", undefined],
  ]);
  const after = importPayload(applyEdit(fromPhoto(), "0-1", "X-Salada", "22,00", "Alface, tomate").flow);
  assert.deepEqual(after.categories[0].items.map((item) => [item.name, item.description]), [
    ["X-Tudo", "Hambúrguer, ovo, bacon, salame"],
    ["X-Salada", "Alface, tomate"],
  ]);
});
