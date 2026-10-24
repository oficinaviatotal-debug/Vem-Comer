/**
 * O desenho do cartão de um prato (a imagem que o dono posta no Instagram ou no status do WhatsApp).
 *
 * Só desenha num "papel" (canvas) que vem de fora: nada de React, nada de rede, nada de documento. O teste
 * (tests/novo/shareCardDraw.test.mjs) entrega um papel de mentira que anota cada traço e confere o que ficou escrito, onde,
 * e que nada sai da imagem. As cores são as da prancha de identidade do Vem Comer (as mesmas do cartaz da mesa).
 *
 * O desenho: a foto do prato cobre o cartão inteiro, uma sombra verde-escura sobe de baixo para o texto aparecer, o nome
 * do restaurante vai numa pílula creme no alto, e embaixo ficam o nome do prato (grande), o preço (etiqueta laranja), o
 * convite "Peça pelo celular" e o link. Sem foto, o fundo é verde com um prato abstrato (dois círculos de verde mais claro) e o nome
 * do prato ocupa o cartão. No status (9:16) o texto sobe e deixa livre o alto e o pé, onde o aplicativo põe os botões dele.
 */
import { fitFontSize } from "../mesa/posterLayout.ts";
import type { CardSpec } from "./shareLogic.ts";

/** O que o desenho usa do papel (o canvas de verdade tem tudo isto; o teste entrega um de mentira). */
export type CardContext = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "arcTo"
  | "arc"
  | "closePath"
  | "clip"
  | "fill"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "drawImage"
  | "createLinearGradient"
  | "fillStyle"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "globalAlpha"
  | "shadowColor"
  | "shadowBlur"
>;

/** A foto já carregada, com o tamanho de verdade dela (para cortar sem entortar). */
export type CardPhoto = { source: CanvasImageSource; width: number; height: number };

export const DISPLAY = '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';
export const UI = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

// Cores da prancha de identidade: verde principal, apoio escuro, apoio claro, laranja e o amarelo do sol.
export const CARD_COLORS = {
  green: "#2E7032",
  ink: "#1B4332",
  deep: "#0E281C",
  cream: "#FAE9D2",
  peach: "#FDEEDF",
  fire: "#FF6F00",
  fireEdge: "#B34700",
  sun: "#FFC83A",
  onFire: "#1B1200",
} as const;

// ---------------------------------------------------------------- contas puras

/** A parte da foto que cobre o cartão sem entortar: a foto é cortada pelo meio, nunca esticada. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!(srcW > 0) || !(srcH > 0) || !(dstW > 0) || !(dstH > 0)) return { sx: 0, sy: 0, sw: Math.max(srcW, 0), sh: Math.max(srcH, 0) };
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

/**
 * Quebra o texto em linhas que cabem em `maxWidth`, no máximo `maxLines`. Palavra comprida demais para uma linha é cortada
 * por letras; o que sobra além da última linha vira reticências. Nunca devolve linha vazia (e devolve [] só para texto vazio).
 */
export function wrapLines(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxLines < 1) return [];
  const lines: string[] = [];
  let line = "";
  const push = (value: string) => void lines.push(value);

  /** Corta uma palavra que sozinha não cabe: as letras que couberem e o resto segue na próxima linha. */
  const splitLong = (word: string): string[] => {
    const parts: string[] = [];
    let rest = word;
    while (rest.length > 0 && measure(rest) > maxWidth) {
      let end = rest.length - 1;
      while (end > 1 && measure(rest.slice(0, end)) > maxWidth) end -= 1;
      parts.push(rest.slice(0, end));
      rest = rest.slice(end);
    }
    if (rest) parts.push(rest);
    return parts;
  };

  for (const word of words) {
    for (const piece of measure(word) > maxWidth ? splitLong(word) : [word]) {
      const tryLine = line ? `${line} ${piece}` : piece;
      if (line && measure(tryLine) > maxWidth) {
        push(line);
        line = piece;
      } else {
        line = tryLine;
      }
    }
  }
  if (line) push(line);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]}…`;
  while (last.length > 2 && measure(last) > maxWidth) last = `${last.slice(0, -2).trimEnd()}…`;
  kept[maxLines - 1] = last;
  return kept;
}

/** O maior tamanho de letra (de `start` até `min`) em que o texto cabe em `maxLines` linhas; no `min` corta com reticências. */
export function fitLines(
  measureAt: (size: number, text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
  start: number,
  min: number,
): { size: number; lines: string[] } {
  for (let size = start; size >= min; size -= 4) {
    const lines = wrapLines((value) => measureAt(size, value), text, maxWidth, maxLines + 1);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: min, lines: wrapLines((value) => measureAt(min, value), text, maxWidth, maxLines) };
}

// ---------------------------------------------------------------- o desenho

function roundedRect(ctx: CardContext, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** As medidas de cada formato: margem, onde começa o texto do alto e onde termina o do pé. */
function frame(spec: CardSpec): { margin: number; top: number; bottom: number } {
  // No status o aplicativo cobre o alto (nome da conta) e o pé (campo de resposta): o texto fica no miolo.
  if (spec.format === "status") return { margin: 80, top: 250, bottom: spec.height - 330 };
  return { margin: 72, top: 72, bottom: spec.height - 72 };
}

function background(ctx: CardContext, spec: CardSpec, photo: CardPhoto | null, textTop: number): void {
  const { width, height } = spec;
  if (photo) {
    const crop = coverRect(photo.width, photo.height, width, height);
    ctx.drawImage(photo.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  } else {
    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, CARD_COLORS.green);
    base.addColorStop(1, CARD_COLORS.ink);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    // Um prato visto de cima, só em tom de verde mais claro: a borda e o fundo do prato. Dá desenho ao cartão sem foto sem
    // brigar com o nome do prato, e não vira "lama" como o laranja e o amarelo ficavam sobre o verde.
    ctx.save();
    ctx.fillStyle = CARD_COLORS.cream;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.24, width * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.24, width * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // A sombra verde-escura que sobe de baixo: é ela que deixa o texto legível sobre qualquer foto, até prato branco. Ela nasce
  // acima do bloco de texto (o nome do prato) e já chega forte onde a primeira linha começa; o alto da foto fica à mostra.
  const from = Math.max(0, textTop - 240);
  const span = height - from;
  const scrim = ctx.createLinearGradient(0, from, 0, height);
  scrim.addColorStop(0, "rgba(14, 40, 28, 0)");
  scrim.addColorStop(Math.min(0.85, Math.max(0.1, (textTop - 24 - from) / span)), "rgba(14, 40, 28, 0.76)");
  scrim.addColorStop(1, "rgba(14, 40, 28, 0.95)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, from, width, span);
}

function restaurantPill(ctx: CardContext, spec: CardSpec, margin: number, top: number): void {
  if (!spec.restaurant) return;
  const maxText = spec.width - margin * 2 - 64;
  const size = fitFontSize(
    (px) => {
      ctx.font = `700 ${px}px ${UI}`;
      return ctx.measureText(spec.restaurant).width;
    },
    maxText,
    36,
    24,
  );
  ctx.font = `700 ${size}px ${UI}`;
  const text = Math.min(ctx.measureText(spec.restaurant).width, maxText);
  const height = size + 36;
  roundedRect(ctx, margin, top, text + 64, height, height / 2);
  ctx.fillStyle = CARD_COLORS.cream;
  ctx.fill();
  ctx.fillStyle = CARD_COLORS.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(spec.restaurant, margin + 32, top + height / 2 + size * 0.35);
}

function priceTag(ctx: CardContext, spec: CardSpec, margin: number, bottom: number): number {
  const size = priceSizeOf(spec);
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const text = ctx.measureText(spec.priceText).width;
  const height = size + 48;
  const width = Math.min(text + 80, spec.width - margin * 2);
  const top = bottom - height;
  // A borda grossa embaixo e o brilho em cima: a mesma etiqueta dos botões do sistema.
  roundedRect(ctx, margin, top + 8, width, height, height / 2);
  ctx.fillStyle = CARD_COLORS.fireEdge;
  ctx.fill();
  roundedRect(ctx, margin, top, width, height, height / 2);
  ctx.fillStyle = CARD_COLORS.fire;
  ctx.fill();
  const shine = ctx.createLinearGradient(0, top, 0, top + height * 0.52);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shine;
  ctx.fill();
  ctx.fillStyle = CARD_COLORS.onFire;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(spec.priceText, margin + width / 2, top + height / 2 + size * 0.34, width - 40);
  return top;
}

const priceSizeOf = (spec: CardSpec): number => (spec.format === "status" ? 92 : 84);

/** Onde cada coisa fica, de baixo para cima (medido antes de desenhar, porque a sombra do fundo depende de onde o texto começa). */
function plan(ctx: CardContext, spec: CardSpec, margin: number, bottom: number) {
  const inner = spec.width - margin * 2;
  let y = bottom;
  const brandY = spec.brand ? y : null;
  if (spec.brand) y -= 28 + 44;

  const linkSize = fitFontSize(
    (px) => {
      ctx.font = `700 ${px}px ${UI}`;
      return ctx.measureText(spec.linkText).width;
    },
    inner,
    36,
    20,
  );
  const linkY = y;
  y -= linkSize + 16;

  const inviteY = y;
  y -= 38 + 48;

  const priceBottom = y;
  y -= priceSizeOf(spec) + 48 + 68;

  const dish = fitLines(
    (size, text) => {
      ctx.font = `700 ${size}px ${DISPLAY}`;
      return ctx.measureText(text).width;
    },
    spec.dish,
    inner,
    spec.format === "status" ? 4 : 3,
    spec.format === "status" ? 132 : 120,
    56,
  );
  const lineHeight = Math.round(dish.size * 1.06);
  const textTop = y - (dish.lines.length - 1) * lineHeight - dish.size * 0.85;
  return { brandY, linkSize, linkY, inviteY, priceBottom, dish, lineHeight, baseline: y, textTop };
}

/**
 * Desenha o cartão inteiro em `ctx`, do tamanho de `spec`. `photo` nulo = cartão sem foto (fundo verde).
 * Devolve nada: a imagem é o que ficou no papel.
 */
export function drawCard(ctx: CardContext, spec: CardSpec, photo: CardPhoto | null): void {
  const { margin, top, bottom } = frame(spec);
  const inner = spec.width - margin * 2;
  const at = plan(ctx, spec, margin, bottom);

  background(ctx, spec, photo, at.textTop);
  restaurantPill(ctx, spec, margin, top);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (at.brandY !== null) {
    ctx.font = `400 28px ${UI}`;
    ctx.fillStyle = CARD_COLORS.cream;
    ctx.globalAlpha = 0.8;
    ctx.fillText("Feito com o Vem Comer", margin, at.brandY);
    ctx.globalAlpha = 1;
  }

  ctx.font = `700 ${at.linkSize}px ${UI}`;
  ctx.fillStyle = CARD_COLORS.sun;
  ctx.fillText(spec.linkText, margin, at.linkY, inner);

  ctx.font = `400 38px ${UI}`;
  ctx.fillStyle = CARD_COLORS.cream;
  ctx.fillText("Peça pelo celular", margin, at.inviteY);

  priceTag(ctx, spec, margin, at.priceBottom);

  // O nome do prato, grande, com uma sombra leve atrás: ajuda quando a foto é clara bem onde a letra cai.
  ctx.font = `700 ${at.dish.size}px ${DISPLAY}`;
  ctx.fillStyle = CARD_COLORS.peach;
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(8, 24, 16, 0.5)";
  ctx.shadowBlur = 16;
  for (let index = at.dish.lines.length - 1; index >= 0; index -= 1) {
    ctx.fillText(at.dish.lines[index], margin, at.baseline - (at.dish.lines.length - 1 - index) * at.lineHeight, inner);
  }
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 0;
}
