import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EMPTY_FORM,
  FIELD_ORDER,
  TERMS_VERSION,
  asSignupField,
  cleanText,
  fallbackMessage,
  firstErrorField,
  formatPhoneInput,
  normalizePhone,
  toRequestBody,
  validateSignup,
} from "../../frontend/src/signup/signupLogic.ts";

const BACKEND = readFileSync(new URL("../../backend/signup.py", import.meta.url), "utf8");

function good(overrides = {}) {
  return {
    ...EMPTY_FORM,
    restaurantName: "Saiteria do João",
    ownerName: "João da Silva",
    email: "joao@gmail.com",
    phone: "(84) 99999-1234",
    password: "minha-senha-forte",
    acceptTerms: true,
    ...overrides,
  };
}

test("client and server agree on the version of the terms", () => {
  const match = BACKEND.match(/^TERMS_VERSION = "([^"]+)"/m);
  assert.ok(match, "TERMS_VERSION not found in backend/signup.py");
  assert.equal(TERMS_VERSION, match[1]);
});

test("client and server agree on which area codes exist", () => {
  const block = BACKEND.match(/_DDDS = frozenset\(\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(block, "_DDDS not found in backend/signup.py");
  const server = new Set(block[1].match(/\d+/g).map(Number));
  for (let ddd = 10; ddd <= 99; ddd += 1) {
    const accepted = normalizePhone(`${ddd}999991234`) !== null;
    assert.equal(accepted, server.has(ddd), `area code ${ddd}`);
  }
});

test("client and server agree on the field names", () => {
  for (const field of FIELD_ORDER) {
    assert.ok(BACKEND.includes(`"${field}"`), `${field} is not used by backend/signup.py`);
  }
});

test("a good form has no errors", () => {
  assert.deepEqual(validateSignup(good()), {});
});

test("the phone is optional, but wrong when filled and not a phone", () => {
  assert.deepEqual(validateSignup(good({ phone: "" })), {});
  assert.deepEqual(validateSignup(good({ phone: "   " })), {});
  assert.deepEqual(Object.keys(validateSignup(good({ phone: "12345" }))), ["phone"]);
});

test("each rule points at its own field", () => {
  const cases = [
    [{ restaurantName: "" }, "restaurant_name"],
    [{ restaurantName: "a" }, "restaurant_name"],
    [{ restaurantName: "a".repeat(121) }, "restaurant_name"],
    [{ ownerName: " " }, "owner_name"],
    [{ email: "joao" }, "email"],
    [{ email: "joao@gmail" }, "email"],
    [{ email: "@gmail.com" }, "email"],
    [{ password: "curta" }, "password"],
    [{ password: "x".repeat(129) }, "password"],
    [{ acceptTerms: false }, "accept_terms"],
  ];
  for (const [change, field] of cases) {
    assert.deepEqual(Object.keys(validateSignup(good(change))), [field], JSON.stringify(change));
  }
});

test("spaces typed by the phone keyboard do not break the form", () => {
  assert.deepEqual(validateSignup(good({ restaurantName: "  Bar   do Zé ", email: " joao @gmail.com " })), {});
});

test("the first field with a problem follows the order of the screen", () => {
  const errors = validateSignup({ ...EMPTY_FORM });
  assert.deepEqual(Object.keys(errors).sort(), [...FIELD_ORDER].filter((f) => f !== "phone").sort());
  assert.equal(firstErrorField(errors), "restaurant_name");
  assert.equal(firstErrorField({ password: "x", accept_terms: "y" }), "password");
  assert.equal(firstErrorField({}), null);
});

test("phone numbers: same answers as the server", () => {
  assert.equal(normalizePhone("(84) 99999-1234"), "5584999991234");
  assert.equal(normalizePhone("+55 84 99999-1234"), "5584999991234");
  assert.equal(normalizePhone("84999991234"), "5584999991234");
  assert.equal(normalizePhone("(84) 3222-1234"), "558432221234");
  for (const bad of ["123", "(10) 99999-1234", "84 89999-1234", "(84) 1222-1234", "abc", ""]) {
    assert.equal(normalizePhone(bad), null, bad);
  }
});

test("the phone is arranged while the person types", () => {
  assert.equal(formatPhoneInput(""), "");
  assert.equal(formatPhoneInput("8"), "(8");
  assert.equal(formatPhoneInput("84"), "(84");
  assert.equal(formatPhoneInput("849"), "(84) 9");
  assert.equal(formatPhoneInput("8499999"), "(84) 99999");
  assert.equal(formatPhoneInput("84999991"), "(84) 99999-1");
  assert.equal(formatPhoneInput("84999991234"), "(84) 99999-1234");
  assert.equal(formatPhoneInput("8432221234"), "(84) 3222-1234");
  assert.equal(formatPhoneInput("(84) 99999-1234"), "(84) 99999-1234");
  assert.equal(formatPhoneInput("5584999991234"), "(84) 99999-1234");
  assert.equal(formatPhoneInput("849999912349999"), "(84) 99999-1234"); // nunca passa de 11 dígitos
});

test("typing then fixing a phone never leaves junk", () => {
  let shown = "";
  for (const digit of "84999991234") shown = formatPhoneInput(shown + digit);
  assert.equal(shown, "(84) 99999-1234");
  // backspace removes a digit, not just the punctuation
  assert.equal(formatPhoneInput(shown.slice(0, -1)), "(84) 99999-123");
  assert.equal(formatPhoneInput("(84) 99999-"), "(84) 99999");
});

test("the request body is clean and carries the version of the terms", () => {
  const body = toRequestBody(good({ restaurantName: "  Bar  do Zé ", email: " Joao@Gmail.com " }));
  assert.deepEqual(body, {
    restaurant_name: "Bar do Zé",
    owner_name: "João da Silva",
    email: "joao@gmail.com",
    phone: "(84) 99999-1234",
    password: "minha-senha-forte",
    accept_terms: true,
    terms_version: TERMS_VERSION,
    website: "",
  });
});

test("the password goes as typed (no trimming, no changing case)", () => {
  assert.equal(toRequestBody(good({ password: " Senha Forte 1 " })).password, " Senha Forte 1 ");
});

test("the robot trap is carried to the server when something filled it", () => {
  assert.equal(toRequestBody(good(), "http://spam.example").website, "http://spam.example");
});

test("a field name from the server is accepted only if it exists on the screen", () => {
  assert.equal(asSignupField("email"), "email");
  assert.equal(asSignupField("accept_terms"), "accept_terms");
  assert.equal(asSignupField("website"), null);
  assert.equal(asSignupField(null), null);
  assert.equal(asSignupField(7), null);
});

test("messages for a request that did not arrive or came back without text", () => {
  assert.match(fallbackMessage(0), /internet/);
  assert.match(fallbackMessage(429), /Muitas tentativas/);
  assert.match(fallbackMessage(404), /não está aberto/);
  assert.match(fallbackMessage(503), /servidor/);
  assert.match(fallbackMessage(400), /Confira/);
});

test("cleanText collapses spaces and trims", () => {
  assert.equal(cleanText("  a \t b\n c  "), "a b c");
});
