/**
 * The opening hours as the owner edits them in the "Horário" tab. Pure logic, no React:
 * tests/ui/hoursDraft.test.mjs runs it in Node.
 *
 * The server decides everything (backend/hours.py): what is valid, whether the restaurant is open now and the words
 * the customer reads. Here there is only the editing, a mirror of the checks (so the owner sees the problem before
 * tapping "Salvar") and the one-line summary.
 *
 * Days go from 0 (segunda) to 6 (domingo), like the server. A shift whose closing time is before its opening time runs
 * past midnight ("18:00" to "02:00").
 */

export type Shift = { opens: string; closes: string };

export type Day = { weekday: number; closed: boolean; shifts: Shift[] };

/** `GET /api/admin/hours`. */
export type ApiHours = {
  configured: boolean;
  week: (Day & { name?: string })[];
  orders_paused: boolean;
  open_now: boolean;
  open_message: string;
};

export const DAY_NAMES = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;
export const DAY_SHORT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

export const MAX_SHIFTS = 2;
export const DEFAULT_SHIFT: Shift = { opens: "11:00", closes: "22:00" };
const SECOND_SHIFT: Shift = { opens: "18:00", closes: "23:00" };
const LUNCH_END = "15:00";

const DAY = 1440;
const WEEK = 7 * DAY;

/** "18:30", "18h", "18h30", "8:05" -> minutes since midnight; null when it is not a time. "24:00" is midnight. */
export function toMinutes(value: unknown): number | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "24:00" || text === "24h") return 0;
  const match = /^(\d{1,2})(?::|h)(\d{2})?$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  return hour > 23 || minute > 59 ? null : hour * 60 + minute;
}

/** Minutes -> "18:30" (what the time field holds). */
export function clock(minutes: number): string {
  const wrapped = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** Minutes -> "18h" or "18h30" (what people read). */
export function say(minutes: number): string {
  const wrapped = ((minutes % DAY) + DAY) % DAY;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
}

const duration = (opens: number, closes: number) => (closes > opens ? closes - opens : closes + DAY - opens);

const copyShift = (shift: Shift): Shift => ({ opens: shift.opens, closes: shift.closes });

export function cloneWeek(week: Day[]): Day[] {
  return week.map((day) => ({ weekday: day.weekday, closed: day.closed, shifts: day.shifts.map(copyShift) }));
}

/** What the screen starts with when nothing is saved: Monday to Saturday 11h to 22h, Sunday closed. */
export function suggestedWeek(): Day[] {
  return DAY_NAMES.map((_, weekday) => ({
    weekday,
    closed: weekday === 6,
    shifts: weekday === 6 ? [] : [copyShift(DEFAULT_SHIFT)],
  }));
}

/** The server's seven days -> the editor's, always seven and in order (a missing day is a closed one). */
export function fromApi(api: ApiHours | null | undefined): Day[] {
  if (!api || !api.configured) return suggestedWeek();
  const byDay = new Map<number, Day>();
  for (const day of api.week ?? []) {
    byDay.set(day.weekday, {
      weekday: day.weekday,
      closed: Boolean(day.closed) || !day.shifts?.length,
      shifts: (day.shifts ?? []).map(copyShift),
    });
  }
  return DAY_NAMES.map((_, weekday) => byDay.get(weekday) ?? { weekday, closed: true, shifts: [] });
}

/** A closed day opens with a normal shift; opening with no shifts would be a day that is neither. */
export function setClosed(week: Day[], weekday: number, closed: boolean): Day[] {
  return week.map((day) => {
    if (day.weekday !== weekday) return day;
    if (closed) return { ...day, closed: true, shifts: [] };
    return { ...day, closed: false, shifts: day.shifts.length ? day.shifts : [copyShift(DEFAULT_SHIFT)] };
  });
}

export function setShift(week: Day[], weekday: number, index: number, patch: Partial<Shift>): Day[] {
  return week.map((day) =>
    day.weekday !== weekday
      ? day
      : { ...day, shifts: day.shifts.map((shift, position) => (position === index ? { ...shift, ...patch } : shift)) }
  );
}

export function addShift(week: Day[], weekday: number): Day[] {
  return week.map((day) => {
    if (day.weekday !== weekday || day.closed || day.shifts.length >= MAX_SHIFTS) return day;
    const first = day.shifts[0];
    const opens = first ? toMinutes(first.opens) : null;
    const closes = first ? toMinutes(first.closes) : null;
    const lunch = toMinutes(LUNCH_END)!;
    const dinner = toMinutes(SECOND_SHIFT.opens)!;

    // One long shift (11h to 22h) becomes lunch and dinner: the first ends at 15h, the second keeps the closing time
    if (first && opens !== null && closes !== null && opens < lunch && closes >= dinner) {
      return {
        ...day,
        shifts: [{ opens: first.opens, closes: LUNCH_END }, { opens: SECOND_SHIFT.opens, closes: first.closes }],
      };
    }
    // A shift that ends before the evening: the second is the usual dinner, or an hour after the first if that is later
    const start = closes !== null && opens !== null && closes > opens ? Math.max(dinner, closes + 60) : dinner;
    const end = start >= toMinutes(SECOND_SHIFT.closes)! ? DAY - 1 : toMinutes(SECOND_SHIFT.closes)!;
    return { ...day, shifts: [...day.shifts, { opens: clock(start), closes: clock(end) }] };
  });
}

/** Removing the only shift of a day closes the day. */
export function removeShift(week: Day[], weekday: number, index: number): Day[] {
  return week.map((day) => {
    if (day.weekday !== weekday) return day;
    const shifts = day.shifts.filter((_, position) => position !== index);
    return shifts.length === 0 ? { ...day, closed: true, shifts: [] } : { ...day, shifts };
  });
}

/** "Mesmo horário em todos os dias": copies one day to the other six. */
export function copyToAll(week: Day[], weekday: number): Day[] {
  const source = week.find((day) => day.weekday === weekday);
  if (!source) return week;
  return week.map((day) => ({ weekday: day.weekday, closed: source.closed, shifts: source.shifts.map(copyShift) }));
}

/** Everything the server also checks, in the words the owner reads. Empty list = can be saved. */
export function validate(week: Day[]): string[] {
  const problems: string[] = [];
  const spans: { start: number; end: number; weekday: number }[] = [];

  for (const day of week) {
    if (day.closed) continue;
    const name = DAY_NAMES[day.weekday];
    if (day.shifts.length < 1 || day.shifts.length > MAX_SHIFTS) {
      problems.push(`${name}: coloque 1 ou 2 turnos, ou marque como fechado.`);
      continue;
    }
    for (const shift of day.shifts) {
      const opens = toMinutes(shift.opens);
      const closes = toMinutes(shift.closes);
      if (opens === null || closes === null) {
        problems.push(`${name}: preencha a hora de abrir e a de fechar.`);
      } else if (opens === closes) {
        problems.push(`${name}: abrir e fechar na mesma hora não vale. Para o dia todo, use de 00:00 às 23:59.`);
      } else {
        const start = day.weekday * DAY + opens;
        spans.push({ start, end: start + duration(opens, closes), weekday: day.weekday });
      }
    }
  }
  if (problems.length) return problems;

  spans.sort((a, b) => a.start - b.start);
  if (spans.length > 1) {
    spans.forEach((span, index) => {
      const following = spans[(index + 1) % spans.length];
      const nextStart = following.start + (index === spans.length - 1 ? WEEK : 0);
      if (span.end > nextStart) {
        const first = DAY_NAMES[span.weekday];
        const second = DAY_NAMES[following.weekday];
        problems.push(`Os turnos ${first === second ? `de ${first}` : `de ${first} e de ${second}`} se cruzam. Confira as horas.`);
      }
    });
  }
  return [...new Set(problems)];
}

/** The body of `PUT /api/admin/hours`. */
export function toBody(week: Day[]): { week: Day[] } {
  return {
    week: week.map((day) => ({
      weekday: day.weekday,
      closed: day.closed,
      shifts: day.closed ? [] : day.shifts.map(copyShift),
    })),
  };
}

/** The same text on both sides means nothing to save. */
export function snapshot(week: Day[]): string {
  return JSON.stringify(toBody(week));
}

export function dayText(day: Day): string {
  if (day.closed || day.shifts.length === 0) return "fechado";
  return day.shifts
    .map((shift) => `${say(toMinutes(shift.opens) ?? 0)} às ${say(toMinutes(shift.closes) ?? 0)}`)
    .join(" e ");
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Seg a sex e dom", "Sáb e dom", "Todos os dias": the days in the words people say. */
export function daysLabel(days: number[]): string {
  const sorted = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (sorted.length === 7) return "Todos os dias";
  const parts: string[] = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    if (end - index >= 2) parts.push(`${DAY_SHORT[sorted[index]]} a ${DAY_SHORT[sorted[end]]}`);
    else for (let at = index; at <= end; at += 1) parts.push(DAY_SHORT[sorted[at]]);
    index = end + 1;
  }
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : (parts[0] ?? "");
  return capital(text);
}

/** One line to read or hear: "Seg a sáb 11h às 15h e 18h às 23h · Dom fechado". */
export function summary(week: Day[]): string {
  const groups: { first: number; last: number; text: string }[] = [];
  for (const day of week) {
    const text = dayText(day);
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.last === day.weekday - 1) last.last = day.weekday;
    else groups.push({ first: day.weekday, last: day.weekday, text });
  }
  return groups
    .map(({ first, last, text }) =>
      `${first === last ? capital(DAY_SHORT[first]) : `${capital(DAY_SHORT[first])} a ${DAY_SHORT[last]}`} ${text}`
    )
    .join(" · ");
}
