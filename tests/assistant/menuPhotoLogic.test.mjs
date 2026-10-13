import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeReading,
  readingCounts,
  readingIntro,
  unreadableText,
  pagesLeft,
  fitsTogether,
  readingErrorText,
  wantsPhoto,
  wantsFile,
  wantsReadyMenu,
  menuFileProblem,
  unreadableFileText,
  readyMenuOptions,
  readyMenuMode,
  MENU_FILE_MAX_BYTES,
  MENU_PDF_MAX_BYTES,
} from "../../frontend/src/assistant/menuPhotoLogic.ts";
import { MENU_MAX_PHOTOS, MENU_MAX_TOTAL_BYTES } from "../../frontend/src/photos/photoLogic.ts";

const GOOD = {
  readable: true,
  categories: [
    { name: "Pizzas", items: [{ name: "Calabresa (G)", price: "52.00" }, { name: "Mussarela (G)", price: "" }] },
    { name: "Bebidas", items: [{ name: "Coca-Cola 2L", price: "14.00" }] },
  ],
  notes: "",
};

test("a good answer keeps names and prices", () => {
  const parsed = normalizeReading(GOOD);
  assert.equal(parsed.readable, true);
  assert.deepEqual(parsed.categories[0].items[0], { name: "Calabresa (G)", price: "52.00" });
  assert.equal(parsed.categories[0].items[1].price, "");
});

test("prices are checked again on the screen", () => {
  const parsed = normalizeReading({
    readable: true,
    categories: [{ name: "A", items: [
      { name: "x", price: "18,5" },
      { name: "y", price: "-3" },
      { name: "z", price: "grátis" },
      { name: "w", price: 12 },
      { name: "v", price: null },
      { name: "u", price: { cents: 1 } },
    ] }],
  });
  assert.deepEqual(parsed.categories[0].items.map((item) => item.price), ["18.50", "", "", "12.00", "", ""]);
});

test("anything that is not a reading is refused", () => {
  for (const raw of [null, undefined, "texto", 7, [], {}, { readable: "yes", categories: [] }, { readable: true }, { readable: true, categories: "x" }]) {
    assert.equal(normalizeReading(raw), null, JSON.stringify(raw));
  }
});

test("a menu with nothing in it is unreadable", () => {
  for (const raw of [
    { readable: false, categories: [{ name: "A", items: [{ name: "X", price: "1" }] }], notes: "borrado" },
    { readable: true, categories: [] },
    { readable: true, categories: [{ name: "A", items: [] }, { name: "B", items: [{ name: "  ", price: "1" }] }] },
  ]) {
    const parsed = normalizeReading(raw);
    assert.equal(parsed.readable, false);
    assert.deepEqual(parsed.categories, []);
  }
});

test("unknown fields, control characters and huge lists are cut", () => {
  const parsed = normalizeReading({
    readable: true,
    isAdmin: true,
    notes: "N".repeat(900),
    categories: [{ name: "C\u0000at\n", role: "OWNER", items: [{ name: "B".repeat(400), price: "1", html: "<b>" }, { name: "Com\tquebra", price: "2" }] }],
  });
  assert.deepEqual(Object.keys(parsed).sort(), ["categories", "notes", "readable"]);
  assert.equal(parsed.categories[0].name, "C at");
  assert.equal(parsed.categories[0].items[0].name.length, 150);
  assert.deepEqual(Object.keys(parsed.categories[0].items[0]).sort(), ["name", "price"]);
  assert.equal(parsed.categories[0].items[1].name, "Com quebra");
  assert.equal(parsed.notes.length, 300);

  const many = normalizeReading({ readable: true, categories: [{ name: "Tudo", items: Array.from({ length: 900 }, (_, i) => ({ name: `Prato ${i}`, price: "1" })) }] });
  assert.equal(many.categories[0].items.length, 300);
  const cats = normalizeReading({ readable: true, categories: Array.from({ length: 80 }, (_, i) => ({ name: `C${i}`, items: [{ name: "x", price: "1" }] })) });
  assert.equal(cats.categories.length, 30);
});

test("a category without a name becomes Outros", () => {
  const parsed = normalizeReading({ readable: true, categories: [{ name: "  ", items: [{ name: "X", price: "1" }] }] });
  assert.equal(parsed.categories[0].name, "Outros");
});

test("counts and the sentence after reading", () => {
  const parsed = normalizeReading(GOOD);
  assert.deepEqual(readingCounts(parsed), { items: 3, categories: 2, withoutPrice: 1 });
  assert.equal(readingIntro(parsed), "Li o seu cardápio: 3 pratos em 2 categorias. Um prato está sem preço.");

  const priced = normalizeReading({ readable: true, categories: [{ name: "A", items: [{ name: "X", price: "9" }] }] });
  assert.equal(readingIntro(priced), "Li o seu cardápio: 1 prato em 1 categoria.");

  const many = normalizeReading({ readable: true, categories: [{ name: "A", items: [{ name: "X", price: "" }, { name: "Y", price: "" }] }] });
  assert.match(readingIntro(many), /2 pratos estão sem preço\.$/);
});

test("unreadable text carries the note when there is one", () => {
  assert.match(unreadableText({ readable: false, categories: [], notes: "" }), /^Não consegui ler um cardápio nessa foto\./);
  assert.match(unreadableText({ readable: false, categories: [], notes: "foto tremida" }), /\(foto tremida\)$/);
});

test("pages: at most four, and the weight is limited", () => {
  assert.equal(pagesLeft(0), MENU_MAX_PHOTOS);
  assert.equal(pagesLeft(MENU_MAX_PHOTOS), 0);
  assert.equal(pagesLeft(99), 0);
  assert.equal(fitsTogether([1_000_000, 2_000_000]), true);
  assert.equal(fitsTogether([MENU_MAX_TOTAL_BYTES]), true);
  assert.equal(fitsTogether([MENU_MAX_TOTAL_BYTES, 1]), false);
  assert.equal(fitsTogether([]), true);
});

test("errors are shown in plain words", () => {
  assert.equal(readingErrorText(new Error("O serviço de leitura está ocupado agora. Tente de novo em alguns segundos.")), "O serviço de leitura está ocupado agora. Tente de novo em alguns segundos.");
  assert.match(readingErrorText(new TypeError("Failed to fetch")), /internet/);
  assert.match(readingErrorText(new TypeError("Load failed")), /internet/);
  assert.match(readingErrorText("???"), /internet/);
  const abort = new Error("The operation was aborted");
  abort.name = "AbortError";
  assert.match(readingErrorText(abort), /demorou demais/);
});

test("the owner says he has a menu or wants to send a photo", () => {
  // the two real sentences from the owner's phone
  assert.equal(wantsPhoto("eu já tenho um cardápio pronto eu gostaria de mandar uma foto para você e você cadastrar tudo já com os homens os pratos os produtos pode ser"), true);
  assert.equal(wantsPhoto("Olá tudo bem sou o dono de uma pizzaria gostaria de cadastrar todo o meu cardápio como posso fazer"), false);
  for (const yes of ["foto", "Quero mandar uma foto", "vou tirar uma fotografia", "tenho o cardápio impresso", "já tenho cardápio", "cardápio pronto", "uso a câmera", "mando uma imagem"]) {
    assert.equal(wantsPhoto(yes), true, yes);
  }
  for (const no of ["", "pizzaria", "lanchonete", "restaurante e bar", "não tenho cardápio", "repete", "voltar", "fotogênico"]) {
    assert.equal(wantsPhoto(no), false, no);
  }
});

test("the owner says he has the menu in a spreadsheet or PDF", () => {
  for (const yes of ["tenho uma planilha", "está no excel", "vou mandar o arquivo", "é um PDF", "tenho o cardápio em csv", "eu mando a planilha do Excel pra você"]) {
    assert.equal(wantsFile(yes), true, yes);
    assert.equal(wantsReadyMenu(yes), true, yes);
  }
  for (const no of ["", "pizzaria", "não tenho planilha", "nunca usei excel", "ainda não tenho arquivo", "X-tudo 25 reais", "repete"]) {
    assert.equal(wantsFile(no), false, no);
  }
  // a photo is still a ready menu, and a file alone is not a photo
  assert.equal(wantsReadyMenu("quero mandar uma foto"), true);
  assert.equal(wantsPhoto("tenho uma planilha"), false);
  assert.equal(wantsReadyMenu("lanchonete"), false);
});

test("a file is checked before it is sent", () => {
  const sheet = (size, name = "cardapio.xlsx", type = "") => ({ name, type, size });
  assert.equal(menuFileProblem(sheet(5_000), false), "");
  assert.equal(menuFileProblem(sheet(MENU_FILE_MAX_BYTES), false), "");
  assert.match(menuFileProblem(sheet(MENU_FILE_MAX_BYTES + 1), false), /grande demais/);
  assert.match(menuFileProblem(sheet(0), false), /vazio/);
  // a PDF is heavier than a spreadsheet and needs the AI on the server
  assert.equal(menuFileProblem(sheet(MENU_FILE_MAX_BYTES + 1, "menu.PDF"), true), "");
  assert.equal(menuFileProblem(sheet(MENU_PDF_MAX_BYTES, "menu.pdf"), true), "");
  assert.match(menuFileProblem(sheet(MENU_PDF_MAX_BYTES + 1, "menu.pdf"), true), /pesado demais/);
  assert.match(menuFileProblem(sheet(1000, "menu.pdf"), false), /PDF/);
  assert.match(menuFileProblem(sheet(1000, "sem-nome", "application/pdf"), false), /PDF/);
  assert.equal(menuFileProblem(sheet(1000, "sem-nome", "application/pdf"), true), "");
});

test("what is said when the file has no menu in it", () => {
  assert.match(unreadableFileText({ readable: false, categories: [], notes: "" }, true), /tire uma foto/);
  assert.doesNotMatch(unreadableFileText({ readable: false, categories: [], notes: "" }, false), /foto/);
  assert.match(unreadableFileText({ readable: false, categories: [], notes: "planilha vazia" }, false), /\(planilha vazia\)/);
});

test("the ready-menu card follows what the server can read", () => {
  const modeOf = (photo_menu, file_menu, pdf_menu) => readyMenuMode(readyMenuOptions({ photo_menu, file_menu, pdf_menu }));
  assert.equal(modeOf(false, false, false), false);
  assert.equal(modeOf(true, false, true), "photo");
  assert.equal(modeOf(false, true, false), "file");
  assert.equal(modeOf(true, true, true), "both");
  // no key on the server: only spreadsheets, never PDF
  assert.deepEqual(readyMenuOptions({ photo_menu: false, file_menu: true, pdf_menu: false }), { photo: false, file: true, pdf: false });
  // an older server without the file route: the PDF flag alone does not turn files on
  assert.deepEqual(readyMenuOptions({ photo_menu: true, file_menu: false, pdf_menu: true }), { photo: true, file: false, pdf: false });
});
