import { drawCard, type CardPhoto } from "./shareCardDraw";
import type { CardSpec } from "./shareLogic";

/**
 * O cartão de um prato, montado no próprio celular (nada sobe para o servidor): carrega as letras da marca e a foto, desenha
 * no papel (`shareCardDraw.ts`) e entrega uma imagem PNG. Aqui mora só o que fala com o navegador; as contas e o desenho
 * são testados no Node.
 */

const FONTS = ['700 100px "Bricolage Grotesque"', '700 40px "Instrument Sans"', '400 28px "Instrument Sans"'];

function loadPhoto(src: string): Promise<CardPhoto> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Foto de outro endereço sem permissão suja o papel e o navegador não deixa salvar a imagem; sem a permissão a foto nem carrega,
    // e o cartão sai sem foto em vez de não sair.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("photo"));
    img.src = src;
  });
}

function paint(spec: CardSpec, photo: CardPhoto | null): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));
  drawCard(ctx, spec, photo);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png"));
}

/** Monta o cartão e devolve a imagem. Sem a foto (não carregou, ou sujou o papel) devolve o cartão sem foto. */
export async function renderCard(spec: CardSpec): Promise<Blob> {
  try {
    // As letras da marca precisam estar carregadas antes de desenhar, senão o cartão sai com a letra do sistema.
    await Promise.all(FONTS.map((font) => document.fonts.load(font)));
  } catch {
    // sem as letras da marca o cartão sai com a letra do sistema, e ainda sai
  }
  const photo = spec.photo ? await loadPhoto(spec.photo).catch(() => null) : null;
  try {
    return await paint(spec, photo);
  } catch (failure) {
    if (!photo) throw failure;
    return paint(spec, null);
  }
}

/** O celular sabe mandar uma imagem direto para outro aplicativo (menu "Compartilhar")? */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File([new Blob(["x"])], "cartao.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** Abre o menu de compartilhar do celular com a imagem e o texto. Quem recebe é a pessoa quem escolhe lá. */
export async function sendCard(blob: Blob, fileName: string, text: string): Promise<"sent" | "canceled" | "failed"> {
  try {
    const file = new File([blob], fileName, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return "failed";
    await navigator.share({ files: [file], text });
    return "sent";
  } catch (failure) {
    // A pessoa fechou o menu sem escolher: não é erro.
    return failure instanceof DOMException && failure.name === "AbortError" ? "canceled" : "failed";
  }
}

/** Baixa a imagem para a galeria ou a pasta de downloads. */
export function downloadCard(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
