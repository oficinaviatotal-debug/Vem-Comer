import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../frontend/src/styles.css", import.meta.url), "utf8");

function token(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `token --${name} not found`);
  return match[1];
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pairs that actually appear on screen. Text must reach WCAG AA (4.5:1).
const pairs = [
  ["white on action button", "#FFFFFF", "brasa"],
  ["white on green button", "#FFFFFF", "mata"],
  ["white on dark green", "#FFFFFF", "folha"],
  ["body text on page", "tinta", "papel"],
  ["body text on sheet", "tinta", "comanda"],
  ["muted text on page", "nevoa", "papel"],
  ["muted text on sheet", "nevoa", "comanda"],
  ["dark green on attention yellow", "folha", "sol"],
  ["error text on sheet", "alerta", "comanda"],
  ["white on error", "#FFFFFF", "alerta"],
  ["action orange as text on sheet", "brasa", "comanda"],
];

for (const [label, fg, bg] of pairs) {
  test(`contrast AA: ${label}`, () => {
    const color = (value) => (value.startsWith("#") ? value : token(value));
    const ratio = contrast(color(fg), color(bg));
    assert.ok(ratio >= 4.5, `${label} is ${ratio.toFixed(2)}:1, below 4.5:1`);
  });
}

test("the vivid logo orange is only for highlights, never the button color", () => {
  assert.notEqual(token("brasa"), token("brasa-viva"));
  assert.ok(contrast("#FFFFFF", token("brasa-viva")) < 4.5);
});
