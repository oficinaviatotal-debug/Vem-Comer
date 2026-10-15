import { useCallback, useEffect, useRef, useState } from "react";
import "../ui.css";
import "../admin.css";
import "./nav.css";
import { decideApproval, fetchApprovals } from "../service/approvalsApi";
import {
  DECISIONS,
  LOG_EMPTY,
  NOTE_MAX,
  QUEUE_EMPTY,
  costText,
  decisionOf,
  doneText,
  evidenceSource,
  noteProblem,
  queueHeadline,
  statusTone,
  type ApprovalCard,
  type ApprovalsData,
  type Decision,
} from "../service/approvalsLogic";

const REFRESH_MS = 60_000;

type Props = {
  /** Tells the panel how many decisions wait (the number on the menu and on "Hoje"). */
  onCount?: (pending: number) => void;
};

/**
 * "Aprovações", only for the owner of the platform (the server decides who): one card per decision with what, why,
 * the evidence (each fact with its source and date), the risk and what happens if he refuses, and below it the
 * registry of the latest actions. Approving only releases an action; nothing here runs, sends or changes anything.
 */
export default function ApprovalsView({ onCount }: Props) {
  const [data, setData] = useState<ApprovalsData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The newest answer wins: a slow one never overwrites a newer one.
  const latest = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      const ticket = ++latest.current;
      try {
        const next = await fetchApprovals();
        if (ticket !== latest.current) return;
        setData(next);
        setError("");
        onCount?.(next.pending_count);
      } catch (reason) {
        if (ticket !== latest.current) return;
        // A quiet refresh that fails keeps what is on screen.
        if (!quiet) setError(reason instanceof Error ? reason.message : "Não consegui abrir as aprovações.");
      }
    },
    [onCount],
  );

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      latest.current += 1;
    };
  }, [load]);

  function decided(id: string, message: string) {
    setNotice(message);
    // The card leaves the queue at once (the server already wrote the decision); the refresh confirms it.
    setData((current) =>
      current
        ? { ...current, pending: current.pending.filter((card) => card.id !== id), pending_count: Math.max(0, current.pending_count - 1) }
        : current,
    );
    void load(true);
  }

  if (!data) {
    return (
      <section className="sheet ap" aria-label="Aprovações" aria-busy={!error}>
        <h2>Aprovações</h2>
        {error ? (
          <>
            <p className="msg-error" role="alert">
              {error}
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void load(false)}>
              Tentar de novo
            </button>
          </>
        ) : (
          <p className="adm-muted" role="status">
            Abrindo as aprovações…
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="sheet ap" aria-label="Aprovações">
      <h2>Aprovações</h2>
      <p className="ap-lead">
        Aqui chega o que um agente quer fazer e precisa do seu aval. <strong>Aprovar só libera a ação</strong> e fica
        escrito no registro.
      </p>
      <p className="ap-headline">
        <strong>{queueHeadline(data.pending_count)}</strong>
      </p>

      <p className="ap-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}

      {data.pending.length === 0 ? (
        <p className="adm-muted">{QUEUE_EMPTY}</p>
      ) : (
        <div className="ap-list">
          {data.pending.map((card) => (
            <PendingCard key={card.id} card={card} onDone={(message) => decided(card.id, message)} />
          ))}
        </div>
      )}

      <h3 className="ap-h3">Registro</h3>
      {data.recent.length === 0 ? (
        <p className="adm-muted">{LOG_EMPTY}</p>
      ) : (
        <ul className="ap-log">
          {data.recent.map((card) => (
            <li key={card.id} className="ap-log-item">
              <div className="ap-log-head">
                <strong>{card.title}</strong>
                <span className={`ap-chip ap-tone-${statusTone(card.status)}`}>{card.status_label}</span>
              </div>
              <p className="adm-muted ap-log-meta">
                {card.agent_label} · {card.level_label} · {card.when_label}
                {card.cost_cents > 0 ? ` · custo ${costText(card.cost_cents)}` : ""}
              </p>
              {card.decision_note && <p className="ap-log-note">Sua nota: {card.decision_note}</p>}
              {card.result && <p className="ap-log-note">Resultado: {card.result}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Block({ label, text, risk = false }: { label: string; text: string; risk?: boolean }) {
  if (!text) return null;
  return (
    <div className={risk ? "ap-block ap-block-risk" : "ap-block"}>
      <h4>{label}</h4>
      <p>{text}</p>
    </div>
  );
}

/** One decision waiting. Two taps on purpose: pick, then confirm, so a stray touch never approves anything. */
function PendingCard({ card, onDone }: { card: ApprovalCard; onDone: (message: string) => void }) {
  const [choice, setChoice] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const picked = decisionOf(choice);
  const titleId = `ap-title-${card.id}`;
  const noteId = `ap-note-${card.id}`;

  function pick(next: Decision) {
    setChoice(next);
    setProblem("");
  }

  function back() {
    setChoice(null);
    setNote("");
    setProblem("");
  }

  async function confirm() {
    if (!picked || busy) return;
    const issue = noteProblem(picked.key, note);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const answer = await decideApproval(card.id, picked.key, note.trim());
      onDone(`${card.title}: ${doneText(answer.status, answer.already)}`);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : "Não consegui registrar a decisão. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <article className="ap-card" aria-labelledby={titleId}>
      <div className="ap-head">
        <span className="chip chip-wait">{card.agent_label}</span>
        <span className="ap-when">{card.when_label}</span>
      </div>
      <h3 id={titleId} className="ap-title">
        {card.title}
      </h3>
      <p className="ap-level">{card.level_label}</p>

      <Block label="O que será feito" text={card.what} />
      <Block label="Por que" text={card.why} />
      {card.evidence.length > 0 && (
        <div className="ap-block">
          <h4>Evidência</h4>
          <ul className="ap-evidence">
            {card.evidence.map((item, index) => (
              <li key={`${index}-${item.source}`}>
                <span>{item.fact}</span>
                <small>{evidenceSource(item)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Block label="Risco" text={card.risk} risk />
      <Block label="Se você recusar" text={card.if_refused} />

      {!picked ? (
        <div className="ap-actions" role="group" aria-label={`Sua decisão sobre: ${card.title}`}>
          {DECISIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === "approve" ? "btn btn-primary" : "btn btn-outline"}
              onClick={() => pick(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="ap-confirm">
          <p className="ap-hint">{picked.hint}</p>
          <label htmlFor={noteId} className="ap-note-label">
            {picked.needsNote ? "O que deve mudar" : "Nota (se quiser)"}
          </label>
          <textarea
            id={noteId}
            className="ap-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            aria-required={picked.needsNote}
          />
          {problem && (
            <p className="msg-error" role="alert">
              {problem}
            </p>
          )}
          <div className="ap-actions">
            <button
              type="button"
              className={picked.key === "approve" ? "btn btn-primary" : "btn btn-outline"}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Registrando…" : picked.confirm}
            </button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={back}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
