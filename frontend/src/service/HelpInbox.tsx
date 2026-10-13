import { useEffect, useState } from "react";
import "../ui.css";
import "../admin.css";
import "../plan.css";
import "./help.css";
import { fetchPlatformHelp, resolveHelp } from "./helpApi";
import {
  inboxHeadline,
  safeWhatsappUrl,
  stopwatchText,
  trackingChip,
  trackingTone,
  type PlatformHelp,
} from "./helpLogic";

type Load = "loading" | "ready" | "error";

/**
 * Tab "Ajuda", only for GD's logins (the server decides who): the owners who asked for help, oldest first, and the
 * follow-up of the restaurants that signed up by themselves, with how long the menu took. Nothing here changes a
 * restaurant: "Resolvido" only closes the request.
 */
export default function HelpInbox({ onCount }: { onCount?: (open: number) => void }) {
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<PlatformHelp | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  async function open() {
    setLoad("loading");
    setError("");
    try {
      const next = await fetchPlatformHelp();
      setData(next);
      onCount?.(next.open_count);
      setLoad("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui abrir a caixa de ajuda.");
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(id: string) {
    setWorking(id);
    setError("");
    try {
      await resolveHelp(id);
      await open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui marcar como resolvido.");
    } finally {
      setWorking(null);
    }
  }

  if (load === "loading" && !data) {
    return (
      <section className="sheet plan help-inbox" aria-label="Ajuda">
        <h2>Ajuda</h2>
        <p className="adm-muted" role="status">
          Abrindo a caixa…
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="sheet plan help-inbox" aria-label="Ajuda">
        <h2>Ajuda</h2>
        <p className="msg-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </section>
    );
  }

  const stopwatch = stopwatchText(data.summary, data.deadline_days);

  return (
    <section className="sheet plan help-inbox" aria-label="Ajuda">
      <h2>Ajuda</h2>
      <p className="plan-summary">
        <strong>{inboxHeadline(data)}</strong>
      </p>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}

      <h3>Pedidos abertos</h3>
      {data.open.length === 0 ? (
        <p className="adm-muted">Ninguém pediu ajuda agora.</p>
      ) : (
        <ul className="plan-list">
          {data.open.map((request) => {
            const link = safeWhatsappUrl(request.whatsapp_url);
            return (
              <li key={request.id} className={request.repeats > 0 ? "plan-co plan-bad" : "plan-co plan-warn"}>
                <div className="plan-co-head">
                  <strong>{request.company_name || "Restaurante sem nome"}</strong>
                  <span className="chip chip-wait">{request.topic_label}</span>
                </div>
                <p className="adm-muted plan-co-meta">
                  {request.owner_name || "Sem dono cadastrado"} · {request.waiting_label}
                  {request.repeats > 0 && ` · pediu de novo ${request.repeats} ${request.repeats === 1 ? "vez" : "vezes"}`}
                  {request.screen && ` · estava em ${request.screen}`}
                </p>
                {request.message && <p className="help-note">{request.message}</p>}
                <div className="plan-actions">
                  {link ? (
                    <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noreferrer">
                      Responder no WhatsApp
                    </a>
                  ) : (
                    <span className="adm-muted">Sem WhatsApp cadastrado</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={working === request.id}
                    onClick={() => void finish(request.id)}
                  >
                    {working === request.id ? "Salvando…" : "Resolvido"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h3>Cadastros pela internet</h3>
      {stopwatch && <p className="adm-muted">{stopwatch}</p>}
      {data.tracking.length === 0 ? (
        <p className="adm-muted">Ninguém se cadastrou sozinho ainda.</p>
      ) : (
        <ul className="plan-list">
          {data.tracking.map((row) => {
            const tone = trackingTone(row.state);
            const link = safeWhatsappUrl(row.whatsapp_url);
            return (
              <li key={row.company_id} className={`plan-co plan-${tone}`}>
                <div className="plan-co-head">
                  <strong>{row.company_name || "Restaurante sem nome"}</strong>
                  <span className={tone === "ok" ? "chip chip-done" : tone === "quiet" ? "chip" : "chip chip-wait"}>
                    {trackingChip(row.state)}
                  </span>
                </div>
                <p className="adm-muted plan-co-meta">
                  {row.owner_name || "Sem dono cadastrado"} · {row.products}{" "}
                  {row.products === 1 ? "prato" : "pratos"} · {row.text}
                  {row.has_open_help && " · já pediu ajuda"}
                </p>
                {!row.ready && link && (
                  <div className="plan-actions">
                    <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noreferrer">
                      Chamar no WhatsApp
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
