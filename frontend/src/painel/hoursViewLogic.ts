/**
 * O Horário, versão nova: quando o restaurante recebe pedido e a pausa. Só conta, sem React nem rede:
 * tests/novo/hoursViewLogic.test.mjs roda isto no Node.
 *
 * Nenhuma regra mudou. O servidor decide o que vale, se o restaurante está aberto agora e as palavras que o cliente lê
 * (`backend/hours.py`); a edição dos dias e das horas, a conferência do que foi digitado e a linha-resumo são as mesmas da
 * tela antiga (`service/hoursDraft`, já testada). Aqui só se monta o que a tela mostra, com cada frase pronta.
 *
 * Quem não tem horário salvo recebe pedido a qualquer hora: nada fica fechado por acidente. O que a pessoa fala vira horas
 * na tela e **nada é salvo** até ela tocar em Salvar horário.
 */
import {
  HOURS_CHECK,
  HOURS_MISSING,
  HOURS_NOT_HEARD,
  HOURS_NOT_UNDERSTOOD,
  HOURS_NOW_CLOSED,
  HOURS_NOW_NONE,
  HOURS_NOW_NONE_DETAIL,
  HOURS_NOW_OPEN,
  HOURS_NOW_PAUSED,
  HOURS_NOW_PAUSED_DETAIL,
  HOURS_NO_HOURS,
  HOURS_NO_HOURS_SPEAK,
  HOURS_PAUSE_HELP_OFF,
  HOURS_PAUSE_HELP_ON,
  HOURS_PAUSE_OFF,
  HOURS_PAUSE_ON,
} from "../novo/copy.ts";
import type { HoursDayView, HoursView } from "../novo/types.ts";
import { DAY_NAMES, MAX_SHIFTS, snapshot, summary, fromApi, type ApiHours, type Day } from "../service/hoursDraft.ts";

export type { HoursView };
// Quem desenha a tela (e a página de conferência) edita a semana com as mesmas contas da tela antiga, já testadas.
export { addShift, copyToAll, fromApi, removeShift, setClosed, setShift, validate } from "../service/hoursDraft.ts";
export type { ApiHours, Day } from "../service/hoursDraft.ts";

/** Quanto tempo o primeiro toque em "Tirar o horário" espera o segundo. */
export const REMOVE_ARM_MS = 4000;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export type HoursInput = {
  load: "loading" | "ready" | "error";
  server: ApiHours | null;
  /** A semana como a pessoa está editando agora. */
  week: Day[];
  /** "Maria, dono": quem está no painel. */
  person: string;
  error: string;
  switching: boolean;
  saving: boolean;
  removing: boolean;
  removeArmed: boolean;
  problems: string[];
  notice: { ok: boolean; text: string } | null;
  listening: boolean;
  heard: string;
  spoken: { said: string; lines: string[]; notes: string[] } | null;
  canSpeak: boolean;
  /** Como falar o horário, em uma frase (vem do serviço que entende o que a pessoa fala). */
  speakHelp: string;
};

/** Há algo editado que ainda não foi salvo? */
export function isDirty(server: ApiHours | null, week: Day[]): boolean {
  return server !== null && snapshot(week) !== snapshot(fromApi(server));
}

function nowOf(server: ApiHours): NonNullable<HoursView["now"]> {
  if (server.orders_paused) return { tone: "paused", title: HOURS_NOW_PAUSED, detail: HOURS_NOW_PAUSED_DETAIL };
  if (!server.configured) return { tone: "none", title: HOURS_NOW_NONE, detail: HOURS_NOW_NONE_DETAIL };
  return { tone: server.open_now ? "open" : "closed", title: server.open_now ? HOURS_NOW_OPEN : HOURS_NOW_CLOSED, detail: server.open_message };
}

function daysOf(week: Day[]): HoursDayView[] {
  // "Copiar para todos os dias" fica no primeiro dia aberto: acerta-se um dia, copia-se, e só então mudam-se as exceções.
  const firstOpen = week.find((day) => !day.closed)?.weekday;
  return week.map((day) => {
    const name = capital(DAY_NAMES[day.weekday]);
    return {
      weekday: day.weekday,
      name,
      closed: day.closed,
      toggleLabel: day.closed ? `${name}: fechado. Toque para abrir` : `${name}: aberto. Toque para fechar`,
      shifts: day.shifts.map((shift, index) => ({
        opens: shift.opens,
        closes: shift.closes,
        opensLabel: `${name}, turno ${index + 1}, hora de abrir`,
        closesLabel: `${name}, turno ${index + 1}, hora de fechar`,
        removeLabel: day.shifts.length > 1 ? `Tirar o turno ${index + 1} de ${name}` : null,
      })),
      canAddShift: !day.closed && day.shifts.length < MAX_SHIFTS,
      canCopy: day.weekday === firstOpen,
    };
  });
}

export function hoursViewOf(input: HoursInput): HoursView {
  const { server } = input;
  const ready = input.load === "ready" && server !== null;
  const dirty = ready && isDirty(server, input.week);
  const paused = ready && server.orders_paused;
  const failedWords = input.spoken && input.spoken.lines.length === 0 ? `${input.spoken.said ? HOURS_NOT_UNDERSTOOD : HOURS_NOT_HEARD} ${input.speakHelp}` : "";
  const notice = input.notice;
  // A conferência da tela antiga escreve "quarta: abrir e fechar…" com o dia em minúscula; no meio de uma frase da tela, começa com maiúscula.
  const problems = input.problems.map(capital);
  const live = input.listening
    ? "Estou ouvindo."
    : notice
      ? notice.text
      : problems.length > 0
        ? `${HOURS_MISSING} ${problems.join(" ")}`
        : input.spoken && input.spoken.lines.length > 0
          ? HOURS_CHECK
          : "";
  return {
    sub: input.person,
    load: input.load,
    error: input.load === "error" ? input.error : "",
    now: ready ? nowOf(server) : null,
    paused,
    pauseHelp: paused ? HOURS_PAUSE_HELP_ON : HOURS_PAUSE_HELP_OFF,
    pauseButton: paused ? HOURS_PAUSE_OFF : HOURS_PAUSE_ON,
    switching: input.switching,
    noHoursHint: ready && !server.configured ? (input.canSpeak ? HOURS_NO_HOURS_SPEAK : HOURS_NO_HOURS) : "",
    days: ready ? daysOf(input.week) : [],
    summary: ready ? summary(input.week) : "",
    dirty,
    saving: input.saving,
    canSave: ready && !input.saving && !input.removing && (dirty || !server.configured),
    problems,
    notice,
    listening: input.listening ? { heard: input.heard } : null,
    spoken: input.spoken && !input.listening ? { ...input.spoken, failed: failedWords } : null,
    canSpeak: input.canSpeak,
    canRemoveHours: ready && server.configured,
    removeArmed: input.removeArmed,
    removing: input.removing,
    live,
  };
}
