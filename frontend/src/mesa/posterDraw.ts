import { POSTER_H, POSTER_W, fitFontSize, posterName, tableLabel } from "./posterLayout.ts";

export type PosterParts = {
  restaurant: string;
  tableNumber: string | number;
  /** O QR que o servidor gerou para a mesa (a imagem inteira, já com a margem). */
  qr: CanvasImageSource;
  /** A logomarca (PNG com fundo transparente). Se não carregou, o cartaz sai sem ela. */
  logo: CanvasImageSource | null;
  /** Largura e altura da logomarca, para manter a proporção. */
  logoSize?: { width: number; height: number };
};

const DISPLAY = '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';
const UI = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

// Cores da prancha de identidade (07/10): verde principal, apoio escuro, apoio claro, laranja.
const VERDE = "#2E7032";
const VERDE_ESCURO = "#1B4332";
const CREME = "#FAE9D2";
const LARANJA = "#FF6F00";
const BRASA = "#C74700";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Escreve um texto centrado, diminuindo a letra se ele não couber. Devolve o tamanho usado. */
function centered(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  family: string,
  start: number,
  min: number,
  maxWidth: number,
  color: string
): number {
  const size = fitFontSize(
    (px) => {
      ctx.font = `700 ${px}px ${family}`;
      return ctx.measureText(text).width;
    },
    maxWidth,
    start,
    min
  );
  ctx.font = `700 ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, POSTER_W / 2, y);
  return size;
}

/** Desenha o cartaz inteiro no canvas (POSTER_W x POSTER_H). */
export function drawPoster(ctx: CanvasRenderingContext2D, parts: PosterParts): void {
  const W = POSTER_W;
  const H = POSTER_H;

  // fundo: verde principal descendo para o apoio escuro
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, VERDE);
  bg.addColorStop(1, VERDE_ESCURO);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // nome do restaurante
  const name = posterName(parts.restaurant);
  if (name) centered(ctx, name, 120, UI, 56, 32, 1000, CREME);

  // título
  centered(ctx, "FAÇA SEU PEDIDO", 270, DISPLAY, 128, 70, 1060, "#FFFFFF");
  centered(ctx, "AQUI", 410, DISPLAY, 128, 70, 1060, LARANJA);

  // painel branco com o QR
  const panel = 700;
  const px = (W - panel) / 2;
  const py = 450;
  ctx.fillStyle = "rgba(0,0,0,.18)";
  roundedRect(ctx, px, py + 10, panel, panel, 52);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundedRect(ctx, px, py, panel, panel, 52);
  ctx.fill();
  const qr = panel - 100;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(parts.qr, px + 50, py + 50, qr, qr);
  ctx.imageSmoothingEnabled = true;

  // selo "Mesa N"
  const label = tableLabel(parts.tableNumber);
  ctx.font = `700 54px ${DISPLAY}`;
  const pillW = Math.max(260, ctx.measureText(label).width + 100);
  const pillH = 90;
  const pillY = py + panel + 36;
  ctx.fillStyle = BRASA;
  roundedRect(ctx, (W - pillW) / 2, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, W / 2, pillY + pillH / 2 + 2);

  // instrução
  centered(ctx, "APONTE A CÂMERA DO SEU CELULAR", pillY + pillH + 88, UI, 52, 30, 1040, "#FFFFFF");

  // logomarca em um cartão creme (as letras verdes da marca não se leem sobre o verde)
  if (parts.logo && parts.logoSize) {
    const cardH = 230;
    const logoH = 190;
    const logoW = (parts.logoSize.width / parts.logoSize.height) * logoH;
    const cardW = logoW + 90;
    const cy = H - cardH - 50;
    ctx.fillStyle = CREME;
    roundedRect(ctx, (W - cardW) / 2, cy, cardW, cardH, 40);
    ctx.fill();
    ctx.drawImage(parts.logo, (W - logoW) / 2, cy + (cardH - logoH) / 2, logoW, logoH);
  }
}
