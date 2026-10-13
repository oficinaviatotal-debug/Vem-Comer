import test from "node:test";
import assert from "node:assert/strict";

import { courierLine, handlingKind, handlingView, itemsSubtotalCents } from "../../frontend/src/service/orderHandling.ts";

const delivery = {
  order_type: "entrega",
  delivery_fee: "5.00",
  delivery_zone: "Centro",
  delivery_address: { cep: "30110000", street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro", reference: "portão azul" },
  customer_phone: "31999998888",
};

test("an order from before delivery existed reads as a counter order", () => {
  assert.equal(handlingKind({}), "balcao");
  const view = handlingView({});
  assert.equal(view.title, "Balcão");
  assert.equal(view.address, "");
  assert.equal(view.phone, "");
  assert.equal(view.phoneHref, "");
  assert.equal(view.feeCents, 0);
  assert.equal(view.hint, "");
});

test("a table order keeps its table and shows no delivery data", () => {
  const view = handlingView({ table_number: "7", order_type: "mesa", delivery_fee: "5.00", delivery_address: delivery.delivery_address });
  assert.equal(view.kind, "mesa");
  assert.equal(view.title, "Mesa 7");
  assert.equal(view.address, "");
  assert.equal(view.feeCents, 0);
});

test("a delivery shows where to go, the region, the reference, a callable phone and the fee", () => {
  const view = handlingView(delivery);
  assert.equal(view.kind, "entrega");
  assert.equal(view.title, "Entrega");
  assert.equal(view.address, "Rua das Flores, 120 · apto 3 · Centro");
  assert.equal(view.region, "CEP 30110-000 · Região Centro");
  assert.equal(view.reference, "portão azul");
  assert.equal(view.phone, "(31) 99999-8888");
  assert.equal(view.phoneHref, "tel:31999998888");
  assert.equal(view.feeCents, 500);
  assert.equal(view.hint, "Entregar em Rua das Flores, 120 · apto 3 · Centro");
});

test("a delivery without an address tells the kitchen to call", () => {
  const view = handlingView({ order_type: "entrega", customer_phone: "(31) 3333-4444" });
  assert.equal(view.address, "");
  assert.match(view.hint, /ligue/);
  assert.equal(view.phoneHref, "tel:3133334444");
});

test("pickup says so and keeps the phone, with no fee", () => {
  const view = handlingView({ order_type: "retirada", customer_phone: "31999998888", delivery_fee: "5.00" });
  assert.equal(view.title, "Retirada");
  assert.equal(view.hint, "Cliente retira no balcão");
  assert.equal(view.phone, "(31) 99999-8888");
  assert.equal(view.feeCents, 0);
});

test("a phone that is too short is not shown as a link", () => {
  const view = handlingView({ order_type: "retirada", customer_phone: "999" });
  assert.equal(view.phone, "");
  assert.equal(view.phoneHref, "");
});

test("free delivery has a zero fee, and a broken fee does not break the slip", () => {
  assert.equal(handlingView({ ...delivery, delivery_fee: "0.00" }).feeCents, 0);
  assert.equal(handlingView({ ...delivery, delivery_fee: null }).feeCents, 0);
  assert.equal(handlingView({ ...delivery, delivery_fee: "abc" }).feeCents, 0);
  assert.equal(handlingView({ ...delivery, delivery_fee: -3 }).feeCents, 0);
});

test("the items subtotal is the total without the delivery fee", () => {
  assert.equal(itemsSubtotalCents("47.50", 500), 4250);
  assert.equal(itemsSubtotalCents(30, 0), 3000);
  assert.equal(itemsSubtotalCents("2.00", 500), 0);
  assert.equal(itemsSubtotalCents("x", 0), 0);
});

test("the slip of a delivery says who has it", () => {
  assert.equal(courierLine({ ...delivery, courier_name: "Ana Moto", status: "saiu para entrega" }), "Com o entregador Ana Moto");
  assert.equal(courierLine({ ...delivery, courier_name: "Ana Moto", status: "concluido" }), "Entregue por Ana Moto");
  assert.equal(courierLine({ ...delivery, courier_name: "Ana Moto", status: "pronto" }), "Entregador: Ana Moto");
  assert.equal(handlingView({ ...delivery, courier_name: "  Ana   Moto ", status: "saiu para entrega" }).courierLine, "Com o entregador Ana Moto");
});

test("no courier line when nobody took it, or when it is not a delivery", () => {
  for (const name of [null, undefined, "", "   ", 5]) {
    assert.equal(courierLine({ ...delivery, courier_name: name, status: "saiu para entrega" }), "", String(name));
  }
  assert.equal(handlingView(delivery).courierLine, "");
  for (const order_type of ["mesa", "retirada", null]) {
    assert.equal(courierLine({ order_type, table_number: "4", courier_name: "Ana", status: "pronto" }), "", String(order_type));
  }
});
