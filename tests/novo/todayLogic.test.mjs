import test from "node:test";
import assert from "node:assert/strict";

import {
  dateLineOf,
  greetingOf,
  hourOf,
  salesOf,
  shortcutsOf,
  todayOf,
  todoOf,
} from "../../frontend/src/hoje/todayLogic.ts";

// Quarta, 21/10/2026, 20h30 em Brasília (UTC-3).
const NOW = Date.parse("2026-10-21T23:30:00.000Z");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const order = (status, minutes, extra = {}) => ({
  status,
  created_at: ago(minutes),
  order_type: "mesa",
  payment_method: "dinheiro",
  payment_status: "PENDING",
  total_price: 30,
  ...extra,
});
const pix = (minutes, price = 48, extra = {}) =>
  order("PENDING_PAYMENT", minutes, { payment_method: "pix", payment_status: "PENDING", total_price: price, ...extra });
const call = (id, extra = {}) => ({
  id,
  table_number: 4,
  kind: "garcom",
  label: "Garçom",
  text: "Mesa 4 chama o garçom",
  waiting_seconds: 120,
  repeats: 0,
  urgency: "normal",
  ...extra,
});
const hoursWith = (map) => Array.from({ length: 24 }, (_, hour) => ({ hour, orders: map[hour] ?? 0, revenue: 0 }));
const summary = { revenue: 1284.5, orders: 38, avg_ticket: 33.8, dishes: 60, delivery_fees: 0 };
const flat = (text) => text.replace(/\s/g, " ");

test("a hora é a de Brasília, não a do aparelho", () => {
  assert.equal(hourOf(NOW), 20);
  assert.equal(hourOf(Date.parse("2026-10-22T02:59:00Z")), 23);
  assert.equal(hourOf(Date.parse("2026-10-22T03:00:00Z")), 0);
  assert.equal(hourOf(Date.parse("2026-10-21T08:15:00Z")), 5);
});

test("a data sai por extenso e com letra maiúscula", () => {
  assert.equal(dateLineOf(NOW), "Quarta-feira, 21 de outubro");
  assert.equal(dateLineOf(Date.parse("2026-10-22T02:30:00Z")), "Quarta-feira, 21 de outubro", "23h30 em Brasília ainda é dia 21");
});

test("a saudação segue o horário de Brasília e usa só o primeiro nome", () => {
  assert.equal(greetingOf("João da Silva", Date.parse("2026-10-21T13:00:00Z")), "Bom dia, João");
  assert.equal(greetingOf("João da Silva", Date.parse("2026-10-21T18:00:00Z")), "Boa tarde, João");
  assert.equal(greetingOf("João da Silva", NOW), "Boa noite, João");
  assert.equal(greetingOf("", NOW), "Boa noite");
  assert.equal(greetingOf(null, NOW), "Boa noite");
  assert.equal(greetingOf("Seu João da Cozinha", NOW), "Boa noite, Seu João");
});

test("os números do topo contam cada etapa pelo status que o servidor escreve", () => {
  const today = todayOf({
    name: "João",
    role: "OWNER",
    now: NOW,
    calls: [call("c1"), call("c2", { table_number: 7, text: "Mesa 7 pede a conta" })],
    business: null,
    orders: [
      order("PENDING_PAYMENT", 7),
      order("PENDING_PAYMENT", 12),
      order("em preparo", 5),
      order("pronto", 9, { order_type: "entrega" }),
      order("saiu para entrega", 20, { order_type: "entrega" }),
      order("saiu para entrega", 25, { order_type: "entrega" }),
      order("concluido", 90),
    ],
  });
  assert.equal(today.waiting, 2);
  assert.equal(today.oldestMinutes, 12);
  assert.equal(today.cooking, 1);
  assert.equal(today.onTheWay, 2, "a caminho é só o que já saiu; o pronto espera o entregador");
  assert.equal(today.calling, 2);
  assert.equal(today.greeting, "Boa noite, João");
  assert.equal(today.dateLine, "Quarta-feira, 21 de outubro");
});

test("sem pedido esperando, o mais antigo é 0 e nada quebra com data estragada", () => {
  const empty = todayOf({ name: "", role: "OWNER", now: NOW, calls: [], business: null, orders: [] });
  assert.deepEqual([empty.waiting, empty.oldestMinutes, empty.cooking, empty.onTheWay, empty.calling], [0, 0, 0, 0, 0]);
  assert.deepEqual(empty.todo, []);
  const broken = todayOf({
    name: "",
    role: "OWNER",
    now: NOW,
    calls: [],
    business: null,
    orders: [order("PENDING_PAYMENT", 3, { created_at: "lixo" }), order("PENDING_PAYMENT", 8)],
  });
  assert.equal(broken.waiting, 2, "o pedido com data ruim ainda conta como esperando");
  assert.equal(broken.oldestMinutes, 8, "mas só a data legível entra no mais antigo");
});

test("Pix a conferir: soma, singular e plural, e só quem pode confirmar vê", () => {
  const orders = [
    pix(7, 48),
    pix(3, 48.5),
    pix(5, 30, { payment_status: "PAID" }),
    order("PENDING_PAYMENT", 4),
    pix(60 * 30, 99),
  ];
  const owner = todoOf({ role: "OWNER", orders, calls: [], now: NOW });
  assert.equal(owner.length, 1);
  assert.equal(owner[0].kind, "pix");
  assert.equal(owner[0].title, "2 Pix para conferir", "o pago, o de dinheiro e o de mais de um dia ficam de fora");
  assert.equal(flat(owner[0].note), "R$ 96,50 no total");
  assert.equal(owner[0].action, "Conferir");

  const one = todoOf({ role: "CASHIER", orders: [pix(2, 12.9)], calls: [], now: NOW });
  assert.equal(one[0].title, "1 Pix para conferir");
  assert.equal(flat(one[0].note), "R$ 12,90 no total");

  for (const role of ["WAITER", "KITCHEN", "COURIER", null, undefined]) {
    assert.deepEqual(todoOf({ role, orders, calls: [], now: NOW }), [], `${role} não confirma Pix`);
  }
});

test("valor estragado não derruba a soma do Pix", () => {
  const items = todoOf({ role: "OWNER", orders: [pix(3, 10), pix(4, "abc"), pix(5, null)], calls: [], now: NOW });
  assert.equal(flat(items[0].note), "R$ 10,00 no total");
  assert.equal(items[0].title, "3 Pix para conferir");
});

test("mesa chamando vira item de Atender, com a espera, e vem antes do Pix", () => {
  const items = todoOf({
    role: "OWNER",
    orders: [pix(3)],
    calls: [call("c1", { waiting_seconds: 45 }), call("c2", { waiting_seconds: 200, repeats: 2, text: "Mesa 7 pede a conta" })],
    now: NOW,
  });
  assert.deepEqual(
    items.map((item) => item.id),
    ["c1", "c2", "pix"],
  );
  assert.equal(items[0].title, "Mesa 4 chama o garçom");
  assert.equal(items[0].note, "há 40 s");
  assert.equal(items[0].action, "Atender");
  assert.equal(items[1].note, "há 3 min, chamou de novo");
});

test("a lista mostra no máximo 4 chamadas, mas o número de mesas chamando é o total", () => {
  const calls = Array.from({ length: 6 }, (_, index) => call(`c${index}`));
  const today = todayOf({ name: "", role: "OWNER", now: NOW, orders: [], business: null, calls });
  assert.equal(today.calling, 6);
  assert.equal(today.todo.length, 4);
});

test("vendas: barras da primeira hora com venda até agora, com a barra de agora marcada", () => {
  const sales = salesOf({ summary, hours: hoursWith({ 10: 3, 11: 6, 12: 9, 15: 2, 19: 8 }) }, NOW);
  assert.equal(sales.total, 1284.5);
  assert.equal(sales.orders, 38);
  assert.equal(sales.averageTicket, 33.8);
  assert.equal(sales.hoursFrom, 10);
  assert.equal(sales.hours.length, 11, "das 10h às 20h");
  assert.deepEqual(sales.hours.slice(0, 3), [3, 6, 9]);
  assert.equal(sales.hours[9], 8);
  assert.equal(sales.hours[10], 0, "a hora de agora ainda sem pedido aparece vazia");
  assert.equal(sales.nowIndex, 10);
});

test("vendas: poucas horas ganham barras até ter seis, sem sair do dia", () => {
  const few = salesOf({ summary, hours: hoursWith({ 20: 4 }) }, NOW);
  assert.equal(few.hours.length, 6);
  assert.ok(few.hoursFrom >= 0 && few.hoursFrom + few.hours.length - 1 <= 23);
  assert.equal(few.hours[few.nowIndex], 4);
  assert.equal(few.hoursFrom + few.nowIndex, 20);

  const lateNight = salesOf({ summary, hours: hoursWith({ 23: 2 }) }, Date.parse("2026-10-22T02:30:00Z"));
  assert.equal(lateNight.hours.length, 6);
  assert.equal(lateNight.hoursFrom + lateNight.hours.length - 1, 23, "não passa das 23h");

  const earlyMorning = salesOf({ summary, hours: hoursWith({ 0: 1 }) }, Date.parse("2026-10-21T03:20:00Z"));
  assert.equal(earlyMorning.hoursFrom, 0, "não começa antes da meia-noite");
  assert.equal(earlyMorning.hours.length, 6);
});

test("vendas: sem nenhum pedido não há barra, e o ticket médio vazio fica vazio", () => {
  const none = salesOf({ summary: { revenue: 0, orders: 0, avg_ticket: null, dishes: 0, delivery_fees: 0 }, hours: hoursWith({}) }, NOW);
  assert.deepEqual(none, { total: 0, orders: 0, averageTicket: null, hours: [], hoursFrom: 20, nowIndex: -1 });
});

test("vendas: número ruim do servidor vira zero, nunca NaN", () => {
  const sales = salesOf({ summary: { revenue: "x", orders: undefined, avg_ticket: "y", dishes: 0, delivery_fees: 0 }, hours: [] }, NOW);
  assert.equal(sales.total, 0);
  assert.equal(sales.orders, 0);
  assert.equal(sales.averageTicket, null);
});

test("só dono e gerente veem vendas; os outros não ganham nem aviso de carregando", () => {
  const base = { name: "", now: NOW, orders: [], calls: [] };
  const business = { summary, hours: hoursWith({ 12: 5 }) };
  assert.ok(todayOf({ ...base, role: "OWNER", business }).sales);
  assert.ok(todayOf({ ...base, role: "MANAGER", business }).sales);
  for (const role of ["CASHIER", "WAITER", "KITCHEN", "COURIER"]) {
    const today = todayOf({ ...base, role, business });
    assert.equal(today.sales, null, role);
    assert.equal(today.salesMessage, undefined, role);
  }
  assert.equal(todayOf({ ...base, role: "KITCHEN", business: null }).salesMessage, undefined);
});

test("sem vendas ainda, o dono lê Carregando; se falhou, lê a frase de erro", () => {
  const base = { name: "", role: "OWNER", now: NOW, orders: [], calls: [], business: null };
  const loading = todayOf(base);
  assert.equal(loading.sales, null);
  assert.equal(loading.salesMessage, "Carregando as vendas…");
  const failed = todayOf({ ...base, businessError: "Não consegui abrir as vendas agora." });
  assert.equal(failed.salesMessage, "Não consegui abrir as vendas agora.");
  assert.equal(todayOf({ ...base, businessError: "   " }).salesMessage, "Carregando as vendas…");
});

test("os atalhos do dono são quatro, sem repetir o botão dos pedidos nem os números, e cada um leva a uma tela que existe", () => {
  const owner = shortcutsOf("OWNER");
  assert.equal(owner.length, 4);
  assert.deepEqual(
    owner.map((item) => item.view),
    ["assistente", "mesas", "meulink", "produtos"],
  );
  for (const item of owner) assert.ok(item.label.length > 3 && !/dashboard/i.test(item.label));
  assert.ok(!owner.some((item) => item.view === "pedidos" || item.view === "dashboard"));
  assert.ok(shortcutsOf("KITCHEN").length >= 1);
});

test("calcular o Hoje não mexe nas listas que recebe", () => {
  const orders = [pix(9), pix(1), order("em preparo", 5)];
  const calls = [call("c1"), call("c2")];
  const before = JSON.stringify({ orders, calls });
  todayOf({ name: "João", role: "OWNER", now: NOW, orders, calls, business: null });
  assert.equal(JSON.stringify({ orders, calls }), before);
});

test("os botões do Hoje levam a telas que existem no menu do painel", async () => {
  const { VIEWS } = await import("../../frontend/src/hoje/todayLogic.ts");
  const { menuViews } = await import("../../frontend/src/nav/navLogic.ts");
  const known = new Set(menuViews());
  for (const view of [VIEWS.orders, VIEWS.numbers, ...shortcutsOf("OWNER").map((item) => item.view)]) {
    assert.ok(known.has(view), `${view} não existe no menu`);
  }
});
