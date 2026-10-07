import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  DICTATION_MAX_MS,
  DICTATION_PATIENCE_MS,
  LISTEN_TIMEOUT_MS,
  REOPEN_DELAY_MS,
  startHearing,
} from "../../frontend/src/assistant/hearing.ts";

/** A fake phone recognizer: the test plays the part of the phone (words, pauses that close the microphone). */
function fakePhone() {
  const phone = {
    handlers: null,
    starts: 0,
    stops: 0,
    factory(handlers) {
      phone.handlers = handlers;
      return {
        start: () => {
          phone.starts += 1;
          handlers.onStateChange(true);
        },
        stop: () => {
          phone.stops += 1;
        },
      };
    },
    say(text, isFinal = false) {
      phone.handlers.onResult(text, isFinal);
    },
    /** The phone closes the microphone by itself (the pause after a phrase). */
    closes() {
      phone.handlers.onStateChange(false);
    },
    fails(code) {
      phone.handlers.onStateChange(false);
      phone.handlers.onError(code);
    },
  };
  return phone;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function withTimers(fn) {
  return async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      await fn();
    } finally {
      mock.timers.reset();
    }
  };
}

test("short answer: the phrase the phone closes is the answer", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, {});
  phone.say("sim", false);
  phone.say("sim senhor", true);
  assert.equal(await hearing.result, "sim senhor");
  assert.equal(phone.starts, 1);
}));

test("short answer: the phone closing the microphone ends it with the last words", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, {});
  phone.say("pronto", false);
  phone.closes();
  assert.equal(await hearing.result, "pronto");
}));

test("short answer: an error means nothing was heard", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, {});
  phone.fails("no-speech");
  assert.equal(await hearing.result, null);
}));

test("short answer: gives up after the timeout, and never reopens the microphone", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, {});
  mock.timers.tick(LISTEN_TIMEOUT_MS);
  assert.equal(await hearing.result, null);
  assert.equal(phone.starts, 1);
}));

test("no recognizer in this browser: null at once", withTimers(async () => {
  const hearing = startHearing(() => null, { patienceMs: DICTATION_PATIENCE_MS });
  assert.equal(await hearing.result, null);
}));

test("dictation: a pause that closes the microphone does not end it, the microphone opens again", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.say("x-tudo 25 reais", true);
  phone.closes();
  assert.equal(phone.starts, 1);
  mock.timers.tick(REOPEN_DELAY_MS);
  assert.equal(phone.starts, 2, "listens again by itself");
  phone.say("coca lata 6", true);
  phone.closes();
  mock.timers.tick(REOPEN_DELAY_MS);
  assert.equal(phone.starts, 3);
  mock.timers.tick(DICTATION_PATIENCE_MS);
  assert.equal(await hearing.result, "x-tudo 25 reais coca lata 6");
}));

test("dictation: waits the full patience before answering, not a moment less", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  let done = false;
  hearing.result.then(() => {
    done = true;
  });
  phone.say("x-tudo 25", true);
  mock.timers.tick(DICTATION_PATIENCE_MS - 1);
  await flush();
  assert.equal(done, false);
  mock.timers.tick(1);
  assert.equal(await hearing.result, "x-tudo 25");
  assert.equal(phone.stops, 1, "the microphone is closed when it finishes");
}));

test("dictation: every new word restarts the wait", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  let done = false;
  hearing.result.then(() => {
    done = true;
  });
  phone.say("x-tudo", false);
  mock.timers.tick(DICTATION_PATIENCE_MS - 500);
  phone.say("x-tudo 25", false);
  mock.timers.tick(DICTATION_PATIENCE_MS - 500);
  await flush();
  assert.equal(done, false, "still talking, not cut");
  mock.timers.tick(500);
  assert.equal(await hearing.result, "x-tudo 25");
}));

test("dictation: words of a round the phone closed without a final result are kept", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.say("x-tudo 25", false);
  phone.closes();
  mock.timers.tick(REOPEN_DELAY_MS);
  phone.say("coca 6", false);
  mock.timers.tick(DICTATION_PATIENCE_MS);
  assert.equal(await hearing.result, "x-tudo 25 coca 6");
}));

test("dictation: the screen gets all the words so far, not only the last round", withTimers(async () => {
  const phone = fakePhone();
  const shown = [];
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS, onPartial: (text) => shown.push(text) });
  phone.say("x-tudo", false);
  phone.say("x-tudo 25", true);
  phone.closes();
  mock.timers.tick(REOPEN_DELAY_MS);
  phone.say("coca", false);
  assert.deepEqual(shown, ["x-tudo", "x-tudo 25", "x-tudo 25 coca"]);
  hearing.cancel();
}));

test("dictation: a silent round (no-speech) is not the end", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.fails("no-speech");
  mock.timers.tick(REOPEN_DELAY_MS);
  assert.equal(phone.starts, 2);
  phone.say("x-tudo 25", true);
  mock.timers.tick(DICTATION_PATIENCE_MS);
  assert.equal(await hearing.result, "x-tudo 25");
}));

test("dictation: nothing said at all ends with null after the timeout", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.fails("no-speech");
  mock.timers.tick(LISTEN_TIMEOUT_MS);
  assert.equal(await hearing.result, null);
}));

test("dictation: a microphone that cannot work ends it at once, keeping the words already heard", withTimers(async () => {
  for (const code of ["not-allowed", "audio-capture", "network"]) {
    const phone = fakePhone();
    const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
    phone.say("x-tudo 25", true);
    phone.fails(code);
    assert.equal(await hearing.result, "x-tudo 25", code);

    const empty = fakePhone();
    const none = startHearing(empty.factory, { patienceMs: DICTATION_PATIENCE_MS });
    empty.fails(code);
    assert.equal(await none.result, null, code);
    mock.timers.tick(REOPEN_DELAY_MS * 4);
    assert.equal(empty.starts, 1, "no reopening loop");
  }
}));

test("dictation: cancelling gives null and closes the microphone", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.say("x-tudo 25", true);
  hearing.cancel();
  assert.equal(await hearing.result, null);
  assert.equal(phone.stops, 1);
  mock.timers.tick(DICTATION_MAX_MS);
  phone.closes();
  mock.timers.tick(REOPEN_DELAY_MS);
  assert.equal(phone.starts, 1, "nothing reopens after cancelling");
}));

test("dictation: never goes on longer than the maximum", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS, maxMs: 30000 });
  for (let i = 0; i < 10; i += 1) {
    phone.say(`prato ${i}`, true);
    mock.timers.tick(2000);
  }
  mock.timers.tick(10000);
  assert.match(await hearing.result, /^prato 0 prato 1/);
}));

test("dictation: a microphone that closes again and again is given up on", withTimers(async () => {
  const phone = fakePhone();
  const hearing = startHearing(phone.factory, { patienceMs: DICTATION_PATIENCE_MS });
  phone.say("x-tudo 25", true);
  for (let i = 0; i < 70; i += 1) {
    phone.closes();
    mock.timers.tick(REOPEN_DELAY_MS);
  }
  assert.equal(await hearing.result, "x-tudo 25");
  assert.ok(phone.starts < 70, "does not reopen forever");
}));
