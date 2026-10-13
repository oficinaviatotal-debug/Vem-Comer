import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  HELP_TOPICS,
  HELP_MAX_MESSAGE,
  blankHelp,
  suggestedTopic,
  helpProblem,
  helpBody,
  wantsHelp,
  safeWhatsappUrl,
  inboxHeadline,
  stopwatchText,
  trackingTone,
  trackingChip,
} from "../../frontend/src/service/helpLogic.ts";

test("the topics are the same ones the server and the database know", () => {
  const python = readFileSync(new URL("../../backend/help_requests.py", import.meta.url), "utf8");
  const block = python.slice(python.indexOf("TOPICS = {"), python.indexOf("}", python.indexOf("TOPICS = {")));
  const server = [...block.matchAll(/"(\w+)": "([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));
  assert.deepEqual(HELP_TOPICS, server);
  const sql = readFileSync(new URL("../../database/migrations/014_pedidos_de_ajuda.sql", import.meta.url), "utf8");
  for (const topic of HELP_TOPICS) assert.ok(sql.includes(`'${topic.id}'`), topic.id);
});

test("the screen the owner is on suggests the topic", () => {
  assert.equal(suggestedTopic("assistente"), "cardapio");
  assert.equal(suggestedTopic("produtos"), "cardapio");
  assert.equal(suggestedTopic("marca"), "logo");
  assert.equal(suggestedTopic("plano"), "plano");
  assert.equal(suggestedTopic("pedidos"), "pedidos");
  assert.equal(suggestedTopic("dashboard"), "");
  assert.equal(suggestedTopic(""), "");
});

test("the request is checked before it is sent", () => {
  assert.match(helpProblem(blankHelp()), /assunto/);
  assert.equal(helpProblem({ topic: "cardapio", message: "", phone: "" }), "");
  assert.match(helpProblem({ topic: "outro", message: " ", phone: "" }), /poucas palavras/);
  assert.equal(helpProblem({ topic: "outro", message: "oi", phone: "" }) !== "", true);
  assert.equal(helpProblem({ topic: "outro", message: "travei", phone: "" }), "");
  assert.match(helpProblem({ topic: "erro", message: "x".repeat(HELP_MAX_MESSAGE + 1), phone: "" }), /Resuma/);
  assert.match(helpProblem({ topic: "erro", message: "", phone: "12345" }), /DDD/);
  assert.equal(helpProblem({ topic: "erro", message: "", phone: "(84) 99999-1234" }), "");
});

test("the body has only what the server wants", () => {
  assert.deepEqual(helpBody({ topic: "foto", message: "  a foto sai escura ", phone: "" }, "assistente"), {
    topic: "foto",
    message: "a foto sai escura",
    screen: "assistente",
  });
  const withPhone = helpBody({ topic: "foto", message: "", phone: "(84) 99999-1234" }, "x".repeat(80));
  assert.equal(withPhone.phone, "5584999991234");
  assert.equal(withPhone.screen.length, 40);
});

test("the owner says he is stuck", () => {
  for (const yes of [
    "preciso de ajuda",
    "ajuda",
    "Eu preciso de ajuda com o cardápio",
    "me ajuda por favor",
    "socorro",
    "travei aqui",
    "quero falar com uma pessoa",
    "chama o suporte",
    "estou travado, não sei o que fazer",
  ]) {
    assert.equal(wantsHelp(yes), true, yes);
  }
  for (const no of ["", "x-tudo 25 reais", "pizzaria", "não preciso de ajuda", "nunca preciso de ajuda", "ajudante de cozinha 12 reais", "repete", "voltar"]) {
    assert.equal(wantsHelp(no), false, no);
  }
});

test("only a WhatsApp link is ever opened", () => {
  assert.equal(safeWhatsappUrl("https://wa.me/5584999991234?text=Oi%20Jos%C3%A9"), "https://wa.me/5584999991234?text=Oi%20Jos%C3%A9");
  assert.equal(safeWhatsappUrl("https://wa.me/5584999991234"), "https://wa.me/5584999991234");
  for (const bad of ["javascript:alert(1)", "https://evil.example/wa.me/5584999991234", "http://wa.me/5584999991234", "https://wa.me/abc", "https://wa.me/5584999991234 onclick=x", "", null, undefined, 5]) {
    assert.equal(safeWhatsappUrl(bad), "", String(bad));
  }
});

test("the inbox headline and the stopwatch", () => {
  const none = { open_count: 0, summary: { over_deadline: 0 } };
  assert.equal(inboxHeadline(none), "Nenhum pedido de ajuda aberto");
  assert.equal(inboxHeadline({ open_count: 1, summary: { over_deadline: 0 } }), "1 pedido de ajuda aberto");
  assert.equal(inboxHeadline({ open_count: 3, summary: { over_deadline: 2 } }), "3 pedidos de ajuda abertos · 2 cadastros passaram do prazo");
  assert.equal(inboxHeadline({ open_count: 0, summary: { over_deadline: 1 } }), "Nenhum pedido de ajuda aberto · 1 cadastro passou do prazo");

  assert.equal(stopwatchText({ total: 0 }, 3), "");
  assert.match(stopwatchText({ total: 2, done: 0 }, 3), /2 restaurantes se cadastraram e ainda nenhum/);
  assert.match(stopwatchText({ total: 1, done: 0 }, 3), /^1 restaurante se cadastrou/);
  assert.equal(
    stopwatchText({ total: 4, done: 3, done_within_deadline: 2, median_label: "2 h" }, 3),
    "2 de 4 cadastraram o cardápio dentro de 3 dias. Tempo típico: 2 h."
  );
});

test("each state of the follow-up has a colour and a word", () => {
  assert.equal(trackingTone("over"), "bad");
  assert.equal(trackingTone("late"), "warn");
  assert.equal(trackingTone("watch"), "warn");
  assert.equal(trackingTone("done"), "ok");
  assert.equal(trackingTone("ok"), "quiet");
  for (const state of ["ok", "watch", "late", "over", "done"]) assert.ok(trackingChip(state).length > 3, state);
});
