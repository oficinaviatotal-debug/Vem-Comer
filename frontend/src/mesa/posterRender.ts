import { POSTER_H, POSTER_W } from "./posterLayout.ts";
import { drawPoster } from "./posterDraw.ts";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

type RenderInfo = { restaurant: string; tableNumber: string | number; qr: string };

/** Monta o cartaz e devolve uma imagem PNG (data URL). Falha se o QR não carregar. */
export async function renderPoster(info: RenderInfo): Promise<string> {
  try {
    // as letras da marca precisam estar carregadas antes de desenhar, senão o cartaz sai com a letra do sistema
    await Promise.all([
      document.fonts.load('700 100px "Bricolage Grotesque"'),
      document.fonts.load('700 40px "Instrument Sans"'),
    ]);
  } catch {
    // sem as letras da marca o cartaz sai com a letra do sistema, e ainda sai
  }
  const [qr, logo] = await Promise.all([loadImage(info.qr), loadImage("/logo-vem-comer.png").catch(() => null)]);

  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  drawPoster(ctx, {
    restaurant: info.restaurant,
    tableNumber: info.tableNumber,
    qr,
    logo,
    logoSize: logo ? { width: logo.naturalWidth, height: logo.naturalHeight } : undefined,
  });
  return canvas.toDataURL("image/png");
}

/** Abre a impressão só com o cartaz (o resto da tela some na impressão, pelo poster.css). */
export function printPoster(url: string): void {
  const holder = document.createElement("div");
  holder.className = "poster-print";
  const img = new Image();
  img.alt = "";
  img.src = url;
  holder.appendChild(img);
  document.body.appendChild(holder);

  const clean = () => {
    holder.remove();
    window.removeEventListener("afterprint", clean);
  };
  window.addEventListener("afterprint", clean);
  img
    .decode()
    .catch(() => undefined)
    .then(() => {
      window.print();
      // alguns navegadores de celular não avisam quando a impressão termina
      window.setTimeout(clean, 120000);
    });
}
