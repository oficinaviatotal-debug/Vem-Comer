import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ANSWER_OPTIONS,
  CAN_ERASE_KINDS,
  ERASE_WORD,
  RESPONSE_MAX,
  answerProblem,
  contactLink,
  deadlineText,
  deadlineTone,
  eraseConfirmed,
  listHeadline,
  safeHttpUrl,
} from "../../frontend/src/service/titularLogic.ts";

const PYTHON = readFileSync(new URL("../../backend/titular.py", import.meta.url), "utf8");

test("the answer options are the ones the server accepts", () => {
  const block = PYTHON.match(/^ANSWER_STATUSES = \(([^)]*)\)/m)[1];
  const server = [...block.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    ANSWER_OPTIONS.map((option) => option.id),
    server,
  );
});

test("only elimination requests can be executed from the inbox, and the word is the one the server wants", () => {
  assert.deepEqual([...CAN_ERASE_KINDS], ["eliminacao"]);
  const api = readFileSync(new URL("../../backend/titular_api.py", import.meta.url), "utf8");
  assert.ok(api.includes(`"${ERASE_WORD}"`), "the confirmation word must be the same on both sides");
  assert.ok(PYTHON.includes('"eliminacao"'));
});

test("the response limit is the server's", () => {
  const server = Number(PYTHON.match(/^DESCRIPTION_MAX = (\d+)/m)[1]);
  assert.equal(RESPONSE_MAX, server);
});

test("deadline text says how late or how much time is left", () => {
  assert.equal(deadlineText({ overdue: true, hours_left: -3 }), "Venceu há 3 horas");
  assert.equal(deadlineText({ overdue: true, hours_left: -1 }), "Venceu há 1 hora");
  assert.equal(deadlineText({ overdue: true, hours_left: -50 }), "Venceu há 2 dias");
  assert.equal(deadlineText({ overdue: false, hours_left: 5 }), "Vence em 5 horas");
  assert.equal(deadlineText({ overdue: false, hours_left: 24 }), "Vence em 1 dia");
  assert.equal(deadlineText({ overdue: false, hours_left: 15 * 24 - 1 }), "Vence em 14 dias");
});

test("the tone grows louder as the deadline gets close", () => {
  assert.equal(deadlineTone({ overdue: true, hours_left: -1 }), "bad");
  assert.equal(deadlineTone({ overdue: false, hours_left: 40 }), "warn");
  assert.equal(deadlineTone({ overdue: false, hours_left: 300 }), "ok");
});

test("only e-mails and Brazilian WhatsApp numbers become links", () => {
  assert.deepEqual(contactLink("ana@exemplo.com"), { href: "mailto:ana@exemplo.com", label: "ana@exemplo.com" });
  assert.deepEqual(contactLink("5584999991234"), { href: "https://wa.me/5584999991234", label: "WhatsApp 5584999991234" });
  for (const bad of [null, undefined, 5, "", "javascript:alert(1)", "a@b", "x y@z.com", "<a@b.com>", "84999991234"]) {
    assert.equal(contactLink(bad), null, String(bad));
  }
});

test("only real web addresses become links", () => {
  assert.equal(safeHttpUrl("https://x.exemplo/cardapio"), "https://x.exemplo/cardapio");
  assert.equal(safeHttpUrl(" http://x.exemplo/a "), "http://x.exemplo/a");
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>", "x.exemplo", "https://a b", 'https://x"onload=1', null, 5]) {
    assert.equal(safeHttpUrl(bad), "", String(bad));
  }
});

test("answering or denying needs text, and denying needs the reason", () => {
  assert.equal(answerProblem("respondida", ""), "Escreva a resposta.");
  assert.equal(answerProblem("negada", "   "), "Escreva o motivo de não atender.");
  assert.equal(answerProblem("respondida", "Enviamos a cópia."), "");
  assert.equal(answerProblem("em_analise", ""), "");
  assert.equal(answerProblem("encerrada", ""), "");
  assert.equal(answerProblem("apagada", "ok ok ok"), "Escolha o que fazer com o pedido.");
  assert.match(answerProblem("respondida", "a".repeat(RESPONSE_MAX + 1)), /passou de/);
});

test("the headline counts open and late requests", () => {
  assert.equal(listHeadline({ items: [], overdue: 0 }), "Nenhum pedido aberto.");
  assert.equal(listHeadline({ items: [{}], overdue: 0 }), "1 pedido aberto");
  assert.equal(listHeadline({ items: [{}, {}], overdue: 1 }), "2 pedidos abertos, 1 com prazo vencido");
  assert.equal(listHeadline({ items: [{}, {}, {}], overdue: 2 }), "3 pedidos abertos, 2 com prazo vencido");
});

test("erasing needs the exact word", () => {
  assert.equal(eraseConfirmed("ANONIMIZAR"), true);
  assert.equal(eraseConfirmed("  ANONIMIZAR "), true);
  for (const wrong of ["", "anonimizar", "sim", "ANONIMIZA", "ANONIMIZAR!"]) assert.equal(eraseConfirmed(wrong), false, wrong);
});
