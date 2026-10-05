import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanCustomerName,
  customerStatus,
  orderCustomerName,
  orderErrorMessage,
  searchTextFromVoice,
  STEP_LABELS,
} from "../../frontend/src/customer/labels.ts";
import {
  STATUS_DONE,
  STATUS_PENDING,
  STATUS_PREPARING,
} from "../../frontend/src/service/orderStatus.ts";

test("the customer wording covers exactly the statuses the panel and the server use", () => {
  assert.equal(customerStatus(STATUS_PENDING, 7).step, 0);
  assert.equal(customerStatus(STATUS_PREPARING, 7).step, 1);
  assert.equal(customerStatus(STATUS_DONE, 7).step, 2);
  assert.equal(customerStatus(STATUS_DONE, 7).done, true);
  assert.equal(customerStatus(STATUS_PENDING, 7).done, false);
  assert.equal(STEP_LABELS.length, 3);
});

test("an unknown status never crashes the tracking screen", () => {
  const status = customerStatus("algo novo", null);
  assert.equal(status.step, 0);
  assert.equal(status.done, false);
  assert.ok(status.headline);
});

test("when ready, the message says where the food goes", () => {
  assert.match(customerStatus(STATUS_DONE, 7).hint, /mesa 7/);
  assert.match(customerStatus(STATUS_DONE, null).hint, /balcão/);
});

test("names are cleaned, limited, and fall back to a generic one", () => {
  assert.equal(cleanCustomerName("  Jack \n  Sushima  "), "Jack Sushima");
  assert.equal(cleanCustomerName("a".repeat(100)).length, 60);
  assert.equal(orderCustomerName("   "), "Cliente");
  assert.equal(orderCustomerName("Marina"), "Marina");
});

test("server errors turn into something a customer can act on", () => {
  assert.match(orderErrorMessage("Mesa invalida"), /mesa/);
  assert.match(orderErrorMessage("Produto indisponivel"), /cardápio/);
  assert.match(orderErrorMessage("Troco deve ser informado com o valor entregue"), /pagar/);
  assert.match(orderErrorMessage("Erro interno ao processar pedido"), /tente de novo/);
  assert.match(orderErrorMessage(undefined), /tente de novo/);
});

test("the voice search keeps only what the person wants to find", () => {
  assert.equal(searchTextFromVoice("buscar suco de laranja"), "suco de laranja");
  assert.equal(searchTextFromVoice("Procurar temaki"), "temaki");
  assert.equal(searchTextFromVoice("pudim"), "pudim");
});
