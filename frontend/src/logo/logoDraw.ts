/**
 * Desenha a logomarca inteira (fundo, desenho de comida ou iniciais, e o nome) em um canvas.
 * As regras de cor, medida e encaixe do nome estão em logoLogic.ts; os desenhos de comida em logoGlyphs.ts.
 * Esta parte usa o canvas do navegador, então é conferida num navegador de verdade.
 */

import { drawGlyph, type Pen } from "./logoGlyphs.ts";
import {
  LAYOUTS,
  LINE_HEIGHT,
  LOGO_SIZE,
  colorsFor,
  fitName,
  initialsOf,
  paletteById,
  usesInitials,
  type LogoColors,
  type LogoSpec,
  type Palette,
  type TemplateId,
} from "./logoLogic.ts";

/** As fontes da marca; se alguma não carregar, o navegador usa a próxima. */
export const LOGO_FONT = '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';

function fontOf(size: number): string {
  return `700 ${size}px ${LOGO_FONT}`;
}

function roundedRect(pen: Pen, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  pen.beginPath();
  pen.moveTo(x + r, y);
  pen.arcTo(x + w, y, x + w, y + h, r);
  pen.arcTo(x + w, y + h, x, y + h, r);
  pen.arcTo(x, y + h, x, y, r);
  pen.arcTo(x, y, x + w, y, r);
  pen.closePath();
}

function circle(pen: Pen, radius: number): void {
  pen.beginPath();
  pen.arc(LOGO_SIZE / 2, LOGO_SIZE / 2, radius, 0, Math.PI * 2);
  pen.closePath();
}

/* ------------------------------------------------------------------ fundos */

function drawSelo(pen: Pen, _palette: Palette, colors: LogoColors): void {
  circle(pen, 252);
  pen.fillStyle = colors.field;
  pen.fill();
  circle(pen, 228);
  pen.lineWidth = 8;
  pen.strokeStyle = colors.rim;
  pen.stroke();
}

function drawQuadrado(pen: Pen, _palette: Palette, colors: LogoColors): void {
  roundedRect(pen, 0, 0, LOGO_SIZE, LOGO_SIZE, 92);
  pen.fillStyle = colors.field;
  pen.fill();
  pen.save();
  roundedRect(pen, 0, 0, LOGO_SIZE, LOGO_SIZE, 92);
  pen.clip();
  pen.fillStyle = colors.band ?? colors.field;
  pen.fillRect(0, 332, LOGO_SIZE, LOGO_SIZE - 332);
  pen.fillStyle = colors.rim;
  pen.fillRect(0, 326, LOGO_SIZE, 7);
  pen.restore();
}

function drawClaro(pen: Pen, _palette: Palette, colors: LogoColors): void {
  roundedRect(pen, 6, 6, LOGO_SIZE - 12, LOGO_SIZE - 12, 84);
  pen.fillStyle = colors.field;
  pen.fill();
  pen.lineWidth = 12;
  pen.strokeStyle = colors.rim;
  pen.stroke();
  // fio de destaque entre o desenho e o nome
  roundedRect(pen, LOGO_SIZE / 2 - 56, 308, 112, 9, 4.5);
  pen.fillStyle = colors.glyphDetail;
  pen.fill();
}

function drawRedondo(pen: Pen, palette: Palette, colors: LogoColors): void {
  circle(pen, 252);
  pen.fillStyle = colors.field;
  pen.fill();
  circle(pen, 236);
  pen.lineWidth = 26;
  pen.strokeStyle = palette.main;
  pen.stroke();
  circle(pen, 249);
  pen.lineWidth = 6;
  pen.strokeStyle = colors.rim;
  pen.stroke();
  circle(pen, 220);
  pen.lineWidth = 4;
  pen.strokeStyle = colors.rim;
  pen.stroke();
}

function drawToldo(pen: Pen, palette: Palette, colors: LogoColors): void {
  roundedRect(pen, 6, 6, LOGO_SIZE - 12, LOGO_SIZE - 12, 70);
  pen.fillStyle = colors.field;
  pen.fill();
  // marquise listrada com a barra em "dentes de serra" arredondados
  pen.save();
  roundedRect(pen, 6, 6, LOGO_SIZE - 12, LOGO_SIZE - 12, 70);
  pen.clip();
  const stripes = 8;
  const width = LOGO_SIZE / stripes;
  const bottom = 128;
  for (let i = 0; i < stripes; i += 1) {
    const x = i * width;
    pen.fillStyle = i % 2 === 0 ? palette.main : "#FFFFFF";
    pen.fillRect(x, 0, width + 0.5, bottom);
    pen.beginPath();
    pen.arc(x + width / 2, bottom, width / 2, 0, Math.PI);
    pen.closePath();
    pen.fill();
  }
  pen.restore();
  // contorno das listras, para as brancas se enxergarem no fundo claro
  pen.save();
  roundedRect(pen, 6, 6, LOGO_SIZE - 12, LOGO_SIZE - 12, 70);
  pen.clip();
  pen.beginPath();
  pen.moveTo(0, bottom);
  for (let i = 0; i < stripes; i += 1) {
    pen.arc(i * width + width / 2, bottom, width / 2, Math.PI, 0, true);
  }
  pen.lineWidth = 5;
  pen.strokeStyle = colors.rim;
  pen.stroke();
  pen.restore();
  roundedRect(pen, 6, 6, LOGO_SIZE - 12, LOGO_SIZE - 12, 70);
  pen.lineWidth = 12;
  pen.strokeStyle = colors.rim;
  pen.stroke();
}

const BACKGROUNDS: Record<TemplateId, (pen: Pen, palette: Palette, colors: LogoColors) => void> = {
  selo: drawSelo,
  quadrado: drawQuadrado,
  claro: drawClaro,
  redondo: drawRedondo,
  letras: drawQuadrado,
  toldo: drawToldo,
};

/* ------------------------------------------------------------------ texto */

function drawInitials(pen: Pen, spec: LogoSpec, colors: LogoColors): void {
  const { glyph } = LAYOUTS[spec.template];
  const letters = initialsOf(spec.name);
  if (letters === "") return;
  const size = letters.length > 1 ? 200 : 250;
  pen.font = fontOf(size);
  pen.fillStyle = colors.glyphFg;
  pen.textAlign = "center";
  pen.textBaseline = "alphabetic";
  // centraliza pelo desenho real da letra, não pelo espaço da linha
  const metrics = pen.measureText(letters);
  const ascent = metrics.actualBoundingBoxAscent || size * 0.7;
  const descent = metrics.actualBoundingBoxDescent || 0;
  pen.fillText(letters, glyph.cx, glyph.cy + (ascent - descent) / 2);
}

/** Escreve o nome. Devolve true se algum pedaço teve de ser cortado com "…" por ser comprido demais. */
function drawName(pen: Pen, spec: LogoSpec, colors: LogoColors): boolean {
  const layout = LAYOUTS[spec.template];
  const measure = (text: string, size: number) => {
    pen.font = fontOf(size);
    return pen.measureText(text).width;
  };
  const fit = fitName(spec.name, layout.name.width, measure, {
    maxSize: layout.maxSize,
    minSize: layout.minSize,
    maxLines: layout.maxLines,
    height: layout.name.height,
  });
  if (fit.lines.length === 0) return false;

  const lineHeight = fit.size * LINE_HEIGHT;
  const block = lineHeight * fit.lines.length;
  const first = layout.name.top + layout.name.height / 2 - block / 2 + lineHeight / 2;
  pen.font = fontOf(fit.size);
  pen.fillStyle = colors.nameInk;
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  fit.lines.forEach((text, index) => {
    pen.fillText(text, layout.name.cx, first + index * lineHeight);
  });
  return fit.truncated;
}

/* ------------------------------------------------------------------ logomarca */

/**
 * Desenha a logomarca `spec` num canvas, ocupando um quadrado de `size` pixels a partir do canto.
 * O fundo fora da forma fica transparente. Devolve true se o nome teve de ser cortado (comprido demais).
 */
export function drawLogo(pen: Pen, spec: LogoSpec, size: number = LOGO_SIZE): boolean {
  const palette = paletteById(spec.palette);
  const colors = colorsFor(spec.template, palette);
  const layout = LAYOUTS[spec.template];

  pen.save();
  pen.clearRect(0, 0, size, size);
  pen.scale(size / LOGO_SIZE, size / LOGO_SIZE);

  BACKGROUNDS[spec.template](pen, palette, colors);

  if (usesInitials(spec.template)) {
    drawInitials(pen, spec, colors);
  } else {
    drawGlyph(pen, spec.food, layout.glyph.cx, layout.glyph.cy, layout.glyph.r, {
      fg: colors.glyphFg,
      detail: colors.glyphDetail,
      cut: colors.glyphCut,
    });
  }

  const cut = drawName(pen, spec, colors);
  pen.restore();
  return cut;
}
