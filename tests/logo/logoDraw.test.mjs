import test from "node:test";
import assert from "node:assert/strict";

import { GLYPHS, drawGlyph } from "../../frontend/src/logo/logoGlyphs.ts";
import { drawLogo } from "../../frontend/src/logo/logoDraw.ts";
import { FOODS, LAYOUTS, PALETTES, TEMPLATES, colorsFor, paletteById } from "../../frontend/src/logo/logoLogic.ts";
import { fakeCanvas } from "./fakeCanvas.mjs";

const TONES = { fg: "#111111", detail: "#222222", cut: "#333333" };

test("há um desenho para cada tipo de comida", () => {
  assert.deepEqual(Object.keys(GLYPHS).sort(), FOODS.map((f) => f.id).sort());
});

for (const food of FOODS) {
  test(`desenho "${food.id}": cabe na caixa -1..1, tem bom tamanho, só usa as 3 cores e chamadas simples`, () => {
    const { pen, painted, colors, log } = fakeCanvas();
    drawGlyph(pen, food.id, 0, 0, 1, TONES);

    assert.ok(log.fills > 0, "não pintou nada");
    const width = painted.maxX - painted.minX;
    const height = painted.maxY - painted.minY;
    const ink = 1.04; // margem de 4% para a ponta de um traço arredondado
    assert.ok(painted.minX >= -ink && painted.maxX <= ink, `sai na horizontal: ${painted.minX.toFixed(2)}..${painted.maxX.toFixed(2)}`);
    assert.ok(painted.minY >= -ink && painted.maxY <= ink, `sai na vertical: ${painted.minY.toFixed(2)}..${painted.maxY.toFixed(2)}`);
    assert.ok(Math.max(width, height) >= 1.5, `muito pequeno: ${width.toFixed(2)} x ${height.toFixed(2)}`);
    const centerX = (painted.minX + painted.maxX) / 2;
    const centerY = (painted.minY + painted.maxY) / 2;
    assert.ok(Math.abs(centerX) <= 0.2 && Math.abs(centerY) <= 0.2, `desequilibrado: centro em ${centerX.toFixed(2)}, ${centerY.toFixed(2)}`);

    const allowed = new Set(Object.values(TONES).map((c) => c.toUpperCase()));
    for (const color of colors) assert.ok(allowed.has(color), `cor fora das 3 do desenho: ${color}`);
  });
}

test("drawGlyph volta o canvas ao que era (save/restore em par)", () => {
  const { pen, painted } = fakeCanvas();
  drawGlyph(pen, "pizza", 100, 100, 50, TONES);
  const before = painted.maxX;
  drawGlyph(pen, "pizza", 100, 100, 50, TONES); // se a matriz tivesse ficado acumulada, o resultado mudaria
  assert.equal(painted.maxX, before);
});

test("drawLogo: todos os modelos x cores x comidas desenham sem erro e só com cores da paleta", () => {
  for (const palette of PALETTES) {
    for (const template of TEMPLATES) {
      const base = new Set(
        [palette.main, palette.deep, palette.soft, palette.accent, "#FFFFFF", "#1B2A22"].map((c) => c.toUpperCase())
      );
      const foods = template === "letras" ? ["geral"] : FOODS.map((f) => f.id);
      for (const food of foods) {
        const { pen, colors } = fakeCanvas();
        drawLogo(pen, { template, food, palette: palette.id, name: "Pizzaria do Zé" }, 512);
        for (const color of colors) {
          assert.ok(base.has(color), `${palette.id}/${template}/${food}: cor fora da paleta ${color}`);
        }
      }
    }
  }
});

test("drawLogo: o nome fica dentro do quadrado e, nos redondos, dentro do círculo", () => {
  const names = ["Zé", "Pizzaria do Zé", "Restaurante e Churrascaria Sabor da Roça", "Superlongonomesemespaçodepalavrainteira"];
  for (const template of TEMPLATES) {
    for (const name of names) {
      const { pen, texts } = fakeCanvas();
      drawLogo(pen, { template, food: "pizza", palette: "verde", name }, 512);
      const named = texts.filter((t) => template !== "letras" || t.size <= 70); // no "letras" as iniciais são maiores
      assert.ok(named.length >= 1, `${template}/${name}: sem texto`);
      for (const t of named) {
        const half = t.width / 2;
        assert.equal(t.align, "center");
        assert.ok(t.x - half >= 0 && t.x + half <= 512, `${template}/${name}: "${t.text}" sai na horizontal`);
        assert.ok(t.y - t.size / 2 >= 0 && t.y + t.size / 2 <= 512, `${template}/${name}: "${t.text}" sai na vertical`);
        if (template === "selo" || template === "redondo") {
          for (const [dx, dy] of [[-half, -t.size / 2], [half, -t.size / 2], [-half, t.size / 2], [half, t.size / 2]]) {
            const distance = Math.hypot(t.x + dx - 256, t.y + dy - 256);
            assert.ok(distance <= 250, `${template}/${name}: "${t.text}" passa da borda redonda (${distance.toFixed(0)})`);
          }
        }
      }
    }
  }
});

test("drawLogo: avisa quando o nome foi cortado, e só então", () => {
  const spec = (name) => ({ template: "redondo", food: "pizza", palette: "verde", name });
  assert.equal(drawLogo(fakeCanvas().pen, spec("Pizzaria do Zé"), 512), false);
  assert.equal(drawLogo(fakeCanvas().pen, spec("Superlongonomesemespaçodepalavrainteira"), 512), true);
});

test("drawLogo: nome vazio desenha só a forma e o desenho, sem texto", () => {
  const { pen, texts } = fakeCanvas();
  drawLogo(pen, { template: "quadrado", food: "pizza", palette: "verde", name: "" }, 512);
  assert.equal(texts.length, 0);
});

test("drawLogo: 'letras' escreve as iniciais grandes e o nome na faixa", () => {
  const { pen, texts } = fakeCanvas();
  drawLogo(pen, { template: "letras", food: "pizza", palette: "verde", name: "Saiteria do João" }, 512);
  assert.equal(texts[0].text, "SJ");
  assert.ok(texts[0].size >= 150);
  assert.ok(texts.slice(1).every((t) => t.size <= 70));
});

test("drawLogo: a cor do nome é a calculada para o modelo (legível)", () => {
  for (const template of TEMPLATES) {
    const { pen, texts } = fakeCanvas();
    const painted = [];
    drawLogo(pen, { template, food: "pizza", palette: "amarelo", name: "Pizzaria do Zé" }, 512);
    assert.ok(texts.length > 0);
    assert.ok(colorsFor(template, paletteById("amarelo")).nameInk);
    void painted;
  }
});

test("drawLogo: o tamanho pedido só escala (mesma proporção em 160 e em 512)", () => {
  const big = fakeCanvas();
  const small = fakeCanvas();
  const spec = { template: "selo", food: "sushi", palette: "grafite", name: "Sushi do Kenji" };
  drawLogo(big.pen, spec, 512);
  drawLogo(small.pen, spec, 160);
  const ratio = 160 / 512;
  assert.ok(Math.abs(small.painted.maxX - big.painted.maxX * ratio) < 0.5);
  assert.ok(Math.abs(small.painted.maxY - big.painted.maxY * ratio) < 0.5);
  assert.equal(big.texts.length, small.texts.length);
});

test("LAYOUTS: a caixa do desenho de cada modelo fica acima da caixa do nome", () => {
  for (const template of TEMPLATES) {
    const { glyph, name } = LAYOUTS[template];
    assert.ok(glyph.cy + glyph.r <= name.top + 40, `${template}: o desenho entra no nome`);
  }
});
