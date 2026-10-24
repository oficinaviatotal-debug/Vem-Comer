import test from "node:test";
import assert from "node:assert/strict";

import { formatTime } from "../../frontend/src/service/format.ts";
import { ARM_MS, armKey, groupOf, markedIds, settleCheck, settleViewOf, toggleLeft } from "../../frontend/src/painel/settleLogic.ts";

/** O dinheiro sai com espaço que não quebra linha ("R$ 50,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/ /g, " ");

/** Uma entrega com dinheiro em aberto, como o servidor manda no acerto do caixa. */
const row = (id, amount, extra = {}) => ({ id, customer_name: "Cliente", amount, zone: "Centro", delivered_at: "2026-10-22T15:30:00Z", ...extra });
const group = (courier_id, name, orders) => ({
  courier_id,
  name,
  total: orders.reduce((sum, entry) => sum + Number(entry.amount), 0).toFixed(2),
  count: orders.length,
  orders,
});
const view = (couriers) => ({
  couriers,
  total: couriers.reduce((sum, entry) => sum + Number(entry.total), 0).toFixed(2),
  count: couriers.reduce((sum, entry) => sum + entry.count, 0),
});

const ana = () => group("c1", "Ana Silva", [row("o1", "48.00", { customer_name: "Pedro" }), row("o2", "14.50", { customer_name: "Lia", zone: "Bairro Novo" }), row("o3", "10.00")]);
const bia = () => group("c2", "Bia Gomes", [row("o9", "30.00")]);

test("o primeiro toque espera o segundo por 4 s (como o botão de confirmar da tela antiga)", () => {
  assert.equal(ARM_MS, 4000);
});

test("tudo vem marcado; o caixa tira o que o motoqueiro não trouxe, e pode pôr de volta", () => {
  const g = ana();
  assert.deepEqual(markedIds(g, []), ["o1", "o2", "o3"]);
  assert.deepEqual(markedIds(g, ["o2"]), ["o1", "o3"]);
  assert.deepEqual(markedIds(g, ["o1", "o2", "o3"]), []);
  assert.deepEqual(toggleLeft([], "o2"), ["o2"]);
  assert.deepEqual(toggleLeft(["o2"], "o2"), []);
  assert.deepEqual(toggleLeft(["o2"], "o3"), ["o2", "o3"]);
});

test("a chave do primeiro toque é o motoqueiro mais as entregas marcadas: mexer na marcação ou trocar de motoqueiro desarma", () => {
  const g = ana();
  const key = armKey(g, []);
  assert.equal(key, "c1|o1,o2,o3");
  assert.equal(armKey(g, []), key, "a mesma marcação dá a mesma chave");
  assert.notEqual(armKey(g, ["o2"]), key, "tirar uma entrega muda a chave");
  assert.notEqual(armKey(bia(), []), key, "outro motoqueiro tem outra chave");
});

test("antes de mandar o servidor é olhado de novo: se o que está marcado ainda está em aberto com o mesmo valor, segue", () => {
  const g = ana();
  assert.equal(settleCheck(g, [], view([ana(), bia()])), "same");
});

test("se uma entrega marcada já foi acertada por outra pessoa, ou o valor mudou, ou o motoqueiro saiu da lista, não manda", () => {
  const g = ana();
  const missing = group("c1", "Ana Silva", [row("o1", "48.00"), row("o3", "10.00")]);
  assert.equal(settleCheck(g, [], view([missing])), "changed", "o2 já foi acertada");
  const different = group("c1", "Ana Silva", [row("o1", "48.00"), row("o2", "15.00"), row("o3", "10.00")]);
  assert.equal(settleCheck(g, [], view([different])), "changed", "o valor de o2 mudou");
  assert.equal(settleCheck(g, [], view([bia()])), "changed", "a Ana não tem mais nada em aberto");
  assert.equal(settleCheck(g, [], view([])), "changed");
});

test("o que o caixa tirou da marcação não pesa na conferência, e entrega nova do mesmo motoqueiro não muda nada (só as marcadas vão)", () => {
  const g = ana();
  const withoutO2 = group("c1", "Ana Silva", [row("o1", "48.00"), row("o3", "10.00")]);
  assert.equal(settleCheck(g, ["o2"], view([withoutO2])), "same", "o2 estava desmarcada: pode ter sumido");
  const withNew = group("c1", "Ana Silva", [row("o1", "48.00"), row("o2", "14.50"), row("o3", "10.00"), row("o4", "22.00")]);
  assert.equal(settleCheck(g, [], view([withNew])), "same");
});

test("cada linha do acerto: quem, onde, a hora, o valor e se está marcada", () => {
  const g = groupOf(ana(), ["o2"], null);
  assert.equal(g.id, "c1");
  assert.equal(g.name, "Ana Silva");
  assert.equal(n(g.total), "R$ 72,50");
  assert.deepEqual(
    g.rows.map((r) => ({ id: r.id, label: r.label, amount: n(r.amount), checked: r.checked })),
    [
      { id: "o1", label: `Pedro · Centro · ${formatTime("2026-10-22T15:30:00Z")}`, amount: "R$ 48,00", checked: true },
      { id: "o2", label: `Lia · Bairro Novo · ${formatTime("2026-10-22T15:30:00Z")}`, amount: "R$ 14,50", checked: false },
      { id: "o3", label: `Cliente · Centro · ${formatTime("2026-10-22T15:30:00Z")}`, amount: "R$ 10,00", checked: true },
    ],
  );
});

test("a linha sem nome, sem região ou sem hora não mostra pedaço vazio nem 'undefined'", () => {
  const g = groupOf(group("c1", "  ", [{ id: "o1", customer_name: "  ", amount: "5.00", zone: "", delivered_at: null }]), [], null);
  assert.equal(g.name, "Sem nome");
  assert.equal(g.rows[0].label, "Cliente");
  assert.ok(!/undefined|null/.test(JSON.stringify(g)));
});

test("o botão diz o valor marcado e quantas entregas; sem nada marcado não há botão de acertar", () => {
  const all = groupOf(ana(), [], null);
  assert.equal(n(all.marked), "R$ 72,50");
  assert.equal(all.count, 3);
  assert.equal(n(all.button), "Recebi R$ 72,50 de Ana Silva (3 entregas)");
  const two = groupOf(ana(), ["o1"], null);
  assert.equal(n(two.marked), "R$ 24,50");
  assert.equal(n(two.button), "Recebi R$ 24,50 de Ana Silva (2 entregas)");
  const one = groupOf(ana(), ["o1", "o2"], null);
  assert.equal(n(one.button), "Recebi R$ 10,00 de Ana Silva (1 entrega)");
  const none = groupOf(ana(), ["o1", "o2", "o3"], null);
  assert.equal(none.button, "");
  assert.equal(none.count, 0);
  assert.equal(n(none.marked), "R$ 0,00");
  assert.equal(none.armed, false);
});

test("o botão só está 'armado' quando a chave guardada é a da marcação que está na tela", () => {
  const g = ana();
  assert.equal(groupOf(g, [], null).armed, false);
  assert.equal(groupOf(g, [], armKey(g, [])).armed, true);
  assert.equal(groupOf(g, ["o2"], armKey(g, [])).armed, false, "mexeu na marcação: o primeiro toque se perdeu");
  assert.equal(groupOf(bia(), [], armKey(g, [])).armed, false, "a chave é de outro motoqueiro");
  assert.equal(groupOf(g, ["o1", "o2", "o3"], armKey(g, ["o1", "o2", "o3"])).armed, false, "sem nada marcado nunca arma");
});

test("antes da primeira resposta a tela diz que está abrindo, e não que tudo está acertado", () => {
  const loading = settleViewOf({ cash: null, left: [], armed: null, error: "", notice: "" });
  assert.equal(loading.sub, "Abrindo o acerto…");
  assert.equal(loading.empty, "", "nada de 'Tudo acertado' enquanto não carregou");
  assert.deepEqual(loading.groups, []);
  assert.equal(loading.total, "");
});

test("sem dinheiro em aberto: calma, tudo acertado", () => {
  const calm = settleViewOf({ cash: view([]), left: [], armed: null, error: "", notice: "" });
  assert.equal(calm.sub, "Tudo acertado");
  assert.equal(calm.empty, "Nenhum dinheiro de motoqueiro em aberto. Tudo acertado.");
  assert.deepEqual(calm.groups, []);
  assert.equal(calm.total, "");
});

test("com dinheiro em aberto: a frase de cima soma e conta os motoqueiros (singular e plural)", () => {
  const one = settleViewOf({ cash: view([ana()]), left: [], armed: null, error: "", notice: "" });
  assert.equal(n(one.sub), "R$ 72,50 com 1 motoqueiro");
  assert.equal(one.empty, "");
  const two = settleViewOf({ cash: view([ana(), bia()]), left: [], armed: null, error: "", notice: "" });
  assert.equal(n(two.sub), "R$ 102,50 com 2 motoqueiros");
  assert.equal(n(two.total), "R$ 102,50");
  assert.deepEqual(two.groups.map((g) => g.id), ["c1", "c2"]);
});

test("a frase que o leitor de tela ouve: a confirmação enquanto arma, depois o aviso, senão a frase de cima", () => {
  const g = ana();
  const armed = settleViewOf({ cash: view([g, bia()]), left: [], armed: armKey(g, []), error: "", notice: "x" });
  assert.equal(n(armed.live), "Toque de novo para confirmar. Recebi R$ 72,50 de Ana Silva (3 entregas).");
  const noticed = settleViewOf({ cash: view([g]), left: [], armed: null, error: "", notice: "3 entregas acertadas: R$ 72,50 no caixa." });
  assert.equal(noticed.live, "3 entregas acertadas: R$ 72,50 no caixa.");
  const plain = settleViewOf({ cash: view([g]), left: [], armed: null, error: "", notice: "" });
  assert.equal(plain.live, plain.sub);
});

test("o erro e o aviso passam como vieram, e a lista que já carregou não some por causa de um erro", () => {
  const out = settleViewOf({ cash: view([ana()]), left: [], armed: null, error: "Sem sinal. Nada foi acertado. Tente de novo.", notice: "ok" });
  assert.equal(out.error, "Sem sinal. Nada foi acertado. Tente de novo.");
  assert.equal(out.notice, "ok");
  assert.equal(out.groups.length, 1);
});
