import test from "node:test";
import assert from "node:assert/strict";

import {
  addItem,
  addStarter,
  dishOptionsLineOf,
  flipItem,
  hearOptions,
  isDirty,
  optionsHint,
  optionsViewOf,
  priceItem,
  removeGroup,
  removeItem,
  renameGroup,
  renameItem,
  savedTextOf,
  setRequired,
  snapshotOf,
  stepMax,
  stepMin,
} from "../../frontend/src/painel/optionsLogic.ts";
import { fromApi, toPayload, validate } from "../../frontend/src/service/optionsDraft.ts";
import { OPT_SAVED, OPT_SAVED_NONE, OPT_UNSAVED } from "../../frontend/src/novo/copy.ts";

const api = (extra = []) => [
  {
    id: "g1",
    name: "Tamanho",
    min_choices: 1,
    max_choices: 1,
    items: [
      { id: "i1", name: "Pequeno", price_delta: "0.00", active: true },
      { id: "i2", name: "Grande", price_delta: "6.00", active: true },
    ],
  },
  {
    id: "g2",
    name: "Adicionais",
    min_choices: 0,
    max_choices: 3,
    items: [
      { id: "i3", name: "Bacon", price_delta: "4.00", active: true },
      { id: "i4", name: "Ovo", price_delta: "2.50", active: false },
      { id: "i5", name: "Queijo", price_delta: "3.00", active: true },
    ],
  },
  ...extra,
];

const input = (over = {}) => {
  const groups = fromApi(api());
  return {
    load: "ready",
    productName: "X-tudo",
    groups,
    saved: snapshotOf(groups),
    canListen: true,
    listening: false,
    heard: "",
    said: null,
    saving: false,
    problems: [],
    notice: null,
    error: "",
    armedGroup: null,
    backArmed: false,
    ...over,
  };
};

const [tamanho, adicionais] = fromApi(api());

test("a tela mostra cada grupo com a regra em palavras e o preço como a pessoa escreve", () => {
  const view = optionsViewOf(input());
  assert.equal(view.stage, "ready");
  assert.equal(view.title, "Opções");
  assert.equal(view.sub, "X-tudo");
  assert.equal(view.groups.length, 2);
  const [size, extras] = view.groups;
  assert.equal(size.name, "Tamanho");
  assert.equal(size.sentence, "O cliente escolhe 1.");
  assert.equal(size.required, true);
  assert.deepEqual(size.items.map((item) => [item.name, item.price, item.active]), [["Pequeno", "", true], ["Grande", "6,00", true]]);
  assert.equal(extras.sentence, "O cliente pode escolher até 3, se quiser.");
  assert.equal(extras.required, false);
  assert.equal(extras.items[1].active, false, "Ovo acabou e continua na lista");
  assert.deepEqual(extras.items.map((item) => item.price), ["4,00", "2,50", "3,00"]);
});

test("recém aberto não há nada por salvar e a barra de baixo fica calada", () => {
  const view = optionsViewOf(input());
  assert.equal(view.dirty, false);
  assert.equal(view.hint, "");
});

test("sem grupo, a frase de cima diz o que fazer (com e sem microfone) e os quatro modelos aparecem", () => {
  const withMic = optionsViewOf(input({ groups: [], saved: snapshotOf([]) }));
  assert.match(withMic.intro, /Fale como o cliente escolhe, escreva ou toque em um modelo/);
  assert.equal(withMic.startersLabel, "Começar com um modelo");
  assert.deepEqual(withMic.starters.map((entry) => entry.label), ["Tamanho", "Adicionais", "Retirar", "Outro grupo"]);
  const without = optionsViewOf(input({ groups: [], saved: snapshotOf([]), canListen: false }));
  assert.ok(!/Fale/.test(without.intro) && /toque em um modelo/.test(without.intro));
  const has = optionsViewOf(input());
  assert.match(has.intro, /O preço de cada opção soma no prato/);
  assert.equal(has.startersLabel, "Pôr mais um grupo");
});

test("quando o prato já tem 8 grupos não oferece mais modelo", () => {
  let groups = [];
  for (let n = 0; n < 8; n += 1) groups = addStarter(groups, "outro");
  assert.equal(groups.length, 8);
  assert.equal(addStarter(groups, "tamanho").length, 8, "o nono não entra");
  const view = optionsViewOf(input({ groups, saved: snapshotOf(groups) }));
  assert.deepEqual(view.starters, []);
});

test("Sim e Não: obrigatório pede pelo menos 1, não deixa livre", () => {
  const free = setRequired([adicionais], adicionais.uid, true)[0];
  assert.equal(free.min, 1);
  assert.equal(free.max, 3, "o máximo não muda");
  const back = setRequired([free], free.uid, false)[0];
  assert.equal(back.min, 0);
  const keeps = setRequired([{ ...adicionais, min: 2 }], adicionais.uid, true)[0];
  assert.equal(keeps.min, 2, "já era obrigatório com 2: Sim não baixa para 1");
});

test("o 'pode escolher até' sobe e desce de um em um, sem passar do número de opções nem abaixo do mínimo", () => {
  let groups = [adicionais];
  groups = stepMax(groups, adicionais.uid, 1);
  assert.equal(groups[0].max, 3, "são 3 opções: não passa de 3");
  groups = stepMax(groups, adicionais.uid, -1);
  groups = stepMax(groups, adicionais.uid, -1);
  groups = stepMax(groups, adicionais.uid, -1);
  assert.equal(groups[0].max, 1, "não desce de 1");
  const required = setRequired([{ ...adicionais, max: 3 }], adicionais.uid, true);
  const raised = stepMin(stepMin(required, adicionais.uid, 1), adicionais.uid, 1);
  assert.equal(raised[0].min, 3);
  assert.equal(stepMax(raised, adicionais.uid, -1)[0].max, 3, "o máximo não desce abaixo do mínimo");
});

test("o 'pelo menos' só passa do máximo e só desce até 1", () => {
  const required = setRequired([adicionais], adicionais.uid, true);
  const up = stepMin(required, adicionais.uid, 1);
  assert.equal(up[0].min, 2);
  const down = stepMin(stepMin(up, adicionais.uid, -1), adicionais.uid, -1);
  assert.equal(down[0].min, 1, "0 é o Não, não é o menos");
  const view = optionsViewOf(input({ groups: up }));
  const row = view.groups[0];
  assert.deepEqual([row.canMinLess, row.canMinMore], [true, true]);
});

test("as setas da tela ficam desligadas onde não há para onde ir", () => {
  const view = optionsViewOf(input());
  const size = view.groups[0];
  assert.deepEqual([size.canLess, size.canMore], [false, true], "Tamanho: 1 escolha, e há 2 opções para subir");
  const extras = view.groups[1];
  assert.deepEqual([extras.canLess, extras.canMore], [true, false], "Adicionais: até 3 de 3 opções");
});

test("mudar nome, preço e Tem/Acabou mexe só na opção tocada", () => {
  let groups = [tamanho, adicionais];
  groups = renameGroup(groups, tamanho.uid, "Tamanho da pizza");
  groups = renameItem(groups, tamanho.uid, tamanho.items[0].uid, "Broto");
  groups = priceItem(groups, tamanho.uid, tamanho.items[0].uid, "1,5");
  groups = flipItem(groups, adicionais.uid, adicionais.items[0].uid);
  assert.equal(groups[0].name, "Tamanho da pizza");
  assert.deepEqual([groups[0].items[0].name, groups[0].items[0].price], ["Broto", "1,5"]);
  assert.equal(groups[0].items[1].name, "Grande");
  assert.equal(groups[1].items[0].active, false);
  assert.equal(groups[1].items[1].active, false, "Ovo já estava Acabou e segue assim");
  assert.equal(groups[1].items[2].active, true);
  // O id do servidor vai junto: mudar só o preço não troca a opção de quem está pedindo agora.
  assert.equal(toPayload(groups).groups[0].items[0].id, "i1");
});

test("pôr outra opção acrescenta uma vazia; tirar a última de um grupo deixa o grupo vazio e a tela avisa", () => {
  let groups = addItem([tamanho], tamanho.uid);
  assert.equal(groups[0].items.length, 3);
  assert.equal(groups[0].items[2].name, "");
  assert.ok(validate(groups).some((problem) => /escreva o nome da opção 3/.test(problem)));
  groups = removeItem(groups, tamanho.uid, groups[0].items[2].uid);
  groups = removeItem(groups, tamanho.uid, groups[0].items[1].uid);
  groups = removeItem(groups, tamanho.uid, groups[0].items[0].uid);
  assert.equal(groups[0].items.length, 0);
  assert.ok(validate(groups).some((problem) => /coloque pelo menos uma opção/.test(problem)));
  assert.equal(removeGroup(groups, tamanho.uid).length, 0);
});

test("tirar uma opção encolhe o máximo para caber (nunca fica 'até 3' com 2 opções)", () => {
  const groups = removeItem([adicionais], adicionais.uid, adicionais.items[2].uid);
  assert.equal(groups[0].max, 2);
});

test("a barra de baixo diz o que falta: salvar, ou acertar antes", () => {
  const clean = fromApi(api());
  assert.equal(optionsHint(clean, false), "");
  const changed = priceItem(clean, clean[0].uid, clean[0].items[0].uid, "1");
  assert.equal(optionsHint(changed, true), OPT_UNSAVED);
  const broken = renameItem(changed, clean[0].uid, clean[0].items[1].uid, "");
  assert.equal(optionsHint(broken, true), "Tem 1 coisa para acertar antes de salvar.");
  const twice = priceItem(broken, clean[0].uid, clean[0].items[0].uid, "abc");
  assert.equal(optionsHint(twice, true), "Tem 2 coisas para acertar antes de salvar.");
});

test("só vira 'por salvar' o que mudou de verdade; voltar ao que era desfaz", () => {
  const groups = fromApi(api());
  const saved = snapshotOf(groups);
  assert.equal(isDirty(groups, saved), false);
  const touched = priceItem(groups, groups[0].uid, groups[0].items[1].uid, "7");
  assert.equal(isDirty(touched, saved), true);
  const undone = priceItem(touched, groups[0].uid, groups[0].items[1].uid, "6,00");
  assert.equal(isDirty(undone, saved), false, "6 e 6,00 são o mesmo preço");
  assert.equal(isDirty([], saved), true, "tirar todos os grupos também é mudança");
});

test("a barra de baixo da tela vem da conta, e não aparece enquanto abre ou se falhou", () => {
  const groups = fromApi(api());
  const touched = priceItem(groups, groups[0].uid, groups[0].items[1].uid, "7");
  const ready = optionsViewOf(input({ groups: touched, saved: snapshotOf(groups) }));
  assert.equal(ready.dirty, true);
  assert.equal(ready.hint, OPT_UNSAVED);
  const loading = optionsViewOf(input({ load: "loading", groups: touched, saved: snapshotOf(groups) }));
  assert.equal(loading.dirty, false);
  assert.equal(loading.live, "Abrindo as opções…");
  const failed = optionsViewOf(input({ load: "error", groups: [], saved: "", error: "Prato não encontrado." }));
  assert.equal(failed.stage, "error");
  assert.equal(failed.live, "Prato não encontrado.", "a frase do servidor passa como veio");
});

test("o texto de depois de salvar conta a verdade: com opções ou sem", () => {
  assert.equal(savedTextOf(2), OPT_SAVED);
  assert.equal(savedTextOf(0), OPT_SAVED_NONE);
});

test("a lixeira do grupo e o Voltar mostram quando já receberam o primeiro toque", () => {
  const base = input();
  const view = optionsViewOf({ ...base, armedGroup: base.groups[1].uid, backArmed: true });
  assert.deepEqual(view.groups.map((group) => group.armed), [false, true]);
  assert.equal(view.backArmed, true);
});

test("a opção sem nome é chamada de 'opção N' pelo leitor de tela", () => {
  const groups = addItem([tamanho], tamanho.uid);
  const view = optionsViewOf(input({ groups }));
  assert.equal(view.groups[0].items[2].spoken, "opção 3");
  assert.equal(view.groups[0].items[0].spoken, "Pequeno");
});

// ------------------------------------------------------------------------------------------------ falar ou escrever

test("falar a frase inteira monta tamanho, adicionais e retirar, sem salvar", () => {
  const out = hearOptions([], "tamanho pequeno, médio mais 5, grande mais 10. adicionais bacon 4, ovo 2 e meio. sem cebola", 2850);
  assert.deepEqual(out.groups.map((group) => group.name), ["Tamanho", "Adicionais", "Retirar"]);
  assert.deepEqual(out.groups[0].items.map((item) => [item.name, item.price]), [["Pequeno", ""], ["Médio", "5,00"], ["Grande", "10,00"]]);
  assert.equal(out.heard.lines[0], "Tamanho: Pequeno, Médio (+ R$ 5,00), Grande (+ R$ 10,00)");
  assert.equal(out.heard.unclear, "");
  assert.equal(isDirty(out.groups, snapshotOf([])), true, "ainda não foi salvo");
});

test("o que é falado junta com o que já estava na tela: grupo de mesmo nome recebe as opções que não tinha", () => {
  const groups = fromApi(api());
  const out = hearOptions(groups, "adicionais presunto 3", 2850);
  assert.equal(out.groups.length, 2);
  const extras = out.groups[1];
  assert.deepEqual(extras.items.map((item) => item.name), ["Bacon", "Ovo", "Queijo", "Presunto"]);
  assert.equal(extras.items[1].active, false, "Ovo continua Acabou");
});

test("não entendeu: a lista fica como estava e a frase diz como falar", () => {
  const groups = fromApi(api());
  const out = hearOptions(groups, "blá blá", 0);
  assert.equal(out.groups, groups);
  assert.match(out.heard.unclear, /^Não entendi nenhuma opção\. Fale assim: tamanho/);
  assert.deepEqual(out.heard.lines, []);
});

test("não ouviu nada: a frase diz que não ouviu, não que não entendeu", () => {
  const out = hearOptions([], "   ", 0);
  assert.match(out.heard.unclear, /^Não ouvi nada\. Fale assim/);
  assert.equal(out.heard.said, "");
});

test("um preço que o sistema não tem certeza fica vazio e a frase avisa", () => {
  const out = hearOptions([], "tamanho pequeno 20, grande 40", 2850);
  assert.equal(out.heard.notes.length, 1);
  assert.match(out.heard.notes[0], /Pequeno: ouvi R\$ 20,00, e o prato custa R\$ 28,50/);
  assert.equal(out.groups[0].items[0].price, "", "não chutou um preço");
});

test("passou do limite de grupos: o grupo que ficou de fora é dito, nunca some em silêncio", () => {
  let groups = [];
  for (let n = 0; n < 8; n += 1) groups = addStarter(groups, "outro");
  groups = groups.map((group, index) => ({ ...group, name: `Grupo ${index + 1}`, items: [{ ...group.items[0], name: "A" }] }));
  const out = hearOptions(groups, "tamanho pequeno, grande", 2850);
  assert.equal(out.groups.length, 8);
  assert.ok(out.heard.notes.some((note) => /O limite é 8 grupos por prato\. O grupo Tamanho não entrou\./.test(note)));
});

test("passou do limite de opções do grupo: a que ficou de fora é dita", () => {
  const many = fromApi([
    {
      id: "g9",
      name: "Adicionais",
      min_choices: 0,
      max_choices: 5,
      items: Array.from({ length: 30 }, (_, n) => ({ id: `i${n}`, name: `Opção ${n + 1}`, price_delta: "1.00", active: true })),
    },
  ]);
  const out = hearOptions(many, "adicionais bacon 4", 0);
  assert.equal(out.groups[0].items.length, 30);
  assert.ok(out.heard.notes.some((note) => /Em Adicionais, o limite é 30 opções\. Bacon não entrou\./.test(note)));
});

test("a frase que o leitor de tela ouve traz o que foi entendido, ou o que não foi", () => {
  const out = hearOptions([], "sem cebola", 0);
  const view = optionsViewOf(input({ groups: out.groups, saved: snapshotOf([]), said: out.heard }));
  assert.match(view.live, /^Entendi: /);
  const none = hearOptions([], "", 0);
  const silent = optionsViewOf(input({ groups: [], saved: snapshotOf([]), said: none.heard }));
  assert.match(silent.live, /^Não ouvi nada/);
  const saved = optionsViewOf(input({ notice: { ok: true, text: OPT_SAVED }, said: out.heard }));
  assert.equal(saved.live, OPT_SAVED, "o aviso de salvo fala primeiro");
});

// ------------------------------------------------------------------------------------------------ no lápis do prato

test("o lápis diz as opções que o prato tem hoje, pelo que o cardápio mandou", () => {
  assert.deepEqual(dishOptionsLineOf({}), { summary: "Sem opções. Serve para tamanho, adicional ou retirar algo.", button: "Montar as opções" });
  assert.deepEqual(dishOptionsLineOf({ option_groups: [] }).button, "Montar as opções");
  const line = dishOptionsLineOf({ option_groups: [{ id: "a", name: "Tamanho", min_choices: 1, max_choices: 1, items: [] }, { id: "b", name: "Adicionais", min_choices: 0, max_choices: 2, items: [] }] });
  assert.deepEqual(line, { summary: "2 grupos de opções: Tamanho, Adicionais.", button: "Mudar as opções" });
  const one = dishOptionsLineOf({ option_groups: [{ id: "a", name: "Tamanho", min_choices: 1, max_choices: 1, items: [] }] });
  assert.equal(one.summary, "1 grupo de opções: Tamanho.");
});
