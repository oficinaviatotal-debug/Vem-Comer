import test from "node:test";
import assert from "node:assert/strict";

import { serverVoiceBudgetMs, usesNaturalVoice, voiceTier } from "../../frontend/src/voice/voiceQuality.ts";
import { pickVoice, rankVoices, voiceScore } from "../../frontend/src/onboarding/speech.ts";

test("the connection decides the tier", () => {
  assert.equal(voiceTier({ effectiveType: "2g" }), "leve");
  assert.equal(voiceTier({ effectiveType: "slow-2g" }), "leve");
  assert.equal(voiceTier({ effectiveType: "4g", saveData: true }), "leve");
  assert.equal(voiceTier({ effectiveType: "4g" }, false), "leve");
  assert.equal(voiceTier({ effectiveType: "3g" }), "media");
  assert.equal(voiceTier({ effectiveType: "4g", downlink: 0.4 }), "media");
  assert.equal(voiceTier({ effectiveType: "4g", downlink: 10 }), "plena");
  // Safari and Firefox do not say: the time budget protects a slow connection
  assert.equal(voiceTier(undefined), "plena");
  assert.equal(voiceTier(null), "plena");
});

test("the natural voice is never asked on 2G, and waits longer on 3G", () => {
  assert.equal(usesNaturalVoice("leve", true), false);
  assert.equal(usesNaturalVoice("media", true), true);
  assert.equal(usesNaturalVoice("plena", true), true);
  assert.equal(usesNaturalVoice("plena", false), false);
  assert.equal(serverVoiceBudgetMs("leve"), 0);
  assert.ok(serverVoiceBudgetMs("media") > serverVoiceBudgetMs("plena"));
});

const VOICES = [
  { name: "Português (Brasil) local", lang: "pt-BR", localService: true },
  { name: "Google português do Brasil", lang: "pt-BR", localService: false },
];

test("on 2G the phone's stored voice wins over the network voice", () => {
  assert.equal(rankVoices(VOICES)[0].name, "Google português do Brasil");
  assert.equal(rankVoices(VOICES, "leve")[0].name, "Português (Brasil) local");
  assert.ok(voiceScore("Google português do Brasil", "pt-BR", false, "leve") > 0, "still usable when it is the only one");
});

test("a chosen network voice gives way on 2G only when a stored one exists", () => {
  assert.equal(pickVoice(VOICES, "Google português do Brasil").name, "Google português do Brasil");
  assert.equal(pickVoice(VOICES, "Google português do Brasil", "leve").name, "Português (Brasil) local");
  assert.equal(pickVoice([VOICES[1]], "Google português do Brasil", "leve").name, "Google português do Brasil");
  assert.equal(pickVoice(VOICES, "Português (Brasil) local", "plena").name, "Português (Brasil) local");
});
