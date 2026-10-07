/**
 * A parte da logomarca que usa o navegador: esperar as fontes da marca, desenhar no canvas,
 * gerar o arquivo PNG e preparar a logomarca que o dono já tem. Conferida num navegador de verdade.
 */

import { openBitmap, prepareImage } from "../photos/photoFiles";
import { fitWithin } from "../photos/photoLogic";
import { drawLogo } from "./logoDraw";
import { LOGO_SIZE, UPLOAD_MAX_SIDE, imageTypeOf, planUpload, type LogoSpec } from "./logoLogic";

const CANNOT_MAKE = "Não consegui montar a logomarca aqui. Tente de novo.";
const CANNOT_OPEN = "Não consegui abrir essa imagem. Escolha outra, em PNG ou JPG.";

let fontsReady: Promise<void> | null = null;

/**
 * Espera as fontes da marca ficarem prontas, para o nome sair na letra certa e medido certo.
 * Se demorar (internet fraca) segue com a letra do aparelho: a logomarca sai um pouco diferente, mas sai.
 */
export function loadLogoFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        if (!document.fonts || typeof document.fonts.load !== "function") return;
        const loaded = Promise.all([
          document.fonts.load('700 48px "Bricolage Grotesque"'),
          document.fonts.load('700 48px "Instrument Sans"'),
        ]);
        await Promise.race([loaded, new Promise((resolve) => window.setTimeout(resolve, 4000))]);
      } catch {
        // sem as fontes da marca o canvas usa a letra do aparelho
      }
    })();
  }
  return fontsReady;
}

/** Desenha a logomarca no canvas, com `pixels` de lado. Devolve true se o nome ficou cortado. */
export function paintLogo(canvas: HTMLCanvasElement, spec: LogoSpec, pixels: number): boolean {
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext("2d");
  if (!context) return false;
  return drawLogo(context, spec, pixels);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(CANNOT_MAKE))), type, quality);
  });
}

/** O arquivo PNG (512 x 512, fundo transparente fora da forma) da logomarca escolhida. */
export async function renderLogoPng(spec: LogoSpec): Promise<Blob> {
  await loadLogoFonts();
  const canvas = document.createElement("canvas");
  paintLogo(canvas, spec, LOGO_SIZE);
  return canvasToBlob(canvas, "image/png");
}

/**
 * Prepara a logomarca que o dono já tem. PNG e JPG pequenos seguem como estão (o servidor confere e
 * reduz); os grandes são reduzidos aqui para o envio ser rápido no 3G. PNG continua PNG, para não perder a transparência.
 */
export async function prepareLogoFile(file: File): Promise<Blob> {
  const type = imageTypeOf(file.name, file.type);
  const plan = planUpload(type, file.size);
  if (plan === "refuse") throw new Error("Esse arquivo não é uma imagem PNG ou JPG. Escolha outra.");
  if (plan === "send-as-is") return file;
  if (plan === "shrink-jpeg") return prepareImage(file, UPLOAD_MAX_SIDE, 0.92);

  const opened = await openBitmap(file).catch(() => {
    throw new Error(CANNOT_OPEN);
  });
  try {
    const size = fitWithin(opened.width, opened.height, UPLOAD_MAX_SIDE);
    if (size.width === 0) throw new Error(CANNOT_OPEN);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(CANNOT_OPEN);
    context.drawImage(opened.source, 0, 0, size.width, size.height);
    return await canvasToBlob(canvas, "image/png");
  } finally {
    opened.close();
  }
}
