/**
 * Os desenhos de comida da logomarca, feitos com traços de canvas (nada de imagens prontas:
 * cada um é original, em formas simples que continuam claras em tamanho pequeno).
 *
 * Cada desenho cabe numa caixa de -1 a 1 nos dois eixos; quem chama move e aumenta com translate/scale.
 * Usa só três cores, para o desenho ficar legível sobre qualquer fundo:
 *   fg      a forma principal;
 *   detail  detalhes e uma segunda parte do prato;
 *   cut     a cor do fundo, usada para abrir vãos entre as partes.
 */

import type { FoodId } from "./logoLogic.ts";

export type Tones = { fg: string; detail: string; cut: string };

/** O pedaço do CanvasRenderingContext2D que os desenhos usam (e que o teste imita). */
export type Pen = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

function disc(c: Pen, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.closePath();
}

/** Retângulo de cantos redondos feito só com arcTo (funciona em todo celular). */
function pill(c: Pen, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Pinta a forma que está no caminho atual. Com `gap`, antes abre um vão (traço na cor do fundo)
 * em volta dela, para ela se separar da parte que está atrás.
 */
function paint(c: Pen, color: string, cut: string, gap = 0): void {
  c.lineJoin = "round";
  c.lineCap = "round";
  if (gap > 0) {
    c.lineWidth = gap * 2;
    c.strokeStyle = cut;
    c.stroke();
  }
  c.fillStyle = color;
  c.fill();
}

/** Forma cheia com pontas arredondadas (um traço da mesma cor em volta). */
function paintRounded(c: Pen, color: string, width: number): void {
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = width;
  c.strokeStyle = color;
  c.stroke();
  c.fillStyle = color;
  c.fill();
}

function line(c: Pen, color: string, width: number, points: Array<[number, number]>): void {
  c.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
  c.lineWidth = width;
  c.strokeStyle = color;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}

/* ------------------------------------------------------------------ desenhos */

function pizza(c: Pen, t: Tones): void {
  // fatia com a ponta para baixo
  c.beginPath();
  c.moveTo(-0.84, -0.46);
  c.lineTo(0, 0.9);
  c.lineTo(0.84, -0.46);
  c.closePath();
  paintRounded(c, t.fg, 0.16);
  // borda
  pill(c, -0.96, -0.88, 1.92, 0.46, 0.23);
  paint(c, t.detail, t.cut, 0.06);
  // calabresa
  disc(c, -0.3, -0.08, 0.15);
  paint(c, t.cut, t.cut);
  disc(c, 0.28, 0.0, 0.13);
  paint(c, t.cut, t.cut);
  disc(c, -0.02, 0.4, 0.12);
  paint(c, t.cut, t.cut);
}

function hamburguer(c: Pen, t: Tones): void {
  // pão de cima
  c.beginPath();
  c.moveTo(-0.92, -0.14);
  c.bezierCurveTo(-0.96, -1.22, 0.96, -1.22, 0.92, -0.14);
  c.closePath();
  paintRounded(c, t.fg, 0.08);
  // gergelim
  const seeds: Array<[number, number, number]> = [
    [-0.4, -0.56, -0.5],
    [0.02, -0.72, 0.2],
    [0.42, -0.54, 0.5],
    [-0.12, -0.36, 0.3],
    [0.3, -0.3, -0.3],
  ];
  for (const [x, y, turn] of seeds) {
    c.beginPath();
    c.ellipse(x, y, 0.075, 0.04, turn, 0, TAU);
    c.fillStyle = t.cut;
    c.fill();
  }
  // alface ondulada
  c.beginPath();
  c.moveTo(-0.96, -0.06);
  c.lineTo(0.96, -0.06);
  for (let i = 0; i < 6; i += 1) {
    const x = 0.96 - i * 0.32;
    c.quadraticCurveTo(x - 0.16, 0.26, x - 0.32, 0.02);
  }
  c.closePath();
  paint(c, t.detail, t.cut, 0.06);
  // carne
  pill(c, -0.9, 0.22, 1.8, 0.26, 0.13);
  paint(c, t.fg, t.cut, 0.06);
  // pão de baixo
  pill(c, -0.86, 0.54, 1.72, 0.36, 0.18);
  paint(c, t.fg, t.cut, 0.06);
}

function cachorroQuente(c: Pen, t: Tones): void {
  c.save();
  c.translate(0.03, 0);
  c.rotate(-0.28);
  c.scale(0.88, 0.88);
  // pão
  pill(c, -0.9, -0.02, 1.8, 0.7, 0.35);
  paintRounded(c, t.fg, 0.04);
  // salsicha por cima
  pill(c, -1.0, -0.4, 2.0, 0.44, 0.22);
  paint(c, t.detail, t.cut, 0.07);
  // mostarda em zigue-zague
  line(c, t.cut, 0.07, [
    [-0.78, -0.2],
    [-0.52, -0.3],
    [-0.26, -0.1],
    [0, -0.3],
    [0.26, -0.1],
    [0.52, -0.3],
    [0.78, -0.2],
  ]);
  // pontinhos no pão
  for (const x of [-0.45, 0, 0.45]) {
    disc(c, x, 0.36, 0.045);
    c.fillStyle = t.cut;
    c.fill();
  }
  c.restore();
}

function sorvete(c: Pen, t: Tones): void {
  const cone = () => {
    c.beginPath();
    c.moveTo(-0.52, 0.0);
    c.lineTo(0.52, 0.0);
    c.lineTo(0, 0.96);
    c.closePath();
  };
  cone();
  paintRounded(c, t.fg, 0.08);
  // casquinha xadrez
  c.save();
  cone();
  c.clip();
  line(c, t.cut, 0.05, [[-0.5, 0.12], [0.2, 0.82]]);
  line(c, t.cut, 0.05, [[-0.2, 0.0], [0.5, 0.7]]);
  line(c, t.cut, 0.05, [[0.5, 0.1], [-0.2, 0.8]]);
  line(c, t.cut, 0.05, [[0.2, 0.0], [-0.5, 0.7]]);
  c.restore();
  // bola de baixo, com a "saia" derretida
  disc(c, 0, -0.2, 0.6);
  paint(c, t.detail, t.cut, 0.06);
  for (const x of [-0.4, 0, 0.4]) {
    disc(c, x, 0.12, 0.16);
    paint(c, t.detail, t.cut);
  }
  // bola de cima
  disc(c, 0, -0.66, 0.31);
  paint(c, t.fg, t.cut, 0.06);
}

function acai(c: Pen, t: Tones): void {
  // pé da tigela
  pill(c, -0.36, 0.7, 0.72, 0.18, 0.09);
  paint(c, t.fg, t.cut);
  // tigela
  c.beginPath();
  c.moveTo(-0.94, 0.02);
  c.bezierCurveTo(-0.94, 0.98, 0.94, 0.98, 0.94, 0.02);
  c.closePath();
  paintRounded(c, t.fg, 0.06);
  // açaí, em montinho
  c.beginPath();
  c.moveTo(-0.84, 0.04);
  c.bezierCurveTo(-0.9, -1.0, 0.9, -1.0, 0.84, 0.04);
  c.closePath();
  paint(c, t.detail, t.cut, 0.07);
  // rodelas de banana
  for (const [x, y] of [[-0.4, -0.2], [0.02, -0.44], [0.42, -0.18]]) {
    disc(c, x, y, 0.14);
    paint(c, t.fg, t.cut, 0.04);
  }
  // granola
  for (const [x, y] of [[-0.14, -0.1], [0.24, -0.1], [-0.62, 0.0], [0.65, 0.0]]) {
    disc(c, x, y, 0.04);
    c.fillStyle = t.cut;
    c.fill();
  }
}

function prato(c: Pen, t: Tones): void {
  // prato
  disc(c, 0, 0.02, 0.6);
  paint(c, t.fg, t.cut);
  disc(c, 0, 0.02, 0.45);
  paint(c, t.cut, t.cut);
  disc(c, 0, 0.02, 0.3);
  paint(c, t.detail, t.cut);
  // garfo
  for (const x of [-0.97, -0.855, -0.74]) {
    line(c, t.fg, 0.07, [[x, -0.9], [x, -0.4]]);
  }
  pill(c, -1.005, -0.48, 0.3, 0.24, 0.12);
  paint(c, t.fg, t.cut);
  line(c, t.fg, 0.13, [[-0.855, -0.3], [-0.855, 0.9]]);
  // faca
  c.beginPath();
  c.moveTo(0.74, -0.92);
  c.bezierCurveTo(1.06, -0.84, 1.06, -0.28, 0.92, -0.06);
  c.lineTo(0.92, 0.84);
  c.quadraticCurveTo(0.92, 0.94, 0.83, 0.94);
  c.quadraticCurveTo(0.74, 0.94, 0.74, 0.84);
  c.closePath();
  paintRounded(c, t.fg, 0.03);
}

function frango(c: Pen, t: Tones): void {
  c.save();
  c.translate(0.1, 0.06);
  c.rotate(-0.62);
  c.scale(1.03, 1.03);
  // osso
  line(c, t.detail, 0.2, [[0, 0.1], [0, 0.7]]);
  for (const x of [-0.13, 0.13]) {
    disc(c, x, 0.82, 0.15);
    c.fillStyle = t.detail;
    c.fill();
  }
  // carne, mais larga em cima e estreita perto do osso
  c.beginPath();
  c.moveTo(0, 0.2);
  c.bezierCurveTo(-0.26, 0.18, -0.64, -0.08, -0.64, -0.44);
  c.bezierCurveTo(-0.64, -0.82, -0.26, -0.96, 0.04, -0.96);
  c.bezierCurveTo(0.4, -0.96, 0.64, -0.72, 0.62, -0.38);
  c.bezierCurveTo(0.6, -0.08, 0.28, 0.18, 0, 0.2);
  c.closePath();
  paint(c, t.fg, t.cut, 0.06);
  // brilho
  c.beginPath();
  c.arc(0, -0.46, 0.4, Math.PI * 0.95, Math.PI * 1.4);
  c.lineWidth = 0.07;
  c.strokeStyle = t.cut;
  c.lineCap = "round";
  c.stroke();
  c.restore();
}

function pastel(c: Pen, t: Tones): void {
  c.save();
  c.translate(-0.12, 0);
  c.scale(0.86, 0.86);
  c.rotate(-0.42);
  c.translate(0, 0.14);
  // massa, em meia-lua
  c.beginPath();
  c.moveTo(-1.0, 0.18);
  c.arc(0, 0.18, 1.0, Math.PI, Math.PI * 2);
  c.closePath();
  paintRounded(c, t.fg, 0.04);
  // recheio aparecendo pela borda reta
  pill(c, -1.0, 0.14, 2.0, 0.26, 0.13);
  paint(c, t.detail, t.cut, 0.06);
  // fecho com garfo, ao longo da borda curva
  for (let i = 0; i < 9; i += 1) {
    const turn = Math.PI + 0.3 + i * ((Math.PI - 0.6) / 8);
    disc(c, Math.cos(turn) * 0.84, 0.18 + Math.sin(turn) * 0.84, 0.05);
    c.fillStyle = t.cut;
    c.fill();
  }
  // bolhinhas da massa frita
  for (const [x, y, r] of [[-0.32, -0.12, 0.09], [0.14, -0.38, 0.07], [0.34, -0.04, 0.1]]) {
    disc(c, x, y, r);
    c.fillStyle = t.detail;
    c.fill();
  }
  c.restore();
}

function bolo(c: Pen, t: Tones): void {
  // forminha
  c.beginPath();
  c.moveTo(-0.62, 0.14);
  c.lineTo(0.62, 0.14);
  c.lineTo(0.44, 0.92);
  c.lineTo(-0.44, 0.92);
  c.closePath();
  paintRounded(c, t.fg, 0.1);
  line(c, t.cut, 0.05, [[-0.3, 0.26], [-0.22, 0.82]]);
  line(c, t.cut, 0.05, [[0, 0.26], [0, 0.82]]);
  line(c, t.cut, 0.05, [[0.3, 0.26], [0.22, 0.82]]);
  // cobertura em três camadas
  pill(c, -0.84, -0.2, 1.68, 0.38, 0.19);
  paint(c, t.detail, t.cut, 0.06);
  pill(c, -0.62, -0.5, 1.24, 0.36, 0.18);
  paint(c, t.detail, t.cut, 0.06);
  pill(c, -0.4, -0.76, 0.8, 0.32, 0.16);
  paint(c, t.detail, t.cut, 0.06);
  // cereja
  disc(c, 0.02, -0.86, 0.12);
  paint(c, t.fg, t.cut, 0.04);
}

function cafe(c: Pen, t: Tones): void {
  // alça (atrás da xícara)
  c.beginPath();
  c.arc(0.64, 0.14, 0.27, 0, TAU);
  c.lineWidth = 0.13;
  c.strokeStyle = t.fg;
  c.stroke();
  // xícara
  c.beginPath();
  c.moveTo(-0.74, -0.1);
  c.lineTo(0.58, -0.1);
  c.lineTo(0.58, 0.3);
  c.quadraticCurveTo(0.58, 0.8, 0.08, 0.8);
  c.lineTo(-0.24, 0.8);
  c.quadraticCurveTo(-0.74, 0.8, -0.74, 0.3);
  c.closePath();
  paintRounded(c, t.fg, 0.04);
  // pires
  pill(c, -0.96, 0.84, 1.92, 0.14, 0.07);
  paint(c, t.detail, t.cut);
  // fumaça
  for (const x of [-0.42, -0.08, 0.26]) {
    c.beginPath();
    c.moveTo(x, -0.3);
    c.bezierCurveTo(x - 0.2, -0.46, x + 0.2, -0.62, x, -0.82);
    c.lineWidth = 0.09;
    c.strokeStyle = t.detail;
    c.lineCap = "round";
    c.stroke();
  }
}

function suco(c: Pen, t: Tones): void {
  // canudo
  line(c, t.fg, 0.1, [[0.1, 0.2], [0.28, -0.9], [0.52, -0.97]]);
  // copo
  const glass = () => {
    c.beginPath();
    c.moveTo(-0.52, -0.5);
    c.lineTo(0.52, -0.5);
    c.lineTo(0.38, 0.92);
    c.lineTo(-0.38, 0.92);
    c.closePath();
  };
  c.save();
  glass();
  c.clip();
  c.fillStyle = t.detail;
  c.fillRect(-1, -0.18, 2, 1.2);
  c.restore();
  glass();
  c.lineWidth = 0.11;
  c.strokeStyle = t.fg;
  c.lineJoin = "round";
  c.stroke();
  // gelo
  for (const [x, y] of [[-0.14, 0.2], [0.14, 0.52]]) {
    pill(c, x - 0.1, y - 0.1, 0.2, 0.2, 0.05);
    c.fillStyle = t.cut;
    c.fill();
  }
  // rodela de limão no copo
  disc(c, -0.5, -0.5, 0.3);
  paint(c, t.fg, t.cut, 0.05);
  disc(c, -0.5, -0.5, 0.21);
  paint(c, t.detail, t.cut);
  for (const turn of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const dx = Math.cos(turn) * 0.21;
    const dy = Math.sin(turn) * 0.21;
    line(c, t.fg, 0.04, [[-0.5 - dx, -0.5 - dy], [-0.5 + dx, -0.5 + dy]]);
  }
}

function sushi(c: Pen, t: Tones): void {
  const maki = (x: number, y: number) => {
    disc(c, x, y, 0.46);
    paint(c, t.fg, t.cut);
    disc(c, x, y, 0.33);
    paint(c, t.cut, t.cut);
    disc(c, x, y, 0.16);
    paint(c, t.detail, t.cut);
  };
  maki(-0.5, -0.34);
  maki(0.5, -0.34);
  maki(0, 0.5);
}

function geral(c: Pen, t: Tones): void {
  // gorro de cozinheiro: três "nuvens" em cima e a faixa embaixo
  for (const [x, y, r] of [[-0.5, -0.28, 0.4], [0.5, -0.28, 0.4], [0, -0.52, 0.46]]) {
    disc(c, x, y, r);
    c.fillStyle = t.fg;
    c.fill();
  }
  pill(c, -0.62, -0.1, 1.24, 0.62, 0.08);
  c.fillStyle = t.fg;
  c.fill();
  line(c, t.cut, 0.05, [[-0.22, 0.04], [-0.22, 0.3]]);
  line(c, t.cut, 0.05, [[0.22, 0.04], [0.22, 0.3]]);
  pill(c, -0.62, 0.44, 1.24, 0.48, 0.1);
  paint(c, t.detail, t.cut, 0.07);
}

export type Glyph = (pen: Pen, tones: Tones) => void;

export const GLYPHS: Readonly<Record<FoodId, Glyph>> = {
  pizza,
  hamburguer,
  "cachorro-quente": cachorroQuente,
  sorvete,
  acai,
  prato,
  frango,
  pastel,
  bolo,
  cafe,
  suco,
  sushi,
  geral,
};

/** Desenha o prato `food` com o centro em (cx, cy) e raio `r` (a caixa -1..1 vira o círculo de raio r). */
export function drawGlyph(pen: Pen, food: FoodId, cx: number, cy: number, r: number, tones: Tones): void {
  pen.save();
  pen.translate(cx, cy);
  pen.scale(r, r);
  GLYPHS[food](pen, tones);
  pen.restore();
}
