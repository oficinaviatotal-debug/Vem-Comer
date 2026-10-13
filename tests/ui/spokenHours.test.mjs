import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenHours } from "../../frontend/src/service/spokenHours.ts";
import { suggestedWeek, validate, summary } from "../../frontend/src/service/hoursDraft.ts";

const parse = (text, week = suggestedWeek()) => parseSpokenHours(text, week);
const day = (out, weekday) => out.week.find((d) => d.weekday === weekday);
const shifts = (out, weekday) => day(out, weekday).shifts.map((s) => `${s.opens}-${s.closes}`);

test("the whole week in one breath", () => {
  const out = parse("de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado");
  for (const d of [0, 1, 2, 3, 4]) assert.deepEqual(shifts(out, d), ["11:00-15:00", "18:00-23:00"]);
  assert.deepEqual(shifts(out, 5), ["11:00-23:00"]);
  assert.equal(day(out, 6).closed, true);
  assert.deepEqual(day(out, 6).shifts, []);
  assert.deepEqual(out.lines, [
    "Seg a sex: 11h às 15h e 18h às 23h",
    "Sáb: 11h às 23h",
    "Dom: fechado",
  ]);
  assert.deepEqual(out.notes, []);
  assert.deepEqual(validate(out.week), []);
});

test("the days not said stay as they were", () => {
  const out = parse("sábado das 12 às 23");
  assert.deepEqual(shifts(out, 5), ["12:00-23:00"]);
  assert.deepEqual(shifts(out, 0), ["11:00-22:00"]);
  assert.equal(day(out, 6).closed, true);
});

test("times first, days after", () => {
  const out = parse("das 11 às 23 de segunda a sábado, domingo das 11 às 16");
  assert.deepEqual(shifts(out, 0), ["11:00-23:00"]);
  assert.deepEqual(shifts(out, 5), ["11:00-23:00"]);
  assert.deepEqual(shifts(out, 6), ["11:00-16:00"]);
});

test("times with letters: 11h, 11h30, 11:30", () => {
  assert.deepEqual(shifts(parse("todos os dias de 11h às 23h30"), 2), ["11:00-23:30"]);
  assert.deepEqual(shifts(parse("segunda das 11:30 às 15:45"), 0), ["11:30-15:45"]);
  assert.deepEqual(shifts(parse("segunda das 11h30 até as 15h"), 0), ["11:30-15:00"]);
});

test("numbers by name and half hours", () => {
  assert.deepEqual(shifts(parse("segunda das onze e meia às vinte e duas"), 0), ["11:30-22:00"]);
  assert.deepEqual(shifts(parse("terça das onze às quinze e trinta"), 1), ["11:00-15:30"]);
  assert.deepEqual(shifts(parse("quarta das 11 e 30 às 15"), 2), ["11:30-15:00"]);
});

test("meio-dia and meia-noite", () => {
  assert.deepEqual(shifts(parse("segunda do meio-dia à meia-noite"), 0), ["12:00-00:00"]);
  assert.deepEqual(shifts(parse("segunda ao meio dia e meia até as 15"), 0), ["12:30-15:00"]);
  assert.deepEqual(shifts(parse("sexta das 18 à meia noite"), 4), ["18:00-00:00"]);
});

test("a second shift is not read as minutes", () => {
  const out = parse("segunda das 11 às 15 e 18 às 23");
  assert.deepEqual(shifts(out, 0), ["11:00-15:00", "18:00-23:00"]);
  const out2 = parse("segunda das 11 às 15 e 20 às 23");
  assert.deepEqual(shifts(out2, 0), ["11:00-15:00", "20:00-23:00"]);
  const out3 = parse("segunda das 11 às 15 e 20");
  assert.deepEqual(shifts(out3, 0), ["11:00-15:20"]);
});

test("part of the day: da noite, da tarde, da manhã", () => {
  assert.deepEqual(shifts(parse("segunda das 6 às 10 da noite"), 0), ["18:00-22:00"]);
  assert.deepEqual(shifts(parse("segunda das 11 da manhã às 3 da tarde"), 0), ["11:00-15:00"]);
  assert.deepEqual(shifts(parse("sexta das 7 da noite às 2 da manhã"), 4), ["19:00-02:00"]);
  assert.deepEqual(shifts(parse("sábado das 11 às 3 da tarde"), 5), ["11:00-15:00"]);
});

test("a night that runs past midnight", () => {
  const out = parse("sexta e sábado das 18 às 2");
  assert.deepEqual(shifts(out, 4), ["18:00-02:00"]);
  assert.deepEqual(shifts(out, 5), ["18:00-02:00"]);
  assert.deepEqual(validate(out.week), []);
});

test("closed days in many ways", () => {
  for (const phrase of [
    "domingo fechado",
    "domingo a gente fecha",
    "não abrimos domingo",
    "domingo não abre",
    "domingo é folga",
    "fechamos aos domingos",
  ]) {
    const out = parse(phrase, parse("todos os dias das 10 às 20").week);
    assert.equal(day(out, 6).closed, true, phrase);
    assert.equal(day(out, 0).closed, false, phrase);
  }
});

test('"fecha às 23" is only a closing time', () => {
  const out = parse("segunda abre às 11 e fecha às 23");
  assert.deepEqual(shifts(out, 0), ["11:00-23:00"]);
  assert.equal(day(out, 0).closed, false);
  const out2 = parse("abrimos às 11 e fechamos às 22 todos os dias");
  assert.deepEqual(shifts(out2, 3), ["11:00-22:00"]);
});

test("days in groups: weekend, weekdays, every day, lists", () => {
  const base = parse("todos os dias das 10 às 20").week;
  const weekend = parse("fim de semana das 12 às 18", base);
  assert.deepEqual(shifts(weekend, 5), ["12:00-18:00"]);
  assert.deepEqual(shifts(weekend, 6), ["12:00-18:00"]);
  assert.deepEqual(shifts(weekend, 0), ["10:00-20:00"]);

  const week = parse("dias de semana das 9 às 17", base);
  assert.deepEqual(shifts(week, 4), ["09:00-17:00"]);
  assert.deepEqual(shifts(week, 5), ["10:00-20:00"]);

  const list = parse("segunda, quarta e sexta das 11 às 14", base);
  assert.deepEqual(shifts(list, 0), ["11:00-14:00"]);
  assert.deepEqual(shifts(list, 2), ["11:00-14:00"]);
  assert.deepEqual(shifts(list, 1), ["10:00-20:00"]);

  const plural = parse("aos sábados e domingos das 11 às 16", base);
  assert.deepEqual(shifts(plural, 5), ["11:00-16:00"]);
  assert.deepEqual(shifts(plural, 6), ["11:00-16:00"]);
});

test("a range can wrap the week", () => {
  const out = parse("sexta a segunda das 18 às 23", parse("todos os dias das 10 às 12").week);
  for (const d of [4, 5, 6, 0]) assert.deepEqual(shifts(out, d), ["18:00-23:00"], String(d));
  assert.deepEqual(shifts(out, 2), ["10:00-12:00"]);
});

test("-feira after the day name is ignored", () => {
  const out = parse("segunda-feira a sexta-feira das 11 às 22");
  assert.deepEqual(shifts(out, 0), ["11:00-22:00"]);
  assert.deepEqual(shifts(out, 4), ["11:00-22:00"]);
});

test("no day said: every day, and it says so", () => {
  const out = parse("das 11 às 23");
  assert.deepEqual(shifts(out, 6), ["11:00-23:00"]);
  assert.deepEqual(shifts(out, 0), ["11:00-23:00"]);
  assert.ok(out.notes.some((n) => n.includes("usei todos os dias")));
});

test("a day said twice keeps the last", () => {
  const out = parse("segunda a sexta das 11 às 22, sexta das 11 às 15");
  assert.deepEqual(shifts(out, 3), ["11:00-22:00"]);
  assert.deepEqual(shifts(out, 4), ["11:00-15:00"]);
  assert.ok(out.notes.some((n) => n.includes("Sex apareceu mais de uma vez")));
});

test("two shifts at most", () => {
  const out = parse("segunda das 8 às 10 da manhã e das 12 às 14 e das 18 às 22");
  assert.equal(shifts(out, 0).length, 2);
  assert.ok(out.notes.some((n) => n.includes("2 turnos")));
});

test("a time left hanging is reported, not invented", () => {
  const out = parse("segunda das 11 às 15 e das 18");
  assert.deepEqual(shifts(out, 0), ["11:00-15:00"]);
  assert.ok(out.notes.some((n) => n.includes("faltou a hora de fechar")));
});

test("a day with no time is left as it was", () => {
  const out = parse("sábado");
  assert.equal(out.week, null);
  assert.ok(out.notes.some((n) => n.includes("não ouvi o horário")));
});

test("a time with no day when days were said", () => {
  const out = parse("segunda das 11 às 15 e das 17 às 21 de terça a quinta");
  assert.deepEqual(shifts(out, 0), ["11:00-15:00", "17:00-21:00"]);
  assert.deepEqual(shifts(out, 1), ["11:00-22:00"]);
});

test("same hour to open and close is refused", () => {
  const out = parse("segunda das 11 às 11");
  assert.equal(out.week, null);
  assert.ok(out.notes.some((n) => n.includes("mesma hora")));
});

test("ambiguous small hours get a note", () => {
  const out = parse("segunda das 6 às 10");
  assert.deepEqual(shifts(out, 0), ["06:00-10:00"]);
  assert.ok(out.notes.some((n) => n.includes("da noite")));
  assert.deepEqual(parse("segunda das 6 às 10 da noite").notes, []);
  assert.deepEqual(parse("segunda das 11 às 23").notes, []);
});

test("counts are not hours", () => {
  const out = parse("abrimos sete dias por semana das 11 às 23 em dois turnos");
  assert.deepEqual(shifts(out, 0), ["11:00-23:00"]);
  assert.deepEqual(shifts(out, 6), ["11:00-23:00"]);
  assert.deepEqual(out.notes, []);
  const out2 = parse("temos uma entrega especial no sábado das 12 às 15");
  assert.deepEqual(shifts(out2, 5), ["12:00-15:00"]);
});

test("a number that is not an hour is said", () => {
  const out = parse("segunda das 11 às 190");
  assert.equal(out.week, null);
  assert.ok(out.notes.some((n) => n.includes("190")));
});

test("holiday is mentioned, not invented", () => {
  const out = parse("segunda a sexta das 11 às 22 e feriado também");
  assert.ok(out.notes.some((n) => n.includes("Feriado")));
});

test("nothing understood", () => {
  for (const text of ["", "   ", "bom dia gente", "não sei"]) {
    const out = parse(text);
    assert.equal(out.week, null, text);
    assert.deepEqual(out.lines, [], text);
  }
});

test("the summary of the result reads well", () => {
  const out = parse("segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado");
  assert.equal(summary(out.week), "Seg a sex 11h às 15h e 18h às 23h · Sáb 11h às 23h · Dom fechado");
});

test("the current week is never changed in place", () => {
  const week = suggestedWeek();
  const before = JSON.stringify(week);
  parse("segunda a sexta das 9 às 18", week);
  assert.equal(JSON.stringify(week), before);
});
