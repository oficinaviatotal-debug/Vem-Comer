import test from "node:test";
import assert from "node:assert/strict";

import { POSTER_H, POSTER_W, fitFontSize, posterFileName, posterName, tableLabel } from "../../frontend/src/mesa/posterLayout.ts";

test("the poster is an A4 page in portrait", () => {
  assert.ok(Math.abs(POSTER_H / POSTER_W - 297 / 210) < 0.005);
});

test("the restaurant name goes on one line, cut with an ellipsis when it is too long", () => {
  assert.equal(posterName("  Bistrô   Sabor & Arte "), "Bistrô Sabor & Arte");
  assert.equal(posterName(""), "");
  const long = posterName("Restaurante e Pizzaria do Zé da Esquina de Todos os Sabores do Mundo Inteiro");
  assert.ok(long.length <= 48);
  assert.ok(long.endsWith("…"));
  assert.ok(!long.includes("  "));
});

test("the table label, with whatever the owner typed", () => {
  assert.equal(tableLabel(12), "Mesa 12");
  assert.equal(tableLabel(" 7 "), "Mesa 7");
  assert.equal(tableLabel("Varanda 2"), "Mesa Varanda 2");
  assert.equal(tableLabel(""), "Mesa");
  assert.equal(tableLabel("123456789012345"), "Mesa 123456789012");
});

test("the file name is safe to open anywhere", () => {
  assert.equal(posterFileName(12), "cartaz-mesa-12.png");
  assert.equal(posterFileName("Varanda 2"), "cartaz-mesa-varanda-2.png");
  assert.equal(posterFileName("Salão/Área"), "cartaz-mesa-salao-area.png");
  assert.equal(posterFileName("***"), "cartaz-mesa.png");
});

test("the letter shrinks until the text fits, and never goes below the minimum", () => {
  const width = (size) => size * 10; // 10 per point
  assert.equal(fitFontSize(width, 1000, 128, 70), 100);
  assert.equal(fitFontSize(width, 2000, 128, 70), 128);
  assert.equal(fitFontSize(width, 100, 128, 70), 70);
  assert.equal(fitFontSize(width, 999, 128, 70), 98);
});
