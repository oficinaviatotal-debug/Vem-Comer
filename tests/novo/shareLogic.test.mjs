/**
 * Divulgar (o "Meu link"): o link, a mensagem pronta, os pratos que viram cartão e o que a tela mostra.
 * Roda no Node, sem navegador. O desenho do cartão tem o teste dele (shareCardDraw.test.mjs).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { createPhraser, plainPhraser } from "../../frontend/src/novo/phrasing.ts";
import { SHARE_BANKS, SHARE_SAY_CAPTION, SHARE_SAY_MESSAGE, SHARE_SAY_MESSAGE_NO_NAME } from "../../frontend/src/novo/shareCopy.ts";
import { PHRASES_REVIEWED } from "../../frontend/src/novo/voiceCopy.ts";
import { shareMessage } from "../../frontend/src/nav/navLogic.ts";
import { money } from "../../frontend/src/novo/format.ts";
import * as copy from "../../frontend/src/novo/copy.ts";
import {
  CARD_FORMATS,
  CARD_SIZES,
  DISH_PAGE,
  anotherCaption,
  anotherMessage,
  captionOf,
  cardFileName,
  cardSpec,
  dishChoices,
  linkForCard,
  messageOf,
  shareLink,
  shareViewOf,
  whatsappHref,
} from "../../frontend/src/painel/shareLogic.ts";

function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const URL_OF = "https://vem.example/?empresa=pastelaria-do-ze";
const resolve = (path) => path ?? "";
const text = (variant, args) => (typeof variant === "function" ? variant(...args) : variant);
const JARGON = /\b(dashboard|checkout|onboarding|template|upload|click here|app|login|loading|feedback)\b/i;
/** Nada que o sistema não sabe: preço de hoje, desconto, "o melhor", pressa. */
const PROMISES = /\b(hoje|agora|desconto|promo|promoção|grátis|gratis|melhor|única|último|últimas|corra|aproveite)\b/i;

// ---------------------------------------------------------------- o link

test("o link é só o do restaurante: nunca leva mesa nem painel", () => {
  const url = shareLink("https://vem.example", "/", "pastelaria-do-ze");
  assert.equal(url, URL_OF);
  const dirty = shareLink("https://vem.example", "/painel/", "x");
  assert.ok(!/mesa|painel=/.test(new URL(dirty).search));
  assert.equal(new URL(url).searchParams.get("empresa"), "pastelaria-do-ze");
});

test("no cartão o link vai sem https e sem barra sobrando", () => {
  assert.equal(linkForCard(URL_OF), "vem.example/?empresa=pastelaria-do-ze");
  assert.equal(linkForCard("http://vem.example/"), "vem.example");
});

// ---------------------------------------------------------------- a mensagem pronta

test("a primeira mensagem é a da tela antiga, palavra por palavra", () => {
  assert.equal(messageOf(plainPhraser, "Pastelaria do Zé", URL_OF), shareMessage("Pastelaria do Zé", URL_OF));
  assert.equal(messageOf(plainPhraser, "", URL_OF), shareMessage("", URL_OF));
  assert.equal(messageOf(plainPhraser, "  Pastelaria   do Zé ", URL_OF), shareMessage("Pastelaria do Zé", URL_OF), "espaços sobrando não vão para o cliente");
});

test("toda mensagem termina com o link, sozinho na última linha", () => {
  const phraser = createPhraser({ rand: seeded(7) });
  for (let i = 0; i < 30; i += 1) {
    for (const name of ["Pastelaria do Zé", ""]) {
      const lines = messageOf(phraser, name, URL_OF).split("\n");
      assert.equal(lines.length, 2);
      assert.equal(lines[1], URL_OF);
      assert.ok(lines[0].length > 10);
    }
  }
});

test("'Outra mensagem' nunca devolve a mesma que está na tela, e todas as formas passam", () => {
  const phraser = createPhraser({ rand: seeded(3) });
  let current = messageOf(plainPhraser, "Casa da Maria", URL_OF);
  const seen = new Set([current]);
  for (let i = 0; i < 60; i += 1) {
    const next = anotherMessage(phraser, "Casa da Maria", URL_OF, current);
    assert.notEqual(next, current);
    seen.add(next);
    current = next;
  }
  assert.equal(seen.size, SHARE_SAY_MESSAGE.full.length, "todas as formas apareceram");
});

test("sem nome cadastrado a mensagem não inventa nome nem fica com buraco", () => {
  const phraser = createPhraser({ rand: seeded(11) });
  for (let i = 0; i < 20; i += 1) {
    const first = messageOf(phraser, null, URL_OF).split("\n")[0];
    assert.ok(!/undefined|null|^:|\s:/.test(first), first);
    assert.ok(!/ de \.| em \./.test(first), first);
  }
});

test("as frases dos clientes são bem escritas e não prometem o que o sistema não sabe", () => {
  assert.ok(SHARE_BANKS.length >= 3);
  const ids = new Set();
  for (const { bank, samples } of SHARE_BANKS) {
    assert.ok(!ids.has(bank.id), `id repetido ${bank.id}`);
    ids.add(bank.id);
    assert.ok(bank.full.length >= 5, `${bank.id}: poucas formas para variar`);
    for (const sample of samples) {
      const lines = bank.full.map((variant) => text(variant, sample));
      assert.equal(new Set(lines.map((line) => line.toLowerCase())).size, lines.length, `${bank.id}: formas repetidas`);
      for (const line of lines) {
        const where = `${bank.id} ${JSON.stringify(sample)}: "${line}"`;
        assert.ok(line === line.trim() && !/ {2,}/.test(line), `espaço — ${where}`);
        assert.ok(/[.?…]$/.test(line), `não termina em ponto — ${where}`);
        assert.ok(/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ0-9]/.test(line), `não começa em maiúscula — ${where}`);
        assert.ok(!/!/.test(line), `grito — ${where}`);
        assert.ok(!JARGON.test(line), `palavra difícil — ${where}`);
        assert.ok(!PROMISES.test(line), `promessa que o sistema não sabe — ${where}`);
        assert.ok(!/undefined|NaN|null|\[object/.test(line), `dado faltando — ${where}`);
        assert.ok(!/\b(em|de) (o|a|os|as) /.test(line), `contração faltando — ${where}`);
        assert.ok(line.length <= 140, `comprida demais para uma mensagem — ${where}`);
      }
    }
  }
});

test("toda forma da mensagem com nome diz o nome, e a de referência é a da tela antiga", () => {
  for (const name of ["Padaria Boa Massa", "Casa da Maria"]) {
    for (const variant of SHARE_SAY_MESSAGE.full) assert.ok(text(variant, [name]).includes(name), text(variant, [name]));
    assert.equal(text(SHARE_SAY_MESSAGE.full[0], [name]) + "\n" + URL_OF, shareMessage(name, URL_OF));
  }
  assert.equal(SHARE_SAY_MESSAGE_NO_NAME.full[0] + "\n" + URL_OF, shareMessage("", URL_OF));
});

test("as frases têm data de revisão (a mesma das frases da voz)", () => {
  assert.match(PHRASES_REVIEWED, /^\d{4}-\d{2}-\d{2}$/);
});

test("o WhatsApp abre com o texto pronto e sem escolher ninguém", () => {
  const href = whatsappHref("Olá\nhttps://vem.example/?empresa=x&y=1");
  assert.ok(href.startsWith("https://wa.me/?text="));
  assert.ok(!/wa\.me\/\d/.test(href), "nenhum número de telefone");
  assert.equal(new URL(href).searchParams.get("text"), "Olá\nhttps://vem.example/?empresa=x&y=1");
});

// ---------------------------------------------------------------- os pratos que viram cartão

const product = (id, name, price, over = {}) => ({ id, menu_id: "m", name, price, ...over });

test("só vira cartão o prato que o cliente pode pedir: disponível, com nome e preço", () => {
  const list = [
    product("a", "Pastel de carne", "9.00"),
    product("b", "Esfiha", "6.00", { sold_out: true }),
    product("c", "  ", "5.00"),
    product("d", "Brinde", "0"),
    product("e", "Sem preço", ""),
    product("f", "Preço torto", "abc"),
    product("g", "Caldo de cana", 7),
    product("h", "Suco", "9,50"),
    product("i", "Negativo", "-3"),
  ];
  assert.deepEqual(
    dishChoices(list, resolve).map((dish) => [dish.id, dish.price]),
    [["a", 9], ["g", 7], ["h", 9.5]],
  );
});

test("os pratos com foto vêm primeiro, cada grupo na ordem do cardápio", () => {
  const list = [
    product("1", "Sem foto 1", "5"),
    product("2", "Com foto A", "5", { image_url: "/a.webp" }),
    product("3", "Sem foto 2", "5"),
    product("4", "Só miniatura", "5", { thumb_url: "/t.webp" }),
    product("5", "Com foto B", "5", { image_url: "/b.webp", thumb_url: "/bt.webp" }),
  ];
  const got = dishChoices(list, resolve);
  assert.deepEqual(got.map((dish) => dish.id), ["2", "4", "5", "1", "3"]);
  assert.equal(got.find((dish) => dish.id === "5").photo, "/b.webp", "a foto inteira vale mais que a miniatura");
  assert.equal(got.find((dish) => dish.id === "1").photo, null);
});

test("foto que o endereço não aceita some em vez de quebrar o cartão", () => {
  const got = dishChoices([product("1", "Prato", "5", { image_url: "/x.png" })], () => "");
  assert.equal(got[0].photo, null);
});

// ---------------------------------------------------------------- o texto que vai com o cartão

test("o texto do cartão diz o prato e o preço do cadastro, e termina no link", () => {
  const phraser = createPhraser({ rand: seeded(5) });
  for (let i = 0; i < 25; i += 1) {
    const caption = captionOf(phraser, "Pastel de carne", 9, URL_OF);
    const lines = caption.split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], URL_OF);
    assert.ok(lines[0].includes("Pastel de carne"));
    assert.match(lines[0], /R\$\s9,00/);
  }
  assert.equal(
    captionOf(plainPhraser, "Açaí", 18.5, URL_OF),
    `${text(SHARE_SAY_CAPTION.full[0], ["Açaí", money(18.5)])}\n${URL_OF}`,
  );
});

test("'Outro texto' não repete e mantém prato e preço", () => {
  const phraser = createPhraser({ rand: seeded(9) });
  let current = captionOf(plainPhraser, "Pastel de carne", 9, URL_OF);
  for (let i = 0; i < 40; i += 1) {
    const next = anotherCaption(phraser, "Pastel de carne", 9, URL_OF, current);
    assert.notEqual(next, current);
    assert.ok(next.includes("Pastel de carne") && /9,00/.test(next));
    current = next;
  }
});

// ---------------------------------------------------------------- o cartão

test("os dois tamanhos são o do feed (4:5) e o do status (9:16)", () => {
  assert.deepEqual([...CARD_FORMATS], ["feed", "status"]);
  assert.ok(Math.abs(CARD_SIZES.feed.width / CARD_SIZES.feed.height - 4 / 5) < 0.001);
  assert.ok(Math.abs(CARD_SIZES.status.width / CARD_SIZES.status.height - 9 / 16) < 0.001);
  assert.equal(CARD_SIZES.feed.width, 1080);
  assert.equal(CARD_SIZES.status.width, 1080);
});

test("o desenho do cartão recebe só o que precisa, com os nomes cortados em vez de estourar", () => {
  const dish = { id: "x", name: "  Pastel de frango   com catupiry e azeitonas pretas e um tanto mais de nome para cortar  ", price: 14.5, photo: "/f.webp" };
  const spec = cardSpec({ format: "status", restaurant: "Restaurante e Pizzaria do Zé da Esquina de Todos os Sabores do Mundo Inteiro", dish, url: URL_OF, brand: true });
  assert.equal(spec.width, 1080);
  assert.equal(spec.height, 1920);
  assert.ok(spec.restaurant.length <= 40 && spec.restaurant.endsWith("…"));
  assert.ok(spec.dish.length <= 60 && spec.dish.endsWith("…"));
  assert.ok(!/ {2,}/.test(spec.dish));
  assert.match(spec.priceText, /14,50/);
  assert.equal(spec.linkText, "vem.example/?empresa=pastelaria-do-ze");
  assert.equal(spec.photo, "/f.webp");
  assert.equal(spec.brand, true);
  assert.deepEqual(Object.keys(spec).sort(), ["brand", "dish", "format", "height", "linkText", "photo", "priceText", "restaurant", "width"]);
});

test("o nome do arquivo é seguro em qualquer celular", () => {
  assert.equal(cardFileName("Pastel de carne", "feed"), "cartao-pastel-de-carne-feed.png");
  assert.equal(cardFileName("Açaí de 500 ml!", "status"), "cartao-acai-de-500-ml-status.png");
  assert.equal(cardFileName("***", "feed"), "cartao-feed.png");
  assert.equal(cardFileName("", "status"), "cartao-status.png");
  const long = cardFileName("Pastel de frango com catupiry e azeitonas pretas e muito mais nome", "feed");
  assert.ok(long.length <= 60 && /^[a-z0-9.-]+$/.test(long) && !long.includes("--"));
});

// ---------------------------------------------------------------- o que a tela mostra

const dishes = dishChoices(
  [product("1", "Pastel de carne", "9.00", { image_url: "/a.webp" }), product("2", "Pastel de queijo", "8.50"), product("3", "Caldo de cana", "7")],
  resolve,
);

const base = {
  person: "João Silva, dono",
  name: "Pastelaria do Zé",
  link: URL_OF,
  message: shareMessage("Pastelaria do Zé", URL_OF),
  load: "ready",
  error: "",
  dishes,
  totalProducts: 3,
  showAll: false,
  selectedId: null,
  format: "feed",
  brand: true,
  caption: "",
  image: null,
  busy: false,
  cardError: "",
  canSendFile: true,
  copied: null,
  manual: null,
  live: "",
};

test("a tela mostra o link e a mensagem mesmo antes de os pratos chegarem", () => {
  for (const load of ["loading", "error"]) {
    const view = shareViewOf({ ...base, load, error: "Falhou." });
    assert.equal(view.link, URL_OF);
    assert.equal(view.openHref, URL_OF);
    assert.equal(view.message, base.message);
    assert.ok(view.messageHref.startsWith("https://wa.me/?text="));
    assert.deepEqual(view.dishes, []);
    assert.equal(view.card, null);
    assert.equal(view.dishesHint, "");
    assert.equal(view.error, load === "error" ? "Falhou." : "");
  }
});

test("sem pratos cadastrados a tela manda cadastrar; com tudo esgotado, diz que nenhum está disponível", () => {
  const none = shareViewOf({ ...base, dishes: [], totalProducts: 0 });
  assert.equal(none.dishesHint, copy.SHARE_DISHES_EMPTY);
  const soldOut = shareViewOf({ ...base, dishes: [], totalProducts: 4 });
  assert.equal(soldOut.dishesHint, copy.SHARE_DISHES_NONE_NOW);
  assert.notEqual(none.dishesHint, soldOut.dishesHint);
  assert.equal(shareViewOf(base).dishesHint, "");
});

test("cada prato diz o nome, o preço e o que o leitor de tela lê", () => {
  const view = shareViewOf({ ...base, selectedId: "2" });
  assert.deepEqual(view.dishes.map((dish) => dish.name), ["Pastel de carne", "Pastel de queijo", "Caldo de cana"]);
  const queijo = view.dishes[1];
  assert.equal(queijo.selected, true);
  assert.equal(view.dishes.filter((dish) => dish.selected).length, 1);
  assert.match(queijo.priceText, /8,50/);
  assert.match(queijo.label, /^Fazer o cartão de Pastel de queijo, R\$\s8,50$/);
  assert.equal(view.dishes[0].photo, "/a.webp");
});

test("a lista começa curta e 'Ver mais' mostra o resto", () => {
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `d${i}`, name: `Prato ${i}`, price: 5 + i, photo: null }));
  const short = shareViewOf({ ...base, dishes: many, totalProducts: 13 });
  assert.equal(short.dishes.length, DISH_PAGE);
  assert.equal(short.hiddenDishes, 13 - DISH_PAGE);
  const all = shareViewOf({ ...base, dishes: many, totalProducts: 13, showAll: true });
  assert.equal(all.dishes.length, 13);
  assert.equal(all.hiddenDishes, 0);
  assert.equal(copy.SHARE_DISHES_MORE(1), "Ver mais 1 prato");
  assert.equal(copy.SHARE_DISHES_MORE(5), "Ver mais 5 pratos");
  assert.equal(shareViewOf(base).hiddenDishes, 0);
});

test("o cartão só aparece com um prato escolhido, e diz o tamanho e o que a imagem mostra", () => {
  assert.equal(shareViewOf(base).card, null);
  assert.equal(shareViewOf({ ...base, selectedId: "nao-existe" }).card, null);
  const caption = captionOf(plainPhraser, "Pastel de queijo", 8.5, URL_OF);
  const view = shareViewOf({ ...base, selectedId: "2", format: "status", caption, image: "blob:x", canSendFile: false });
  const card = view.card;
  assert.ok(card);
  assert.equal(card.dishName, "Pastel de queijo");
  assert.equal(card.image, "blob:x");
  assert.equal(card.canSendFile, false);
  assert.equal(card.caption, caption);
  assert.ok(card.captionHref.startsWith("https://wa.me/?text="));
  assert.deepEqual(card.formats.map((format) => [format.id, format.selected]), [["feed", false], ["status", true]]);
  assert.match(card.alt, /Cartão de Pastel de queijo, R\$\s8,50, no tamanho Status/);
  for (const format of card.formats) assert.ok(format.hint.length > 10);
});

test("o que foi copiado, o texto para copiar à mão e a frase do leitor de tela passam direto", () => {
  const manual = { id: "link", text: URL_OF };
  const view = shareViewOf({ ...base, copied: "message", manual, live: "Mensagem copiada." });
  assert.equal(view.copied, "message");
  assert.deepEqual(view.manual, manual);
  assert.equal(view.live, "Mensagem copiada.");
  assert.equal(view.sub, "João Silva, dono");
});

test("os textos da tela Divulgar não têm palavra difícil nem de informática", () => {
  const JARGON_UI = /\b(dashboard|checkout|onboarding|template|upload|click here)\b/i;
  const strings = Object.entries(copy)
    .filter(([key]) => key.startsWith("SHARE_"))
    .flatMap(([, value]) => (typeof value === "string" ? [value] : typeof value === "function" ? [value(1), value("Pastel de carne")] : []));
  assert.ok(strings.length > 40);
  for (const line of strings) {
    assert.ok(!JARGON_UI.test(line), line);
    assert.ok(!/undefined|NaN|\[object/.test(line), line);
  }
});
