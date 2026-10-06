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
  routeSpeech,
  cleanDictatedText,
  parseSpokenNumber,
  matchChoice,
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

test("on a step with a field, a longer phrase is the answer, not a command", () => {
  // "pronto" alone means next...
  assert.deepEqual(routeSpeech("pronto", "text"), { kind: "command", command: "next" });
  assert.deepEqual(routeSpeech("pode seguir", "text"), { kind: "command", command: "next" });
  // ...but inside a dish name it is just a word.
  assert.deepEqual(routeSpeech("pronto prato do dia", "text"), { kind: "dictation" });
  assert.deepEqual(routeSpeech("Combinado de 20 peças", "text"), { kind: "dictation" });
  assert.deepEqual(routeSpeech("pratos", "text"), { kind: "dictation" });
});

test("on a step without a field the old rules still apply", () => {
  assert.deepEqual(routeSpeech("quero sair"), { kind: "command", command: "skip" });
  assert.deepEqual(routeSpeech("pronto prato do dia"), { kind: "command", command: "next" });
  assert.deepEqual(routeSpeech("pratos"), { kind: "unknown" });
  assert.deepEqual(routeSpeech(""), { kind: "unknown" });
  assert.deepEqual(routeSpeech("   ", "text"), { kind: "unknown" });
});

test("dictated names are tidied: capital letter, no final punctuation, no extra spaces", () => {
  assert.equal(cleanDictatedText("pratos."), "Pratos");
  assert.equal(cleanDictatedText("  combinado   de 20 peças , "), "Combinado de 20 peças");
  assert.equal(cleanDictatedText("água mineral"), "Água mineral");
  assert.equal(cleanDictatedText(""), "");
  assert.equal(cleanDictatedText("..."), "");
  assert.equal(cleanDictatedText("a".repeat(300)).length, 100);
});

test("spoken prices become numbers a number field accepts", () => {
  const cases = {
    "49,90": "49.90",
    "R$ 49,90": "49.90",
    "49.90": "49.90",
    "49 e 90": "49.90",
    "25": "25",
    "vinte e cinco reais": "25",
    "quarenta e nove e noventa": "49.90",
    "cento e vinte e cinco": "125",
    "vinte reais e cinquenta": "20.50",
    "vinte reais e cinco": "20.05",
    "6,5": "6.50",
    "seis vírgula cinco": "6.50",
    "um real": "1",
  };
  for (const [said, expected] of Object.entries(cases)) {
    assert.equal(parseSpokenNumber(said), expected, said);
  }
});

test("a price that is not clean is refused instead of guessed", () => {
  for (const said of ["", "quero uma coca", "mil", "99999999999", "49,905", "um dois três quatro"]) {
    assert.equal(parseSpokenNumber(said), null, said);
  }
});

test("a whole number (table) takes digits or words and refuses cents", () => {
  assert.equal(parseSpokenNumber("mesa cinco", false), "5");
  assert.equal(parseSpokenNumber("12", false), "12");
  assert.equal(parseSpokenNumber("vinte e um", false), "21");
  assert.equal(parseSpokenNumber("5,5", false), null);
  assert.equal(parseSpokenNumber("49 e 90", false), null);
});

test("choosing a category by voice tolerates plurals and extra words", () => {
  const labels = ["Pratos", "Bebidas", "Sobremesas"];
  assert.equal(matchChoice("pratos", labels), 0);
  assert.equal(matchChoice("bebida", labels), 1);
  assert.equal(matchChoice("Sobremesas.", labels), 2);
  assert.equal(matchChoice("os pratos", labels), 0);
  assert.equal(matchChoice("lanches", labels), -1);
  assert.equal(matchChoice("", labels), -1);
});

test("an ambiguous category is not chosen for the person", () => {
  const labels = ["Pratos quentes", "Pratos frios"];
  assert.equal(matchChoice("pratos", labels), -1);
  assert.equal(matchChoice("pratos frios", labels), 1);
});
