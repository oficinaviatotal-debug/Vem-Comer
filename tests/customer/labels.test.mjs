import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanCustomerName,
  customerStatus,
  DELIVERY_STEP_LABELS,
  orderCustomerName,
  orderErrorMessage,
  searchTextFromVoice,
  STEP_LABELS,
} from "../../frontend/src/customer/labels.ts";
import {
  STATUS_DONE,
  STATUS_OUT,
  STATUS_PENDING,
  STATUS_PREPARING,
  STATUS_READY,
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

test("a delivery that is ready goes to the address; a finished one is delivered; pickup still says 'retire'", () => {
  assert.match(customerStatus(STATUS_READY, null, "entrega").hint, /endereço/);
  assert.match(customerStatus(STATUS_DONE, null, "entrega").headline, /Entregue/);
  assert.match(customerStatus(STATUS_DONE, null, "retirada").hint, /balcão/);
  assert.match(customerStatus(STATUS_DONE, 7, "entrega").hint, /mesa 7/);
});

test("the two delivery steps have their own words and the bar has four steps", () => {
  const ready = customerStatus(STATUS_READY, null, "entrega");
  assert.equal(ready.headline, "Pronto!");
  assert.equal(ready.done, false, "still on its way: the tracking keeps checking");
  assert.equal(ready.step, 1);
  const out = customerStatus(STATUS_OUT, null, "entrega");
  assert.equal(out.headline, "Saiu para entrega");
  assert.match(out.hint, /a caminho/);
  assert.equal(out.step, 2);
  assert.equal(out.done, false);
  const done = customerStatus(STATUS_DONE, null, "entrega");
  assert.equal(done.step, 3);
  assert.equal(done.done, true);
  for (const status of [STATUS_PENDING, STATUS_PREPARING, STATUS_READY, STATUS_OUT, STATUS_DONE]) {
    const view = customerStatus(status, null, "entrega");
    assert.deepEqual([...view.steps], [...DELIVERY_STEP_LABELS]);
    assert.ok(view.step < view.steps.length, status);
  }
  assert.equal(DELIVERY_STEP_LABELS.length, 4);
});

test("the delivery words show even when the screen does not know the order type (the banner)", () => {
  assert.equal(customerStatus(STATUS_OUT, null).steps.length, 4);
  assert.equal(customerStatus(STATUS_READY, null).steps.length, 4);
});

test("table, counter and pickup keep the three steps", () => {
  for (const [table, type] of [[7, "mesa"], [null, "retirada"], [null, null], [null, "balcao"]]) {
    for (const status of [STATUS_PENDING, STATUS_PREPARING, STATUS_DONE]) {
      const view = customerStatus(status, table, type);
      assert.deepEqual([...view.steps], [...STEP_LABELS]);
      assert.ok(view.step < 3);
    }
  }
  assert.equal(customerStatus(STATUS_DONE, null, "retirada").step, 2);
});

test("the sentences the server says about delivery are shown as they are", () => {
  const minimum = "O pedido mínimo para Centro é R$ 20,00. Adicione mais itens ou escolha retirar.";
  assert.equal(orderErrorMessage(minimum, "entrega"), minimum);
  assert.match(orderErrorMessage(minimum), /Não deu para enviar/, "no delivery chosen: the old text");
  assert.match(orderErrorMessage("Produto inválido", "entrega"), /item saiu do cardápio/);
});
