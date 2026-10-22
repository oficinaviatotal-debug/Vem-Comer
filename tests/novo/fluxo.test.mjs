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

test("o endereço do Vem Trabalhar só chega às telas já conferido (https), no cardápio como na mesa", () => {
  assert.match(loja.shop, /safeJobsUrl\(jobsHref\)/, "o cardápio passa o endereço sem conferir");
  assert.match(loja.tableLogic, /safeJobsUrl\(input\.jobsHref\)/, "a mesa passa o endereço sem conferir");
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
  const text = read("loja/useSheetBehavior.ts");
  assert.match(loja.choices, /useSheetBehavior\(onClose\)/);
  assert.match(text, /document\.body\.style\.overflow = "hidden"/);
  assert.match(text, /document\.body\.style\.overflow = overflow/);
  assert.match(text, /event\.key === "Escape"/);
  assert.match(text, /event\.key !== "Tab"/);
  assert.match(text, /before\?\.focus\?\.\(\)/);
  assert.match(text, /getElementById\(focusId\)\?\.focus\(\)/);
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

test("o menu geral de verdade: só as regras de sempre (navLogic e o nome do papel), nada de rede, nada da tela antiga", () => {
  const logic = read("painel/menuLogic.ts");
  const menu = read("painel/PanelMenu.tsx");
  for (const [name, text] of [["menuLogic", logic], ["PanelMenu", menu]]) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin|mesa)/.test(text), `${name} importa o antigo`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    assert.ok(!/service\/api/.test(text), `${name} fala com o servidor`);
    assert.ok(!/from ["']\.\.\/nav\/(?!navLogic)/.test(text), `${name} importa tela do menu antigo`);
  }
  assert.match(logic, /from "\.\.\/nav\/navLogic\.ts"/);
  assert.match(logic, /from "\.\.\/service\/format\.ts"/);
  assert.match(logic, /menuFor\(input\)/);
  assert.match(menu, /useSheetBehavior\(onClose, \{ root: "\.nv-drawer", focusId: "nv-menu-title" \}\)/);
});

test("o menu geral fecha sozinho depois de escolher, e cada ação sai pelo caminho dela; sem ajuda ligada, não oferece ajuda", () => {
  const menu = read("painel/PanelMenu.tsx");
  assert.match(menu, /onSelect\(view\);\s*onClose\(\);/);
  assert.match(menu, /onClose\(\);\s*if \(id === ACTION\.customer\) onCustomer\(\);\s*else if \(id === ACTION\.help\) onHelp\?\.\(\);\s*else if \(id === ACTION\.logout\) onLogout\(\);/);
  assert.match(menu, /canHelp: Boolean\(input\.canHelp && onHelp\)/);
});

test("a folha das escolhas e o menu geral dividem o mesmo cuidado de diálogo (fundo sem rolar, Esc, foco, Tab preso)", () => {
  const hook = read("loja/useSheetBehavior.ts");
  assert.match(hook, /document\.body\.style\.overflow = "hidden"/);
  assert.match(hook, /event\.key === "Escape"/);
  assert.match(hook, /event\.key !== "Tab"/);
  assert.match(hook, /before\?\.focus\?\.\(\)/);
  assert.match(hook, /root = "\.nv-sheet", focusId = "nv-sheet-title"/);
  assert.match(loja.choices, /useSheetBehavior\(onClose\)/);
  assert.match(loja.choices, /from "\.\/useSheetBehavior"/);
});

test("as mesas do painel de verdade: só as contas puras da mesa antiga (nada de tela, CSS, estilos antigos), e a lógica não fala com o servidor", () => {
  const files = { deskLogic: read("painel/deskLogic.ts"), deskScreen: read("painel/DeskScreen.tsx"), qr: read("painel/useQrReader.ts") };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/mesa\/(?!callsLogic|tableDeskLogic)/.test(text), `${name} importa a tela antiga da mesa`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    assert.ok(!/from ["']\.\.\/nav\/(?!navLogic)/.test(text), `${name} importa tela do menu antigo`);
  }
  assert.ok(!/service\/api/.test(files.deskLogic), "a conta não fala com o servidor");
  assert.ok(!/service\/alertDevice/.test(files.deskLogic), "a conta não apita");
});

test("as mesas do painel: uma marcação por vez, só tira o chamado depois que o servidor aceitou, e erro deixa o cartão e diz o que fazer", () => {
  const text = read("painel/DeskScreen.tsx");
  assert.match(text, /if \(answering\.current\) return;\s*answering\.current = true;/);
  assert.match(text, /await answerTableCall\(companyId, callId\);\s*answered\.current\.add\(callId\);\s*setCalls\(/);
  assert.match(text, /\} catch \{\s*setError\(DESK_ANSWER_ERROR\);\s*void loadCalls\(\);/);
  assert.match(text, /\} finally \{\s*answering\.current = false;\s*setBusyId\(null\);/);
  assert.match(text, /withoutAnswered\(parsePanelCalls\(await fetchTableCalls\(companyId\)\), answered\.current\)/);
});

test("as mesas do painel: pergunta de tempos em tempos só com a aba à vista, uma busca que falha não apaga a tela e chamado novo apita", () => {
  const text = read("painel/DeskScreen.tsx");
  assert.equal((text.match(/if \(document\.hidden\) return;/g) ?? []).length, 2, "chamados e pedidos pausam com a aba escondida");
  assert.match(text, /window\.clearInterval\(callsTimer\)/);
  assert.match(text, /window\.clearInterval\(ordersTimer\)/);
  assert.match(text, /document\.removeEventListener\("visibilitychange", onVisible\)/);
  assert.match(text, /if \(step\.alert\) alertDevice\(step\.alert\)/);
  assert.ok(!/catch \{[^}]*setCalls\(\[\]\)/.test(text), "falha de rede não esvazia a lista");
  assert.ok(!/catch \{[^}]*setOrders\(\[\]\)/.test(text), "falha de rede não esvazia os pedidos");
  assert.match(text, /CALLS_MS/);
  assert.match(text, /ORDERS_MS/);
});

test("as mesas do painel: o foco acompanha a tela e a câmera fecha ao ler, ao cancelar e ao sair", () => {
  const text = read("painel/DeskScreen.tsx");
  assert.match(text, /getElementById\(selected \? "nv-desk-table-title" : "nv-desk-live"\)\?\.focus\(\)/);
  assert.match(text, /\.nv-page-desk \.nv-deskcall \.nv-btn/);
  const qr = read("painel/useQrReader.ts");
  assert.match(qr, /stream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(qr, /return stop;/);
  assert.match(qr, /stop\(\);\s*latest\.current\.onCode\(text\)/);
  assert.match(qr, /\[active\]/);
});

test("os pedidos do painel de verdade: só as contas puras de fora (nada de tela, CSS ou estilos antigos), e a lógica não fala com o servidor nem apita", () => {
  const files = { ordersLogic: read("painel/ordersLogic.ts"), ordersScreen: read("painel/OrdersScreen.tsx"), orders: read("novo/Orders.tsx") };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/mesa\//.test(text), `${name} importa a mesa antiga`);
    assert.ok(!/from ["']\.\.\/nav\//.test(text), `${name} importa o menu antigo`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
  }
  assert.ok(!/service\/api/.test(files.ordersLogic), "a conta não fala com o servidor");
  assert.ok(!/service\/alertDevice/.test(files.ordersLogic), "a conta não apita");
  assert.ok(!/from ["']\.\.\/service\//.test(files.orders), "a tela de desenho não fala com o servidor");
});

test("os pedidos do painel: um toque por vez, o estado de destino sai do que o servidor mandou e o pedido é conferido no servidor antes de mandar", () => {
  const text = read("painel/OrdersScreen.tsx");
  assert.match(text, /if \(working\.current\) return;/);
  assert.match(text, /const target = kind === "receive" \? null : nextStatusOf\(seen, kind\);/);
  assert.match(text, /const seen = latest\.current\.find\(\(order\) => order\.id === id\);/);
  // A conferência vem antes de qualquer envio, e quem confere é a lista nova do servidor.
  const check = text.indexOf("moveCheck(seen, fresh)");
  const sendPay = text.indexOf("await confirmPayment(id)");
  const sendMove = text.indexOf("await updateOrderStatus(id, target as string)");
  assert.ok(check > 0 && check < sendPay && check < sendMove, "o envio vem antes da conferência");
  assert.match(text, /payCheck\(seen, fresh\)/);
  assert.match(text, /if \(verdict === "changed"\) \{\s*adopt\(fresh\);[\s\S]*?setActionError\(ORDERS_CHANGED\);\s*return;\s*\}/);
  assert.match(text, /\} catch \{\s*setActionError\(kind === "receive" \? ORDERS_RECEIVE_ERROR : ORDERS_ADVANCE_ERROR\);\s*void load\(\);/);
  assert.match(text, /\} finally \{\s*working\.current = false;\s*setBusy\(null\);/);
});

test("os pedidos do painel: pergunta a cada 5 s, apita só pedido novo (por número, para quem não é entregador), e uma busca que falha não apaga a tela", () => {
  const text = read("painel/OrdersScreen.tsx");
  assert.match(text, /window\.setInterval\(\(\) => void load\(\), ORDERS_POLL_MS\)/);
  assert.match(text, /window\.setInterval\(\(\) => setNow\(Date\.now\(\)\), CLOCK_MS\)/);
  assert.match(text, /window\.clearInterval\(poll\);\s*window\.clearInterval\(clock\);/);
  assert.match(text, /document\.removeEventListener\("visibilitychange", onVisible\)/);
  assert.match(text, /if \(newOrders\(known\.current, current\)\.length > 0 && wantsNewOrderAlert\(role\)\) alertDevice\("order"\)/);
  assert.match(text, /known\.current = knownOrderIds\(current\)/);
  assert.ok(!/catch \{[^}]*setOrders\(\[\]\)/.test(text), "falha de rede não esvazia os pedidos");
  assert.match(text, /\} catch \{[^}]*setLoadFailed\(true\);/);
  assert.match(text, /fetchAdminOrders/);
  assert.ok(!/useState<PanelOrder\[\]>\(\(\) => fetch/.test(text));
});

test("os pedidos do painel: o foco volta para o pedido que acabou de mudar (ou o próximo botão, ou a frase de cima)", () => {
  const text = read("painel/OrdersScreen.tsx");
  assert.match(text, /document\.getElementById\(`nv-order-\$\{id\}`\)/);
  assert.match(text, /\.nv-page-orders \.nv-order \.nv-btn/);
  assert.match(text, /document\.getElementById\("nv-orders-live"\)/);
});

test("os pedidos do painel: o texto do cliente (nome, observação, endereço) nunca entra como HTML", () => {
  for (const name of ["painel/OrdersScreen.tsx", "painel/ordersLogic.ts", "novo/Orders.tsx"]) {
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|document\.write|eval\(/.test(read(name)), `${name} injeta HTML`);
  }
});

test("as entregas e o acerto do painel: só as contas puras de fora (nada de tela, CSS ou estilos antigos), e a lógica não fala com o servidor nem apita", () => {
  const files = {
    deliveriesLogic: read("painel/deliveriesLogic.ts"),
    deliveriesScreen: read("painel/DeliveriesScreen.tsx"),
    deliveries: read("novo/Deliveries.tsx"),
    settleLogic: read("painel/settleLogic.ts"),
    settleScreen: read("painel/SettleScreen.tsx"),
    settle: read("novo/Settle.tsx"),
  };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/mesa\//.test(text), `${name} importa a mesa antiga`);
    assert.ok(!/from ["']\.\.\/nav\//.test(text), `${name} importa o menu antigo`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    // Do entregador só entram a conta e a chamada ao servidor; a tela antiga dele (e o CSS dela) ficam de fora.
    for (const [, from] of text.matchAll(/from ["']\.\.\/courier\/([^"']+)["']/g)) assert.match(from, /^(courierLogic|courierApi)(\.ts)?$/, `${name} importa ../courier/${from}`);
  }
  for (const name of ["deliveriesLogic", "settleLogic"]) {
    assert.ok(!/service\/api/.test(files[name]), `${name}: a conta não fala com o servidor`);
    assert.ok(!/service\/alertDevice/.test(files[name]), `${name}: a conta não apita`);
  }
  for (const name of ["deliveries", "settle"]) assert.ok(!/from ["']\.\.\/(service|courier)\//.test(files[name]), `${name}: a tela de desenho não fala com o servidor`);
});

test("as entregas do painel: um toque por vez, e o servidor decide (código certo, quem pode pegar, quantas tentativas sobram)", () => {
  const text = read("painel/DeliveriesScreen.tsx");
  assert.equal((text.match(/if \(working\.current/g) ?? []).length, 2, "pegar e fechar, cada um com a trava");
  assert.match(text, /const seen = latest\.current\?\.find\(\(order\) => order\.id === id\);/);
  assert.match(text, /await pickUpOrder\(companyId, id\);/);
  // O código só vai se o pedido tem código, e só completo; o pedido sem código manda vazio.
  assert.match(text, /if \(!seen \|\| \(seen\.needs_code && !codeIsComplete\(open\.code\)\)\) return;/);
  assert.match(text, /await deliverOrder\(companyId, id, seen\.needs_code \? open\.code : ""\);/);
  assert.equal((text.match(/\} finally \{\s*working\.current = false;\s*setBusy\(null\);/g) ?? []).length, 2, "a trava sempre solta");
  // Código errado apaga o que foi digitado; bloqueado fecha o campo de código; sem sinal explica que repetir é seguro.
  assert.match(text, /if \(result\.kind === "wrong"\) setOpen\(\(current\) => \(current \? \{ \.\.\.current, code: "" \} : current\)\);/);
  assert.match(text, /if \(result\.kind === "locked"\) \{\s*setLocked\(/);
  assert.match(text, /result\.kind === "offline" \? DELIVERIES_OFFLINE : result\.message/);
  assert.match(text, /if \(result\.kind === "error"\) await load\(\);/);
  assert.match(read("novo/copy.ts"), /não tem problema repetir/);
});

test("as entregas do painel: pergunta a cada 10 s só com a tela à vista, apita só entrega nova para pegar, e uma busca que falha não apaga a lista", () => {
  const text = read("painel/DeliveriesScreen.tsx");
  assert.match(text, /window\.setInterval\(\(\) => \{\s*if \(!document\.hidden\) void load\(\);\s*\}, DELIVERIES_POLL_MS\)/);
  assert.match(text, /document\.addEventListener\("visibilitychange", onVisible\)/);
  assert.match(text, /document\.removeEventListener\("visibilitychange", onVisible\)/);
  assert.match(text, /window\.clearInterval\(poll\);/);
  assert.match(text, /if \(newOrders\(knownReady\.current, waiting\)\.length > 0\) alertDevice\("ready"\);/);
  assert.match(text, /knownReady\.current = knownOrderIds\(waiting\);/);
  assert.match(text, /const knownReady = useRef<Set<string> \| null>\(null\);/, "abrir a tela pela primeira vez não faz barulho");
  assert.ok(!/catch \(error\) \{[^}]*setOrders\(\[\]\)/.test(text), "falha de rede não esvazia as entregas");
  assert.match(text, /setProblem\(wordsOf\(error, DELIVERIES_LOAD_ERROR\)\);/);
  // A aba escolhida sozinha vale uma vez só: depois a lista não pula de aba debaixo do dedo.
  assert.match(text, /setChosen\(\(current\) => current \?\? firstDeliveriesTab\(groupOrders\(rows\)\)\);/);
});

test("as entregas do painel: o campo do código fecha sozinho se a entrega deixou de estar na rua, e o foco volta para a entrega que mudou", () => {
  const text = read("painel/DeliveriesScreen.tsx");
  assert.match(text, /!orders\.some\(\(order\) => order\.id === open\.id && stageOf\(order\) === "going"\)\) setOpen\(null\);/);
  assert.match(text, /document\.getElementById\(`nv-delivery-\$\{id\}`\)/);
  assert.match(text, /\.nv-page-deliveries \.nv-order \.nv-btn/);
  assert.match(text, /document\.getElementById\("nv-deliveries-live"\)/);
  assert.match(read("novo/Deliveries.tsx"), /ref\.current\?\.focus\(\);/, "ao abrir o campo, o foco vai para ele");
});

test("o acerto do caixa: dois toques no mesmo valor, e o servidor é olhado de novo antes de mandar o dinheiro", () => {
  const text = read("painel/SettleScreen.tsx");
  assert.match(text, /if \(working\.current \|\| !cash\) return;/);
  assert.match(text, /if \(armed !== key\) \{[\s\S]*?setArmed\(key\);[\s\S]*?timer\.current = window\.setTimeout\(\(\) => setArmed\(null\), ARM_MS\);\s*return;\s*\}/);
  assert.match(text, /disarm\(\);\s*void settle\(groupId\);/);
  // Mexer na marcação, atualizar e o segundo toque soltam o primeiro: três lugares.
  assert.equal((text.match(/disarm\(\);/g) ?? []).length, 3);
  const fetchAgain = text.indexOf("const fresh = await fetchCourierCash(companyId);");
  const check = text.indexOf('settleCheck(group, left, fresh) === "changed"');
  const send = text.indexOf("await settleCourierCash(companyId, groupId, ids)");
  assert.ok(fetchAgain > 0 && fetchAgain < check && check < send, "o envio vem antes da conferência");
  assert.match(text, /if \(settleCheck\(group, left, fresh\) === "changed"\) \{\s*setCash\(fresh\);\s*setLeft\(\[\]\);\s*setError\(SETTLE_CHANGED\);\s*return;\s*\}/);
  assert.match(text, /\} finally \{\s*working\.current = false;/);
  assert.match(text, /window\.clearTimeout\(timer\.current\);/);
});

test("o acerto do caixa: a lista NÃO se atualiza sozinha (o total contado não muda debaixo do caixa); só ao abrir, ao tocar em atualizar e depois de acertar", () => {
  const text = read("painel/SettleScreen.tsx");
  assert.ok(!/setInterval|visibilitychange/.test(text), "nada de pergunta periódica no acerto");
  assert.match(text, /useEffect\(\(\) => \{\s*alive\.current = true;\s*void load\(\);/);
  assert.match(text, /onRefresh=\{\(\) => \{[\s\S]*?void load\(\);/);
  assert.match(text, /setNotice\(settledText\(result\)\);\s*setLeft\(\[\]\);\s*await load\(\);/);
  assert.match(text, /document\.getElementById\(`nv-settle-\$\{groupId\}`\)/);
  assert.match(text, /\.nv-page-settle \.nv-order \.nv-btn/);
});

test("as entregas e o acerto do painel: o texto do cliente (nome, endereço, referência) nunca entra como HTML", () => {
  for (const name of ["painel/DeliveriesScreen.tsx", "painel/deliveriesLogic.ts", "novo/Deliveries.tsx", "painel/SettleScreen.tsx", "painel/settleLogic.ts", "novo/Settle.tsx"]) {
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|document\.write|eval\(/.test(read(name)), `${name} injeta HTML`);
  }
});

test("o cardápio do painel: só as contas puras do assistente de fora (nada de tela, CSS ou estilos antigos), e a lógica não fala com o servidor", () => {
  const files = {
    menuSetupLogic: read("painel/menuSetupLogic.ts"),
    menuSetupScreen: read("painel/MenuSetupScreen.tsx"),
    menuSetup: read("novo/MenuSetup.tsx"),
  };
  const PURE = /^(assistantFlow|assistantLogic|doorLogic|menuPhotoLogic|priceCheck|spokenMenu)(\.ts)?$/;
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/mesa\//.test(text), `${name} importa a mesa antiga`);
    assert.ok(!/from ["']\.\.\/nav\//.test(text), `${name} importa o menu antigo`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    // Do assistente antigo entram só as contas testadas (e a voz, na tela que escuta); as telas e o CSS dele ficam de fora.
    for (const [, from] of text.matchAll(/from ["']\.\.\/assistant\/([^"']+)["']/g)) {
      const voice = name === "menuSetupScreen" && /^voiceIO(\.ts)?$/.test(from);
      assert.ok(PURE.test(from) || voice, `${name} importa ../assistant/${from}`);
    }
  }
  assert.ok(!/service\/api/.test(files.menuSetupLogic), "a conta não fala com o servidor");
  assert.ok(!/voiceIO|photoFiles|document\.|window\./.test(files.menuSetupLogic), "a conta não usa o navegador");
  assert.ok(!/from ["']\.\.\/(service|painel|assistant|photos)\//.test(files.menuSetup), "a tela de desenho não fala com o servidor nem com a conta");
});

test("o cardápio do painel: cadastrar tem trava (um toque por vez), só vai o que tem preço e a leitura tem prazo", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /if \(working\.current\) return;/);
  assert.match(text, /const payload = importPayload\(flowRef\.current\);\s*if \(payload\.categories\.length === 0\) return;/);
  assert.match(text, /await importMenu\(companyId, payload\);/);
  assert.match(text, /\} finally \{\s*working\.current = false;\s*if \(alive\.current\) setSaving\(false\);/);
  assert.match(text, /const READ_TIMEOUT_MS = 100_000;/);
  assert.match(text, /window\.setTimeout\(\(\) => abort\.abort\(\), READ_TIMEOUT_MS\)/);
  // Sair da tela (ou cancelar) para a leitura, a escuta e solta as fotos do aparelho.
  assert.match(text, /controller\.current\?\.abort\(\);\s*hearing\.current\?\.cancel\(\);\s*pagesRef\.current\.forEach\(\(page\) => URL\.revokeObjectURL\(page\.url\)\);/);
  assert.match(text, /if \(mine !== run\.current \|\| !alive\.current\) return;/);
});

test("o cardápio do painel: leitura sem prato nenhum conta como 'não li'; a foto que não leu é descartada, o arquivo volta à porta", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /if \(!read \|\| selectedItems\(read\)\.length === 0\) return fall\(/);
  assert.match(text, /if \(unreadable\) clearPages\(\);/);
  assert.match(text, /setDoorError\(message\);\s*setWhere\("door"\);/);
  assert.match(text, /const problem = menuFileProblem\(file, options\?\.pdf === true\);/);
  assert.match(text, /if \(!fitsTogether\(current\.map\(\(page\) => page\.blob\.size\)\)\) \{\s*setPagesMessage\(MENU_TOO_HEAVY\);\s*return;\s*\}/);
});

test("o cardápio do painel: tocar para parar de falar não joga fora o que já foi ouvido, e a escuta é de ditado (espera a pausa)", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /const words = heardRef\.current\.trim\(\);\s*stopListening\(\);\s*if \(words\) take\(words\);/);
  assert.match(text, /patienceMs: DICTATION_PATIENCE_MS/);
  assert.match(text, /if \(mine !== session\.current \|\| !alive\.current\) return;/);
  assert.match(text, /document\.getElementById\("nv-menu-live"\)\?\.focus\(\);/);
});

test("o cardápio do painel: o cadastro de verdade é o do servidor; o erro 'sem sinal' não afirma o que não sabe", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /setReviewError\(wordsOf\(failure, MENU_SAVE_ERROR\)\)/);
  const copy = read("novo/copy.ts");
  const line = copy.match(/export const MENU_SAVE_ERROR = "([^"]*)"/)[1];
  assert.ok(!/nada foi cadastrado/i.test(line), "a resposta pode ter se perdido depois de o servidor cadastrar");
  assert.match(line, /não repete/);
});

test("o cardápio do painel: nome de prato, texto falado e frase do servidor nunca entram como HTML", () => {
  for (const name of ["painel/MenuSetupScreen.tsx", "painel/menuSetupLogic.ts", "novo/MenuSetup.tsx"]) {
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|document\.write|eval\(/.test(read(name)), `${name} injeta HTML`);
  }
});

test("começar de um modelo: a conta só usa as contas puras do assistente, não fala com o servidor nem com o navegador, e as telas de desenho não falam com ninguém", () => {
  const logic = read("painel/menuModelLogic.ts");
  const screen = read("novo/MenuModel.tsx");
  const PURE = /^(assistantFlow|doorLogic)(\.ts)?$/;
  for (const [, from] of logic.matchAll(/from ["']\.\.\/assistant\/([^"']+)["']/g)) assert.ok(PURE.test(from), `menuModelLogic importa ../assistant/${from}`);
  assert.ok(!/from ["']\.\.\/(styles|ui|admin|mesa|nav)/.test(logic), "a conta importa o antigo");
  assert.ok(!/service\/api|voiceIO|photoFiles|document\.|window\./.test(logic), "a conta não fala com o servidor nem com o navegador");
  assert.ok(!/from ["']\.\.\/(service|painel|assistant|photos|styles|ui|admin|mesa|nav)/.test(screen), "a tela de desenho não fala com o servidor nem com a conta");
  assert.ok(!/import ["']\.\.\//.test(screen), "a tela importa CSS de fora");
});

test("começar de um modelo: a lista de tipos e o modelo escolhido são lidos com desconfiança, e resposta velha nunca passa por cima da tela", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /const tiles = modelTypesOf\(await fetchMenuTemplates\(\)\);/);
  assert.match(text, /const model = modelOf\(await fetchMenuTemplate\(id\), id\);/);
  assert.match(text, /if \(mine !== typesRun\.current \|\| !alive\.current\) return;/);
  assert.match(text, /if \(mine !== openRun\.current \|\| !alive\.current\) return;/);
  // Um tipo por vez: o segundo toque enquanto o modelo abre não faz nada.
  assert.match(text, /if \(openingRef\.current\) return;/);
  // Voltar à porta cancela a abertura que estiver a caminho.
  assert.match(text, /openRun\.current \+= 1;\s*openingRef\.current = false;\s*setOpening\(false\);/);
  // Sair da tela solta as duas esperas.
  assert.match(text, /typesRun\.current \+= 1;\s*openRun\.current \+= 1;/);
  // Lista que não é lista, ou vazia, não vira "nenhum tipo": vira frase e botão de tentar de novo.
  assert.match(text, /if \(!tiles\) return setTypesError\(MENU_READ_ODD\);/);
  assert.match(text, /if \(tiles\.length === 0\) return setTypesError\(MENU_MODEL_NONE\);/);
  assert.match(text, /if \(!model\) return setTypesError\(MENU_MODEL_EMPTY\);/);
});

test("começar de um modelo: nada vai ao servidor até Cadastrar (marcar, anotar e pôr preço são só do aparelho)", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.equal((text.match(/importMenu\(/g) ?? []).length, 1, "só o Cadastrar manda o cardápio");
  const from = text.indexOf("começar de um modelo");
  const to = text.indexOf("// ---", from + 10);
  const block = text.slice(from, to);
  assert.ok(!/importMenu|fetch\(/.test(block), "o bloco do modelo só lê (tipos e modelo), nunca escreve");
  // O preço de cada prato é o que a pessoa escreveu: o campo vazio sem preço anterior não segue.
  assert.match(read("painel/menuModelLogic.ts"), /if \(!wanted \|\| !priceIsUsable\(wanted\)\) return \{ flow, problem: "price" \};/);
});

test("começar de um modelo: o foco vai para a frase de aviso a cada etapa e a cada categoria, e nos preços fica no campo do preço", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /const stepKey = where === "pick" \? `pick-\$\{flow\.categoryIndex\}` : where;/);
  assert.match(text, /if \(stepKey === "prices"\) return;\s*if \(stepKey === "speak" && writeFirst\.current\) \{\s*writeFirst\.current = false;\s*document\.getElementById\("nv-menu-type"\)\?\.focus\(\);\s*return;\s*\}\s*document\.getElementById\("nv-menu-live"\)\?\.focus\(\);/);
  const screen = read("novo/MenuModel.tsx");
  assert.match(screen, /useEffect\(\(\) => \{\s*field\.current\?\.focus\(\);\s*\}, \[view\.dishId\]\);/);
  assert.match(screen, /<form\s+key=\{view\.dishId\}/, "cada prato recomeça o campo com o preço que já tem");
});

test("começar de um modelo: voltar anda um passo de cada vez (preço → prato anterior; primeira categoria → tipos; conferência → último preço)", () => {
  const text = read("painel/MenuSetupScreen.tsx");
  assert.match(text, /if \(where === "types"\) return goDoor\(\);/);
  assert.match(text, /const earlier = goBackPick\(flowRef\.current\);\s*setPickNotice\(""\);\s*if \(!earlier\) return setWhere\("types"\);\s*return go\(earlier\);/);
  assert.match(text, /if \(where === "prices"\) \{\s*setPriceProblem\(""\);\s*return go\(backPrice\(flowRef\.current\)\);/);
  assert.match(text, /if \(flowRef\.current\.source === "template"\) return go\(backPrice\(flowRef\.current\)\);/);
  // A tela certa sai sempre do estado do assistente (uma conta só), nunca de um segundo controle.
  assert.match(read("painel/menuModelLogic.ts"), /export const whereOf = \(flow: FlowState\)/);
});

test("começar de um modelo: 'sem sinal' ao abrir não afirma o que não sabe, e nome de prato e frase do servidor nunca entram como HTML", () => {
  const copy = read("novo/copy.ts");
  for (const name of ["MENU_MODEL_ERROR", "MENU_MODEL_OPEN_ERROR"]) {
    const line = copy.match(new RegExp(`export const ${name} = "([^"]*)"`))[1];
    assert.match(line, /Sem sinal/);
    assert.ok(!/nada (foi|entrou|mudou)/i.test(line), `${name} afirma o que não sabe`);
  }
  for (const name of ["painel/menuModelLogic.ts", "novo/MenuModel.tsx", "painel/MenuSetupScreen.tsx"]) {
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|document\.write|eval\(/.test(read(name)), `${name} injeta HTML`);
  }
});

test("pratos e categorias do painel: só contas puras de fora, a lógica não fala com o servidor nem com o navegador, e a tela de desenho não fala com ninguém", () => {
  const files = {
    dishesLogic: read("painel/dishesLogic.ts"),
    dishesApi: read("painel/dishesApi.ts"),
    dishesScreen: read("painel/DishesScreen.tsx"),
    categoriesScreen: read("painel/CategoriesScreen.tsx"),
    dishes: read("novo/Dishes.tsx"),
    categories: read("novo/Categories.tsx"),
  };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(!/from ["']\.\.\/(styles|ui|admin)/.test(text), `${name} importa o antigo`);
    assert.ok(!/from ["']\.\.\/(mesa|nav)\//.test(text), `${name} importa a mesa ou o menu antigos`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS de fora`);
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|document\.write|eval\(/.test(text), `${name} injeta HTML (nome de prato e de categoria nunca entram como HTML)`);
    assert.ok(!/console\./.test(text), `${name} esconde erro no console`);
  }
  // Da conta de fora entram só as contas testadas (o agrupar do cardápio do cliente, o preço e o nome do assistente, o selo de opções).
  assert.ok(!/from ["']\.\.\/service\/(?!optionsDraft)/.test(files.dishesLogic), "a conta importa do servidor");
  assert.ok(!/voiceIO|photoFiles|document\.|window\./.test(files.dishesLogic), "a conta usa o navegador");
  assert.ok(!/from ["']\.\.\/(service|painel|assistant|photos|customer|loja)\//.test(files.dishes), "a tela de pratos fala com o servidor ou com a conta");
  assert.ok(!/from ["']\.\.\/(service|painel|assistant|photos|customer|loja)\//.test(files.categories), "a tela de categorias fala com o servidor ou com a conta");
});

test("pratos do painel: esgotou e voltou valem na hora e voltam atrás; uma busca velha nunca passa por cima de um toque", () => {
  const text = read("painel/DishesScreen.tsx");
  assert.match(text, /if \(!products \|\| working\.current \|\| toggling\.includes\(id\)\) return;/, "um toque por prato, e nada enquanto remove ou volta tudo");
  assert.match(text, /setProducts\(\(list\) => \(list \? withSoldOut\(list, id, wanted\) : list\)\);/);
  assert.match(text, /const confirmed = await setSoldOut\(id, wanted\);/);
  assert.match(text, /setProducts\(\(list\) => \(list \? withSoldOut\(list, id, !wanted\) : list\)\);\s*setError\(wordsOf\(failure, DISHES_SOLD_ERROR\)\);/, "se o servidor recusa, volta atrás e diz");
  assert.match(text, /\} finally \{\s*pending\.current -= 1;/);
  assert.match(text, /if \(pending\.current > 0 \|\| changes\.current !== before\) return;/, "a resposta que saiu antes de um toque não vale");
  assert.match(text, /const poll = window\.setInterval\(\(\) => \{\s*if \(!document\.hidden\) void load\(\);\s*\}, DISHES_POLL_MS\);/);
  assert.match(text, /document\.addEventListener\("visibilitychange", onVisible\);/);
});

test("pratos do painel: remover pede dois toques na lixeira e é um por vez; criar e remover são de dono e gerente", () => {
  const screen = read("painel/DishesScreen.tsx");
  assert.match(screen, /if \(working\.current \|\| !products\) return;\s*if \(armed !== id\) \{/);
  assert.match(screen, /timer\.current = window\.setTimeout\(\(\) => setArmed\(null\), ARM_MS\);\s*return;/);
  assert.match(screen, /await removeDish\(id\);/);
  assert.match(screen, /\} finally \{\s*working\.current = false;\s*if \(alive\.current\) setRemoving\(null\);/);
  const view = read("novo/Dishes.tsx");
  assert.match(view, /\{canManage \? \(\s*<button\s+type="button"\s+className=\{`nv-icon-btn is-danger/, "a cozinha não vê a lixeira");
  assert.match(view, /view\.canManage && !view\.loading \?/, "a cozinha não vê o Novo prato");
  const copy = read("novo/copy.ts");
  assert.match(copy, /DISHES_REMOVE_ERROR = "[^"]*Esgotou[^"]*"/, "se não der para remover, a frase aponta o Esgotou");
});

test("pratos do painel: adicionar confere antes de mandar, vai uma vez por toque, não trava o que foi digitado e depois olha a lista", () => {
  const text = read("painel/DishesScreen.tsx");
  assert.match(text, /if \(working\.current \|\| !form \|\| !products \|\| !menus\) return;\s*const check = dishCheck\(form, products, menus\);\s*if \(!check\.ok\) \{/);
  assert.match(text, /await addDish\(companyId, check\.dish\);/);
  assert.match(text, /setForm\(\(current\) => \(current \? formAfterAdd\(current\) : current\)\);/, "o formulário fica aberto com a categoria");
  assert.match(text, /\} finally \{\s*working\.current = false;\s*if \(alive\.current\) setAdding\(false\);\s*\/\/ [^\n]*\n\s*void load\(\);/, "entrou ou não, olha a lista de novo");
  const view = read("novo/Dishes.tsx");
  assert.ok((view.match(/readOnly=\{adding \|\| undefined\}/g) ?? []).length >= 3, "enquanto adiciona, os campos não mudam");
  assert.match(view, /disabled=\{adding\}/);
});

test("pratos e categorias do painel: 'sem sinal' ao adicionar não afirma que nada entrou, e erro do servidor usa a nossa frase", () => {
  const copy = read("novo/copy.ts");
  for (const name of ["DISHES_ADD_ERROR", "CATS_ADD_ERROR"]) {
    const line = copy.match(new RegExp(`export const ${name} = "([^"]*)"`))[1];
    assert.ok(!/nada (foi|entrou)/i.test(line), `${name} afirma o que não sabe (a resposta pode ter se perdido depois de o servidor criar)`);
    assert.match(line, /veja na lista/, `${name} manda conferir a lista antes de tentar de novo`);
  }
  assert.match(read("painel/dishesLogic.ts"), /return status >= 400 && status < 500 && message \? message : fallback;/);
});

test("pratos e categorias do painel: a camada de rede leva o login, manda o login vencido de volta ao login e usa as rotas do servidor", () => {
  const text = read("painel/dishesApi.ts");
  assert.match(text, /if \(response\.status === 401\) expireSession\(\);/);
  assert.match(text, /\.\.\.authHeaders\(\)/);
  assert.match(text, /\/companies\/\$\{encodeURIComponent\(companyId\)\}\/admin\/products`/);
  assert.match(text, /\/admin\/products\/\$\{encodeURIComponent\(productId\)\}`/);
  assert.match(text, /\/companies\/\$\{encodeURIComponent\(companyId\)\}\/admin\/menus`/);
  assert.match(text, /\/admin\/menus\/\$\{encodeURIComponent\(menuId\)\}`/);
  assert.match(text, /menu_id: dish\.menuId/);
  // Esgotou e voltou tudo já têm a camada própria (horário e pausa); aqui não se repete.
  assert.ok(!/sold-out/.test(text));
});

test("pratos e categorias do painel: a busca da lista nunca apaga o erro de uma ação (a frase 'veja na lista' tem de ser lida)", () => {
  for (const [file, loadError] of [["painel/DishesScreen.tsx", "DISHES_LOAD_ERROR"], ["painel/CategoriesScreen.tsx", "CATS_LOAD_ERROR"]]) {
    const text = read(file);
    const load = text.match(/const load = useCallback\(async \(\) => \{[\s\S]*?\}, \[companyId\]\);/)?.[0] ?? "";
    assert.ok(load, `${file}: não achei a busca da lista`);
    assert.ok(!/\bsetError\(/.test(load), `${file}: a busca da lista mexe no erro das ações (o 'adicionar' chama a busca logo depois de falhar e apagaria a frase)`);
    assert.match(load, /setListError\(""\);/, `${file}: a busca que deu certo limpa só o erro da lista`);
    assert.match(load, new RegExp(`setListError\\(${loadError}\\)`), `${file}: a busca que falhou guarda o erro da lista`);
    assert.match(text, /error: error \|\| listError/, `${file}: a tela mostra o erro da ação, e na falta dele o da lista`);
    assert.match(text, /onRefresh=\{\(\) => \{\s*setNotice\(""\);\s*setError\(""\);/, `${file}: Atualizar a lista limpa o erro da ação`);
  }
});

test("pratos do painel: o lápis abre o formulário já preenchido, salva uma vez por toque, só manda o que mudou e sem mudança nem fala com o servidor", () => {
  const text = read("painel/DishesScreen.tsx");
  assert.match(text, /const edit = \(id: string\) => \{\s*if \(working\.current \|\| !products \|\| !menus\) return;/, "abrir o lápis não vale no meio de outra ação");
  assert.match(text, /setForm\(formOfDish\(product, menus\)\);/);
  assert.match(text, /const save = async \(\) => \{\s*if \(working\.current \|\| !form\?\.editId \|\| !products \|\| !menus\) return;/, "salvar é um por vez");
  assert.match(text, /const check = dishEditCheck\(form, product, products, menus\);\s*if \(!check\.ok\) \{/, "confere antes de mandar");
  assert.match(text, /if \(Object\.keys\(check\.patch\)\.length === 0\) \{\s*setForm\(null\);/, "sem nada mudado, só fecha");
  assert.match(text, /await editDish\(product\.id, check\.patch\);/);
  assert.match(text, /setProducts\(\(list\) => \(list \? withEdit\(list, product\.id, check\.patch\) : list\)\);/, "a tela mostra o que o servidor aceitou");
  assert.match(text, /\} finally \{\s*working\.current = false;\s*if \(alive\.current\) setAdding\(false\);\s*\/\/ [^\n]*\n\s*void load\(\);/, "salvou ou não, olha a lista de novo");
  assert.match(text, /onAdd=\{\(\) => void \(form\?\.editId \? save\(\) : add\(\)\)\}/, "o mesmo botão salva quando é um prato que já existe");
  assert.match(text, /editing: form\?\.editId \?\? null/, "a lista marca o prato que está sendo mudado");
});

test("pratos do painel: prato que outro aparelho removeu enquanto o formulário estava aberto fecha o formulário e diz, sem mandar nada", () => {
  const text = read("painel/DishesScreen.tsx");
  assert.match(text, /if \(!product\) \{[^}]*setForm\(null\);\s*setError\(DISHES_EDIT_GONE\);\s*return;/);
});

test("pratos do painel: o foco volta para o lápis do prato (ou para Novo prato) ao salvar, cancelar ou fechar", () => {
  const text = read("painel/DishesScreen.tsx");
  assert.match(text, /const back = `nv-dish-edit-\$\{product\.id\}`;/);
  assert.ok((text.match(/focusLater\(back\)/g) ?? []).length >= 3, "sem mudança, salvou e (no cancelar) fecha");
  assert.match(text, /const back = form\?\.editId \? `nv-dish-edit-\$\{form\.editId\}` : "nv-dishes-new";/);
  const view = read("novo/Dishes.tsx");
  assert.match(view, /id=\{`nv-dish-edit-\$\{row\.id\}`\}/);
  assert.match(view, /id="nv-dishes-new"/);
});

test("pratos do painel: a camada de rede muda o prato com PUT só com os campos que vieram, e 405 diz que falta atualizar o servidor", () => {
  const text = read("painel/dishesApi.ts");
  assert.match(text, /export async function editDish\(productId: string, patch: DishPatch\)/);
  assert.match(text, /method: "PUT"/);
  for (const key of ["name", "description", "price"]) assert.match(text, new RegExp(`if \\(patch\\.${key} !== undefined\\) body\\.${key} = patch\\.${key};`), key);
  assert.match(text, /if \(patch\.menuId !== undefined\) body\.menu_id = patch\.menuId;/);
  assert.match(text, /if \(response\.status === 405\) throw new HttpError\(DISHES_EDIT_MISSING, 405\);/);
  assert.match(text, /import \{ DISHES_EDIT_MISSING \} from "\.\.\/novo\/copy";/);
});

test("pratos do painel: 'sem sinal' ao salvar não afirma que nada mudou (a resposta pode ter se perdido depois de o servidor salvar)", () => {
  const copy = read("novo/copy.ts");
  const line = copy.match(/export const DISHES_EDIT_ERROR = "([^"]*)"/)[1];
  assert.ok(!/nada (foi|mudou)|não (mudou|salvou)/i.test(line), "afirma o que não sabe");
  assert.match(line, /veja na lista/, "manda conferir a lista antes de tentar de novo");
  assert.match(read("painel/DishesScreen.tsx"), /setError\(wordsOf\(failure, DISHES_EDIT_ERROR\)\)/);
});

test("categorias do painel: criar confere nome vazio e repetido, remover pede dois toques e diz que os pratos ficam sem categoria", () => {
  const screen = read("painel/CategoriesScreen.tsx");
  assert.match(screen, /const check = categoryCheck\(name, menus\);\s*if \(!check\.ok\) \{\s*setProblem\(check\.problem\);\s*return;/);
  assert.match(screen, /await addCategory\(companyId, check\.name\);/);
  assert.match(screen, /if \(armed !== id\) \{/);
  assert.match(screen, /await removeCategory\(id\);/);
  assert.match(screen, /const poll = window\.setInterval\(\(\) => \{\s*if \(!document\.hidden\) void load\(\);/);
  assert.match(read("novo/copy.ts"), /CATS_HELP = "[^"]*ficam sem categoria\.?"/);
});

