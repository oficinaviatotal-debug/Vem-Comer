import test from "node:test";
import assert from "node:assert/strict";

import { CODE_HINT, CODE_LENGTH, deliveryCodeToShow, spokenCode } from "../../frontend/src/customer/deliveryCode.ts";

test("the customer sees the code while the delivery is open", () => {
  for (const status of ["PENDING_PAYMENT", "em preparo", "pronto", "saiu para entrega"]) {
    assert.equal(deliveryCodeToShow({ order_type: "entrega", status, delivery_code: "0427" }), "0427", status);
  }
});

test("no code on a pickup or table order, after delivered, or when the server sent none or a strange one", () => {
  assert.equal(deliveryCodeToShow({ order_type: "retirada", status: "pronto", delivery_code: "0427" }), "");
  assert.equal(deliveryCodeToShow({ order_type: "mesa", status: "pronto", delivery_code: "0427" }), "");
  assert.equal(deliveryCodeToShow({ order_type: "entrega", status: "concluido", delivery_code: "0427" }), "");
  assert.equal(deliveryCodeToShow({ order_type: "entrega", status: "pronto", delivery_code: null }), "");
  assert.equal(deliveryCodeToShow({ order_type: "entrega", status: "pronto" }), "");
  for (const odd of ["42", "04277", "abcd", 427, "<b>1</b>", "0427 "]) {
    assert.equal(deliveryCodeToShow({ order_type: "entrega", status: "pronto", delivery_code: odd }), "", String(odd));
  }
});

test("the code is read one number at a time", () => {
  assert.equal(spokenCode("0427"), "0 4 2 7");
  assert.equal(CODE_LENGTH, 4);
});

test("the hint tells the customer when to give the code", () => {
  assert.match(CODE_HINT, /só quando/);
  assert.match(CODE_HINT, /receber o seu pedido/);
});
