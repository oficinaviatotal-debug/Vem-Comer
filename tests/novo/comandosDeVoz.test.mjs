import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { viewTitle } from "../../frontend/src/nav/navLogic.ts";
import { allowedViews } from "../../frontend/src/painel/shellLogic.ts";
import { interpretVoiceNav, voiceCatalog } from "../../frontend/src/painel/voiceNavLogic.ts";
import { canMarkDishes, dishVoiceCatalog, parseDishCommand } from "../../frontend/src/painel/voiceDishLogic.ts";
import { interpretShopVoice, shopVoiceCatalog } from "../../frontend/src/loja/shopVoiceLogic.ts";

/**
 * Os comandos de voz, conferidos de ponta a ponta e escritos em `docs/comandos-de-voz.md` (pedido do GD, 23/10/2026,
 * 21:22: "verificando os comandos"). O roteiro é **gerado do código**: se uma frase entrar ou sair e o arquivo não for
 * atualizado, este teste fica vermelho. Para atualizar: `ATUALIZAR=1 node --experimental-strip-types --no-warnings --test tests/novo/comandosDeVoz.test.mjs`.
 */
const DOC = new URL("../../docs/comandos-de-voz.md", import.meta.url);

const ROLES = [
  ["OWNER", "dono"],
  ["MANAGER", "gerente"],
  ["WAITER", "garçom"],
  ["CASHIER", "caixa"],
  ["KITCHEN", "cozinha"],
  ["COURIER", "entregador"],
];
const context = (role, extra = {}) => ({ role, planBlocked: false, hasPlanTab: true, platformAdmin: false, ...extra });
const nav = voiceCatalog();
const dish = dishVoiceCatalog();
const shop = shopVoiceCatalog();

// ---------------------------------------------------------------- a voz do painel

test("painel: para toda pessoa e toda frase, a voz responde com algo e nunca leva a uma tela que o menu não mostra", () => {
  const phrases = [...nav.screens.flatMap((screen) => screen.says), ...nav.brief, ...nav.help];
  for (const [role] of ROLES) {
    for (const platformAdmin of [false, true]) {
      const allowed = allowedViews(context(role, { platformAdmin }));
      for (const transcript of phrases) {
        const answer = interpretVoiceNav({ transcript, role, allowed, current: "inicio" });
        const where = `${role}${platformAdmin ? " (dono do sistema)" : ""} disse "${transcript}"`;
        if (answer.kind === "go") {
          assert.ok(allowed.includes(answer.view), `${where}: levou a ${answer.view}, que o menu dela não mostra`);
          assert.ok(answer.say.trim() !== "", `${where}: abriu sem dizer nada`);
        } else if (answer.kind === "stay" || answer.kind === "unknown") {
          assert.ok(answer.say.trim() !== "", `${where}: silêncio`);
        } else if (answer.kind === "dish") {
          assert.ok(canMarkDishes(role), `${where}: marcar prato é só para quem o servidor deixa`);
        } else {
          assert.equal(answer.kind, "brief", where);
        }
      }
    }
  }
});

test("painel: o dono, com todas as telas à mão, chega em cada tela falando qualquer uma das frases dela", () => {
  const allowed = allowedViews(context("OWNER", { platformAdmin: true }));
  for (const screen of nav.screens) {
    for (const transcript of screen.says) {
      const answer = interpretVoiceNav({ transcript, role: "OWNER", allowed, current: "x" });
      assert.deepEqual([answer.kind, answer.view], ["go", screen.view], `"${transcript}" devia abrir ${screen.view}`);
    }
  }
  for (const transcript of nav.brief) assert.equal(interpretVoiceNav({ transcript, role: "OWNER", allowed, current: "x" }).kind, "brief", transcript);
  for (const transcript of nav.help) assert.equal(interpretVoiceNav({ transcript, role: "OWNER", allowed, current: "x" }).kind, "stay", transcript);
});

test("painel: toda tela do menu de cada pessoa tem pelo menos uma frase para falar", () => {
  const spoken = new Set(nav.screens.map((screen) => screen.view));
  for (const [role] of ROLES) {
    for (const view of allowedViews(context(role, { platformAdmin: true }))) assert.ok(spoken.has(view), `${role}: ${view} sem frase de voz`);
  }
});

test("painel: quem não é dono, gerente ou cozinha não ouve pergunta de prato esgotado", () => {
  const allowed = allowedViews(context("WAITER"));
  const answer = interpretVoiceNav({ transcript: "acabou o pastel de carne", role: "WAITER", allowed, current: "inicio" });
  assert.notEqual(answer.kind, "dish");
});

// ---------------------------------------------------------------- prato esgotado

test("prato: toda frase de 'acabou' e de 'voltou' vira o pedido certo quando vem com o nome de um prato", () => {
  for (const said of dish.soldout) {
    const found = parseDishCommand(` ${said} pastel de carne `);
    assert.ok(found, `"${said}" com o prato devia ser pedido`);
    assert.equal(found.action, "soldout", said);
  }
  for (const said of dish.back) {
    const found = parseDishCommand(` ${said} pastel de carne `);
    assert.ok(found, `"${said}" com o prato devia ser pedido`);
    assert.equal(found.action, "back", said);
  }
});

test("prato: sozinhas ou com 'não', as frases de esgotado não marcam nada", () => {
  for (const said of [...dish.soldout, ...dish.back]) assert.equal(parseDishCommand(` ${said} `), null, `"${said}" sozinha não é pedido`);
  assert.equal(parseDishCommand(" nao acabou o pastel de carne "), null);
  assert.equal(parseDishCommand(" o pedido chegou "), null, "conversa de movimento não é prato");
});

// ---------------------------------------------------------------- a voz do cliente

const PRODUCTS = [{ id: "p1", menu_id: "m1", name: "Pastel de carne", price: 9 }];
const MENUS = [{ id: "m1", name: "Salgados" }];
const filled = [{ id: "p1", name: "Pastel de carne", price: 9, quantity: 1 }];
const shopAsk = (transcript, extra = {}) =>
  interpretShopVoice({ transcript, screen: "menu", load: "ready", products: PRODUCTS, menus: MENUS, cart: filled, closed: false, hasTable: true, ordersCount: 1, searchable: true, ...extra });

test("cliente: toda frase de tela leva à tela dela (ou diz que já está lá), e a voz nunca finge", () => {
  for (const screen of shop.screens) {
    for (const transcript of screen.says) {
      const from = screen.screen === "menu" ? "tracking" : "menu";
      const answer = shopAsk(transcript, { screen: from });
      assert.equal(answer.kind, "go", `"${transcript}" a partir de ${from}`);
      assert.equal(answer.screen, screen.screen, `"${transcript}"`);
      const here = shopAsk(transcript, { screen: screen.screen });
      assert.equal(here.kind, "stay", `"${transcript}": já está na tela`);
      assert.ok(here.say.trim() !== "", `"${transcript}": silêncio`);
    }
  }
});

test("cliente: falar em enviar, fechar ou pagar abre a sacola e diz que o envio é no botão (a voz nunca envia)", () => {
  for (const transcript of shop.send) {
    const answer = shopAsk(transcript);
    assert.equal(answer.kind, "go", transcript);
    assert.equal(answer.screen, "bag", transcript);
    assert.match(answer.say, /Enviar pedido/, `"${transcript}": diz onde tocar`);
  }
});

test("cliente: pedir ajuda diz o que falar, e 'meu pedido' vai para a sacola ou para o acompanhamento, conforme o que a pessoa tem", () => {
  for (const transcript of shop.help) {
    const answer = shopAsk(transcript);
    assert.equal(answer.kind, "stay", transcript);
    assert.ok(answer.say.trim() !== "", transcript);
  }
  for (const transcript of shop.myOrder) {
    assert.equal(shopAsk(transcript).screen, "bag", `${transcript}: com a sacola cheia, abre a sacola`);
    assert.equal(shopAsk(transcript, { cart: [] }).screen, "tracking", `${transcript}: sacola vazia e já pediu, abre o acompanhamento`);
  }
});

// ---------------------------------------------------------------- o roteiro escrito

const list = (phrases) => phrases.map((phrase) => `"${phrase}"`).join(", ");
const roleNames = (roles) => (roles.length === ROLES.length ? "todos" : roles.map(([, name]) => name).join(", "));

function screenRows() {
  return nav.screens.map((screen) => {
    const names = [...new Set(ROLES.map(([role]) => viewTitle(screen.view, role)))];
    const opens = ROLES.filter(([role]) => allowedViews(context(role)).includes(screen.view));
    const platform = opens.length === 0 && allowedViews(context("OWNER", { platformAdmin: true })).includes(screen.view);
    const who = platform ? "só o dono do sistema" : roleNames(opens);
    const extra = screen.instead ? ` (quem não abre esta tela vai para "${viewTitle(screen.instead, "OWNER")}")` : "";
    return `| ${names.join(" / ")} | ${who} | ${list(screen.says)}${extra} |`;
  });
}

function buildDoc() {
  return `# O que dá para falar no Vem Comer (comandos de voz)

Este arquivo é **gerado do código** por \`tests/novo/comandosDeVoz.test.mjs\` e conferido a cada mudança: se uma frase entrar ou sair e este texto não for atualizado, o teste fica vermelho. Para atualizar: \`ATUALIZAR=1 node --experimental-strip-types --no-warnings --test tests/novo/comandosDeVoz.test.mjs\`.

As frases estão escritas **sem acento e sem maiúscula** porque é assim que a voz as lê: falar com acento, com maiúscula, com pontuação ou com palavras a mais ("por favor, abre os pedidos") dá no mesmo. Quando duas frases servem, vale a **mais comprida**: "resumo do dia" lê o dia, "resumo" abre os números.

**Estado:** conferido por teste automático e no navegador com microfone de teste. **Ainda não testado com voz de verdade em Android e iPhone** (ver \`docs/teste-no-celular.md\`, "Fica para depois"). As listas de palavras vão ser afinadas com o que os celulares realmente entendem.

## Regras que valem para toda a voz

- **A voz do painel** abre telas, lê como está o dia e, só depois de um "sim", marca prato esgotado. Ela não cria, não paga e não apaga nada.
- **A voz do cliente** põe e tira pratos da **sacola** (sempre com o botão *Desfazer*) e abre telas. Ela **nunca envia o pedido, nunca paga e nunca chama o garçom sozinha**: o envio, o pagamento e a chamada são botões que a pessoa toca.
- **Não adivinha.** Se mais de um prato combina com o que foi falado, a voz lista os nomes e pede o nome inteiro; se nenhum combina, diz isso. Frase que não foi entendida vira uma resposta com exemplos reais, nunca um palpite.
- **Nunca fica em silêncio.** Quem pede uma tela que não pode abrir ouve "não posso abrir isto para você agora"; quem já está na tela ouve que já está nela.

## Painel (dono, gerente e equipe)

### Abrir uma tela

| Tela | Quem abre | O que falar |
| --- | --- | --- |
${screenRows().join("\n")}

### Perguntar como está o dia

A voz lê os números do dia (não abre tela): ${list(nav.brief)}.

### Pedir ajuda

${list(nav.help)}: a voz diz o que se pode falar, com exemplos das telas que a pessoa abre.

### Marcar um prato como esgotado, ou de volta

Só para **dono, gerente e cozinha**, e só quem abre *Produtos*. Fala-se o aviso e o nome do prato: "acabou o pastel de carne", "voltou o açaí".

- **Esgotou:** ${list(dish.soldout)}.
- **Voltou:** ${list(dish.back)}.
- A voz **diz o nome do prato que entendeu e pergunta**; só muda depois de **sim** (${list(dish.yes)}). **Não** (${list(dish.no)}), outra frase ou 30 segundos de silêncio: nada muda.
- "Acabou" sozinho, sem nome de prato, só abre *Produtos*. Frase com "não" ("não acabou o pastel") não marca nada. Conversa de movimento ("o pedido chegou", "a entrega terminou") não é prato: palavras como ${list(dish.notADish.slice(0, 12))} e outras impedem.

### Falar o horário

Na tela *Horário*, o botão de falar entende "de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado". As palavras só preenchem a tela, com "Ainda não foi salvo": **nada é gravado até tocar em *Salvar horário***.

## Cliente (cardápio e pedido)

### Ir para uma tela

| Tela | O que falar |
| --- | --- |
${shop.screens.map((screen) => `| ${{ menu: "Cardápio", bag: "Sacola", tracking: "Acompanhar o pedido", table: "Mesa (chamar o garçom, pedir a conta)" }[screen.screen]} | ${list(screen.says)} |`).join("\n")}

"Meu pedido" (${list(shop.myOrder)}) abre a sacola, se tem coisa nela; senão, o acompanhamento, se já pediu.

### Pedir, tirar e buscar

- **Pôr na sacola:** ${list(shop.order)} + o nome do prato, com a quantidade se quiser ("quero dois pastéis de carne", "meia dúzia de coxinha"). Só o nome do prato também vale. Prato com tamanho ou extras **não entra direto**: a voz abre as escolhas e a pessoa toca em *Adicionar*.
- **Tirar da sacola:** ${list(shop.remove)} + o nome do prato.
- **Buscar no cardápio:** ${list(shop.search)} + o que procura ("buscar suco", "tem açaí?").
- **Enviar, fechar ou pagar o pedido:** ${list(shop.send)}: a voz **só abre a sacola** e diz onde tocar em *Enviar pedido*.

### Pedir ajuda

${list(shop.help)}: a voz diz o que falar agora, com pratos de verdade do cardápio como exemplo.
`;
}

test("o roteiro de comandos de voz (docs/comandos-de-voz.md) é igual ao que o código entende", () => {
  const built = buildDoc();
  if (process.env.ATUALIZAR === "1") writeFileSync(DOC, built);
  assert.ok(existsSync(DOC), "falta docs/comandos-de-voz.md: rode com ATUALIZAR=1");
  assert.equal(readFileSync(DOC, "utf8"), built, "docs/comandos-de-voz.md está velho: rode com ATUALIZAR=1 e confira o que mudou");
});
