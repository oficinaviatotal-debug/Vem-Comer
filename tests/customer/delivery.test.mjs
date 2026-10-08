import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_ADDRESS,
  cepDigits,
  deliveryErrorMessage,
  deliveryProblem,
  describeAddress,
  effectiveMode,
  feeCents,
  maskCep,
  maskPhone,
  minimumProblem,
  offeredModes,
  orderExtras,
  phoneDigits,
  phoneIsValid,
  quoteLine,
  whereLabel,
} from "../../frontend/src/customer/delivery.ts";
import { createDeliveryMemory } from "../../frontend/src/customer/deliveryMemory.ts";

const info = (over = {}) => ({ pickup: true, delivery: true, paused: false, zones: [], ...over });
const ok = (over = {}) => ({ available: true, zone: "Centro", fee: "5.00", min_order: "20.00", eta_minutes: 40, ...over });
const address = (over = {}) => ({ ...EMPTY_ADDRESS, cep: "30110-000", street: "Rua das Flores", number: "120", neighborhood: "Centro", ...over });

test("what the customer may pick between", () => {
  assert.deepEqual(offeredModes(info(), false), ["retirada", "entrega"]);
  assert.deepEqual(offeredModes(info({ pickup: false }), false), ["entrega"]);
  assert.deepEqual(offeredModes(info({ delivery: false }), false), [], "no delivery: the order goes as it always did");
  assert.deepEqual(offeredModes(info({ delivery: false, paused: true }), false), []);
  assert.deepEqual(offeredModes(info(), true), [], "a table order has no delivery");
  assert.deepEqual(offeredModes(null, false), [], "could not load: old behaviour");
});

test("the selection is the choice while it is offered, else the first offer", () => {
  assert.equal(effectiveMode(null, ["retirada", "entrega"]), "retirada");
  assert.equal(effectiveMode("entrega", ["retirada", "entrega"]), "entrega");
  assert.equal(effectiveMode("retirada", ["entrega"]), "entrega", "pickup was turned off meanwhile");
  assert.equal(effectiveMode("entrega", []), null);
});

test("the top of the slip", () => {
  assert.equal(whereLabel("entrega", null), "Entrega");
  assert.equal(whereLabel("retirada", null), "Retirada");
  assert.equal(whereLabel(null, null), "Pedido");
  assert.equal(whereLabel("entrega", 4), "Mesa 4");
});

test("CEP is masked while typing and never goes past 8 digits", () => {
  assert.equal(maskCep("3011"), "3011");
  assert.equal(maskCep("301100"), "30110-0");
  assert.equal(maskCep("30110000"), "30110-000");
  assert.equal(maskCep("30.110-000 999"), "30110-000");
  assert.equal(cepDigits("30110-000"), "30110000");
});

test("phone is masked, the country code goes away, and the server rule is the same", () => {
  assert.equal(maskPhone("31999998888"), "(31) 99999-8888");
  assert.equal(maskPhone("3199999"), "(31) 9999-9");
  assert.equal(maskPhone("3133334444"), "(31) 3333-4444");
  assert.equal(maskPhone("3"), "(3");
  assert.equal(maskPhone(""), "");
  assert.equal(phoneDigits("+55 (31) 99999-8888"), "31999998888");
  assert.ok(phoneIsValid("(31) 99999-8888"));
  assert.ok(phoneIsValid("3133334444"));
  assert.ok(!phoneIsValid("31 88888-7777"), "11 digits must be a mobile starting with 9");
  assert.ok(!phoneIsValid("0199999999"), "DDD below 11");
  assert.ok(!phoneIsValid("99999"));
  assert.ok(!phoneIsValid(""));
});

test("fee and minimum come from the server's answer, never from the phone", () => {
  assert.equal(feeCents(ok()), 500);
  assert.equal(feeCents(ok({ fee: 7.5 })), 750);
  assert.equal(feeCents(ok({ fee: "0.00" })), 0);
  assert.equal(feeCents({ available: false, message: "x" }), 0);
  assert.equal(feeCents(null), 0);
});

test("the quote line says region, fee and time, or why not", () => {
  assert.equal(quoteLine(ok()), "Entregamos em Centro. Taxa de entrega R$ 5,00. Prazo de cerca de 40 min.");
  assert.equal(quoteLine(ok({ fee: "0.00", eta_minutes: null })), "Entregamos em Centro. Entrega grátis.");
  assert.equal(quoteLine({ available: false, message: "Ainda não entregamos nesse CEP." }), "Ainda não entregamos nesse CEP.");
  assert.equal(quoteLine(null), "");
});

test("the minimum order is on the dishes, and says how much is missing", () => {
  assert.equal(minimumProblem(ok(), 2000), null);
  assert.equal(minimumProblem(ok(), 2500), null);
  assert.match(minimumProblem(ok(), 1500), /pedido mínimo para Centro é R\$ 20,00. Faltam R\$ 5,00/);
  assert.equal(minimumProblem(ok({ min_order: "0.00" }), 100), null);
  assert.equal(minimumProblem({ available: false, message: "x" }, 0), null);
});

const full = (over = {}) => ({ name: "Ana", address: address(), phone: "(31) 99999-8888", quote: ok(), subtotalCents: 3000, ...over });

test("a delivery that is complete has nothing wrong", () => {
  assert.equal(deliveryProblem(full()), null);
});

test("what is missing is said, one thing at a time, in the order of the form", () => {
  assert.match(deliveryProblem(full({ name: "  " })), /nome/);
  assert.match(deliveryProblem(full({ address: address({ cep: "301" }) })), /CEP com 8 números/);
  assert.match(deliveryProblem(full({ quote: null })), /conferindo o CEP/);
  assert.match(deliveryProblem(full({ quote: null, quoteFailed: true })), /Não deu para conferir o CEP.*Tentar de novo/);
  assert.equal(deliveryProblem(full({ quote: { available: false, message: "Ainda não entregamos nesse CEP." } })), "Ainda não entregamos nesse CEP.");
  assert.match(deliveryProblem(full({ address: address({ street: "" }) })), /rua/);
  assert.match(deliveryProblem(full({ address: address({ number: " " }) })), /número/);
  assert.match(deliveryProblem(full({ address: address({ neighborhood: "" }) })), /bairro/);
  assert.match(deliveryProblem(full({ phone: "123" })), /telefone com DDD/);
  assert.match(deliveryProblem(full({ subtotalCents: 1000 })), /pedido mínimo/);
});

test("an address too long for the server is caught here", () => {
  assert.match(deliveryProblem(full({ address: address({ street: "x".repeat(121) }) })), /rua/);
  assert.match(deliveryProblem(full({ address: address({ reference: "y".repeat(121) }) })), /ponto de referência/);
});

test("what goes with the order", () => {
  assert.deepEqual(orderExtras(null, address(), "x"), {});
  assert.deepEqual(orderExtras("retirada", address(), "x"), { order_type: "retirada" });
  assert.deepEqual(orderExtras("entrega", address({ complement: " apto  3 ", city: "" }), "(31) 99999-8888"), {
    order_type: "entrega",
    address: { cep: "30110000", street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro" },
    phone: "31999998888",
  });
});

test("the address on the slip", () => {
  assert.equal(
    describeAddress({ street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro" }),
    "Rua das Flores, 120 · apto 3 · Centro"
  );
  assert.equal(describeAddress({ street: "Rua A", number: "1", neighborhood: "Sul", city: "BH" }), "Rua A, 1 · Sul · BH");
  assert.equal(describeAddress(null), "");
  assert.equal(describeAddress({ street: 5 }), "");
});

test("delivery answers from the server are shown as they are; other errors are not", () => {
  assert.equal(deliveryErrorMessage("O pedido mínimo para Centro é R$ 20,00. Adicione mais itens ou escolha retirar.", "entrega"),
    "O pedido mínimo para Centro é R$ 20,00. Adicione mais itens ou escolha retirar.");
  assert.equal(deliveryErrorMessage("A entrega está pausada agora. Você pode retirar ou tentar mais tarde.", "entrega"),
    "A entrega está pausada agora. Você pode retirar ou tentar mais tarde.");
  assert.equal(deliveryErrorMessage("Este restaurante não está aceitando retirada. Escolha entrega ou fale com a casa.", "retirada"),
    "Este restaurante não está aceitando retirada. Escolha entrega ou fale com a casa.");
  assert.equal(deliveryErrorMessage("Produto inválido", "entrega"), null);
  assert.equal(deliveryErrorMessage("Ainda não entregamos nesse CEP.", null), null, "no delivery chosen: old messages");
  assert.equal(deliveryErrorMessage("", "entrega"), null);
});

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test("the address and phone typed once are there the next time, in that restaurant only", () => {
  const storage = fakeStorage();
  createDeliveryMemory(storage).save("jack", { address: address({ complement: "apto 3" }), phone: "(31) 99999-8888" });
  const next = createDeliveryMemory(storage);
  assert.equal(next.load("jack").address.street, "Rua das Flores");
  assert.equal(next.load("jack").address.complement, "apto 3");
  assert.equal(next.load("jack").phone, "(31) 99999-8888");
  assert.equal(next.load("outra"), null);
});

test("the customer can erase it, and a broken or blocked storage changes nothing", () => {
  const storage = fakeStorage();
  const memory = createDeliveryMemory(storage);
  memory.save("jack", { address: address(), phone: "1" });
  memory.forget("jack");
  assert.equal(memory.load("jack"), null);

  storage.data.set("vc_delivery_jack", "{not json");
  assert.equal(memory.load("jack"), null);
  storage.data.set("vc_delivery_jack", JSON.stringify({ address: 5 }));
  assert.equal(memory.load("jack"), null);
  storage.data.set("vc_delivery_jack", JSON.stringify({ address: { street: 5, number: "9" }, phone: 7 }));
  assert.deepEqual(memory.load("jack"), { address: { ...EMPTY_ADDRESS, number: "9" }, phone: "" });

  const blocked = createDeliveryMemory({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  });
  assert.equal(blocked.load("jack"), null);
  blocked.save("jack", { address: address(), phone: "" });
  blocked.forget("jack");
  assert.equal(createDeliveryMemory(null).load("jack"), null);
});
