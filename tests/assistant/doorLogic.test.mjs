import test from "node:test";
import assert from "node:assert/strict";

import { doorStatuses, fileHint, photoHint, filterTemplates, registerSynonyms } from "../../frontend/src/assistant/doorLogic.ts";

const TEMPLATES = [
  { id: "lanchonete", name: "Lanchonete" },
  { id: "pizzaria", name: "Pizzaria" },
  { id: "restaurante", name: "Restaurante" },
  { id: "bar", name: "Bar" },
  { id: "acai", name: "Açaí e sucos" },
  { id: "padaria", name: "Padaria" },
  { id: "churrasco", name: "Churrasco e espetinhos" },
  { id: "japones", name: "Japonês" },
  { id: "tapiocaria", name: "Tapiocaria" },
  { id: "salgados", name: "Salgados e coxinhas" },
  { id: "pastelaria", name: "Pastelaria" },
  { id: "hamburgueria", name: "Hamburgueria" },
  { id: "cafeteria", name: "Café da manhã e cafeteria" },
  { id: "bolos", name: "Bolos e tortas" },
  { id: "doces", name: "Doces e sobremesas" },
  { id: "sorveteria", name: "Sorveteria" },
  { id: "crepe", name: "Crepe e waffle" },
  { id: "regional", name: "Comida regional" },
];

const ids = (list) => list.map((template) => template.id);

test("doorStatuses: while the server has not answered, photo and file are loading", () => {
  assert.deepEqual(doorStatuses(null), { photo: "loading", file: "loading", pdf: false });
});

test("doorStatuses: each door is ready or off by what the server reads", () => {
  assert.deepEqual(doorStatuses({ photo: true, file: true, pdf: true }), { photo: "ready", file: "ready", pdf: true });
  assert.deepEqual(doorStatuses({ photo: false, file: true, pdf: false }), { photo: "off", file: "ready", pdf: false });
  assert.deepEqual(doorStatuses({ photo: false, file: false, pdf: false }), { photo: "off", file: "off", pdf: false });
});

test("photoHint: says plainly when the server cannot read photos, and what to do instead", () => {
  const off = photoHint(doorStatuses({ photo: false, file: true, pdf: false }));
  assert.match(off, /Ainda não está ligado/);
  assert.match(off, /planilha/);
  assert.match(off, /fale/);
  assert.doesNotMatch(photoHint(doorStatuses({ photo: true, file: true, pdf: true })), /Ainda não/);
  assert.match(photoHint(doorStatuses(null)), /Vendo/);
});

test("fileHint: only promises a PDF when the server reads PDFs", () => {
  assert.match(fileHint(doorStatuses({ photo: true, file: true, pdf: true })), /PDF/);
  const sheetOnly = fileHint(doorStatuses({ photo: true, file: true, pdf: false }));
  assert.match(sheetOnly, /Excel/);
  assert.doesNotMatch(sheetOnly, /PDF/);
  assert.match(fileHint(doorStatuses({ photo: false, file: false, pdf: false })), /Ainda não está disponível/);
});

test("filterTemplates: empty search keeps the whole list, in order", () => {
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "")), ids(TEMPLATES));
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "   ")), ids(TEMPLATES));
});

test("filterTemplates: matches the name, ignoring accents and capitals", () => {
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "ACAI")), ["acai"]);
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "japonês")), ["japones"]);
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "pizz")), ["pizzaria"]);
});

test("filterTemplates: matches what people call the business, not only the name", () => {
  assert.ok(ids(filterTemplates(TEMPLATES, "marmita")).includes("restaurante"));
  assert.ok(ids(filterTemplates(TEMPLATES, "pizza")).includes("pizzaria"));
  assert.ok(ids(filterTemplates(TEMPLATES, "sushi")).includes("japones"));
  assert.ok(ids(filterTemplates(TEMPLATES, "cerveja")).includes("bar"));
});

test("filterTemplates: plurals do not matter", () => {
  assert.ok(ids(filterTemplates(TEMPLATES, "pizzas")).includes("pizzaria"));
  assert.ok(ids(filterTemplates(TEMPLATES, "espetinho")).includes("churrasco"));
  assert.ok(ids(filterTemplates(TEMPLATES, "bolos")).includes("bolos"));
  assert.ok(ids(filterTemplates(TEMPLATES, "pastéis")).includes("pastelaria"));
});

test("filterTemplates: the segments the owners name most lead to their own list", () => {
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "tapioca")), ["tapiocaria"]);
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "coxinha")), ["salgados"]);
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "pastel")), ["pastelaria"]);
  assert.ok(ids(filterTemplates(TEMPLATES, "hamburguer")).includes("hamburgueria"));
  assert.ok(ids(filterTemplates(TEMPLATES, "sorvete")).includes("sorveteria"));
  assert.ok(ids(filterTemplates(TEMPLATES, "crepe")).includes("crepe"));
  assert.ok(ids(filterTemplates(TEMPLATES, "waffle")).includes("crepe"));
  assert.ok(ids(filterTemplates(TEMPLATES, "brigadeiro")).includes("doces"));
  assert.ok(ids(filterTemplates(TEMPLATES, "nordestina")).includes("regional"));
  assert.ok(ids(filterTemplates(TEMPLATES, "cafe da manha")).includes("cafeteria"));
});

test("filterTemplates: every typed word has to match", () => {
  assert.deepEqual(ids(filterTemplates(TEMPLATES, "churrasco espetinhos")), ["churrasco"]);
  assert.deepEqual(filterTemplates(TEMPLATES, "pizza sushi"), []);
});

test("filterTemplates: nothing found gives an empty list, never the whole list", () => {
  assert.deepEqual(filterTemplates(TEMPLATES, "zzzz"), []);
});

test("registerSynonyms: a new kind of business becomes searchable by the words people use", () => {
  const withNew = [...TEMPLATES, { id: "novo-teste", name: "Quitanda" }];
  assert.deepEqual(ids(filterTemplates(withNew, "verdura")), []);
  registerSynonyms("novo-teste", ["verdura", "legume"]);
  assert.deepEqual(ids(filterTemplates(withNew, "verdura")), ["novo-teste"]);
  assert.deepEqual(ids(filterTemplates(withNew, "quitand")), ["novo-teste"]);
});
