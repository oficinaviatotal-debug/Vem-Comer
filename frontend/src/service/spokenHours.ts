/**
 * The opening hours said the way people talk, to fill the "Horário" tab without typing:
 *
 *   "De segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado."
 *
 * Pure logic, no microphone: tests/ui/spokenHours.test.mjs runs it in Node. Nothing is saved from here: the editor
 * shows what was understood and the owner confirms with "Salvar horário".
 *
 * How it reads:
 * - days: "segunda", "segunda a sexta", "segunda, quarta e sexta", "fim de semana", "dias de semana", "todos os dias";
 * - times: "11", "11h", "11h30", "onze e meia", "meio-dia", "meia-noite", "10 da noite", "3 da tarde";
 * - "fechado", "folga", "não abre", "fechamos domingo" close a day; "fecha às 23" is only a closing time;
 * - days first ("sábado das 11 às 23") or times first ("das 11 às 23 de segunda a sexta"), up to two shifts per day;
 * - the days that were said are replaced, the others stay as they were; a day said twice keeps the last one;
 * - what it could not use is said in `notes`, never guessed in silence.
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import { MAX_SHIFTS, clock, cloneWeek, dayText, daysLabel, say, type Day, type Shift } from "./hoursDraft.ts";

export type SpokenHours = {
  /** The week with what was said applied; null when nothing could be used. */
  week: Day[] | null;
  /** One line per group of days, for the screen: "Seg a sex: 11h às 15h e 18h às 23h". */
  lines: string[];
  /** What was left out, doubtful or could not be read, in words for the owner. */
  notes: string[];
};

export const SPOKEN_HOURS_HELP =
  "Fale assim: de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado.";

type Qual = "manha" | "tarde" | "noite" | "madrugada";

type Time = {
  hour: number;
  minute: number;
  qual: Qual | null;
  /** "meio-dia", "meia-noite", "24h": the hour is what it says, no morning/afternoon guessing. */
  absolute: boolean;
};

type Item =
  | { k: "day"; v: number }
  | { k: "days"; v: number[] }
  | { k: "link"; w: string }
  | { k: "time"; t: Time }
  | { k: "closed" }
  /** A comma or full stop in written text. Spoken text has none. */
  | { k: "break" };

const own = (table: object, key: string | undefined): boolean =>
  key !== undefined && Object.prototype.hasOwnProperty.call(table, key);

const DAY_INDEX: Record<string, number> = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5, domingo: 6 };

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50 };

const MINUTES = new Set([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
const QUALS: Record<string, Qual> = { manha: "manha", tarde: "tarde", noite: "noite", madrugada: "madrugada" };
/** Said between a time and "da noite": "10 da noite", "10 de noite", "10 pela manhã". */
const QUAL_FILLER = new Set(["da", "de", "do", "pela", "na", "no", "a", "as"]);
/** "as" "a" "ate" between two times. */
const SEP = new Set(["as", "a", "ate", "ao"]);
const HOUR_SUFFIX = new Set(["h", "hs", "hora", "horas"]);
const MINUTE_SUFFIX = new Set(["minuto", "minutos", "min", "mins"]);

const CLOSE_WORDS = new Set([
  "fecha", "fechamos", "fechar", "fechou", "fecham", "fechando", "fecho", "encerra", "encerramos", "encerrar", "encerro",
]);
const CLOSED_WORDS = new Set(["fechado", "fechada", "fechados", "fechadas", "folga", "folgas", "folgamos", "folgar"]);
/** Between "fecha" and a time: "fecha mais cedo às 15", "fecha por volta das 23". */
const CLOSE_LOOKAHEAD_SKIP = new Set(["as", "a", "ao", "ate", "depois", "por", "volta", "pelas", "mais", "cedo", "umas", "aproximadamente"]);

const PLACEHOLDERS: [RegExp, string][] = [
  [/\bnao (?:abr\w*|funcion\w*|atend\w*|trabalh\w*|tem expediente|temos expediente|vamos abrir|vai abrir)\b/g, "xfechado"],
  [/\bsem expediente\b/g, "xfechado"],
  [/\b(?:fins? de semana|finais de semana|fim de semana|fds)\b/g, "xfimsemana"],
  [/\b(?:dias? de semana|durante a semana|dias uteis|dia util)\b/g, "xdiasuteis"],
  [/\b(?:todos os dias|todo dia|todo santo dia|diariamente|sem folga|(?:sete|7) dias(?: por semana| na semana)?)\b/g, "xtodosdias"],
  [/\bmeio dia\b/g, "xmeiodia"],
  [/\bmeia noite\b/g, "xmeianoite"],
];

/** "11:30" and "11.30" become "11h30" before the punctuation is thrown away; the rest is the usual normalizing. */
function prepare(transcript: string): string[] {
  const marked = transcript
    .replace(/(\d{1,2})\s*:\s*(\d{2})/g, "$1h$2")
    .replace(/(\d{1,2})[.,](\d{2})(?!\d)/g, "$1h$2")
    .replace(/[,;.]/g, " xquebra ");
  let text = normalizeSpeech(marked);
  for (const [pattern, word] of PLACEHOLDERS) text = text.replace(pattern, word);
  return text.split(" ").filter(Boolean);
}

/** A whole number at tokens[i]: "11", "onze", "vinte e duas". Returns [value, tokens used]. */
function readNumber(tokens: string[], i: number): [number, number] | null {
  const word = tokens[i];
  if (word === undefined) return null;
  if (/^\d{1,3}$/.test(word)) return [Number(word), 1];
  if (own(UNITS, word)) return [UNITS[word], 1];
  if (own(TENS, word)) {
    const unit = tokens[i + 2];
    if (tokens[i + 1] === "e" && own(UNITS, unit) && UNITS[unit!] >= 1 && UNITS[unit!] <= 9) {
      return [TENS[word] + UNITS[unit!], 3];
    }
    return [TENS[word], 1];
  }
  return null;
}

/** Words after a number that make it a count, not an hour: "dois turnos", "sete dias". */
const NOT_TIME_NEXT = new Set(["dias", "dia", "turno", "turnos", "vezes", "reais", "real", "pessoas", "mesas", "semana", "semanas"]);
/** "um", "uma" and "zero" are also ordinary words: they only count as an hour right after "às", "das", "até"... */
const WEAK_NUMBERS = new Set(["zero", "um", "uma"]);
const WEAK_PREVIOUS = new Set(["as", "das", "a", "ate", "de", "ao", "depois", "antes", "entre"]);

function looksLikeTime(tokens: string[], i: number): boolean {
  const word = tokens[i];
  if (word === undefined) return false;
  if (word === "xmeiodia" || word === "xmeianoite" || /^\d{1,2}hs?(\d{2})?$/.test(word)) return true;
  const number = readNumber(tokens, i);
  if (!number) return false;
  if (NOT_TIME_NEXT.has(tokens[i + number[1]] ?? "")) return false;
  if (WEAK_NUMBERS.has(word) && !WEAK_PREVIOUS.has(tokens[i - 1] ?? "")) return false;
  return true;
}

type Read = { time: Time; used: number } | { bad: string; used: number } | null;

/**
 * One time at tokens[start]. `before` is how many times the current run already has: an even count means this one
 * opens a shift (so "11 e 30 às 15" is 11h30), an odd one closes it (so "das 11 às 15 e 18 às 23" is not 15h18).
 */
function readTime(tokens: string[], start: number, before: number): Read {
  const word = tokens[start];
  let hour = 0;
  let minute: number | null = null;
  let used = 1;
  let absolute = false;

  if (word === "xmeiodia") {
    hour = 12;
    minute = 0;
    absolute = true;
  } else if (word === "xmeianoite") {
    hour = 0;
    minute = 0;
    absolute = true;
  } else {
    const compact = /^(\d{1,2})hs?(\d{2})?$/.exec(word ?? "");
    if (compact) {
      hour = Number(compact[1]);
      minute = compact[2] === undefined ? null : Number(compact[2]);
    } else {
      const number = readNumber(tokens, start);
      if (!number) return null;
      hour = number[0];
      used = number[1];
    }
  }

  if (HOUR_SUFFIX.has(tokens[start + used] ?? "")) used += 1;

  if (minute === null || absolute) {
    if (tokens[start + used] === "e") {
      if (tokens[start + used + 1] === "meia") {
        minute = 30;
        used += 2;
      } else {
        const number = readNumber(tokens, start + used + 1);
        if (number && MINUTES.has(number[0])) {
          let after = start + used + 1 + number[1];
          if (MINUTE_SUFFIX.has(tokens[after] ?? "")) after += 1;
          const opens = before % 2 === 0;
          if (opens || !SEP.has(tokens[after] ?? "")) {
            minute = (minute ?? 0) + number[0];
            used = after - start;
          }
        }
      }
    }
  }

  let qual: Qual | null = null;
  let probe = start + used;
  while (QUAL_FILLER.has(tokens[probe] ?? "")) probe += 1;
  if (own(QUALS, tokens[probe])) {
    qual = QUALS[tokens[probe]];
    used = probe + 1 - start;
  }

  if (hour > 24 || (minute ?? 0) > 59 || (hour === 24 && (minute ?? 0) > 0)) {
    return { bad: tokens.slice(start, start + used).join(" "), used };
  }
  if (hour === 24) {
    hour = 0;
    absolute = true;
  }
  return { time: { hour, minute: minute ?? 0, qual, absolute }, used };
}

type Noted = { items: Item[]; notes: string[]; holiday: boolean };

function itemsOf(tokens: string[]): Noted {
  const items: Item[] = [];
  const notes: string[] = [];
  let holiday = false;
  let runTimes = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const word = tokens[i];

    const dayMatch = /^(segunda|terca|quarta|quinta|sexta|sabado|domingo)s?$/.exec(word);
    if (dayMatch) {
      items.push({ k: "day", v: DAY_INDEX[dayMatch[1]] });
      runTimes = 0;
      continue;
    }
    if (word === "xtodosdias") {
      items.push({ k: "days", v: [0, 1, 2, 3, 4, 5, 6] });
      runTimes = 0;
      continue;
    }
    if (word === "xdiasuteis") {
      items.push({ k: "days", v: [0, 1, 2, 3, 4] });
      runTimes = 0;
      continue;
    }
    if (word === "xfimsemana") {
      items.push({ k: "days", v: [5, 6] });
      runTimes = 0;
      continue;
    }
    if (word === "xquebra") {
      items.push({ k: "break" });
      continue;
    }
    if (/^feriados?$/.test(word)) {
      holiday = true;
      continue;
    }
    if (word === "xfechado" || CLOSED_WORDS.has(word)) {
      items.push({ k: "closed" });
      runTimes = 0;
      continue;
    }
    if (CLOSE_WORDS.has(word)) {
      // "fecha às 23" is the closing time; "domingo fecha" is a closed day
      let ahead = i + 1;
      while (CLOSE_LOOKAHEAD_SKIP.has(tokens[ahead] ?? "")) ahead += 1;
      if (!looksLikeTime(tokens, ahead)) {
        items.push({ k: "closed" });
        runTimes = 0;
      }
      continue;
    }
    if (looksLikeTime(tokens, i)) {
      const read = readTime(tokens, i, runTimes);
      if (read && "time" in read) {
        items.push({ k: "time", t: read.time });
        runTimes += 1;
        i += read.used - 1;
      } else if (read) {
        notes.push(`Não entendi “${read.bad}” como hora.`);
        i += read.used - 1;
      }
      continue;
    }
    if (word === "e" || SEP.has(word)) {
      items.push({ k: "link", w: word });
    }
  }
  return { items, notes, holiday };
}

/** "as 10 da noite" -> 22h; "3 da tarde" -> 15h; the hour as said when there is no word for the part of the day. */
function minutesOf(time: Time, qual: Qual | null): number {
  let hour = time.hour;
  if (!time.absolute && qual) {
    if (qual === "tarde" && hour >= 1 && hour < 12) hour += 12;
    else if (qual === "noite" && hour >= 1 && hour < 12) hour += 12;
    else if (qual === "noite" && hour === 12) hour = 0;
    else if (qual === "madrugada" && hour === 12) hour = 0;
  }
  return hour * 60 + time.minute;
}

type Group = { days: number[]; times: Time[]; closed: boolean; fromBefore: boolean };

const emptyGroup = (): Group => ({ days: [], times: [], closed: false, fromBefore: false });

/** Days, times and "fechado" are put together: each group of days gets the times and the closing said next to it. */
function groupsOf(items: Item[]): { groups: Group[]; before: Group } {
  const groups: Group[] = [];
  let current = emptyGroup();
  // times or "fechado" said before any day ("das 11 às 23 de segunda a sexta", "fechamos domingo")
  let before = emptyGroup();
  let last: Item["k"] | null = null;
  let lastDay: number | null = null;
  let rangeOpen = false;

  const flush = () => {
    if (current.days.length > 0) groups.push(current);
    current = emptyGroup();
  };

  const takeDays = (days: number[]) => {
    // days right after days are one list ("segunda e terça"); days after times or "fechado" start a new group
    if (last !== "day" && last !== "days") {
      flush();
      if (before.times.length > 0 || before.closed) {
        current = { ...before, days: [], fromBefore: true };
        before = emptyGroup();
      }
    }
    current.days.push(...days);
  };

  for (const item of items) {
    switch (item.k) {
      case "day": {
        // "segunda a sexta": the day after "a"/"até" closes the range (it may wrap: "sexta a segunda")
        if (rangeOpen && lastDay !== null) {
          const range: number[] = [];
          for (let day = (lastDay + 1) % 7; ; day = (day + 1) % 7) {
            range.push(day);
            if (day === item.v) break;
          }
          takeDays(range);
          rangeOpen = false;
        } else {
          takeDays([item.v]);
        }
        lastDay = item.v;
        last = "day";
        break;
      }
      case "days":
        takeDays(item.v);
        lastDay = null;
        rangeOpen = false;
        last = "days";
        break;
      case "link":
        if ((item.w === "a" || item.w === "ate") && last === "day") rangeOpen = true;
        break;
      case "break":
        // after days that already had their times (said first), a comma ends the list: "... de segunda a sábado, domingo ..."
        if (current.fromBefore && (last === "day" || last === "days")) {
          last = "break";
          rangeOpen = false;
        }
        break;
      case "time":
      case "closed": {
        rangeOpen = false;
        // a group that already had its times from before the days is complete: the next ones are for the next days
        const target = current.days.length > 0 && !current.fromBefore ? current : before;
        if (item.k === "time") target.times.push(item.t);
        else target.closed = true;
        last = item.k;
        break;
      }
    }
  }
  flush();
  return { groups, before };
}

/** Times in the order said -> shifts. An odd one out is reported, never invented. */
function shiftsOf(times: Time[], notes: string[], label: string): { shifts: Shift[]; ambiguous: boolean } {
  const shifts: Shift[] = [];
  let ambiguous = false;
  for (let at = 0; at + 1 < times.length; at += 2) {
    const opens = times[at];
    const closes = times[at + 1];
    const closeMinutes = minutesOf(closes, closes.qual);
    // "das 6 às 10 da noite": the part of the day said at the end also belongs to the opening, if it makes sense
    let openMinutes = minutesOf(opens, opens.qual);
    if (!opens.qual && closes.qual) {
      const shared = minutesOf(opens, closes.qual);
      if (shared < closeMinutes) openMinutes = shared;
    }
    if (openMinutes === closeMinutes) {
      notes.push(`${label}: abrir e fechar na mesma hora não vale (${say(openMinutes)}). Deixei de fora.`);
      continue;
    }
    if (
      !opens.qual && !closes.qual && !opens.absolute && !closes.absolute &&
      opens.hour >= 1 && opens.hour <= 11 && closes.hour >= 1 && closes.hour <= 11
    ) {
      ambiguous = true;
    }
    shifts.push({ opens: clock(openMinutes), closes: clock(closeMinutes) });
  }
  if (times.length % 2 === 1) {
    const orphan = times[times.length - 1];
    notes.push(`${label}: faltou a hora de fechar depois das ${say(minutesOf(orphan, orphan.qual))}. Deixei de fora.`);
  }
  return { shifts, ambiguous };
}

export function parseSpokenHours(transcript: string, current: Day[]): SpokenHours {
  const { items, notes, holiday } = itemsOf(prepare(String(transcript ?? "")));
  const { groups, before } = groupsOf(items);

  // Times (or "fechado") with no days at all: they are for every day, and the owner is told
  if (groups.length === 0 && (before.times.length > 0 || before.closed)) {
    notes.push("Não ouvi os dias, então usei todos os dias da semana.");
    groups.push({ ...before, days: [0, 1, 2, 3, 4, 5, 6], fromBefore: true });
  } else if (before.times.length > 0) {
    const orphans = shiftsOf(before.times, [], "").shifts;
    notes.push(
      orphans.length > 0
        ? `Sobrou um horário sem dia (${dayText({ weekday: 0, closed: false, shifts: orphans })}). Diga o dia junto.`
        : "Sobrou um horário sem dia. Diga o dia junto."
    );
  }

  const week = cloneWeek(current);
  const lines: string[] = [];
  const seen = new Set<number>();
  const repeated = new Set<number>();
  let ambiguous = false;

  for (const group of groups) {
    const days = [...new Set(group.days)].sort((a, b) => a - b);
    const label = daysLabel(days);
    const { shifts, ambiguous: unsure } = shiftsOf(group.times, notes, label);
    if (shifts.length > MAX_SHIFTS) {
      notes.push(`${label}: o sistema aceita 2 turnos por dia. Usei os 2 primeiros.`);
      shifts.length = MAX_SHIFTS;
    }

    let closed = false;
    if (shifts.length > 0) {
      if (group.closed) notes.push(`${label}: você disse fechado e também um horário. Usei o horário.`);
    } else if (group.closed) {
      closed = true;
    } else {
      if (group.times.length === 0) notes.push(`${label}: não ouvi o horário. Deixei como estava.`);
      continue;
    }

    for (const day of days) {
      if (seen.has(day)) repeated.add(day);
      seen.add(day);
      const index = week.findIndex((candidate) => candidate.weekday === day);
      if (index >= 0) {
        week[index] = closed
          ? { weekday: day, closed: true, shifts: [] }
          : { weekday: day, closed: false, shifts: shifts.map((shift) => ({ ...shift })) };
      }
    }
    ambiguous = ambiguous || unsure;
    lines.push(`${label}: ${dayText(closed ? { weekday: 0, closed: true, shifts: [] } : { weekday: 0, closed: false, shifts })}`);
  }

  if (repeated.size > 0) {
    notes.push(`${daysLabel([...repeated])} apareceu mais de uma vez. Vale o que você falou por último.`);
  }
  if (ambiguous) {
    notes.push("Se algum horário for da tarde ou da noite, diga assim: das 6 às 10 da noite.");
  }
  if (holiday) {
    notes.push("Feriado não tem horário próprio: vale o horário do dia da semana.");
  }

  return { week: lines.length > 0 ? week : null, lines, notes };
}
