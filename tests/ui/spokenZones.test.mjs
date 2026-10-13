import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenZones } from "../../frontend/src/service/spokenZones.ts";
import { mergeZones, validate } from "../../frontend/src/service/deliveryDraft.ts";

const say = (text, known) => parseSpokenZones(text, known);

test("two regions said in one breath", () => {
  const out = say("Centro, taxa 5 reais, CEP 30110 e 30120, pedido mínimo 20, prazo 40 minutos. Norte, taxa 8, CEP 31000.");
  assert.deepEqual(out.zones, [
    { name: "Centro", prefixes: ["30110", "30120"], feeCents: 500, minCents: 2000, eta: 40 },
    { name: "Norte", prefixes: ["31000"], feeCents: 800 },
  ]);
  assert.deepEqual(out.lines, [
    "Centro: CEP 30110, 30120 · taxa R$ 5,00 · mínimo R$ 20,00 · 40 min",
    "Norte: CEP 31000 · taxa R$ 8,00",
  ]);
  assert.deepEqual(out.notes, []);
});

test("without full stops the next name starts the next region", () => {
  const out = say("Savassi taxa 6 cep 30140 Funcionários taxa 7 cep 30130 Lourdes taxa 8 cep 30180");
  assert.deepEqual(out.zones.map((z) => z.name), ["Savassi", "Funcionários", "Lourdes"]);
  assert.deepEqual(out.zones.map((z) => z.feeCents), [600, 700, 800]);
});

test("talk before the name is dropped", () => {
  const out = say("eu entrego no centro por 5 reais, cep 30.110 e 30120, mínimo de 20 reais, em 40 minutos");
  assert.deepEqual(out.zones, [{ name: "Centro", prefixes: ["30110", "30120"], feeCents: 500, minCents: 2000, eta: 40 }]);
  assert.equal(say("bairro Savassi taxa 5 cep 30140").zones[0].name, "Savassi");
  assert.equal(say("nova região Centro taxa 6 CEP 30110").zones[0].name, "Centro");
});

test("names that look like filler stay (Nova Lima, Cidade Nova, Zona Sul)", () => {
  const names = say("Nova Lima taxa 15 CEP 34000. Cidade Nova taxa 9 cep 31170. Zona Sul taxa 12 cep 30140").zones.map((z) => z.name);
  assert.deepEqual(names, ["Nova Lima", "Cidade Nova", "Zona Sul"]);
});

test("a connective before the keyword does not stay in the name", () => {
  assert.equal(say("Centro pedido mínimo 20 taxa 5 cep 30110").zones[0].name, "Centro");
  assert.equal(say("Centro a partir de 20 reais taxa 5 cep 30110").zones[0].name, "Centro");
});

test("money in words and in cents", () => {
  const out = say("Savassi taxa cinco e cinquenta cep 30140 mínimo vinte e cinco reais");
  assert.equal(out.zones[0].feeCents, 550);
  assert.equal(out.zones[0].minCents, 2500);
  assert.equal(say("Centro taxa 5,50 cep 30110").zones[0].feeCents, 550);
  assert.equal(say("Centro taxa R$ 6 cep 30110").zones[0].feeCents, 600);
  assert.equal(say("Centro frete cinco e meio cep 30110").zones[0].feeCents, 550);
  assert.equal(say("Centro taxa um real e cinquenta cep 30110").zones[0].feeCents, 150);
});

test("free delivery and no minimum", () => {
  const out = say("Centro grátis sem mínimo cep 30110");
  assert.equal(out.zones[0].feeCents, 0);
  assert.equal(out.zones[0].minCents, 0);
  assert.equal(say("Centro sem taxa cep 30110").zones[0].feeCents, 0);
  assert.equal(say("Centro taxa zero cep 30110").zones[0].feeCents, 0);
  assert.match(say("Centro entrega grátis cep 30110").lines[0], /entrega grátis/);
});

test("time: minutes, half an hour, an hour and a half, a bare number after prazo", () => {
  assert.equal(say("Centro cep 30110 taxa 5 em 40 minutos").zones[0].eta, 40);
  assert.equal(say("Centro cep 30110 meia hora").zones[0].eta, 30);
  assert.equal(say("Centro cep 30110 uma hora e meia").zones[0].eta, 90);
  assert.equal(say("Centro cep 30110 2 horas").zones[0].eta, 120);
  assert.equal(say("Centro cep 30110 prazo 45").zones[0].eta, 45);
  assert.equal(say("Centro cep 30110 quarenta e cinco minutos").zones[0].eta, 45);
});

test("the minutes are not read as cents of the fee", () => {
  const out = say("Centro taxa 5 40 minutos cep 30110");
  assert.equal(out.zones[0].feeCents, 500);
  assert.equal(out.zones[0].eta, 40);
  const other = say("Zona Sul, frete 12 reais, CEP 30.140-071, a partir de 40 reais, 50 minutos. só isso");
  assert.deepEqual(other.zones, [{ name: "Zona Sul", prefixes: ["30140071"], feeCents: 1200, minCents: 4000, eta: 50 }]);
});

test("CEPs with dots, dashes and a list", () => {
  assert.deepEqual(say("Centro taxa 5 cep 30.110, 30.120 e 30130-000").zones[0].prefixes, ["30110", "30120", "30130000"]);
  assert.deepEqual(say("Centro taxa 5 30110 30120").zones[0].prefixes, ["30110", "30120"], "numbers without the word CEP");
  assert.deepEqual(say("Centro taxa 5 cep 30110 e 30110").zones[0].prefixes, ["30110"]);
});

test("a number with no word before it is said, not guessed", () => {
  const out = say("Centro taxa 5 cep 30110 e 7");
  assert.match(out.notes.join(" "), /número "7"/);
  assert.equal(out.zones[0].feeCents, 500);
});

test("a keyword with no value is said", () => {
  const out = say("Centro cep 30110 taxa");
  assert.match(out.notes.join(" "), /não ouvi o valor/);
  assert.match(say("Centro taxa 5 cep").notes.join(" "), /não ouvi os números/);
});

test("a value over the limit is left empty and said", () => {
  const out = say("Centro cep 30110 taxa 5000");
  assert.equal(out.zones[0].feeCents, undefined);
  assert.match(out.notes.join(" "), /passa do máximo/);
});

test("an attribute before any name has nowhere to go", () => {
  const out = say("taxa 5 40 minutos");
  assert.deepEqual(out.zones, []);
  assert.match(out.notes.join(" "), /antes do nome/);
});

test("talk with no data is not a region", () => {
  const out = say("não faço retirada");
  assert.deepEqual(out.zones, []);
  assert.match(out.notes.join(" "), /Não usei/);
  assert.deepEqual(say("").zones, []);
  assert.deepEqual(say("   ").notes, []);
});

test("a new region without CEP or fee is flagged; a known one is not", () => {
  const fresh = say("Norte cep 31000");
  assert.match(fresh.notes.join(" "), /Norte: não ouvi a taxa/);
  const withoutCep = say("Norte taxa 8");
  assert.match(withoutCep.notes.join(" "), /Norte: não ouvi os CEPs/);
  const known = say("norte taxa 9", ["Norte"]);
  assert.deepEqual(known.notes, []);
});

test("the closing words end the reading", () => {
  const out = say("Centro taxa 5 cep 30110 só isso Norte taxa 8 cep 31000");
  assert.deepEqual(out.zones.map((z) => z.name), ["Centro"]);
});

test("words like 'uma' before the name are not numbers", () => {
  const out = say("uma região chamada Centro taxa 5 cep 30110");
  assert.equal(out.zones.length, 1);
  assert.deepEqual(out.notes.filter((n) => /número/.test(n)), []);
});

test("what was said fills the screen and passes the checks", () => {
  const out = say("Centro taxa 5 cep 30110 mínimo 20 prazo 40 minutos. Norte taxa 8 cep 31000");
  const zones = mergeZones([], out.zones);
  assert.deepEqual(validate({ acceptsPickup: true, paused: false, zones }), []);
});

test("regions past the limit are cut and said", () => {
  const text = Array.from({ length: 25 }, (_, n) => `Região${String.fromCharCode(65 + (n % 26))}${n} taxa 5 cep 3${String(n).padStart(4, "0")}`).join(". ");
  const out = say(text);
  assert.equal(out.zones.length, 20);
  assert.match(out.notes.join(" "), /no máximo 20 regiões/);
});
