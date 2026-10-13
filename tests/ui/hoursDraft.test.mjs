import test from "node:test";
import assert from "node:assert/strict";

import {
  addShift,
  clock,
  cloneWeek,
  copyToAll,
  daysLabel,
  fromApi,
  removeShift,
  say,
  setClosed,
  setShift,
  snapshot,
  suggestedWeek,
  summary,
  toBody,
  toMinutes,
  validate,
} from "../../frontend/src/service/hoursDraft.ts";

const week = () => suggestedWeek();
const day = (w, n) => w.find((d) => d.weekday === n);

test("times read and write both ways", () => {
  assert.equal(toMinutes("18:30"), 18 * 60 + 30);
  assert.equal(toMinutes("18h"), 18 * 60);
  assert.equal(toMinutes("8:05"), 8 * 60 + 5);
  assert.equal(toMinutes("24:00"), 0);
  assert.equal(toMinutes("25:00"), null);
  assert.equal(toMinutes("12:60"), null);
  assert.equal(toMinutes(""), null);
  assert.equal(toMinutes(null), null);
  assert.equal(clock(18 * 60 + 5), "18:05");
  assert.equal(clock(-60), "23:00");
  assert.equal(say(18 * 60), "18h");
  assert.equal(say(18 * 60 + 5), "18h05");
});

test("suggested week: monday to saturday 11h to 22h, sunday closed", () => {
  const w = week();
  assert.equal(w.length, 7);
  assert.deepEqual(day(w, 0).shifts, [{ opens: "11:00", closes: "22:00" }]);
  assert.equal(day(w, 6).closed, true);
  assert.deepEqual(validate(w), []);
});

test("fromApi: nothing saved gives the suggestion; a missing day is a closed one", () => {
  assert.equal(snapshot(fromApi(null)), snapshot(week()));
  assert.equal(snapshot(fromApi({ configured: false, week: [] })), snapshot(week()));
  const w = fromApi({
    configured: true,
    week: [{ weekday: 2, closed: false, shifts: [{ opens: "09:00", closes: "12:00" }] }],
  });
  assert.equal(w.length, 7);
  assert.equal(day(w, 2).closed, false);
  assert.equal(day(w, 0).closed, true);
  assert.deepEqual(day(w, 0).shifts, []);
  // a day marked open with no shift is a closed one
  const odd = fromApi({ configured: true, week: [{ weekday: 1, closed: false, shifts: [] }] });
  assert.equal(day(odd, 1).closed, true);
});

test("opening a closed day gives it a normal shift; closing drops its shifts", () => {
  let w = setClosed(week(), 6, false);
  assert.equal(day(w, 6).closed, false);
  assert.deepEqual(day(w, 6).shifts, [{ opens: "11:00", closes: "22:00" }]);
  w = setClosed(w, 6, true);
  assert.deepEqual(day(w, 6), { weekday: 6, closed: true, shifts: [] });
});

test("second shift: the long default day becomes lunch and dinner; at most two; the only one removed closes the day", () => {
  let w = addShift(week(), 0);
  assert.deepEqual(day(w, 0).shifts, [
    { opens: "11:00", closes: "15:00" },
    { opens: "18:00", closes: "22:00" },
  ]);
  assert.deepEqual(validate(w), []);
  // not a third one
  assert.equal(day(addShift(w, 0), 0).shifts.length, 2);
  w = removeShift(w, 0, 1);
  assert.equal(day(w, 0).shifts.length, 1);
  w = removeShift(w, 0, 0);
  assert.deepEqual(day(w, 0), { weekday: 0, closed: true, shifts: [] });
  // a closed day takes no shift
  assert.equal(day(addShift(w, 0), 0).shifts.length, 0);
});

test("second shift after a short first one: dinner, or an hour after the first if that is later", () => {
  let w = setShift(week(), 0, 0, { opens: "08:00", closes: "12:00" });
  assert.deepEqual(day(addShift(w, 0), 0).shifts[1], { opens: "18:00", closes: "23:00" });
  w = setShift(week(), 0, 0, { opens: "16:00", closes: "17:30" });
  assert.deepEqual(day(addShift(w, 0), 0).shifts[1], { opens: "18:30", closes: "23:00" });
  // a dinner-only day: the second shift still fits before midnight and validates
  w = setShift(week(), 0, 0, { opens: "19:00", closes: "22:30" });
  const dinner = addShift(w, 0);
  assert.equal(day(dinner, 0).shifts.length, 2);
  assert.ok(day(dinner, 0).shifts.every((shift) => toMinutes(shift.opens) !== null && toMinutes(shift.closes) !== null));
});

test("copy to all days", () => {
  const w = copyToAll(setShift(week(), 2, 0, { opens: "08:00", closes: "17:00" }), 2);
  for (const d of w) assert.deepEqual(d.shifts, [{ opens: "08:00", closes: "17:00" }]);
  // the copies do not share their shifts
  w[0].shifts[0].opens = "09:00";
  assert.equal(w[1].shifts[0].opens, "08:00");
  // copying a closed day closes all
  const closed = copyToAll(setClosed(week(), 3, true), 3);
  assert.ok(closed.every((d) => d.closed));
});

test("validate: the problems the owner reads", () => {
  let w = setShift(week(), 0, 0, { opens: "" });
  assert.deepEqual(validate(w), ["segunda: preencha a hora de abrir e a de fechar."]);
  w = setShift(week(), 0, 0, { opens: "10:00", closes: "10:00" });
  assert.ok(validate(w)[0].startsWith("segunda: abrir e fechar na mesma hora"));
  // overnight is fine
  w = setShift(week(), 4, 0, { opens: "18:00", closes: "02:00" });
  assert.deepEqual(validate(w), []);
  // ...unless it runs into the next day's opening
  w = setShift(w, 5, 0, { opens: "01:00", closes: "05:00" });
  assert.ok(validate(w).some((p) => p.includes("se cruzam")));
  // sunday night into monday morning wraps the week (and ends at 03h: no clash with a monday at 11h)
  let wrap = setClosed(week(), 6, false);
  wrap = setShift(wrap, 6, 0, { opens: "20:00", closes: "03:00" });
  assert.deepEqual(validate(wrap), []);
  wrap = setShift(wrap, 0, 0, { opens: "01:00", closes: "05:00" });
  assert.ok(validate(wrap).some((p) => p.includes("se cruzam")));
});

test("toBody sends seven days, closed ones with no shifts, and copies", () => {
  const w = week();
  const body = toBody(w);
  assert.equal(body.week.length, 7);
  assert.deepEqual(body.week[6], { weekday: 6, closed: true, shifts: [] });
  body.week[0].shifts[0].opens = "01:00";
  assert.equal(day(w, 0).shifts[0].opens, "11:00");
});

test("snapshot tells a change from no change", () => {
  const w = week();
  assert.equal(snapshot(w), snapshot(cloneWeek(w)));
  assert.notEqual(snapshot(w), snapshot(setShift(w, 0, 0, { closes: "23:00" })));
});

test("days label", () => {
  assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6]), "Todos os dias");
  assert.equal(daysLabel([0, 1, 2, 3, 4]), "Seg a sex");
  assert.equal(daysLabel([5, 6]), "Sáb e dom");
  assert.equal(daysLabel([0, 2, 4]), "Seg, qua e sex");
  assert.equal(daysLabel([0, 1, 2, 3, 4, 6]), "Seg a sex e dom");
  assert.equal(daysLabel([6]), "Dom");
  assert.equal(daysLabel([]), "");
});

test("summary groups equal days", () => {
  assert.equal(summary(week()), "Seg a sáb 11h às 22h · Dom fechado");
  let w = addShift(week(), 0);
  assert.equal(summary(w), "Seg 11h às 15h e 18h às 22h · Ter a sáb 11h às 22h · Dom fechado");
  w = setClosed(week(), 2, true);
  assert.equal(summary(w), "Seg a ter 11h às 22h · Qua fechado · Qui a sáb 11h às 22h · Dom fechado");
});
