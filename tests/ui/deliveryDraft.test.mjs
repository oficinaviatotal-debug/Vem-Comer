import test from "node:test";
import assert from "node:assert/strict";

import {
  LIMITS,
  blankZone,
  formatCeps,
  fromApi,
  mergeZones,
  moneyToInput,
  parseCeps,
  parseMoneyCents,
  sameName,
  sentence,
  summaryBadge,
  toPayload,
  validate,
  zoneFrom,
} from "../../frontend/src/service/deliveryDraft.ts";

const api = {
  accepts_pickup: true,
  delivery_paused: false,
  zones: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Centro", cep_prefixes: ["30110", "30120"], fee: "5.00", min_order: "20.00", eta_minutes: 40, active: true },
    { id: "22222222-2222-4222-8222-222222222222", name: "Norte", cep_prefixes: ["31000"], fee: "0.00", min_order: "0.00", eta_minutes: null, active: false },
  ],
};

test("the server list becomes what the owner sees and back, without losing ids", () => {
  const draft = fromApi(api);
  assert.equal(draft.zones[0].ceps, "30110, 30120");
  assert.equal(draft.zones[0].fee, "5,00");
  assert.equal(draft.zones[0].minOrder, "20,00");
  assert.equal(draft.zones[0].eta, "40");
  assert.equal(draft.zones[1].fee, "");
  assert.equal(draft.zones[1].active, false);

  const payload = toPayload(draft);
  assert.deepEqual(payload, {
    accepts_pickup: true,
    delivery_paused: false,
    zones: [
      { id: api.zones[0].id, name: "Centro", cep_prefixes: ["30110", "30120"], fee: "5.00", min_order: "20.00", eta_minutes: 40, active: true },
      { id: api.zones[1].id, name: "Norte", cep_prefixes: ["31000"], fee: "0.00", min_order: "0.00", eta_minutes: null, active: false },
    ],
  });
});

test("a server that answers with nothing gives an empty, valid screen", () => {
  for (const empty of [null, undefined, {}, { zones: null }]) {
    const draft = fromApi(empty);
    assert.deepEqual(draft.zones, []);
    assert.equal(draft.acceptsPickup, true);
    assert.equal(draft.paused, false);
    assert.deepEqual(validate(draft), []);
  }
});

test("money reads like the owner types it", () => {
  assert.equal(parseMoneyCents("5", 99999), 500);
  assert.equal(parseMoneyCents("5,5", 99999), 550);
  assert.equal(parseMoneyCents("R$ 5,50", 99999), 550);
  assert.equal(parseMoneyCents("1.234,50", 999999), 123450);
  assert.equal(parseMoneyCents("", 99999), 0);
  assert.equal(parseMoneyCents("abc", 99999), null);
  assert.equal(parseMoneyCents("5,555", 99999), null);
  assert.equal(parseMoneyCents("-3", 99999), null);
  assert.equal(parseMoneyCents("1000", 99999), null, "above the maximum fee");
  assert.equal(moneyToInput("5.00"), "5,00");
  assert.equal(moneyToInput("0.00"), "");
  assert.equal(moneyToInput(null), "");
});

test("CEP starts: dots, dashes, commas and repeats", () => {
  assert.deepEqual(parseCeps("30110, 30120"), { prefixes: ["30110", "30120"], bad: [] });
  assert.deepEqual(parseCeps("30.110 30110-000;31000"), { prefixes: ["30110", "30110000", "31000"], bad: [] });
  assert.deepEqual(parseCeps("30110 30110"), { prefixes: ["30110"], bad: [] });
  assert.deepEqual(parseCeps("30, abc"), { prefixes: [], bad: ["30", "abc"] });
  assert.deepEqual(parseCeps("123456789"), { prefixes: [], bad: ["123456789"] });
  assert.equal(formatCeps(["30110", "30120"]), "30110, 30120");
});

test("names are the same with other case, accents and spaces", () => {
  assert.ok(sameName("Vila  Nova", "vila nova"));
  assert.ok(sameName("São Lucas", "sao lucas"));
  assert.ok(!sameName("Norte", "Sul"));
});

test("a good list has nothing wrong", () => {
  assert.deepEqual(validate(fromApi(api)), []);
});

test("what is wrong is said in words, region by region", () => {
  const bad = fromApi(api);
  bad.zones[0].fee = "cinco";
  bad.zones[0].minOrder = "12,345";
  bad.zones[0].eta = "2";
  bad.zones[1].ceps = "";
  const text = validate(bad).join("\n");
  assert.match(text, /Centro: taxa inválida/);
  assert.match(text, /Centro: pedido mínimo inválido/);
  assert.match(text, /Centro: o prazo é em minutos, entre 5 e 240/);
  assert.match(text, /Norte: escreva o começo dos CEPs/);
});

test("a region without a name, a repeated name and a too long name are refused", () => {
  const draft = fromApi(api);
  draft.zones.push({ ...blankZone(), ceps: "32000" });
  draft.zones.push({ ...blankZone(), name: "centro", ceps: "32100" });
  draft.zones.push({ ...blankZone(), name: "x".repeat(LIMITS.name + 1), ceps: "32200" });
  const text = validate(draft).join("\n");
  assert.match(text, /Região 3: escreva o nome/);
  assert.match(text, /Duas regiões com o nome centro/);
  assert.match(text, /use até 60 letras/);
});

test("a piece that is not a CEP is named; too many regions are refused", () => {
  const draft = fromApi(api);
  draft.zones[0].ceps = "30110, perto";
  assert.match(validate(draft).join("\n"), /"perto" não é o começo de um CEP/);

  const many = fromApi({ zones: [] });
  for (let n = 0; n < LIMITS.zones + 1; n += 1) many.zones.push({ ...blankZone(), name: `R${n}`, ceps: `3${String(n).padStart(4, "0")}` });
  assert.match(validate(many).join("\n"), /no máximo 20 regiões/);
});

test("the sentence says what the customer will be told", () => {
  const draft = fromApi(api);
  assert.equal(sentence(draft.zones[0]), "CEP começando em 30110, 30120. Taxa de R$ 5,00. Pedido mínimo de R$ 20,00. Prazo de 40 minutos.");
  assert.equal(sentence(draft.zones[1]), "CEP começando em 31000. Entrega grátis. Sem pedido mínimo. Desligada: o cliente não vê.");
  assert.match(sentence(blankZone()), /Falta dizer os CEPs/);
});

test("the badge for the tab", () => {
  assert.equal(summaryBadge({ paused: false, zones: [] }), "Sem entrega");
  const one = fromApi({ zones: [api.zones[0]] });
  assert.equal(summaryBadge(one), "1 região");
  assert.equal(summaryBadge({ ...one, paused: true }), "Entrega pausada");
  assert.equal(summaryBadge(fromApi({ zones: [api.zones[1]] })), "Sem entrega", "a region turned off is no delivery");
  assert.equal(summaryBadge(fromApi({ zones: [api.zones[0], { ...api.zones[1], active: true }] })), "2 regiões");
});

test("what was said updates the same region and adds the new ones", () => {
  const draft = fromApi(api);
  const merged = mergeZones(draft.zones, [
    { name: "centro", feeCents: 700 },
    { name: "Sul", prefixes: ["32000"], feeCents: 900, eta: 50 },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, api.zones[0].id, "same region keeps its id");
  assert.equal(merged[0].fee, "7,00");
  assert.equal(merged[0].ceps, "30110, 30120", "what was not said stays");
  assert.equal(merged[0].minOrder, "20,00");
  assert.equal(merged[2].name, "Sul");
  assert.equal(merged[2].eta, "50");
  assert.equal(draft.zones[0].fee, "5,00", "the original list is not changed");
});

test("said CEPs replace the old ones; said free fee clears the field", () => {
  const draft = fromApi(api);
  const merged = mergeZones(draft.zones, [{ name: "Centro", prefixes: ["30199"], feeCents: 0, minCents: 0 }]);
  assert.equal(merged[0].ceps, "30199");
  assert.equal(merged[0].fee, "");
  assert.equal(merged[0].minOrder, "");
});

test("saying regions never goes past the limit", () => {
  let zones = [];
  const said = Array.from({ length: LIMITS.zones + 5 }, (_, n) => ({ name: `R${n}`, prefixes: [`3${String(n).padStart(4, "0")}`] }));
  zones = mergeZones(zones, said);
  assert.equal(zones.length, LIMITS.zones);
  assert.equal(zoneFrom({ name: "A", prefixes: ["30110"], feeCents: 550, minCents: 2000, eta: 30 }).fee, "5,50");
});

test("a said region that is saved reads as valid", () => {
  const zones = mergeZones([], [{ name: "Centro", prefixes: ["30110"], feeCents: 500, minCents: 2000, eta: 40 }]);
  const draft = { acceptsPickup: true, paused: false, zones };
  assert.deepEqual(validate(draft), []);
  assert.deepEqual(toPayload(draft).zones[0], {
    name: "Centro",
    cep_prefixes: ["30110"],
    fee: "5.00",
    min_order: "20.00",
    eta_minutes: 40,
    active: true,
  });
});
