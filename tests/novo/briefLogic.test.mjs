import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { briefOf, spokenMinutes } from "../../frontend/src/hoje/briefLogic.ts";

// Sexta, 23/10/2026, 09h00 em Brasília (UTC-3).
const NOW = Date.parse("2026-10-23T12:00:00.000Z");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const order = (status, minutes, extra = {}) => ({
  status,
  created_at: ago(minutes),
  order_type: "mesa",
  payment_method: "dinheiro",
  payment_status: "PENDING",
  total_price: 30,
  ...extra,
});
const waiting = (minutes, extra = {}) => order("PENDING_PAYMENT", minutes, extra);
const pix = (minutes, price = 48) => waiting(minutes, { payment_method: "pix", payment_status: "PENDING", total_price: price });
const call = (id) => ({ id, table_number: 4, kind: "garcom", label: "Garçom", text: "Mesa 4 chama o garçom", waiting_seconds: 120, repeats: 0, urgency: "normal" });
const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
const sales = (revenue = 1284.5, orders = 38) => ({ summary: { revenue, orders, avg_ticket: 33.8, dishes: 60, delivery_fees: 0 }, hours });
const brief = (extra = {}) =>
  briefOf({ name: "João Silva", role: "OWNER", orders: [], calls: [], business: sales(), now: NOW, ...extra }).replace(/\s/g, " ");

test("o dono ouve a saudação, os pedidos, as mesas e as vendas, nessa ordem, em frases curtas", () => {
  const text = brief({
    orders: [waiting(3), order("em preparo", 10), order("em preparo", 12), order("saiu para entrega", 20)],
    calls: [call("a"), call("b")],
  });
  assert.equal(
    text,
    "Bom dia, João. 1 pedido esperando, o mais antigo há 3 minutos. 2 na cozinha. 1 a caminho. 2 mesas chamando. Vendas de hoje: R$ 1.284,50 em 38 pedidos.",
  );
});

test("sem pedido esperando diz isso; no singular e no plural", () => {
  assert.match(brief(), /^Bom dia, João\. Nenhum pedido esperando\./);
  assert.match(brief({ orders: [waiting(5), waiting(9)] }), /2 pedidos esperando, o mais antigo há 9 minutos\./);
  assert.match(brief({ orders: [waiting(5)] }), /1 pedido esperando, o mais antigo há 5 minutos\./);
  assert.doesNotMatch(brief({ orders: [waiting(5)] }), /Nenhum pedido/);
});

test("não fala de cozinha nem de entrega quando não há nenhuma", () => {
  const text = brief({ orders: [waiting(2)] });
  assert.doesNotMatch(text, /cozinha|a caminho/);
});

test("o Pix para conferir entra com o total, só para quem confere Pix", () => {
  const text = brief({ orders: [pix(5, 48), pix(8, 30.5)] });
  assert.match(text, /2 Pix para conferir, R\$ 78,50 no total\./);
  assert.doesNotMatch(brief({ role: "WAITER", orders: [pix(5)], business: null }), /Pix/);
  assert.doesNotMatch(brief({ role: "KITCHEN", orders: [pix(5)], business: null }), /Pix/);
});

test("vendas: só dono e gerente; sem venda hoje diz isso; o garçom não ouve vendas", () => {
  assert.match(brief({ business: sales(0, 0) }), /Ainda sem vendas hoje\.$/);
  assert.match(brief({ business: sales(42.5, 1) }), /Vendas de hoje: R\$ 42,50 em 1 pedido\.$/);
  assert.match(brief({ role: "MANAGER" }), /Vendas de hoje/);
  const waiter = brief({ role: "WAITER", business: null });
  assert.doesNotMatch(waiter, /Vendas|vendas/);
  assert.doesNotMatch(brief({ role: "CASHIER", business: null }), /não consegui ler as vendas/i);
});

test("busca que falhou nunca vira zero: a fala diz que não conseguiu ler aquilo", () => {
  const noOrders = brief({ orders: null });
  assert.match(noOrders, /Não consegui ler os pedidos agora\./);
  assert.doesNotMatch(noOrders, /Nenhum pedido|esperando/);
  const noSales = brief({ business: null });
  assert.match(noSales, /Não consegui ler as vendas agora\./);
  assert.doesNotMatch(noSales, /Ainda sem vendas|Vendas de hoje/);
  const noCalls = brief({ calls: null });
  assert.match(noCalls, /Não consegui ver as mesas chamando agora\./);
  assert.doesNotMatch(noCalls, /mesa chamando\.|mesas chamando\./);
  // Tudo falhou: três avisos honestos, nenhum número inventado.
  const none = brief({ orders: null, calls: null, business: null });
  assert.equal(none, "Bom dia, João. Não consegui ler os pedidos agora. Não consegui ver as mesas chamando agora. Não consegui ler as vendas agora.");
});

test("mesas chamando só para quem vai a uma mesa; a cozinha não ouve de mesa", () => {
  assert.match(brief({ role: "WAITER", business: null, calls: [call("a")] }), /1 mesa chamando\./);
  assert.doesNotMatch(brief({ role: "KITCHEN", business: null, calls: [call("a")] }), /mesa/);
  assert.doesNotMatch(brief({ role: "KITCHEN", business: null, calls: null }), /Não consegui ver as mesas/);
  // Sem nenhuma chamando não se diz nada (o dia está calmo; a frase dos pedidos já diz isso).
  assert.doesNotMatch(brief({ calls: [] }), /mesa/);
});

test("a saudação usa a hora de Brasília e só o primeiro nome; sem nome, só a saudação", () => {
  assert.match(brief(), /^Bom dia, João\./);
  assert.match(brief({ name: "" }), /^Bom dia\./);
  assert.match(brief({ name: null }), /^Bom dia\./);
  assert.match(briefOf({ name: "Ana", role: "OWNER", orders: [], calls: [], business: sales(), now: Date.parse("2026-10-23T18:30:00Z") }), /^Boa tarde, Ana\./);
});

test("os minutos são falados como gente fala", () => {
  assert.equal(spokenMinutes(0), "menos de 1 minuto");
  assert.equal(spokenMinutes(0.6), "menos de 1 minuto");
  assert.equal(spokenMinutes(1), "1 minuto");
  assert.equal(spokenMinutes(7.9), "7 minutos");
  assert.equal(spokenMinutes(59), "59 minutos");
  assert.equal(spokenMinutes(60), "1 hora");
  assert.equal(spokenMinutes(61), "1 hora e 1 minuto");
  assert.equal(spokenMinutes(65), "1 hora e 5 minutos");
  assert.equal(spokenMinutes(120), "2 horas");
  assert.equal(spokenMinutes(Number.NaN), "");
  assert.equal(spokenMinutes(-3), "");
});

// ---------------------------------------------------------------- a busca (o que o servidor entrega vira a fala; nada é inventado)

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");

test("a busca pergunta ao servidor na hora, uma busca por pedaço, cada uma com limite de tempo, e nada fica guardado", () => {
  const source = read("painel/readBriefing.ts");
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /BRIEF_WAIT_MS = 10000/);
  assert.match(source, /within\(fetchAdminOrders\(input\.companyId\)\)/);
  assert.match(source, /within\(fetchTableCalls\(input\.companyId\)\)/);
  assert.match(source, /manager \? within\(fetchBusiness\(input\.companyId, "hoje"\)\) : Promise\.resolve\(null\)/);
  assert.match(source, /Array\.isArray\(orders\.value\)/, "resposta que não é lista nunca vira 'nenhum pedido'");
  assert.doesNotMatch(source, /localStorage|sessionStorage|setState/);
});

test("quem escuta lê a fala em voz alta e descarta a resposta velha se a pessoa tocou de novo", () => {
  const hook = read("painel/useVoiceNav.ts");
  assert.match(hook, /answer\.kind === "brief"/);
  assert.match(hook, /\.catch\(\(\) => BRIEF_FAIL\)/);
  assert.match(hook, /if \(mine !== turn\.current\) return;\n\s+show\(\{ tone: "answer", heard, text \}\);\n\s+void speakAsync\(text\)/);
  assert.match(read("painel/PanelShell.tsx"), /onBrief: \(\) => readBriefing\(\{ companyId, role, name: user\.name \}\)/);
});
