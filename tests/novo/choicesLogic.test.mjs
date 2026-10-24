import test from "node:test";
import assert from "node:assert/strict";

import { choicesViewOf, clampQuantity, confirmChoices, nextQuantity, pressOption } from "../../frontend/src/loja/choicesLogic.ts";

const sizes = {
  id: "g-size",
  name: "Tamanho",
  min_choices: 1,
  max_choices: 1,
  items: [
    { id: "pq", name: "Pequena", price_delta: 0 },
    { id: "gr", name: "Grande", price_delta: 10 },
  ],
};
const extras = {
  id: "g-extra",
  name: "Adicionais",
  min_choices: 0,
  max_choices: 2,
  items: [
    { id: "bac", name: "Bacon", price_delta: "4.50" },
    { id: "que", name: "Queijo extra", price_delta: 3 },
    { id: "ovo", name: "Ovo", price_delta: 0 },
  ],
};
const optional = { id: "g-opt", name: "Molho", min_choices: 0, max_choices: 1, items: [{ id: "m1", name: "Alho", price_delta: 0 }] };
const pizza = { id: "p1", menu_id: "m", name: "Pizza", price: 39.9, description: "  Massa fina  ", option_groups: [sizes, extras], thumb_url: "/media/p.webp" };
const media = (path) => (path ? `https://x.test${path}` : "");
const view = (extra = {}) =>
  choicesViewOf({ product: pizza, selection: {}, note: "", quantity: 1, tried: false, editing: false, media, ...extra });

test("clampQuantity: de 1 até 50, e número estranho vira 1", () => {
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity(-3), 1);
  assert.equal(clampQuantity(Number.NaN), 1);
  assert.equal(clampQuantity(2.9), 2);
  assert.equal(clampQuantity(999), 50);
  assert.equal(clampQuantity(7), 7);
});

test("nextQuantity não passa dos limites", () => {
  assert.equal(nextQuantity(1, -1), 1);
  assert.equal(nextQuantity(1, 1), 2);
  assert.equal(nextQuantity(50, 1), 50);
  assert.equal(nextQuantity(3, -1), 2);
});

test("escolha única: tocar em outra opção troca; tocar na escolhida de novo não desmarca quando é obrigatória", () => {
  let selection = pressOption({}, pizza, "g-size", "pq");
  assert.deepEqual(selection, { "g-size": ["pq"] });
  selection = pressOption(selection, pizza, "g-size", "gr");
  assert.deepEqual(selection, { "g-size": ["gr"] });
  assert.deepEqual(pressOption(selection, pizza, "g-size", "gr"), { "g-size": ["gr"] });
});

test("escolha única opcional desmarca ao tocar de novo", () => {
  const product = { ...pizza, option_groups: [optional] };
  const on = pressOption({}, product, "g-opt", "m1");
  assert.deepEqual(on, { "g-opt": ["m1"] });
  assert.deepEqual(pressOption(on, product, "g-opt", "m1"), { "g-opt": [] });
});

test("várias escolhas: liga e desliga até o máximo e o resto não entra", () => {
  let selection = pressOption({}, pizza, "g-extra", "bac");
  selection = pressOption(selection, pizza, "g-extra", "que");
  assert.deepEqual(selection["g-extra"], ["bac", "que"]);
  assert.deepEqual(pressOption(selection, pizza, "g-extra", "ovo"), selection, "o terceiro passa do máximo de 2");
  assert.deepEqual(pressOption(selection, pizza, "g-extra", "bac")["g-extra"], ["que"]);
});

test("opção ou grupo que não existe não muda nada, e a seleção original nunca é mexida", () => {
  const selection = Object.freeze({ "g-size": Object.freeze(["pq"]) });
  assert.equal(pressOption(selection, pizza, "nao-existe", "pq"), selection);
  assert.equal(pressOption(selection, pizza, "g-size", "nao-existe"), selection);
  assert.deepEqual(pressOption(selection, pizza, "g-size", "gr"), { "g-size": ["gr"] });
});

test("o total é o preço do prato mais o que cada opção soma, vezes a quantidade, em centavos exatos", () => {
  const selection = { "g-size": ["gr"], "g-extra": ["bac", "que"] };
  assert.equal(view({ selection, quantity: 1 }).total, 57.4);
  assert.equal(view({ selection, quantity: 3 }).total, 172.2);
  assert.equal(view({ quantity: 2 }).total, 79.8, "sem escolha nenhuma, só o preço base");
});

test("a tela mostra o nome, o que é, a foto e a regra de cada grupo", () => {
  const shown = view();
  assert.equal(shown.title, "Pizza");
  assert.equal(shown.description, "Massa fina");
  assert.equal(shown.photo, "https://x.test/media/p.webp");
  assert.deepEqual(
    shown.groups.map((group) => [group.name, group.rule, group.required, group.single]),
    [
      ["Tamanho", "Escolha 1", true, true],
      ["Adicionais", "Opcional, até 2", false, false],
    ],
  );
  assert.deepEqual(shown.groups[1].items.map((item) => item.priceText), ["+ R$ 4,50", "+ R$ 3,00", ""]);
  assert.equal(view({ product: { ...pizza, description: "   ", thumb_url: null } }).description, undefined);
  assert.equal(view({ product: { ...pizza, thumb_url: null } }).photo, undefined);
});

test("grupo cheio bloqueia as outras opções, mas não a que já está marcada", () => {
  const selection = { "g-extra": ["bac", "que"] };
  const items = view({ selection }).groups[1].items;
  assert.deepEqual(items.map((item) => [item.id, item.on, item.blocked]), [
    ["bac", true, false],
    ["que", true, false],
    ["ovo", false, true],
  ]);
  const half = view({ selection: { "g-extra": ["bac"] } }).groups[1].items;
  assert.ok(half.every((item) => !item.blocked), "ainda cabe mais uma");
});

test("o que falta só aparece depois da primeira tentativa de confirmar", () => {
  assert.equal(view({ tried: false }).groups[0].problem, null);
  assert.equal(view({ tried: true }).groups[0].problem, "Escolha uma opção em Tamanho.");
  assert.equal(view({ tried: true, selection: { "g-size": ["pq"] } }).groups[0].problem, null);
  const long = "x".repeat(141);
  assert.equal(view({ tried: false, note: long }).note.problem, null);
  assert.equal(view({ tried: true, note: long }).note.problem, "A observação pode ter até 140 letras.");
});

test("a observação mostra quanto a pessoa digitou, sem limpar", () => {
  const note = view({ note: "sem   cebola " }).note;
  assert.equal(note.value, "sem   cebola ");
  assert.equal(note.count, 13);
  assert.equal(note.max, 140);
});

test("grupo obrigatório sem nenhuma opção diz que está indisponível", () => {
  const product = { ...pizza, option_groups: [{ ...sizes, items: [] }] };
  const shown = view({ product, tried: true });
  assert.equal(shown.groups[0].emptyText, "Indisponível agora.");
  assert.equal(shown.groups[0].problem, "Tamanho: indisponível agora.");
});

test("o botão diz Adicionar, ou Salvar quando muda uma linha que já está na sacola", () => {
  assert.equal(view().confirmLabel, "Adicionar");
  assert.equal(view({ editing: true }).confirmLabel, "Salvar");
});

test("os botões de quantidade sabem os limites", () => {
  assert.deepEqual([view({ quantity: 1 }).canLess, view({ quantity: 1 }).canMore], [false, true]);
  assert.deepEqual([view({ quantity: 50 }).canLess, view({ quantity: 50 }).canMore], [true, false]);
  assert.equal(view({ quantity: 0 }).quantity, 1);
});

test("confirmar sem escolher o obrigatório devolve a frase e o grupo para onde rolar", () => {
  const result = confirmChoices({ product: pizza, selection: {}, note: "", quantity: 1 });
  assert.deepEqual(result, { ok: false, problem: "Escolha uma opção em Tamanho.", groupId: "g-size" });
});

test("observação grande demais trava a confirmação sem apontar grupo, e nunca é cortada", () => {
  const result = confirmChoices({ product: pizza, selection: { "g-size": ["pq"] }, note: "x".repeat(150), quantity: 1 });
  assert.deepEqual(result, { ok: false, problem: "A observação pode ter até 140 letras.", groupId: null });
});

test("confirmar entrega as opções na ordem da tela, a observação limpa e a quantidade", () => {
  const result = confirmChoices({
    product: pizza,
    selection: { "g-extra": ["que", "bac"], "g-size": ["gr"] },
    note: "  sem   cebola ",
    quantity: 99,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.pick.options.map((option) => [option.id, option.group, option.name, option.deltaCents]), [
    ["gr", "Tamanho", "Grande", 1000],
    ["bac", "Adicionais", "Bacon", 450],
    ["que", "Adicionais", "Queijo extra", 300],
  ]);
  assert.equal(result.pick.note, "sem cebola");
  assert.equal(result.pick.quantity, 50);
});

test("prato sem escolha nenhuma confirma direto", () => {
  const plain = { id: "x", menu_id: "m", name: "Suco", price: 7 };
  const result = confirmChoices({ product: plain, selection: {}, note: "", quantity: 2 });
  assert.deepEqual(result, { ok: true, pick: { options: [], note: "", quantity: 2 } });
  assert.deepEqual(choicesViewOf({ product: plain, selection: {}, note: "", quantity: 2, tried: false, editing: false, media }).groups, []);
});
