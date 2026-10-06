import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretSpokenItems,
  matchBusinessType,
  parseAssistantCommand,
  normalizePrice,
  formatPrice,
  spokenPrice,
  stem,
} from "../../frontend/src/assistant/assistantLogic.ts";

const LANCHES = [
  "X-Burguer", "X-Salada", "X-Tudo", "Pastel de carne", "Pastel de queijo", "Pão de queijo",
  "Calabresa", "Calabresa acebolada", "Pão francês (unidade)", "Pão francês (quilo)", "Coxinha",
];

const names = (indexes) => indexes.map((i) => LANCHES[i]);

test("stem handles plurals and the -ao family", () => {
  assert.equal(stem("coxinhas"), "coxinha");
  assert.equal(stem("paes"), "pao");
  assert.equal(stem("limoes"), "limao");
  assert.equal(stem("paos"), "pao");
  assert.equal(stem("gas"), "gas");
  assert.equal(stem("bus"), "bus");
});

test("dishes of the template are recognised even when run together without commas", () => {
  const result = interpretSpokenItems("tenho x burguer x salada pastel de carne e coxinha", LANCHES);
  assert.deepEqual(names(result.matched), ["X-Burguer", "X-Salada", "Pastel de carne", "Coxinha"]);
  assert.deepEqual(result.custom, []);
  assert.deepEqual(result.unclear, []);
});

test("the recognizer's spelling slips are forgiven", () => {
  const cases = [
    ["xis burger", "X-Burguer"],
    ["X-Burguer", "X-Burguer"],
    ["coxinhas", "Coxinha"],
    ["pães de queijo", "Pão de queijo"],
    ["pastel de quejo", "Pastel de queijo"],
    ["x tudo", "X-Tudo"],
  ];
  for (const [said, expected] of cases) {
    const result = interpretSpokenItems(said, LANCHES);
    assert.deepEqual(names(result.matched), [expected], said);
    assert.deepEqual(result.custom, [], said);
  }
});

test("the longest name wins: calabresa acebolada is not also calabresa", () => {
  const result = interpretSpokenItems("calabresa acebolada", LANCHES);
  assert.deepEqual(names(result.matched), ["Calabresa acebolada"]);
  const both = interpretSpokenItems("calabresa e calabresa acebolada", LANCHES);
  assert.deepEqual(names(both.matched), ["Calabresa", "Calabresa acebolada"]);
});

test("notes in parentheses are optional only when that is not ambiguous", () => {
  // "pão francês" alone could be the unit or the kilo: do not guess, ask for a tap.
  const ambiguous = interpretSpokenItems("pão francês", LANCHES);
  assert.deepEqual(ambiguous.matched, []);
  const exact = interpretSpokenItems("pão francês unidade", LANCHES);
  assert.deepEqual(names(exact.matched), ["Pão francês (unidade)"]);

  const single = interpretSpokenItems("pão doce", ["Pão doce (fatia)"]);
  assert.deepEqual(single.matched, [0]);
});

test("what is not in the template becomes a new dish with its own accents", () => {
  const result = interpretSpokenItems("tenho coxinha e feijão tropeiro e pizza de calabresa", LANCHES);
  // "calabresa" is a template dish, so what is left of the pizza ("pizza de") is not a clean dish.
  assert.deepEqual(names(result.matched), ["Calabresa", "Coxinha"]);
  assert.deepEqual(result.custom, ["Feijão tropeiro"]);
  assert.deepEqual(result.unclear, ["pizza de"]);
});

test("commas split dishes the template does not know", () => {
  const result = interpretSpokenItems("Baião de dois, Galinha caipira, Carne de sol", []);
  assert.deepEqual(result.custom, ["Baião de dois", "Galinha caipira", "Carne de sol"]);
});

test("opening words are not part of the dish", () => {
  const cases = {
    "eu tenho feijoada": ["Feijoada"],
    "meus pratos são feijoada": ["Feijoada"],
    "minhas bebidas são suco de uva": ["Suco de uva"],
    "vendo também brigadeiro": ["Brigadeiro"],
  };
  for (const [said, expected] of Object.entries(cases)) {
    assert.deepEqual(interpretSpokenItems(said, []).custom, expected, said);
  }
});

test("a long run of words with no pause is reported, never saved as one dish", () => {
  const result = interpretSpokenItems("feijoada moqueca estrogonofe lasanha parmegiana omelete", []);
  assert.deepEqual(result.custom, []);
  assert.equal(result.unclear.length, 1);
});

test("a legitimate long name with connectors is kept; the same words without them are not", () => {
  const kept = interpretSpokenItems("suco de laranja natural sem açúcar", []);
  assert.deepEqual(kept.custom, ["Suco de laranja natural sem açúcar"]);
  const run = interpretSpokenItems("cachorro quente duplo especial grande", []);
  assert.deepEqual(run.custom, []);
  assert.deepEqual(run.unclear, ["cachorro quente duplo especial grande"]);
  // Four words without connectors are still accepted as one name.
  assert.deepEqual(interpretSpokenItems("pizza quatro queijos especial", []).custom, ["Pizza quatro queijos especial"]);
});

test("a fragment that starts with a connector is not a dish", () => {
  const result = interpretSpokenItems("coxinha de forno", LANCHES);
  assert.deepEqual(names(result.matched), ["Coxinha"]);
  assert.deepEqual(result.custom, []);
  assert.deepEqual(result.unclear, ["de forno"]);
});

test("empty or noise input gives nothing", () => {
  for (const said of ["", "   ", "...", "e", "tenho"]) {
    const result = interpretSpokenItems(said, LANCHES);
    assert.deepEqual(result, { matched: [], custom: [], unclear: [] }, JSON.stringify(said));
  }
});

test("business type: names, nicknames and plurals", () => {
  const options = [
    { id: "lanchonete", name: "Lanchonete" },
    { id: "pizzaria", name: "Pizzaria" },
    { id: "restaurante", name: "Restaurante e marmitaria" },
    { id: "bar", name: "Bar e boteco" },
    { id: "acai", name: "Açaí e sorveteria" },
    { id: "padaria", name: "Padaria e cafeteria" },
    { id: "churrasco", name: "Churrasco e espetinho" },
    { id: "japones", name: "Comida japonesa" },
  ];
  const cases = {
    "lanchonete": "lanchonete",
    "eu tenho uma pizzaria": "pizzaria",
    "marmitaria": "restaurante",
    "vendo quentinha": "restaurante",
    "boteco": "bar",
    "um bar": "bar",
    "sorveteria": "acai",
    "açaí": "acai",
    "padaria": "padaria",
    "espetinho": "churrasco",
    "sushi": "japones",
    "japonesa": "japones",
    "hamburgueria": "lanchonete",
  };
  for (const [said, id] of Object.entries(cases)) {
    assert.equal(matchBusinessType(said, options), id, said);
  }
  assert.equal(matchBusinessType("pizza e sushi", options), null);
  assert.equal(matchBusinessType("barbearia", options), null);
  assert.equal(matchBusinessType("", options), null);
  // A type added later on the server still works through its name.
  assert.equal(
    matchBusinessType("hortifruti", [...options, { id: "hortifruti", name: "Hortifruti" }]),
    "hortifruti"
  );
});

test("commands are short phrases", () => {
  const cases = {
    "pronto": "next",
    "próxima": "next",
    "já falei tudo": "next",
    "só isso": "next",
    "pular": "skip",
    "nenhum": "skip",
    "não vendo": "skip",
    "voltar": "back",
    "errei": "back",
    "repete": "repeat",
    "não entendi": "repeat",
    "cadastrar": "confirm",
    "tudo certo": "confirm",
    "sim": "confirm",
    "todos": "all",
    "não": "no",
    "": "none",
    "tenho x burguer": "none",
    "uma frase bem longa que passa de quatro palavras pronto": "none",
  };
  for (const [said, command] of Object.entries(cases)) {
    assert.equal(parseAssistantCommand(said), command, said);
  }
});

test("prices: typed values", () => {
  const good = { "18": "18.00", "18,5": "18.50", "18.50": "18.50", "R$ 18,50": "18.50", "1.234,50": "1234.50", " 7 ": "7.00" };
  for (const [input, expected] of Object.entries(good)) assert.equal(normalizePrice(input), expected, input);
  for (const bad of ["", "abc", "0", "0,00", "-5", "100000", "1,234", "18,555", "1,2,3", "R$"]) {
    assert.equal(normalizePrice(bad), null, bad);
  }
});

test("prices: how they are shown and spoken", () => {
  assert.equal(formatPrice("18.50"), "R$ 18,50");
  assert.equal(formatPrice("7"), "R$ 7,00");
  assert.equal(formatPrice("1234.5"), "R$ 1.234,50");
  assert.equal(spokenPrice("18.50"), "18 reais e 50 centavos");
  assert.equal(spokenPrice("20"), "20 reais");
  assert.equal(spokenPrice("1.00"), "1 real");
  assert.equal(spokenPrice("0.90"), "0 reais e 90 centavos");
});
