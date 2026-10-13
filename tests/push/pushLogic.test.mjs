import test from "node:test";
import assert from "node:assert/strict";

import {
  DISMISS_DAYS,
  TEXT,
  dismissedRecently,
  normalizeTestResult,
  pushStatus,
  sameKey,
  subscriptionBody,
  supportProblem,
  testText,
  urlBase64ToBytes,
} from "../../frontend/src/push/pushLogic.ts";

const support = (extra = {}) => ({
  secure: true,
  serviceWorker: true,
  pushManager: true,
  notification: true,
  ios: false,
  standalone: false,
  ...extra,
});

test("a normal Android Chrome can turn it on", () => {
  assert.equal(supportProblem(support()), "");
});

test("each missing piece is explained in plain words", () => {
  assert.match(supportProblem(support({ secure: false })), /seguro/);
  assert.match(supportProblem(support({ serviceWorker: false })), /Chrome/);
  assert.match(supportProblem(support({ pushManager: false })), /Chrome/);
  assert.match(supportProblem(support({ notification: false })), /Chrome/);
});

test("an iPhone only gets notifications from the home-screen icon", () => {
  assert.match(supportProblem(support({ ios: true, standalone: false })), /Tela de Início/);
  assert.equal(supportProblem(support({ ios: true, standalone: true })), "");
});

test("the status follows the server, the browser, the permission and the subscription", () => {
  const base = { serverEnabled: true, support: support(), permission: "default", subscribed: false };
  assert.equal(pushStatus({ ...base, serverEnabled: null }), "checking");
  assert.equal(pushStatus({ ...base, serverEnabled: false }), "hidden");
  assert.equal(pushStatus({ ...base, support: support({ pushManager: false }) }), "unsupported");
  assert.equal(pushStatus({ ...base, permission: "denied" }), "blocked");
  assert.equal(pushStatus(base), "off");
  assert.equal(pushStatus({ ...base, permission: "granted" }), "off", "licença dada, mas o celular ainda não se inscreveu");
  assert.equal(pushStatus({ ...base, permission: "granted", subscribed: true }), "on");
  assert.equal(pushStatus({ ...base, permission: "default", subscribed: true }), "off", "licença tirada: a inscrição velha não conta");
});

test("a server that is off hides everything, even in a browser that cannot receive", () => {
  assert.equal(pushStatus({ serverEnabled: false, support: support({ secure: false }), permission: "denied", subscribed: true }), "hidden");
});

test("the server key in base64url becomes the 65 bytes the browser wants", () => {
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  for (let i = 1; i < 65; i += 1) bytes[i] = (i * 37) % 256;
  const b64url = Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.deepEqual([...urlBase64ToBytes(b64url)], [...bytes]);
  assert.equal(urlBase64ToBytes("").length, 0);
});

test("only a complete subscription goes to the server", () => {
  const good = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "P", auth: "A" }, expirationTime: null };
  assert.deepEqual(subscriptionBody(good), { endpoint: good.endpoint, keys: { p256dh: "P", auth: "A" } });
  for (const bad of [null, undefined, "x", 5, {}, { endpoint: "" }, { endpoint: "https://x" }, { endpoint: "https://x", keys: {} },
    { endpoint: "https://x", keys: { p256dh: "P" } }, { endpoint: "https://x", keys: { p256dh: 1, auth: 2 } },
    { endpoint: 5, keys: { p256dh: "P", auth: "A" } }]) {
    assert.equal(subscriptionBody(bad), null, JSON.stringify(bad));
  }
});

test("a subscription made with another server key is detected", () => {
  const wanted = Uint8Array.from([4, 1, 2, 3]);
  assert.equal(sameKey(wanted.buffer.slice(0), wanted), true);
  assert.equal(sameKey(Uint8Array.from([4, 1, 2, 3]), wanted), true, "visão de bytes também");
  assert.equal(sameKey(Uint8Array.from([4, 1, 2, 9]), wanted), false);
  assert.equal(sameKey(Uint8Array.from([4, 1, 2]), wanted), false);
  assert.equal(sameKey(null, wanted), false);
  assert.equal(sameKey(undefined, wanted), false);
  // uma visão que começa no meio de um buffer maior
  const big = new Uint8Array([0, 0, 4, 1, 2, 3, 0]);
  assert.equal(sameKey(new Uint8Array(big.buffer, 2, 4), wanted), true);
});

test("the test answer is cleaned and read in plain words", () => {
  assert.deepEqual(normalizeTestResult({ sent: 2, removed: 1, failed: 0 }), { sent: 2, removed: 1, failed: 0 });
  assert.deepEqual(normalizeTestResult({ sent: "3", removed: -1, failed: NaN }), { sent: 0, removed: 0, failed: 0 });
  assert.deepEqual(normalizeTestResult(null), { sent: 0, removed: 0, failed: 0 });
  assert.match(testText({ sent: 1, removed: 0, failed: 0 }), /1 celular\./);
  assert.match(testText({ sent: 3, removed: 0, failed: 1 }), /3 celulares/);
  assert.match(testText({ sent: 0, removed: 1, failed: 0 }), /saiu da lista/);
  assert.match(testText({ sent: 0, removed: 0, failed: 2 }), /não respondeu/);
  assert.match(testText({ sent: 0, removed: 0, failed: 0 }), /Nenhum celular ativado/);
});

test('"Agora não" lasts a week and then the invitation comes back', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = 100 * day;
  assert.equal(DISMISS_DAYS, 7);
  assert.equal(dismissedRecently(null, now), false);
  assert.equal(dismissedRecently("", now), false);
  assert.equal(dismissedRecently("lixo", now), false);
  assert.equal(dismissedRecently(String(now - 1 * day), now), true);
  assert.equal(dismissedRecently(String(now - 6 * day), now), true);
  assert.equal(dismissedRecently(String(now - 7 * day), now), false);
  assert.equal(dismissedRecently(String(now + day), now), false, "data no futuro não vale");
});

test("the screen texts never promise what the system does not do", () => {
  assert.match(TEXT.pitch, /pedido novo/);
  assert.match(TEXT.pitch, /mesa chamando/);
  assert.match(TEXT.pitch, /entrega pronta/);
  assert.match(TEXT.blocked, /Notificações/);
});
