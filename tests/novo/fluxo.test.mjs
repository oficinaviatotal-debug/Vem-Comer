import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/**
 * O caminho do cliente no visual novo (cardápio, escolhas, sacola, envio). Não há navegador aqui, então estes testes leem
 * os arquivos como texto e conferem as regras que não podem se perder: quem fala com o servidor, em que ordem, e o que
 * a tela nunca faz. A conferência com imagens (320 a 480 px) cobre o desenho.
 */
const SRC = new URL("../../frontend/src/", import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), "utf8");
const loja = {
  flow: read("loja/OrderFlow.tsx"),
  shop: read("loja/ShopScreen.tsx"),
  bag: read("loja/BagScreen.tsx"),
  choices: read("loja/ChoicesScreen.tsx"),
  hook: read("loja/useShop.ts"),
  table: read("loja/TableScreen.tsx"),
  tableLogic: read("loja/tableLogic.ts"),
};

test("as telas novas do cliente não dependem das antigas (nem do CSS, nem das telas do fluxo velho)", () => {
  const oldScreens = readdirSync(new URL("customer/", SRC))
    .filter((name) => /\.tsx$/.test(name))
    .map((name) => name.replace(/\.tsx$/, ""));
  for (const [name, text] of Object.entries(loja)) {
    // Da mesa antiga só entra a conta pura (`mesa/callsLogic`, a mesma do painel); tela e CSS dela, nunca.
    assert.ok(!/from ["']\.\.\/(styles|ui|admin|nav)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/mesa\/(?!callsLogic)/.test(text), `${name} importa a tela antiga da mesa`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    for (const screen of oldScreens) {
      assert.ok(!new RegExp(`from ["']\\.\\./customer/${screen}["']`).test(text), `${name} importa a tela antiga ${screen}`);
    }
  }
});

test("só o useShop busca o cardápio: a tela do cardápio recebe tudo pronto", () => {
  assert.ok(!/fetchProducts|fetchMenus|fetchTable|fetchCompanyBySlug/.test(loja.shop), "ShopScreen busca sozinha");
  for (const call of ["fetchProducts", "fetchMenus", "fetchTable", "fetchCompanyBySlug", "fetchPaymentOptions", "fetchDeliveryInfo"]) {
    assert.match(loja.hook, new RegExp(call), `useShop não busca ${call}`);
  }
});

test("a sacola confere antes de enviar, envia uma vez só e só guarda na memória depois que o servidor aceitou", () => {
  const text = loja.bag;
  assert.match(text, /if \(sendingRef\.current\) return;/);
  const problem = text.indexOf("bagProblem(input)");
  const sent = text.indexOf("await createOrder(");
  const remembered = text.indexOf("orderMemory.add(");
  const cleared = text.indexOf("setCart([])");
  assert.ok(problem > 0 && problem < sent, "confere antes de enviar");
  assert.ok(sent > 0 && sent < remembered, "guarda o pedido depois de enviado");
  assert.ok(remembered < cleared, "esvazia a sacola depois de guardar");
  // O que vai ao servidor é a carga pronta (códigos, nunca preço) e o erro vira frase.
  assert.match(text, /orderPayloadOf\(input\)/);
  assert.match(text, /order\.items, order\.payment, order\.change, tableId, order\.extras/);
  assert.match(text, /orderErrorMessage\(/);
  assert.match(text, /if \(!result\?\.order_id \|\| !result\?\.tracking_token\) throw/);
  assert.match(text, /finally \{\s*sendingRef\.current = false;/);
});

test("o endereço só é lembrado na entrega, e a pessoa pode apagar com um toque", () => {
  const text = loja.bag;
  assert.match(text, /if \(mode === "entrega" && !tableId\) \{\s*deliveryMemory\.save/);
  assert.match(text, /deliveryMemory\.forget\(company\.slug\)/);
});

test("mexer em qualquer campo tira o aviso de erro de antes", () => {
  assert.match(loja.bag, /const edit = <T,>\(set: \(value: T\) => void\) => \(value: T\) => \{\s*setError\(null\);/);
  for (const field of ["onName", "onAddress", "onPhone", "onPayment", "onPaid", "onMode"]) {
    assert.match(loja.bag, new RegExp(`${field}=\\{edit\\(`), `${field} não limpa o erro`);
  }
});

test("a folha das escolhas é um diálogo de verdade: trava o fundo, fecha no Esc, prende o Tab e devolve o foco", () => {
  const text = loja.choices;
  assert.match(text, /document\.body\.style\.overflow = "hidden"/);
  assert.match(text, /document\.body\.style\.overflow = overflow/);
  assert.match(text, /event\.key === "Escape"/);
  assert.match(text, /event\.key !== "Tab"/);
  assert.match(text, /before\?\.focus\?\.\(\)/);
  assert.match(text, /getElementById\("nv-sheet-title"\)\?\.focus\(\)/);
});

test("adicionar só acontece com tudo marcado; faltando, a folha rola até o que falta", () => {
  const text = loja.choices;
  assert.match(text, /const result = confirmChoices\(/);
  assert.match(text, /if \(result\.ok\) \{\s*onConfirm\(result\.pick\);\s*return;/);
  assert.match(text, /setTried\(true\)/);
  assert.match(text, /nv-opt-group-\$\{groupId\}/);
  assert.match(text, /prefers-reduced-motion: reduce/);
});

test("o fluxo adiciona com addConfigured, muda uma linha com replaceLine e abre a folha limpa a cada prato", () => {
  assert.match(loja.flow, /editKey \? replaceLine\(current, editKey, product, pick\) : addConfigured\(current, product, pick\)/);
  assert.match(loja.flow, /key=\{picking\.editKey \?\? picking\.product\.id\}/);
  assert.match(loja.flow, /onSent\?\.\(order\)/);
});

test("o cardápio não deixa pedir com o restaurante fechado", () => {
  assert.match(loja.shop, /if \(product && !view\.closed\) setCart/);
  assert.match(loja.shop, /if \(product && !view\.closed\) onChoose\(product\)/);
});

const tracking = readFileSync(new URL("loja/TrackingScreen.tsx", SRC), "utf8");

test("o acompanhamento pergunta ao servidor até não haver o que esperar, e não pergunta com a aba escondida", () => {
  assert.match(tracking, /const step = afterPoll\(\{ order: next \}\);/);
  assert.match(tracking, /if \(step === "stop"\) return;/);
  assert.match(tracking, /if \(document\.hidden\) \{\s*timer = window\.setTimeout\(poll, POLL_MS\);\s*return;/);
  assert.match(tracking, /if \(afterPoll\(\{ failedWith \}\) === "gone"\) \{\s*goneRef\.current\(\);\s*return;/);
  // Ao sair da tela, nenhuma pergunta fica pendente.
  assert.match(tracking, /alive = false;\s*if \(timer !== undefined\) window\.clearTimeout\(timer\);/);
});

test("o Pix é buscado só quando está a pagar, e o 'copiar' cai no copiar à mão quando o celular recusa", () => {
  assert.match(tracking, /usePix\(orderId, token, track\?\.payment\.kind === "pix"\)/);
  assert.match(tracking, /if \(!due\) return;/);
  assert.match(tracking, /copyText\(code\.payload, field\.current\)/);
  assert.match(tracking, /pixStateOfError\(error instanceof HttpError \? error\.status : null\)/);
});

test("a avaliação é uma por visita: vale para todos os pedidos de agora, e não envia duas vezes", () => {
  assert.match(tracking, /createFeedback\(companyId, food, service, "não se aplica", comment\.trim\(\)\)/);
  assert.match(tracking, /for \(const id of new Set\(\[orderId, \.\.\.allIds\]\)\) orderMemory\.markFeedbackSent\(id\)/);
  assert.match(tracking, /if \(!food \|\| !service \|\| busyRef\.current\) return;/);
  assert.match(tracking, /const showRating = track\.status\.done && \(rateHere \|\| rating\.sentBefore\);/);
  assert.match(tracking, /ratingTarget\(/);
});

test("o fluxo abre no acompanhamento quando já há pedido, esquece o pedido fechado e mostra o pedido enviado mesmo sem armazenamento", () => {
  assert.match(loja.flow, /orders\.length > 0 \? "tracking" : tableId \? "table" : "menu"/);
  assert.match(loja.flow, /orderMemory\.remove\(company\.slug, orderId\)/);
  assert.match(loja.flow, /if \(next\.length === 0\) goTo\("menu"\)/);
  // A lista vem do que a sacola acabou de guardar, não de uma leitura nova do armazenamento (que pode estar bloqueado).
  assert.match(loja.flow, /setOrders\(order\.orders\)/);
  assert.match(loja.bag, /const orders = orderMemory\.add\(/);
  assert.match(loja.bag, /onSent\(\{ orderId, token, payment: order\.payment, orders \}\)/);
});

test("o cardápio mostra 'Acompanhar o seu pedido' só quando há pedido, com a contagem quando são vários", () => {
  const menu = readFileSync(new URL("novo/ShopMenu.tsx", SRC), "utf8");
  assert.match(menu, /ordersCount > 0 && onTrack \?/);
  assert.match(menu, /Acompanhar o seu pedido\{ordersCount > 1 \? ` \(\$\{ordersCount\}\)` : ""\}/);
  assert.match(loja.shop, /ordersCount=\{ordersCount\}/);
  assert.match(loja.flow, /ordersCount=\{orders\.length\}/);
});

test("quem lê o QR da mesa abre na mesa; mesa que o servidor não conhece cai direto no cardápio; o cardápio leva de volta à mesa", () => {
  assert.match(loja.flow, /screenState === "table" && \(!tableId \|\| shop\.tableLost\) \? "menu" : screenState/);
  assert.match(loja.flow, /onTable=\{tableId && !shop\.tableLost \? \(\) => goTo\("table"\) : undefined\}/);
  assert.match(loja.flow, /<TableScreen[\s\S]*onMenu=\{\(\) => goTo\("menu"\)\}[\s\S]*onTrack=\{\(\) => goTo\("tracking"\)\}/);
  const menu = readFileSync(new URL("novo/ShopMenu.tsx", SRC), "utf8");
  assert.match(menu, /tableLabel && onTable \?/);
  assert.match(menu, /\{tableLabel\}: chamar o garçom/);
});

test("a mesa manda uma chamada de cada vez, só guarda depois que o servidor aceitou e pergunta se atenderam sem insistir com a aba escondida", () => {
  const text = loja.table;
  assert.match(text, /if \(sendingRef\.current \|\| !isKind\(kind\)\) return;/);
  const sent = text.indexOf("await createTableCall(");
  const kept = text.indexOf("memory.put(");
  assert.ok(sent > 0 && sent < kept, "guarda a chamada depois de enviada");
  assert.match(text, /if \(!saved\) throw new Error\("incomplete"\)/);
  assert.match(text, /finally \{\s*sendingRef\.current = false;/);
  assert.match(text, /if \(document\.hidden\) return;/);
  assert.match(text, /window\.clearInterval\(timer\)/);
  assert.match(text, /window\.clearTimeout\(noticeTimer\.current\)/);
  assert.ok(!/fetchTable\(/.test(text), "o número da mesa vem do useShop, não de nova busca");
});
