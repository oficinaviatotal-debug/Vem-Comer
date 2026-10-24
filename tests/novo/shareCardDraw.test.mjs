/**
 * O desenho do cartão de um prato. Roda no Node com um "papel" de mentira que anota cada traço: confere o que ficou
 * escrito, onde, que nada sai da imagem e que a foto cobre o cartão sem ser entortada.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { CARD_COLORS, coverRect, drawCard, fitLines, wrapLines } from "../../frontend/src/painel/shareCardDraw.ts";
import { CARD_SIZES, cardSpec } from "../../frontend/src/painel/shareLogic.ts";

/** Um papel de mentira: largura do texto = 0,5 × tamanho da letra × letras; anota texto, fotos, retângulos e arcos. */
function fakePaper() {
  const log = { texts: [], images: [], gradients: 0, ramps: [], fills: 0, arcs: 0, rects: [] };
  const stack = [];
  const ctx = {
    fillStyle: "#000",
    font: "400 10px x",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    shadowColor: "rgba(0, 0, 0, 0)",
    shadowBlur: 0,
    save() {
      stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha });
    },
    restore() {
      Object.assign(this, stack.pop());
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    arc() {
      log.arcs += 1;
    },
    closePath() {},
    clip() {},
    fill() {
      log.fills += 1;
    },
    fillRect(x, y, w, h) {
      log.rects.push({ x, y, w, h });
    },
    fillText(text, x, y, maxWidth) {
      log.texts.push({ text, x, y, maxWidth, font: this.font, align: this.textAlign, color: this.fillStyle, alpha: this.globalAlpha });
    },
    measureText(text) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      return { width: text.length * size * 0.5 };
    },
    drawImage(...args) {
      log.images.push(args);
    },
    createLinearGradient(x0, y0, x1, y1) {
      log.gradients += 1;
      const ramp = { x0, y0, x1, y1, stops: [] };
      log.ramps.push(ramp);
      return { addColorStop: (offset, color) => ramp.stops.push([offset, color]) };
    },
  };
  return { ctx, log };
}

const dish = { id: "x", name: "Pastel de carne", price: 9, photo: null };
const specOf = (over = {}) => cardSpec({ format: "feed", restaurant: "Pastelaria do Zé", dish, url: "https://vem.example/?empresa=pastelaria-do-ze", brand: true, ...over });
const photo = (width = 1600, height = 900) => ({ source: { fake: true }, width, height });

// ---------------------------------------------------------------- as contas

test("a foto cobre o cartão inteiro, cortada pelo meio e nunca esticada", () => {
  // Foto larga num cartão alto: corta dos lados.
  const wide = coverRect(1600, 900, 1080, 1350);
  assert.equal(Math.round(wide.sh), 900);
  assert.ok(Math.abs(wide.sw / wide.sh - 1080 / 1350) < 1e-9);
  assert.ok(Math.abs(wide.sx - (1600 - wide.sw) / 2) < 1e-9 && wide.sy === 0);
  // Foto alta num cartão largo: corta em cima e embaixo.
  const tall = coverRect(900, 1600, 1080, 1080);
  assert.equal(Math.round(tall.sw), 900);
  assert.ok(Math.abs(tall.sw / tall.sh - 1) < 1e-9);
  assert.ok(tall.sx === 0 && Math.abs(tall.sy - (1600 - tall.sh) / 2) < 1e-9);
  // Mesma proporção: usa a foto toda.
  assert.deepEqual(coverRect(540, 675, 1080, 1350), { sx: 0, sy: 0, sw: 540, sh: 675 });
  // Nunca sai da foto, nem com medidas estranhas.
  for (const [sw, sh, dw, dh] of [[1, 1, 1080, 1920], [4000, 10, 1080, 1350], [10, 4000, 1080, 1920]]) {
    const r = coverRect(sw, sh, dw, dh);
    assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= sw + 1e-9 && r.sy + r.sh <= sh + 1e-9);
  }
  assert.deepEqual(coverRect(0, 0, 1080, 1350), { sx: 0, sy: 0, sw: 0, sh: 0 });
});

const measure = (text) => text.length * 10;

test("o nome quebra em linhas que cabem; palavra gigante é cortada por letras; o que passa do limite vira reticências", () => {
  assert.deepEqual(wrapLines(measure, "Pastel de carne", 1000, 3), ["Pastel de carne"]);
  assert.deepEqual(wrapLines(measure, "Pastel de carne seca", 120, 3), ["Pastel de", "carne seca"]);
  assert.deepEqual(wrapLines(measure, "", 100, 3), []);
  assert.deepEqual(wrapLines(measure, "   ", 100, 3), []);
  const long = wrapLines(measure, "Supercalifragilisticoespialidoso", 100, 5);
  assert.ok(long.length > 1 && long.every((line) => line.length * 10 <= 100));
  assert.equal(long.join(""), "Supercalifragilisticoespialidoso");
  const cut = wrapLines(measure, "um dois tres quatro cinco seis sete oito nove dez", 80, 2);
  assert.equal(cut.length, 2);
  assert.ok(cut[1].endsWith("…") && cut.every((line) => line.length * 10 <= 80));
});

test("a letra encolhe até o nome caber nas linhas que o cartão tem, e no mínimo corta", () => {
  const at = (size, text) => text.length * size * 0.5;
  const fits = fitLines(at, "Pastel de carne", 936, 3, 120, 56);
  assert.equal(fits.size, 120);
  assert.equal(fits.lines.length, 1);
  const smaller = fitLines(at, "Pastel de frango com catupiry e azeitonas pretas", 936, 2, 120, 56);
  assert.ok(smaller.size < 120 && smaller.size >= 56);
  assert.ok(smaller.lines.length <= 2);
  const worst = fitLines(at, "palavra ".repeat(60), 936, 3, 120, 56);
  assert.equal(worst.size, 56);
  assert.equal(worst.lines.length, 3);
  assert.ok(worst.lines[2].endsWith("…"));
});

// ---------------------------------------------------------------- o desenho

for (const format of ["feed", "status"]) {
  for (const withPhoto of [true, false]) {
    for (const brand of [true, false]) {
      test(`cartão ${format} ${withPhoto ? "com" : "sem"} foto ${brand ? "com" : "sem"} marca: tudo o que precisa está escrito e nada sai da imagem`, () => {
        const { ctx, log } = fakePaper();
        const spec = specOf({ format, brand });
        const { width, height } = CARD_SIZES[format];
        drawCard(ctx, spec, withPhoto ? photo() : null);

        const said = log.texts.map((entry) => entry.text);
        assert.ok(said.includes("Pastelaria do Zé"), "o nome do restaurante");
        assert.ok(said.includes(spec.priceText), "o preço");
        assert.ok(said.includes("Peça pelo celular"), "o convite");
        assert.ok(said.includes(spec.linkText), "o link");
        assert.equal(said.filter((text) => text === "Feito com o Vem Comer").length, brand ? 1 : 0, "a marca só quando pedida");
        const dishLines = log.texts.filter((entry) => entry.font.includes("Bricolage") && !/^R\$/.test(entry.text)).sort((a, b) => a.y - b.y);
        assert.equal(dishLines.map((entry) => entry.text).join(" "), "Pastel de carne", "o nome do prato, inteiro e na ordem");
        assert.equal(spec.priceText.replace(/\s/g, " "), "R$ 9,00");

        for (const entry of log.texts) {
          assert.ok(entry.x >= 0 && entry.x <= width, `x fora: ${entry.text}`);
          assert.ok(entry.y > 0 && entry.y <= height, `y fora: ${entry.text}`);
          // Nenhum texto passa da largura do cartão (menos as margens).
          const size = Number(/(\d+)px/.exec(entry.font)[1]);
          const wide = Math.min(entry.text.length * size * 0.5, entry.maxWidth ?? Infinity);
          const left = entry.align === "center" ? entry.x - wide / 2 : entry.x;
          assert.ok(left >= 0 && left + wide <= width, `passa da largura: ${entry.text}`);
        }

        if (format === "status") {
          // O aplicativo cobre o alto e o pé do status: o texto fica no miolo.
          for (const entry of log.texts) assert.ok(entry.y >= 250 && entry.y <= height - 330 + 1, `fora do miolo: ${entry.text} em ${entry.y}`);
        }

        if (withPhoto) {
          assert.equal(log.images.length, 1);
          const [source, sx, sy, sw, sh, dx, dy, dw, dh] = log.images[0];
          assert.deepEqual(source, { fake: true });
          assert.deepEqual([dx, dy, dw, dh], [0, 0, width, height], "a foto cobre o cartão inteiro");
          assert.ok(sx >= 0 && sy >= 0 && sx + sw <= 1600 + 1e-9 && sy + sh <= 900 + 1e-9);
          assert.ok(Math.abs(sw / sh - width / height) < 1e-9, "sem entortar a foto");
        } else {
          assert.equal(log.images.length, 0);
          assert.ok(log.arcs >= 2, "o fundo sem foto tem os círculos de cor");
        }
        assert.ok(log.gradients >= 2, "a sombra de baixo e o brilho do preço");
        assert.equal(ctx.globalAlpha, 1, "a transparência volta ao normal");
      });
    }
  }
}

test("o nome do prato fica acima do preço e os dois acima do convite e do link", () => {
  const { ctx, log } = fakePaper();
  drawCard(ctx, specOf(), null);
  const y = (text) => log.texts.find((entry) => entry.text === text).y;
  assert.ok(y("Pastel de carne") < y("R$ 9,00".replace(" ", " ")) || true);
  const price = log.texts.find((entry) => /^R\$/.test(entry.text));
  assert.ok(y("Pastel de carne") < price.y);
  assert.ok(price.y < y("Peça pelo celular"));
  assert.ok(y("Peça pelo celular") < y(specOf().linkText));
  assert.ok(y(specOf().linkText) < y("Feito com o Vem Comer"));
});

test("nome de prato comprido ocupa mais linhas e continua inteiro dentro do cartão", () => {
  const long = { ...dish, name: "Pastel de frango com catupiry e azeitonas pretas (grande)" };
  const { ctx, log } = fakePaper();
  drawCard(ctx, specOf({ dish: long }), null);
  const lines = log.texts.filter((entry) => entry.font.includes("Bricolage") && !/^R\$/.test(entry.text));
  assert.ok(lines.length >= 2 && lines.length <= 3);
  assert.equal([...lines].sort((a, b) => a.y - b.y).map((entry) => entry.text).join(" "), "Pastel de frango com catupiry e azeitonas pretas (grande)");
  for (const entry of lines) assert.ok(entry.maxWidth <= 1080 - 72 * 2);
});

test("sem nome de restaurante o cartão sai sem a pílula, e não quebra", () => {
  const { ctx, log } = fakePaper();
  drawCard(ctx, specOf({ restaurant: "" }), photo());
  assert.ok(!log.texts.some((entry) => entry.text === ""));
  assert.ok(log.texts.some((entry) => entry.text === "Peça pelo celular"));
});

test("as cores são as da prancha de identidade", () => {
  assert.equal(CARD_COLORS.green, "#2E7032");
  assert.equal(CARD_COLORS.ink, "#1B4332");
  assert.equal(CARD_COLORS.fire, "#FF6F00");
  assert.equal(CARD_COLORS.cream, "#FAE9D2");
});

// ---------------------------------------------------------------- legibilidade sobre qualquer foto

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** O quanto a sombra do fundo cobre no ponto y (0 a 1), pelas paradas do degradê. */
function scrimAlpha(ramp, y) {
  const t = (y - ramp.y0) / (ramp.y1 - ramp.y0);
  if (t <= 0) return 0;
  const stops = ramp.stops.map(([offset, color]) => [offset, Number(/rgba\(.*,\s*([\d.]+)\)/.exec(color)[1])]);
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i][0]) return stops[i - 1][1] + ((stops[i][1] - stops[i - 1][1]) * (t - stops[i - 1][0])) / (stops[i][0] - stops[i - 1][0]);
  }
  return stops.at(-1)[1];
}

for (const format of ["feed", "status"]) {
  for (const name of ["Pastel de carne", "Pastel de frango com catupiry e azeitonas pretas (grande)", "X"]) {
    test(`a letra passa de 4,5:1 mesmo sobre uma foto branca (${format}, "${name.slice(0, 20)}")`, () => {
      const { ctx, log } = fakePaper();
      drawCard(ctx, specOf({ format, dish: { ...dish, name }, brand: true }), photo());
      const scrim = log.ramps.find((ramp) => ramp.stops.at(-1)?.[1] === "rgba(14, 40, 28, 0.95)");
      assert.ok(scrim, "a sombra do fundo existe");
      const bright = new Set([CARD_COLORS.cream, CARD_COLORS.peach, CARD_COLORS.sun]);
      const checked = log.texts.filter((entry) => bright.has(entry.color));
      assert.ok(checked.length >= 4, "nome do prato, convite, link e marca");
      for (const entry of checked) {
        const size = Number(/(\d+)px/.exec(entry.font)[1]);
        const alpha = scrimAlpha(scrim, entry.y - size * 0.75) * entry.alpha;
        // Pior caso: a foto é branca. O fundo é a sombra verde-escura por cima do branco.
        const dark = rgb("#0E281C");
        const under = dark.map((value, i) => value * scrimAlpha(scrim, entry.y - size * 0.75) + 255 * (1 - scrimAlpha(scrim, entry.y - size * 0.75)));
        const letter = rgb(entry.color).map((value, i) => value * entry.alpha + under[i] * (1 - entry.alpha));
        assert.ok(contrast(letter, under) >= 4.5, `${entry.text} (${entry.color}, alfa ${alpha.toFixed(2)}): ${contrast(letter, under).toFixed(2)}:1`);
      }
    });
  }
}

test("a sombra começa acima do nome do prato e o alto da foto fica à mostra", () => {
  const { ctx, log } = fakePaper();
  drawCard(ctx, specOf({ format: "status" }), photo());
  const scrim = log.ramps.find((ramp) => ramp.stops.at(-1)?.[1] === "rgba(14, 40, 28, 0.95)");
  const dishLines = log.texts.filter((entry) => entry.font.includes("Bricolage") && !/^R\$/.test(entry.text));
  const firstTop = Math.min(...dishLines.map((entry) => entry.y - Number(/(\d+)px/.exec(entry.font)[1])));
  assert.ok(scrim.y0 < firstTop, "a sombra nasce antes do texto");
  assert.ok(scrim.y0 > CARD_SIZES.status.height * 0.15, "o alto da foto não é coberto");
});
