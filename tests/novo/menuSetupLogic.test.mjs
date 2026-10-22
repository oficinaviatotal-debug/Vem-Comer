import test from "node:test";
import assert from "node:assert/strict";

import { importPayload, selectedItems, startFromParsed, startSpeak } from "../../frontend/src/assistant/assistantFlow.ts";
import {
  addUnclear,
  applyEdit,
  changeName,
  changePrice,
  dishId,
  doneViewOf,
  doorViewOf,
  isDeviceImage,
  nameOf,
  noticeOf,
  pagesViewOf,
  parseDishId,
  priceOf,
  priceIsUsable,
  readFailureText,
  readingViewOf,
  reviewViewOf,
  saveCounts,
  saveResultOf,
  speakViewOf,
  takeOut,
  takeSpoken,
  useGuess,
  whenNotHeard,
} from "../../frontend/src/painel/menuSetupLogic.ts";

/** O dinheiro sai com espaço que não quebra linha ("R$ 25,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/ /g, " ");

const ALL = { photo: true, file: true, pdf: true };
const NONE = { photo: false, file: false, pdf: false };

/** Um cardápio como o servidor o lê: um prato sem preço, um com cara de engano de escuta ("300" no lugar de "3,00"). */
const read = () =>
  startFromParsed({
    readable: true,
    notes: "",
    categories: [
      {
        name: "Lanches",
        items: [
          { name: "X-tudo", price: "25.00" },
          { name: "X-salada", price: "22.00" },
          { name: "X-bacon", price: "" },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Coca-Cola lata", price: "300" },
          { name: "Água mineral", price: "4.00" },
        ],
      },
    ],
  });

const say = (flow, text, heading = "") => takeSpoken(flow, text, heading);

// ------------------------------------------------------------------------------------------------ a porta

test("antes de o servidor responder não há cartão nenhum: a ordem só se decide quando se sabe o que cada um faz", () => {
  const view = doorViewOf({ options: null, voiceWorks: true, error: "" });
  assert.equal(view.stage, "door");
  assert.equal(view.loading, true);
  assert.deepEqual(view.cards, []);
  assert.equal(view.sub, "Vendo o que este servidor lê…");
  assert.equal(view.foot, "", "nada de rodapé antes de haver o que escolher");
});

test("com tudo ligado: tirar foto (mais rápido), foto do celular, falar, escrever, arquivo e modelo, nessa ordem, todos tocáveis", () => {
  const view = doorViewOf({ options: ALL, voiceWorks: true, error: "" });
  assert.equal(view.loading, false);
  assert.deepEqual(
    view.cards.map((card) => [card.id, card.state]),
    [
      ["photo", "ready"],
      ["gallery", "ready"],
      ["speak", "ready"],
      ["write", "ready"],
      ["file", "ready"],
      ["model", "ready"],
    ],
  );
  const card = (id) => view.cards.find((entry) => entry.id === id);
  assert.equal(card("photo").title, "Tirar foto do cardápio");
  assert.equal(card("gallery").title, "Escolher foto do celular");
  assert.equal(card("speak").title, "Falar os pratos");
  assert.equal(card("write").title, "Escrever os pratos");
  assert.equal(card("model").title, "Começar de um modelo");
  assert.equal(card("model").hint, "Escolha o tipo do seu negócio e toque nos pratos que você vende.");
  assert.equal(card("photo").badge, "Mais rápido");
  assert.equal(card("gallery").badge, "", "só a câmera leva o selo");
  assert.equal(card("photo").accept, "image/*");
  assert.equal(card("gallery").accept, "image/*");
  assert.ok(card("file").accept.includes(".pdf"), "com PDF ligado o seletor aceita PDF");
  assert.equal(card("photo").hint, "Abre a câmera. Eu leio os pratos, o que vai dentro e os preços.");
  assert.equal(card("speak").hint, "Diga o prato, o preço e o que vai dentro. Eu anoto.");
  assert.equal(card("write").hint, "Escreva do seu jeito, por exemplo: X-tudo 25, tem ovo e bacon.");
  assert.equal(view.sub, "Como você quer montar?");
  assert.ok(view.foot.includes("confere tudo antes de cadastrar"));
});

test("sem PDF no servidor o seletor de arquivo não oferece PDF", () => {
  const view = doorViewOf({ options: { photo: true, file: true, pdf: false }, voiceWorks: true, error: "" });
  assert.ok(!view.cards.find((card) => card.id === "file").accept.includes(".pdf"));
});

test("o que o servidor não lê vem depois, liso, com a frase do porquê; escrever os pratos e o modelo sempre funcionam", () => {
  const view = doorViewOf({ options: NONE, voiceWorks: false, error: "" });
  assert.deepEqual(
    view.cards.map((card) => [card.id, card.state]),
    [
      ["write", "ready"],
      ["model", "ready"],
      ["photo", "off"],
      ["file", "off"],
    ],
  );
  assert.ok(!view.cards.some((card) => card.id === "speak"), "sem microfone não há cartão de falar: escrever está sempre lá");
  assert.ok(!view.cards.some((card) => card.id === "gallery"), "a foto do celular só aparece se o servidor lê foto");
  assert.equal(view.cards[2].badge, "", "só o que funciona leva o 'mais rápido'");
  assert.ok(view.cards[2].hint.length > 0 && view.cards[3].hint.length > 0);
});

test("com microfone mas sem leitura de foto: falar e escrever, os dois, e a câmera apagada explica o porquê", () => {
  const view = doorViewOf({ options: { photo: false, file: true, pdf: false }, voiceWorks: true, error: "" });
  assert.deepEqual(
    view.cards.map((card) => [card.id, card.state]),
    [
      ["speak", "ready"],
      ["write", "ready"],
      ["file", "ready"],
      ["model", "ready"],
      ["photo", "off"],
    ],
  );
  const photo = view.cards.find((card) => card.id === "photo");
  assert.match(photo.hint, /Ainda não está ligado/);
});

test("o erro da porta passa como veio", () => {
  assert.equal(doorViewOf({ options: ALL, voiceWorks: true, error: "Esse arquivo está vazio." }).error, "Esse arquivo está vazio.");
});

// ------------------------------------------------------------------------------------------------ as páginas

test("só a foto que está neste aparelho (blob:) vira miniatura; endereço de fora nunca vira imagem", () => {
  assert.equal(isDeviceImage("blob:http://localhost/abc"), true);
  for (const bad of ["http://evil.test/x.png", "https://x/y", "data:image/png;base64,AAAA", "javascript:alert(1)", "", null, undefined, 3]) {
    assert.equal(isDeviceImage(bad), false, String(bad));
  }
  const view = pagesViewOf({
    pages: [
      { id: 1, url: "blob:a" },
      { id: 2, url: "https://evil.test/a.png" },
      { id: 3, url: "blob:c" },
    ],
    busy: false,
    photoEnabled: true,
    room: 2,
    failed: false,
    message: "",
  });
  assert.equal(view.stage, "pages");
  assert.deepEqual(view.pages.map((page) => [page.id, page.src, page.label]), [
    [1, "blob:a", "Página 1 do cardápio"],
    [3, "blob:c", "Página 2 do cardápio"],
  ]);
  assert.equal(view.sub, "2 páginas");
});

test("a frase de cima: sem página pede as páginas, com uma diz uma página", () => {
  const none = pagesViewOf({ pages: [], busy: false, photoEnabled: true, room: 4, failed: false, message: "" });
  assert.equal(none.sub, "Páginas do cardápio");
  assert.equal(none.canRead, false, "sem página não há o que ler");
  const one = pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: false, photoEnabled: true, room: 3, failed: false, message: "" });
  assert.equal(one.sub, "1 página");
  assert.equal(one.canRead, true);
});

test("preparando a foto não se lê nem se mexe; sem lugar (4 páginas) ou sem leitor de foto não se acrescenta", () => {
  const busy = pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: true, photoEnabled: true, room: 3, failed: false, message: "" });
  assert.equal(busy.canRead, false);
  assert.equal(busy.busy, true);
  const full = pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: false, photoEnabled: true, room: 0, failed: false, message: "" });
  assert.equal(full.canAdd, false);
  assert.equal(full.canRead, true);
  const off = pagesViewOf({ pages: [], busy: false, photoEnabled: false, room: 4, failed: false, message: "" });
  assert.equal(off.canAdd, false);
});

test("depois de uma leitura que falhou o botão diz 'Tentar de novo', e a mensagem passa como veio", () => {
  const view = pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: false, photoEnabled: true, room: 3, failed: true, message: "A leitura demorou demais." });
  assert.equal(view.readLabel, "Tentar de novo");
  assert.equal(view.message, "A leitura demorou demais.");
  assert.equal(pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: false, photoEnabled: true, room: 3, failed: false, message: "" }).readLabel, "Ler o cardápio");
});

test("lendo: a frase diz que pode levar até 1 minuto", () => {
  const view = readingViewOf();
  assert.equal(view.stage, "reading");
  assert.equal(view.text, "Lendo o cardápio… pode levar até 1 minuto.");
});

// ------------------------------------------------------------------------------------------------ o número do prato

test("o número do prato é 'categoria-posição' e só esse formato é aceito de volta", () => {
  assert.equal(dishId(2, 5), "2-5");
  assert.deepEqual(parseDishId("2-5"), { categoryIndex: 2, itemIndex: 5 });
  assert.deepEqual(parseDishId("0-0"), { categoryIndex: 0, itemIndex: 0 });
  for (const bad of ["", "2", "a-b", "2-5-1", "-1-2", "2--1", "1e3-1", " 2-5", "2-5 ", 7, null, undefined, "9999-1", "1-99999"]) {
    assert.equal(parseDishId(bad), null, JSON.stringify(bad));
  }
});

// ------------------------------------------------------------------------------------------------ falar

test("a frase curta depois de cada fala: um prato com preço, um sem, vários, preço solto", () => {
  assert.equal(n(noticeOf({ added: [{ name: "X-tudo", price: "25.00" }], priced: [] })), "Anotei X-tudo, R$ 25,00.");
  assert.equal(noticeOf({ added: [{ name: "Água", price: "" }], priced: [] }), "Anotei Água. Falta o preço.");
  assert.equal(
    noticeOf({
      added: [
        { name: "A", price: "1.00" },
        { name: "B", price: "" },
        { name: "C", price: "" },
      ],
      priced: [],
    }),
    "Anotei 3 pratos. 2 ficaram sem preço.",
  );
  assert.equal(noticeOf({ added: [{ name: "A", price: "1.00" }, { name: "B", price: "" }], priced: [] }), "Anotei 2 pratos. 1 ficou sem preço.");
  assert.equal(n(noticeOf({ added: [], priced: [{ name: "Água", price: "4.00" }] })), "Água, R$ 4,00.");
  assert.equal(
    n(noticeOf({ added: [], priced: [{ name: "A", price: "1" }, { name: "B", price: "2" }, { name: "C", price: "3" }, { name: "D", price: "4" }] })),
    "A, R$ 1,00. B, R$ 2,00. E mais 2 preços.",
  );
  assert.equal(noticeOf({ added: [], priced: [] }), "");
});

test("falar 'x-tudo 25, x-salada 22' anota dois pratos, em Lanches, com preço, e a tela mostra assim", () => {
  const out = say(startSpeak(), "x-tudo 25, x-salada 22");
  assert.equal(out.notice, "Anotei 2 pratos.");
  assert.equal(out.finished, false);
  const view = speakViewOf({ flow: out.flow, listening: false, canListen: true, heard: "", notice: out.notice, unclear: out.unclear });
  assert.equal(view.stage, "speak");
  assert.equal(view.count, 2);
  assert.equal(view.sub, "2 pratos anotados");
  assert.equal(view.finish, "Pronto, conferir (2)");
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0].name, "Lanches");
  assert.deepEqual(view.groups[0].dishes.map((dish) => [dish.id, dish.name, n(dish.price), dish.missing]), [
    ["0-0", "X-Tudo", "R$ 25,00", false],
    ["0-1", "X-Salada", "R$ 22,00", false],
  ]);
});

test("o título dito ('bebidas…') vale para as falas seguintes", () => {
  let flow = startSpeak();
  let heading = "";
  let out = say(flow, "bebidas coca lata 6, suco de laranja", heading);
  assert.equal(out.heading, "Bebidas");
  assert.equal(out.notice, "Anotei 2 pratos. 1 ficou sem preço.");
  flow = out.flow;
  heading = out.heading;
  out = say(flow, "água", heading);
  assert.equal(out.notice, "Anotei Água. Falta o preço.");
  const names = selectedItems(out.flow).map((dish) => `${dish.categoryName}/${dish.name}`);
  assert.deepEqual(names, ["Bebidas/Coca lata", "Bebidas/Suco de laranja", "Bebidas/Água"]);
});

test("'tira x-salada' tira o prato; o que não está na lista diz que não achou", () => {
  let out = say(startSpeak(), "x-tudo 25, x-salada 22");
  out = say(out.flow, "tira x-salada", out.heading);
  assert.equal(out.notice, "Tirei X-Salada.");
  assert.deepEqual(selectedItems(out.flow).map((dish) => dish.name), ["X-Tudo"]);
  const missing = say(out.flow, "tira pizza", out.heading);
  assert.match(missing.notice, /^Não achei .* na lista\.$/);
  assert.deepEqual(selectedItems(missing.flow).map((dish) => dish.name), ["X-Tudo"], "nada mudou");
});

test("'pronto' (e 'só isso', 'cadastrar') termina; um prato dito junto entra antes", () => {
  const start = say(startSpeak(), "x-tudo 25").flow;
  for (const words of ["pronto", "só isso", "cadastrar", "pode cadastrar"]) {
    const out = say(start, words);
    assert.equal(out.finished, true, words);
    assert.equal(out.notice, "", words);
  }
  const both = say(startSpeak(), "x-tudo 25 pronto");
  assert.equal(both.finished, true);
  assert.deepEqual(selectedItems(both.flow).map((dish) => dish.name), ["X-Tudo"], "o prato dito junto entrou");
});

test("'x-tudo' é prato, não o comando 'tudo'", () => {
  const out = say(startSpeak(), "x-tudo 25");
  assert.equal(out.finished, false);
  assert.equal(selectedItems(out.flow).length, 1);
});

test("quando nada se entende a tela diz o que falar, sem inventar prato", () => {
  const out = say(startSpeak(), "");
  assert.equal(out.finished, false);
  assert.equal(selectedItems(out.flow).length, 0);
  assert.ok(out.notice.startsWith("Não peguei o prato."));
});

test("a frase ouvida que a tela mostra enquanto fala, e o aviso, passam como vieram; sem prato não há botão de conferir", () => {
  const view = speakViewOf({ flow: startSpeak(), listening: true, canListen: true, heard: "coca lata seis", notice: "", unclear: ["x y z"] });
  assert.equal(view.listening, true);
  assert.equal(view.heard, "coca lata seis");
  assert.equal(view.count, 0);
  assert.equal(view.finish, "", "sem prato anotado não se segue");
  assert.equal(view.sub, "Diga os pratos com o preço");
  assert.deepEqual(view.unclear, ["x y z"]);
  assert.equal(speakViewOf({ flow: startSpeak(), listening: false, canListen: false, heard: "", notice: "", unclear: [] }).canListen, false);
});

test("o prato sem preço aparece como faltando, nunca com 'R$ 0,00'", () => {
  const out = say(startSpeak(), "água");
  const view = speakViewOf({ flow: out.flow, listening: false, canListen: true, heard: "", notice: "", unclear: [] });
  const dish = view.groups[0].dishes[0];
  assert.equal(dish.missing, true);
  assert.equal(dish.price, "");
  assert.ok(!/0,00/.test(JSON.stringify(view)));
});

test("um trecho que não se separou entra como um prato só, sem preço, e não duplica", () => {
  const flow = addUnclear(startSpeak(), "  sorvete de morango com calda  ", "Sobremesas");
  const dishes = selectedItems(flow);
  assert.equal(dishes.length, 1);
  assert.equal(dishes[0].price, "");
  assert.equal(dishes[0].name, "Sorvete de morango com calda");
  assert.equal(selectedItems(addUnclear(flow, "sorvete de morango com calda", "Sobremesas")).length, 1, "o mesmo trecho não entra duas vezes");
  const same = startSpeak();
  assert.equal(addUnclear(same, "  ", ""), same, "texto vazio devolve o mesmo estado");
});

// ------------------------------------------------------------------------------------------------ conferir

test("a conferência separa no alto os pratos sem preço, e mostra o resto por categoria, com o preço em frase", () => {
  const view = reviewViewOf({ flow: read(), editing: null, error: "" });
  assert.equal(view.stage, "review");
  assert.deepEqual(view.missing.map((dish) => [dish.id, dish.name, dish.missing, dish.price]), [["0-2", "X-bacon", true, ""]]);
  assert.deepEqual(view.groups.map((group) => group.name), ["Lanches", "Bebidas"]);
  assert.deepEqual(view.groups[0].dishes.map((dish) => [dish.name, n(dish.price), dish.priceValue]), [
    ["X-tudo", "R$ 25,00", "25,00"],
    ["X-salada", "R$ 22,00", "22,00"],
  ]);
  assert.equal(view.sub, "5 pratos em 2 categorias");
  assert.equal(view.intro, "Li o seu cardápio. Corrija o que precisar e cadastre.");
  assert.equal(view.editing, null);
});

test("só entra no cadastro o que tem preço, e a tela diz quantos ficam de fora", () => {
  const flow = read();
  assert.deepEqual(saveCounts(flow), { saved: 4, missing: 1 });
  const view = reviewViewOf({ flow, editing: null, error: "" });
  assert.equal(view.saveLabel, "Cadastrar 4 pratos");
  assert.equal(view.saveNote, "1 prato sem preço não entra.");
  assert.equal(view.canSave, true);
  const sent = importPayload(flow).categories.flatMap((category) => category.items.map((item) => item.name));
  assert.ok(!sent.includes("X-bacon"), "o prato sem preço não vai ao servidor");
  assert.equal(sent.length, 4);
});

test("um prato só: 'Cadastrar 1 prato'; todos sem preço: não há o que cadastrar e a tela diz por quê", () => {
  const one = takeOutAllBut(read(), ["0-0"]);
  assert.equal(reviewViewOf({ flow: one, editing: null, error: "" }).saveLabel, "Cadastrar 1 prato");
  const nothing = startFromParsed({ readable: true, notes: "", categories: [{ name: "Lanches", items: [{ name: "X-tudo", price: "" }, { name: "X-salada", price: "" }] }] });
  const view = reviewViewOf({ flow: nothing, editing: null, error: "" });
  assert.equal(view.canSave, false);
  assert.equal(view.saveLabel, "");
  assert.equal(view.saveNote, "2 pratos sem preço não entram.");
  assert.equal(view.missing.length, 2);
});

/** Tira todos os pratos menos os de `keep`, como a pessoa tocando em Tirar. */
function takeOutAllBut(flow, keep) {
  let next = flow;
  flow.categories.forEach((category, ci) => category.items.forEach((_, ii) => {
    const id = dishId(ci, ii);
    if (!keep.includes(id)) next = takeOut(next, id);
  }));
  return next;
}

test("tirar todos os pratos: a conferência fica vazia, sem botão de cadastrar e sem nota", () => {
  const empty = takeOutAllBut(read(), []);
  const view = reviewViewOf({ flow: empty, editing: null, error: "" });
  assert.deepEqual(view.missing, []);
  assert.deepEqual(view.groups, []);
  assert.equal(view.canSave, false);
  assert.equal(view.saveNote, "");
  assert.equal(view.sub, "Conferir o cardápio");
});

test("preço que parece engano de escuta é apontado com o palpite, e nunca trocado sozinho", () => {
  const flow = read();
  const view = reviewViewOf({ flow, editing: null, error: "" });
  const coca = view.groups[1].dishes[0];
  assert.equal(coca.name, "Coca-Cola lata");
  assert.equal(n(coca.price), "R$ 300,00", "o preço continua o que veio");
  assert.equal(n(coca.doubt.text), "Confira: R$ 300,00. Será que é R$ 3,00?");
  assert.equal(coca.doubt.use, "3.00");
  assert.equal(view.groups[1].dishes[1].doubt, null, "um preço normal não leva aviso");
  assert.equal(priceOf(flow, coca.id), "300.00", "só mostrar não muda nada");
});

test("'Usar R$ 3,00' troca o preço pelo palpite; sem palpite não muda nada", () => {
  const flow = read();
  const fixed = useGuess(flow, "1-0");
  assert.equal(priceOf(fixed, "1-0"), "3.00");
  assert.equal(reviewViewOf({ flow: fixed, editing: null, error: "" }).groups[1].dishes[0].doubt, null, "depois de usar o aviso some");
  assert.equal(useGuess(flow, "0-0"), flow, "o X-tudo a 25 não tem palpite");
  assert.equal(useGuess(flow, "zzz"), flow);
  const high = startFromParsed({ readable: true, notes: "", categories: [{ name: "Bebidas", items: [{ name: "Suco de laranja", price: "150" }] }] });
  const doubt = reviewViewOf({ flow: high, editing: null, error: "" }).groups[0].dishes[0].doubt;
  assert.equal(n(doubt.text), "Confira: R$ 150,00 parece alto para este prato.");
  assert.equal(doubt.use, "", "sem palpite não há botão de usar");
  assert.equal(useGuess(high, "0-0"), high);
});

test("a conferência de quem falou usa a frase de quem falou", () => {
  const spoken = say(startSpeak(), "x-tudo 25").flow;
  assert.equal(reviewViewOf({ flow: spoken, editing: null, error: "" }).intro, "Confira o que você falou. Corrija o que precisar e cadastre.");
});

test("o prato aberto para mudar e o erro passam como vieram", () => {
  const view = reviewViewOf({ flow: read(), editing: "0-1", error: "Não entendi esse preço." });
  assert.equal(view.editing, "0-1");
  assert.equal(view.error, "Não entendi esse preço.");
});

// ------------------------------------------------------------------------------------------------ mudar um prato

test("preço escrito do jeito de cada um: vírgula, ponto, 'R$'", () => {
  for (const ok of ["18,50", "18.5", "R$ 18", "18", " 7 "]) assert.equal(priceIsUsable(ok), true, ok);
  for (const bad of ["abc", "0", "", "-5", "R$"]) assert.equal(priceIsUsable(bad), false, JSON.stringify(bad));
});

test("'Pronto' com preço novo muda o preço; com o campo de preço vazio deixa como está", () => {
  const flow = read();
  const fixed = applyEdit(flow, "0-2", "X-bacon", "27,50");
  assert.equal(fixed.problem, "");
  assert.equal(priceOf(fixed.flow, "0-2"), "27.50");
  const kept = applyEdit(flow, "0-0", "X-tudo", "");
  assert.equal(kept.problem, "");
  assert.equal(priceOf(kept.flow, "0-0"), "25.00");
});

test("preço que não é número: não muda nada e o problema é o preço", () => {
  const flow = read();
  const out = applyEdit(flow, "0-0", "X-tudo", "vinte");
  assert.equal(out.problem, "price");
  assert.equal(out.flow, flow);
  assert.equal(applyEdit(flow, "0-0", "X-tudo", "0").problem, "price");
});

test("nome novo muda o nome; vazio, ou igual a outro da mesma categoria, é recusado", () => {
  const flow = read();
  const renamed = applyEdit(flow, "0-0", "X-tudo especial", "");
  assert.equal(renamed.problem, "");
  assert.equal(nameOf(renamed.flow, "0-0"), "X-tudo especial");
  assert.equal(applyEdit(flow, "0-0", "   ", "").problem, "name");
  const dup = applyEdit(flow, "0-0", "x-salada", "");
  assert.equal(dup.problem, "name");
  assert.equal(dup.flow, flow);
  assert.equal(nameOf(flow, "0-0"), "X-tudo", "nada mudou");
});

test("tocar em Pronto sem mexer em nada, ou só com espaço de sobra, não é erro", () => {
  const flow = read();
  assert.equal(applyEdit(flow, "0-0", "X-tudo", "25,00").problem, "");
  assert.equal(applyEdit(flow, "0-0", "  X-tudo  ", "").problem, "");
  assert.equal(applyEdit(flow, "0-0", "X-tudo.", "").problem, "", "o ponto final sobrando é limpo, não vira erro");
});

test("nome e preço juntos: se o preço é recusado o nome também não muda", () => {
  const flow = read();
  const out = applyEdit(flow, "0-0", "Outro nome", "xx");
  assert.equal(out.problem, "price");
  assert.equal(nameOf(out.flow, "0-0"), "X-tudo");
});

test("um número de prato que não existe não muda nada", () => {
  const flow = read();
  assert.equal(applyEdit(flow, "9-9", "A", "1").flow, flow);
  assert.equal(applyEdit(flow, "lixo", "A", "1").problem, "");
  assert.equal(changeName(flow, "lixo", "A"), flow);
  assert.equal(changePrice(flow, "lixo", "1"), flow);
  assert.equal(takeOut(flow, "lixo"), flow);
  assert.equal(priceOf(flow, "9-9"), "");
  assert.equal(nameOf(flow, "9-9"), "");
});

test("tirar um prato o tira da conferência e do cadastro", () => {
  const gone = takeOut(read(), "0-1");
  const view = reviewViewOf({ flow: gone, editing: null, error: "" });
  assert.ok(!JSON.stringify(view).includes("X-salada"));
  assert.ok(!JSON.stringify(importPayload(gone)).includes("X-salada"));
});

// ------------------------------------------------------------------------------------------------ frases e o que o servidor devolve

test("a leitura que passou do tempo diz que demorou; outra falha usa a frase de sempre", () => {
  const aborted = new Error("The operation was aborted");
  aborted.name = "AbortError";
  assert.equal(readFailureText(aborted), "A leitura demorou demais. Tente de novo, ou fale os pratos.");
  assert.equal(readFailureText(new Error("O arquivo é grande demais.")), "O arquivo é grande demais.");
  assert.match(readFailureText(new TypeError("Failed to fetch")), /internet/);
  assert.match(readFailureText(undefined), /internet/);
});

test("ninguém falou: na primeira vez pede de novo, na segunda ajuda a achar o microfone", () => {
  assert.equal(whenNotHeard(1), "Não ouvi nada. Toque em Falar e diga de novo.");
  assert.match(whenNotHeard(2), /microfone está liberado/);
  assert.match(whenNotHeard(5), /microfone está liberado/);
});

test("o que o servidor devolve ao cadastrar: só números valem, o resto vira 'não sei'", () => {
  assert.deepEqual(saveResultOf({ menus_created: 1, menus_reused: 0, products_created: 8, products_skipped: 1 }), { products_created: 8, products_skipped: 1 });
  assert.deepEqual(saveResultOf({ products_created: 3 }), { products_created: 3, products_skipped: 0 });
  assert.deepEqual(saveResultOf({ products_created: 3, products_skipped: "x" }), { products_created: 3, products_skipped: 0 }, "'já existiam' ilegível vira zero");
  assert.equal(saveResultOf({ products_created: "8", products_skipped: 2 }), null, "texto no lugar do número não vale");
  assert.equal(saveResultOf({ products_created: -1 }), null, "negativo não vale");
  assert.equal(saveResultOf({ products_skipped: 2 }), null, "sem 'criados' não se escreve contagem");
  for (const bad of [null, undefined, 5, "x", [], {}]) assert.equal(saveResultOf(bad), null, JSON.stringify(bad));
});

test("cadastrado: a frase diz quantos entraram e quantos já existiam, e nada se inventa sem resposta", () => {
  const view = doneViewOf({ products_created: 8, products_skipped: 1 });
  assert.equal(view.stage, "done");
  assert.equal(view.headline, "Cardápio cadastrado");
  assert.equal(view.detail, "8 pratos novos, 1 já existiam.");
  assert.equal(doneViewOf({ products_created: 1, products_skipped: 0 }).detail, "1 prato novo.");
  assert.equal(doneViewOf({ products_created: 0, products_skipped: 3 }).detail, "0 pratos novos, 3 já existiam.");
  assert.equal(doneViewOf(null).detail, "", "sem contagem do servidor a tela não escreve número");
});

test("nenhuma tela escreve 'undefined', 'null' ou 'NaN'", () => {
  const flow = read();
  const views = [
    doorViewOf({ options: ALL, voiceWorks: true, error: "" }),
    doorViewOf({ options: null, voiceWorks: false, error: "" }),
    pagesViewOf({ pages: [{ id: 1, url: "blob:a" }], busy: false, photoEnabled: true, room: 3, failed: false, message: "" }),
    readingViewOf(),
    speakViewOf({ flow: startSpeak(), listening: false, canListen: true, heard: "", notice: "", unclear: [] }),
    speakViewOf({ flow: say(startSpeak(), "x-tudo 25").flow, listening: false, canListen: true, heard: "", notice: "", unclear: [] }),
    reviewViewOf({ flow, editing: null, error: "" }),
    doneViewOf({ products_created: 2, products_skipped: 0 }),
    doneViewOf(null),
  ];
  /** Todas as frases da tela (só os textos: um campo vazio como `editing: null` não é frase). */
  const words = (value) => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(words) : []);
  for (const view of views) {
    for (const text of words(view)) assert.ok(!/undefined|null|NaN/.test(text), text);
  }
});
