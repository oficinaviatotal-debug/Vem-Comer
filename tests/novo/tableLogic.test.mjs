import test from "node:test";
import assert from "node:assert/strict";

import { CALL_AGAIN_AFTER_MS, buttonState, MAIN_CALLS, SMALL_CALLS } from "../../frontend/src/mesa/callsLogic.ts";
import {
  CALL_POLL_MS,
  NOTICE_MS,
  afterCheck,
  errorTextOf,
  savedCall,
  stateOf,
  tableTitle,
  tableViewOf,
  tileOf,
} from "../../frontend/src/loja/tableLogic.ts";

const NOW = 1_800_000_000_000;
const call = (kind, status, ago, id = `${kind}-1`) => ({ id, kind, status, savedAt: NOW - ago });
const base = (extra = {}) => ({
  tableNumber: 4,
  calls: [],
  now: NOW,
  sending: null,
  notice: "",
  error: "",
  ordersCount: 0,
  jobsHref: null,
  ...extra,
});

test("o título diz a mesa; enquanto o número não chegou, diz 'Sua mesa'", () => {
  assert.equal(tableTitle(4), "Mesa 4");
  assert.equal(tableTitle(12), "Mesa 12");
  assert.equal(tableTitle(null), "Sua mesa");
  assert.equal(tableTitle(0), "Sua mesa");
});

test("sem chamada nenhuma, os quatro botões estão prontos, na ordem da mesa antiga (garçom e conta grandes; água e limpeza pequenas)", () => {
  const view = tableViewOf(base());
  assert.deepEqual(view.main.map((tile) => tile.kind), ["garcom", "conta"]);
  assert.deepEqual(view.small.map((tile) => tile.kind), ["agua", "limpeza"]);
  for (const tile of [...view.main, ...view.small]) {
    assert.equal(tile.state, "ready");
    assert.equal(tile.locked, false);
    assert.equal(tile.status, "");
  }
  assert.equal(view.main[0].title, "Chamar garçom");
  assert.equal(view.main[0].note, "Preciso de ajuda");
  assert.equal(view.main[1].title, "Pedir a conta");
  assert.equal(view.sub, "O que você precisa agora?");
});

test("recém-chamado fica travado e diz que já vem; passado um minuto, deixa avisar de novo", () => {
  const fresh = tileOf(MAIN_CALLS[0], call("garcom", "open", 10_000), NOW, false);
  assert.equal(fresh.state, "called");
  assert.equal(fresh.locked, true);
  assert.equal(fresh.status, "Chamado");
  assert.equal(fresh.note, "Aguarde um instante, já vai chegar.");

  const edge = tileOf(MAIN_CALLS[0], call("garcom", "open", CALL_AGAIN_AFTER_MS - 1), NOW, false);
  assert.equal(edge.state, "called", "um instante antes do minuto ainda espera");

  const late = tileOf(MAIN_CALLS[0], call("garcom", "open", CALL_AGAIN_AFTER_MS), NOW, false);
  assert.equal(late.state, "again");
  assert.equal(late.locked, false, "depois de um minuto o toque volta a valer");
  assert.equal(late.status, "Ainda não veio?");
  assert.equal(late.note, "Toque para avisar de novo.");
});

test("chamada atendida deixa chamar de novo na hora e diz 'Atendido'", () => {
  const answered = tileOf(SMALL_CALLS[0], call("agua", "answered", 5_000), NOW, false);
  assert.equal(answered.state, "answered");
  assert.equal(answered.locked, false);
  assert.equal(answered.status, "Atendido");
  assert.equal(answered.note, "Toque se precisar de novo.");
});

test("enquanto o aviso vai ao servidor, só aquele botão trava ('Avisando…') e os outros seguem prontos", () => {
  const view = tableViewOf(base({ sending: "conta" }));
  const conta = view.main.find((tile) => tile.kind === "conta");
  assert.equal(conta.state, "busy");
  assert.equal(conta.locked, true);
  assert.equal(conta.status, "Avisando…");
  assert.equal(view.main.find((tile) => tile.kind === "garcom").state, "ready");
  assert.equal(view.small.every((tile) => tile.state === "ready"), true);
});

test("o estado do botão segue a mesma regra do botão da mesa antiga (buttonState), em todos os momentos", () => {
  const moments = [0, 1_000, CALL_AGAIN_AFTER_MS - 1, CALL_AGAIN_AFTER_MS, CALL_AGAIN_AFTER_MS + 1, 600_000];
  for (const option of [...MAIN_CALLS, ...SMALL_CALLS]) {
    assert.equal(stateOf(undefined, NOW, false), "ready");
    for (const ago of moments) {
      for (const status of ["open", "answered"]) {
        const mine = call(option.kind, status, ago);
        const old = buttonState(option, mine, NOW);
        const tile = tileOf(option, mine, NOW, false);
        assert.equal(tile.locked, old.disabled, `${option.kind} ${status} há ${ago} ms: travado`);
        assert.equal(tile.state === "answered", old.answered, `${option.kind} ${status} há ${ago} ms: atendido`);
      }
    }
  }
});

test("a frase para o leitor de tela diz o nome, o estado e o que fazer (a cor sozinha não conta)", () => {
  assert.equal(tileOf(MAIN_CALLS[1], undefined, NOW, false).spoken, "Pedir a conta. Quero pagar.");
  assert.equal(
    tileOf(MAIN_CALLS[0], call("garcom", "open", 10_000), NOW, false).spoken,
    "Chamar garçom. Chamado. Aguarde um instante, já vai chegar.",
  );
  assert.equal(tileOf(SMALL_CALLS[1], call("limpeza", "answered", 1_000), NOW, false).spoken, "Limpeza. Atendido. Toque se precisar de novo.");
  // 'Avisando…' lido sem as reticências, para o leitor não soletrar.
  assert.equal(tileOf(SMALL_CALLS[0], undefined, NOW, true).spoken, "Água. Avisando.");
});

test("cada tipo guarda a própria chamada: chamar a água não mexe no botão do garçom", () => {
  const view = tableViewOf(base({ calls: [call("agua", "open", 5_000), call("conta", "answered", 8_000)] }));
  assert.equal(view.small.find((tile) => tile.kind === "agua").state, "called");
  assert.equal(view.main.find((tile) => tile.kind === "conta").state, "answered");
  assert.equal(view.main.find((tile) => tile.kind === "garcom").state, "ready");
  assert.equal(view.small.find((tile) => tile.kind === "limpeza").state, "ready");
});

test("a confirmação, o erro e a contagem de pedidos passam como vieram; o endereço do Vem Trabalhar só vale com https", () => {
  const view = tableViewOf(base({ notice: "Avisamos o atendente.", error: "Não deu.", ordersCount: 2, jobsHref: "https://vemtrabalhar.example/vagas" }));
  assert.equal(view.notice, "Avisamos o atendente.");
  assert.equal(view.error, "Não deu.");
  assert.equal(view.ordersCount, 2);
  assert.equal(view.jobsHref, "https://vemtrabalhar.example/vagas");
  for (const bad of ["http://vemtrabalhar.example", "javascript:alert(1)", "", null, undefined, "não é endereço"]) {
    assert.equal(tableViewOf(base({ jobsHref: bad })).jobsHref, null, `${bad}`);
  }
});

test("ao perguntar 'já atenderam?': atendida marca; chamada que o servidor não conhece (404) volta ao normal; falha de internet espera", () => {
  assert.equal(afterCheck({ status: "answered" }), "answered");
  assert.equal(afterCheck({ status: "open" }), "wait");
  assert.equal(afterCheck({}), "wait");
  assert.equal(afterCheck({ failedWith: 404 }), "gone");
  assert.equal(afterCheck({ failedWith: 500 }), "wait");
  assert.equal(afterCheck({ failedWith: null }), "wait");
});

test("o que o servidor devolve ao toque: sem código ou com tipo estranho não vale; a frase dele vale, senão a nossa", () => {
  assert.equal(savedCall(null), null);
  assert.equal(savedCall("ok"), null);
  assert.equal(savedCall({ kind: "garcom" }), null);
  assert.equal(savedCall({ id: "c1", kind: "pizza" }), null);
  assert.deepEqual(savedCall({ id: 7, kind: "conta" }), { id: "7", kind: "conta", message: "Avisamos o atendente." });
  assert.deepEqual(savedCall({ id: "c2", kind: "agua", message: "  Já levamos a água.  " }), { id: "c2", kind: "agua", message: "Já levamos a água." });
  assert.deepEqual(savedCall({ id: "c3", kind: "agua", message: "   " }), { id: "c3", kind: "agua", message: "Avisamos o atendente." });
});

test("as frases de erro mandam o cliente chamar o atendente com a mão; só o 'espere um pouco' do servidor passa", () => {
  assert.equal(errorTextOf(429, "Espere um minuto para chamar de novo."), "Espere um minuto para chamar de novo.");
  assert.equal(errorTextOf(404, "Mesa não encontrada"), "Não encontramos esta mesa. Chame o atendente com a mão.");
  assert.equal(errorTextOf(null, "Failed to fetch"), "Não deu para avisar. Confira a internet ou chame o atendente com a mão.");
  assert.equal(errorTextOf(500, "erro interno do banco"), "Não deu para avisar. Confira a internet ou chame o atendente com a mão.");
});

test("o ritmo: pergunta a cada 8 s e a confirmação some em 6 s", () => {
  assert.equal(CALL_POLL_MS, 8000);
  assert.equal(NOTICE_MS, 6000);
});
