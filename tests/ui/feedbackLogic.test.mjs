import test from "node:test";
import assert from "node:assert/strict";

import {
  ASK_AGAIN_AFTER_MS,
  FACES,
  askedRecently,
  feedbackPayload,
  followUp,
  markAsked,
} from "../../frontend/src/feedback/feedbackLogic.ts";

test("three faces, from bad to good", () => {
  assert.deepEqual(FACES.map((face) => face.rating), [1, 2, 3]);
  assert.match(followUp(1), /melhorar/);
  assert.match(followUp(3), /Que bom/);
});

test("the payload trims and cuts the comment", () => {
  assert.deepEqual(feedbackPayload("custos", 2, "  não   entendi  "), { context: "custos", rating: 2, comment: "não entendi" });
  assert.equal(feedbackPayload("geral", 1, "x".repeat(800)).comment.length, 500);
});

test("the same task is asked once a day, other tasks still ask", () => {
  const now = 1_000_000_000_000;
  const stored = markAsked(null, "custos", now);
  assert.equal(askedRecently(stored, "custos", now + 1000), true);
  assert.equal(askedRecently(stored, "logomarca", now + 1000), false);
  assert.equal(askedRecently(stored, "custos", now + ASK_AGAIN_AFTER_MS + 1), false);
  const both = markAsked(stored, "logomarca", now);
  assert.equal(askedRecently(both, "custos", now), true);
  assert.equal(askedRecently(both, "logomarca", now), true);
});

test("broken storage never blocks nor breaks", () => {
  assert.equal(askedRecently("isto não é json", "custos", 1), false);
  assert.equal(askedRecently(null, "custos", 1), false);
  assert.equal(JSON.parse(markAsked("[1,2]", "custos", 5)).custos, 5);
  assert.equal(JSON.parse(markAsked("{quebrado", "custos", 5)).custos, 5);
});
