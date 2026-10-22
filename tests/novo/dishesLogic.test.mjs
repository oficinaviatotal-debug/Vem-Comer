import test from "node:test";
import assert from "node:assert/strict";

import {
  ARM_MS,
  DISHES_POLL_MS,
  SEARCH_FROM,
  allBack,
  categoriesViewOf,
  categoryAddedText,
  categoryCheck,
  categoryProblemText,
  categoryRemovedText,
  dishAddedText,
  dishCheck,
  dishProblemText,
  dishEditCheck,
  dishRemovedText,
  dishSavedText,
  dishesViewOf,
  emptyDishForm,
  formAfterAdd,
  formOfDish,
  notFoundText,
  priceText,
  soldOutAlert,
  soldOutCount,
  withEdit,
  withSoldOut,
  wordsOf,
} from "../../frontend/src/painel/dishesLogic.ts";

/** O dinheiro sai com espaço que não quebra linha ("R$ 50,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/\u00a0/g, " ");

const menus = [
  { id: "m1", name: "Lanches" },
  { id: "m2", name: "Bebidas" },
];
const dish = (id, name, price, extra = {}) => ({ id, menu_id: "m1", name, price, ...extra });
const products = () => [
  dish("p1", "X-tudo", "25.00", { description: "Pão, carne, ovo e queijo" }),
  dish("p2", "X-salada", "22.5"),
  dish("p3", "Coca-Cola lata", 6, { menu_id: "m2", sold_out: true }),
  dish("p4", "Suco de laranja", "9.00", { menu_id: "m2", option_groups: [{}, {}] }),
];
const media = (path) => (path ? `https://x.test${path}` : "");
const view = (extra = {}) =>
  dishesViewOf({ products: products(), menus, canManage: true, query: "", armed: null, media, error: "", notice: "", ...extra });

test("os tempos: a lixeira espera o segundo toque por 4 s e a lista se atualiza a cada 30 s", () => {
  assert.equal(ARM_MS, 4000);
  assert.equal(DISHES_POLL_MS, 30000);
  assert.equal(SEARCH_FROM, 8);
});

test("a faixa do esgotado: some sem esgotado, e fala no singular e no plural", () => {
  assert.equal(soldOutAlert(0), "");
  assert.equal(soldOutAlert(1), "1 prato esgotado. O cliente vê, mas não consegue pedir.");
  assert.equal(soldOutAlert(3), "3 pratos esgotados. O cliente vê, mas não consegue pedir.");
  assert.equal(soldOutCount(products()), 1);
});

test("marcar um prato muda só ele; voltou tudo desmarca todos; a lista de origem não muda", () => {
  const list = products();
  const marked = withSoldOut(list, "p1", true);
  assert.equal(marked.find((p) => p.id === "p1").sold_out, true);
  assert.equal(marked.find((p) => p.id === "p2").sold_out, undefined);
  assert.equal(list.find((p) => p.id === "p1").sold_out, undefined, "a lista antiga fica como estava");
  const back = withSoldOut(marked, "p3", false);
  assert.equal(back.find((p) => p.id === "p3").sold_out, false);
  assert.equal(soldOutCount(allBack(marked)), 0);
});

test("antes da primeira resposta a tela diz que está abrindo, e não que não há pratos", () => {
  const loading = dishesViewOf({ products: null, menus: null, canManage: true, query: "", armed: null, media, error: "", notice: "" });
  assert.equal(loading.loading, true);
  assert.equal(loading.sub, "Abrindo os pratos…");
  assert.equal(loading.empty, "", "nada de 'Nenhum prato ainda' enquanto não carregou");
  assert.deepEqual(loading.lists, []);
  const failed = dishesViewOf({ products: null, menus: null, canManage: true, query: "", armed: null, media, error: "Sem sinal. Tente de novo.", notice: "" });
  assert.equal(failed.sub, "", "se a primeira busca falhou, o erro fala por si");
  assert.equal(failed.error, "Sem sinal. Tente de novo.");
  const half = dishesViewOf({ products: products(), menus: null, canManage: true, query: "", armed: null, media, error: "", notice: "" });
  assert.equal(half.loading, true, "sem as categorias ainda não dá para agrupar");
});

test("os pratos aparecem por categoria, na ordem em que o cliente os vê, com a conta de cada uma", () => {
  const v = view();
  assert.deepEqual(v.lists.map((l) => [l.title, l.count]), [["Lanches", "2 pratos"], ["Bebidas", "2 pratos"]]);
  assert.deepEqual(v.lists[0].sections[0].rows.map((r) => r.name), ["X-tudo", "X-salada"]);
  assert.equal(v.sub, "4 pratos · 1 esgotado");
  assert.equal(v.title, "Pratos");
});

test("cada prato: preço em reais, foto só se for do restaurante, selo de opções e o botão do momento", () => {
  const rows = view({ products: [
    dish("p1", "X-tudo", "25.00", { thumb_url: "/media/a/b.webp" }),
    dish("p2", "Pizza", 40, { sold_out: true, option_groups: [{}] }),
    dish("p3", "Água", "abc"),
  ] }).lists[0].sections[0].rows;
  assert.equal(n(rows[0].price), "R$ 25,00");
  assert.equal(rows[0].photo, "https://x.test/media/a/b.webp");
  assert.equal(rows[0].badge, undefined);
  assert.equal(rows[0].toggle, "Esgotou");
  assert.equal(rows[0].toggleSpoken, "X-tudo esgotou");
  assert.equal(rows[1].soldOut, true);
  assert.equal(rows[1].toggle, "Voltou");
  assert.equal(rows[1].toggleSpoken, "Pizza voltou");
  assert.equal(rows[1].badge, "1 grupo de opções");
  assert.equal(rows[2].photo, undefined);
  assert.equal(n(rows[2].price), "R$ 0,00", "preço que não é número nunca vira 'NaN'");
});

test("a lixeira só fica armada para quem pode remover, e só no prato tocado", () => {
  const manager = view({ armed: "p2" }).lists[0].sections[0].rows;
  assert.deepEqual(manager.map((r) => r.armed), [false, true]);
  const kitchen = view({ armed: "p2", canManage: false }).lists[0].sections[0].rows;
  assert.deepEqual(kitchen.map((r) => r.armed), [false, false]);
});

test("a cozinha vê 'O que esgotou', sem criar nem remover", () => {
  const kitchen = view({ canManage: false });
  assert.equal(kitchen.title, "O que esgotou");
  assert.equal(kitchen.canManage, false);
  const empty = dishesViewOf({ products: [], menus: [], canManage: false, query: "", armed: null, media, error: "", notice: "" });
  assert.equal(empty.empty, "Ainda não há pratos cadastrados. Peça ao gerente.");
});

test("sem nenhum prato: o dono recebe o convite para criar ou montar o cardápio", () => {
  const empty = dishesViewOf({ products: [], menus, canManage: true, query: "", armed: null, media, error: "", notice: "" });
  assert.equal(empty.sub, "Nenhum prato ainda");
  assert.match(empty.empty, /Novo prato/);
  assert.match(empty.empty, /foto, arquivo ou voz/);
  assert.equal(empty.alert, "");
  assert.equal(empty.showSearch, false);
});

test("prato sem categoria, ou de categoria que o servidor não mandou, aparece em 'Sem categoria' (o dono vê todos)", () => {
  const v = view({ products: [dish("p1", "X-tudo", 25), dish("p2", "Brinde", 1, { menu_id: null }), dish("p3", "Sorvete", 8, { menu_id: "desligada" })] });
  assert.deepEqual(v.lists.map((l) => l.title), ["Lanches", "Sem categoria"]);
  assert.deepEqual(v.lists[1].sections[0].rows.map((r) => r.name), ["Brinde", "Sorvete"]);
});

test("sem nenhuma categoria criada, os pratos vêm sem cabeçalho repetido", () => {
  const v = dishesViewOf({ products: [dish("p1", "X-tudo", 25, { menu_id: null })], menus: [], canManage: true, query: "", armed: null, media, error: "", notice: "" });
  assert.equal(v.lists.length, 1);
  assert.equal(v.lists[0].title, "");
});

test("um prato em subseção aparece sob o título da subseção", () => {
  const v = view({ products: [dish("p1", "Calabresa", 40, { subcategory: "Tradicionais" }), dish("p2", "Trufada", 60, { subcategory: "Especiais" })] });
  assert.deepEqual(v.lists[0].sections.map((s) => s.title), ["Tradicionais", "Especiais"]);
});

test("a busca acha sem acento e sem maiúscula, no nome e na descrição (que a lista não mostra), e diz quando não achou", () => {
  const list = [...products(), dish("p5", "Purê de batata", 12), dish("p6", "Pastel", 8), dish("p7", "Pudim", 9), dish("p8", "Brigadeiro", 4)];
  const found = view({ products: list, query: "PURE" });
  assert.deepEqual(found.lists.flatMap((l) => l.sections.flatMap((s) => s.rows.map((r) => r.name))), ["Purê de batata"]);
  const byText = view({ products: list, query: "ovo e queijo" });
  assert.deepEqual(byText.lists.flatMap((l) => l.sections.flatMap((s) => s.rows.map((r) => r.name))), ["X-tudo"]);
  const none = view({ products: list, query: "xyz" });
  assert.equal(none.empty, notFoundText("xyz"));
  assert.equal(none.empty, "Nenhum prato com “xyz”. Tente outra palavra.");
  assert.equal(none.sub, "8 pratos · 1 esgotado", "a frase de cima conta todos, não só os achados");
  assert.equal(none.alert, soldOutAlert(1), "a faixa do esgotado também conta todos");
});

test("a busca só aparece a partir de 8 pratos", () => {
  assert.equal(view().showSearch, false);
  const many = Array.from({ length: 8 }, (_, i) => dish(`p${i}`, `Prato ${i}`, 10));
  assert.equal(view({ products: many }).showSearch, true);
  assert.equal(view({ products: many.slice(0, 7) }).showSearch, false);
});

test("a frase que o leitor de tela ouve: o aviso, senão a frase de cima", () => {
  assert.equal(view({ notice: "Pizza adicionado." }).live, "Pizza adicionado.");
  assert.equal(view().live, view().sub);
});

test("as categorias do formulário vêm na ordem do servidor", () => {
  assert.deepEqual(view().categories, [{ id: "m1", name: "Lanches" }, { id: "m2", name: "Bebidas" }]);
});

test("nenhuma tela escreve 'undefined', 'null' ou 'NaN'", () => {
  const out = JSON.stringify([view(), view({ query: "zzz" }), dishesViewOf({ products: [{ id: "x", menu_id: null, name: "A", price: null }], menus: [], canManage: true, query: "", armed: null, media, error: "", notice: "" })]);
  const strings = [...out.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]);
  assert.ok(!strings.some((s) => /undefined|NaN/.test(s)), "texto estranho na tela");
});

// ------------------------------------------------------------------------------------------------ prato novo

const form = (extra = {}) => ({ name: "Combinado 20 peças", price: "49,90", menuId: "m1", description: "", ...extra });

test("o formulário confere nome, preço e repetição; nome e preço saem limpos para o servidor", () => {
  const ok = dishCheck(form({ name: "  combinado   20 peças. ", description: "  com   shoyu ", price: "R$ 49,90" }), products(), menus);
  assert.deepEqual(ok, { ok: true, dish: { name: "Combinado 20 peças", description: "com shoyu", price: 49.9, menuId: "m1" } });
  assert.deepEqual(dishCheck(form({ name: "   " }), products(), menus), { ok: false, problem: "name" });
  assert.deepEqual(dishCheck(form({ name: "..." }), products(), menus), { ok: false, problem: "name" });
});

test("preço: vírgula ou ponto, nunca zero, nunca texto, nunca negativo", () => {
  for (const price of ["", "0", "0,00", "abc", "-5", "12,345", "1,2,3", "100000"]) {
    assert.deepEqual(dishCheck(form({ price }), products(), menus), { ok: false, problem: "price" }, price);
  }
  for (const [price, value] of [["18,5", 18.5], ["18.50", 18.5], ["1.234,50", 1234.5], ["9", 9]]) {
    const out = dishCheck(form({ price }), products(), menus);
    assert.equal(out.ok, true, price);
    assert.equal(out.dish.price, value, price);
  }
});

test("o mesmo prato na mesma categoria não entra duas vezes (sem olhar acento nem maiúscula), em outra categoria pode", () => {
  assert.deepEqual(dishCheck(form({ name: "x-TUDO", menuId: "m1" }), products(), menus), { ok: false, problem: "twice" });
  const other = dishCheck(form({ name: "X-tudo", menuId: "m2" }), products(), menus);
  assert.equal(other.ok, true);
  assert.equal(other.dish.menuId, "m2");
  assert.deepEqual(dishCheck(form({ name: "Suco de uva", menuId: "m2" }), products(), menus), { ok: true, dish: { name: "Suco de uva", description: "", price: 49.9, menuId: "m2" } }, "nome parecido mas diferente passa");
  assert.deepEqual(dishCheck(form({ name: "sucó de LARANJA", menuId: "m2" }), products(), menus), { ok: false, problem: "twice" }, "acento e maiúscula não diferenciam");
});

test("sem categoria vale como uma categoria só; categoria que não existe mais vira sem categoria", () => {
  const loose = [dish("p9", "Brinde", 1, { menu_id: null })];
  assert.deepEqual(dishCheck(form({ name: "brinde", menuId: "" }), loose, menus), { ok: false, problem: "twice" });
  const gone = dishCheck(form({ menuId: "apagada" }), products(), menus);
  assert.equal(gone.ok, true);
  assert.equal(gone.dish.menuId, null);
});

test("depois de adicionar, o formulário limpa tudo e guarda a categoria; o texto de cada problema", () => {
  assert.deepEqual(formAfterAdd({ ...form(), problem: "twice" }), { name: "", price: "", menuId: "m1", description: "", problem: "", editId: null });
  assert.deepEqual(emptyDishForm(), { name: "", price: "", menuId: "", description: "", problem: "", editId: null });
  assert.equal(dishProblemText(""), "");
  assert.equal(dishProblemText("name"), "Escreva o nome do prato.");
  assert.equal(dishProblemText("twice"), "Esse prato já existe nesta categoria.");
  assert.equal(dishProblemText("price"), "Não entendi esse preço. Escreva só números, por exemplo 18,50.");
});

// ------------------------------------------------------------------------------------------------ mudar um prato

test("o lápis abre o formulário com o que o prato tem agora (preço como se escreve: 25,00)", () => {
  assert.equal(priceText("25.00"), "25,00");
  assert.equal(priceText(6), "6,00");
  assert.equal(priceText("22.5"), "22,50");
  assert.deepEqual(formOfDish(products()[0], menus), {
    name: "X-tudo",
    price: "25,00",
    menuId: "m1",
    description: "Pão, carne, ovo e queijo",
    problem: "",
    editId: "p1",
  });
  assert.equal(formOfDish(products()[1], menus).description, "", "prato sem texto abre com o campo vazio");
});

test("categoria que o servidor não mandou (apagada ou sem categoria) abre como sem categoria", () => {
  assert.equal(formOfDish(dish("x", "Brinde", 1, { menu_id: null }), menus).menuId, "");
  assert.equal(formOfDish(dish("x", "Brinde", 1, { menu_id: "apagada" }), menus).menuId, "");
});

test("sem mexer em nada, o salvar não manda nada (o formulário só fecha)", () => {
  for (const product of products()) {
    const out = dishEditCheck(formOfDish(product, menus), product, products(), menus);
    assert.deepEqual(out, { ok: true, patch: {} }, product.name);
  }
});

test("só vai o que mudou: preço sozinho, nome sozinho, texto sozinho, categoria sozinha", () => {
  const p = products()[0];
  const base = formOfDish(p, menus);
  assert.deepEqual(dishEditCheck({ ...base, price: "27,5" }, p, products(), menus), { ok: true, patch: { price: 27.5 } });
  assert.deepEqual(dishEditCheck({ ...base, name: "X-tudo grande" }, p, products(), menus), { ok: true, patch: { name: "X-tudo grande" } });
  assert.deepEqual(dishEditCheck({ ...base, description: "Só pão e carne" }, p, products(), menus), { ok: true, patch: { description: "Só pão e carne" } });
  assert.deepEqual(dishEditCheck({ ...base, menuId: "m2" }, p, products(), menus), { ok: true, patch: { menuId: "m2" } });
  assert.deepEqual(dishEditCheck({ ...base, price: "R$ 30", name: "X-tudo", menuId: "m2" }, p, products(), menus), { ok: true, patch: { price: 30, menuId: "m2" } });
});

test("apagar o texto do prato manda texto vazio (limpar é mudar); espaços a mais não contam como mudança", () => {
  const p = products()[0];
  const base = formOfDish(p, menus);
  assert.deepEqual(dishEditCheck({ ...base, description: "" }, p, products(), menus), { ok: true, patch: { description: "" } });
  assert.deepEqual(dishEditCheck({ ...base, description: "  Pão,   carne, ovo e queijo " }, p, products(), menus), { ok: true, patch: {} });
});

test("o nome só vai se o texto mudou: nome salvo em minúscula não é consertado sem ninguém pedir", () => {
  const p = dish("p9", "x-burguer da casa", 20);
  const out = dishEditCheck({ ...formOfDish(p, menus), price: "21" }, p, [p], menus);
  assert.deepEqual(out, { ok: true, patch: { price: 21 } }, "só o preço");
  const renamed = dishEditCheck({ ...formOfDish(p, menus), name: "x-burguer  da  casa " }, p, [p], menus);
  assert.deepEqual(renamed, { ok: true, patch: {} }, "espaços a mais não renomeiam");
  const real = dishEditCheck({ ...formOfDish(p, menus), name: "x-burguer duplo" }, p, [p], menus);
  assert.deepEqual(real, { ok: true, patch: { name: "X-burguer duplo" } }, "nome mudado sai limpo, com inicial maiúscula");
});

test("nome vazio e preço ruim barram antes do servidor (zero e texto também)", () => {
  const p = products()[0];
  const base = formOfDish(p, menus);
  assert.deepEqual(dishEditCheck({ ...base, name: "   " }, p, products(), menus), { ok: false, problem: "name" });
  for (const price of ["", "0", "0,00", "abc", "-5", "12,345", "100000"]) {
    assert.deepEqual(dishEditCheck({ ...base, price }, p, products(), menus), { ok: false, problem: "price" }, price);
  }
});

test("repetido: o prato não conta contra si mesmo; mudar para o nome de outro na mesma categoria barra; em outra categoria passa", () => {
  const p = products()[0];
  const base = formOfDish(p, menus);
  assert.deepEqual(dishEditCheck({ ...base, name: "x-TUDO" }, p, products(), menus), { ok: true, patch: { name: "X-TUDO" } }, "mudar só a caixa é mudança pedida, e o prato não barra a si mesmo");
  assert.deepEqual(dishEditCheck({ ...base, name: "X-salada" }, p, products(), menus), { ok: false, problem: "twice" });
  assert.deepEqual(dishEditCheck({ ...base, name: "x-sálada" }, p, products(), menus), { ok: false, problem: "twice" }, "acento e maiúscula não diferenciam");
  assert.deepEqual(dishEditCheck({ ...base, name: "X-salada", menuId: "m2" }, p, products(), menus), { ok: true, patch: { name: "X-salada", menuId: "m2" } });
  // mudar de categoria para onde já existe o mesmo nome
  const clash = [p, dish("q", "X-tudo", 5, { menu_id: "m2" })];
  assert.deepEqual(dishEditCheck({ ...base, menuId: "m2" }, p, clash, menus), { ok: false, problem: "twice" });
});

test("mudar só o preço nunca é barrado por um repetido que já existia", () => {
  const twins = [dish("a", "Suco", 5), dish("b", "Suco", 6)];
  const out = dishEditCheck({ ...formOfDish(twins[0], menus), price: "5,50" }, twins[0], twins, menus);
  assert.deepEqual(out, { ok: true, patch: { price: 5.5 } });
});

test("prato de categoria desligada: abrir e salvar sem mexer na categoria não manda categoria", () => {
  const p = dish("p9", "Brinde", 1, { menu_id: "apagada" });
  const base = formOfDish(p, menus);
  assert.deepEqual(dishEditCheck({ ...base, price: "2" }, p, [p], menus), { ok: true, patch: { price: 2 } });
  assert.deepEqual(dishEditCheck({ ...base, menuId: "m2" }, p, [p], menus), { ok: true, patch: { menuId: "m2" } });
});

test("tirar a categoria (Sem categoria) manda null", () => {
  const p = products()[0];
  assert.deepEqual(dishEditCheck({ ...formOfDish(p, menus), menuId: "" }, p, products(), menus), { ok: true, patch: { menuId: null } });
});

test("a lista com o prato mudado: só ele muda, só os campos do patch, a lista de origem fica como estava", () => {
  const list = products();
  const next = withEdit(list, "p1", { price: 27.5, menuId: "m2" });
  assert.equal(next[0].price, 27.5);
  assert.equal(next[0].menu_id, "m2");
  assert.equal(next[0].name, "X-tudo");
  assert.equal(next[0].description, "Pão, carne, ovo e queijo");
  assert.deepEqual(next.slice(1), list.slice(1));
  assert.equal(list[0].price, "25.00", "a lista de origem não mudou");
  assert.equal(withEdit(list, "p1", { description: "" })[0].description, "");
  assert.equal(withEdit(list, "p1", { menuId: null })[0].menu_id, null);
  assert.equal(withEdit(list, "nao-existe", { price: 1 }).length, list.length);
});

test("a vista marca o prato que está sendo mudado (e só para quem pode mudar)", () => {
  const rowsOf = (v) => v.lists.flatMap((list) => list.sections.flatMap((section) => section.rows));
  assert.deepEqual(rowsOf(view({ editing: "p2" })).filter((row) => row.editing).map((row) => row.id), ["p2"]);
  assert.equal(rowsOf(view()).some((row) => row.editing), false);
  assert.equal(rowsOf(view({ editing: "p2", canManage: false })).some((row) => row.editing), false, "a cozinha não muda prato");
});

// ------------------------------------------------------------------------------------------------ categorias

const cats = (extra = {}) => categoriesViewOf({ menus, products: products(), armed: null, error: "", notice: "", ...extra });

test("a lista de categorias diz quantos pratos cada uma tem (singular, plural e nenhum)", () => {
  const v = cats({ products: [dish("a", "A", 1), dish("b", "B", 1, { menu_id: "m2" }), dish("c", "C", 1, { menu_id: "m2" })], menus: [...menus, { id: "m3", name: "Sobremesas" }] });
  assert.deepEqual(v.rows.map((r) => [r.name, r.count]), [["Lanches", "1 prato"], ["Bebidas", "2 pratos"], ["Sobremesas", "Nenhum prato"]]);
  assert.equal(v.sub, "3 categorias");
  assert.equal(cats({ menus: [menus[0]] }).sub, "1 categoria");
});

test("a lixeira da categoria arma só a tocada; sem categorias, o convite para criar; abrindo, não diz que está vazio", () => {
  assert.deepEqual(cats({ armed: "m2" }).rows.map((r) => r.armed), [false, true]);
  const none = cats({ menus: [] });
  assert.equal(none.sub, "Nenhuma categoria ainda");
  assert.match(none.empty, /Pratos, Bebidas ou Sobremesas/);
  const loading = categoriesViewOf({ menus: null, products: null, armed: null, error: "", notice: "" });
  assert.equal(loading.loading, true);
  assert.equal(loading.sub, "Abrindo as categorias…");
  assert.equal(loading.empty, "");
  assert.equal(categoriesViewOf({ menus: null, products: null, armed: null, error: "Sem sinal.", notice: "" }).sub, "");
  assert.equal(categoriesViewOf({ menus, products: null, armed: null, error: "", notice: "" }).loading, true, "sem os pratos ainda não dá para contar");
});

test("categoria nova: nome limpo e com inicial maiúscula, vazio não vale, repetido não vale", () => {
  assert.deepEqual(categoryCheck("  sobremesas  ", menus), { ok: true, name: "Sobremesas" });
  assert.deepEqual(categoryCheck("   ", menus), { ok: false, problem: "name" });
  assert.deepEqual(categoryCheck("BEBIDAS", menus), { ok: false, problem: "twice" });
  assert.deepEqual(categoryCheck("bebídas", menus), { ok: false, problem: "twice" }, "sem olhar o acento");
  assert.equal(categoryProblemText(""), "");
  assert.equal(categoryProblemText("name"), "Escreva o nome da categoria.");
  assert.equal(categoryProblemText("twice"), "Essa categoria já existe.");
});

test("o erro e o aviso passam como vieram e a lista que já carregou não some por causa de um erro", () => {
  const v = view({ error: "Sem sinal. Tente de novo.", notice: "ok" });
  assert.equal(v.error, "Sem sinal. Tente de novo.");
  assert.equal(v.notice, "ok");
  assert.equal(v.lists.length, 2);
  const c = cats({ error: "x", notice: "y" });
  assert.equal(c.rows.length, 2);
});

// ------------------------------------------------------------------------------------------------ avisos e erros

test("as frases de feito dizem o nome", () => {
  assert.equal(dishAddedText("Pizza"), "Pizza adicionado.");
  assert.equal(dishRemovedText("Pizza"), "Pizza removido.");
  assert.equal(dishSavedText("Pizza"), "Pizza salvo.");
  assert.equal(categoryAddedText("Bebidas"), "Bebidas adicionada.");
  assert.equal(categoryRemovedText("Bebidas"), "Bebidas removida.");
});

test("erro de quem fez algo errado (4xx) passa com a frase do servidor; erro do servidor (5xx) e falta de sinal usam a nossa", () => {
  const http = (message, status) => Object.assign(new Error(message), { status });
  assert.equal(wordsOf(http("Categoria invalida", 400), "nossa"), "Categoria invalida");
  assert.equal(wordsOf(http("Produto nao encontrado", 404), "nossa"), "Produto nao encontrado");
  assert.equal(wordsOf(http("Erro ao deletar produto", 500), "nossa"), "nossa");
  assert.equal(wordsOf(http("", 400), "nossa"), "nossa", "sem frase do servidor, a nossa");
  assert.equal(wordsOf(new TypeError("Failed to fetch"), "nossa"), "nossa", "sem sinal");
  assert.equal(wordsOf("estranho", "nossa"), "nossa");
  assert.equal(wordsOf(null, "nossa"), "nossa");
});
