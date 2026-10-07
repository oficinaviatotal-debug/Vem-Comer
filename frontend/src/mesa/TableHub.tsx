import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./mesa.css";
import { createTableCall, fetchTableCall, HttpError } from "../service/api";
import {
  CALL_POLL_MS,
  MAIN_CALLS,
  SMALL_CALLS,
  buttonState,
  callErrorMessage,
  createCallMemory,
  isKind,
  safeJobsUrl,
  type CallKind,
  type CallOption,
  type MyCall,
} from "./callsLogic";

type Props = {
  companyId: string;
  slug: string;
  tableId: string;
  tableNumber: number | null;
  /** Link do Vem Trabalhar ("Trabalhe aqui"). Só aparece se for um endereço https. */
  jobsUrl?: string;
  onSeeMenu: () => void;
};

/** Little line icons so each button is recognised at a glance, even by someone who reads slowly. */
const CALL_ICONS: Record<CallKind, ReactNode> = {
  garcom: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  conta: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  agua: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  limpeza: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
};

function CallIcon({ kind }: { kind: CallKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      {CALL_ICONS[kind]}
    </svg>
  );
}

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A tela da mesa: o que abre quando o cliente lê o QR. Chamar garçom, ver o cardápio, pedir a conta,
 * água, limpeza e "Trabalhe aqui". Grande, de uma mão só, e funciona em sinal fraco: um toque manda
 * uma chamada pequena, e a tela só pergunta de tempos em tempos se já atenderam.
 */
export default function TableHub({ companyId, slug, tableId, tableNumber, jobsUrl, onSeeMenu }: Props) {
  const memory = useMemo(() => createCallMemory(browserStorage()), []);
  const [calls, setCalls] = useState<MyCall[]>(() => memory.list(slug, tableId));
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState<CallKind | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const noticeTimer = useRef<number | null>(null);

  const openIds = calls.filter((call) => call.status === "open").map((call) => call.id);
  const openKey = openIds.join(",");

  // Pergunta se já atenderam, só enquanto há chamada aberta e a tela está à vista.
  useEffect(() => {
    if (!openKey) return;
    let alive = true;

    async function check() {
      if (document.hidden) return;
      setNow(Date.now());
      for (const call of memory.list(slug, tableId).filter((item) => item.status === "open")) {
        try {
          const result = await fetchTableCall(companyId, tableId, call.id);
          if (!alive) return;
          if (result?.status === "answered") setCalls(memory.setStatus(slug, tableId, call.id, "answered"));
        } catch (caught) {
          // chamada que o servidor não conhece mais: esquece, o botão volta ao normal
          if (alive && caught instanceof HttpError && caught.status === 404) {
            setCalls(memory.setStatus(slug, tableId, call.id, "answered"));
          }
        }
      }
    }

    const timer = window.setInterval(() => void check(), CALL_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [openKey, memory, slug, tableId, companyId]);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    []
  );

  const call = useCallback(
    async (kind: CallKind) => {
      if (sending) return;
      setSending(kind);
      setError("");
      try {
        const result = await createTableCall(companyId, tableId, kind);
        if (!result?.id || !isKind(result.kind)) throw new Error("incomplete");
        setCalls(memory.put(slug, tableId, { id: String(result.id), kind: result.kind, status: "open" }));
        setNow(Date.now());
        setNotice(String(result.message || "Avisamos o atendente."));
        try {
          navigator.vibrate?.(40);
        } catch {
          /* sem vibração neste aparelho */
        }
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(""), 6000);
      } catch (caught) {
        const status = caught instanceof HttpError ? caught.status : null;
        const message = caught instanceof Error ? caught.message : null;
        setNotice("");
        setError(callErrorMessage(status, message));
      } finally {
        setSending(null);
      }
    },
    [companyId, tableId, slug, memory, sending]
  );

  const jobs = safeJobsUrl(jobsUrl);

  function renderCall(option: CallOption, size: "big" | "small") {
    const mine = calls.find((item) => item.kind === option.kind);
    const state = buttonState(option, mine, now);
    const busy = sending === option.kind;
    return (
      <button
        key={option.kind}
        type="button"
        className={`mesa-call mesa-call-${size}${state.answered ? " is-answered" : ""}${
          state.disabled ? " is-called" : ""
        }`}
        disabled={state.disabled || busy}
        aria-busy={busy}
        onClick={() => void call(option.kind)}
      >
        <span className="mesa-call-icon">
          <CallIcon kind={option.kind} />
        </span>
        <span className="mesa-call-label">{busy ? "Avisando…" : state.label}</span>
        {size === "big" && <span className="mesa-call-note">{state.note}</span>}
      </button>
    );
  }

  return (
    <section className="mesa" aria-labelledby="mesa-title">
      <h2 id="mesa-title" className="mesa-title">
        {tableNumber ? `Mesa ${tableNumber}` : "Sua mesa"}
      </h2>
      <p className="mesa-sub">O que você precisa agora?</p>

      <button type="button" className="btn btn-primary btn-block mesa-menu" onClick={onSeeMenu}>
        Ver cardápio e pedir
      </button>

      <div className="mesa-grid">{MAIN_CALLS.map((option) => renderCall(option, "big"))}</div>
      <div className="mesa-small">{SMALL_CALLS.map((option) => renderCall(option, "small"))}</div>

      <div className="mesa-live" role="status" aria-live="polite">
        {notice}
      </div>
      {error && (
        <p className="mesa-error" role="alert">
          {error}
        </p>
      )}

      {jobs && (
        <a className="btn btn-outline btn-block mesa-jobs" href={jobs} target="_blank" rel="noopener noreferrer">
          Trabalhe aqui
        </a>
      )}
    </section>
  );
}
