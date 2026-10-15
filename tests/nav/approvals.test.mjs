import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CHANGE_NOTE_MIN,
  DECISIONS,
  NOTE_MAX,
  approvalsBadge,
  costText,
  dateBr,
  decisionOf,
  doneText,
  evidenceSource,
  noteProblem,
  queueHeadline,
  statusTone,
} from "../../frontend/src/service/approvalsLogic.ts";

test("there are exactly three answers and approving never promises more than releasing", () => {
  assert.deepEqual(DECISIONS.map((item) => item.key), ["approve", "refuse", "change"]);
  assert.deepEqual(DECISIONS.map((item) => item.label), ["Aprovar", "Recusar", "Pedir mudança"]);
  const approve = decisionOf("approve");
  assert.match(approve.hint, /só libera/);
  assert.doesNotMatch(approve.hint, /executa|envia|roda/);
  assert.equal(decisionOf("nope"), undefined);
  assert.equal(decisionOf(null), undefined);
});

test("every answer has a button that really sends it, different from the one that only picks", () => {
  for (const item of DECISIONS) {
    assert.ok(item.confirm.startsWith("Confirmar:"), item.key);
    assert.notEqual(item.confirm, item.label);
  }
});

test("asking for a change needs a note; the other answers do not", () => {
  assert.equal(noteProblem("approve", ""), "");
  assert.equal(noteProblem("refuse", "   "), "");
  assert.equal(noteProblem("change", ""), "Diga o que deve mudar.");
  assert.equal(noteProblem("change", "  ok "), "Diga o que deve mudar.");
  assert.equal(noteProblem("change", "x".repeat(CHANGE_NOTE_MIN)), "");
  assert.equal(noteProblem("approve", "x".repeat(NOTE_MAX + 1)), `A nota passa de ${NOTE_MAX} letras.`);
  assert.equal(noteProblem("approve", "x".repeat(NOTE_MAX)), "");
  assert.deepEqual(DECISIONS.filter((item) => item.needsNote).map((item) => item.key), ["change"]);
});

test("the queue line counts in words and says when nothing waits", () => {
  assert.equal(queueHeadline(0), "Nada espera o seu aval");
  assert.equal(queueHeadline(-3), "Nada espera o seu aval");
  assert.equal(queueHeadline(1), "1 decisão espera o seu aval");
  assert.equal(queueHeadline(4), "4 decisões esperam o seu aval");
});

test("each status has a colour family, and unknown ones read as stopped, never as done", () => {
  assert.equal(statusTone("pendente"), "wait");
  assert.equal(statusTone("aprovada"), "go");
  assert.equal(statusTone("feita"), "ok");
  assert.equal(statusTone("mudanca"), "ask");
  assert.equal(statusTone("recusada"), "stop");
  assert.equal(statusTone("falhou"), "stop");
  assert.equal(statusTone("qualquer-coisa"), "stop");
});

test("cost is written in reais, and zero is said in words", () => {
  assert.equal(costText(0), "Sem custo");
  assert.equal(costText(-5), "Sem custo");
  assert.equal(costText(Number.NaN), "Sem custo");
  assert.equal(costText(90), "R$ 0,90");
  assert.equal(costText(5), "R$ 0,05");
  assert.equal(costText(12345), "R$ 123,45");
  assert.equal(costText(123456789), "R$ 1.234.567,89");
});

test("every fact shows where it came from and when, in the Brazilian date", () => {
  assert.equal(dateBr("2026-10-15"), "15/10/2026");
  assert.equal(dateBr("15/10/2026"), "15/10/2026");
  assert.equal(dateBr(""), "");
  assert.equal(
    evidenceSource({ fact: "x", source: "docs/agentes-e-aprendizado.md", date: "2026-10-15" }),
    "Fonte: docs/agentes-e-aprendizado.md, 15/10/2026",
  );
  assert.equal(evidenceSource({ fact: "x", source: "Receita Federal", date: "" }), "Fonte: Receita Federal");
  assert.equal(evidenceSource({ fact: "x", source: "  ", date: "2026-10-15" }), "Sem fonte");
});

test("what the owner reads after deciding is honest about what happened", () => {
  assert.equal(doneText("aprovada", false), "Aprovada. Aprovar só libera: nada foi executado.");
  assert.equal(doneText("aprovada", true), "Já estava aprovada.");
  assert.equal(doneText("recusada", false), "Recusada. Fica no registro.");
  assert.equal(doneText("recusada", true), "Já estava recusada.");
  assert.equal(doneText("mudanca", false), "Pedido de mudança registrado.");
  assert.equal(doneText("mudanca", true), "O pedido de mudança já estava registrado.");
  assert.equal(doneText("outra", false), "Pronto.");
});

test("the menu badge is a number only when something waits", () => {
  assert.equal(approvalsBadge(3), 3);
  assert.equal(approvalsBadge(0), null);
  assert.equal(approvalsBadge(null), null);
  assert.equal(approvalsBadge(undefined), null);
});

// The words the screen uses for status and level must be the ones the server writes.
test("the status words match the server's, and the decision words match the endpoint's", () => {
  const server = readFileSync(new URL("../../backend/approvals.py", import.meta.url), "utf8");
  for (const status of ["pendente", "aprovada", "recusada", "mudanca", "feita", "falhou"]) {
    assert.ok(server.includes(`"${status}"`), status);
  }
  for (const key of DECISIONS.map((item) => item.key)) {
    assert.ok(server.includes(`"${key}"`), key);
  }
  const migration = readFileSync(new URL("../../database/migrations/020_registro_de_acoes.sql", import.meta.url), "utf8");
  for (const status of ["pendente", "aprovada", "recusada", "mudanca", "feita", "falhou"]) {
    assert.ok(migration.includes(`'${status}'`), status);
  }
});

test("the screen never decides who may decide, and never sends a user id", () => {
  const api = readFileSync(new URL("../../frontend/src/service/approvalsApi.ts", import.meta.url), "utf8");
  assert.match(api, /JSON\.stringify\(\{ decision, note \}\)/);
  assert.doesNotMatch(api, /user_id|decided_by|company_id/);
  const view = readFileSync(new URL("../../frontend/src/nav/ApprovalsView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(view, /dangerouslySetInnerHTML/);
});

test("the screen asks twice before sending a decision (pick, then confirm)", () => {
  const view = readFileSync(new URL("../../frontend/src/nav/ApprovalsView.tsx", import.meta.url), "utf8");
  // the first buttons only pick; only the confirm button calls the server
  assert.equal((view.match(/decideApproval\(/g) ?? []).length, 1);
  assert.match(view, /onClick=\{\(\) => pick\(item\.key\)\}/);
  assert.match(view, /onClick=\{\(\) => void confirm\(\)\}/);
});
