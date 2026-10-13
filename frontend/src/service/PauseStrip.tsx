import { useCallback, useEffect, useState } from "react";
import "../ui.css";
import "../hours.css";
import { fetchAdminHours, setOrdersPaused } from "./hoursApi";

const REFRESH_MS = 60_000;

/**
 * The strip on top of Pedidos: whether the restaurant is taking orders right now and one tap to pause them (the
 * kitchen fills up) or take them again. It reads its own state; when it cannot be read (no permission, no signal) it
 * shows nothing, because Pedidos works without it.
 */
export default function PauseStrip() {
  const [paused, setPaused] = useState(false);
  const [text, setText] = useState("");
  const [closed, setClosed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAdminHours();
      setPaused(data.orders_paused);
      setClosed(data.configured && !data.open_now);
      setText(data.configured ? data.open_message : "Sem horário cadastrado: recebendo a qualquer hora.");
      setReady(true);
    } catch {
      /* the strip is an extra: Pedidos goes on without it */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function flip() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setPaused(await setOrdersPaused(!paused));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não consegui mudar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className={paused ? "hrs-strip is-paused" : closed ? "hrs-strip is-closed" : "hrs-strip"} role="status">
      <span>{paused ? "Pedidos pausados: o cliente não consegue pedir." : text}</span>
      <button
        type="button"
        className={paused ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
        disabled={busy}
        aria-pressed={paused}
        onClick={() => void flip()}
      >
        {paused ? "Voltar a receber" : "Pausar pedidos"}
      </button>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
