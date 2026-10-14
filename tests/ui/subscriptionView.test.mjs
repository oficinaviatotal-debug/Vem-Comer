import test from "node:test";
import assert from "node:assert/strict";

import {
  amountDueCents,
  attentionSummary,
  bannerOf,
  blankPaymentForm,
  chargeMessage,
  filterCompanies,
  fullDate,
  hasPlanTab,
  methodLabel,
  needsAttention,
  ownerMessage,
  paymentBody,
  paymentFormProblem,
  planAmountText,
  reais,
  shortDate,
  stateLabel,
  viewAllowed,
  whatsappNumber,
  whatsappUrl,
} from "../../frontend/src/service/subscriptionView.ts";

const plan = (over = {}) => ({
  state: "active",
  blocks: false,
  due_date: "2026-11-05",
  days_left: 20,
  warning: null,
  price_cents: 19000,
  message: "",
  ...over,
});
const owner = (over = {}) => ({
  ...plan(),
  enforced: true,
  blocked: false,
  payment_info: { pix_key: "", pix_receiver: "", contact_phone: "" },
  payments: [],
  platform_admin: false,
  ...over,
});

test("money and dates read the way people write them", () => {
  assert.equal(reais(19000), "R$ 190,00");
  assert.equal(reais(14950), "R$ 149,50");
  assert.equal(shortDate("2026-11-05"), "05/11");
  assert.equal(fullDate("2026-11-05"), "05/11/2026");
  assert.equal(shortDate("2026-11-05T10:00:00+00:00"), "05/11");
  assert.equal(shortDate(null), "");
  assert.equal(shortDate("lixo"), "");
});

test("each state has a short label and a tone", () => {
  assert.deepEqual(stateLabel(plan()), { text: "Em dia até 05/11", tone: "ok" });
  assert.deepEqual(stateLabel(plan({ warning: "soon", days_left: 3 })), { text: "Vence em 3 dias", tone: "warn" });
  assert.deepEqual(stateLabel(plan({ warning: "soon", days_left: 1 })), { text: "Vence em 1 dia", tone: "warn" });
  assert.deepEqual(stateLabel(plan({ warning: "today", days_left: 0 })), { text: "Vence hoje", tone: "warn" });
  assert.deepEqual(stateLabel(plan({ state: "past_due", days_left: -1 })), { text: "Venceu em 05/11", tone: "bad" });
  assert.deepEqual(stateLabel(plan({ state: "awaiting_payment", due_date: null })), { text: "Falta o 1º pagamento", tone: "bad" });
  assert.deepEqual(stateLabel(plan({ state: "canceled" })), { text: "Cancelado", tone: "bad" });
  assert.deepEqual(stateLabel(plan({ state: "none", due_date: null })), { text: "Sem cobrança", tone: "quiet" });
});

test("the strip on top shows only the warnings", () => {
  assert.equal(bannerOf(null), null);
  assert.equal(bannerOf(owner()), null);
  assert.deepEqual(bannerOf(owner({ warning: "soon", days_left: 3, message: "Seu plano vence em 3 dias (05/11)." })), {
    kind: "soon",
    text: "Seu plano vence em 3 dias (05/11).",
  });
  assert.equal(bannerOf(owner({ warning: "today", message: "vence hoje" })).kind, "today");
});

test("a blocked plan reminds on the screens that still work, and says nothing on the Plano screen itself", () => {
  const blocked = owner({ state: "past_due", blocked: true, message: "venceu" });
  assert.deepEqual(bannerOf(blocked, "pedidos"), { kind: "blocked", text: "venceu" });
  assert.deepEqual(bannerOf(blocked), { kind: "blocked", text: "venceu" });
  assert.equal(bannerOf(blocked, "plano"), null);
});

test("a restaurant with no plan has no Plano tab", () => {
  assert.equal(hasPlanTab(owner({ state: "none" })), false);
  assert.equal(hasPlanTab(null), false);
  assert.equal(hasPlanTab(owner()), true);
  assert.equal(hasPlanTab(owner({ state: "awaiting_payment" })), true);
});

test("blocked: only the orders in progress and the way to pay work", () => {
  assert.equal(viewAllowed("pedidos", true), true);
  assert.equal(viewAllowed("plano", true), true);
  // deliveries already on the road still close, and the cash they bring back is still settled
  assert.equal(viewAllowed("entregas", true), true);
  assert.equal(viewAllowed("acerto", true), true);
  for (const view of ["produtos", "custos", "entrega", "usuarios", "dashboard", "mesas", "assistente"]) {
    assert.equal(viewAllowed(view, true), false, view);
    assert.equal(viewAllowed(view, false), true, view);
  }
});

test("WhatsApp numbers: Brazilian, with or without 55, mask or not", () => {
  assert.equal(whatsappNumber("5584999991234"), "5584999991234");
  assert.equal(whatsappNumber("(84) 99999-1234"), "5584999991234");
  assert.equal(whatsappNumber("8433334444"), "558433334444");
  assert.equal(whatsappNumber("+55 84 99999-1234"), "5584999991234");
  assert.equal(whatsappNumber("123"), null);
  assert.equal(whatsappNumber(null), null);
  assert.equal(whatsappNumber(""), null);
});

test("the WhatsApp link carries the message already written", () => {
  const url = whatsappUrl("84999991234", "Oi! Já paguei.");
  assert.equal(url, "https://wa.me/5584999991234?text=Oi!%20J%C3%A1%20paguei.");
  assert.equal(whatsappUrl("", "x"), null);
});

test("the owner's messages say the value and the restaurant", () => {
  assert.match(ownerMessage("pay", "Pastelaria da Ana", plan()), /R\$ 190,00.*Pastelaria da Ana/);
  assert.match(ownerMessage("paid", "Pastelaria da Ana", plan()), /Já paguei.*comprovante/);
  assert.match(ownerMessage("pay", "  ", plan()), /meu restaurante/);
});

test("GD's charge message fits each situation and never scolds", () => {
  const late = chargeMessage("Ana Lima", "Pastelaria da Ana", plan({ state: "past_due", due_date: "2026-11-05" }));
  assert.match(late, /^Oi, Ana!/);
  assert.match(late, /do restaurante Pastelaria da Ana venceu em 05\/11/);
  assert.match(late, /nada foi apagado/);
  const first = chargeMessage(null, "Pastelaria da Ana", plan({ state: "awaiting_payment", due_date: null }));
  assert.match(first, /^Oi!/);
  assert.match(first, /primeiro mês/);
  assert.match(chargeMessage("Ana", "X", plan({ warning: "today" })), /vence hoje/);
  assert.match(chargeMessage("Ana", "X", plan({ warning: "soon", days_left: 3 })), /vence em 05\/11/);
});

test("who needs attention: late, waiting for the first payment, or about to be", () => {
  assert.equal(needsAttention(plan()), false);
  assert.equal(needsAttention(plan({ state: "none" })), false);
  assert.equal(needsAttention(plan({ state: "past_due" })), true);
  assert.equal(needsAttention(plan({ state: "awaiting_payment" })), true);
  assert.equal(needsAttention(plan({ warning: "soon" })), true);
  assert.equal(needsAttention(plan({ warning: "today" })), true);
});

test("the list filters by attention and by what GD types", () => {
  const list = [
    { company_id: "1", name: "Pastelaria da Ana", slug: "pastelaria", owner_name: "Ana", owner_email: "ana@x.com", subscription: plan({ state: "past_due" }) },
    { company_id: "2", name: "Açaí do João", slug: "acai", owner_name: "João", owner_email: "j@x.com", subscription: plan() },
  ];
  assert.deepEqual(filterCompanies(list, true).map((c) => c.company_id), ["1"]);
  assert.deepEqual(filterCompanies(list, false).map((c) => c.company_id), ["1", "2"]);
  assert.deepEqual(filterCompanies(list, false, "ACAI").map((c) => c.company_id), ["2"], "the address in the link counts");
  assert.deepEqual(filterCompanies(list, false, "pastel").map((c) => c.company_id), ["1"]);
  assert.deepEqual(filterCompanies(list, false, "açaí").map((c) => c.company_id), ["2"]);
  assert.deepEqual(filterCompanies(list, false, "ana@").map((c) => c.company_id), ["1"]);
  assert.deepEqual(filterCompanies(list, true, "joão").map((c) => c.company_id), []);
});

test("the summary in words", () => {
  assert.equal(attentionSummary(0), "Tudo em dia");
  assert.equal(attentionSummary(1), "1 restaurante pede atenção");
  assert.equal(attentionSummary(3), "3 restaurantes pedem atenção");
});

test("the payment form starts with the price of that restaurant", () => {
  assert.deepEqual(blankPaymentForm(plan({ price_cents: 14900 })), { amount: "149,00", method: "pix", reference: "" });
  assert.deepEqual(blankPaymentForm(plan()), { amount: "190,00", method: "pix", reference: "" });
});

test("the payment form says what is wrong, in words", () => {
  const ok = { amount: "190,00", method: "pix", reference: "" };
  assert.equal(paymentFormProblem(ok), null);
  assert.equal(paymentFormProblem({ ...ok, amount: "R$ 149,50" }), null);
  assert.match(paymentFormProblem({ ...ok, amount: "abc" }), /valor/);
  assert.match(paymentFormProblem({ ...ok, amount: "0" }), /valor/);
  assert.match(paymentFormProblem({ ...ok, amount: "20000" }), /valor/);
  assert.match(paymentFormProblem({ ...ok, method: "cheque" }), /como foi pago/i);
  assert.match(paymentFormProblem({ ...ok, reference: "x".repeat(121) }), /120/);
});

test("the body sent is cleaned", () => {
  assert.deepEqual(paymentBody({ amount: " 190,00 ", method: "pix", reference: "  Pix   da  Ana " }), {
    amount: "190,00",
    method: "pix",
    reference: "Pix da Ana",
  });
});

test("method labels", () => {
  assert.equal(methodLabel("pix"), "Pix");
  assert.equal(methodLabel("transferencia"), "Transferência");
  assert.equal(methodLabel("novo"), "novo");
});

// GD, 14/10/2026: os primeiros 30 dias têm 50% de desconto (o servidor manda o valor do próximo pagamento).
const firstMonth = (over = {}) =>
  plan({ state: "awaiting_payment", due_date: null, amount_due_cents: 9500, intro_discount_percent: 50, ...over });

test("the next payment is the discounted first one, or the price when the server does not say", () => {
  assert.equal(amountDueCents(firstMonth()), 9500);
  assert.equal(amountDueCents(plan()), 19000);
  assert.equal(amountDueCents(plan({ price_cents: 14900 })), 14900);
});

test("the plan amount text names the discount only while it applies", () => {
  assert.equal(planAmountText(firstMonth()), "R$ 95,00 no 1º mês (50% de desconto)");
  assert.equal(planAmountText(plan()), "R$ 190,00");
  assert.equal(planAmountText(plan({ intro_discount_percent: 0, amount_due_cents: 19000 })), "R$ 190,00");
});

test("the owner's and GD's messages and the payment form carry the discounted first payment", () => {
  assert.match(ownerMessage("pay", "Pastelaria da Ana", firstMonth()), /R\$ 95,00.*Pastelaria da Ana/);
  assert.match(ownerMessage("paid", "Pastelaria da Ana", firstMonth()), /\(R\$ 95,00\)/);
  const charge = chargeMessage(null, "Pastelaria da Ana", firstMonth());
  assert.match(charge, /primeiro mês do Vem Comer \(R\$ 95,00, com 50% de desconto\)/);
  assert.deepEqual(blankPaymentForm(firstMonth()), { amount: "95,00", method: "pix", reference: "" });
  assert.deepEqual(blankPaymentForm(firstMonth({ price_cents: 14900, amount_due_cents: 7450 })), {
    amount: "74,50",
    method: "pix",
    reference: "",
  });
});

test("a renewal or a late payment is charged the full price", () => {
  const late = plan({ state: "past_due", due_date: "2026-11-05", amount_due_cents: 19000, intro_discount_percent: 0 });
  assert.match(chargeMessage(null, "X", late), /\(R\$ 190,00\)/);
  assert.deepEqual(blankPaymentForm(late), { amount: "190,00", method: "pix", reference: "" });
});
