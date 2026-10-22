import test from "node:test";
import assert from "node:assert/strict";

import { groupOrders } from "../../frontend/src/courier/courierLogic.ts";
import { formatTime } from "../../frontend/src/service/format.ts";
import {
  DELIVERIES_POLL_MS,
  actionOf,
  cardOf,
  deliveriesTabs,
  deliveriesViewOf,
  firstDeliveriesTab,
  isDeliveriesTab,
  ordersOfDeliveriesTab,
  pickedText,
} from "../../frontend/src/painel/deliveriesLogic.ts";

/** O dinheiro sai com espaço que não quebra linha ("R$ 50,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/ /g, " ");

let counter = 0;
/** Uma entrega como o servidor manda (as mesmas chaves da tela antiga do entregador). */
const order = (extra = {}) => {
  counter += 1;
  return {
    id: `${String(2000 + counter)}-ent`,
    customer_name: "Ana Silva",
    phone: "(31) 99999-8888",
    address: "Rua das Flores, 120",
    reference: "",
    zone: "",
    status: "pronto",
    total: "50.00",
    payment_method: "pix",
    cash_to_receive: "0.00",
    change_for: "",
    change_back: "",
    mine: false,
    taken_by_other: false,
    needs_code: true,
    picked_up_at: null,
    delivered_at: null,
    cash_received: "",
    settled: false,
    ...extra,
  };
};
/** Esperando para pegar. */
const ready = (extra = {}) => order({ status: "pronto", ...extra });
/** Na rua, com este entregador. */
const going = (extra = {}) => order({ status: "saiu para entrega", mine: true, picked_up_at: "2026-10-22T15:00:00Z", ...extra });
/** Na rua, com outro entregador. */
const other = (extra = {}) => order({ status: "saiu para entrega", taken_by_other: true, ...extra });
/** Fechada. */
const done = (extra = {}) => order({ status: "concluido", delivered_at: "2026-10-22T15:30:00Z", ...extra });

test("o ritmo: pergunta a cada 10 s, o mesmo da tela antiga do entregador", () => {
  assert.equal(DELIVERIES_POLL_MS, 10_000);
});

test("as três etapas: o que espera, o que está na rua (as dele primeiro, depois as de outros) e o que foi entregue", () => {
  const a = ready({ id: "a" });
  const b = going({ id: "b" });
  const c = other({ id: "c" });
  const d = done({ id: "d" });
  const e = going({ id: "e" });
  const groups = groupOrders([a, c, b, d, e]);
  assert.deepEqual(ordersOfDeliveriesTab(groups, "ready").map((x) => x.id), ["a"]);
  assert.deepEqual(ordersOfDeliveriesTab(groups, "route").map((x) => x.id), ["b", "e", "c"], "as dele primeiro");
  assert.deepEqual(ordersOfDeliveriesTab(groups, "done").map((x) => x.id), ["d"]);
});

test("as abas: o rótulo é curto (cabe em 320 px) e o número de cada etapa vem da lista", () => {
  const groups = groupOrders([ready(), ready(), going(), other(), done(), done(), done()]);
  assert.deepEqual(deliveriesTabs(groups), [
    { id: "ready", label: "Pegar", count: 2 },
    { id: "route", label: "Na rua", count: 2 },
    { id: "done", label: "Entregues", count: 3 },
  ]);
  assert.deepEqual(deliveriesTabs(groupOrders([])).map((tab) => tab.count), [0, 0, 0]);
});

test("só as três etapas existem como aba", () => {
  for (const id of ["ready", "route", "done"]) assert.equal(isDeliveriesTab(id), true, id);
  for (const id of ["going", "other", "xyz", "", null, undefined, 3]) assert.equal(isDeliveriesTab(id), false, String(id));
});

test("a aba que abre sozinha é a que tem trabalho: a rua de quem já está com pedido, depois o que espera, depois a rua dos outros", () => {
  assert.equal(firstDeliveriesTab(groupOrders([ready(), going()])), "route", "quem está com um pedido na rua vê a rua");
  assert.equal(firstDeliveriesTab(groupOrders([ready(), other(), done()])), "ready", "tem o que pegar");
  assert.equal(firstDeliveriesTab(groupOrders([other(), done()])), "route", "só tem a rua dos outros (visão do gerente)");
  assert.equal(firstDeliveriesTab(groupOrders([done()])), "ready", "só entregues: é na primeira aba que o próximo aparece");
  assert.equal(firstDeliveriesTab(groupOrders([])), "ready");
});

test("o botão do momento: Peguei para o que espera, Entreguei para o que ele leva; entrega de outro e entrega fechada não têm botão", () => {
  assert.equal(actionOf(ready()), "pick");
  assert.equal(actionOf(going()), "deliver");
  assert.equal(actionOf(other()), null);
  assert.equal(actionOf(done()), null);
  assert.equal(actionOf(done({ mine: true })), null);
});

test("o cartão de uma entrega para pegar: endereço, ligar, mapa, dinheiro e troco, e o botão lido com o nome e o número", () => {
  const card = cardOf(
    ready({
      id: "abcd1234-xx",
      customer_name: "  Ana   Silva ",
      address: "Rua das Flores, 120",
      zone: "Centro",
      reference: "Portão azul",
      cash_to_receive: "48.00",
      change_back: "2.00",
    }),
  );
  assert.equal(card.who, "Ana Silva");
  assert.equal(card.number, "#ABCD");
  assert.equal(card.stage, "ready");
  assert.equal(card.address, "Rua das Flores, 120");
  assert.deepEqual(card.sub, ["Região: Centro", "Referência: Portão azul"]);
  assert.equal(card.phoneHref, "tel:+5531999998888");
  assert.equal(card.mapHref, "https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%20120");
  assert.deepEqual({ main: n(card.cash.main), sub: n(card.cash.sub) }, { main: "Receber R$ 48,00 em dinheiro", sub: "Leve R$ 2,00 de troco" });
  assert.equal(card.action, "Peguei");
  assert.equal(card.actionSpoken, "Peguei o pedido de Ana Silva, #ABCD");
  assert.equal(card.needsCode, true);
  assert.equal(card.time, "");
  assert.equal(card.money, null);
});

test("sem troco a tela diz 'valor exato'; sem dinheiro na porta não há bloco de dinheiro", () => {
  const exact = cardOf(going({ cash_to_receive: "35.50", change_back: "" }));
  assert.equal(n(exact.cash.main), "Receber R$ 35,50 em dinheiro");
  assert.equal(exact.cash.sub, "Valor exato, sem troco");
  assert.equal(cardOf(going({ cash_to_receive: "0.00" })).cash, null, "Pix ou cartão: nada a receber");
  assert.equal(cardOf(going({ cash_to_receive: "" })).cash, null);
  assert.equal(cardOf(going({ cash_to_receive: "abc" })).cash, null, "valor estranho nunca vira dinheiro");
});

test("o cartão de uma entrega na rua com ele: o botão é Entreguei, e o pedido sem código segue sem campo de código", () => {
  const card = cardOf(going({ id: "zz99-aa", customer_name: "Pedro", needs_code: false }));
  assert.equal(card.stage, "going");
  assert.equal(card.action, "Entreguei");
  assert.equal(card.actionSpoken, "Entreguei o pedido de Pedro, #ZZ99");
  assert.equal(card.needsCode, false);
  assert.notEqual(card.phoneHref, "");
});

test("a entrega de outro motoqueiro fica só para ver: sem botão, sem telefone, sem mapa e sem dinheiro", () => {
  const card = cardOf(other({ cash_to_receive: "48.00", change_back: "2.00" }));
  assert.equal(card.stage, "other");
  assert.equal(card.action, "");
  assert.equal(card.actionSpoken, "");
  assert.equal(card.phoneHref, "");
  assert.equal(card.mapHref, "");
  assert.equal(card.cash, null);
  assert.equal(card.money, null);
});

test("endereço, nome e telefone que faltam: frases honestas, nunca um link quebrado", () => {
  const card = cardOf(ready({ customer_name: "   ", address: "   ", phone: "123", zone: "  ", reference: "" }));
  assert.equal(card.who, "Cliente");
  assert.equal(card.address, "Endereço não informado");
  assert.deepEqual(card.sub, []);
  assert.equal(card.phoneHref, "", "telefone que não é brasileiro não vira tel:");
  assert.equal(card.mapHref, "", "sem endereço não há mapa");
  assert.equal(cardOf(ready({ phone: "" })).phoneHref, "");
});

test("o telefone só vira link por tel: com dígitos e o mapa só por https do Google; texto do cliente nunca entra no endereço do link sem ser codificado", () => {
  const card = cardOf(ready({ phone: "javascript:alert(1)", address: 'Rua "A" <b>1</b> & x=y#z' }));
  assert.equal(card.phoneHref, "");
  assert.match(card.mapHref, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=[A-Za-z0-9%._~!*'()-]+$/);
  assert.ok(!/[<>"& ]/.test(card.mapHref.split("query=")[1]), "o endereço vai codificado");
  for (const href of [cardOf(ready()).phoneHref, cardOf(ready()).mapHref]) assert.match(href, /^(tel:\+55\d{10,11}|https:\/\/www\.google\.com\/)/);
});

test("a entrega fechada mostra a hora e o dinheiro: acertado, ainda com você, ou ainda com o motoqueiro (se não é dele)", () => {
  const settled = cardOf(done({ mine: true, cash_received: "48.00", settled: true }));
  assert.equal(settled.stage, "done");
  assert.equal(settled.time, formatTime("2026-10-22T15:30:00Z"));
  assert.deepEqual({ text: n(settled.money.text), tone: settled.money.tone }, { text: "Dinheiro R$ 48,00: acertado com o caixa", tone: "settled" });

  const mineOwing = cardOf(done({ mine: true, cash_received: "48.00" }));
  assert.deepEqual({ text: n(mineOwing.money.text), tone: mineOwing.money.tone }, { text: "Dinheiro R$ 48,00: ainda com você", tone: "owe" });

  const theirs = cardOf(done({ mine: false, cash_received: "48.00" }));
  assert.equal(n(theirs.money.text), "Dinheiro R$ 48,00: ainda com o motoqueiro", "o gerente não lê 'ainda com você' do dinheiro de outro");

  assert.equal(cardOf(done({ mine: true, cash_received: "" })).money, null, "pagou no Pix: sem dinheiro");
  assert.equal(cardOf(done({ mine: true, cash_received: "0.00" })).money, null);
  assert.equal(cardOf(done()).phoneHref, "", "fechada: sem ligar");
  assert.equal(cardOf(done()).mapHref, "", "fechada: sem mapa");
  assert.equal(cardOf(done()).cash, null);
  assert.equal(cardOf(done()).action, "");
});

test("depois de pegar: 'O pedido de Ana está com você. Boa entrega!'", () => {
  assert.equal(pickedText({ customer_name: "Ana" }), "O pedido de Ana está com você. Boa entrega!");
  assert.equal(pickedText({ customer_name: "  " }), "O pedido de cliente está com você. Boa entrega!");
});

test("antes da primeira resposta a tela diz que está abrindo, e não que não há entregas", () => {
  const view = deliveriesViewOf({ orders: null, chosen: null, error: "", notice: "" });
  assert.equal(view.sub, "Abrindo as entregas…");
  assert.equal(view.empty, "", "nada de 'Nenhuma entrega' enquanto não carregou");
  assert.deepEqual(view.cards, []);
  assert.equal(view.held, "");
});

test("sem entregas a tela fica calma e cada aba explica o que esperar", () => {
  const view = deliveriesViewOf({ orders: [], chosen: null, error: "", notice: "" });
  assert.equal(view.sub, "Nenhuma entrega agora");
  assert.equal(view.active, "ready");
  assert.match(view.empty, /Nenhuma entrega para pegar/);
  assert.match(deliveriesViewOf({ orders: [], chosen: "route", error: "", notice: "" }).empty, /Ninguém está na rua/);
  assert.match(deliveriesViewOf({ orders: [], chosen: "done", error: "", notice: "" }).empty, /Ainda não há entregas fechadas/);
});

test("a frase de cima conta o que há para fazer; a aba escolhida manda; aba que não existe volta à que tem trabalho", () => {
  const list = [ready({ id: "r1" }), ready({ id: "r2" }), going({ id: "g1" }), done({ id: "d1" })];
  const auto = deliveriesViewOf({ orders: list, chosen: null, error: "", notice: "" });
  assert.equal(auto.sub, "2 para pegar · 1 a caminho");
  assert.equal(auto.active, "route");
  assert.deepEqual(auto.cards.map((card) => card.id), ["g1"]);
  const picked = deliveriesViewOf({ orders: list, chosen: "ready", error: "", notice: "" });
  assert.deepEqual(picked.cards.map((card) => card.id), ["r1", "r2"]);
  const strange = deliveriesViewOf({ orders: list, chosen: "xyz", error: "", notice: "" });
  assert.equal(strange.active, "route");
  assert.match(picked.empty, /Nenhuma entrega para pegar/, "a frase de vazio acompanha a aba; a tela só a mostra quando a aba não tem cartão");
});

test("o dinheiro que ele ainda deve ao caixa aparece no topo, só o dele e só o que não foi acertado", () => {
  const list = [
    done({ mine: true, cash_received: "48.00" }),
    done({ mine: true, cash_received: "20.00" }),
    done({ mine: true, cash_received: "30.00", settled: true }),
    done({ mine: false, cash_received: "99.00" }),
    done({ mine: true, cash_received: "" }),
  ];
  const view = deliveriesViewOf({ orders: list, chosen: "done", error: "", notice: "" });
  assert.equal(n(view.held), "Você está com R$ 68,00 em dinheiro de 2 entregas. Entregue ao caixa para o acerto.");
  assert.equal(deliveriesViewOf({ orders: [done({ mine: true, cash_received: "9.00" })], chosen: null, error: "", notice: "" }).held.includes("1 entrega."), true);
  assert.equal(deliveriesViewOf({ orders: [done({ mine: false, cash_received: "9.00" })], chosen: null, error: "", notice: "" }).held, "");
});

test("o erro e o aviso passam como vieram, e uma lista que já carregou não some por causa de um erro", () => {
  const view = deliveriesViewOf({ orders: [ready({ id: "r1" })], chosen: "ready", error: "Sem sinal. Mostrando a última lista que carregou.", notice: "Entrega concluída." });
  assert.equal(view.error, "Sem sinal. Mostrando a última lista que carregou.");
  assert.equal(view.notice, "Entrega concluída.");
  assert.equal(view.cards.length, 1);
});
