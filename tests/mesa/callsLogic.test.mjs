import test from "node:test";
import assert from "node:assert/strict";

import {
  CALL_AGAIN_AFTER_MS,
  CALL_TTL_MS,
  MAIN_CALLS,
  SMALL_CALLS,
  barTitle,
  becameUrgent,
  buttonState,
  callErrorMessage,
  createCallMemory,
  formatWaiting,
  freshCalls,
  isKind,
  parsePanelCalls,
  safeJobsUrl,
} from "../../frontend/src/mesa/callsLogic.ts";

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const garcom = MAIN_CALLS[0];

test("the table screen has the two big buttons and the two small ones", () => {
  assert.deepEqual(MAIN_CALLS.map((o) => o.kind), ["garcom", "conta"]);
  assert.deepEqual(SMALL_CALLS.map((o) => o.kind), ["agua", "limpeza"]);
  assert.ok(isKind("agua") && !isKind("pizza") && !isKind(null));
});

test("a call made is still remembered after the page reloads", () => {
  const storage = fakeStorage();
  createCallMemory(storage).put("jack", "t1", { id: "c1", kind: "garcom", status: "open" });
  const reloaded = createCallMemory(storage);
  assert.deepEqual(reloaded.list("jack", "t1").map((c) => c.id), ["c1"]);
});

test("each table remembers its own calls", () => {
  const memory = createCallMemory(fakeStorage());
  memory.put("jack", "t1", { id: "c1", kind: "garcom", status: "open" });
  assert.equal(memory.list("jack", "t2").length, 0);
  assert.equal(memory.list("outro", "t1").length, 0);
});

test("one call per kind: a new one replaces the old one", () => {
  const memory = createCallMemory(fakeStorage());
  memory.put("jack", "t1", { id: "c1", kind: "garcom", status: "answered" });
  memory.put("jack", "t1", { id: "c2", kind: "conta", status: "open" });
  const list = memory.put("jack", "t1", { id: "c3", kind: "garcom", status: "open" });
  assert.deepEqual(list.map((c) => c.id).sort(), ["c2", "c3"]);
});

test("answered is remembered", () => {
  const memory = createCallMemory(fakeStorage());
  memory.put("jack", "t1", { id: "c1", kind: "garcom", status: "open" });
  const list = memory.setStatus("jack", "t1", "c1", "answered");
  assert.equal(list[0].status, "answered");
  assert.equal(memory.list("jack", "t1")[0].status, "answered");
});

test("a call older than the server window is forgotten", () => {
  const storage = fakeStorage();
  let clock = 1_000_000;
  const memory = createCallMemory(storage, () => clock);
  memory.put("jack", "t1", { id: "c1", kind: "garcom", status: "open" });
  clock += CALL_TTL_MS + 1;
  assert.equal(memory.list("jack", "t1").length, 0);
});

test("blocked or broken storage never breaks the screen", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  const memory = createCallMemory(blocked);
  assert.deepEqual(memory.list("jack", "t1"), []);
  assert.doesNotThrow(() => memory.put("jack", "t1", { id: "c1", kind: "garcom", status: "open" }));
  assert.deepEqual(createCallMemory(null).list("jack", "t1"), []);
  const garbage = fakeStorage();
  garbage.setItem("vc_calls_jack_t1", "{nao e json");
  assert.deepEqual(createCallMemory(garbage).list("jack", "t1"), []);
  garbage.setItem("vc_calls_jack_t1", JSON.stringify([{ id: 5 }, null, { id: "x", kind: "pizza", status: "open", savedAt: 1 }]));
  assert.deepEqual(createCallMemory(garbage).list("jack", "t1"), []);
});

test("the button: free, then called (wait), then call again, then answered", () => {
  const sent = { id: "c1", kind: "garcom", status: "open", savedAt: 1000 };
  assert.equal(buttonState(garcom, undefined, 1000).disabled, false);
  assert.equal(buttonState(garcom, undefined, 1000).label, "Chamar garçom");

  const waiting = buttonState(garcom, sent, 1000 + CALL_AGAIN_AFTER_MS - 1);
  assert.equal(waiting.label, "Chamado");
  assert.equal(waiting.disabled, true);

  const again = buttonState(garcom, sent, 1000 + CALL_AGAIN_AFTER_MS);
  assert.equal(again.label, "Chamar de novo");
  assert.equal(again.disabled, false);

  const done = buttonState(garcom, { ...sent, status: "answered" }, 1000);
  assert.equal(done.answered, true);
  assert.equal(done.disabled, false);
});

test("error messages: the server's own text on a 429, a table message on 404, call by hand otherwise", () => {
  assert.equal(callErrorMessage(429, "Já avisamos várias vezes."), "Já avisamos várias vezes.");
  assert.match(callErrorMessage(404, "Mesa nao encontrada"), /mesa/i);
  assert.match(callErrorMessage(null, null), /chame o atendente/i);
  assert.match(callErrorMessage(500, "boom"), /chame o atendente/i);
});

test("waiting time reads like a person says it", () => {
  assert.equal(formatWaiting(0), "agora");
  assert.equal(formatWaiting(9), "agora");
  assert.equal(formatWaiting(47), "há 40 s");
  assert.equal(formatWaiting(60), "há 1 min");
  assert.equal(formatWaiting(200), "há 3 min");
  assert.equal(formatWaiting(3600), "há 1 h 00");
  assert.equal(formatWaiting(3900), "há 1 h 05");
  assert.equal(formatWaiting(-5), "agora");
  assert.equal(formatWaiting(Number.NaN), "agora");
});

const call = (id, urgency = "normal", extra = {}) => ({
  id,
  table_number: 4,
  kind: "garcom",
  label: "Garçom",
  text: "Mesa 4 chama o garçom",
  waiting_seconds: 5,
  repeats: 0,
  urgency,
  ...extra,
});

test("the panel does not make noise for what was already open when it loaded", () => {
  assert.deepEqual(freshCalls(null, [call("a"), call("b")]), []);
});

test("the panel alerts only for calls it has not seen", () => {
  const fresh = freshCalls(new Set(["a"]), [call("a"), call("b")]);
  assert.deepEqual(fresh.map((c) => c.id), ["b"]);
});

test("a known call that became urgent alerts once", () => {
  const before = new Map([["a", "normal"], ["b", "urgent"], ["c", "late"]]);
  const now = [call("a", "urgent"), call("b", "urgent"), call("c", "late"), call("d", "urgent")];
  assert.deepEqual(becameUrgent(before, now).map((c) => c.id), ["a"]);
});

test("the bar title counts the tables", () => {
  assert.equal(barTitle(0), "");
  assert.equal(barTitle(1), "1 mesa chamando");
  assert.equal(barTitle(3), "3 mesas chamando");
});

test("the panel ignores anything the server sent wrong", () => {
  assert.deepEqual(parsePanelCalls("x"), []);
  assert.deepEqual(parsePanelCalls(null), []);
  const parsed = parsePanelCalls([
    null,
    { id: 1 },
    { id: "z", kind: "pizza", text: "x", label: "x" },
    { id: "a", kind: "conta", text: "Mesa 2 pede a conta", label: "Conta", table_number: "2", waiting_seconds: "190", repeats: 1, urgency: "late" },
    { id: "b", kind: "agua", text: "Mesa 3 pede água", label: "Água", urgency: "cor-estranha" },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].table_number, 2);
  assert.equal(parsed[0].waiting_seconds, 190);
  assert.equal(parsed[0].urgency, "late");
  assert.equal(parsed[1].urgency, "normal");
  assert.equal(parsed[1].waiting_seconds, 0);
});

test("Trabalhe aqui only becomes a link for a real https address", () => {
  assert.equal(safeJobsUrl("https://vemtrabalhar.com.br/"), "https://vemtrabalhar.com.br/");
  assert.equal(safeJobsUrl("http://vemtrabalhar.com.br"), null);
  assert.equal(safeJobsUrl("not a url"), null);
  assert.equal(safeJobsUrl(""), null);
  assert.equal(safeJobsUrl(undefined), null);
  assert.equal(safeJobsUrl("data:text/html,x"), null);
});
