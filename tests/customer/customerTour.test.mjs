import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import {
  CUSTOMER_TOUR_ID,
  CUSTOMER_VIEWS,
  customerTour,
} from "../../frontend/src/customer/customerTour.ts";
import { parseTourCommand } from "../../frontend/src/onboarding/tourEngine.ts";

const folder = new URL("../../frontend/src/customer/", import.meta.url);
const markup = readdirSync(folder)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => readFileSync(new URL(file, folder), "utf8"))
  .join("\n");
const app = readFileSync(new URL("CustomerApp.tsx", folder), "utf8");

const withCategories = customerTour({ hasCategories: true });
const withoutCategories = customerTour({ hasCategories: false });

test("the customer tour has an id and a sensible length", () => {
  assert.match(CUSTOMER_TOUR_ID, /^cliente-v\d+$/);
  assert.ok(withCategories.length >= 6);
  assert.equal(withoutCategories.length, withCategories.length - 1);
  assert.equal(withoutCategories.some((step) => step.id === "categorias"), false);
});

for (const [label, steps] of [
  ["with categories", withCategories],
  ["without categories", withoutCategories],
]) {
  test(`steps are well formed (${label})`, () => {
    assert.equal(new Set(steps.map((step) => step.id)).size, steps.length);
    for (const step of steps) {
      assert.ok(step.title.trim(), `${step.id} needs a title`);
      assert.ok(step.text.trim(), `${step.id} needs a text`);
      assert.ok(step.text.length <= 260, `${step.id} is too long to read aloud (${step.text.length})`);
    }
  });

  test(`every highlighted target is an id in the customer screens (${label})`, () => {
    for (const step of steps.filter((item) => item.target)) {
      assert.match(step.target, /^#[a-z0-9-]+$/, `${step.id}: use an #id selector`);
      const id = step.target.slice(1);
      // Either id="x", or a conditional id (the first dish only): id={cond ? "x" : undefined}.
      const present = markup.includes(`id="${id}"`) || new RegExp(`id=\\{[^}]*"${id}"`).test(markup);
      assert.ok(present, `${step.id}: no element with id="${id}"`);
    }
  });

  test(`every screen the guide switches to exists (${label})`, () => {
    for (const step of steps.filter((item) => item.view)) {
      assert.ok(CUSTOMER_VIEWS.includes(step.view), `${step.id}: "${step.view}" is not a customer view`);
    }
    // The host must really handle each of those views.
    for (const view of CUSTOMER_VIEWS) {
      assert.ok(app.includes(`view === "${view}"`), `CustomerApp does not handle the "${view}" view`);
    }
  });

  test(`the phrase shown as "you can say" is really understood (${label})`, () => {
    for (const step of steps.filter((item) => item.say)) {
      assert.notEqual(parseTourCommand(step.say), "unknown", `${step.id}: "${step.say}" would not work`);
    }
  });
}

test("the tour starts with an introduction and ends on the send button", () => {
  assert.equal(withCategories[0].target, undefined);
  assert.equal(withCategories.at(-1).target, "#cust-send");
});

test("steps that advance on tap have something to tap", () => {
  for (const step of withCategories.filter((item) => item.advanceOnClick)) {
    assert.ok(step.target, `${step.id} advances on click but has no target`);
  }
});

test("the words in the guide are the words printed on the buttons", () => {
  for (const word of ["Adicionar", "Ver pedido", "Enviar pedido", "Pix", "Cartão", "Dinheiro"]) {
    assert.ok(markup.includes(word), `the screens have no "${word}"`);
  }
});

test("the guide is offered once per device and can be reopened from Ajuda", () => {
  assert.match(app, /hasSeenGuide\(CUSTOMER_TOUR_ID, CUSTOMER_TOUR_USER\)/);
  assert.match(app, /markGuideSeen\(CUSTOMER_TOUR_ID, CUSTOMER_TOUR_USER\)/);
  assert.ok(markup.includes('id="cust-help"'));
});
