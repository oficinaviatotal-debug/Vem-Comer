import test from "node:test";
import assert from "node:assert/strict";

import { loginCheck, loginFailText, loginViewOf } from "../../frontend/src/painel/loginLogic.ts";
import * as copy from "../../frontend/src/novo/copy.ts";

const fail = (status, message = "") => Object.assign(new Error(message), { status });

test("e-mail vazio, sem @ ou só com espaços: a frase diz o que escrever e aponta o campo", () => {
  for (const email of ["", "   ", "\t"]) {
    assert.deepEqual(loginCheck({ email, password: "x" }), { ok: false, field: "email", text: copy.LOGIN_NO_EMAIL }, JSON.stringify(email));
  }
  for (const email of ["joao", "joao.restaurante.com", "joao @x.com", "@", "joao@"]) {
    const check = loginCheck({ email, password: "x" });
    assert.equal(check.ok, false, email);
    assert.equal(check.field, "email", email);
  }
  assert.equal(loginCheck({ email: "joao", password: "x" }).text, copy.LOGIN_BAD_EMAIL);
});

test("senha vazia: a frase aponta a senha; o e-mail certo vem primeiro", () => {
  assert.deepEqual(loginCheck({ email: "voce@casa.com", password: "" }), { ok: false, field: "password", text: copy.LOGIN_NO_PASSWORD });
  assert.deepEqual(loginCheck({ email: "", password: "" }).field, "email", "um problema por vez, o primeiro da tela");
});

test("o e-mail perde os espaços das pontas e a senha não é mexida (espaço dentro da senha vale)", () => {
  assert.deepEqual(loginCheck({ email: "  voce@casa.com ", password: " abc 12 " }), { ok: true, email: "voce@casa.com", password: " abc 12 " });
});

test("a frase do problema: sem sinal, servidor com defeito, muitas tentativas e senha errada são frases diferentes", () => {
  assert.equal(loginFailText(new TypeError("Failed to fetch")), copy.LOGIN_OFFLINE, "o pedido nem chegou: nunca diz que a senha está errada");
  assert.equal(loginFailText("qualquer coisa"), copy.LOGIN_OFFLINE);
  assert.equal(loginFailText(null), copy.LOGIN_OFFLINE);
  assert.equal(loginFailText(fail(500, "Internal Server Error")), copy.LOGIN_SERVER, "erro do servidor não passa em inglês");
  assert.equal(loginFailText(fail(502, "")), copy.LOGIN_SERVER);
  assert.equal(loginFailText(fail(429, "")), copy.LOGIN_TOO_MANY);
  assert.equal(loginFailText(fail(429, "Espere 5 minutos para tentar de novo.")), "Espere 5 minutos para tentar de novo.");
  assert.equal(loginFailText(fail(401, "Email ou senha inválidos")), "Email ou senha inválidos", "a frase do servidor passa como veio");
  assert.equal(loginFailText(fail(401, "")), copy.LOGIN_WRONG);
  assert.equal(loginFailText(fail(403, "  Usuário desativado.  ")), "Usuário desativado.");
});

const input = (extra = {}) => ({
  place: "Açaí do João",
  email: "",
  password: "",
  showPassword: false,
  busy: false,
  problem: "",
  problemField: null,
  ended: false,
  ...extra,
});

test("a tela de entrada nasce limpa: nome do restaurante, a frase de ajuda e nada de aviso", () => {
  const view = loginViewOf(input());
  assert.equal(view.place, "Açaí do João");
  assert.equal(view.lead, copy.LOGIN_LEAD);
  assert.equal(view.notice, "");
  assert.equal(view.problem, "");
  assert.equal(view.problemField, null);
  assert.equal(view.live, "");
  assert.equal(view.busy, false);
});

test("o nome do restaurante some quando não se sabe (nunca inventa)", () => {
  assert.equal(loginViewOf(input({ place: null })).place, "");
  assert.equal(loginViewOf(input({ place: "   " })).place, "");
});

test("login que terminou mostra o aviso próprio; com um problema de verdade, só o problema (uma frase de cada vez)", () => {
  const ended = loginViewOf(input({ ended: true, email: "voce@casa.com" }));
  assert.equal(ended.notice, copy.LOGIN_ENDED);
  assert.equal(ended.live, copy.LOGIN_ENDED);
  assert.equal(ended.email, "voce@casa.com", "o e-mail continua preenchido para a pessoa só digitar a senha");
  const both = loginViewOf(input({ ended: true, problem: copy.LOGIN_WRONG, problemField: "password" }));
  assert.equal(both.notice, "");
  assert.equal(both.problem, copy.LOGIN_WRONG);
  assert.equal(both.live, "", "o problema é lido pelo alerta da tela, não duas vezes");
});

test("o campo do problema só vale quando há problema", () => {
  assert.equal(loginViewOf(input({ problemField: "email" })).problemField, null);
  assert.equal(loginViewOf(input({ problem: "x", problemField: "email" })).problemField, "email");
  assert.equal(loginViewOf(input({ problem: "x", problemField: null })).problemField, null, "problema de conexão não aponta campo");
});

test("as frases da entrada falam a língua de quem usa: sem inglês nem jargão", () => {
  const texts = Object.entries(copy)
    .filter(([name]) => name.startsWith("LOGIN_") || name.startsWith("SHELL_"))
    .map(([, value]) => String(value));
  assert.ok(texts.length >= 20);
  for (const text of texts) {
    assert.ok(!/\b(login|logout|token|server|error|dashboard|checkout|onboarding|template|upload|click here)\b/i.test(text), text);
  }
});
