import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../../frontend/public/sw.js", import.meta.url), "utf8");

/** Roda o sw.js numa "casca" que imita o navegador e devolve o que ele registrou e o que fez. */
function load({ windows = [] } = {}) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const focused = [];
  const state = { skipped: 0, claimed: 0 };
  const self = {
    addEventListener(name, handler) {
      handlers[name] = handler;
    },
    skipWaiting() {
      state.skipped += 1;
    },
    clients: {
      claim: () => {
        state.claimed += 1;
        return Promise.resolve();
      },
      matchAll: () => Promise.resolve(windows.map((w) => ({ ...w, focus: () => { focused.push(w.name); return Promise.resolve(); } }))),
      openWindow: (url) => {
        opened.push(url);
        return Promise.resolve();
      },
    },
    registration: {
      showNotification: (title, options) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
  };
  vm.runInNewContext(SOURCE, { self });
  return { handlers, shown, opened, focused, state };
}

function pushEvent(payload, raw) {
  const waits = [];
  return {
    data: raw === undefined && payload === undefined ? null : { json: () => (raw !== undefined ? JSON.parse(raw) : payload) },
    waitUntil: (promise) => waits.push(promise),
    done: () => Promise.all(waits),
  };
}

test("it installs at once and takes over the open pages", async () => {
  const sw = load();
  sw.handlers.install();
  assert.equal(sw.state.skipped, 1);
  const event = { waitUntil: (p) => p };
  await sw.handlers.activate(event);
  assert.equal(sw.state.claimed, 1);
});

test("it does not touch any request: no fetch handler, so the app is never stuck on an old version", () => {
  const sw = load();
  assert.deepEqual(Object.keys(sw.handlers).sort(), ["activate", "install", "notificationclick", "push"]);
  assert.doesNotMatch(SOURCE, /caches\.|cache\.put|addEventListener\(\s*["']fetch/);
});

test("a push shows a notification with the text the server sent", async () => {
  const sw = load();
  const event = pushEvent({ title: "Pedido novo", body: "Mesa 4", tag: "pedido-1", url: "/" });
  sw.handlers.push(event);
  await event.done();
  assert.equal(sw.shown.length, 1);
  assert.equal(sw.shown[0].title, "Pedido novo");
  assert.equal(sw.shown[0].options.body, "Mesa 4");
  assert.equal(sw.shown[0].options.tag, "pedido-1");
  assert.equal(sw.shown[0].options.renotify, true);
  assert.equal(sw.shown[0].options.data.url, "/");
  assert.ok(sw.shown[0].options.vibrate.length > 0);
});

test("a push with nothing readable still shows something, because the browser requires a visible notice", async () => {
  for (const event of [pushEvent(undefined), pushEvent(undefined, "not json"), pushEvent("texto solto"), pushEvent(null)]) {
    const sw = load();
    sw.handlers.push(event);
    await event.done();
    assert.equal(sw.shown.length, 1);
    assert.equal(sw.shown[0].title, "Vem Comer");
    assert.equal(sw.shown[0].options.data.url, "/");
  }
});

test("long or odd text is cut and an address outside the site becomes the home page", async () => {
  const sw = load();
  const event = pushEvent({ title: "T".repeat(500), body: "B".repeat(500), tag: "x".repeat(500), url: "https://evil.example/phish" });
  sw.handlers.push(event);
  await event.done();
  const { title, options } = sw.shown[0];
  assert.equal(title.length, 80);
  assert.equal(options.body.length, 160);
  assert.equal(options.tag.length, 100);
  assert.equal(options.data.url, "/");
  for (const url of ["//evil.example", "javascript:alert(1)", 5, null, "relative/path"]) {
    const other = load();
    const e = pushEvent({ title: "a", url });
    other.handlers.push(e);
    await e.done();
    assert.equal(other.shown[0].options.data.url, "/", String(url));
  }
});

test("with the panel open and in front it stays quiet, because the panel beeps by itself", async () => {
  const sw = load({ windows: [{ name: "painel", visibilityState: "visible", focused: true }] });
  const event = pushEvent({ title: "Pedido novo" });
  sw.handlers.push(event);
  await event.done();
  assert.equal(sw.shown.length, 0);
});

test("with the panel open but behind, or in the background, it notifies", async () => {
  for (const win of [
    { name: "atras", visibilityState: "visible", focused: false },
    { name: "escondida", visibilityState: "hidden", focused: false },
  ]) {
    const sw = load({ windows: [win] });
    const event = pushEvent({ title: "Pedido novo" });
    sw.handlers.push(event);
    await event.done();
    assert.equal(sw.shown.length, 1, win.name);
  }
});

test("tapping the notification brings the open panel to the front", async () => {
  const sw = load({ windows: [{ name: "painel", visibilityState: "hidden", focused: false }] });
  let closed = 0;
  const event = { notification: { close: () => { closed += 1; }, data: { url: "/" } }, waitUntil: (p) => (event.p = p) };
  sw.handlers.notificationclick(event);
  await event.p;
  assert.equal(closed, 1);
  assert.deepEqual(sw.focused, ["painel"]);
  assert.deepEqual(sw.opened, []);
});

test("tapping it with the app closed opens the site, never an outside address", async () => {
  for (const [data, expected] of [[{ url: "/" }, "/"], [{ url: "https://evil.example" }, "/"], [undefined, "/"], [{ url: "//evil" }, "/"]]) {
    const sw = load();
    const event = { notification: { close() {}, data }, waitUntil: (p) => (event.p = p) };
    sw.handlers.notificationclick(event);
    await event.p;
    assert.deepEqual(sw.opened, [expected]);
  }
});

test("the manifest and the page still allow a worker on the same address", () => {
  const html = readFileSync(new URL("../../frontend/index.html", import.meta.url), "utf8");
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /worker-src/, "sem worker-src o navegador usa script-src 'self', que cobre /sw.js");
});
