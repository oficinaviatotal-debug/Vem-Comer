import test from "node:test";
import assert from "node:assert/strict";

import {
  startTour,
  nextStep,
  prevStep,
  skipTour,
  progressLabel,
  normalizeSpeech,
  parseTourCommand,
  applyCommand,
} from "../../frontend/src/onboarding/tourEngine.ts";

test("starts on the first step and is not done", () => {
  assert.deepEqual(startTour(), { index: 0, done: false, finished: false });
});

test("next moves forward and finishes on the last step", () => {
  let s = startTour();
  s = nextStep(s, 3);
  assert.equal(s.index, 1);
  s = nextStep(s, 3);
  assert.equal(s.index, 2);
  assert.equal(s.done, false);
  s = nextStep(s, 3);
  assert.equal(s.done, true);
  assert.equal(s.finished, true);
  assert.equal(s.index, 2);
});

test("back never goes below the first step", () => {
  const s = prevStep(startTour());
  assert.equal(s.index, 0);
  assert.equal(prevStep(nextStep(startTour(), 5)).index, 0);
});

test("skip ends the tour without marking it finished", () => {
  const s = skipTour(nextStep(startTour(), 4));
  assert.equal(s.done, true);
  assert.equal(s.finished, false);
});

test("a finished tour ignores further commands", () => {
  const done = skipTour(startTour());
  assert.equal(nextStep(done, 4), done);
  assert.equal(prevStep(done), done);
  assert.equal(skipTour(done), done);
});

test("progress label is human readable and safe with 0 steps", () => {
  assert.equal(progressLabel({ index: 1, done: false, finished: false }, 8), "Passo 2 de 8");
  assert.equal(progressLabel(startTour(), 0), "Passo 1 de 1");
});

test("speech normalization removes accents and punctuation", () => {
  assert.equal(normalizeSpeech("  Próximo passo! "), "proximo passo");
  assert.equal(normalizeSpeech("Não entendi..."), "nao entendi");
  // Regression: accents must really be stripped (a doubled backslash in the
  // regex literal once made this a no-op in another project).
  assert.equal(normalizeSpeech("Currículo"), "curriculo");
});

test("recognizes the main spoken commands, with and without accents", () => {
  assert.equal(parseTourCommand("próximo"), "next");
  assert.equal(parseTourCommand("Avançar"), "next");
  assert.equal(parseTourCommand("pode continuar"), "next");
  assert.equal(parseTourCommand("pronto"), "next");
  assert.equal(parseTourCommand("voltar"), "back");
  assert.equal(parseTourCommand("passo anterior"), "back");
  assert.equal(parseTourCommand("repetir"), "repeat");
  assert.equal(parseTourCommand("de novo"), "repeat");
  assert.equal(parseTourCommand("pular guia"), "skip");
  assert.equal(parseTourCommand("fechar"), "skip");
});

test("'nao entendi' repeats instead of skipping or advancing", () => {
  assert.equal(parseTourCommand("não entendi"), "repeat");
  // ...while a plain "entendi" means the user understood and wants to go on.
  assert.equal(parseTourCommand("entendi"), "next");
});

test("everyday confirmations move forward", () => {
  for (const phrase of ["sim", "certo", "beleza", "vamos", "concluir", "ok, pode seguir"]) {
    assert.equal(parseTourCommand(phrase), "next", phrase);
  }
});

test("unrelated or empty speech is unknown and does not match inside words", () => {
  assert.equal(parseTourCommand(""), "unknown");
  assert.equal(parseTourCommand("quero uma pizza"), "unknown");
  // "ok" must be a whole word, not part of "cookie".
  assert.equal(parseTourCommand("cookie"), "unknown");
});

test("applyCommand updates the state and keeps it on repeat/unknown", () => {
  const s0 = startTour();
  assert.equal(applyCommand(s0, "next", 5).index, 1);
  assert.equal(applyCommand(nextStep(s0, 5), "back", 5).index, 0);
  assert.equal(applyCommand(s0, "repeat", 5), s0);
  assert.equal(applyCommand(s0, "unknown", 5), s0);
  assert.equal(applyCommand(s0, "skip", 5).done, true);
});
