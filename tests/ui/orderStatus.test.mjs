import test from "node:test";
import assert from "node:assert/strict";

import {
  STATUS_DONE,
  STATUS_PENDING,
  STATUS_PREPARING,
  isActiveStatus,
  nextAction,
  sortForKitchen,
  statusLabel,
} from "../../frontend/src/service/orderStatus.ts";

test("status words match what the backend accepts", () => {
  assert.equal(STATUS_PENDING, "PENDING_PAYMENT");
  assert.equal(STATUS_PREPARING, "em preparo");
  assert.equal(STATUS_DONE, "concluido");
});

test("labels are plain Portuguese and unknown values pass through", () => {
  assert.equal(statusLabel(STATUS_PENDING), "Aguardando");
  assert.equal(statusLabel(STATUS_PREPARING), "Em preparo");
  assert.equal(statusLabel(STATUS_DONE), "Pronto");
  assert.equal(statusLabel("pendente"), "pendente");
});

test("each open order has exactly one next action, finished ones have none", () => {
  assert.deepEqual(nextAction(STATUS_PENDING), { label: "Aceitar pedido", next: STATUS_PREPARING });
  assert.deepEqual(nextAction(STATUS_PREPARING), { label: "Pedido pronto", next: STATUS_DONE });
  assert.equal(nextAction(STATUS_DONE), null);
  assert.equal(nextAction("whatever"), null);
});

test("only finished orders are inactive", () => {
  assert.equal(isActiveStatus(STATUS_PENDING), true);
  assert.equal(isActiveStatus(STATUS_PREPARING), true);
  assert.equal(isActiveStatus(STATUS_DONE), false);
});

test("kitchen order: open orders oldest first, then finished newest first", () => {
  const orders = [
    { id: "done-old", status: STATUS_DONE, created_at: "2026-10-05T10:00:00Z" },
    { id: "open-new", status: STATUS_PENDING, created_at: "2026-10-05T12:00:00Z" },
    { id: "done-new", status: STATUS_DONE, created_at: "2026-10-05T11:00:00Z" },
    { id: "open-old", status: STATUS_PREPARING, created_at: "2026-10-05T09:00:00Z" },
  ];
  const sorted = sortForKitchen(orders).map((order) => order.id);
  assert.deepEqual(sorted, ["open-old", "open-new", "done-new", "done-old"]);
  // The input list is left untouched.
  assert.equal(orders[0].id, "done-old");
});
