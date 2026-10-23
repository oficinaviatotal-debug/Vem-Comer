import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allowedViews } from "../../frontend/src/painel/shellLogic.ts";
import { interpretVoiceNav, normalizeSpeech } from "../../frontend/src/painel/voiceNavLogic.ts";
import {
  ASK_MS,
  canMarkDishes,
  confirmationOf,
  findDish,
  namesText,
  offerFor,
  parseDishCommand,
} from "../../frontend/src/painel/voiceDishLogic.ts";

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");
/** Como a voz recebe a frase: já sem acento nem pontuação. */
const parse = (text) => parseDishCommand(normalizeSpeech(text));

const MENU = [
  { id: "p1", name: "Pastel de carne" },
  { id: "p2", name: "Pastel de queijo" },
  { id: "p3", name: "Açaí 300ml" },
  { id: "p4", name: "Açaí 500ml" },
  { id: "p5", name: "Coca-Cola lata" },
  { id: "p6", name: "Limão" },
  { id: "p7", name: "Xis Tudo", sold_out: true },
];

// ---------------------------------------------------------------- o que a pessoa pediu

test("\"acabou o pastel de carne\" e parentes pedem para marcar como esgotado, com as palavras do prato", () => {
  assert.deepEqual(parse("Acabou o pastel de carne"), { action: "soldout", words: ["pastel", "carne"] });
  assert.deepEqual(parse("o pastel de carne acabou"), { action: "soldout", words: ["pastel", "carne"] });
  assert.deepEqual(parse("Esgotou o açaí"), { action: "soldout", words: ["acai"] });
  assert.deepEqual(parse("acabaram os pastéis"), { action: "soldout", words: ["pasteis"] });
  assert.deepEqual(parse("ficou sem coca"), { action: "soldout", words: ["coca"] });
  assert.deepEqual(parse("não tem mais limão"), { action: "soldout", words: ["limao"] }, "\"não tem mais\" é jeito de dizer que acabou");
  assert.deepEqual(parse("pode marcar o açaí como esgotado"), { action: "soldout", words: ["acai"] });
});

test("\"voltou o açaí\" e parentes pedem para tirar o esgotado (a frase mais comprida vence)", () => {
  assert.deepEqual(parse("Voltou o açaí"), { action: "back", words: ["acai"] });
  assert.deepEqual(parse("chegou a coca"), { action: "back", words: ["coca"] });
  assert.deepEqual(parse("tem de novo o pastel de carne"), { action: "back", words: ["pastel", "carne"] });
  assert.deepEqual(parse("tira o esgotado do açaí"), { action: "back", words: ["acai"] });
  assert.deepEqual(parse("desmarca o limão"), { action: "back", words: ["limao"] });
  assert.deepEqual(parse("o limão não está mais esgotado"), { action: "back", words: ["limao"] }, "\"não está mais esgotado\" é o contrário de esgotado");
});

test("sem nome de prato, ou com \"não\", ou falando de pedido e entrega, não é pedido de prato", () => {
  for (const text of ["acabou", "esgotado", "voltou", "não acabou o pastel", "ainda não voltou o açaí", "o pedido chegou", "chegou pedido novo", "a entrega terminou", "chegaram os pedidos", "a mesa 4 chamou e acabou", "o motoboy chegou", "bom dia", ""]) {
    assert.equal(parse(text), null, text);
  }
});

test("a fala sem acento que o celular às vezes devolve também vale", () => {
  assert.deepEqual(parse("acabou a coca cola"), { action: "soldout", words: ["coca", "cola"] });
  assert.deepEqual(parse("ACABOU O PASTEL DE QUEIJO!"), { action: "soldout", words: ["pastel", "queijo"] });
});

// ---------------------------------------------------------------- qual prato

test("acha o prato quando todas as palavras ditas estão no nome, e entende o plural", () => {
  assert.deepEqual(findDish(MENU, ["pastel", "carne"]), { kind: "one", dish: MENU[0] });
  assert.deepEqual(findDish(MENU, ["pasteis", "queijo"]), { kind: "one", dish: MENU[1] });
  assert.deepEqual(findDish(MENU, ["limoes"]), { kind: "one", dish: MENU[5] });
  assert.deepEqual(findDish(MENU, ["coca"]), { kind: "one", dish: MENU[4] });
  assert.deepEqual(findDish(MENU, ["xis"]), { kind: "one", dish: MENU[6] });
});

test("não adivinha: mais de um prato com a palavra vira lista de nomes", () => {
  assert.deepEqual(findDish(MENU, ["pastel"]), { kind: "many", names: ["Pastel de carne", "Pastel de queijo"] });
  assert.deepEqual(findDish(MENU, ["acai"]), { kind: "many", names: ["Açaí 300ml", "Açaí 500ml"] });
  // Dito o resto do nome, deixa de haver dúvida.
  assert.deepEqual(findDish(MENU, ["acai", "500ml"]), { kind: "one", dish: MENU[3] });
});

test("quando um nome é parte do outro, vale o que foi falado inteiro", () => {
  const menu = [
    { id: "a", name: "Pastel" },
    { id: "b", name: "Pastel de carne" },
  ];
  assert.deepEqual(findDish(menu, ["pastel"]), { kind: "one", dish: menu[0] });
  assert.deepEqual(findDish(menu, ["pastel", "carne"]), { kind: "one", dish: menu[1] });
});

test("palavra que não está em prato nenhum: nenhum prato (nunca o parecido)", () => {
  assert.deepEqual(findDish(MENU, ["lasanha"]), { kind: "none" });
  assert.deepEqual(findDish(MENU, ["pastel", "frango"]), { kind: "none" });
  assert.deepEqual(findDish(MENU, []), { kind: "none" });
  assert.deepEqual(findDish([], ["pastel"]), { kind: "none" });
});

test("a lista de nomes fica curta e diz quantos faltam", () => {
  assert.equal(namesText(["A"]), "A");
  assert.equal(namesText(["A", "B"]), "A ou B");
  assert.equal(namesText(["A", "B", "C"]), "A, B ou C");
  assert.equal(namesText(["A", "B", "C", "D", "E"]), "A, B, C e mais 2");
});

// ---------------------------------------------------------------- o que a voz responde

test("achou o prato: pergunta o nome que entendeu e não marca nada (marcar é depois do sim)", () => {
  const offer = offerFor({ action: "soldout", words: ["pastel", "carne"], products: MENU });
  assert.equal(offer.kind, "ask");
  assert.equal(offer.action, "soldout");
  assert.deepEqual(offer.dish, { id: "p1", name: "Pastel de carne" });
  assert.match(offer.say, /Pastel de carne/);
  assert.match(offer.say, /\?|Confirma/, "é uma pergunta");

  const back = offerFor({ action: "back", words: ["xis"], products: MENU });
  assert.equal(back.kind, "ask");
  assert.deepEqual(back.dish, { id: "p7", name: "Xis Tudo" });
  assert.match(back.say, /Xis Tudo/);
});

test("já está como a pessoa quer: avisa e não pergunta nada", () => {
  const sold = offerFor({ action: "soldout", words: ["xis"], products: MENU });
  assert.equal(sold.kind, "info");
  assert.match(sold.say, /Xis Tudo/);
  assert.match(sold.say, /esgotado/);
  assert.match(sold.say, /Não mudei nada/);
  const back = offerFor({ action: "back", words: ["limao"], products: MENU });
  assert.equal(back.kind, "info");
  assert.match(back.say, /Limão/);
  assert.match(back.say, /Não mudei nada/);
});

test("mais de um prato: lista os nomes e pede o nome inteiro; nenhum prato: diz e abre os produtos", () => {
  const many = offerFor({ action: "soldout", words: ["acai"], products: MENU });
  assert.equal(many.kind, "info");
  assert.equal(many.warn, true);
  assert.match(many.say, /Açaí 300ml ou Açaí 500ml/);
  assert.match(many.say, /nome inteiro/);
  assert.equal(many.open, undefined, "não troca de tela quando falta só o nome inteiro");

  const none = offerFor({ action: "soldout", words: ["lasanha"], products: MENU });
  assert.equal(none.kind, "info");
  assert.equal(none.warn, true);
  assert.equal(none.open, "produtos");
  assert.match(none.say, /produtos/);
});

test("só quem o servidor deixa (dono, gerente, cozinha) ouve a pergunta; \"acabou\" sozinho continua abrindo a tela", () => {
  const menuOf = (role) => allowedViews({ role, planBlocked: false, hasPlanTab: true, platformAdmin: false });
  const said = (transcript, role = "OWNER", allowed = menuOf(role)) => interpretVoiceNav({ transcript, role, allowed, current: "inicio" });
  assert.deepEqual(said("Acabou o pastel de carne"), { kind: "dish", action: "soldout", words: ["pastel", "carne"] });
  assert.deepEqual(said("voltou o açaí"), { kind: "dish", action: "back", words: ["acai"] });
  for (const role of ["MANAGER", "KITCHEN"]) assert.equal(said("acabou o pastel de carne", role).kind, "dish", role);
  for (const role of ["WAITER", "CASHIER", "COURIER", "", null]) {
    assert.notEqual(said("acabou o pastel de carne", role, menuOf("OWNER")).kind, "dish", `${role}: o servidor recusaria, a voz nem pergunta`);
    assert.equal(canMarkDishes(role), false, String(role));
  }
  assert.equal(canMarkDishes(undefined), false);
  for (const role of ["OWNER", "manager", "Kitchen"]) assert.equal(canMarkDishes(role), true, role);
  assert.notEqual(said("esgotado").kind, "dish");
  assert.notEqual(said("o pedido chegou").kind, "dish");
  const owner = menuOf("OWNER");
  assert.ok(owner.includes("produtos"));
  const without = owner.filter((view) => view !== "produtos");
  assert.notEqual(said("acabou o pastel de carne", "OWNER", without).kind, "dish", "sem Produtos no menu, a voz não marca prato");
  // Os papéis da voz são os mesmos do servidor.
  const server = readFileSync(new URL("../../backend/app.py", import.meta.url), "utf8");
  assert.match(server, /@app\.route\('\/api\/admin\/products\/<uuid:product_id>\/sold-out', methods=\['PUT'\]\)\r?\n@require_roles\('OWNER', 'MANAGER', 'KITCHEN'\)/);
});

// ---------------------------------------------------------------- o "sim" e o "não"

test("\"sim\" confirma, \"não\" cancela, e na dúvida não é resposta (vale como frase nova)", () => {
  for (const text of ["sim", "Sim!", "pode sim", "pode", "isso", "isso mesmo", "confirma", "ok", "claro", "fechou", "certo"]) assert.equal(confirmationOf(text), "yes", text);
  for (const text of ["não", "Não!", "nao", "cancela", "deixa", "esquece", "errado", "não pode", "sim não", "sim, deixa pra lá"]) assert.equal(confirmationOf(text), "no", text);
  for (const text of ["", "   ", "abre os pedidos", "talvez", "pastel", "como está o dia"]) assert.equal(confirmationOf(text), null, text);
  assert.equal(confirmationOf(null), null);
  assert.equal(confirmationOf(undefined), null);
});

test("a pergunta espera meio minuto e depois é esquecida", () => {
  assert.equal(ASK_MS, 30000);
});

// ---------------------------------------------------------------- o que nunca pode acontecer

test("nada é marcado na primeira frase: só voiceDish.ts escreve no servidor, e só depois do sim", () => {
  const hook = read("painel/useVoiceNav.ts");
  const logic = read("painel/voiceDishLogic.ts");
  const dish = read("painel/voiceDish.ts");
  const shell = read("painel/PanelShell.tsx");

  // O gancho e a conta não falam com o servidor.
  for (const [name, source] of [["useVoiceNav.ts", hook], ["voiceDishLogic.ts", logic], ["voiceNavLogic.ts", read("painel/voiceNavLogic.ts")]]) {
    assert.doesNotMatch(source, /setSoldOut|resetSoldOut|service\/|fetch\(/, `${name} não escreve no servidor`);
  }
  // Só doDish escreve, e askDish (a busca) só lê.
  const writes = dish.match(/setSoldOut\(/g) ?? [];
  assert.equal(writes.length, 1, "uma única escrita em todo o fluxo");
  const askBody = dish.slice(dish.indexOf("export async function askDish"), dish.indexOf("export async function doDish"));
  assert.doesNotMatch(askBody, /setSoldOut/, "achar o prato só lê");
  assert.match(askBody, /within\(loadDishes\(/);
  // O gancho só chama onDishDo dentro de confirmDish, e confirmDish só existe com a pergunta pendente.
  assert.equal((hook.match(/\.onDishDo\(/g) ?? []).length, 1);
  assert.match(hook, /const confirmDish = useCallback\(\(\) => \{\n    const asked = pending\.current;\n    if \(!asked\) return;\n    dropPending\(\);/);
  // O "sim" falado só vale com a pergunta pendente; qualquer outra frase esquece a pergunta.
  assert.match(hook, /if \(pending\.current\) \{\n        const reply = confirmationOf\(heard\);\n        if \(reply === "yes"\) \{\n          confirmDish\(\);\n          return;\n        \}\n        dropPending\(\);/);
  // A pergunta some sozinha, quando fecha, quando para de ouvir e quando nada foi ouvido.
  assert.match(hook, /setTimeout\(\(\) => \{[^}]*pending\.current = null;[^}]*\}, ASK_MS\)/s);
  assert.match(hook, /const close = useCallback\(\(\) => \{\n    clearTimer\(\);\n    dropPending\(\);/);
  assert.match(hook, /const cancelHearing = useCallback\(\(\) => \{\n    dropPending\(\);/);
  assert.match(hook, /if \(!heard\) \{[^}]*dropPending\(\);/s);
  assert.match(hook, /clearTimeout\(askTimer\.current\)/);
  // O painel liga as duas pontas e a tela de pratos relê depois de marcar.
  assert.match(shell, /onDish: \(action, words, phrase\) => askDish\(\{ companyId, action, words, phrase \}\)/);
  assert.match(shell, /onDishDo: \(offer, phrase\) => doDish\(offer, phrase\)/);
  assert.match(shell, /actions=\{voice\.caption\.actions\}/);
  assert.match(read("painel/DishesScreen.tsx"), /window\.addEventListener\(DISHES_CHANGED, onVisible\)/);
  assert.match(dish, /dispatchEvent\(new Event\(DISHES_CHANGED\)\)/);
});

test("a voz só afirma o que o servidor confirmou, e o erro dele (4xx) passa como veio", () => {
  const dish = read("painel/voiceDish.ts");
  assert.match(dish, /const confirmed = await setSoldOut\(offer\.dish\.id, soldOut\);\n    if \(confirmed !== soldOut\) return \{ say: phrase\.say\(SAY_DISH_DO_FAIL\), done: false \};/);
  assert.match(dish, /wordsOf\(/);
  // O texto de falha manda conferir na tela; não jura que "nada mudou".
  const copy = read("novo/voiceCopy.ts");
  const fail = copy.slice(copy.indexOf("export const SAY_DISH_DO_FAIL"), copy.indexOf("export const SAY_DISH_DOING"));
  assert.match(fail, /Veja na tela de produtos como ficou/);
  assert.doesNotMatch(fail, /nada mudou|não mudou|não foi marcado/i);
});

test("a faixa de resposta ganha os botões Sim e Não, sem importar do resto do app e com 44 px", () => {
  const bubble = read("novo/VoiceBubble.tsx");
  assert.doesNotMatch(bubble, /from "\.\.\//);
  assert.match(bubble, /actions\?: readonly VoiceAction\[\]/);
  assert.match(bubble, /type="button"/);
  const css = read("novo/novo.css");
  assert.match(css, /\.nv-voice-act \{[^}]*min-height: 44px/s);
  const copy = read("novo/copy.ts");
  assert.match(copy, /VOICE_YES = "Sim"/);
  assert.match(copy, /VOICE_NO = "Não"/);
});
