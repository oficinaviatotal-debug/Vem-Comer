import test from "node:test";
import assert from "node:assert/strict";

import { nextVoiceName, pickVoice, rankVoices, voiceScore } from "../../frontend/src/onboarding/speech.ts";

test("only Portuguese voices are candidates", () => {
  assert.equal(voiceScore("Samantha", "en-US"), -1);
  assert.equal(voiceScore("Monica", "es-ES"), -1);
  assert.ok(voiceScore("Qualquer voz", "pt-BR") > 0);
});

test("Brazilian Portuguese beats European Portuguese", () => {
  assert.ok(voiceScore("Voz", "pt-BR") > voiceScore("Voz", "pt-PT"));
  assert.ok(voiceScore("Voz", "pt_BR") > voiceScore("Voz", "pt_PT"));
});

test("natural-sounding voices win over the plain system voice", () => {
  const voices = [
    { name: "Portuguese Brazil", lang: "pt-BR" },
    { name: "Google português do Brasil", lang: "pt-BR" },
    { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" },
  ];
  assert.equal(pickVoice(voices).name, voices[2].name);
  assert.equal(pickVoice(voices.slice(0, 2)).name, voices[1].name);
});

test("compact or espeak voices are the last choice but still better than nothing", () => {
  const voices = [
    { name: "pt-br-x-abc-compact", lang: "pt-BR" },
    { name: "Voz do sistema", lang: "pt-BR" },
  ];
  assert.equal(pickVoice(voices).name, "Voz do sistema");
  assert.equal(pickVoice([voices[0]]).name, "pt-br-x-abc-compact");
});

test("no Portuguese voice means no choice (the browser default stays)", () => {
  assert.equal(pickVoice([]), undefined);
  assert.equal(pickVoice([{ name: "Samantha", lang: "en-US" }]), undefined);
});

test("voices streamed from the network beat the ones stored on the phone", () => {
  assert.ok(voiceScore("Voz", "pt-BR", false) > voiceScore("Voz", "pt-BR", true));
  assert.equal(voiceScore("Voz", "pt-BR", undefined), voiceScore("Voz", "pt-BR"));
  const voices = [
    { name: "Local", lang: "pt-BR", localService: true },
    { name: "Rede", lang: "pt-BR", localService: false },
  ];
  assert.equal(pickVoice(voices).name, "Rede");
});

test("a voice the person chose wins while it is still on the phone", () => {
  const voices = [
    { name: "Local", lang: "pt-BR", localService: true },
    { name: "Rede", lang: "pt-BR", localService: false },
  ];
  assert.equal(pickVoice(voices, "Local").name, "Local");
  assert.equal(pickVoice(voices, "Sumiu").name, "Rede");
  // A saved English voice is never used for Portuguese speech.
  assert.equal(pickVoice([...voices, { name: "Samantha", lang: "en-US" }], "Samantha").name, "Rede");
});

test("'Trocar voz' walks through the Portuguese voices and wraps around", () => {
  const voices = [
    { name: "A", lang: "pt-BR", localService: false },
    { name: "B", lang: "pt-BR", localService: true },
    { name: "C", lang: "pt-PT", localService: true },
    { name: "Samantha", lang: "en-US" },
  ];
  assert.deepEqual(rankVoices(voices).map((v) => v.name), ["A", "B", "C"]);
  assert.equal(nextVoiceName(voices, "A"), "B");
  assert.equal(nextVoiceName(voices, "B"), "C");
  assert.equal(nextVoiceName(voices, "C"), "A");
  assert.equal(nextVoiceName(voices, undefined), "A");
  assert.equal(nextVoiceName([{ name: "Samantha", lang: "en-US" }], "x"), undefined);
});
