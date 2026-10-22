import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { minutesText, money, waitTone } from "../../frontend/src/novo/format.ts";

const DIR = new URL("../../frontend/src/novo/", import.meta.url);
const sources = readdirSync(DIR).filter((name) => /\.(tsx?|css)$/.test(name));
const read = (name) => readFileSync(new URL(name, DIR), "utf8");

test("money escreve em reais, do jeito que se fala", () => {
  assert.equal(money(29.9).replace(/\s/g, " "), "R$ 29,90");
  assert.equal(money(1284.5).replace(/\s/g, " "), "R$ 1.284,50");
  assert.equal(money(0).replace(/\s/g, " "), "R$ 0,00");
});

test("minutesText mostra o número, não uma frase", () => {
  assert.equal(minutesText(0), "0 min");
  assert.equal(minutesText(7), "7 min");
  assert.equal(minutesText(59), "59 min");
  assert.equal(minutesText(65), "1 h 05");
  assert.equal(minutesText(120), "2 h 00");
});

test("minutesText não inventa tempo quando o dado é ruim", () => {
  assert.equal(minutesText(Number.NaN), "");
  assert.equal(minutesText(-3), "");
  assert.equal(minutesText(Number.POSITIVE_INFINITY), "");
});

test("waitTone: verde até 10 min, amarelo até 20, vermelho depois", () => {
  assert.equal(waitTone(0), "ok");
  assert.equal(waitTone(9.9), "ok");
  assert.equal(waitTone(10), "warn");
  assert.equal(waitTone(19), "warn");
  assert.equal(waitTone(20), "late");
  assert.equal(waitTone(90), "late");
});

test("o visual novo não depende do antigo: o CSS só usa variáveis nv- e não importa styles, ui nem admin", () => {
  const css = read("novo.css");
  const used = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.ok(used.length > 20, "o CSS usa as próprias variáveis");
  for (const name of used) assert.ok(name.startsWith("--nv-"), `variável de fora: ${name}`);
  for (const name of sources) {
    const text = read(name);
    assert.ok(!/from ["']\.\.\/(styles|ui|admin|service|nav|mesa)/.test(text), `${name} importa o antigo`);
    assert.ok(!/import ["']\.\.\//.test(text), `${name} importa CSS do antigo`);
  }
});

test("só a página de conferência importa os dados de exemplo; as telas recebem tudo por props", () => {
  for (const name of sources) {
    if (name === "demo.ts" || name === "preview.tsx") continue;
    assert.ok(!/from ["']\.\/demo["']/.test(read(name)), `${name} importa demo`);
  }
  assert.match(read("preview.tsx"), /from "\.\/demo"/);
});

test("peças de toque têm 44 px ou mais e o movimento respeita quem pediu menos movimento", () => {
  const css = read("novo.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
  // O "+" da foto só desenha o que o toque faz; quem recebe o toque é o cartão inteiro (ver toque.test.mjs).
  const add = css.match(/\.nv-add \{[^}]*\}/)[0];
  assert.match(add, /width: 4[48]px/);
  assert.match(add, /pointer-events: none/);
  const close = css.match(/\.nv-cross-close \{[^}]*\}/)[0];
  assert.match(close, /width: 44px/);
  assert.match(css, /\.nv-icon-btn \{[^}]*width: 48px/);
});

test("nenhuma tela do visual novo escreve texto de interface que o dono não entende", () => {
  const banned = /\b(dashboard|checkout|onboarding|template|upload|click here)\b/i;
  for (const name of ["ShopMenu.tsx", "OwnerToday.tsx", "Kitchen.tsx", "JobsHome.tsx", "Choices.tsx", "Bag.tsx", "Tracking.tsx", "Table.tsx", "MainMenu.tsx", "Desk.tsx", "DeskTable.tsx", "QrScan.tsx", "Orders.tsx", "copy.ts"]) {
    assert.ok(!banned.test(read(name)), `${name} tem palavra de jargão`);
  }
});

test("os botões de mais e menos do prato têm 44 px, e o campo de busca tem altura de dedo", () => {
  const css = read("novo.css");
  const step = css.match(/\.nv-step button \{[^}]*\}/)[0];
  assert.match(step, /width: 44px/);
  assert.match(step, /height: 44px/);
  assert.match(css.match(/\.nv-search-input \{[^}]*\}/)[0], /min-height: 5\dpx/);
});
