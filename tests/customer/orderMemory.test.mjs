import test from "node:test";
import assert from "node:assert/strict";

import {
  createOrderMemory,
  MAX_REMEMBERED,
  ORDER_TTL_MS,
} from "../../frontend/src/customer/orderMemory.ts";

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const order = (id, tableId = "t1") => ({ orderId: id, token: `tok-${id}`, slug: "jack", tableId });

test("an order sent is still there after the page reloads", () => {
  const storage = fakeStorage();
  createOrderMemory(storage).add(order("o1"));
  const reloaded = createOrderMemory(storage);
  assert.deepEqual(reloaded.list("jack", "t1").map((item) => item.orderId), ["o1"]);
});

test("a second order is added in front and the first keeps being tracked", () => {
  const memory = createOrderMemory(fakeStorage());
  memory.add(order("o1"));
  memory.add(order("o2"));
  assert.deepEqual(memory.list("jack", "t1").map((item) => item.orderId), ["o2", "o1"]);
});

test("only a few orders are kept", () => {
  const memory = createOrderMemory(fakeStorage());
  for (let i = 0; i < MAX_REMEMBERED + 3; i += 1) memory.add(order(`o${i}`));
  assert.equal(memory.list("jack", "t1").length, MAX_REMEMBERED);
});

test("orders expire after the time limit", () => {
  let now = 1_000_000;
  const memory = createOrderMemory(fakeStorage(), () => now);
  memory.add(order("o1"));
  now += ORDER_TTL_MS - 1;
  assert.equal(memory.list("jack", "t1").length, 1);
  now += 2;
  assert.equal(memory.list("jack", "t1").length, 0);
});

test("scanning another table's QR code does not bring back the old table's orders", () => {
  const memory = createOrderMemory(fakeStorage());
  memory.add(order("o1", "mesa-1"));
  assert.equal(memory.list("jack", "mesa-2").length, 0);
  assert.equal(memory.list("jack", "mesa-1").length, 1);
  assert.equal(memory.list("jack", null).length, 1);
});

test("restaurants do not see each other's orders", () => {
  const memory = createOrderMemory(fakeStorage());
  memory.add(order("o1"));
  assert.equal(memory.list("outro", "t1").length, 0);
});

test("removing an order leaves the others", () => {
  const memory = createOrderMemory(fakeStorage());
  memory.add(order("o1"));
  memory.add(order("o2"));
  assert.deepEqual(memory.remove("jack", "o2").map((item) => item.orderId), ["o1"]);
  assert.deepEqual(memory.remove("jack", "o1"), []);
});

test("garbage in storage is ignored instead of breaking the app", () => {
  const storage = fakeStorage();
  storage.setItem("vc_orders_jack", "{not json");
  assert.deepEqual(createOrderMemory(storage).list("jack", null), []);
  storage.setItem("vc_orders_jack", JSON.stringify([{ orderId: 1 }, "x", null]));
  assert.deepEqual(createOrderMemory(storage).list("jack", null), []);
});

test("blocked storage (private mode) never throws", () => {
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
  const memory = createOrderMemory(blocked);
  assert.doesNotThrow(() => memory.add(order("o1")));
  assert.deepEqual(memory.list("jack", null), []);
  assert.equal(memory.feedbackSent("o1"), false);
  assert.doesNotThrow(() => memory.saveName("Ana"));
  assert.equal(createOrderMemory(null).loadName(), "");
});

test("feedback is asked once per order and the name is remembered", () => {
  const memory = createOrderMemory(fakeStorage());
  assert.equal(memory.feedbackSent("o1"), false);
  memory.markFeedbackSent("o1");
  assert.equal(memory.feedbackSent("o1"), true);
  assert.equal(memory.feedbackSent("o2"), false);
  memory.saveName("Jack");
  assert.equal(memory.loadName(), "Jack");
  memory.saveName("");
  assert.equal(memory.loadName(), "");
});
