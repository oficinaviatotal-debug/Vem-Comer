import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMENT_MAX,
  LOADING_TEXT,
  OFFLINE_FIRST_TEXT,
  PIX_COPIED_TEXT,
  PIX_COPY_MANUAL_TEXT,
  POLL_MS,
  afterPoll,
  copiedOutcome,
  copiedText,
  pixOf,
  safeQrImage,
  QR_IMAGE_MAX,
  pixStateOfError,
  ratingOf,
  ratingTarget,
  trackOf,
} from "../../frontend/src/loja/trackingLogic.ts";

const item = (name, quantity, total, extra = {}) => ({ name, quantity, total, ...extra });
const order = (extra = {}) => ({
  id: "a1b2c3d4-0000",
  customer_name: "Maria",
  total_price: "73.00",
  status: "em preparo",
  items: [
    item("Açaí no copo", 1, "24.00", { options: [{ name: "500 ml" }, { name: "Granola extra" }], note: " sem granola em cima " }),
    item("X-Burguer", 2, 36),
  ],
  payment_method: "dinheiro",
  payment_status: "PENDING",
  order_type: "retirada",
  delivery_fee: null,
  ...extra,
});
const delivery = (extra = {}) =>
  order({
    order_type: "entrega",
    delivery_fee: "6.00",
    delivery_zone: "Centro",
    delivery_address: { street: "Rua das Flores", number: "120", neighborhood: "Centro", city: "Natal" },
    customer_phone: "84999998888",
    delivery_code: "4821",
    status: "saiu para entrega",
    ...extra,
  });

test("o pedido mostra o código curto, onde, o nome e o total em número", () => {
  const view = trackOf(order(), null, false);
  assert.equal(view.code, "#A1B2");
  assert.equal(view.where, "Retirada");
  assert.equal(view.customerName, "Maria");
  assert.equal(view.total, 73);
  assert.equal(view.fee, null, "retirada não tem taxa");
});

test("as linhas trazem o que a pessoa escolheu e a observação limpa", () => {
  const [first, second] = trackOf(order(), null, false).lines;
  assert.equal(first.name, "Açaí no copo");
  assert.equal(first.detail, "500 ml, Granola extra");
  assert.equal(first.note, "sem granola em cima");
  assert.equal(first.total, 24);
  assert.equal(second.detail, undefined);
  assert.equal(second.note, undefined);
  assert.equal(second.quantity, 2);
});

test("andamento: em preparo marca a primeira etapa como feita e a segunda como a de agora", () => {
  const { status } = trackOf(order(), null, false);
  assert.equal(status.headline, "Em preparo");
  assert.deepEqual(status.steps.map((s) => s.label), ["Enviado", "Em preparo", "Pronto"]);
  assert.deepEqual(status.steps.map((s) => s.state), ["done", "current", "todo"]);
  assert.equal(status.done, false);
});

test("andamento: pedido pronto marca todas as etapas como feitas", () => {
  const { status } = trackOf(order({ status: "concluido" }), null, false);
  assert.equal(status.done, true);
  assert.ok(status.steps.every((s) => s.state === "done"));
});

test("pedido de mesa diz a mesa; a mesa nunca é entrega nem retirada", () => {
  const view = trackOf(order({ order_type: "mesa", status: "concluido" }), 4, false);
  assert.equal(view.where, "Mesa 4");
  assert.equal(view.handling, null);
  assert.equal(view.status.hint, "Já já chega na mesa 4.");
});

test("retirada diz o que fazer no balcão", () => {
  const { handling } = trackOf(order(), null, false);
  assert.equal(handling.title, "Retirada no local.");
  assert.match(handling.text, /Avise o atendente/);
});

test("entrega: endereço, telefone com máscara, taxa e etapas da rua", () => {
  const view = trackOf(delivery(), null, false);
  assert.equal(view.where, "Entrega");
  assert.equal(view.handling.title, "Entrega em:");
  assert.match(view.handling.text, /Rua das Flores/);
  assert.equal(view.handling.phone, "(84) 99999-8888", "o telefone vai separado, para a tela não o quebrar no meio");
  assert.ok(!/99999/.test(view.handling.text));
  assert.equal(view.fee, 6);
  assert.deepEqual(view.status.steps.map((s) => s.label), ["Enviado", "Preparo", "Na rua", "Entregue"]);
  assert.equal(view.status.headline, "Saiu para entrega");
  assert.deepEqual(view.status.steps.map((s) => s.state), ["done", "done", "current", "todo"]);
});

test("entrega sem endereço legível ainda diz para onde vai, sem inventar", () => {
  const view = trackOf(delivery({ delivery_address: null, delivery_zone: null, customer_phone: null }), null, false);
  assert.equal(view.handling.text, "o endereço que você informou");
  // A região que o servidor anotou aparece quando o endereço não a diz.
  assert.equal(trackOf(delivery({ delivery_address: null, customer_phone: null }), null, false).handling.text, "o endereço que você informou (Centro)");
});

test("taxa de entrega zero é 'grátis' (0), não ausente", () => {
  assert.equal(trackOf(delivery({ delivery_fee: "0.00" }), null, false).fee, 0);
  assert.equal(trackOf(delivery({ delivery_fee: null }), null, false).fee, 0);
});

test("código de entrega: 4 números, lidos um a um, só enquanto a entrega está aberta", () => {
  const view = trackOf(delivery(), null, false);
  assert.deepEqual(view.deliveryCode.digits, ["4", "8", "2", "1"]);
  assert.equal(view.deliveryCode.spoken, "4 8 2 1");
  assert.equal(view.deliveryCode.title, "Código de entrega");
  assert.match(view.deliveryCode.hint, /Não envie o código por mensagem a ninguém/);
  assert.equal(trackOf(delivery({ status: "concluido" }), null, false).deliveryCode, null, "entregue: o código some");
  assert.equal(trackOf(delivery({ delivery_code: "48" }), null, false).deliveryCode, null, "código malformado não aparece");
  assert.equal(trackOf(order({ delivery_code: "4821" }), null, false).deliveryCode, null, "retirada não tem código");
});

test("pagamento: Pix a pagar, pago, e o que se acerta na hora (com quem, na entrega)", () => {
  assert.deepEqual(trackOf(order({ payment_method: "pix" }), null, false).payment, { kind: "pix" });
  const paid = trackOf(order({ payment_method: "pix", payment_status: "PAID" }), null, false).payment;
  assert.equal(paid.kind, "paid");
  assert.equal(paid.title, "Pagamento recebido");
  assert.equal(trackOf(order({ payment_method: "dinheiro" }), null, false).payment.text, "Pagamento em dinheiro: você acerta com o atendente.");
  assert.equal(trackOf(delivery({ payment_method: "cartao" }), null, false).payment.text, "Pagamento em cartão: você paga ao entregador quando o pedido chegar.");
});

test("sem internet, o pedido continua na tela e avisa que é o último andamento", () => {
  assert.equal(trackOf(order(), null, true).offline, true);
  assert.equal(trackOf(order(), null, false).offline, false);
});

test("dados ruins do servidor não quebram a tela", () => {
  const view = trackOf({ id: "", status: "", items: null, total_price: "abc" }, null, false);
  assert.equal(view.total, 0);
  assert.deepEqual(view.lines, []);
  assert.equal(view.code, "");
  assert.equal(view.status.headline, "Pedido enviado");
});

test("a tela continua perguntando enquanto há o que esperar e para quando não há", () => {
  assert.equal(POLL_MS, 5000);
  assert.equal(afterPoll({ order: order() }), "again", "em preparo");
  assert.equal(afterPoll({ order: order({ status: "concluido" }) }), "stop", "pronto e sem Pix a conferir");
  assert.equal(afterPoll({ order: order({ status: "concluido", payment_method: "pix" }) }), "again", "pronto, mas o Pix ainda não foi confirmado");
  assert.equal(afterPoll({ order: order({ status: "concluido", payment_method: "pix", payment_status: "PAID" }) }), "stop");
});

test("o pedido que o servidor não conhece mais é esquecido; falha de internet tenta de novo", () => {
  assert.equal(afterPoll({ failedWith: 404 }), "gone");
  assert.equal(afterPoll({ failedWith: 401 }), "gone");
  assert.equal(afterPoll({ failedWith: 500 }), "again");
  assert.equal(afterPoll({ failedWith: null }), "again");
});

test("textos de espera são frases inteiras", () => {
  assert.match(LOADING_TEXT, /…$/);
  assert.match(OFFLINE_FIRST_TEXT, /\.$/);
});

const code = { payload: "000201...", qr_data_url: "data:image/png;base64,AAAA", receiver_name: "Açaí do João", amount: "73.00" };

test("Pix pronto traz valor, recebedor, código e QR; os outros estados não trazem nada além do estado", () => {
  const ready = pixOf("ready", code, "");
  assert.deepEqual([ready.state, ready.amount, ready.receiver, ready.payload, ready.qr], ["ready", 73, "Açaí do João", "000201...", "data:image/png;base64,AAAA"]);
  for (const state of ["loading", "missing", "error"]) {
    const view = pixOf(state, code, "");
    assert.equal(view.payload, undefined, state);
    assert.equal(view.amount, undefined, state);
  }
  assert.equal(pixOf("ready", null, "").payload, undefined);
});

test("a imagem do QR Pix só vale como PNG em base64 de tamanho razoável; o resto some (nada de endereço de fora, svg ou script)", () => {
  assert.equal(safeQrImage("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
  assert.equal(safeQrImage("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  const bad = [
    "https://evil.example/qr.png",
    "http://evil.example/qr.png",
    "//evil.example/qr.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/png;base64,AAAA\" onerror=\"alert(1)",
    "data:image/png;base64,",
    "data:image/png,AAAA",
    "",
    null,
    undefined,
    42,
    {},
  ];
  for (const value of bad) assert.equal(safeQrImage(value), undefined, String(value));
  assert.equal(safeQrImage(`data:image/png;base64,${"A".repeat(QR_IMAGE_MAX)}`), undefined, "grande demais");
  // E o Pix pronto só leva a imagem que passou na conferência.
  assert.equal(pixOf("ready", { ...code, qr_data_url: "https://evil.example/qr.png" }, "").qr, undefined);
  assert.equal(pixOf("ready", { ...code, qr_data_url: "data:image/png;base64,AAAA" }, "").qr, "data:image/png;base64,AAAA");
});

test("Pix: 404 quer dizer 'sem Pix neste restaurante'; qualquer outra falha, tentar de novo", () => {
  assert.equal(pixStateOfError(404), "missing");
  assert.equal(pixStateOfError(500), "error");
  assert.equal(pixStateOfError(null), "error");
});

test("copiar o código: copiou, ou pede para tocar e segurar", () => {
  assert.equal(copiedOutcome(true), "ok");
  assert.equal(copiedOutcome(false), "manual");
  assert.equal(copiedText("ok"), PIX_COPIED_TEXT);
  assert.equal(copiedText("manual"), PIX_COPY_MANUAL_TEXT);
  assert.equal(copiedText(""), "");
});

test("avaliação: só envia com comida e atendimento escolhidos, e não enquanto envia", () => {
  const base = { sent: false, food: "", service: "", comment: "", busy: false, error: null };
  assert.equal(ratingOf(base).canSend, false);
  assert.equal(ratingOf({ ...base, food: "boa" }).canSend, false);
  assert.equal(ratingOf({ ...base, food: "boa", service: "bom" }).canSend, true);
  assert.equal(ratingOf({ ...base, food: "boa", service: "bom", busy: true }).canSend, false);
  const view = ratingOf({ ...base, food: "boa", service: "ótimo" });
  assert.deepEqual(view.food.map((o) => o.label), ["Ótima", "Boa", "Regular", "Ruim"]);
  assert.deepEqual(view.service.map((o) => o.label), ["Ótimo", "Bom", "Regular", "Ruim"]);
  assert.deepEqual(view.food.filter((o) => o.on).map((o) => o.id), ["boa"]);
  assert.deepEqual(view.service.filter((o) => o.on).map((o) => o.id), ["ótimo"]);
  assert.equal(COMMENT_MAX, 500);
});

test("quem pede a avaliação: o pedido mais novo que está pronto e ainda não foi avaliado", () => {
  const done = new Set(["b", "c"]);
  const rated = new Set(["b"]);
  const target = ratingTarget(["a", "b", "c"], (id) => done.has(id), (id) => rated.has(id));
  assert.equal(target, "c");
  assert.equal(ratingTarget(["a"], (id) => done.has(id), () => false), undefined);
  assert.equal(ratingTarget([], () => true, () => false), undefined);
});
