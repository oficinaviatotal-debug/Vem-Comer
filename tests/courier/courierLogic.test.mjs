import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CODE_LENGTH,
  EMPTY_TEXT,
  NO_CASH_TEXT,
  allIds,
  cashHeld,
  cashHeldText,
  cashLine,
  cashLineText,
  centsOf,
  codeIsComplete,
  deliverResult,
  deliveredText,
  groupOrders,
  headline,
  mapsUrl,
  moneyText,
  normalizeCash,
  normalizeOrders,
  onlyCodeDigits,
  selectedCents,
  settleLabel,
  settledText,
  stageOf,
  telUrl,
  toggleId,
} from "../../frontend/src/courier/courierLogic.ts";

const order = (extra = {}) => ({
  id: "o1",
  customer_name: "Ana",
  phone: "31999998888",
  address: "Rua A, 10",
  reference: "",
  zone: "Centro",
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
});

test("the code has the same length on the phone and on the server", () => {
  const python = readFileSync(new URL("../../backend/courier.py", import.meta.url), "utf8");
  assert.equal(Number(/^CODE_LENGTH = (\d+)/m.exec(python)[1]), CODE_LENGTH);
});

test("every field the screen reads is one the server sends", () => {
  const python = readFileSync(new URL("../../backend/courier.py", import.meta.url), "utf8");
  const view = python.slice(python.indexOf("def order_view"), python.indexOf("def settlement_view"));
  for (const field of Object.keys(order())) assert.ok(view.includes(`"${field}"`), field);
  const settlement = python.slice(python.indexOf("def settlement_view"), python.indexOf("def clean_settle_ids"));
  for (const field of ["courier_id", "name", "total", "orders", "count", "id", "customer_name", "amount", "zone", "delivered_at"]) {
    assert.ok(settlement.includes(`"${field}"`), field);
  }
});

test("money in cents and in reais", () => {
  assert.equal(centsOf("50.00"), 5000);
  assert.equal(centsOf("12.5"), 1250);
  for (const bad of ["", null, undefined, "x", "-3", NaN]) assert.equal(centsOf(bad), 0, String(bad));
  assert.equal(moneyText(5000), "R$ 50,00");
  assert.equal(moneyText(-5), "R$ 0,00");
});

test("a delivery is ready, going, with another courier or done", () => {
  assert.equal(stageOf(order()), "ready");
  assert.equal(stageOf(order({ status: "saiu para entrega", mine: true })), "going");
  // sent out by the restaurant's own button, nobody's yet: still waits for someone to take it
  assert.equal(stageOf(order({ status: "saiu para entrega" })), "ready");
  assert.equal(stageOf(order({ status: "saiu para entrega", taken_by_other: true })), "other");
  assert.equal(stageOf(order({ status: "concluido", mine: true })), "done");
});

test("the list is split in groups, the oldest waiting first and the latest delivered first", () => {
  const groups = groupOrders([
    order({ id: "a" }),
    order({ id: "b", status: "saiu para entrega", mine: true }),
    order({ id: "c" }),
    order({ id: "d", status: "concluido", mine: true, delivered_at: "2026-10-13T10:00:00Z" }),
    order({ id: "e", status: "concluido", mine: true, delivered_at: "2026-10-13T12:00:00Z" }),
    order({ id: "f", status: "saiu para entrega", taken_by_other: true }),
  ]);
  assert.deepEqual(groups.ready.map((o) => o.id), ["a", "c"]);
  assert.deepEqual(groups.going.map((o) => o.id), ["b"]);
  assert.deepEqual(groups.other.map((o) => o.id), ["f"]);
  assert.deepEqual(groups.done.map((o) => o.id), ["e", "d"]);
});

test("the headline counts what there is to do", () => {
  assert.equal(headline(groupOrders([])), "");
  assert.equal(headline(groupOrders([order(), order({ id: "x" })])), "2 para pegar");
  assert.equal(
    headline(groupOrders([order(), order({ id: "b", status: "saiu para entrega", mine: true })])),
    "1 para pegar · 1 a caminho"
  );
  assert.match(EMPTY_TEXT, /Nenhuma entrega/);
});

test("the cash he still owes the cashier", () => {
  const done = (extra) => order({ status: "concluido", mine: true, ...extra });
  const held = cashHeld([
    done({ id: "1", cash_received: "50.00" }),
    done({ id: "2", cash_received: "12.50" }),
    done({ id: "3", cash_received: "20.00", settled: true }), // already counted
    done({ id: "4", cash_received: "" }), // paid by pix
    order({ id: "5", status: "saiu para entrega", mine: true, cash_received: "9.00" }), // not delivered yet
    done({ id: "6", mine: false, cash_received: "8.00" }), // not his
  ]);
  assert.deepEqual(held, { cents: 6250, count: 2 });
  assert.equal(cashHeldText(held), "Você está com R$ 62,50 em dinheiro de 2 entregas. Entregue ao caixa para o acerto.");
  assert.match(cashHeldText({ cents: 5000, count: 1 }), /de 1 entrega\./);
  assert.equal(cashHeldText({ cents: 0, count: 0 }), "");
});

test("links open the maps app and the phone, only when there is something to open", () => {
  assert.equal(
    mapsUrl({ address: "Rua das Flores, 120 · Centro", zone: "" }),
    "https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%20120%20%C2%B7%20Centro"
  );
  assert.equal(mapsUrl({ address: "  ", zone: "Centro" }), "");
  assert.equal(telUrl("(31) 99999-8888"), "tel:+5531999998888");
  assert.equal(telUrl("5531999998888"), "tel:+5531999998888");
  assert.equal(telUrl("3133334444"), "tel:+553133334444");
  for (const bad of ["", "123", "999", null, undefined]) assert.equal(telUrl(bad), "", String(bad));
});

test("the cash line tells the amount and the change to give back", () => {
  assert.equal(cashLine(order()), null);
  const line = cashLine(order({ cash_to_receive: "50.00", change_back: "50.00" }));
  assert.deepEqual(line, { receive: "R$ 50,00", change: "R$ 50,00" });
  assert.equal(cashLineText(line), "Receber R$ 50,00 em dinheiro. Leve R$ 50,00 de troco.");
  const exact = cashLine(order({ cash_to_receive: "47.90", change_back: "" }));
  assert.equal(cashLineText(exact), "Receber R$ 47,90 em dinheiro (valor exato).");
});

test("the code field keeps only numbers, at most four", () => {
  assert.equal(onlyCodeDigits("4a8 2-1"), "4821");
  assert.equal(onlyCodeDigits("4a8 2"), "482");
  assert.equal(onlyCodeDigits("482199"), "4821");
  assert.equal(onlyCodeDigits("٤٨٢١"), "");
  assert.equal(onlyCodeDigits(null), "");
  assert.equal(codeIsComplete("4821"), true);
  assert.equal(codeIsComplete("482"), false);
});

test("what the server answered to Entreguei becomes what the screen shows", () => {
  assert.deepEqual(deliverResult(200, { ok: true, already: false, cash_to_hand_over: "50.00" }), {
    kind: "done",
    already: false,
    cashCents: 5000,
  });
  assert.deepEqual(deliverResult(200, { ok: true, already: true, cash_to_hand_over: "0.00" }), {
    kind: "done",
    already: true,
    cashCents: 0,
  });
  assert.deepEqual(deliverResult(400, { error: "Código errado.", wrong_code: true, attempts_left: 4, locked: false }), {
    kind: "wrong",
    message: "Código errado.",
    attemptsLeft: 4,
  });
  assert.equal(deliverResult(423, { error: "Bloqueado", wrong_code: true, attempts_left: 0, locked: true }).kind, "locked");
  assert.equal(deliverResult(423, {}).kind, "locked");
  assert.deepEqual(deliverResult(409, { error: "Este pedido está com outro motoqueiro." }), {
    kind: "error",
    message: "Este pedido está com outro motoqueiro.",
  });
  assert.equal(deliverResult(500, null).kind, "error");
  assert.match(deliverResult(502, "<html>").message, /Não consegui/);
  // a 200 that does not say ok is not a delivery
  assert.equal(deliverResult(200, {}).kind, "error");
});

test("after delivering, the courier is told what to keep", () => {
  assert.equal(deliveredText({ kind: "done", already: false, cashCents: 0 }), "Entrega concluída.");
  assert.equal(
    deliveredText({ kind: "done", already: false, cashCents: 4790 }),
    "Entrega concluída. Guarde R$ 47,90 do cliente para o acerto com o caixa."
  );
  assert.equal(deliveredText({ kind: "done", already: true, cashCents: 0 }), "Esta entrega já estava fechada.");
});

const cashView = () =>
  normalizeCash({
    couriers: [
      {
        courier_id: "k1",
        name: "Ana",
        total: "62.50",
        count: 2,
        orders: [
          { id: "o1", customer_name: "A", amount: "50.00", zone: "Centro", delivered_at: "2026-10-13T15:30:00Z" },
          { id: "o2", customer_name: "B", amount: "12.50", zone: "", delivered_at: null },
        ],
      },
    ],
    total: "62.50",
    count: 2,
  });

test("the cashier ticks the deliveries and sees the total of what is ticked", () => {
  const group = cashView().couriers[0];
  assert.deepEqual(allIds(group), ["o1", "o2"]);
  assert.equal(selectedCents(group, ["o1", "o2"]), 6250);
  assert.equal(selectedCents(group, ["o2"]), 1250);
  assert.equal(selectedCents(group, []), 0);
  assert.equal(selectedCents(group, ["outro"]), 0);
  assert.deepEqual(toggleId(["o1"], "o2"), ["o1", "o2"]);
  assert.deepEqual(toggleId(["o1", "o2"], "o1"), ["o2"]);
});

test("the button says exactly what is being received", () => {
  const group = cashView().couriers[0];
  assert.equal(settleLabel(group, ["o1", "o2"]), "Recebi R$ 62,50 de Ana (2 entregas)");
  assert.equal(settleLabel(group, ["o2"]), "Recebi R$ 12,50 de Ana (1 entrega)");
  assert.equal(settledText({ count: 2, total: "62.50" }), "2 entregas acertadas: R$ 62,50 no caixa.");
  assert.equal(settledText({ count: 1, total: "12.50" }), "1 entrega acertada: R$ 12,50 no caixa.");
  assert.match(NO_CASH_TEXT, /acertado/);
});

test("strange answers from the server never break the screen", () => {
  assert.deepEqual(normalizeOrders(null), []);
  assert.deepEqual(normalizeOrders({ error: "x" }), []);
  assert.deepEqual(normalizeOrders([null, 3, { id: 5 }, { id: "a" }, { id: "a", status: "pronto" }]).map((o) => o.id), ["a"]);
  const clean = normalizeOrders([{ id: "a", status: "pronto", customer_name: 7, mine: "sim" }])[0];
  assert.equal(clean.customer_name, "");
  assert.equal(clean.mine, false);
  assert.equal(clean.cash_to_receive, "0.00");

  assert.deepEqual(normalizeCash(undefined), { couriers: [], total: "0.00", count: 0 });
  assert.deepEqual(normalizeCash({ couriers: "x" }), { couriers: [], total: "0.00", count: 0 });
  const odd = normalizeCash({ couriers: [{ courier_id: "k", orders: [{ id: 3 }] }, { courier_id: 9, orders: [] }] });
  assert.deepEqual(odd.couriers, []);
});

test("the total is recomputed from the rows, not trusted from the header", () => {
  const view = normalizeCash({
    couriers: [{ courier_id: "k", name: "Ana", total: "999.00", orders: [{ id: "o", amount: "10.00" }] }],
    total: "999.00",
    count: 99,
  });
  assert.equal(view.total, "10.00");
  assert.equal(view.count, 1);
});
