import test from "node:test";
import assert from "node:assert/strict";

import { bagProblem, bagViewOf, orderPayloadOf, totalCentsOf } from "../../frontend/src/loja/bagLogic.ts";
import { addConfigured } from "../../frontend/src/customer/cart.ts";
import { EMPTY_ADDRESS } from "../../frontend/src/customer/delivery.ts";

const pizza = { id: "p1", name: "Pizza", price: 40 };
const suco = { id: "s1", name: "Suco de caju", price: 7.5 };
const grande = { id: "gr", group: "Tamanho", name: "Grande", deltaCents: 1000 };
const bacon = { id: "bac", group: "Adicionais", name: "Bacon", deltaCents: 450 };

// 2 pizzas grandes com bacon (R$ 54,50 cada) e 1 suco: R$ 116,50.
const cart = addConfigured(addConfigured([], pizza, { options: [grande, bacon], note: "sem cebola", quantity: 2 }), suco);
const address = { cep: "30140071", street: "Rua das Flores", number: "120", complement: "", neighborhood: "Centro", city: "Belo Horizonte", reference: "" };
const quote = { available: true, zone: "Centro", fee: "5.00", min_order: "20.00", eta_minutes: 40 };

const base = (extra = {}) => ({
  cart,
  tableNumber: null,
  tableLost: false,
  offered: [],
  mode: null,
  deliveryPaused: false,
  quote: null,
  quoting: false,
  quoteFailed: false,
  address: EMPTY_ADDRESS,
  phone: "",
  remembered: false,
  name: "",
  payment: "cartao",
  pixOn: false,
  paid: "",
  closed: null,
  editable: () => true,
  ...extra,
});
const delivery = (extra = {}) => base({ offered: ["retirada", "entrega"], mode: "entrega", address, phone: "31999998888", name: "Maria", quote, ...extra });

test("pedido na mesa: diz a mesa, não oferece entrega, nome é opcional e não há taxa", () => {
  const bag = bagViewOf(base({ tableNumber: 4 }));
  assert.equal(bag.where, "Mesa 4");
  assert.equal(bag.nameLabel, "Seu nome (opcional)");
  assert.deepEqual(bag.modes, []);
  assert.equal(bag.delivery, null);
  assert.equal(bag.fee, null);
  assert.equal(bag.subtotal, 116.5);
  assert.equal(bag.total, 116.5);
});

test("as linhas trazem o que o cliente escolheu, a observação e o total exato da linha", () => {
  const { lines } = bagViewOf(base());
  assert.equal(lines.length, 2);
  assert.deepEqual(
    [lines[0].name, lines[0].detail, lines[0].note, lines[0].quantity, lines[0].total, lines[0].canEdit],
    ["Pizza", "Grande, Bacon", "sem cebola", 2, 109, true],
  );
  assert.deepEqual([lines[1].name, lines[1].detail, lines[1].note, lines[1].total, lines[1].canEdit], ["Suco de caju", undefined, undefined, 7.5, false]);
  assert.notEqual(lines[0].key, "p1", "a linha com escolhas tem identidade própria");
  assert.equal(lines[1].key, "s1");
});

test("Mudar opções só aparece quando a linha tem escolhas e o prato ainda está no cardápio", () => {
  assert.equal(bagViewOf(base({ editable: () => false })).lines[0].canEdit, false);
  assert.equal(bagViewOf(base({ editable: (line) => line.id === "p1" })).lines[0].canEdit, true);
  assert.equal(bagViewOf(base({ editable: () => true })).lines[1].canEdit, false, "prato simples não tem o que mudar");
});

test("entrega soma a taxa que o servidor anunciou; sem confirmação do servidor, não aparece taxa", () => {
  const bag = bagViewOf(delivery());
  assert.equal(bag.where, "Entrega");
  assert.equal(bag.fee, 5);
  assert.equal(bag.subtotal, 116.5);
  assert.equal(bag.total, 121.5);
  assert.equal(bag.nameLabel, "Seu nome");

  const no = bagViewOf(delivery({ quote: { available: false, message: "Não entregamos neste CEP." } }));
  assert.equal(no.fee, null);
  assert.equal(no.total, 116.5);

  const waiting = bagViewOf(delivery({ quote: null, quoting: true }));
  assert.equal(waiting.fee, null);
  assert.equal(waiting.total, 116.5);
});

test("entrega grátis mostra taxa zero (a tela escreve Grátis), não some", () => {
  const bag = bagViewOf(delivery({ quote: { ...quote, fee: "0.00" } }));
  assert.equal(bag.fee, 0);
  assert.equal(bag.total, 116.5);
});

test("retirar no local não tem taxa nem endereço, e só há o que escolher quando o restaurante oferece mais de uma forma", () => {
  const pickup = bagViewOf(delivery({ mode: "retirada" }));
  assert.equal(pickup.where, "Retirada");
  assert.equal(pickup.delivery, null);
  assert.equal(pickup.fee, null);
  assert.deepEqual(pickup.modes, [
    { id: "retirada", label: "Retirar no local", on: true },
    { id: "entrega", label: "Receber em casa", on: false },
  ]);
  assert.deepEqual(bagViewOf(base({ offered: ["entrega"], mode: "entrega", address })).modes, [], "uma forma só: nada a escolher");
  assert.deepEqual(bagViewOf(base()).modes, []);
});

test("a entrega pausada só avisa quando não resta forma nenhuma de receber e a pessoa não está na mesa", () => {
  const text = "A entrega está pausada agora. Você pode retirar no local.";
  assert.equal(bagViewOf(base({ deliveryPaused: true })).pausedNote, text);
  assert.equal(bagViewOf(base({ deliveryPaused: true, offered: ["retirada", "entrega"], mode: "retirada" })).pausedNote, null);
  assert.equal(bagViewOf(base({ deliveryPaused: true, tableNumber: 3 })).pausedNote, null);
  assert.equal(bagViewOf(base()).pausedNote, null);
});

test("o endereço mostra o CEP e o telefone com máscara, e o campo certo em cada lugar", () => {
  const shown = bagViewOf(delivery()).delivery;
  assert.equal(shown.cep, "30140-071");
  assert.equal(shown.phone, "(31) 99999-8888");
  assert.deepEqual(
    [shown.street, shown.number, shown.complement, shown.neighborhood, shown.reference, shown.remembered],
    ["Rua das Flores", "120", "", "Centro", "", false],
  );
  assert.equal(bagViewOf(delivery({ remembered: true })).delivery.remembered, true);
});

test("o CEP diz em que pé está: falta digitar, conferindo, não deu, entregamos ou não entregamos", () => {
  const cep = (extra) => bagViewOf(delivery(extra)).delivery;
  const short = cep({ address: { ...address, cep: "3014" }, quote: null });
  assert.equal(short.quote, null);
  assert.equal(short.hint, "Digite o CEP para ver a taxa e o prazo.");

  assert.deepEqual(cep({ quote: null, quoting: true }).quote, { text: "Conferindo o CEP…", tone: "wait" });
  assert.deepEqual(cep({ quote: null, quoteFailed: true }).quote, { text: "Não deu para conferir o CEP. Confira a internet.", tone: "fail" });

  const ok = cep({});
  assert.equal(ok.hint, undefined);
  assert.equal(ok.quote.tone, "ok");
  assert.match(ok.quote.text, /Entregamos em Centro\./);
  // O espaço depois do "R$" não quebra a linha entre o símbolo e o número.
  assert.match(ok.quote.text, /Taxa de entrega R\$\u00a05,00\./);
  assert.match(ok.quote.text, /Prazo de cerca de 40 min\./);

  const no = cep({ quote: { available: false, message: "Ainda não entregamos neste CEP." } });
  assert.deepEqual(no.quote, { text: "Ainda não entregamos neste CEP.", tone: "no" });
});

test("o Pix só é oferecido quando o restaurante tem chave; a forma que vale vem marcada", () => {
  assert.deepEqual(bagViewOf(base({ pixOn: true, payment: "pix" })).payments, [
    { id: "pix", label: "Pix", on: true },
    { id: "cartao", label: "Cartão", on: false },
    { id: "dinheiro", label: "Dinheiro", on: false },
  ]);
  assert.deepEqual(bagViewOf(base({ pixOn: false })).payments.map((entry) => entry.id), ["cartao", "dinheiro"]);
});

test("a frase de pagamento muda com a forma; o campo de dinheiro só existe no dinheiro", () => {
  assert.match(bagViewOf(base({ pixOn: true, payment: "pix" })).paymentNote, /código Pix aparece/);
  assert.match(bagViewOf(base()).paymentNote, /acerta o pagamento com o atendente/);
  assert.equal(bagViewOf(base()).cash, null);
  assert.equal(bagViewOf(base({ pixOn: true, payment: "pix" })).cash, null);
});

test("Tenho o valor certinho usa o total com a taxa, com vírgula", () => {
  assert.deepEqual(bagViewOf(base({ payment: "dinheiro", paid: "50" })).cash, { value: "50", exact: "116,50" });
  assert.equal(bagViewOf(delivery({ payment: "dinheiro" })).cash.exact, "121,50");
});

test("os avisos vêm na ordem: mesa que não existe, restaurante fechado, depois os da tela", () => {
  const bag = bagViewOf(base({ tableLost: true, closed: "Fechado agora.", extraNotices: ["Pizza acabou e saiu do seu pedido."] }));
  assert.deepEqual(bag.notices, [
    "Não encontramos esta mesa. Se o envio não funcionar, chame o atendente.",
    "Fechado agora.",
    "Pizza acabou e saiu do seu pedido.",
  ]);
  assert.deepEqual(bagViewOf(base()).notices, []);
});

test("sacola vazia: sem linhas, total zero e uma frase que diz o que fazer", () => {
  const bag = bagViewOf(base({ cart: [] }));
  assert.deepEqual([bag.lines.length, bag.total], [0, 0]);
  assert.match(bag.emptyText, /vazio\. Volte ao cardápio/);
  assert.equal(bagProblem(base({ cart: [] })), bag.emptyText);
});

test("o que impede o envio, na ordem da tela antiga: fechado, entrega, dinheiro", () => {
  assert.equal(bagProblem(base()), null, "cartão na mesa ou retirada: nada a conferir");
  assert.equal(bagProblem(base({ closed: "Fechado agora." })), "Fechado agora.");
  assert.equal(bagProblem(base({ closed: "Fechado agora.", payment: "dinheiro", paid: "" })), "Fechado agora.", "fechado vem antes do dinheiro");
});

test("entrega: cada falta vira uma frase, uma de cada vez, na ordem do formulário", () => {
  assert.equal(bagProblem(delivery()), null);
  assert.equal(bagProblem(delivery({ name: "  " })), "Escreva o seu nome para a entrega.");
  assert.equal(bagProblem(delivery({ address: { ...address, cep: "3014" } })), "Escreva o CEP com 8 números para ver a taxa.");
  assert.match(bagProblem(delivery({ quote: null, quoteFailed: true })), /Não deu para conferir o CEP/);
  assert.match(bagProblem(delivery({ quote: null })), /Estou conferindo o CEP/);
  assert.equal(bagProblem(delivery({ quote: { available: false, message: "Não entregamos aí." } })), "Não entregamos aí.");
  assert.equal(bagProblem(delivery({ address: { ...address, street: "" } })), "Escreva a rua.");
  assert.match(bagProblem(delivery({ address: { ...address, number: "" } })), /Escreva o número/);
  assert.equal(bagProblem(delivery({ address: { ...address, neighborhood: "" } })), "Escreva o bairro.");
  assert.match(bagProblem(delivery({ phone: "123" })), /telefone com DDD/);
});

test("pedido mínimo da região vale para os pratos, sem a taxa", () => {
  const strict = { ...quote, min_order: "150.00" };
  assert.match(bagProblem(delivery({ quote: strict })), /O pedido mínimo para Centro é R\$ 150,00\. Faltam R\$ 33,50/);
});

test("dinheiro: precisa dizer com quanto vai pagar, e cobrir o total com a taxa", () => {
  assert.match(bagProblem(base({ payment: "dinheiro", paid: "" })), /Digite com quanto você vai pagar/);
  assert.match(bagProblem(base({ payment: "dinheiro", paid: "100" })), /igual ou maior que o total/);
  assert.equal(bagProblem(base({ payment: "dinheiro", paid: "116,50" })), null);
  assert.equal(bagProblem(base({ payment: "dinheiro", paid: "R$ 200" })), null);
  // O total da entrega tem a taxa: 116,50 não cobre 121,50.
  assert.match(bagProblem(delivery({ payment: "dinheiro", paid: "116,50" })), /igual ou maior que o total/);
  assert.equal(bagProblem(delivery({ payment: "dinheiro", paid: "121,50" })), null);
});

test("totalCentsOf: pratos mais a taxa só na entrega", () => {
  assert.equal(totalCentsOf(base()), 11650);
  assert.equal(totalCentsOf(delivery()), 12150);
  assert.equal(totalCentsOf(delivery({ mode: "retirada" })), 11650);
  assert.equal(totalCentsOf(delivery({ tableNumber: 2 })), 11650, "na mesa nunca há taxa");
});

test("o que vai ao servidor: códigos, quantidades, escolhas e observação, nunca preço", () => {
  const payload = orderPayloadOf(base());
  assert.deepEqual(payload.items, [
    { id: "p1", quantity: 2, options: ["gr", "bac"], note: "sem cebola" },
    { id: "s1", quantity: 1 },
  ]);
  assert.ok(!JSON.stringify(payload).includes("price"));
  assert.equal(payload.customerName, "Cliente", "sem nome, o cozinheiro lê Cliente");
  assert.equal(orderPayloadOf(base({ name: "  Maria   Silva " })).customerName, "Maria Silva");
});

test("o dinheiro vai em reais, e só no dinheiro", () => {
  assert.equal(orderPayloadOf(base({ payment: "dinheiro", paid: "50,5" })).change, 50.5);
  assert.equal(orderPayloadOf(base({ payment: "cartao", paid: "50" })).change, 0);
  assert.equal(orderPayloadOf(base({ pixOn: true, payment: "pix", paid: "50" })).change, 0);
});

test("o tipo do pedido: mesa e restaurante sem entrega não mandam nada a mais, retirada manda só o tipo, entrega manda endereço e telefone limpos", () => {
  assert.deepEqual(orderPayloadOf(base({ tableNumber: 4 })).extras, {});
  assert.deepEqual(orderPayloadOf(base({ tableNumber: 4, mode: "entrega", address, phone: "31999998888" })).extras, {}, "mesa nunca entrega");
  assert.deepEqual(orderPayloadOf(base()).extras, {});
  assert.deepEqual(orderPayloadOf(delivery({ mode: "retirada" })).extras, { order_type: "retirada" });
  assert.deepEqual(orderPayloadOf(delivery({ phone: "(31) 99999-8888", address: { ...address, cep: "30140-071", complement: "  apto   3 " } })).extras, {
    order_type: "entrega",
    address: { cep: "30140071", street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro", city: "Belo Horizonte" },
    phone: "31999998888",
  });
});

test("calcular a sacola não mexe na lista que recebe", () => {
  const before = JSON.stringify(cart);
  const input = base({ cart, payment: "dinheiro", paid: "200" });
  bagViewOf(input);
  bagProblem(input);
  orderPayloadOf(input);
  assert.equal(JSON.stringify(cart), before);
});
