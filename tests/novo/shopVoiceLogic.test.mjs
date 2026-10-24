import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bagText, cartWithAdded, cartWithLess, examplesFor, interpretShopVoice } from "../../frontend/src/loja/shopVoiceLogic.ts";
import {
  SAY_SHOP_ADDED,
  SAY_SHOP_CHOOSE,
  SAY_SHOP_MANY,
  SAY_SHOP_REMOVED,
  SAY_SHOP_SEND_HERE,
  SAY_SHOP_TABLE_HERE,
  SAY_SHOP_TO_SEND,
  SAY_SHOP_TO_TABLE,
} from "../../frontend/src/novo/voiceCopy.ts";

const read = (path) => readFileSync(new URL(`../../frontend/src/${path}`, import.meta.url), "utf8");
/** O dinheiro sai com espaço colado ("R$ 9,00"): nos testes todo espaço vale igual. */
const sp = (text) => String(text).replace(/\s/g, " ");

const sizes = [
  {
    id: "g1",
    name: "Tamanho",
    min_choices: 1,
    max_choices: 1,
    items: [
      { id: "o1", name: "Média", price_delta: 0 },
      { id: "o2", name: "Grande", price_delta: 5 },
    ],
  },
];
const broken = [{ id: "g2", name: "Borda", min_choices: 1, max_choices: 1, items: [] }];
const dish = (id, menu_id, name, price, extra = {}) => ({ id, menu_id, name, price, ...extra });
const PRODUCTS = [
  dish("p1", "m1", "Pastel de carne", 9),
  dish("p2", "m1", "Pastel de queijo", 9),
  dish("p3", "m2", "Açaí 300ml", 18),
  dish("p4", "m2", "Açaí 500ml", 26),
  dish("p5", "m3", "Pizza", 40, { option_groups: sizes }),
  dish("p6", "m1", "Xis Tudo", 22, { sold_out: true }),
  dish("p7", "m4", "Suco de laranja", 7),
  dish("p8", "m4", "Suco de uva", 7),
  dish("p9", "m5", "Salada Verde", 15),
  dish("p10", "m3", "Pizza especial", 50, { option_groups: broken }),
  dish("p11", "m3", "Combo 2", 30),
];
const MENUS = [
  { id: "m1", name: "Salgados" },
  { id: "m2", name: "Açaí" },
  { id: "m3", name: "Pizzas" },
  { id: "m4", name: "Sucos" },
  { id: "m5", name: "Saladas" },
];
const line = (id, name, price, quantity) => ({ id, name, price, quantity });
const ask = (transcript, extra = {}) =>
  interpretShopVoice({ transcript, screen: "menu", load: "ready", products: PRODUCTS, menus: MENUS, cart: [], closed: false, hasTable: false, ordersCount: 0, searchable: true, ...extra });

// ---------------------------------------------------------------- pedir um prato simples

test("\"quero um pastel de carne\" põe o prato na sacola e diz como a sacola ficou", () => {
  const answer = ask("Quero um pastel de carne");
  assert.equal(answer.kind, "add");
  assert.equal(answer.product.id, "p1");
  assert.equal(answer.quantity, 1);
  assert.equal(answer.toMenu, false);
  assert.match(sp(answer.say), /Pastel de carne/);
  assert.match(sp(answer.say), /A sacola está com 1 item, R\$ 9,00\./);
  assert.match(answer.say, /Desfazer/, "diz como desfazer");
});

test("a quantidade falada vale: \"dois\", \"3\", \"meia dúzia\", \"2x\"", () => {
  const add = (text) => ask(text);
  assert.equal(add("dois pastéis de queijo").quantity, 2);
  assert.match(sp(add("dois pastéis de queijo").say), /2 unidades de Pastel de queijo.*2 itens, R\$ 18,00/);
  assert.equal(add("me vê 3 pastel de carne").quantity, 3);
  assert.equal(add("meia dúzia de pastel de carne").quantity, 6);
  assert.equal(add("2x pastel de queijo").quantity, 2);
  assert.equal(add("uma dúzia de pastel de carne").quantity, 12);
  assert.equal(add("pastel de carne").quantity, 1, "sem número, um");
});

test("o que cabe: no máximo por prato a voz diz e não põe nada", () => {
  const full = ask("quero pastel de carne", { cart: [line("p1", "Pastel de carne", 9, 50)] });
  assert.equal(full.kind, "stay");
  assert.match(full.say, /máximo/);
  const near = ask("quero 5 pastel de carne", { cart: [line("p1", "Pastel de carne", 9, 48)] });
  assert.equal(near.kind, "add");
  assert.equal(near.quantity, 2, "só os 2 que cabem; a frase diz 2, não 5");
  assert.match(sp(near.say), /2 unidades de Pastel de carne/);
});

test("o número que faz parte do nome fica no nome (\"Combo 2\", \"Açaí 500\") e \"500 ml\" é \"500ml\"", () => {
  assert.equal(ask("quero combo 2").product.id, "p11");
  assert.equal(ask("quero combo 2").quantity, 1);
  assert.equal(ask("quero açaí 500").product.id, "p4");
  assert.equal(ask("quero açaí 500 ml").product.id, "p4");
  assert.equal(ask("quero açaí de 300 ml").product.id, "p3");
  assert.equal(ask("dois açaí 500ml").quantity, 2);
});

test("só o nome do prato também é pedir", () => {
  assert.equal(ask("pastel de carne").kind, "add");
  assert.equal(ask("pastel de carne").product.id, "p1");
  assert.equal(ask("duas pizzas").kind, "choose");
});

// ---------------------------------------------------------------- prato com escolhas e o que a tela não deixa pedir

test("prato com tamanho ou extras não vai direto: abre as escolhas, com a quantidade dita", () => {
  const one = ask("quero uma pizza");
  assert.equal(one.kind, "choose");
  assert.equal(one.product.id, "p5", "\"pizza\" é o prato inteiro, não a \"Pizza especial\"");
  assert.equal(one.quantity, 1);
  assert.match(one.say, /Abri Pizza/);
  assert.match(one.say, /Adicionar/);
  const two = ask("duas pizzas");
  assert.equal(two.quantity, 2);
  assert.match(two.say, /para 2/);
});

test("esgotado, indisponível e restaurante sem pedidos: a voz diz e não pede", () => {
  const sold = ask("quero o xis tudo");
  assert.equal(sold.kind, "stay");
  assert.match(sold.say, /Xis Tudo/);
  assert.match(sold.say, /esgot/);
  const off = ask("quero pizza especial");
  assert.equal(off.kind, "stay");
  assert.match(off.say, /indisponível|não está disponível|não dá para pedir/);
  const closed = ask("quero pastel de carne", { closed: true });
  assert.equal(closed.kind, "stay");
  assert.match(closed.say, /não (está )?receb|Sem pedidos/);
  assert.equal(closed.warn, true);
  // Fechado, nem a pizza abre as escolhas.
  assert.equal(ask("quero uma pizza", { closed: true }).kind, "stay");
});

test("mais de um prato: lista os nomes e pede o nome inteiro; nenhum prato: diz que não achou", () => {
  const many = ask("quero pastel");
  assert.equal(many.kind, "stay");
  assert.match(many.say, /Pastel de carne ou Pastel de queijo/);
  assert.match(many.say, /nome inteiro/);
  assert.equal(ask("quero açaí").kind, "stay");
  const none = ask("quero lasanha");
  assert.equal(none.kind, "stay");
  assert.equal(none.warn, true);
  assert.match(none.say, /Não (achei|encontrei)|não está no cardápio/);
});

test("\"ver\" e outras palavras de tela não casam com um prato parecido (\"Salada Verde\")", () => {
  assert.equal(ask("quero ver").kind, "unknown");
  assert.notEqual(ask("quero ver a sacola").kind, "add");
  assert.equal(ask("quero ver a sacola").kind, "stay", "sacola vazia: a voz diz que está vazia");
});

// ---------------------------------------------------------------- tirar da sacola

test("\"tirar um pastel\" tira da sacola e diz como ficou; o que não está na sacola, a voz diz", () => {
  const cart = [line("p1", "Pastel de carne", 9, 2)];
  const one = ask("tirar um pastel de carne", { cart });
  assert.equal(one.kind, "less");
  assert.equal(one.quantity, 1);
  assert.match(sp(one.say), /Tirei Pastel de carne da sacola\. A sacola está com 1 item, R\$ 9,00\./);
  const all = ask("tira 2 pastel de carne", { cart });
  assert.equal(all.quantity, 2);
  assert.match(all.say, /A sacola ficou vazia\./);
  const more = ask("tira 5 pastel de carne", { cart });
  assert.equal(more.quantity, 2, "não tira mais do que tem");
  const absent = ask("tira pastel de queijo", { cart });
  assert.equal(absent.kind, "stay");
  assert.match(absent.say, /Pastel de queijo/);
  assert.match(absent.say, /não está na sacola|Não tem|não tem/);
});

// ---------------------------------------------------------------- ir de uma tela a outra

test("\"abrir a sacola\", \"cardápio\", \"acompanhar o pedido\" e \"chamar o garçom\" levam à tela, com o que falta dito", () => {
  const filled = [line("p1", "Pastel de carne", 9, 1)];
  assert.deepEqual({ ...ask("abrir a sacola", { cart: filled }), say: "" }, { kind: "go", screen: "bag", say: "" });
  const empty = ask("abrir a sacola");
  assert.equal(empty.kind, "stay");
  assert.match(empty.say, /vazia|nada na sacola/);
  assert.match(empty.say, /Pastel de carne/, "o exemplo é um prato de verdade do cardápio");

  assert.equal(ask("voltar", { screen: "bag" }).screen, "menu");
  assert.match(ask("voltar").say, /Você já está no cardápio|Já estamos no cardápio|Você está no cardápio/);

  const none = ask("acompanhar meu pedido");
  assert.equal(none.kind, "stay");
  assert.match(none.say, /ainda não|Nenhum pedido seu|Ainda não há/);
  assert.deepEqual({ ...ask("onde está meu pedido", { ordersCount: 1 }), say: "" }, { kind: "go", screen: "tracking", say: "" });
  assert.match(ask("acompanhar o pedido", { ordersCount: 1, screen: "tracking" }).say, /já está|Já estamos|está no acompanhamento/);

  const noTable = ask("chamar o garçom");
  assert.equal(noTable.kind, "stay");
  assert.match(noTable.say, /QR code/);
  // Já na tela da mesa, pedir o garçom diz onde tocar (não "você já está aqui").
  for (const said of ["chamar o garçom", "a conta, por favor", "abrir a mesa"]) {
    const here = ask(said, { hasTable: true, screen: "table" });
    assert.equal(here.kind, "stay", said);
    assert.match(here.say, /Chamar garçom/, said);
    assert.match(here.say, /Pedir a conta/, said);
  }
  const table = ask("chamar o garçom", { hasTable: true });
  assert.equal(table.kind, "go");
  assert.equal(table.screen, "table");
  assert.match(table.say, /Chamar garçom/);
  assert.match(table.say, /Pedir a conta/);
  assert.equal(ask("a conta, por favor", { hasTable: true }).screen, "table");
});

test("\"meu pedido\" é a sacola se tem coisa nela, o acompanhamento se já pediu, senão a sacola vazia", () => {
  const filled = [line("p1", "Pastel de carne", 9, 1)];
  assert.equal(ask("meu pedido", { cart: filled, ordersCount: 1 }).screen, "bag");
  assert.equal(ask("meu pedido", { ordersCount: 1 }).screen, "tracking");
  assert.equal(ask("meu pedido").kind, "stay");
});

test("a voz nunca envia o pedido: \"enviar\", \"finalizar\", \"pagar\" só abrem a sacola e dizem onde tocar", () => {
  const filled = [line("p1", "Pastel de carne", 9, 1)];
  for (const said of ["enviar o pedido", "finalizar o pedido", "fechar o pedido", "pagar", "quero pedir", "mandar o pedido"]) {
    const answer = ask(said, { cart: filled });
    assert.equal(answer.kind, "go", said);
    assert.equal(answer.screen, "bag", said);
    assert.match(answer.say, /Enviar pedido/, `${said}: a voz diz que o envio é no botão`);
  }
  // Já na sacola: nada a abrir, mas a pessoa ouve onde tocar (antes só ouvia "você está na sacola").
  for (const said of ["enviar o pedido", "finalizar", "pagar", "mandar o pedido"]) {
    const here = ask(said, { cart: filled, screen: "bag" });
    assert.equal(here.kind, "stay", said);
    assert.match(here.say, /Enviar pedido/, `${said}: na sacola a voz diz onde tocar`);
    assert.doesNotMatch(here.say, /Abri|Abrindo|Vamos para/, `${said}: não finge que abriu a sacola`);
  }
  assert.match(ask("enviar o pedido", { screen: "bag" }).say, /vazia|nada na sacola/, "sacola vazia: não há o que enviar");
  // E nenhuma resposta da voz é um envio: não existe esse tipo.
  assert.doesNotMatch(read("loja/shopVoiceLogic.ts"), /kind: "(send|pay|order|call)"/);
});

test("\"enviar\" e \"terminar\" sozinhos também levam à sacola (antes a lista tinha as palavras e nada as ligava)", () => {
  const filled = [line("p1", "Pastel de carne", 9, 1)];
  for (const said of ["enviar", "terminar", "Enviar!", "pode enviar", "quero terminar"]) {
    const answer = ask(said, { cart: filled });
    assert.equal(answer.kind, "go", said);
    assert.equal(answer.screen, "bag", said);
    assert.match(answer.say, /Enviar pedido/, `${said}: o envio continua sendo no botão`);
    const here = ask(said, { cart: filled, screen: "bag" });
    assert.equal(here.kind, "stay", said);
    assert.match(here.say, /Enviar pedido/, `${said}: na sacola, a voz diz onde tocar`);
  }
  // Sacola vazia: diz que não há o que enviar, nunca finge.
  assert.equal(ask("enviar").kind, "stay");
  assert.match(ask("enviar").say, /vazia|nada na sacola|sacola/);
  // Prato com o verbo ainda é prato, e uma palavra solta qualquer continua sem ser entendida.
  assert.equal(ask("quero pastel de carne", { cart: filled }).kind, "add");
  assert.equal(ask("banana azul").kind, "unknown");
});

// ---------------------------------------------------------------- buscar no cardápio

test("\"buscar suco\" e \"tem suco?\" buscam, preenchem a caixa quando ela existe e dizem o que a tela vai mostrar", () => {
  const found = ask("buscar suco");
  assert.equal(found.kind, "search");
  assert.equal(found.text, "suco");
  assert.equal(found.fill, true);
  assert.match(found.say, /Suco de laranja ou Suco de uva/);
  assert.equal(ask("tem suco?").kind, "search");
  assert.equal(ask("vocês têm suco").kind, "search");
  assert.equal(ask("obrigado, tem suco").kind, "unknown", "só \"tem\" no começo busca; o resto é conversa");
  assert.equal(ask("buscar suco", { searchable: false }).fill, false, "sem caixa de busca, só a frase");
  assert.equal(ask("buscar suco", { screen: "tracking" }).toMenu, true);
  assert.equal(ask("buscar suco", { screen: "bag" }).toMenu, true);
  const nothing = ask("procurar lasanha");
  assert.equal(nothing.kind, "search");
  assert.match(nothing.say, /Não achei nada para “lasanha”|Nada para “lasanha”|Para “lasanha” não achei nada/);
  assert.equal(ask("buscar").kind, "unknown", "buscar sem dizer o quê");
});

// ---------------------------------------------------------------- cardápio que não abriu, ajuda e o que não entendeu

test("cardápio abrindo ou que não abriu: a voz diz isso, nunca \"nenhum prato\"", () => {
  const loading = ask("quero pastel de carne", { load: "loading", products: [] });
  assert.equal(loading.kind, "stay");
  assert.match(loading.say, /abrindo/);
  const failed = ask("quero pastel de carne", { load: "error", products: [] });
  assert.match(failed.say, /Tentar de novo/);
  assert.doesNotMatch(failed.say, /Não achei|nenhum prato/i);
  assert.match(ask("buscar suco", { load: "error", products: [] }).say, /Tentar de novo/);
});

test("ajuda e frase sem sentido: exemplos de verdade (prato do cardápio, sacola, o que a pessoa tem agora)", () => {
  const help = ask("ajuda");
  assert.equal(help.kind, "stay");
  assert.match(help.say, /quero Pastel de carne/);
  const lost = ask("blá blá blá");
  assert.equal(lost.kind, "unknown");
  assert.match(lost.say, /quero Pastel de carne/);
  assert.equal(ask("").kind, "unknown");
  assert.equal(ask("   ").kind, "unknown");
  // O exemplo muda com o que a pessoa tem: pedido enviado → acompanhar; mesa → garçom; fechado → nenhum prato de exemplo.
  assert.match(examplesFor({ products: PRODUCTS, closed: false, hasTable: true, ordersCount: 1, screen: "menu" }), /acompanhar o pedido|chamar o garçom|abrir a sacola|quero/);
  assert.doesNotMatch(examplesFor({ products: PRODUCTS, closed: true, hasTable: false, ordersCount: 0, screen: "menu" }), /quero/);
  assert.doesNotMatch(examplesFor({ products: PRODUCTS.map((p) => ({ ...p, sold_out: true })), closed: false, hasTable: false, ordersCount: 0, screen: "menu" }), /quero/);
});

// ---------------------------------------------------------------- as contas da sacola

test("a sacola depois de pôr e de tirar: a mesma conta da tela, dentro do máximo por prato", () => {
  const p1 = PRODUCTS[0];
  const added = cartWithAdded([], p1, 3);
  assert.equal(added.length, 1);
  assert.equal(added[0].quantity, 3);
  assert.equal(cartWithAdded(added, p1, 100)[0].quantity, 50);
  assert.equal(cartWithLess(added, p1, 2)[0].quantity, 1);
  assert.deepEqual(cartWithLess(added, p1, 3), []);
  assert.equal(sp(bagText(added)), "A sacola está com 3 itens, R$ 27,00.");
  assert.equal(sp(bagText(cartWithLess(added, p1, 2))), "A sacola está com 1 item, R$ 9,00.");
  assert.equal(bagText([]), "A sacola ficou vazia.");
});

// ---------------------------------------------------------------- as frases dizem os mesmos fatos em todas as formas

test("toda forma das frases do cliente diz os mesmos fatos (nome, quantidade, sacola, botão)", () => {
  const forms = (spec) => [...spec.full, ...(spec.short ?? [])];
  const out = (variant, args) => (typeof variant === "function" ? variant(...args) : variant);
  for (const variant of forms(SAY_SHOP_ADDED)) {
    const lineText = out(variant, ["2 unidades de Pastel de carne", "A sacola está com 3 itens, R$ 27,00."]);
    assert.ok(lineText.includes("2 unidades de Pastel de carne") && lineText.includes("A sacola está com 3 itens, R$ 27,00."), lineText);
  }
  for (const variant of SAY_SHOP_ADDED.full) assert.match(out(variant, ["Pastel", "x."]), /Desfazer/, "a forma completa ensina o botão");
  for (const variant of forms(SAY_SHOP_REMOVED)) assert.ok(out(variant, ["Pastel de carne", "A sacola ficou vazia."]).includes("A sacola ficou vazia."));
  for (const variant of forms(SAY_SHOP_CHOOSE)) {
    assert.match(out(variant, ["Pizza", 1]), /Pizza/);
    assert.match(out(variant, ["Pizza", 1]), /Adicionar/);
    assert.doesNotMatch(out(variant, ["Pizza", 1]), /para 1/, "um só não é dito");
    assert.match(out(variant, ["Pizza", 3]), /para 3|Pizza.*3/);
  }
  for (const variant of forms(SAY_SHOP_MANY)) assert.ok(out(variant, ["A ou B"]).includes("A ou B"));
  for (const variant of forms(SAY_SHOP_TO_SEND)) assert.match(variant, /Enviar pedido/);
  for (const variant of forms(SAY_SHOP_SEND_HERE)) assert.match(variant, /Enviar pedido/);
  for (const variant of forms(SAY_SHOP_TABLE_HERE)) {
    assert.match(variant, /Chamar garçom/);
    assert.match(variant, /Pedir a conta/);
  }
  for (const variant of forms(SAY_SHOP_TO_TABLE)) {
    assert.match(variant, /Chamar garçom/);
    assert.match(variant, /Pedir a conta/);
  }
});

test("os nomes de botão que a voz cita são os da tela", () => {
  assert.match(read("loja/choicesLogic.ts"), /confirmLabel: input\.editing \? "Salvar" : "Adicionar"/);
  assert.match(read("novo/Bag.tsx"), /Enviar pedido · /);
  assert.match(read("mesa/callsLogic.ts"), /label: "Chamar garçom"/);
  assert.match(read("mesa/callsLogic.ts"), /label: "Pedir a conta"/);
  assert.match(read("loja/ShopScreen.tsx"), /Tentar de novo/);
});

test("a conta não fala com o servidor", () => {
  const source = read("loja/shopVoiceLogic.ts");
  assert.doesNotMatch(source, /fetch\(|service\/api|XMLHttpRequest/);
  assert.doesNotMatch(read("loja/dishFinder.ts"), /import /, "o achador de prato não depende de nada");
});

// ---------------------------------------------------------------- a ligação na tela

test("a voz do cliente nunca envia, paga nem chama o garçom: o gancho nem conhece essas ações", () => {
  const code = read("loja/useShopVoice.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /service\/api|fetch\(|sendOrder|createOrder|placeOrder|callWaiter|requestBill|payPix|pix/i, "sem rede e sem as ações de envio, pagamento e chamado");
  assert.doesNotMatch(code, /orderMemory/, "não mexe nos pedidos guardados");
  // O que a voz muda no celular: a sacola (setCart), a tela aberta, a busca e a folha de escolhas. Nada mais.
  assert.deepEqual([...new Set([...code.matchAll(/now\.(on[A-Z]\w*|setCart)\(/g)].map((match) => match[1]))].sort(), ["onChoose", "onGo", "onSearch", "setCart"]);
});

test("o Desfazer só tira da sacola o que a voz pôs", () => {
  const code = read("loja/useShopVoice.ts");
  assert.match(code, /actions = \[\{ label: VOICE_UNDO, onPress: \(\) => undo\(product, quantity\) \}\]/);
  assert.match(code, /case "add": \{[\s\S]*?actions = /, "o botão só vem junto de um prato posto na sacola");
  assert.match(code, /case "less":[\s\S]*?break;[\s\S]*?default:/, "tirar da sacola não oferece Desfazer");
  assert.match(read("novo/copy.ts"), /VOICE_UNDO = "Desfazer"/);
});

test("o cliente abre o visual novo só com a chave; sem ela o aplicativo de sempre continua", () => {
  const app = read("App.tsx");
  assert.match(app, /const OrderFlow = lazy\(\(\) => import\("\.\/loja\/OrderFlow"\)\)/, "baixado só sob demanda");
  assert.ok(!/import OrderFlow/.test(app), "nenhum import fixo");
  // O pedido novo só é desenhado dentro de `if (freshPanel)`; fora dele vale o CustomerApp.
  const outside = app.replace(/  if \(freshPanel\) \{\n    return \(\n      <Suspense fallback=\{<main className="loading-state">Carregando…<\/main>\}>[\s\S]*?\n    \);\n  \}\n/, "");
  assert.ok(!/<OrderFlow/.test(outside), "<OrderFlow só aparece sob a chave");
  assert.match(app, /return \(\n    <CustomerApp/, "o CustomerApp continua sendo o padrão");
});

test("o pedido novo liga a voz em volta de todas as telas e mostra a faixa", () => {
  const flow = read("loja/OrderFlow.tsx");
  assert.match(flow, /<VoiceContext\.Provider value=\{\{ onPress: voice\.press, listening: voice\.listening \}\}>/);
  assert.match(flow, /<VoiceBubble\s+tone=\{voice\.caption\.tone\}/);
  assert.match(flow, /onSearch: setQuery/, "a voz escreve na busca que a pessoa vê");
  assert.match(flow, /query=\{query\}\s+onQuery=\{setQuery\}/, "a busca é a mesma do cardápio");
  assert.match(flow, /onChoose: \(product, quantity\) => setPicking\(\{ product, quantity \}\)/);
  assert.match(flow, /quantity=\{picking\.quantity\}/);
  assert.match(flow, /closed: closedState\(shop\.live, Boolean\(tableId\)\) !== null/, "fechado é a mesma conta da tela");
  assert.match(flow, /searchable: shop\.products\.length >= SEARCH_FROM/, "a busca existe com a mesma regra da tela");
  // Cada tela do cliente traz a bolinha.
  for (const file of ["novo/ShopMenu.tsx", "novo/Bag.tsx", "novo/Tracking.tsx", "novo/Table.tsx"]) assert.match(read(file), /<VoiceOrb/, file);
});

test("a folha de escolhas abre com a quantidade dita, mas o botão continua dizendo Adicionar", () => {
  const sheet = read("loja/ChoicesScreen.tsx");
  assert.match(sheet, /quantity\?: number;/);
  assert.match(sheet, /useState\(initial\?\.quantity \?\? clampQuantity\(asked \?\? 1\)\)/);
  assert.doesNotMatch(sheet, /editing = .*asked/, "pedir a quantidade não vira edição de linha");
});

test("o cardápio novo do cliente tem o link \"Sou da equipe ou dono\" como o de sempre, e só o App decide o endereço", () => {
  assert.match(read("customer/CustomerApp.tsx"), /Sou da equipe ou dono/, "o aplicativo de sempre tem o link");
  assert.match(read("novo/ShopMenu.tsx"), /Sou da equipe ou dono/);
  assert.match(read("novo/ShopMenu.tsx"), /\{teamHref \? \(/, "sem endereço o link não aparece");
  assert.match(read("loja/ShopScreen.tsx"), /teamHref=\{teamHref\}/);
  assert.match(read("loja/OrderFlow.tsx"), /teamHref=\{teamHref\}/);
  assert.match(read("App.tsx"), /<OrderFlow company=\{company\} tableId=\{tableId\} teamHref=\{ownerLoginUrl\(location\.origin, location\.pathname\)\} \/>/);
  assert.match(read("novo/novo.css"), /\.nv-root \.nv-team-link \{[^}]*min-height: 44px/, "tamanho de dedo");
});
