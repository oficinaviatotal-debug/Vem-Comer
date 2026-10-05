import test from "node:test";
import assert from "node:assert/strict";

import { formatMoney, formatTime, paymentLabel, roleLabel, shortOrderCode } from "../../frontend/src/service/format.ts";

const plain = (text) => text.replace(/ /g, " ");

test("money uses the Brazilian format", () => {
  assert.equal(plain(formatMoney(49.9)), "R$ 49,90");
  assert.equal(plain(formatMoney("105.80")), "R$ 105,80");
  assert.equal(plain(formatMoney(1234.5)), "R$ 1.234,50");
});

test("money never shows NaN", () => {
  assert.equal(plain(formatMoney(undefined)), "R$ 0,00");
  assert.equal(plain(formatMoney(null)), "R$ 0,00");
  assert.equal(plain(formatMoney("abc")), "R$ 0,00");
});

test("time accepts the date formats the API sends and fails soft", () => {
  assert.match(formatTime("Mon, 05 Oct 2026 15:35:44 GMT"), /^\d{2}:\d{2}$/);
  assert.match(formatTime("2026-10-05T15:35:44Z"), /^\d{2}:\d{2}$/);
  assert.equal(formatTime("not a date"), "");
  assert.equal(formatTime(""), "");
  assert.equal(formatTime(null), "");
});

test("order code is short, uppercase and tolerates empty input", () => {
  assert.equal(shortOrderCode("a3f9c1d2-0000-4000-8000-000000000001"), "#A3F9");
  assert.equal(shortOrderCode(""), "");
  assert.equal(shortOrderCode(undefined), "");
});

test("roles and payment methods have plain Portuguese names", () => {
  assert.equal(roleLabel("OWNER"), "Dono");
  assert.equal(roleLabel("WAITER"), "Garçom");
  assert.equal(roleLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(roleLabel(null), "");
  assert.equal(paymentLabel("pix"), "Pix");
  assert.equal(paymentLabel("cartao"), "Cartão");
  assert.equal(paymentLabel(""), "Não informado");
  assert.equal(paymentLabel(undefined), "Não informado");
});
