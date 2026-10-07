import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenMenu } from "../../frontend/src/assistant/spokenMenu.ts";
import { priceDoubt } from "../../frontend/src/assistant/priceCheck.ts";
import { spokenFeedback } from "../../frontend/src/assistant/assistantPrompts.ts";

const dishes = (text) => parseSpokenMenu(text).dishes.map((dish) => `${dish.name}|${dish.price}`);

/* The owner's first real test on a phone (07/10/2026): talk became dishes and "3,00" became R$ 300. */

test("talk before a dish is not part of its name", () => {
  assert.deepEqual(dishes("vamos lá x-tudo 25 reais"), ["X-Tudo|25.00"]);
  assert.deepEqual(dishes("vamos lá, x-tudo 25"), ["X-Tudo|25.00"]);
  assert.deepEqual(dishes("vou falar o x-salada 22"), ["X-Salada|22.00"]);
  assert.deepEqual(dishes("bora x-bacon 28"), ["X-Bacon|28.00"]);
  assert.deepEqual(dishes("o próximo é coca lata 6"), ["Coca lata|6.00"]);
  assert.deepEqual(dishes("vamos fazer o x-tudo 25"), ["X-Tudo|25.00"]);
});

test("talk with a number and no dish is not a dish", () => {
  assert.deepEqual(dishes("vamos fazer 55"), []);
  assert.deepEqual(dishes("agora vamos lá 40"), []);
});

test("talk about a price ('unidade se for o combo') is not a dish", () => {
  assert.deepEqual(dishes("unidade se for o combo 3 reais"), []);
  assert.deepEqual(dishes("se for o combo 3 reais"), []);
});

test("the whole recital in one go, with or without commas, keeps only the real dishes", () => {
  const withCommas = "Vamos lá x-tudo 25, unidade se for o combo 3, vamos fazer 55, coca lata 3,00";
  const plain = "vamos lá x-tudo 25 unidade se for o combo 3 vamos fazer 55 coca lata 3";
  assert.deepEqual(dishes(withCommas), ["X-Tudo|25.00", "Coca lata|3.00"]);
  assert.deepEqual(dishes(plain), ["X-Tudo|25.00", "Coca lata|3.00"]);
});

test("a dictation with several dishes and a heading still reads every dish", () => {
  assert.deepEqual(
    dishes("vamos lá x-tudo 25 vamos fazer x-salada 22 de bebida coca lata 6 guaraná 5"),
    ["X-Tudo|25.00", "X-Salada|22.00", "Coca lata|6.00", "Guaraná|5.00"]
  );
});

test("what already worked keeps working: units and measures inside a name", () => {
  assert.deepEqual(dishes("coca 2 litros 12 fanta 2 unidades 9"), ["Coca 2 litros|12.00", "Fanta 2 unidades|9.00"]);
  assert.deepEqual(dishes("hot roll 10 unidades 35"), ["Hot roll 10 unidades|35.00"]);
  assert.deepEqual(dishes("pizza de 8 pedaços 40"), ["Pizza de 8 pedaços|40.00"]);
});

test("ordinary names are left as said", () => {
  assert.deepEqual(dishes("pastel de carne 8"), ["Pastel de carne|8.00"]);
  assert.deepEqual(dishes("x-tudo 25 coca lata 6"), ["X-Tudo|25.00", "Coca lata|6.00"]);
});

/* ------------------------------------------------------------- price check */

test("a believable price is left alone", () => {
  assert.equal(priceDoubt("Coca lata", "6.00"), null);
  assert.equal(priceDoubt("X-Tudo", "25.00"), null);
  assert.equal(priceDoubt("Pizza grande", "95.00"), null);
  assert.equal(priceDoubt("Combinado 20 peças", "180.00"), null);
  assert.equal(priceDoubt("Cerveja long neck", "12.00"), null);
});

test("R$ 300 on a canned soda is doubted, and 3,00 is offered as what it may have been", () => {
  assert.deepEqual(priceDoubt("Coca lata", "300.00"), { maybe: "3.00" });
  assert.deepEqual(priceDoubt("Guaraná", "500.00"), { maybe: "5.00" });
});

test("a high price that is not a lost comma is doubted without a guess", () => {
  assert.deepEqual(priceDoubt("Coca lata", "135.00"), { maybe: null });
  assert.deepEqual(priceDoubt("X-Tudo", "350.00"), { maybe: null });
});

test("no price or a nonsense price is not doubted", () => {
  assert.equal(priceDoubt("Coca lata", ""), null);
  assert.equal(priceDoubt("Coca lata", "abc"), null);
  assert.equal(priceDoubt("Coca lata", "0.00"), null);
});

test("the assistant says it out loud when a price looks off, and never changes it", () => {
  const said = spokenFeedback({
    added: [
      { name: "X-Tudo", price: "25.00" },
      { name: "Coca lata", price: "300.00" },
    ],
    priced: [],
  });
  assert.match(said, /Confira o preço de Coca lata: 300 reais\./);
  assert.match(said, /Era 3 reais\?/);
  assert.match(said, /Para corrigir, diga o nome e o preço\./);
});

test("nothing is added to the feedback when every price is believable", () => {
  const said = spokenFeedback({ added: [{ name: "Coca lata", price: "6.00" }], priced: [] });
  assert.doesNotMatch(said, /Confira/);
  assert.equal(said, "Anotei Coca lata, 6 reais.");
});
