import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SEND_SIDE,
  bestIndex,
  dishesNeedingPhoto,
  exposureFactor,
  fileKind,
  fitWithin,
  frameScore,
  photoErrorText,
  photoPrompt,
  photoSummary,
  sampleTimes,
} from "../../frontend/src/photos/photoLogic.ts";

/** Builds canvas-like pixel data from a function (x, y) => gray value. */
function pixels(width, height, gray) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = gray(x, y);
      const p = (y * width + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = value;
      data[p + 3] = 255;
    }
  }
  return data;
}

const checker = (x, y) => (((x >> 1) + (y >> 1)) % 2 === 0 ? 170 : 90); // sharp detail, mid light
const blurred = (x, y) => 130 + Math.round(((x + y) % 4) - 1.5); // almost flat, mid light

test("fileKind: by reported type first, by name when the phone reports nothing", () => {
  assert.equal(fileKind({ type: "image/jpeg", name: "a.jpg" }), "image");
  assert.equal(fileKind({ type: "video/mp4", name: "a.mp4" }), "video");
  assert.equal(fileKind({ type: "", name: "IMG_0001.HEIC" }), "image");
  assert.equal(fileKind({ type: "", name: "VID_0001.MP4" }), "video");
  assert.equal(fileKind({ type: "application/pdf", name: "a.pdf" }), "other");
  assert.equal(fileKind({}), "other");
  assert.equal(fileKind({ type: "IMAGE/PNG" }), "image");
});

test("fitWithin: shrinks the long side, keeps the shape, never enlarges", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(1600, 1600, 1600), { width: 1600, height: 1600 });
  assert.deepEqual(fitWithin(0, 100, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(NaN, 100, 1600), { width: 0, height: 0 });
  assert.deepEqual(fitWithin(10000, 1, 1600), { width: 1600, height: 1 });
  assert.equal(MAX_SEND_SIDE, 1600);
});

test("sampleTimes: spread over the middle, never the first or last instants", () => {
  const times = sampleTimes(10, 5);
  assert.deepEqual(times, [1, 3, 5, 7, 9]);
  assert.deepEqual(sampleTimes(10, 1), [5]);
  assert.deepEqual(sampleTimes(0), []);
  assert.deepEqual(sampleTimes(NaN), []);
  assert.deepEqual(sampleTimes(Infinity), []);
  assert.equal(sampleTimes(3).length, 8);
  for (const t of sampleTimes(3)) assert.ok(t > 0 && t < 3);
});

test("exposureFactor: dark and burnt frames are worth little", () => {
  assert.equal(exposureFactor(5), 0);
  assert.equal(exposureFactor(250), 0);
  assert.equal(exposureFactor(130), 1);
  assert.ok(exposureFactor(50) > 0 && exposureFactor(50) < 1);
  assert.ok(exposureFactor(220) > 0 && exposureFactor(220) < 1);
  assert.ok(exposureFactor(60) < exposureFactor(75));
});

test("frameScore: a sharp frame beats a blurry one", () => {
  const sharp = frameScore(pixels(60, 45, checker), 60, 45);
  const soft = frameScore(pixels(60, 45, blurred), 60, 45);
  assert.ok(sharp > soft * 10, `${sharp} vs ${soft}`);
});

test("frameScore: a sharp but black frame is worth nothing", () => {
  const dark = frameScore(pixels(60, 45, (x, y) => (checker(x, y) > 100 ? 12 : 4)), 60, 45);
  assert.equal(dark, 0);
});

test("frameScore: a well lit frame beats a dim one with the same detail", () => {
  const dim = frameScore(pixels(60, 45, (x, y) => (checker(x, y) === 170 ? 70 : 30)), 60, 45);
  const good = frameScore(pixels(60, 45, checker), 60, 45);
  assert.ok(good > dim);
});

test("frameScore: refuses data that does not match the size", () => {
  assert.equal(frameScore(new Uint8ClampedArray(10), 60, 45), 0);
  assert.equal(frameScore(new Uint8ClampedArray(0), 0, 0), 0);
  assert.equal(frameScore(pixels(2, 2, () => 100), 2, 2), 0);
});

test("bestIndex: highest wins, earliest on a tie, -1 when nothing is usable", () => {
  assert.equal(bestIndex([1, 5, 3]), 1);
  assert.equal(bestIndex([4, 4, 2]), 0);
  assert.equal(bestIndex([0, 0, 0]), -1);
  assert.equal(bestIndex([]), -1);
});

test("photoErrorText: shows our own sentences, hides browser jargon", () => {
  assert.equal(photoErrorText(new Error("A foto está escura.")), "A foto está escura.");
  assert.match(photoErrorText(new TypeError("Failed to fetch")), /internet/);
  assert.match(photoErrorText(new TypeError("NetworkError when attempting to fetch")), /internet/);
  assert.match(photoErrorText("anything"), /internet/);
  assert.match(photoErrorText(undefined), /internet/);
});

test("dishesNeedingPhoto: only dishes without a photo, malformed rows ignored", () => {
  const products = [
    { id: "1", name: "X-Burguer", thumb_url: null, image_url: null },
    { id: "2", name: "Suco", thumb_url: "/media/a/b-thumb.webp", image_url: "/media/a/b.webp" },
    { id: "3", name: "  Pastel  " },
    { id: 4, name: "Sem id válido" },
    { id: "5", name: "   " },
    null,
    "texto",
  ];
  assert.deepEqual(dishesNeedingPhoto(products), [
    { id: "1", name: "X-Burguer" },
    { id: "3", name: "Pastel" },
  ]);
  assert.deepEqual(dishesNeedingPhoto(undefined), []);
  assert.deepEqual(dishesNeedingPhoto({}), []);
});

test("photoPrompt: the first dish explains, the next ones are just the dish", () => {
  assert.match(photoPrompt("X-Burguer", 0, 5), /^Vamos colocar foto nos pratos\. X-Burguer\./);
  assert.equal(photoPrompt("Suco", 1, 5), "Suco. Tire uma foto do prato, ou toque em Pular.");
});

test("photoSummary: singular, plural and none", () => {
  assert.match(photoSummary(0), /Nenhuma foto/);
  assert.equal(photoSummary(1), "Pronto! 1 foto colocada no cardápio.");
  assert.equal(photoSummary(7), "Pronto! 7 fotos colocadas no cardápio.");
});
