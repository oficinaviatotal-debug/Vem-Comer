import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_PALETTE,
  FOODS,
  KEEP_AS_IS_BYTES,
  LAYOUTS,
  LINE_HEIGHT,
  NAME_MAX_CHARS,
  PALETTES,
  TEMPLATES,
  UPLOAD_MAX_BYTES,
  asFoodId,
  asPaletteId,
  bestInk,
  cleanName,
  colorsFor,
  contrast,
  fitName,
  guessFood,
  imageTypeOf,
  initialsOf,
  isDarkTemplate,
  paletteById,
  planUpload,
  usesInitials,
  variantsFor,
} from "../../frontend/src/logo/logoLogic.ts";

const BACKEND = readFileSync(new URL("../../backend/app.py", import.meta.url), "utf8");

/** Medida de mentira, mas proporcional ao tamanho da letra (0,55 do tamanho por caractere), como uma fonte de verdade. */
const measure = (text, size) => Array.from(text).length * size * 0.55;

function fitFor(template, name) {
  const layout = LAYOUTS[template];
  return fitName(name, layout.name.width, measure, {
    maxSize: layout.maxSize,
    minSize: layout.minSize,
    maxLines: layout.maxLines,
    height: layout.name.height,
  });
}

/* ------------------------------------------------------------------ catálogo */

test("há 13 tipos de comida, 9 cores e 6 modelos, sem repetição", () => {
  assert.equal(FOODS.length, 13);
  assert.equal(PALETTES.length, 9);
  assert.equal(TEMPLATES.length, 6);
  assert.equal(new Set(FOODS.map((f) => f.id)).size, 13);
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, 9);
  assert.equal(new Set(TEMPLATES).size, 6);
});

test("toda comida tem uma cor sugerida que existe", () => {
  for (const food of FOODS) {
    assert.ok(asPaletteId(DEFAULT_PALETTE[food.id]), `sem cor para ${food.id}`);
  }
});

test("asFoodId e asPaletteId só aceitam o que existe", () => {
  assert.equal(asFoodId("pizza"), "pizza");
  assert.equal(asFoodId("pizzaa"), null);
  assert.equal(asFoodId(undefined), null);
  assert.equal(asPaletteId("verde"), "verde");
  assert.equal(asPaletteId("<script>"), null);
});

test("só o modelo 'letras' usa iniciais; selo, quadrado e letras são escuros", () => {
  assert.deepEqual(TEMPLATES.filter(usesInitials), ["letras"]);
  assert.deepEqual(TEMPLATES.filter(isDarkTemplate), ["selo", "quadrado", "letras"]);
});

/* ------------------------------------------------------------------ contraste */

test("contraste: branco sobre preto é 21 e igual é 1", () => {
  assert.equal(Math.round(contrast("#FFFFFF", "#000000")), 21);
  assert.equal(contrast("#123B2B", "#123B2B"), 1);
});

test("bestInk escolhe a letra que se lê melhor", () => {
  assert.equal(bestInk("#FFC83A"), "#1B2A22"); // amarelo pede letra escura
  assert.equal(bestInk("#123B2B"), "#FFFFFF");
});

test("em TODAS as combinações de cor e modelo o nome tem contraste 4,5 ou mais", () => {
  for (const palette of PALETTES) {
    for (const template of TEMPLATES) {
      const colors = colorsFor(template, palette);
      const ratio = contrast(colors.nameInk, colors.nameBg);
      assert.ok(ratio >= 4.5, `${palette.id}/${template}: nome ${ratio.toFixed(2)}`);
    }
  }
});

test("em TODAS as combinações o desenho se separa do fundo (principal 4,5; detalhe 3)", () => {
  for (const palette of PALETTES) {
    for (const template of TEMPLATES) {
      const colors = colorsFor(template, palette);
      const main = contrast(colors.glyphFg, colors.glyphCut);
      const detail = contrast(colors.glyphDetail, colors.glyphCut);
      assert.ok(main >= 4.5, `${palette.id}/${template}: desenho ${main.toFixed(2)}`);
      assert.ok(detail >= 3, `${palette.id}/${template}: detalhe ${detail.toFixed(2)}`);
    }
  }
});

test("modelos escuros usam a cor principal como fundo; os claros usam a clara", () => {
  const verde = paletteById("verde");
  assert.equal(colorsFor("quadrado", verde).field, verde.main);
  assert.equal(colorsFor("claro", verde).field, verde.soft);
  assert.equal(colorsFor("selo", verde).band, null);
  assert.equal(colorsFor("quadrado", verde).band, verde.deep);
});

test("o amarelo não usa letra branca sobre o amarelo", () => {
  const amarelo = paletteById("amarelo");
  assert.equal(colorsFor("selo", amarelo).nameInk, "#1B2A22");
  assert.equal(colorsFor("quadrado", amarelo).nameInk, "#FFFFFF"); // faixa marrom escura
});

test("todas as cores são #RRGGBB", () => {
  for (const palette of PALETTES) {
    for (const key of ["main", "deep", "soft", "accent"]) {
      assert.match(palette[key], /^#[0-9A-F]{6}$/, `${palette.id}.${key}`);
    }
  }
});

/* ------------------------------------------------------------------ nome */

test("cleanName tira espaços e corta no limite", () => {
  assert.equal(cleanName("  Pizzaria   do   Zé  "), "Pizzaria do Zé");
  assert.equal(cleanName("a".repeat(100)).length, NAME_MAX_CHARS);
  assert.equal(cleanName(""), "");
});

test("iniciais: duas palavras que importam", () => {
  assert.equal(initialsOf("Saiteria do João"), "SJ");
  assert.equal(initialsOf("Pizzaria do Zé"), "PZ");
  assert.equal(initialsOf("Restaurante e Churrascaria Sabor da Roça"), "RC");
  assert.equal(initialsOf("açaí da Dona Fátima"), "AD");
});

test("iniciais: uma palavra dá uma letra; símbolos e números não entram; vazio dá vazio", () => {
  assert.equal(initialsOf("Zé"), "Z");
  assert.equal(initialsOf("123 Sabor"), "S");
  assert.equal(initialsOf("@@@"), "");
  assert.equal(initialsOf(""), "");
  assert.equal(initialsOf("do da"), "DD"); // só palavras pequenas: usa elas mesmas
});

test("guessFood acha o tipo pelo nome, com ou sem acento", () => {
  assert.equal(guessFood("Pizzaria do Zé"), "pizza");
  assert.equal(guessFood("Açaí da Praia"), "acai");
  assert.equal(guessFood("ACAI DO BAIRRO"), "acai");
  assert.equal(guessFood("Hamburgueria Smash"), "hamburguer");
  assert.equal(guessFood("Sorveteria Gelato"), "sorvete");
  assert.equal(guessFood("Doceria da Maria"), "bolo");
  assert.equal(guessFood("Padaria Pão Quente"), "cafe");
  assert.equal(guessFood("Sushi House"), "sushi");
  assert.equal(guessFood("Pastelaria do Chico"), "pastel");
  assert.equal(guessFood("Marmitaria Sabor Caseiro"), "prato");
  assert.equal(guessFood("Sucos e Vitaminas"), "suco");
  assert.equal(guessFood("Churrascaria Gaúcha"), "frango");
});

test("guessFood sem pista devolve null", () => {
  assert.equal(guessFood("Zé"), null);
  assert.equal(guessFood(""), null);
  assert.equal(guessFood("Estrela do Norte"), null);
});

test("fitName: nome curto cabe em uma linha na letra grande", () => {
  const fit = fitFor("quadrado", "Zé");
  assert.deepEqual(fit.lines, ["Zé"]);
  assert.equal(fit.size, LAYOUTS.quadrado.maxSize);
  assert.equal(fit.truncated, false);
});

test("fitName: nome vazio não desenha nada", () => {
  assert.deepEqual(fitFor("selo", "   ").lines, []);
});

test("fitName: prefere duas linhas quando a letra fica bem maior", () => {
  const one = fitName("Saiteria do João", 284, measure, { maxSize: 58, minSize: 26, maxLines: 1, height: 116 });
  const two = fitFor("selo", "Saiteria do João");
  assert.equal(two.lines.length, 2);
  assert.ok(two.size > one.size * 1.15);
});

test("fitName: para TODOS os nomes e modelos o texto cabe na largura e na altura, ou foi cortado com …", () => {
  const names = [
    "Zé",
    "Pizzaria do Zé",
    "Saiteria do João",
    "Restaurante e Churrascaria Sabor da Roça",
    "Doceria Maria Eduarda Santos Albuquerque",
    "Superlongonomesemespaçodepalavrainteira",
    "Açaí da Dona Fátima & Filhos",
    "A",
    "W".repeat(NAME_MAX_CHARS),
    "a b c d e f g h i j k l m n o p q r s t",
  ];
  for (const template of TEMPLATES) {
    const layout = LAYOUTS[template];
    for (const name of names) {
      const fit = fitFor(template, name);
      assert.ok(fit.size >= layout.minSize && fit.size <= layout.maxSize, `${template}/${name}: tamanho ${fit.size}`);
      assert.ok(fit.lines.length >= 1 && fit.lines.length <= layout.maxLines, `${template}/${name}: ${fit.lines.length} linhas`);
      for (const line of fit.lines) {
        assert.ok(measure(line, fit.size) <= layout.name.width + 0.001, `${template}/${name}: "${line}" passa da largura`);
      }
      assert.ok(fit.lines.length * fit.size * LINE_HEIGHT <= layout.name.height + 0.001, `${template}/${name}: passa da altura`);
    }
  }
});

test("fitName: nome comprido demais é cortado com … e avisa", () => {
  const fit = fitFor("redondo", "Superlongonomesemespaçodepalavrainteira");
  assert.equal(fit.truncated, true);
  assert.ok(fit.lines.some((line) => line.endsWith("…")));
});

test("fitName: o nome não perde palavra nem muda de ordem quando cabe", () => {
  const fit = fitFor("quadrado", "Doceria Maria Eduarda");
  assert.equal(fit.lines.join(" "), "Doceria Maria Eduarda");
});

/* ------------------------------------------------------------------ medidas */

test("as caixas de nome e de desenho ficam dentro do quadrado de 512", () => {
  for (const template of TEMPLATES) {
    const { glyph, name } = LAYOUTS[template];
    assert.ok(glyph.cx - glyph.r >= 0 && glyph.cx + glyph.r <= 512, `${template}: desenho sai na horizontal`);
    assert.ok(glyph.cy - glyph.r >= 0 && glyph.cy + glyph.r <= 512, `${template}: desenho sai na vertical`);
    assert.ok(name.cx - name.width / 2 >= 0 && name.cx + name.width / 2 <= 512, `${template}: nome sai na horizontal`);
    assert.ok(name.top + name.height <= 512, `${template}: nome sai por baixo`);
    assert.ok(name.top >= glyph.cy, `${template}: nome começa antes do meio do desenho`);
  }
});

test("nos modelos redondos o nome cabe dentro do círculo (largura da corda na base do nome)", () => {
  // selo: círculo de raio 228 até o anel; redondo: raio 212 por dentro do aro
  const rim = { selo: 224, redondo: 212 };
  for (const [template, radius] of Object.entries(rim)) {
    const { name } = LAYOUTS[template];
    const dy = name.top + name.height - 256;
    const chord = 2 * Math.sqrt(radius * radius - dy * dy);
    assert.ok(name.width <= chord, `${template}: nome ${name.width} > corda ${chord.toFixed(0)}`);
  }
});

test("variantsFor devolve os 6 modelos, na ordem, com o nome limpo", () => {
  const list = variantsFor("pizza", "vermelho", "  Pizzaria   do Zé ");
  assert.deepEqual(list.map((v) => v.template), [...TEMPLATES]);
  for (const v of list) {
    assert.equal(v.food, "pizza");
    assert.equal(v.palette, "vermelho");
    assert.equal(v.name, "Pizzaria do Zé");
  }
});

/* ------------------------------------------------------------------ arquivo do dono */

test("imageTypeOf usa o tipo do navegador e, se vazio, o fim do nome", () => {
  assert.equal(imageTypeOf("a.png", "image/png"), "image/png");
  assert.equal(imageTypeOf("LOGO.PNG", ""), "image/png");
  assert.equal(imageTypeOf("foto.jpeg", ""), "image/jpeg");
  assert.equal(imageTypeOf("foto.JPG", ""), "image/jpeg");
  assert.equal(imageTypeOf("x.webp", ""), "image/webp");
  assert.equal(imageTypeOf("x.svg", ""), "");
  assert.equal(imageTypeOf("semfim", ""), "");
});

test("planUpload: PNG pequeno segue; grande é reduzido como PNG; JPG grande vira JPG menor; o resto é recusado", () => {
  assert.equal(planUpload("image/png", 200_000), "send-as-is");
  assert.equal(planUpload("image/png", KEEP_AS_IS_BYTES + 1), "shrink-png");
  assert.equal(planUpload("image/jpeg", 2_000_000), "send-as-is");
  assert.equal(planUpload("image/jpeg", KEEP_AS_IS_BYTES + 1), "shrink-jpeg");
  assert.equal(planUpload("image/svg+xml", 100), "refuse");
  assert.equal(planUpload("image/gif", 100), "refuse");
  assert.equal(planUpload("image/heic", 100), "refuse");
  assert.equal(planUpload("", 100), "refuse");
});

test("o limite de envio sem reduzir fica abaixo do limite do servidor", () => {
  assert.ok(KEEP_AS_IS_BYTES < UPLOAD_MAX_BYTES);
  const match = BACKEND.match(/LOGO_MAX_BYTES = int\(os\.getenv\(.LOGO_MAX_BYTES., str\((\d+) \* 1024 \* 1024\)\)\)/);
  assert.ok(match, "não achei LOGO_MAX_BYTES no backend");
  assert.equal(Number(match[1]) * 1024 * 1024, UPLOAD_MAX_BYTES);
});
