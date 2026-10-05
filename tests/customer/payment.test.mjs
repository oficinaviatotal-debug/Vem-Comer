import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  adminPaymentChip,
  availableMethods,
  canConfirmPayment,
  effectiveMethod,
  keepPolling,
  orderPaymentView,
  paymentNote,
} from "../../frontend/src/customer/payment.ts";

test("Pix is offered only when the restaurant set a Pix key", () => {
  assert.deepEqual(availableMethods(true).map((m) => m.value), ["pix", "cartao", "dinheiro"]);
  assert.deepEqual(availableMethods(false).map((m) => m.value), ["cartao", "dinheiro"]);
  assert.deepEqual(availableMethods(true).map((m) => m.label), ["Pix", "Cartão", "Dinheiro"]);
});

test("Pix is the suggestion when it exists, card when it does not", () => {
  assert.equal(effectiveMethod(null, true), "pix");
  assert.equal(effectiveMethod(null, false), "cartao");
});

test("what the customer chose is kept, except Pix after the restaurant turned it off", () => {
  assert.equal(effectiveMethod("dinheiro", true), "dinheiro");
  assert.equal(effectiveMethod("cartao", false), "cartao");
  assert.equal(effectiveMethod("pix", true), "pix");
  assert.equal(effectiveMethod("pix", false), "cartao");
});

test("the note under the tiles says where the Pix code appears", () => {
  assert.match(paymentNote("pix"), /código Pix aparece/);
  assert.match(paymentNote("cartao"), /atendente/);
  assert.match(paymentNote("dinheiro"), /atendente/);
});

test("a Pix order that is not paid shows the code", () => {
  assert.deepEqual(orderPaymentView("pix", "PENDING"), { kind: "pix-due" });
  assert.deepEqual(orderPaymentView("pix", undefined), { kind: "pix-due" });
});

test("a paid order shows 'received', whatever the method", () => {
  assert.deepEqual(orderPaymentView("pix", "PAID"), { kind: "paid" });
  assert.deepEqual(orderPaymentView("dinheiro", "paid"), { kind: "paid" });
});

test("card and cash orders say the customer settles with the attendant", () => {
  const card = orderPaymentView("cartao", "PENDING");
  assert.equal(card.kind, "at-table");
  assert.match(card.text, /cartão/);
  assert.match(card.text, /atendente/);
  const unknown = orderPaymentView(undefined, "PENDING");
  assert.equal(unknown.kind, "at-table");
  assert.match(unknown.text, /atendente/);
});

test("the slip keeps refreshing while a ready Pix order waits to be marked as paid", () => {
  assert.equal(keepPolling(false, "pix", "PENDING"), true);
  assert.equal(keepPolling(false, "cartao", "PENDING"), true);
  assert.equal(keepPolling(true, "pix", "PENDING"), true);
  assert.equal(keepPolling(true, "pix", "PAID"), false);
  assert.equal(keepPolling(true, "cartao", "PENDING"), false);
  assert.equal(keepPolling(true, "dinheiro", undefined), false);
});

test("order cards in the panel show a clear payment label", () => {
  assert.deepEqual(adminPaymentChip("pix", "PENDING"), { label: "Pix: aguardando", tone: "wait" });
  assert.deepEqual(adminPaymentChip("pix", "PAID"), { label: "Pix pago", tone: "ok" });
  assert.deepEqual(adminPaymentChip("dinheiro", "PENDING"), { label: "Dinheiro: receber", tone: "info" });
  assert.deepEqual(adminPaymentChip("cartao", "PAID"), { label: "Cartão pago", tone: "ok" });
});

test("only owner, manager and cashier can confirm a payment, and only once", () => {
  for (const role of ["OWNER", "MANAGER", "CASHIER"]) {
    assert.equal(canConfirmPayment(role, "PENDING"), true, role);
    assert.equal(canConfirmPayment(role, "PAID"), false, role);
  }
  for (const role of ["WAITER", "KITCHEN", "COURIER", "", null, undefined]) {
    assert.equal(canConfirmPayment(role, "PENDING"), false, String(role));
  }
});

test("the roles that see the button match the ones the server accepts", () => {
  const server = readFileSync(new URL("../../backend/app.py", import.meta.url), "utf8");
  const route = server.slice(server.indexOf("/payment/confirm"));
  const roles = route.match(/@require_roles\(([^)]*)\)/)[1];
  for (const role of ["OWNER", "MANAGER", "CASHIER"]) assert.ok(roles.includes(`'${role}'`), role);
  for (const role of ["WAITER", "KITCHEN", "COURIER"]) assert.ok(!roles.includes(`'${role}'`), role);
});
