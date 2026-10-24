import test from "node:test";
import assert from "node:assert/strict";

import { importPayload, selectedItems } from "../../frontend/src/assistant/assistantFlow.ts";
import {
  MAX_CATEGORIES,
  MAX_DISHES,
  MAX_TYPES,
  backPrice,
  dropDish,
  goBackPick,
  goNext,
  modelNotFoundText,
  modelOf,
  modelTypesOf,
  pickViewOf,
  pricesViewOf,
  startModel,
  takeDish,
  takePrice,
  toggleCategory,
  toggleDish,
  typesViewOf,
  whereOf,
} from "../../frontend/src/painel/menuModelLogic.ts";
import { applyEdit, changeName, reviewViewOf, saveCounts } from "../../frontend/src/painel/menuSetupLogic.ts";

/** O dinheiro sai com espaço que não quebra linha: aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/ /g, " ");

const model = () => ({
  id: "lanchonete",
  name: "Lanchonete",
  icon: "🍔",
  categories: [
    { name: "Lanches", items: [{ name: "X-tudo" }, { name: "X-salada" }, { name: "X-bacon" }] },
    { name: "Bebidas", items: [{ name: "Coca-Cola lata" }, { name: "Suco de laranja" }] },
    { name: "Sobremesas", items: [{ name: "Pudim" }] },
  ],
});
const fresh = () => startModel(modelOf(model(), "lanchonete"));
/** Marca todos os pratos da categoria que está na tela e segue. */
const markAndGo = (flow) => goNext(toggleCategory(flow));

// ------------------------------------------------------------------------------------------------ o que o servidor manda

test("a lista de tipos: só entra o que tem identificador simples e nome; repetido, sem nome e coisa estranha ficam de fora", () => {
  const out = modelTypesOf([
    { id: "lanchonete", name: "Lanchonete", icon: "🍔" },
    { id: "pizzaria", name: "  Pizzaria  ", icon: "🍕" },
    { id: "lanchonete", name: "Repetida", icon: "x" },
    { id: "sem-nome", name: "   " },
    { id: "../etc", name: "Caminho" },
    { id: "", name: "Sem id" },
    { id: 7, name: "Número" },
    null,
    "texto",
    [],
    { name: "Sem id nenhum" },
  ]);
  assert.deepEqual(out.map((t) => t.id), ["lanchonete", "pizzaria"]);
  assert.equal(out[1].name, "Pizzaria", "espaços aparados");
});

test("a lista de tipos: resposta que não é lista vale nulo (a tela diz que não entendeu); lista vazia é lista vazia", () => {
  for (const bad of [null, undefined, {}, "x", 3, { 0: { id: "a", name: "b" } }]) assert.equal(modelTypesOf(bad), null, String(bad));
  assert.deepEqual(modelTypesOf([]), []);
});

test("o desenho do tipo é só texto, curto; sem desenho vale a inicial do nome; nome longo é cortado", () => {
  const [a, b, c] = modelTypesOf([
    { id: "a", name: "Açaí", icon: "<img src=x onerror=alert(1)> é muito comprido" },
    { id: "b", name: "Bolos", icon: "" },
    { id: "c", name: "x".repeat(200), icon: "🍰" },
  ]);
  assert.ok(Array.from(a.icon).length <= 4, "no máximo 4 caracteres");
  assert.equal(b.icon, "B");
  assert.ok(c.name.length <= 40);
});

test("a lista de tipos tem teto: mais do que o razoável é cortado", () => {
  const many = Array.from({ length: MAX_TYPES + 30 }, (_, i) => ({ id: `t${i}`, name: `Tipo ${i}`, icon: "🍽" }));
  assert.equal(modelTypesOf(many).length, MAX_TYPES);
});

test("o modelo: nome limpo, repetido na categoria sai, categoria sem prato sai", () => {
  const out = modelOf(
    {
      name: "Pizzaria",
      icon: "🍕",
      categories: [
        { name: "  pizzas  ", items: [{ name: "calabresa  grande." }, { name: "Calabresa grande" }, { name: "  " }, { name: "Mussarela" }, null, { nome: "x" }] },
        { name: "Vazia", items: [] },
        { name: "", items: [{ name: "Sem nome de categoria" }] },
        { name: "Bebidas", items: "não é lista" },
        { name: "Bebidas", items: [{ name: "Guaraná" }] },
      ],
    },
    "pizzaria",
  );
  assert.equal(out.id, "pizzaria");
  assert.deepEqual(out.categories.map((c) => c.name), ["Pizzas", "Bebidas"]);
  assert.deepEqual(out.categories[0].items.map((i) => i.name), ["Calabresa grande", "Mussarela"]);
});

test("o modelo: sem nenhuma categoria com prato (ou resposta que não é um modelo) vale nulo", () => {
  for (const bad of [null, undefined, [], "x", {}, { categories: "x" }, { categories: [] }, { categories: [{ name: "A", items: [] }] }, { categories: [{ name: "A", items: [{ name: "" }] }] }]) {
    assert.equal(modelOf(bad, "x"), null, JSON.stringify(bad));
  }
});

test("o modelo tem teto de categorias e de pratos por categoria", () => {
  const categories = Array.from({ length: MAX_CATEGORIES + 10 }, (_, c) => ({
    name: `Categoria ${c}`,
    items: Array.from({ length: MAX_DISHES + 50 }, (_, i) => ({ name: `Prato ${c}-${i}` })),
  }));
  const out = modelOf({ name: "Enorme", categories }, "enorme");
  assert.equal(out.categories.length, MAX_CATEGORIES);
  assert.equal(out.categories[0].items.length, MAX_DISHES);
});

test("o modelo sem nome ganha um nome simples; o nome do tipo nunca vira código", () => {
  assert.equal(modelOf({ categories: [{ name: "A", items: [{ name: "B" }] }] }, "x").name, "Modelo");
  assert.equal(modelOf({ name: "<b>Bar</b>", categories: [{ name: "A", items: [{ name: "B" }] }] }, "x").name, "<b>Bar</b>", "texto como veio: quem desenha não o trata como HTML");
});

// ------------------------------------------------------------------------------------------------ escolher o tipo

const TYPES = modelTypesOf([
  { id: "lanchonete", name: "Lanchonete", icon: "🍔" },
  { id: "pizzaria", name: "Pizzaria", icon: "🍕" },
  { id: "tapiocaria", name: "Tapiocaria", icon: "🫓" },
]);

test("antes de a lista chegar: abrindo, sem tipos e sem 'não achei'; com erro, aparece Tentar de novo", () => {
  const wait = typesViewOf({ types: null, query: "", error: "", opening: false });
  assert.equal(wait.stage, "types");
  assert.equal(wait.loading, true);
  assert.deepEqual(wait.tiles, []);
  assert.equal(wait.empty, "");
  assert.equal(wait.canRetry, false);
  assert.equal(wait.working, "Abrindo os tipos de negócio…");
  const failed = typesViewOf({ types: null, query: "", error: "Sem sinal.", opening: false });
  assert.equal(failed.loading, false);
  assert.equal(failed.canRetry, true);
  assert.equal(failed.error, "Sem sinal.");
  assert.equal(failed.working, "");
});

test("com a lista: todos os tipos, e a busca acha por nome ou por como o povo chama (sem acento, maiúscula ou plural)", () => {
  assert.deepEqual(typesViewOf({ types: TYPES, query: "", error: "", opening: false }).tiles.map((t) => t.id), ["lanchonete", "pizzaria", "tapiocaria"]);
  assert.deepEqual(typesViewOf({ types: TYPES, query: "PIZZAS", error: "", opening: false }).tiles.map((t) => t.id), ["pizzaria"]);
  assert.deepEqual(typesViewOf({ types: TYPES, query: "tapioca", error: "", opening: false }).tiles.map((t) => t.id), ["tapiocaria"]);
  assert.deepEqual(typesViewOf({ types: TYPES, query: "sanduíche", error: "", opening: false }).tiles.map((t) => t.id), ["lanchonete"]);
});

test("busca sem resultado diz o que não achou, só depois de a lista chegar; lista vazia não diz 'não achei'", () => {
  const none = typesViewOf({ types: TYPES, query: "  xyz ", error: "", opening: false });
  assert.deepEqual(none.tiles, []);
  assert.equal(none.empty, "Não achei “xyz”. Tente outra palavra, ou volte e fale os pratos.");
  assert.equal(modelNotFoundText(" xyz "), none.empty);
  assert.equal(typesViewOf({ types: [], query: "", error: "", opening: false }).empty, "", "lista vazia não é 'não achei'");
});

test("escolhido o tipo, a frase diz que está abrindo o modelo e a lista não some", () => {
  const view = typesViewOf({ types: TYPES, query: "", error: "", opening: true });
  assert.equal(view.working, "Abrindo o modelo…");
  assert.equal(view.loading, false);
  assert.equal(view.tiles.length, 3);
});

// ------------------------------------------------------------------------------------------------ tocar nos pratos

test("começa sem nenhum prato marcado, na primeira categoria, e diz em que categoria está", () => {
  const flow = fresh();
  assert.equal(flow.step, "pick");
  assert.equal(flow.source, "template");
  assert.equal(selectedItems(flow).length, 0);
  const view = pickViewOf({ flow, notice: "" });
  assert.equal(view.stage, "pick");
  assert.equal(view.title, "Lanches");
  assert.equal(view.sub, "Categoria 1 de 3");
  assert.deepEqual(view.dishes.map((d) => [d.id, d.name, d.selected]), [["0-0", "X-tudo", false], ["0-1", "X-salada", false], ["0-2", "X-bacon", false]]);
  assert.equal(view.count, "Nenhum marcado. Esta categoria fica de fora.");
  assert.equal(view.markAll, "Marcar todos");
  assert.equal(view.next, "Próxima: Bebidas");
  assert.equal(view.canNext, true, "categoria sem nada marcado também se pula");
  assert.equal(view.note, "");
});

test("tocar num prato marca, tocar de novo desmarca; a frase conta no singular e no plural", () => {
  let flow = toggleDish(fresh(), "0-1");
  let view = pickViewOf({ flow, notice: "" });
  assert.equal(view.count, "1 marcado");
  assert.deepEqual(view.dishes.map((d) => d.selected), [false, true, false]);
  flow = toggleDish(flow, "0-0");
  assert.equal(pickViewOf({ flow, notice: "" }).count, "2 marcados");
  flow = toggleDish(flow, "0-1");
  assert.deepEqual(pickViewOf({ flow, notice: "" }).dishes.map((d) => d.selected), [true, false, false]);
});

test("toque em número estranho ou em prato de outra categoria não muda nada", () => {
  const flow = fresh();
  for (const id of ["", "x", "1-0", "0-99", "0-", "-1-0", "99-0", "0-0; drop"]) {
    assert.equal(selectedItems(toggleDish(flow, id)).length, 0, id);
  }
});

test("Marcar todos marca a categoria; quando todos estão marcados o botão vira Tirar todos e desmarca", () => {
  const all = toggleCategory(fresh());
  assert.equal(selectedItems(all).length, 3);
  const view = pickViewOf({ flow: all, notice: "" });
  assert.equal(view.markAll, "Tirar todos");
  assert.equal(view.count, "3 marcados");
  assert.equal(selectedItems(toggleCategory(all)).length, 0);
  // um só desmarcado: volta a oferecer Marcar todos
  assert.equal(pickViewOf({ flow: toggleDish(all, "0-0"), notice: "" }).markAll, "Marcar todos");
});

test("seguir: de categoria em categoria, e a frase do botão diz para qual; a última leva aos preços", () => {
  let flow = markAndGo(fresh());
  assert.equal(flow.step, "pick");
  assert.equal(pickViewOf({ flow, notice: "" }).title, "Bebidas");
  assert.equal(pickViewOf({ flow, notice: "" }).next, "Próxima: Sobremesas");
  assert.equal(pickViewOf({ flow, notice: "" }).note, "3 pratos marcados até agora.");
  flow = markAndGo(flow);
  const last = pickViewOf({ flow, notice: "" });
  assert.equal(last.title, "Sobremesas");
  assert.equal(last.next, "Colocar os preços (5)");
  assert.equal(last.canNext, true);
  assert.equal(goNext(flow).step, "prices");
});

test("sem nenhum prato marcado em lugar nenhum, a última categoria não segue e diz o que falta", () => {
  const flow = goNext(goNext(fresh()));
  const last = pickViewOf({ flow, notice: "" });
  assert.equal(last.title, "Sobremesas");
  assert.equal(last.next, "Colocar os preços");
  assert.equal(last.canNext, false, "nada marcado no total: não segue");
  assert.equal(last.note, "Marque pelo menos um prato para seguir.");
  assert.equal(goNext(flow).step, "pick", "sem prato nenhum a última categoria fica onde está");
});

test("na última categoria, com pelo menos um prato em qualquer categoria, segue para os preços e o botão conta os pratos", () => {
  let flow = toggleDish(fresh(), "0-0");
  flow = goNext(flow);
  flow = goNext(flow);
  const last = pickViewOf({ flow, notice: "" });
  assert.equal(last.next, "Colocar os preços (1)");
  assert.equal(last.canNext, true);
  assert.equal(last.note, "1 prato marcado até agora.");
  const next = goNext(flow);
  assert.equal(next.step, "prices");
  assert.equal(whereOf(next), "prices");
});

test("voltar: volta uma categoria; na primeira não há para onde (quem chama volta à escolha do tipo)", () => {
  const second = goNext(fresh());
  assert.equal(goBackPick(second).categoryIndex, 0);
  assert.equal(goBackPick(fresh()), null);
  // o que estava marcado continua marcado ao voltar
  const kept = goBackPick(goNext(toggleDish(fresh(), "0-2")));
  assert.deepEqual(pickViewOf({ flow: kept, notice: "" }).dishes.map((d) => d.selected), [false, false, true]);
});

test("falta um prato: o que a pessoa escreve entra marcado, limpo, e se já existe só marca", () => {
  const added = takeDish(fresh(), "  pastel   de queijo. ");
  assert.equal(added.notice, "Anotei Pastel de queijo.");
  const view = pickViewOf({ flow: added.flow, notice: added.notice });
  assert.equal(view.dishes.length, 4);
  assert.deepEqual(view.dishes[3], { id: "0-3", name: "Pastel de queijo", selected: true });
  assert.equal(view.notice, "Anotei Pastel de queijo.");
  const again = takeDish(added.flow, "PASTEL DE QUEIJO");
  assert.equal(again.notice, "Esse prato já está marcado.");
  assert.equal(pickViewOf({ flow: again.flow, notice: "" }).dishes.length, 4);
  const marked = takeDish(fresh(), "x-tudo");
  assert.equal(marked.notice, "Marquei X-tudo.");
  assert.equal(selectedItems(marked.flow).length, 1);
  assert.deepEqual(takeDish(fresh(), "   "), { flow: fresh(), notice: "" });
});

test("o prato escrito vai para a categoria que está na tela, não para a primeira", () => {
  const second = goNext(fresh());
  const out = takeDish(second, "Guaraná");
  assert.deepEqual(pickViewOf({ flow: out.flow, notice: "" }).dishes.map((d) => d.name), ["Coca-Cola lata", "Suco de laranja", "Guaraná"]);
});

// ------------------------------------------------------------------------------------------------ um preço por vez

const priced = () => {
  // marca X-tudo e X-salada, Coca e Pudim; vai aos preços
  let flow = fresh();
  flow = toggleDish(toggleDish(flow, "0-0"), "0-1");
  flow = goNext(flow);
  flow = toggleDish(flow, "1-0");
  flow = goNext(flow);
  flow = toggleDish(flow, "2-0");
  return goNext(flow);
};

test("os preços: um prato por vez, com a posição e a categoria; o último diz Conferir tudo", () => {
  const flow = priced();
  assert.equal(flow.step, "prices");
  const view = pricesViewOf({ flow, problem: "" });
  assert.equal(view.stage, "prices");
  assert.equal(view.sub, "Prato 1 de 4");
  assert.equal(view.name, "X-tudo");
  assert.equal(view.group, "Lanches");
  assert.equal(view.value, "");
  assert.equal(view.problem, "");
  assert.equal(view.next, "Próximo prato");
  assert.equal(view.dishId, "0-0");
});

test("o preço escrito vale (vírgula ou ponto, com R$), vai para o próximo prato e o último leva à conferência", () => {
  let flow = priced();
  let out = takePrice(flow, "R$ 25,50");
  assert.equal(out.problem, "");
  assert.equal(pricesViewOf({ flow: out.flow, problem: "" }).name, "X-salada");
  assert.equal(pricesViewOf({ flow: out.flow, problem: "" }).sub, "Prato 2 de 4");
  out = takePrice(out.flow, "22");
  out = takePrice(out.flow, "6.5");
  const last = pricesViewOf({ flow: out.flow, problem: "" });
  assert.equal(last.name, "Pudim");
  assert.equal(last.next, "Conferir tudo");
  out = takePrice(out.flow, "12");
  assert.equal(whereOf(out.flow), "review");
  assert.equal(pricesViewOf({ flow: out.flow, problem: "" }), null, "sem prato esperando preço, não há tela de preço");
  assert.deepEqual(
    importPayload(out.flow).categories.map((c) => [c.name, c.items.map((i) => [i.name, i.price])]),
    [["Lanches", [["X-tudo", "25.50"], ["X-salada", "22.00"]]], ["Bebidas", [["Coca-Cola lata", "6.50"]]], ["Sobremesas", [["Pudim", "12.00"]]]],
  );
});

test("preço que não é número, zero ou campo vazio não segue e diz o problema; o prato continua o mesmo", () => {
  const flow = priced();
  for (const text of ["", "   ", "abc", "0", "0,00", "-5", "12,345", "100000"]) {
    const out = takePrice(flow, text);
    assert.equal(out.problem, "price", JSON.stringify(text));
    assert.equal(out.flow, flow, "nada mudou");
  }
  const view = pricesViewOf({ flow, problem: "price" });
  assert.equal(view.problem, "Não entendi esse preço. Escreva só números, por exemplo 18,50.");
  assert.equal(view.name, "X-tudo");
});

test("tirar este prato: ele sai e vem o próximo; tirando o último, vai à conferência; tirando todos, volta às categorias", () => {
  let flow = dropDish(priced());
  assert.equal(pricesViewOf({ flow, problem: "" }).name, "X-salada");
  assert.equal(pricesViewOf({ flow, problem: "" }).sub, "Prato 1 de 3");
  flow = dropDish(dropDish(dropDish(flow)));
  assert.equal(whereOf(flow), "pick", "sem nenhum prato, volta a marcar");
  assert.equal(flow.categoryIndex, 0);
});

test("voltar um prato mostra o preço que já estava escrito ('25,50') e dá para mantê-lo com o campo vazio", () => {
  let out = takePrice(priced(), "25,5");
  const back = backPrice(out.flow);
  const view = pricesViewOf({ flow: back, problem: "" });
  assert.equal(view.name, "X-tudo");
  assert.equal(view.value, "25,50");
  out = takePrice(back, "");
  assert.equal(out.problem, "");
  assert.equal(pricesViewOf({ flow: out.flow, problem: "" }).name, "X-salada");
});

test("voltar do primeiro preço leva às categorias, na última; da conferência volta ao último prato", () => {
  assert.equal(whereOf(backPrice(priced())), "pick");
  let flow = priced();
  for (const price of ["1", "2", "3", "4"]) flow = takePrice(flow, price).flow;
  assert.equal(whereOf(flow), "review");
  const back = backPrice(flow);
  assert.equal(whereOf(back), "prices");
  assert.equal(pricesViewOf({ flow: back, problem: "" }).name, "Pudim");
});

// ------------------------------------------------------------------------------------------------ conferir e cadastrar

test("a conferência do modelo tem a sua frase e mostra todos os pratos com preço; nada fica de fora", () => {
  let flow = priced();
  for (const price of ["25", "22", "6", "12"]) flow = takePrice(flow, price).flow;
  const view = reviewViewOf({ flow, editing: null, error: "" });
  assert.equal(view.intro, "Confira os pratos e os preços. Corrija o que precisar e cadastre.");
  assert.equal(view.missing.length, 0);
  assert.deepEqual(view.groups.map((g) => [g.name, g.dishes.length]), [["Lanches", 2], ["Bebidas", 1], ["Sobremesas", 1]]);
  assert.deepEqual(saveCounts(flow), { saved: 4, missing: 0 });
  assert.equal(view.saveLabel, "Cadastrar 4 pratos");
  assert.equal(n(view.groups[0].dishes[0].price), "R$ 25,00");
});

test("na conferência, o nome de um prato do modelo pode ser mudado: o prato passa a ser da pessoa", () => {
  let flow = priced();
  for (const price of ["25", "22", "6", "12"]) flow = takePrice(flow, price).flow;
  const renamed = applyEdit(flow, "0-0", "X-tudo da casa", "");
  assert.equal(renamed.problem, "");
  assert.equal(importPayload(renamed.flow).categories[0].items[0].name, "X-tudo da casa");
  // nome vazio ou repetido na categoria continua barrado
  assert.equal(applyEdit(flow, "0-0", "   ", "").problem, "name");
  assert.equal(applyEdit(flow, "0-0", "x-salada", "").problem, "name");
  // mudar só o preço não renomeia
  assert.equal(importPayload(applyEdit(flow, "0-0", "X-tudo", "30").flow).categories[0].items[0].name, "X-tudo");
  assert.equal(changeName(flow, "9-9", "x"), flow, "prato que não existe não muda nada");
});

test("o caminho de foto e fala não mudou: a conferência deles ainda tem as frases de antes", () => {
  const flow = { step: "review", source: "photo", templateName: "x", categories: [{ name: "A", items: [{ name: "B", selected: true, custom: true, price: "5.00" }] }], categoryIndex: 0, priceCursor: 0 };
  assert.equal(reviewViewOf({ flow, editing: null, error: "" }).intro, "Li o seu cardápio. Corrija o que precisar e cadastre.");
  assert.equal(reviewViewOf({ flow: { ...flow, source: "speech" }, editing: null, error: "" }).intro, "Confira o que você falou. Corrija o que precisar e cadastre.");
});
