import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { ADMIN_TOUR, ADMIN_TOUR_ID } from "../../frontend/src/onboarding/adminTour.ts";
import { parseTourCommand } from "../../frontend/src/onboarding/tourEngine.ts";

// The panel's screens live in AdminPanel.tsx and in the files it hands a tab to.
const panel = (
  await Promise.all(
    ["AdminPanel.tsx", "PixSettingsPanel.tsx"].map((file) =>
      readFile(new URL(`../../frontend/src/service/${file}`, import.meta.url), "utf8")
    )
  )
).join("\n");

test("the owner tour has an id and enough steps", () => {
  assert.match(ADMIN_TOUR_ID, /^admin-v\d+$/);
  assert.ok(ADMIN_TOUR.length >= 8);
});

test("step ids are unique and every step has a title and text", () => {
  const ids = ADMIN_TOUR.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const step of ADMIN_TOUR) {
    assert.ok(step.title.trim(), `${step.id} needs a title`);
    assert.ok(step.text.trim(), `${step.id} needs a text`);
  }
});

test("texts stay short enough to be read aloud comfortably", () => {
  for (const step of ADMIN_TOUR) {
    assert.ok(step.text.length <= 260, `${step.id} is too long (${step.text.length})`);
  }
});

test("every highlighted target is an id that exists in AdminPanel.tsx", () => {
  for (const step of ADMIN_TOUR.filter((item) => item.target)) {
    assert.match(step.target, /^#[a-z0-9-]+$/, `${step.id}: use an #id selector`);
    const id = step.target.slice(1);
    assert.ok(
      panel.includes(`id="${id}"`),
      `${step.id}: AdminPanel.tsx has no element with id="${id}"`
    );
  }
});

test("every step that changes screen points to a real admin view", () => {
  const block = panel.match(/const ADMIN_VIEWS: string\[\] = \[([\s\S]*?)\];/);
  assert.ok(block, "ADMIN_VIEWS list not found in AdminPanel.tsx");
  for (const step of ADMIN_TOUR.filter((item) => item.view)) {
    assert.ok(
      block[1].includes(`"${step.view}"`),
      `${step.id}: "${step.view}" is not an admin view`
    );
  }
});

test("steps that advance on tap have something to tap", () => {
  for (const step of ADMIN_TOUR.filter((item) => item.advanceOnClick)) {
    assert.ok(step.target, `${step.id} advances on click but has no target`);
  }
});

test("the phrase shown as 'you can say' is really understood", () => {
  for (const step of ADMIN_TOUR.filter((item) => item.say)) {
    assert.notEqual(
      parseTourCommand(step.say),
      "unknown",
      `${step.id}: saying "${step.say}" would not work`
    );
  }
});

test("the first step is an introduction and the last one points to the Guia button", () => {
  assert.equal(ADMIN_TOUR[0].target, undefined);
  assert.equal(ADMIN_TOUR[ADMIN_TOUR.length - 1].target, "#admin-btn-guide");
});

test("the guide state is declared before the panel's early returns (hook order)", () => {
  const declared = panel.indexOf("const [guideOpen, setGuideOpen]");
  const firstEarlyReturn = panel.indexOf("if (!isAuthenticated)");
  assert.ok(declared > -1, "guideOpen state not found");
  assert.ok(firstEarlyReturn > -1, "early return not found");
  assert.ok(declared < firstEarlyReturn, "guideOpen must come before early returns");
});

test("the guide is only offered to people who can configure the restaurant", () => {
  assert.match(panel, /currentUser\?\.role === "OWNER" \|\| currentUser\?\.role === "MANAGER"/);
  // Auto-open is reserved for the owner and only once per browser.
  assert.match(panel, /hasSeenGuide\(ADMIN_TOUR_ID, currentUser\.id\)/);
});

test("steps the guide fills by voice point at a real field of the right kind", () => {
  const dictated = ADMIN_TOUR.filter((step) => step.dictate);
  assert.ok(dictated.length >= 1, "the table number step should accept dictation");
  for (const step of dictated) {
    assert.ok(step.target, `${step.id}: dictation needs a field to fill`);
    const id = step.target.slice(1);
    const tag = step.dictate === "choice" ? "select" : "input";
    assert.match(
      panel,
      new RegExp(`<${tag}\\s[^>]*?id="${id}"`),
      `${step.id}: #${id} must be a <${tag}> for "${step.dictate}" dictation`
    );
  }
});

test("the tour never asks the owner to type a category or a dish: the Assistente does that", () => {
  const typedMenuFields = ["#admin-menu-name", "#admin-product-name", "#admin-product-price", "#admin-product-menu"];
  for (const step of ADMIN_TOUR) {
    assert.ok(!typedMenuFields.includes(step.target), `${step.id} asks to type a menu field`);
  }
  const pointer = ADMIN_TOUR.find((step) => step.target === "#admin-tab-assistente");
  assert.ok(pointer, "one step must point at the Assistente tab");
  assert.equal(pointer.advanceOnClick, undefined, "pointing at it must not open it in the middle of the tour");
  assert.match(panel, /id="admin-tab-assistente"/);
});

test("a first-time owner with no menu goes to the Assistente instead of the tour", () => {
  assert.match(panel, /setView\("assistente"\)/);
  assert.match(panel, /rows\.length === 0/);
  assert.match(panel, /onOpenGuide=\{\(\) => setGuideOpen\(true\)\}/);
});

test("secrets are never dictated: the Pix key and password steps do not accept voice input", () => {
  for (const id of ["chave-pix", "salvar-pix"]) {
    const step = ADMIN_TOUR.find((item) => item.id === id);
    assert.ok(step, id);
    assert.equal(step.dictate, undefined, `${id} must stay keyboard-only`);
  }
});
