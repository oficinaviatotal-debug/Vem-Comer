import test from "node:test";
import assert from "node:assert/strict";

import { parsePanelCalls } from "../../frontend/src/mesa/callsLogic.ts";
import {
  CALLS_MS,
  FIRST_LOOK,
  ORDERS_MS,
  deskCallOf,
  deskTableViewOf,
  deskViewOf,
  nextAlert,
  openCode,
  openTyped,
  orderHrefOf,
  sortCalls,
  subOf,
  toneOf,
  withoutAnswered,
  whatOf,
} from "../../frontend/src/painel/deskLogic.ts";

const NOW = Date.parse("2026-10-22T15:00:00Z");
const raw = (extra = {}) => ({
  id: "c1",
  table_number: 4,
  kind: "garcom",
  label: "Garçom",
  text: "Mesa 4 chama o garçom",
  waiting_seconds: 30,
  repeats: 0,
  urgency: "normal",
  ...extra,
});
const calls = (...rows) => parsePanelCalls(rows);
const tables = [
  { id: "t1", number: 1 },
  { id: "t4", number: 4 },
  { id: "t12", number: 12 },
];
const order = (extra = {}) => ({
  id: "o1",
  status: "em preparo",
  order_type: "mesa",
  table_number: 4,
  customer_name: "Ana",
  total_price: 45.5,
  created_at: new Date(NOW - 7 * 60000).toISOString(),
  ...extra,
});

test("o ritmo: pergunta os chamados a cada 6 s e os pedidos a cada 8 s", () => {
  assert.equal(CALLS_MS, 6000);
  assert.equal(ORDERS_MS, 8000);
});

test("a frase de cima diz quantas mesas chamam, ou que ninguém chama", () => {
  assert.equal(subOf(0), "Ninguém chamando agora");
  assert.equal(subOf(1), "1 mesa chamando");
  assert.equal(subOf(3), "3 mesas chamando");
});

test("o que a mesa quer é a frase do servidor sem o 'Mesa 4' do começo; se o servidor mudar a frase, ela aparece inteira", () => {
  assert.equal(whatOf(raw()), "Chama o garçom");
  assert.equal(whatOf(raw({ kind: "conta", text: "Mesa 4 pede a conta" })), "Pede a conta");
  assert.equal(whatOf(raw({ kind: "limpeza", text: "Mesa 4 pede limpeza da mesa" })), "Pede limpeza da mesa");
  assert.equal(whatOf(raw({ text: "Garçom na mesa quatro" })), "Garçom na mesa quatro");
  assert.equal(whatOf(raw({ text: "Mesa 4 " })), "Garçom", "sem frase nenhuma, o nome curto do servidor");
});

test("a cor da fita é a do servidor: normal verde, demorando amarela, urgente vermelha; e sempre há uma palavra para quem não vê cor", () => {
  assert.equal(toneOf("normal"), "ok");
  assert.equal(toneOf("late"), "warn");
  assert.equal(toneOf("urgent"), "late");
  const [normal, late, urgent] = calls(raw(), raw({ id: "c2", urgency: "late" }), raw({ id: "c3", urgency: "urgent" })).map((c) => deskCallOf(c, tables));
  assert.equal(normal.word, "");
  assert.equal(late.word, "Está demorando");
  assert.equal(urgent.word, "Urgente");
});

test("quem está pior fica em cima: urgente, depois demorando, depois o resto; dentro de cada grupo, quem espera mais", () => {
  const list = calls(
    raw({ id: "a", waiting_seconds: 20 }),
    raw({ id: "b", waiting_seconds: 100 }),
    raw({ id: "c", waiting_seconds: 200, urgency: "late" }),
    raw({ id: "d", waiting_seconds: 50, urgency: "urgent", repeats: 2 }),
    raw({ id: "e", waiting_seconds: 500, urgency: "urgent" }),
  );
  assert.deepEqual(sortCalls(list).map((c) => c.id), ["e", "d", "c", "b", "a"]);
  assert.deepEqual(list.map((c) => c.id), ["a", "b", "c", "d", "e"], "a lista original não é mexida");
});

test("o cartão diz a mesa, o que quer, há quanto tempo e se chamou de novo; abre a mesa só se ela está no cadastro", () => {
  const card = deskCallOf(calls(raw({ waiting_seconds: 125, repeats: 1 }))[0], tables);
  assert.equal(card.where, "Mesa 4");
  assert.equal(card.what, "Chama o garçom");
  assert.equal(card.wait, "há 2 min");
  assert.equal(card.again, true);
  assert.equal(card.tableId, "t4");
  assert.equal(card.kind, "garcom");
  assert.equal(deskCallOf(calls(raw({ table_number: 9, text: "Mesa 9 pede água", kind: "agua" }))[0], tables).tableId, null, "mesa que não está no cadastro");
  assert.equal(deskCallOf(calls(raw())[0], null).tableId, null, "lista de mesas ainda não chegou");
});

test("o botão 'Já atendi' é lido por inteiro: a mesa, o que quer, a espera e a palavra, sem ponto dobrado", () => {
  const plain = deskCallOf(calls(raw({ waiting_seconds: 30 }))[0], tables);
  assert.equal(plain.spoken, "Já atendi. Mesa 4. Chama o garçom. há 30 s.");
  const bad = deskCallOf(calls(raw({ waiting_seconds: 500, repeats: 2, urgency: "urgent" }))[0], tables);
  assert.equal(bad.spoken, "Já atendi. Mesa 4. Chama o garçom. há 8 min, chamou de novo. Urgente.");
});

test("a tela de mesas: chamados ordenados, fichas por número, e a frase certa para cada situação", () => {
  const view = deskViewOf({ calls: calls(raw(), raw({ id: "c2", table_number: 12, kind: "conta", text: "Mesa 12 pede a conta", waiting_seconds: 200, urgency: "late" })), tables, orders: [order()] });
  assert.equal(view.sub, "2 mesas chamando");
  assert.deepEqual(view.calls.map((c) => c.where), ["Mesa 12", "Mesa 4"]);
  assert.deepEqual(view.tiles.map((t) => [t.number, t.tone, t.note]), [
    [1, "quiet", "Sem pedido"],
    [4, "call", "Chamando"],
    [12, "call", "Chamando"],
  ]);
  assert.equal(view.tiles[1].spoken, "Mesa 4: Chamando");
  assert.equal(view.tilesMessage, "");
  assert.equal(view.tilesFailed, false);

  const quiet = deskViewOf({ calls: [], tables, orders: [order()] });
  assert.equal(quiet.sub, "Ninguém chamando agora");
  assert.equal(quiet.tiles.find((t) => t.number === 4).tone, "busy");
  assert.equal(quiet.tiles.find((t) => t.number === 4).note, "1 pedido");
});

test("enquanto as mesas não chegam, a tela diz que está abrindo; sem mesas cadastradas, diz onde cadastrar; com erro, manda tentar de novo — e os chamados aparecem em qualquer caso", () => {
  const list = calls(raw());
  const loading = deskViewOf({ calls: list, tables: null, orders: [] });
  assert.equal(loading.tiles, null);
  assert.equal(loading.tilesMessage, "Abrindo as mesas…");
  assert.equal(loading.calls.length, 1, "o chamado não espera a lista de mesas");

  const none = deskViewOf({ calls: [], tables: [], orders: [] });
  assert.deepEqual(none.tiles, []);
  assert.equal(none.tilesMessage, "Ainda não há mesas cadastradas. Cadastre em Mesas, no menu.");

  const failed = deskViewOf({ calls: list, tables: null, orders: [], tablesFailed: true });
  assert.equal(failed.tilesMessage, "Não consegui abrir a lista de mesas. Confira a internet.");
  assert.equal(failed.tilesFailed, true);
  assert.equal(failed.calls.length, 1);
});

test("a resposta ao número digitado: a mesa (04 e 'mesa 4' valem), ou a frase de por que não abriu", () => {
  assert.deepEqual(openTyped(tables, "4"), { table: tables[1] });
  assert.deepEqual(openTyped(tables, "04"), { table: tables[1] });
  assert.deepEqual(openTyped(tables, "Mesa 12"), { table: tables[2] });
  assert.deepEqual(openTyped(tables, "99"), { message: "Não achei essa mesa no cadastro. Confira o número ou toque na lista." });
  assert.deepEqual(openTyped(tables, "abc"), { message: "Não achei essa mesa no cadastro. Confira o número ou toque na lista." });
  assert.deepEqual(openTyped(tables, "  "), { message: "Digite o número da mesa." });
});

test("a mesa aberta: os chamados dela (mais urgente primeiro), os pedidos andando com estado e valor, e a frase do que existe", () => {
  const view = deskTableViewOf({
    table: tables[1],
    calls: calls(raw(), raw({ id: "c2", table_number: 4, kind: "conta", text: "Mesa 4 pede a conta", urgency: "late", waiting_seconds: 240 }), raw({ id: "c3", table_number: 7 })),
    tables,
    orders: [
      order(),
      order({ id: "o2", status: "concluido", customer_name: "Pronto já" }),
      order({ id: "o3", table_number: 9, customer_name: "Outra mesa" }),
      order({ id: "o4", customer_name: "", status: "PENDING_PAYMENT", total_price: "12", created_at: new Date(NOW - 30000).toISOString() }),
    ],
    now: NOW,
    orderHref: "https://exemplo.vem/?empresa=x&mesa=t4",
  });
  assert.equal(view.title, "Mesa 4");
  assert.equal(view.headline, "2 chamados abertos e 2 pedidos em andamento");
  assert.deepEqual(view.calls.map((c) => c.id), ["c2", "c1"]);
  assert.deepEqual(view.orders.map((o) => [o.name, o.status, o.tone, o.wait, o.price]), [
    ["Ana", "Em preparo", "prep", "há 7 min", "R$ 45,50"],
    ["Sem nome", "Aguardando", "wait", "agora", "R$ 12,00"],
  ]);
  assert.equal(view.orderHref, "https://exemplo.vem/?empresa=x&mesa=t4");

  const empty = deskTableViewOf({ table: tables[0], calls: [], tables, orders: [], now: NOW, orderHref: null });
  assert.equal(empty.headline, "Nenhum chamado e nenhum pedido em andamento");
  assert.equal(empty.orderHref, null);
});

test("o botão de pedir pela mesa só vale com endereço http(s) de verdade", () => {
  assert.equal(orderHrefOf("https://a.example/x?mesa=1"), "https://a.example/x?mesa=1");
  assert.equal(orderHrefOf("http://localhost:5173/?mesa=1"), "http://localhost:5173/?mesa=1");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "", null, undefined, "não é endereço", "//a.example"]) {
    assert.equal(orderHrefOf(bad), null, `${bad}`);
  }
});

test("o apito: o que já estava aberto ao abrir a tela não faz alarde; chamado novo apita; urgente apita mais uma vez, só uma", () => {
  let state = FIRST_LOOK;
  let step = nextAlert(state, calls(raw()));
  assert.equal(step.alert, null, "primeira busca é silenciosa");
  state = step.state;

  step = nextAlert(state, calls(raw()));
  assert.equal(step.alert, null, "nada mudou");
  state = step.state;

  step = nextAlert(state, calls(raw(), raw({ id: "c2", table_number: 7, text: "Mesa 7 pede água", kind: "agua" })));
  assert.equal(step.alert, "call", "chamado novo");
  state = step.state;

  step = nextAlert(state, calls(raw({ urgency: "urgent", waiting_seconds: 430 }), raw({ id: "c2", table_number: 7, text: "Mesa 7 pede água", kind: "agua" })));
  assert.equal(step.alert, "urgent", "o conhecido virou urgente");
  state = step.state;

  step = nextAlert(state, calls(raw({ urgency: "urgent", waiting_seconds: 440 }), raw({ id: "c2", table_number: 7, text: "Mesa 7 pede água", kind: "agua" })));
  assert.equal(step.alert, null, "já avisou desse urgente");
  state = step.state;

  step = nextAlert(state, calls(raw({ id: "c9", table_number: 2, text: "Mesa 2 chama o garçom", urgency: "urgent", repeats: 2 })));
  assert.equal(step.alert, "urgent", "chamado novo que já chega urgente apita forte");
});

test("o QR lido: abre a mesa deste restaurante; outro restaurante, texto qualquer e mesa fora do cadastro dizem por que não abriu", () => {
  const id4 = "123e4567-e89b-42d3-a456-426614174000";
  const known = [{ id: id4, number: 4 }];
  assert.deepEqual(openCode(known, `https://vem.example/?empresa=acai&mesa=${id4}`, "acai"), { table: known[0] });
  assert.deepEqual(openCode(known, `https://vem.example/?empresa=ACAI&mesa=${id4.toUpperCase()}`, "acai"), { table: known[0] }, "maiúsculas não importam");
  assert.deepEqual(openCode(known, `https://vem.example/?empresa=outro&mesa=${id4}`, "acai"), { message: "Este QR é de outro restaurante." });
  assert.deepEqual(openCode(known, "https://exemplo.com/promo", "acai"), { message: "Este QR não é de uma mesa. Aponte para o QR do cartaz da mesa." });
  assert.deepEqual(openCode(known, "só um texto", "acai"), { message: "Este QR não é de uma mesa. Aponte para o QR do cartaz da mesa." });
  assert.deepEqual(openCode(known, `https://vem.example/?empresa=acai&mesa=00000000-0000-4000-8000-000000000000`, "acai"), {
    message: "Esta mesa não está no cadastro deste restaurante. Escolha na lista.",
  });
  assert.deepEqual(openCode([], `https://vem.example/?empresa=acai&mesa=${id4}`, "acai"), {
    message: "Esta mesa não está no cadastro deste restaurante. Escolha na lista.",
  });
});

test("chamado já atendido não volta por uma busca atrasada; quando o servidor deixa de mandar, a tela esquece", () => {
  const list = calls(raw({ id: "a" }), raw({ id: "b", table_number: 7 }));
  const first = withoutAnswered(list, new Set(["a"]));
  assert.deepEqual(first.calls.map((c) => c.id), ["b"], "o 'a' foi atendido e a busca atrasada ainda o trazia");
  assert.deepEqual([...first.answered], ["a"], "o servidor ainda manda o 'a': continua escondido");
  const later = withoutAnswered(calls(raw({ id: "b", table_number: 7 })), first.answered);
  assert.deepEqual(later.calls.map((c) => c.id), ["b"]);
  assert.deepEqual([...later.answered], [], "o servidor parou de mandar o 'a': pode esquecer");
  assert.deepEqual(withoutAnswered([], new Set()).calls, []);
});
