import { useCallback, useEffect, useRef, useState } from "react";
import "./mesa.css";
import { answerTableCall, fetchTableCalls } from "../service/api";
import {
  barTitle,
  becameUrgent,
  formatWaiting,
  freshCalls,
  parsePanelCalls,
  type PanelCall,
  type Urgency,
} from "./callsLogic";

/** De quanto em quanto tempo o painel pergunta se alguma mesa chamou. */
export const PANEL_POLL_MS = 6000;

type Props = { companyId: string };

function alertDevice(urgent: boolean) {
  try {
    navigator.vibrate?.(urgent ? [300, 120, 300, 120, 300] : [200, 100, 200]);
  } catch {
    /* sem vibração neste aparelho */
  }
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => void ctx.close();
  } catch {
    /* o navegador pode bloquear som antes do primeiro toque: tudo bem, a tela avisa do mesmo jeito */
  }
}

/**
 * O aviso das mesas que estão chamando, no topo do painel: "Mesa 4 chama o garçom, há 2 min" e o botão
 * Atender. Fica escondido quando ninguém chama. Chamada nova faz o aparelho vibrar e apitar uma vez;
 * quando a mesa espera demais, ou o cliente toca de novo, avisa mais uma vez.
 */
export default function CallsBar({ companyId }: Props) {
  const [calls, setCalls] = useState<PanelCall[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState("");
  const known = useRef<Set<string> | null>(null);
  const urgencies = useRef<Map<string, Urgency>>(new Map());

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    try {
      const next = parsePanelCalls(await fetchTableCalls(companyId));
      const arrived = freshCalls(known.current, next);
      const urgent = becameUrgent(urgencies.current, next);
      if (arrived.length > 0) {
        setFresh(new Set(arrived.map((call) => call.id)));
        alertDevice(arrived.some((call) => call.urgency === "urgent"));
      } else if (urgent.length > 0) {
        alertDevice(true);
      }
      known.current = new Set(next.map((call) => call.id));
      urgencies.current = new Map(next.map((call) => [call.id, call.urgency]));
      setCalls(next);
    } catch {
      /* sinal fraco: tenta de novo daqui a pouco, sem fazer barulho */
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), PANEL_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function answer(call: PanelCall) {
    setFailed("");
    // some da lista na hora; se o servidor não confirmar, a próxima busca traz de volta
    setCalls((current) => current.filter((item) => item.id !== call.id));
    known.current?.delete(call.id);
    try {
      await answerTableCall(companyId, call.id);
    } catch {
      setFailed("Não deu para marcar como atendida. Confira a internet.");
      void refresh();
    }
  }

  if (calls.length === 0 && !failed) return null;

  return (
    <section className="calls-bar" aria-label="Mesas chamando">
      {calls.length > 0 && <h2 className="calls-title">{barTitle(calls.length)}</h2>}
      <div className="calls-list" role="status" aria-live="polite">
        {calls.map((call) => (
          <div
            key={call.id}
            className={`calls-item${call.urgency === "late" ? " is-late" : ""}${
              call.urgency === "urgent" ? " is-urgent" : ""
            }${fresh.has(call.id) ? " is-fresh" : ""}`}
          >
            <span className="calls-text">
              <span className="calls-what">{call.text}</span>
              <span className="calls-wait">
                {formatWaiting(call.waiting_seconds)}
                {call.repeats > 0 ? ", chamou de novo" : ""}
              </span>
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void answer(call)}>
              Atender
            </button>
          </div>
        ))}
      </div>
      {failed && (
        <p className="mesa-error" role="alert">
          {failed}
        </p>
      )}
    </section>
  );
}
