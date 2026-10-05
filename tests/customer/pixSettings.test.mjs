import test from "node:test";
import assert from "node:assert/strict";

import {
  keyPlaceholder,
  keyTypeLabel,
  PIX_KEY_TYPES,
  pixFormProblem,
  removeProblem,
} from "../../frontend/src/service/pixSettings.ts";

const complete = {
  key_type: "cpf",
  key: "529.982.247-25",
  receiver_name: "Jack Sushima Ltda",
  city: "Natal",
  password: "segredo-123",
};

test("the five key types match what the server accepts", () => {
  assert.deepEqual(PIX_KEY_TYPES.map((type) => type.value), ["cpf", "cnpj", "phone", "email", "random"]);
  assert.equal(keyTypeLabel("phone"), "Celular");
  assert.equal(keyTypeLabel("random"), "Chave aleatória");
  assert.equal(keyTypeLabel("nada"), "");
  assert.match(keyPlaceholder("cnpj"), /\//);
});

test("a complete form can be sent", () => {
  assert.equal(pixFormProblem(complete), "");
});

test("each missing piece gets its own plain message", () => {
  assert.match(pixFormProblem({ ...complete, key_type: "" }), /tipo da chave/);
  assert.match(pixFormProblem({ ...complete, key: "  " }), /chave Pix/);
  assert.match(pixFormProblem({ ...complete, receiver_name: "" }), /nome do recebedor/);
  assert.match(pixFormProblem({ ...complete, city: " " }), /cidade/);
  assert.match(pixFormProblem({ ...complete, password: "" }), /senha/);
});

test("turning Pix off needs the password too", () => {
  assert.match(removeProblem(""), /senha/);
  assert.equal(removeProblem("segredo-123"), "");
});
