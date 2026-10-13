import test from "node:test";
import assert from "node:assert/strict";

import {
  PADDING,
  SMALL_SIDE,
  contentBox,
  detectBackground,
  looksTooLight,
  refinePlan,
  reviewLogo,
  worthRefining,
} from "../../frontend/src/logo/logoRefine.ts";

/** Uma imagem RGBA de mentira: fundo `bg` ([r,g,b,a]) e retângulos pintados por cima. */
function image(width, height, bg, rects = [], noise = 0) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const n = noise ? ((i * 7919) % (noise * 2 + 1)) - noise : 0; // ruído de JPG, sempre o mesmo
    data[i * 4] = bg[0] + n;
    data[i * 4 + 1] = bg[1] + n;
    data[i * 4 + 2] = bg[2] + n;
    data[i * 4 + 3] = bg[3];
  }
  for (const { x, y, w, h, color } of rects) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) data.set(color, (yy * width + xx) * 4);
    }
  }
  return data;
}

const CLEAR = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];
const RED = [200, 30, 30, 255];
const BLACK = [20, 20, 20, 255];

test("a transparent border is a transparent background", () => {
  assert.deepEqual(detectBackground(image(100, 100, CLEAR), 100, 100), { kind: "transparent" });
});

test("a border of one color is a solid background, even with JPG noise", () => {
  assert.deepEqual(detectBackground(image(100, 100, WHITE), 100, 100), { kind: "solid", r: 255, g: 255, b: 255 });
  const noisy = detectBackground(image(100, 100, [240, 240, 240, 255], [], 6), 100, 100);
  assert.equal(noisy.kind, "solid");
  assert.ok(Math.abs(noisy.r - 240) <= 6);
});

test("a photo-like border is left alone", () => {
  const data = image(100, 100, WHITE);
  for (let x = 0; x < 100; x += 1) data.set(x % 2 ? RED : BLACK, x * 4); // a borda de cima listrada
  for (let y = 0; y < 100; y += 1) data.set(y % 2 ? RED : BLACK, (y * 100) * 4); // e a da esquerda
  assert.equal(detectBackground(data, 100, 100), null);
});

test("garbage input never throws", () => {
  assert.equal(detectBackground(new Uint8ClampedArray(0), 0, 0), null);
  assert.equal(detectBackground(new Uint8ClampedArray(8), 100, 100), null);
  assert.equal(detectBackground(new Uint8ClampedArray(4), 1, 1), null);
});

test("the content box wraps the drawing and ignores a speck of dust", () => {
  const data = image(200, 200, CLEAR, [{ x: 60, y: 80, w: 70, h: 40, color: RED }]);
  data.set(RED, (5 * 200 + 190) * 4); // um pixel solto longe do desenho
  const box = contentBox(data, 200, 200, { kind: "transparent" });
  assert.deepEqual(box, { x: 60, y: 80, width: 70, height: 40 });
});

test("on a solid white background the drawing is what differs from white", () => {
  const data = image(200, 200, WHITE, [{ x: 50, y: 50, w: 100, h: 100, color: RED }]);
  assert.deepEqual(contentBox(data, 200, 200, { kind: "solid", r: 255, g: 255, b: 255 }), { x: 50, y: 50, width: 100, height: 100 });
});

test("an empty image has no content box", () => {
  assert.equal(contentBox(image(50, 50, CLEAR), 50, 50, { kind: "transparent" }), null);
});

test("it only refines when the margin is worth removing", () => {
  assert.equal(worthRefining(200, 200, { x: 50, y: 50, width: 100, height: 100 }), true);
  assert.equal(worthRefining(200, 200, { x: 5, y: 5, width: 190, height: 190 }), false);
  assert.equal(worthRefining(200, 200, { x: 0, y: 40, width: 200, height: 100 }), true);
  assert.equal(worthRefining(200, 200, { x: 0, y: 0, width: 200, height: 200 }), false);
});

test("the new square has the drawing in the middle with a little air", () => {
  const plan = refinePlan({ x: 60, y: 80, width: 100, height: 50 }, 1024);
  const pad = Math.round(100 * PADDING);
  assert.equal(plan.side, 100 + pad * 2);
  assert.deepEqual(plan.dest, { x: pad, y: Math.round((plan.side - 50) / 2), width: 100, height: 50 });
  assert.deepEqual(plan.source, { x: 60, y: 80, width: 100, height: 50 });
});

test("a big drawing is scaled down to fit, never stretched", () => {
  const plan = refinePlan({ x: 0, y: 0, width: 2000, height: 1000 }, 1024);
  assert.equal(plan.side, 1024);
  assert.ok(plan.dest.width <= 1024 && plan.dest.height <= 1024);
  assert.ok(Math.abs(plan.dest.width / plan.dest.height - 2) < 0.01);
  const small = refinePlan({ x: 0, y: 0, width: 80, height: 80 }, 1024);
  assert.equal(small.dest.width, 80); // pequeno continua pequeno
});

test("a white drawing on transparent disappears on the white badge", () => {
  const white = image(100, 100, CLEAR, [{ x: 20, y: 20, w: 60, h: 60, color: WHITE }]);
  assert.equal(looksTooLight(white, 100, 100, { kind: "transparent" }), true);
  const red = image(100, 100, CLEAR, [{ x: 20, y: 20, w: 60, h: 60, color: RED }]);
  assert.equal(looksTooLight(red, 100, 100, { kind: "transparent" }), false);
  // fundo próprio (cor sólida) tem a sua cor: não é aviso
  assert.equal(looksTooLight(image(100, 100, WHITE), 100, 100, { kind: "solid", r: 255, g: 255, b: 255 }), false);
  assert.equal(looksTooLight(red, 100, 100, null), false);
});

test("the review of a logo lost in a big empty image", () => {
  const data = image(400, 400, CLEAR, [{ x: 150, y: 160, w: 100, h: 80, color: RED }]);
  const review = reviewLogo(data, 400, 400, 1024);
  assert.ok(review.refine);
  assert.deepEqual(review.refine.source, { x: 150, y: 160, width: 100, height: 80 });
  assert.equal(review.tooLight, false);
  assert.equal(review.small, true); // 100 px de desenho: nítido só até uns 33 px na tela de 3x
});

test("the review of a logo that already fills its image changes nothing", () => {
  const data = image(400, 400, WHITE, [{ x: 8, y: 8, w: 384, h: 384, color: RED }]);
  const review = reviewLogo(data, 400, 400, 1024);
  assert.equal(review.refine, null);
  assert.equal(review.small, false);
});

test("the review of a photo does not cut anything", () => {
  const data = image(300, 300, WHITE);
  for (let i = 0; i < 300; i += 1) {
    data.set(i % 3 ? RED : BLACK, i * 4);
    data.set(i % 3 ? BLACK : RED, (i * 300) * 4);
  }
  const review = reviewLogo(data, 300, 300, 1024);
  assert.equal(review.refine, null);
  assert.equal(review.background, null);
});

test("small means smaller than the sharp limit", () => {
  const data = image(500, 500, CLEAR, [{ x: 100, y: 100, w: SMALL_SIDE, h: 40, color: RED }]);
  assert.equal(reviewLogo(data, 500, 500, 1024).small, false);
  const tiny = image(500, 500, CLEAR, [{ x: 100, y: 100, w: SMALL_SIDE - 1, h: 40, color: RED }]);
  assert.equal(reviewLogo(tiny, 500, 500, 1024).small, true);
});
