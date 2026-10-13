import test from "node:test";
import assert from "node:assert/strict";

import { PAUSED_NOTICE, closedState, dropSoldOut, isSoldOut, soldOutNotice } from "../../frontend/src/customer/openness.ts";
import { CLOSED_NOTICE, orderErrorMessage } from "../../frontend/src/customer/labels.ts";

const hours = (patch = {}) => ({ configured: true, open_now: true, message: "Aberto até 23h.", paused: false, ...patch });

test("an older server that sends nothing closes nothing", () => {
  assert.equal(closedState({}, false), null);
  assert.equal(closedState({ accepting_orders: true }, true), null);
});

test("open now, or no hours: open", () => {
  assert.equal(closedState({ hours: hours() }, false), null);
  assert.equal(closedState({ hours: hours({ configured: false, open_now: true, message: "" }) }, false), null);
});

test("outside the hours: the server's sentence, and the menu can still be seen", () => {
  const closed = closedState({ hours: hours({ open_now: false, message: "Fechado agora. Abre hoje às 18h." }) }, false);
  assert.equal(closed.kind, "hours");
  assert.equal(closed.message, "Fechado agora. Abre hoje às 18h. Você pode ver o cardápio e pedir quando abrir.");
  // an empty sentence still says something
  assert.ok(closedState({ hours: hours({ open_now: false, message: "" }) }, false).message.startsWith("Fechado agora."));
});

test("the hours never close someone sitting at a table", () => {
  assert.equal(closedState({ hours: hours({ open_now: false, message: "Fechado agora." }) }, true), null);
});

test("hours that are not configured never close, whatever open_now says", () => {
  assert.equal(closedState({ hours: hours({ configured: false, open_now: false }) }, false), null);
});

test("the pause closes everybody, tables included, and wins over the rest", () => {
  const paused = closedState({ hours: hours({ paused: true }) }, true);
  assert.equal(paused.kind, "paused");
  assert.equal(paused.message, PAUSED_NOTICE);
  const both = closedState({ accepting_orders: false, hours: hours({ paused: true, open_now: false }) }, false);
  assert.equal(both.kind, "paused");
});

test("a restaurant that cannot take orders: the generic notice, no reason", () => {
  const off = closedState({ accepting_orders: false, hours: hours() }, true);
  assert.equal(off.kind, "off");
  assert.equal(off.message, CLOSED_NOTICE);
  assert.doesNotMatch(off.message, /plano|pagamento|assinatura|vencid/i);
});

test("sold out: only an explicit true", () => {
  assert.equal(isSoldOut({ sold_out: true }), true);
  assert.equal(isSoldOut({ sold_out: false }), false);
  assert.equal(isSoldOut({}), false);
  assert.equal(isSoldOut({ sold_out: "true" }), false);
});

test("a dish that ran out leaves the cart; the others stay and nothing changes when nothing ran out", () => {
  const cart = [
    { id: "a", name: "Pizza", price: 30, quantity: 1 },
    { id: "a", key: "a|g", name: "Pizza", price: 35, quantity: 2 },
    { id: "b", name: "Suco", price: 8, quantity: 1 },
    { id: "c", name: "Pudim", price: 9, quantity: 1 },
  ];
  const out = dropSoldOut(cart, [{ id: "a", sold_out: true }, { id: "b", sold_out: false }, { id: "c" }]);
  assert.deepEqual(out.cart.map((l) => l.id), ["b", "c"]);
  assert.deepEqual(out.removed, ["Pizza"]);
  const same = dropSoldOut(cart, [{ id: "a", sold_out: false }]);
  assert.equal(same.cart, cart);
  assert.deepEqual(same.removed, []);
  // a sold-out dish that is not in the cart changes nothing
  const other = dropSoldOut(cart, [{ id: "z", sold_out: true }]);
  assert.equal(other.cart, cart);
});

test("the notice for the dishes that ran out", () => {
  assert.equal(soldOutNotice([]), "");
  assert.equal(soldOutNotice(["Pizza"]), "Pizza acabou e saiu do seu pedido.");
  assert.equal(soldOutNotice(["Pizza", "Suco"]), "Pizza e Suco acabaram e saíram do seu pedido.");
  assert.equal(soldOutNotice(["Pizza", "Suco", "Pudim"]), "Pizza, Suco e Pudim acabaram e saíram do seu pedido.");
});

test("the server's own sentences reach the customer", () => {
  assert.equal(orderErrorMessage("Fechado agora. Abre hoje às 18h."), "Fechado agora. Abre hoje às 18h.");
  assert.equal(orderErrorMessage("Estamos com uma pausa nos pedidos. Tente de novo em alguns minutos."), PAUSED_NOTICE);
  assert.equal(
    orderErrorMessage("Pizza de mesa acabou. Tire do pedido e escolha outro item."),
    "Pizza de mesa acabou. Tire do pedido e escolha outro item."
  );
  // the old generic answers are unchanged
  assert.equal(orderErrorMessage("Produto indisponivel"), "Algum item saiu do cardápio. Atualize a página e confira o pedido.");
  assert.equal(orderErrorMessage("Mesa nao encontrada"), "Não encontramos esta mesa. Chame o atendente para te ajudar.");
});
