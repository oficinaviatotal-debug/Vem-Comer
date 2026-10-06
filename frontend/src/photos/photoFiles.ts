/**
 * Turns what the phone hands over (a photo of any size, or a video) into one light JPEG
 * ready to send. This is the part that touches the browser (canvas, video), so it is
 * checked in a real browser rather than from Node.
 */

import {
  MAX_SEND_SIDE,
  MAX_VIDEO_SECONDS,
  MENU_SEND_QUALITY,
  MENU_SEND_SIDE,
  SCORE_WIDTH,
  SEND_QUALITY,
  bestIndex,
  fileKind,
  fitWithin,
  frameScore,
  sampleTimes,
} from "./photoLogic";

const CANNOT_OPEN_PHOTO =
  "Não consegui abrir essa foto aqui. Tire a foto de novo pela câmera, ou escolha outra.";
const CANNOT_OPEN_VIDEO =
  "Não consegui abrir esse vídeo aqui. Grave de novo pela câmera, ou tire uma foto.";

function canvasToJpeg(canvas: HTMLCanvasElement, quality = SEND_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(CANNOT_OPEN_PHOTO))),
      "image/jpeg",
      quality
    );
  });
}

/** Opens a photo with its rotation already applied (a phone held sideways must come out upright). */
async function openBitmap(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // falls through to the <img> route below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } catch {
    throw new Error(CANNOT_OPEN_PHOTO);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A photo, shrunk to what the menu can use and saved as JPEG. Makes uploads fast on mobile data. */
export async function prepareImage(file: Blob, maxSide = MAX_SEND_SIDE, quality = SEND_QUALITY): Promise<Blob> {
  const opened = await openBitmap(file);
  try {
    const size = fitWithin(opened.width, opened.height, maxSide);
    if (size.width === 0) throw new Error(CANNOT_OPEN_PHOTO);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(CANNOT_OPEN_PHOTO);
    context.drawImage(opened.source, 0, 0, size.width, size.height);
    return await canvasToJpeg(canvas, quality);
  } finally {
    opened.close();
  }
}

/** One page of a whole menu: bigger than a dish photo, so the small print stays readable for the AI. */
export async function prepareMenuPage(file: File): Promise<Blob> {
  if (fileKind(file) !== "image") {
    throw new Error("Esse arquivo não é uma foto. Tire uma foto do cardápio.");
  }
  return prepareImage(file, MENU_SEND_SIDE, MENU_SEND_QUALITY);
}

function waitFor(target: HTMLVideoElement, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(CANNOT_OPEN_VIDEO));
    }, ms);
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(CANNOT_OPEN_VIDEO));
    };
    function cleanup() {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

async function seek(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (Math.abs(video.currentTime - seconds) < 0.001) return;
  const arrived = waitFor(video, "seeked", 8000);
  video.currentTime = seconds;
  await arrived;
}

/** Looks at a few moments of the video and keeps the sharpest, best lit one as a photo. */
export async function bestFrameFromVideo(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const ready = waitFor(video, "loadedmetadata", 15000);
    video.src = url;
    await ready;

    const { duration, videoWidth, videoHeight } = video;
    if (!Number.isFinite(duration) || duration <= 0 || !videoWidth || !videoHeight) {
      throw new Error(CANNOT_OPEN_VIDEO);
    }
    if (duration > MAX_VIDEO_SECONDS) {
      throw new Error("O vídeo é muito comprido. Grave só alguns segundos do prato.");
    }

    const small = fitWithin(videoWidth, videoHeight, SCORE_WIDTH);
    const probe = document.createElement("canvas");
    probe.width = small.width;
    probe.height = small.height;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    if (!probeContext) throw new Error(CANNOT_OPEN_VIDEO);

    const times = sampleTimes(duration);
    const scores: number[] = [];
    for (const time of times) {
      await seek(video, time);
      probeContext.drawImage(video, 0, 0, small.width, small.height);
      const pixels = probeContext.getImageData(0, 0, small.width, small.height);
      scores.push(frameScore(pixels.data, small.width, small.height));
    }

    let chosen = bestIndex(scores);
    if (chosen < 0) chosen = Math.floor(times.length / 2); // nothing stood out: take the middle
    await seek(video, times[chosen]);

    const size = fitWithin(videoWidth, videoHeight, MAX_SEND_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(CANNOT_OPEN_VIDEO);
    context.drawImage(video, 0, 0, size.width, size.height);
    return await canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

/** Whatever the person chose (photo or video) becomes one JPEG. */
export async function toSendablePhoto(file: File): Promise<Blob> {
  switch (fileKind(file)) {
    case "image":
      return prepareImage(file);
    case "video":
      return bestFrameFromVideo(file);
    default:
      throw new Error("Esse arquivo não é uma foto nem um vídeo. Tire uma foto do prato.");
  }
}
