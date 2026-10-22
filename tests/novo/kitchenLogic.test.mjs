import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  advanceOf,
  emptyText,
  firstTabWithOrders,
  isKitchenTab,
  kitchenTabs,
  minutesSince,
  noteOf,
  ticketOf,
  ticketsFor,
} from "../../frontend/src/cozinha/kitchenLogic.ts";
import { ALL_STATUSES } from "../../frontend/src/service/orderStatus.ts";

const NOW = Date.parse("2026-10-21T20:00:00.000Z");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const order = (extra) => ({ id: "abcd1234-0000", status: "PENDING_PAYMENT", created_at: ago(5), items: [], ...extra });

test("minutesSince conta minutos inteiros e nunca inventa espera", () => {
  assert.equal(minutesSince(ago(7), NOW), 7);
  assert.equal(minutesSince(new Date(NOW - 7.9 * 60000).toISOString(), NOW), 7);
  assert.equal(minutesSince("Wed, 21 Oct 2026 19:50:00 GMT", NOW), 10);
  assert.equal(minutesSince("lixo", NOW), 0);
  assert.equal(minutesSince("", NOW), 0);
  assert.equal(minutesSince(null, NOW), 0);
  assert.equal(minutesSince(ago(-3), NOW), 0, "pedido com hora no futuro (relógio torto) vira 0");
});

test("as abas contam só o que é assunto de cozinha", () => {
  const orders = [
    order({ id: "a", status: "PENDING_PAYMENT" }),
    order({ id: "b", status: "PENDING_PAYMENT" }),
    order({ id: "c", status: "em preparo" }),
    order({ id: "d", status: "pronto" }),
    order({ id: "e", status: "saiu para entrega" }),
    order({ id: "f", status: "concluido" }),
  ];
  assert.deepEqual(kitchenTabs(orders), [
    { id: "new", label: "Novos", count: 2 },
    { id: "doing", label: "Fazendo", count: 1 },
    { id: "ready", label: "Prontos", count: 1 },
  ]);
  assert.deepEqual(
    kitchenTabs([]).map((tab) => tab.count),
    [0, 0, 0],
  );
});

test("a aba que abre sozinha é a primeira com pedido: Novos, depois Fazendo, depois Prontos", () => {
  assert.equal(firstTabWithOrders([]), "new");
  assert.equal(firstTabWithOrders([order({ status: "pronto" })]), "ready");
  assert.equal(firstTabWithOrders([order({ status: "pronto" }), order({ status: "em preparo" })]), "doing");
  assert.equal(firstTabWithOrders([order({ status: "pronto" }), order({ status: "PENDING_PAYMENT" })]), "new");
  assert.equal(firstTabWithOrders([order({ status: "concluido" })]), "new");
});

test("isKitchenTab só aceita as três etapas", () => {
  for (const id of ["new", "doing", "ready"]) assert.ok(isKitchenTab(id));
  for (const id of ["", "done", "NEW", "Novos"]) assert.ok(!isKitchenTab(id), id);
});

test("ticketsFor: só a etapa pedida, a mais antiga primeiro, sem mexer na lista original", () => {
  const orders = [
    order({ id: "novo1", created_at: ago(3) }),
    order({ id: "velho", created_at: ago(24) }),
    order({ id: "meio", created_at: ago(10) }),
    order({ id: "fogo", status: "em preparo", created_at: ago(40) }),
  ];
  const before = orders.map((entry) => entry.id);
  const tickets = ticketsFor(orders, "new", NOW);
  assert.deepEqual(
    tickets.map((ticket) => ticket.id),
    ["velho", "meio", "novo1"],
  );
  assert.deepEqual(tickets.map((ticket) => ticket.minutes), [24, 10, 3]);
  assert.deepEqual(orders.map((entry) => entry.id), before, "a lista de pedidos não foi reordenada");
  assert.deepEqual(ticketsFor(orders, "ready", NOW), []);
});

test("o botão da comanda segue o fluxo que o servidor aceita", () => {
  assert.equal(ticketOf(order({ status: "PENDING_PAYMENT", order_type: "mesa", table_number: "4" }), NOW).action, "Aceitar pedido");
  assert.equal(ticketOf(order({ status: "em preparo", order_type: "mesa", table_number: "4" }), NOW).action, "Pedido pronto");
  assert.equal(ticketOf(order({ status: "em preparo", order_type: "retirada" }), NOW).action, "Pedido pronto");
  assert.equal(ticketOf(order({ status: "em preparo", order_type: "entrega" }), NOW).action, "Pronto para entrega");
  assert.equal(ticketOf(order({ status: "pronto", order_type: "entrega" }), NOW).action, "Saiu para entrega");
});

test("advanceOf devolve só status que o servidor conhece, e nada quando acabou o trabalho da cozinha", () => {
  for (const [status, type] of [
    ["PENDING_PAYMENT", "mesa"],
    ["em preparo", "mesa"],
    ["em preparo", "entrega"],
    ["pronto", "entrega"],
  ]) {
    const step = advanceOf(order({ status, order_type: type }));
    assert.ok(step, `${status}/${type}`);
    assert.ok(ALL_STATUSES.includes(step.next), `${step.next} não existe no servidor`);
  }
  assert.equal(advanceOf(order({ status: "concluido" })), null);
  assert.equal(ticketOf(order({ status: "concluido" }), NOW).action, "", "sem botão quando não há o que fazer");
});

test("a comanda diz onde: Mesa 4, Entrega, Retirada, Balcão", () => {
  assert.equal(ticketOf(order({ order_type: "mesa", table_number: "4" }), NOW).where, "Mesa 4");
  assert.equal(ticketOf(order({ order_type: "entrega" }), NOW).where, "Entrega");
  assert.equal(ticketOf(order({ order_type: "retirada" }), NOW).where, "Retirada");
  assert.equal(ticketOf(order({}), NOW).where, "Balcão");
  assert.equal(ticketOf(order({ table_number: "9" }), NOW).where, "Mesa 9", "pedido antigo, sem tipo, com mesa");
});

test("o número do pedido é o código curto que se fala em voz alta", () => {
  assert.equal(ticketOf(order({ id: "dddd1111-aaaa-bbbb" }), NOW).number, "#DDDD");
  assert.equal(ticketOf(order({ id: "" }), NOW).number, "");
});

test("os pratos aparecem com quantidade, nome e o que o cliente escolheu, sem preço", () => {
  const ticket = ticketOf(
    order({
      items: [
        { name: "Açaí 500 ml", quantity: 2, options: [{ group: "Extras", name: "granola", price: 2 }, { name: " banana " }] },
        { name: "Suco de caju", quantity: 1 },
      ],
    }),
    NOW,
  );
  assert.deepEqual(ticket.lines, [
    { qty: 2, name: "Açaí 500 ml", detail: "granola, banana" },
    { qty: 1, name: "Suco de caju", detail: undefined },
  ]);
});

test("dado ruim não faz prato sumir: quantidade vazia vira 1 e nome vazio vira Item N", () => {
  const ticket = ticketOf(order({ items: [{ name: "", quantity: 0 }, { name: "Pastel", quantity: Number.NaN }] }), NOW);
  assert.deepEqual(ticket.lines.map((line) => [line.qty, line.name]), [
    [1, "Item 1"],
    [1, "Pastel"],
  ]);
  assert.deepEqual(ticketOf(order({ items: null }), NOW).lines, [], "pedido sem lista de itens não quebra");
  assert.deepEqual(ticketOf({ id: "x", status: "PENDING_PAYMENT", created_at: ago(1) }, NOW).lines, []);
});

test("dois pratos de mesmo nome continuam duas linhas", () => {
  const ticket = ticketOf(order({ items: [{ name: "Açaí", quantity: 1, options: [{ name: "granola" }] }, { name: "Açaí", quantity: 1 }] }), NOW);
  assert.equal(ticket.lines.length, 2);
});

test("noteOf: frase pura quando só há um prato; com o nome do prato quando há vários", () => {
  assert.equal(noteOf([]), undefined);
  assert.equal(noteOf([{ name: "Pastel", quantity: 1 }]), undefined);
  assert.equal(noteOf([{ name: "Pastel", quantity: 1, note: "  sem   cebola " }]), "sem cebola");
  assert.equal(
    noteOf([
      { name: "Pastel", quantity: 1, note: "sem cebola" },
      { name: "Suco", quantity: 1 },
    ]),
    "Pastel: sem cebola",
  );
  assert.equal(
    noteOf([
      { name: "Pastel", quantity: 1, note: "sem cebola" },
      { name: "Suco", quantity: 1, note: "sem gelo" },
    ]),
    "Pastel: sem cebola · Suco: sem gelo",
  );
  assert.equal(noteOf([{ name: "Pastel", quantity: 1, note: "   " }]), undefined);
});

test("etapa vazia diz o que fazer, em frase inteira e sem jargão", () => {
  const banned = /\b(dashboard|checkout|onboarding|template|upload|click here|status|ticket)\b/i;
  for (const tab of ["new", "doing", "ready"]) {
    const text = emptyText(tab);
    assert.match(text, /\.$/, `${tab} termina com ponto`);
    assert.ok(text.length > 20);
    assert.ok(!banned.test(text), `${tab} tem jargão`);
  }
});

// A cozinha nova ainda NÃO está ligada ao aplicativo que o público usa: só a página de conferência a enxerga.
// Quando o GD disser "pode", o PR que liga a tela troca esta cerca por um teste da ligação.
test("nada do aplicativo importa o visual novo nem as telas novas (cozinha, hoje, loja): ainda não foram ao ar", () => {
  const root = fileURLToPath(new URL("../../frontend/src/", import.meta.url));
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      const relative = path.slice(root.length);
      if (!/\.(ts|tsx)$/.test(name) || /^(novo|cozinha|hoje|loja|painel)\//.test(relative)) continue;
      if (/from ["'][^"']*\/(novo|cozinha|hoje|loja|painel)\//.test(readFileSync(path, "utf8"))) offenders.push(relative);
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});
