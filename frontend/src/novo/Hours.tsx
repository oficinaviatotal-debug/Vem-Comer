import "./novo.css";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import {
  HOURS_ADD_SHIFT,
  HOURS_CANCEL,
  HOURS_CHECK,
  HOURS_CLOSED,
  HOURS_CLOSES,
  HOURS_CLOSE_NOTE,
  HOURS_COPY_ALL,
  HOURS_DAYS_TITLE,
  HOURS_DISCARD,
  HOURS_DONE,
  HOURS_INTRO,
  HOURS_LISTENING,
  HOURS_LOADING,
  HOURS_MISSING,
  HOURS_OPEN,
  HOURS_OPENS,
  HOURS_REMOVE,
  HOURS_REMOVE_ARMED,
  HOURS_REMOVE_SHIFT,
  HOURS_REMOVING,
  HOURS_RETRY,
  HOURS_SAVE,
  HOURS_SAVING,
  HOURS_SPEAK,
  HOURS_SPEAK_HINT,
  HOURS_TITLE,
  HOURS_UNDERSTOOD,
  HOURS_UNSAVED,
  HOURS_YOU_SAID,
} from "./copy";
import type { HoursDayView, HoursView } from "./types";

export type HoursHandlers = {
  onToggleDay?: (weekday: number) => void;
  onShift?: (weekday: number, index: number, patch: { opens?: string; closes?: string }) => void;
  onAddShift?: (weekday: number) => void;
  onRemoveShift?: (weekday: number, index: number) => void;
  onCopyAll?: (weekday: number) => void;
  onPause?: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
  onRemove?: () => void;
  /** Tocar na bolinha (ou em "Falar o horário"): começa a ouvir, ou cancela se já está ouvindo. */
  onSpeak?: () => void;
  onDone?: () => void;
  onCancel?: () => void;
  onCloseSpoken?: () => void;
  onRetry?: () => void;
};

type Props = HoursHandlers & {
  view: HoursView;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

function DayCard({ day, handlers }: { day: HoursDayView; handlers: HoursHandlers }) {
  return (
    <li className={`nv-order nv-hours-day${day.closed ? " is-closed" : ""}`}>
      <div className="nv-order-head">
        <div className="nv-order-text">
          <h3 className="nv-order-where">{day.name}</h3>
        </div>
        <button
          type="button"
          className={`nv-btn is-small ${day.closed ? "is-ghost" : "is-green"}`}
          aria-pressed={!day.closed}
          aria-label={day.toggleLabel}
          onClick={() => handlers.onToggleDay?.(day.weekday)}
        >
          {day.closed ? HOURS_CLOSED : HOURS_OPEN}
        </button>
      </div>

      {day.closed
        ? null
        : day.shifts.map((shift, index) => (
            <div className="nv-hours-shift" key={index}>
              <label className="nv-hours-time">
                <span className="nv-hours-time-label">{HOURS_OPENS}</span>
                <span className="nv-field">
                  <input
                    type="time"
                    aria-label={shift.opensLabel}
                    value={shift.opens}
                    onChange={(event) => handlers.onShift?.(day.weekday, index, { opens: event.target.value })}
                  />
                </span>
              </label>
              <label className="nv-hours-time">
                <span className="nv-hours-time-label">{HOURS_CLOSES}</span>
                <span className="nv-field">
                  <input
                    type="time"
                    aria-label={shift.closesLabel}
                    value={shift.closes}
                    onChange={(event) => handlers.onShift?.(day.weekday, index, { closes: event.target.value })}
                  />
                </span>
              </label>
              {shift.removeLabel ? (
                <button type="button" className="nv-btn is-ghost is-small nv-hours-remove" aria-label={shift.removeLabel} onClick={() => handlers.onRemoveShift?.(day.weekday, index)}>
                  <NvIcon name="close" />
                  {HOURS_REMOVE_SHIFT(index + 1)}
                </button>
              ) : null}
            </div>
          ))}

      {!day.closed && (day.canAddShift || day.canCopy) ? (
        <div className="nv-optacts">
          {day.canAddShift ? (
            <button type="button" className="nv-btn is-ghost is-small" onClick={() => handlers.onAddShift?.(day.weekday)}>
              <NvIcon name="plus" />
              {HOURS_ADD_SHIFT}
            </button>
          ) : null}
          {day.canCopy ? (
            <button type="button" className="nv-btn is-ghost is-small" onClick={() => handlers.onCopyAll?.(day.weekday)}>
              {HOURS_COPY_ALL}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * O Horário do painel: como o restaurante está agora para o cliente (aberto, fechado, pausado), o botão de pausar (vale na
 * hora), os sete dias com seus turnos, a semana em uma linha e o botão de salvar. A pessoa pode **falar** o horário: o que
 * ela disse vira horas na tela e nada é salvo até ela tocar em Salvar horário. Sem horário salvo o restaurante recebe pedido
 * a qualquer hora.
 */
export default function Hours({ view, onMenu, showMenu = false, ...handlers }: Props) {
  const ready = view.load === "ready";
  const speaking = view.listening !== null;
  const listeningNow = speaking ? { heard: view.listening?.heard ?? "" } : null;
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-hours">
        <TopBar title={HOURS_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-hours-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        {view.load === "loading" ? <p className="nv-empty">{HOURS_LOADING}</p> : null}
        {view.load === "error" ? (
          <>
            <p className="nv-error" role="alert">
              {view.error}
            </p>
            <button type="button" className="nv-btn is-ghost is-block" onClick={handlers.onRetry}>
              {HOURS_RETRY}
            </button>
          </>
        ) : null}

        {ready && view.now ? (
          <section className={`nv-order nv-hours-now is-${view.now.tone}`} aria-label={view.now.title}>
            <h2 className="nv-order-where">{view.now.title}</h2>
            {view.now.detail ? <p className="nv-order-meta">{view.now.detail}</p> : null}
          </section>
        ) : null}

        {ready ? (
          <section className="nv-hours-pause">
            <p className="nv-code-hint">{view.pauseHelp}</p>
            <button
              type="button"
              className={`nv-btn is-block ${view.paused ? "is-green" : "is-ghost"}`}
              aria-pressed={view.paused}
              disabled={view.switching}
              aria-busy={view.switching || undefined}
              onClick={handlers.onPause}
            >
              <NvIcon name={view.paused ? "check" : "clock"} />
              {view.pauseButton}
            </button>
          </section>
        ) : null}

        {ready ? <p className="nv-code-hint">{HOURS_INTRO}</p> : null}

        {ready ? <h2 className="nv-h2">{HOURS_DAYS_TITLE}</h2> : null}
        {ready && view.noHoursHint ? <p className="nv-hint">{view.noHoursHint}</p> : null}

        {ready && view.canSpeak && !listeningNow ? (
          <button type="button" className="nv-btn is-ghost is-block" onClick={handlers.onSpeak}>
            <NvIcon name="mic" />
            {HOURS_SPEAK}
          </button>
        ) : null}

        {listeningNow ? (
          <div className="nv-hours-listen" role="status" aria-live="polite">
            <strong>{HOURS_LISTENING}</strong>
            <p>{listeningNow.heard || HOURS_SPEAK_HINT}</p>
            <div className="nv-optacts">
              <button type="button" className="nv-btn is-green is-small" onClick={handlers.onDone}>
                {HOURS_DONE}
              </button>
              <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onCancel}>
                {HOURS_CANCEL}
              </button>
            </div>
          </div>
        ) : null}

        {view.spoken ? (
          <div className="nv-hours-heard" role="status">
            {view.spoken.said ? <p className="nv-hours-said">{HOURS_YOU_SAID(view.spoken.said)}</p> : null}
            {view.spoken.lines.length > 0 ? (
              <>
                <p className="nv-hours-understood">{HOURS_UNDERSTOOD}</p>
                <ul>
                  {view.spoken.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p>{HOURS_CHECK}</p>
              </>
            ) : (
              <p className="nv-hours-failed">{view.spoken.failed}</p>
            )}
            {view.spoken.notes.length > 0 ? (
              <ul className="nv-hours-notes">
                {view.spoken.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="nv-btn is-ghost is-small" onClick={handlers.onCloseSpoken}>
              {HOURS_CLOSE_NOTE}
            </button>
          </div>
        ) : null}

        {ready ? (
          <ul className="nv-orders">
            {view.days.map((day) => (
              <DayCard key={day.weekday} day={day} handlers={handlers} />
            ))}
          </ul>
        ) : null}

        {ready ? <p className="nv-hours-summary">{view.summary}</p> : null}

        {view.problems.length > 0 ? (
          <div className="nv-error" role="alert">
            <p className="nv-hours-missing">{HOURS_MISSING}</p>
            <ul>
              {view.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.notice ? (
          view.notice.ok ? (
            <p className="nv-ok" aria-hidden="true">
              {view.notice.text}
            </p>
          ) : (
            <p className="nv-error" role="alert">
              {view.notice.text}
            </p>
          )
        ) : null}

        {ready && view.dirty ? (
          <div className="nv-hours-unsaved">
            <span className="nv-order-chip">{HOURS_UNSAVED}</span>
            <button type="button" className="nv-btn is-ghost is-small" disabled={view.saving} onClick={handlers.onDiscard}>
              {HOURS_DISCARD}
            </button>
          </div>
        ) : null}

        {ready && view.canRemoveHours ? (
          <button
            type="button"
            className={`nv-btn is-ghost is-block${view.removeArmed ? " is-armed" : ""}`}
            disabled={view.removing || view.saving}
            aria-busy={view.removing || undefined}
            onClick={handlers.onRemove}
          >
            {view.removing ? HOURS_REMOVING : view.removeArmed ? HOURS_REMOVE_ARMED : HOURS_REMOVE}
          </button>
        ) : null}
      </main>

      <div className="nv-dock">
        {ready ? (
          <button type="button" className="nv-btn is-green is-block nv-send" disabled={!view.canSave} aria-busy={view.saving || undefined} onClick={handlers.onSave}>
            {view.saving ? HOURS_SAVING : HOURS_SAVE}
          </button>
        ) : null}
        {view.canSpeak ? <VoiceOrb label={HOURS_SPEAK} onPress={handlers.onSpeak} listening={speaking} /> : <VoiceOrb label="Falar com o Vem" />}
      </div>
    </div>
  );
}
