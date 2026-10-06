/**
 * Pure rules for the photo step: which file is a photo or a video, how big to send it,
 * and how to pick the best frame out of a video. No browser APIs here, so every rule
 * can be tested from plain Node.
 */

/** The longest side of the photo sent to the server. Phones take 4000+ px; the menu never shows more than 1080. */
export const MAX_SEND_SIDE = 1600;

/** JPEG quality of the photo sent to the server (the server makes the final WebP). */
export const SEND_QUALITY = 0.9;

/** How many moments of a video are looked at to find the best one. */
export const VIDEO_SAMPLES = 8;

/** Frames are measured at this width: small enough to be fast on a cheap phone. */
export const SCORE_WIDTH = 240;

/** A video this long is not a dish clip; refuse before the phone freezes decoding it. */
export const MAX_VIDEO_SECONDS = 120;

export type FileKind = "image" | "video" | "other";

type FileLike = { type?: string; name?: string };

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i;

/** Decides by the type the phone reports, falling back to the file name (some phones report nothing). */
export function fileKind(file: FileLike): FileKind {
  const type = (file.type ?? "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  const name = file.name ?? "";
  if (IMAGE_EXT.test(name)) return "image";
  if (VIDEO_EXT.test(name)) return "video";
  return "other";
}

/** Scales (width, height) down so the longest side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Moments (in seconds) to look at, spread over the middle of the video; the first and last instants are often black or shaky. */
export function sampleTimes(duration: number, count = VIDEO_SAMPLES): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || count < 1) return [];
  if (count === 1) return [duration / 2];
  const from = duration * 0.1;
  const to = duration * 0.9;
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, index) => Number((from + step * index).toFixed(3)));
}

/**
 * How good a frame is: sharp (lots of detail in the edges) and well lit.
 * `rgba` is the canvas pixel data (4 bytes per pixel). Higher is better; 0 means unusable.
 */
export function frameScore(rgba: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3 || rgba.length < width * height * 4) return 0;

  const luma = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < luma.length; i += 1, p += 4) {
    const y = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    luma[i] = y;
    sum += y;
  }
  const mean = sum / luma.length;

  // Laplacian: how much each pixel differs from its four neighbours. Blurry frames give a small variance.
  let lapSum = 0;
  let lapSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width];
      lapSum += lap;
      lapSquares += lap * lap;
      count += 1;
    }
  }
  const mean2 = lapSum / count;
  const sharpness = lapSquares / count - mean2 * mean2;

  // A frame that is nearly black or burnt white is worth little, however sharp its noise is.
  const light = exposureFactor(mean);
  return Math.max(0, sharpness) * light;
}

/** 1 for a well lit frame, falling to 0 as it goes black or white. */
export function exposureFactor(meanLuma: number): number {
  if (meanLuma <= 20 || meanLuma >= 240) return 0;
  if (meanLuma < 80) return (meanLuma - 20) / 60;
  if (meanLuma > 200) return (240 - meanLuma) / 40;
  return 1;
}

/** Index of the best score; the earliest one wins a tie. -1 when there is nothing usable. */
export function bestIndex(scores: number[]): number {
  let best = -1;
  let bestScore = 0;
  scores.forEach((score, index) => {
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

/** The sentence shown to the owner when something goes wrong. Plain words, no technical terms. */
export function photoErrorText(reason: unknown): string {
  const text = reason instanceof Error ? reason.message : "";
  if (text && !/^(Failed|TypeError|NetworkError|Load failed)/i.test(text)) return text;
  return "Não consegui enviar a foto. Veja se o celular está com internet e tente de novo.";
}

export type SessionDish = { id: string; name: string };

type ProductLike = { id?: unknown; name?: unknown; thumb_url?: unknown; image_url?: unknown };

/** The dishes that still have no photo, in the order the server listed them. Ignores anything malformed. */
export function dishesNeedingPhoto(products: unknown): SessionDish[] {
  if (!Array.isArray(products)) return [];
  const dishes: SessionDish[] = [];
  for (const raw of products as ProductLike[]) {
    if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") continue;
    if (!raw.name.trim()) continue;
    if (raw.thumb_url || raw.image_url) continue;
    dishes.push({ id: raw.id, name: raw.name.trim() });
  }
  return dishes;
}

/** What the assistant says for each dish. Short on purpose. */
export function photoPrompt(name: string, position: number, total: number): string {
  const first = position === 0 ? "Vamos colocar foto nos pratos. " : "";
  return `${first}${name}. Tire uma foto do prato, ou toque em Pular.`;
}

/** The closing sentence, by how many photos were saved. */
export function photoSummary(saved: number): string {
  if (saved === 0) return "Nenhuma foto por enquanto. Quando quiser, é só voltar aqui.";
  if (saved === 1) return "Pronto! 1 foto colocada no cardápio.";
  return `Pronto! ${saved} fotos colocadas no cardápio.`;
}
