import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ALL_STATUSES,
  STATUS_DONE,
  STATUS_OUT,
  STATUS_PENDING,
  STATUS_PREPARING,
  STATUS_READY,
  isActiveStatus,
  nextAction,
  sortForKitchen,
  statusLabel,
  statusTone,
} from "../../frontend/src/service/orderStatus.ts";

test("status words match what the backend accepts", () => {
  assert.equal(STATUS_PENDING, "PENDING_PAYMENT");
  assert.equal(STATUS_PREPARING, "em preparo");
  assert.equal(STATUS_DONE, "concluido");
});

test("the words are the same ones backend/order_status.py accepts", () => {
  const source = readFileSync(new URL("../../backend/order_status.py", import.meta.url), "utf8");
  const word = (name) => new RegExp(`^${name} = "(.+)"$`, "m").exec(source)?.[1];
  assert.equal(STATUS_PENDING, word("PENDING"));
  assert.equal(STATUS_PREPARING, word("PREPARING"));
  assert.equal(STATUS_READY, word("READY"));
  assert.equal(STATUS_OUT, word("OUT_FOR_DELIVERY"));
  assert.equal(STATUS_DONE, word("DONE"));
  assert.deepEqual([...ALL_STATUSES], [STATUS_PENDING, STATUS_PREPARING, STATUS_READY, STATUS_OUT, STATUS_DONE]);
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
  assert.equal(isActiveStatus(STATUS_READY), true);
  assert.equal(isActiveStatus(STATUS_OUT), true);
  assert.equal(isActiveStatus(STATUS_DONE), false);
});

test("a delivery goes accept -> ready -> out -> delivered, one tap each", () => {
  assert.deepEqual(nextAction(STATUS_PENDING, "entrega"), { label: "Aceitar pedido", next: STATUS_PREPARING });
  const cooked = nextAction(STATUS_PREPARING, "entrega");
  assert.equal(cooked.label, "Pronto para entrega");
  assert.equal(cooked.next, STATUS_READY);
  assert.deepEqual(nextAction(STATUS_READY, "entrega"), { label: "Saiu para entrega", next: STATUS_OUT });
  assert.deepEqual(nextAction(STATUS_OUT, "entrega"), { label: "Entregue", next: STATUS_DONE });
  assert.equal(nextAction(STATUS_DONE, "entrega"), null);
});

test("a small shop can skip 'ready': one extra button goes straight to 'out for delivery'", () => {
  assert.deepEqual(nextAction(STATUS_PREPARING, "entrega").skip, { label: "Já saiu para entrega", next: STATUS_OUT });
  // Only while cooking, only for deliveries.
  assert.equal(nextAction(STATUS_READY, "entrega").skip, undefined);
  assert.equal(nextAction(STATUS_PREPARING, "retirada").skip, undefined);
});

test("table, counter and pickup orders keep the old flow", () => {
  for (const kind of ["mesa", "balcao", "retirada", null, undefined]) {
    assert.deepEqual(nextAction(STATUS_PREPARING, kind), { label: "Pedido pronto", next: STATUS_DONE }, String(kind));
  }
});

test("the labels say what each delivery step is, and a finished delivery says delivered", () => {
  assert.equal(statusLabel(STATUS_READY), "Pode sair");
  assert.equal(statusLabel(STATUS_OUT), "A caminho");
  assert.equal(statusLabel(STATUS_DONE, "entrega"), "Entregue");
  assert.equal(statusLabel(STATUS_DONE, "mesa"), "Pronto");
  assert.equal(statusLabel(STATUS_DONE, "retirada"), "Pronto");
  // The dashboard has no order type: it still reads.
  assert.equal(statusLabel(STATUS_DONE), "Pronto");
  const labels = ALL_STATUSES.map((status) => statusLabel(status));
  assert.equal(new Set(labels).size, labels.length, "no two situations share a label in the dashboard list");
});

test("each status has a chip colour that exists in ui.css", () => {
  const css = readFileSync(new URL("../../frontend/src/ui.css", import.meta.url), "utf8");
  for (const status of ALL_STATUSES) {
    assert.match(css, new RegExp(`\\.chip-${statusTone(status)}\\b`), status);
  }
  assert.equal(statusTone(STATUS_READY), "go");
  assert.equal(statusTone(STATUS_OUT), "go");
  assert.equal(statusTone("algo novo"), "wait");
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
