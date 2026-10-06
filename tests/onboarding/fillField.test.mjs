import test from "node:test";
import assert from "node:assert/strict";

// A tiny stand-in for the browser's form fields: enough to see what the guide writes
// and which event it fires (React listens to "input" on text fields and "change" on lists).
class FakeField {
  constructor() {
    this.stored = "";
    this.events = [];
  }
  dispatchEvent(event) {
    this.events.push(event.type);
    return true;
  }
}
const define = (Class) =>
  Object.defineProperty(Class.prototype, "value", {
    get() {
      return this.stored;
    },
    set(next) {
      this.stored = String(next);
    },
  });
class FakeInput extends FakeField {}
class FakeTextArea extends FakeField {}
class FakeSelect extends FakeField {
  constructor(options) {
    super();
    this.options = options;
  }
}
[FakeInput, FakeTextArea, FakeSelect].forEach(define);
globalThis.HTMLInputElement = FakeInput;
globalThis.HTMLTextAreaElement = FakeTextArea;
globalThis.HTMLSelectElement = FakeSelect;

const { fillFromSpeech, setFieldValue, DICTATE_HINT } = await import(
  "../../frontend/src/onboarding/fillField.ts"
);

test("a spoken name is written into the text field as if typed", () => {
  const field = new FakeInput();
  const result = fillFromSpeech(field, "text", "combinado de 20 peças.");
  assert.equal(result.ok, true);
  assert.equal(field.value, "Combinado de 20 peças");
  assert.deepEqual(field.events, ["input"]);
  assert.match(result.message, /Combinado de 20 peças/);
});

test("a spoken price is written with a dot, and read back in words", () => {
  const field = new FakeInput();
  const result = fillFromSpeech(field, "price", "quarenta e nove e noventa");
  assert.equal(field.value, "49.90");
  assert.match(result.message, /R\$ 49,90/);
  assert.match(result.spoken, /49 reais e 90 centavos/);
  assert.doesNotMatch(result.spoken, /R\$/);
});

test("a price that was not understood leaves the field alone and says how to answer", () => {
  const field = new FakeInput();
  field.value = "10";
  const result = fillFromSpeech(field, "price", "quero uma coca");
  assert.equal(result.ok, false);
  assert.equal(field.value, "10");
  assert.deepEqual(field.events, []);
  assert.match(result.message, /quarenta e nove e noventa/);
});

test("a table number accepts words and refuses cents", () => {
  const ok = new FakeInput();
  assert.equal(fillFromSpeech(ok, "integer", "mesa cinco").ok, true);
  assert.equal(ok.value, "5");
  const bad = new FakeInput();
  assert.equal(fillFromSpeech(bad, "integer", "5,5").ok, false);
  assert.equal(bad.value, "");
});

test("a category said aloud selects the matching option and fires change", () => {
  const select = new FakeSelect([
    { value: "", text: "Sem categoria" },
    { value: "m1", text: "Pratos" },
    { value: "m2", text: "Bebidas" },
  ]);
  const result = fillFromSpeech(select, "choice", "bebida");
  assert.equal(result.ok, true);
  assert.equal(select.value, "m2");
  assert.deepEqual(select.events, ["change"]);
});

test("with no category yet, or an unknown one, nothing is selected", () => {
  const empty = new FakeSelect([{ value: "", text: "Sem categoria" }]);
  assert.equal(fillFromSpeech(empty, "choice", "pratos").ok, false);
  assert.match(fillFromSpeech(empty, "choice", "pratos").message, /cadastre/);

  const some = new FakeSelect([
    { value: "", text: "Sem categoria" },
    { value: "m1", text: "Pratos" },
  ]);
  const result = fillFromSpeech(some, "choice", "lanches");
  assert.equal(result.ok, false);
  assert.equal(some.value, "");
});

test("a missing field is reported, not ignored", () => {
  const result = fillFromSpeech(null, "text", "pratos");
  assert.equal(result.ok, false);
  assert.match(result.message, /teclado/);
});

test("something that is not a form field is refused", () => {
  assert.equal(setFieldValue({ tagName: "DIV" }, "x"), false);
});

test("every kind of dictation has a hint for the card", () => {
  for (const kind of ["text", "price", "integer", "choice"]) {
    assert.ok(DICTATE_HINT[kind].length > 10, kind);
  }
});
