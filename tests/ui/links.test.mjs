import test from "node:test";
import assert from "node:assert/strict";

import { panelUrl, tableOrderUrl, wantsPanel } from "../../frontend/src/service/links.ts";

const ORIGIN = "https://vemcomer.example";

test("the table QR link carries only the restaurant and the table", () => {
  const url = new URL(tableOrderUrl(ORIGIN, "/", "jack-sushima", "mesa-uuid"));
  assert.equal(url.origin, ORIGIN);
  assert.deepEqual([...url.searchParams.keys()].sort(), ["empresa", "mesa"]);
  assert.equal(url.searchParams.get("empresa"), "jack-sushima");
  assert.equal(url.searchParams.get("mesa"), "mesa-uuid");
});

test("the table QR link can never open the owner panel", () => {
  // The owner is looking at ?painel=1 when the QR codes are generated. Because
  // links are built from origin+path, that flag cannot reach the printed QR.
  const link = tableOrderUrl(ORIGIN, "/", "jack-sushima", "t1");
  assert.equal(link.includes("painel"), false);
  assert.equal(wantsPanel(new URL(link).search), false);
});

test("the owner link opens the panel of that restaurant", () => {
  const url = new URL(panelUrl(ORIGIN, "/", "jack-sushima"));
  assert.equal(url.searchParams.get("empresa"), "jack-sushima");
  assert.equal(wantsPanel(url.search), true);
});

test("special characters in the slug are encoded, not injected", () => {
  const link = tableOrderUrl(ORIGIN, "/", "a&mesa=x#y", "t1");
  const url = new URL(link);
  assert.equal(url.searchParams.get("empresa"), "a&mesa=x#y");
  assert.equal(url.searchParams.get("mesa"), "t1");
  assert.equal(url.hash, "");
});

test("wantsPanel only accepts painel=1", () => {
  assert.equal(wantsPanel("?empresa=x&painel=1"), true);
  assert.equal(wantsPanel("?painel=0"), false);
  assert.equal(wantsPanel("?painel=true"), false);
  assert.equal(wantsPanel(""), false);
});

test("a missing path falls back to the site root", () => {
  assert.equal(tableOrderUrl(ORIGIN, "", "x", "y"), `${ORIGIN}/?empresa=x&mesa=y`);
});
