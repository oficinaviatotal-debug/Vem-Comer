/**
 * "Refinar" a logomarca que o dono já tem: tirar a margem vazia em volta (fundo transparente ou de uma cor só),
 * centralizar num quadrado com um respiro e avisar quando a logomarca é clara demais para o fundo branco do cardápio.
 * Uma logomarca com muita margem vazia aparece minúscula no selo de 40 px do cliente; esta regra devolve o tamanho.
 *
 * Aqui só tem conta com os pixels (RGBA, como o canvas entrega), sem navegador: dá para testar tudo pelo Node.
 * A parte que abre a imagem e desenha no canvas está em logoFiles.ts.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export type Background = { kind: "transparent" } | { kind: "solid"; r: number; g: number; b: number };

/** Abaixo disso o pixel conta como transparente. */
const ALPHA_EMPTY = 16;
/** Quanto os pixels da borda podem diferir entre si e ainda contar como "uma cor só" (JPG tem ruído). */
const SOLID_TOLERANCE = 18;
/** Soma das diferenças de R, G e B para um pixel deixar de ser "fundo". */
const CONTENT_DISTANCE = 48;
/** Quanto da borda precisa ser fundo para valer a pena cortar. Foto com borda variada não é cortada. */
const BORDER_SHARE = 0.9;
/** Respiro em volta do desenho, em parte do lado maior. */
export const PADDING = 0.06;
/** Só refina se o desenho ocupa menos que isso da imagem, em largura ou em altura. */
export const WORTH_SHARE = 0.85;

type Pixels = ArrayLike<number>;

function borderPixels(width: number, height: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = 0; x < width; x += 1) {
    out.push([x, 0]);
    if (height > 1) out.push([x, height - 1]);
  }
  for (let y = 1; y < height - 1; y += 1) {
    out.push([0, y]);
    if (width > 1) out.push([width - 1, y]);
  }
  return out;
}

/** O que há na borda da imagem: nada (transparente), uma cor só, ou outra coisa (null: não mexer). */
export function detectBackground(data: Pixels, width: number, height: number): Background | null {
  if (width < 2 || height < 2 || data.length < width * height * 4) return null;
  const border = borderPixels(width, height);
  let transparent = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let opaque = 0;
  for (const [x, y] of border) {
    const i = (y * width + x) * 4;
    if (data[i + 3] <= ALPHA_EMPTY) {
      transparent += 1;
    } else if (data[i + 3] >= 240) {
      opaque += 1;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
    }
  }
  if (transparent / border.length >= BORDER_SHARE) return { kind: "transparent" };
  if (opaque / border.length < BORDER_SHARE) return null;

  const r = Math.round(sumR / opaque);
  const g = Math.round(sumG / opaque);
  const b = Math.round(sumB / opaque);
  let near = 0;
  for (const [x, y] of border) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 240) continue;
    if (Math.max(Math.abs(data[i] - r), Math.abs(data[i + 1] - g), Math.abs(data[i + 2] - b)) <= SOLID_TOLERANCE) near += 1;
  }
  return near / border.length >= BORDER_SHARE ? { kind: "solid", r, g, b } : null;
}

function isContent(data: Pixels, i: number, background: Background): boolean {
  if (data[i + 3] <= ALPHA_EMPTY) return false;
  if (background.kind === "transparent") return true;
  const distance =
    Math.abs(data[i] - background.r) + Math.abs(data[i + 1] - background.g) + Math.abs(data[i + 2] - background.b);
  return distance > CONTENT_DISTANCE;
}

/** O menor retângulo que contém o desenho. Poeira solta (um ou dois pixels) não conta. Null se não há desenho. */
export function contentBox(data: Pixels, width: number, height: number, background: Background): Rect | null {
  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isContent(data, (y * width + x) * 4, background)) {
        rows[y] += 1;
        cols[x] += 1;
      }
    }
  }
  // uma linha ou coluna só conta com alguns pixels de desenho: um ou dois pixels soltos são poeira da imagem
  const minRow = Math.max(2, Math.round(width * 0.006));
  const minCol = Math.max(2, Math.round(height * 0.006));
  const top = rows.findIndex((count) => count >= minRow);
  const left = cols.findIndex((count) => count >= minCol);
  if (top < 0 || left < 0) return null;
  let bottom = height - 1;
  while (bottom > top && rows[bottom] < minRow) bottom -= 1;
  let right = width - 1;
  while (right > left && cols[right] < minCol) right -= 1;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Vale a pena refinar? Só quando a margem vazia é grande o bastante para o desenho sair maior. */
export function worthRefining(width: number, height: number, box: Rect): boolean {
  return box.width <= width * WORTH_SHARE || box.height <= height * WORTH_SHARE;
}

export type RefinePlan = {
  /** O pedaço da imagem original que vira o desenho. */
  source: Rect;
  /** O lado do quadrado novo. */
  side: number;
  /** Onde e com que tamanho o desenho cai no quadrado novo. */
  dest: Rect;
};

/** O quadrado novo: o desenho no centro, com respiro, sem passar de `maxSide` e sem esticar nada. */
export function refinePlan(box: Rect, maxSide: number): RefinePlan {
  const longest = Math.max(box.width, box.height);
  const pad = Math.round(longest * PADDING);
  const natural = longest + pad * 2;
  const scale = natural > maxSide ? maxSide / natural : 1;
  const side = Math.max(1, Math.round(natural * scale));
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));
  return {
    source: box,
    side,
    dest: { x: Math.round((side - width) / 2), y: Math.round((side - height) / 2), width, height },
  };
}

/**
 * Logomarca clara demais: desenho quase todo branco sobre fundo transparente some no selo branco do cardápio.
 * Logomarca com fundo próprio (cor sólida) tem a sua cor e não entra aqui.
 */
export function looksTooLight(data: Pixels, width: number, height: number, background: Background | null): boolean {
  if (!background || background.kind !== "transparent") return false;
  let strong = 0;
  let sum = 0;
  for (let i = 0; i < width * height * 4; i += 4) {
    if (data[i + 3] < 128) continue;
    strong += 1;
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  if (strong < width * height * 0.002) return false;
  return sum / strong >= 0.9;
}

export type Review = {
  /** Há margem vazia a tirar: a versão refinada fica diferente da original. */
  refine: RefinePlan | null;
  /** O fundo, para pintar o quadrado novo da mesma cor. */
  background: Background | null;
  /** O desenho é claro demais para o selo branco do cardápio. */
  tooLight: boolean;
  /** O desenho, depois de cortado, tem menos que isso de lado: vai sair borrado no cardápio. */
  small: boolean;
};

/** Lado mínimo do desenho para ficar nítido no selo do cardápio (que mostra 40 px, em telas de 3x). */
export const SMALL_SIDE = 120;

/** Tudo que a tela "Ficou bom?" precisa saber sobre a imagem. */
export function reviewLogo(data: Pixels, width: number, height: number, maxSide: number): Review {
  const background = detectBackground(data, width, height);
  const box = background ? contentBox(data, width, height, background) : null;
  const refine = box && worthRefining(width, height, box) ? refinePlan(box, maxSide) : null;
  const drawn = box ?? { x: 0, y: 0, width, height };
  return {
    refine,
    background,
    tooLight: looksTooLight(data, width, height, background),
    small: Math.max(drawn.width, drawn.height) < SMALL_SIDE,
  };
}
