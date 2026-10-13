import { useEffect, useMemo, useRef, useState } from "react";
import "../ui.css";
import "../admin.css";
import "../hours.css";
import { clearAdminHours, fetchAdminHours, saveAdminHours, setOrdersPaused } from "./hoursApi";
import ConfirmButton from "./ConfirmButton";
import { canListen, hear, DICTATION_PATIENCE_MS, type Hearing } from "../assistant/voiceIO";
import { parseSpokenHours, SPOKEN_HOURS_HELP } from "./spokenHours";
import {
  DAY_NAMES,
  MAX_SHIFTS,
  addShift,
  copyToAll,
  fromApi,
  removeShift,
  setClosed,
  setShift,
  snapshot,
  summary,
  toBody,
  validate,
  type ApiHours,
  type Day,
} from "./hoursDraft";

type Load = "loading" | "ready" | "error";

/**
 * Tab "Horário": the days and hours the restaurant takes orders, and the pause. The pause saves at once (it cannot
 * wait); the hours are saved with the button, after the owner checks what was typed or said. With no hours saved the
 * restaurant takes orders at any time: nothing is closed by accident.
 */
export default function HoursPanel() {
  const [load, setLoad] = useState<Load>("loading");
  const [server, setServer] = useState<ApiHours | null>(null);
  const [week, setWeek] = useState<Day[]>(() => fromApi(null));
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [spoken, setSpoken] = useState<{ said: string; lines: string[]; notes: string[] } | null>(null);
  const hearingRef = useRef<Hearing | null>(null);
  const heardRef = useRef("");
  const micAvailable = canListen();

  async function open() {
    setLoad("loading");
    try {
      const data = await fetchAdminHours();
      setServer(data);
      setWeek(fromApi(data));
      setLoad("ready");
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui abrir o horário." });
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
  }, []);

  // Leaving the tab turns the microphone off
  useEffect(() => () => hearingRef.current?.cancel(), []);

  const dirty = useMemo(
    () => load === "ready" && server !== null && snapshot(week) !== snapshot(fromApi(server)),
    [week, server, load]
  );

  function change(next: Day[]) {
    setWeek(next);
    setProblems([]);
    setNotice(null);
  }

  /** The pause saves right away: the server has the hours, not the ones being edited. */
  async function flipPause() {
    if (!server || switching) return;
    setSwitching(true);
    setNotice(null);
    try {
      const paused = await setOrdersPaused(!server.orders_paused);
      setServer({ ...server, orders_paused: paused });
      setNotice({
        ok: true,
        text: paused ? "Pedidos pausados. Os clientes já veem." : "Pedidos de volta. Os clientes já veem.",
      });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui mudar. Tente de novo." });
    } finally {
      setSwitching(false);
    }
  }

  /** What was said becomes hours on the screen. Nothing is saved: the owner checks and taps "Salvar horário". */
  function understand(said: string) {
    const parsed = parseSpokenHours(said, week);
    if (!parsed.week) {
      setSpoken({ said, lines: [], notes: parsed.notes });
      return;
    }
    change(parsed.week);
    setSpoken({ said, lines: parsed.lines, notes: parsed.notes });
  }

  async function listen() {
    if (hearingRef.current) return;
    setSpoken(null);
    setHeard("");
    heardRef.current = "";
    setListening(true);
    const hearing = hear({
      patienceMs: DICTATION_PATIENCE_MS,
      onPartial: (text) => {
        heardRef.current = text;
        setHeard(text);
      },
    });
    hearingRef.current = hearing;
    const said = await hearing.result;
    if (hearingRef.current !== hearing) return; // cancelled or replaced meanwhile
    hearingRef.current = null;
    setListening(false);
    understand((said ?? heardRef.current).trim());
  }

  /** "Pronto": use the words heard so far instead of waiting for the silence. */
  function finishListening() {
    const hearing = hearingRef.current;
    if (!hearing) return;
    hearingRef.current = null;
    hearing.cancel();
    setListening(false);
    understand(heardRef.current.trim());
  }

  function cancelListening() {
    hearingRef.current?.cancel();
    hearingRef.current = null;
    setListening(false);
    setHeard("");
  }

  async function save() {
    const found = validate(week);
    if (found.length > 0) {
      setProblems(found);
      setNotice(null);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveAdminHours(toBody(week));
      setServer(saved);
      setWeek(fromApi(saved));
      setProblems([]);
      setSpoken(null);
      setNotice({ ok: true, text: "Horário salvo. Os clientes já veem." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui salvar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  async function removeHours() {
    setSaving(true);
    setNotice(null);
    try {
      await clearAdminHours();
      const data = await fetchAdminHours();
      setServer(data);
      setWeek(fromApi(data));
      setProblems([]);
      setSpoken(null);
      setNotice({ ok: true, text: "Horário tirado. O restaurante recebe pedido a qualquer hora." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "Não consegui tirar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  if (load === "loading") {
    return (
      <section className="sheet hrs" aria-label="Horário">
        <h2>Horário</h2>
        <p className="adm-muted" role="status">
          Abrindo o horário…
        </p>
      </section>
    );
  }

  if (load === "error" || !server) {
    return (
      <section className="sheet hrs" aria-label="Horário">
        <h2>Horário</h2>
        {notice && (
          <p className="msg-error" role="alert">
            {notice.text}
          </p>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </section>
    );
  }

  const paused = server.orders_paused;
  // the "copy to all days" button sits on the first open day: set it, copy, then change the exceptions
  const firstOpen = week.find((day) => !day.closed)?.weekday;

  return (
    <section className="sheet hrs" aria-label="Horário">
      <h2>Horário</h2>
      <p className="adm-muted">
        Fora do horário, o cliente ainda vê o cardápio, mas não consegue pedir. Mesa e pedido em andamento não são
        cortados pelo horário.
      </p>

      <div className={paused ? "hrs-now is-paused" : server.configured && !server.open_now ? "hrs-now is-closed" : "hrs-now"}>
        <strong>
          {paused ? "Pedidos pausados" : server.configured ? (server.open_now ? "Aberto agora" : "Fechado agora") : "Sem horário"}
        </strong>
        <span>
          {paused
            ? "O cliente vê que não estamos recebendo agora."
            : server.configured
              ? server.open_message
              : "O restaurante recebe pedido a qualquer hora."}
        </span>
      </div>

      <div className="hrs-switch">
        <span>
          <strong>Pausar os pedidos</strong>
          <small>
            {paused
              ? "Pausado: ninguém consegue pedir, nem na mesa. O que já foi pedido continua."
              : "Use quando a cozinha encher. Vale na hora, em qualquer horário."}
          </small>
        </span>
        <button
          type="button"
          className={paused ? "btn btn-outline btn-sm is-alert" : "btn btn-outline btn-sm"}
          aria-pressed={paused}
          disabled={switching}
          onClick={() => void flipPause()}
        >
          {paused ? "Voltar a receber" : "Pausar agora"}
        </button>
      </div>

      <h3>Dias e horas</h3>
      {!server.configured && (
        <p className="adm-muted">
          Ainda sem horário. Ajuste os dias abaixo{micAvailable ? " (ou fale)" : ""} e toque em Salvar horário.
        </p>
      )}

      {micAvailable &&
        (listening ? (
          <div className="hrs-listen" role="status" aria-live="polite">
            <strong>Estou ouvindo…</strong>
            <p>{heard || "Pode falar. Ex.: de segunda a sexta das 11 às 15 e das 18 às 23, sábado das 11 às 23, domingo fechado."}</p>
            <div className="hrs-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={finishListening}>
                Pronto
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={cancelListening}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-mata" onClick={() => void listen()}>
            <span aria-hidden="true">🎙️</span> Falar o horário
          </button>
        ))}

      {spoken && !listening && (
        <div className="hrs-heard" role="status">
          {spoken.said && (
            <p>
              <strong>Você disse:</strong> “{spoken.said}”
            </p>
          )}
          {spoken.lines.length > 0 ? (
            <>
              <p>
                <strong>Entendi:</strong>
              </p>
              <ul>
                {spoken.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>Confira abaixo e toque em Salvar horário. Ainda não foi salvo.</p>
            </>
          ) : (
            <p className="msg-error">
              {spoken.said ? "Não entendi nenhum horário." : "Não ouvi nada."} {SPOKEN_HOURS_HELP}
            </p>
          )}
          {spoken.notes.length > 0 && (
            <ul className="hrs-notes">
              {spoken.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSpoken(null)}>
            Fechar aviso
          </button>
        </div>
      )}

      <ul className="hrs-days">
        {week.map((day) => {
          const name = DAY_NAMES[day.weekday];
          return (
            <li className={day.closed ? "hrs-day is-closed" : "hrs-day"} key={day.weekday}>
              <div className="hrs-day-head">
                <strong>{name}</strong>
                <button
                  type="button"
                  className={day.closed ? "btn btn-outline btn-sm" : "btn btn-outline btn-sm is-on"}
                  aria-pressed={!day.closed}
                  aria-label={day.closed ? `${name}: fechado. Toque para abrir` : `${name}: aberto. Toque para fechar`}
                  onClick={() => change(setClosed(week, day.weekday, !day.closed))}
                >
                  {day.closed ? "Fechado" : "Aberto"}
                </button>
              </div>

              {!day.closed && (
                <>
                  {day.shifts.map((shift, index) => (
                    <div className={day.shifts.length > 1 ? "hrs-shift has-remove" : "hrs-shift"} key={index}>
                      <label className="field">
                        <span className={index > 0 ? "sr-only" : undefined}>Abre</span>
                        <input
                          type="time"
                          aria-label={`${name}, turno ${index + 1}, hora de abrir`}
                          value={shift.opens}
                          onChange={(event) => change(setShift(week, day.weekday, index, { opens: event.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span className={index > 0 ? "sr-only" : undefined}>Fecha</span>
                        <input
                          type="time"
                          aria-label={`${name}, turno ${index + 1}, hora de fechar`}
                          value={shift.closes}
                          onChange={(event) => change(setShift(week, day.weekday, index, { closes: event.target.value }))}
                        />
                      </label>
                      {day.shifts.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm hrs-remove"
                          aria-label={`Tirar o turno ${index + 1} de ${name}`}
                          onClick={() => change(removeShift(week, day.weekday, index))}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="hrs-actions">
                    {day.shifts.length < MAX_SHIFTS && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => change(addShift(week, day.weekday))}
                      >
                        + Outro turno (almoço e jantar)
                      </button>
                    )}
                    {day.weekday === firstOpen && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => change(copyToAll(week, day.weekday))}
                      >
                        Copiar para todos os dias
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="hrs-summary">{summary(week)}</p>

      {problems.length > 0 && (
        <div className="msg-error" role="alert">
          <p>Falta acertar:</p>
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <p className={notice.ok ? "msg-ok" : "msg-error"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}

      <div className="hrs-save">
        {dirty && <span className="chip chip-wait">Não salvo</span>}
        {dirty && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => change(fromApi(server))} disabled={saving}>
            Descartar
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving || (!dirty && server.configured)}
        >
          {saving ? "Salvando…" : "Salvar horário"}
        </button>
      </div>

      {server.configured && (
        <div className="hrs-actions">
          <ConfirmButton label="Tirar o horário (sempre aberto)" onConfirm={() => void removeHours()} />
        </div>
      )}
    </section>
  );
}
