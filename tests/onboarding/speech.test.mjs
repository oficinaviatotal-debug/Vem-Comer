import test from "node:test";
import assert from "node:assert/strict";

import { pickVoice, voiceScore } from "../../frontend/src/onboarding/speech.ts";

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
