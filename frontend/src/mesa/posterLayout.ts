/**
 * Cartaz de QR da mesa ("Faça seu pedido aqui"): o que vai escrito e como o texto cabe.
 * Só lógica, sem desenho, para poder ser testada. O desenho está em posterDraw.ts.
 */

/** Folha A4 em retrato a 150 pontos por polegada: nítida na impressora e leve no WhatsApp. */
export const POSTER_W = 1240;
export const POSTER_H = 1754;

const NAME_MAX = 48;

/** Nome do restaurante em uma linha: espaços de sobra tirados e corte com reticências se for muito longo. */
export function posterName(name: string): string {
  const text = name.replace(/\s+/g, " ").trim();
  if (text.length <= NAME_MAX) return text;
  return `${text.slice(0, NAME_MAX - 1).trimEnd()}…`;
}

/** "Mesa 12" */
export function tableLabel(number: string | number): string {
  const text = String(number).replace(/\s+/g, " ").trim().slice(0, 12);
  return text ? `Mesa ${text}` : "Mesa";
}

/** Nome do arquivo baixado: sem acento nem símbolo, para abrir em qualquer celular ou gráfica. */
export function posterFileName(number: string | number): string {
  const slug = String(number)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  return slug ? `cartaz-mesa-${slug}.png` : "cartaz-mesa.png";
}

/**
 * O maior tamanho de letra (de 2 em 2 pontos), até `start`, em que o texto ainda cabe em `maxWidth`.
 * Nunca fica abaixo de `min`. `widthAt` mede o texto naquele tamanho.
 */
export function fitFontSize(widthAt: (size: number) => number, maxWidth: number, start: number, min: number): number {
  let size = start;
  while (size > min && widthAt(size) > maxWidth) size -= 2;
  return Math.max(size, min);
}
