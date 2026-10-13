import test from "node:test";
import assert from "node:assert/strict";

import { knownOrderIds, newOrders, wantsNewOrderAlert } from "../../frontend/src/service/newOrders.ts";
import { alertDevice, alertDuration, alertPlan } from "../../frontend/src/service/alertDevice.ts";

const order = (id) => ({ id, status: "PENDING_PAYMENT" });

test("opening the panel makes no noise for the orders already there", () => {
  assert.deepEqual(newOrders(null, [order("a"), order("b")]), []);
});

test("an order that was not there at the last check is new", () => {
  const known = knownOrderIds([order("a"), order("b")]);
  assert.deepEqual(newOrders(known, [order("c"), order("a"), order("b")]).map((o) => o.id), ["c"]);
  assert.deepEqual(newOrders(known, [order("a"), order("b")]), []);
  assert.deepEqual(newOrders(known, []), []);
});

test("it still works when the list is full: the oldest leave, the newest come", () => {
  // the server sends only the 200 latest; the old way counted them and the number never grew
  const full = Array.from({ length: 200 }, (_, i) => order(`o${i}`));
  const known = knownOrderIds(full);
  const next = [order("new"), ...full.slice(0, 199)];
  assert.equal(next.length, full.length);
  assert.deepEqual(newOrders(known, next).map((o) => o.id), ["new"]);
});

test("an order that only left the window of 200 is not an alarm", () => {
  const known = knownOrderIds([order("a"), order("b"), order("c")]);
  assert.deepEqual(newOrders(known, [order("a"), order("b")]), []);
});

test("two new orders at once are both new", () => {
  const known = knownOrderIds([order("a")]);
  assert.deepEqual(newOrders(known, [order("c"), order("b"), order("a")]).map((o) => o.id), ["c", "b"]);
});

test("everybody on the team hears the alert except the courier, who has his own screen", () => {
  for (const role of ["OWNER", "MANAGER", "KITCHEN", "CASHIER", "WAITER"]) assert.equal(wantsNewOrderAlert(role), true, role);
  assert.equal(wantsNewOrderAlert("COURIER"), false);
  assert.equal(wantsNewOrderAlert(null), false);
  assert.equal(wantsNewOrderAlert(undefined), false);
});

test("each alert has its own sound and vibration", () => {
  for (const kind of ["order", "call", "urgent", "ready"]) {
    const plan = alertPlan(kind);
    assert.ok(plan.vibrate.length > 0, kind);
    assert.ok(plan.notes.length > 0, kind);
    for (const note of plan.notes) {
      assert.ok(note.freq >= 300 && note.freq <= 2000, `${kind} frequency`);
      assert.ok(note.at >= 0 && note.length > 0 && note.length <= 0.6, `${kind} note`);
    }
    assert.ok(alertDuration(plan) < 1.5, `${kind} is short`);
  }
  const sounds = new Set(["order", "call", "urgent", "ready"].map((kind) => JSON.stringify(alertPlan(kind).notes)));
  assert.equal(sounds.size, 4, "four different sounds");
  // a new order is two notes going up, so it is not mistaken for a table calling
  const [first, second] = alertPlan("order").notes;
  assert.ok(second.freq > first.freq && second.at > first.at);
});

test("the table calls keep the sound they always had", () => {
  assert.deepEqual(alertPlan("call").notes, [{ freq: 660, at: 0, length: 0.4 }]);
  assert.deepEqual(alertPlan("urgent").notes, [{ freq: 880, at: 0, length: 0.4 }]);
  assert.deepEqual(alertPlan("call").vibrate, [200, 100, 200]);
  assert.deepEqual(alertPlan("urgent").vibrate, [300, 120, 300, 120, 300]);
});

test("alerting where there is no sound or vibration never throws", () => {
  // Node has no window and no navigator.vibrate: the device just stays quiet
  assert.doesNotThrow(() => alertDevice("order"));
});
