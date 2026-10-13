import { useEffect, useRef, useState } from "react";
import "../ui.css";
import "../admin.css";
import "./help.css";
import { askForHelp, type HelpAnswer } from "./helpApi";
import {
  HELP_MAX_MESSAGE,
  HELP_TOPICS,
  blankHelp,
  helpBody,
  helpProblem,
  type HelpDraft,
  type HelpTopic,
} from "./helpLogic";
import { formatPhoneInput } from "../signup/signupLogic";

type Props = {
  /** The panel screen the owner was on (only to help whoever answers). */
  screen: string;
  /** The topic that fits that screen, already marked. */
  suggested: HelpTopic | "";
  onClose: () => void;
};

type Phase = "form" | "sending" | "sent";

/**
 * "Preciso de ajuda": the owner picks what is wrong, writes (or dictates with the keyboard microphone) a few words and
 * a person from Vem Comer gets the request. Asking again while a request is open updates it instead of adding another.
 */
export default function HelpSheet({ screen, suggested, onClose }: Props) {
  const [draft, setDraft] = useState<HelpDraft>(() => blankHelp(suggested));
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const top = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // The sheet may open while the owner is scrolled down inside the assistant: bring it into view.
    top.current?.scrollIntoView?.({ block: "start" });
  }, []);

  async function send() {
    const problem = helpProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setPhase("sending");
    setError("");
    try {
      setAnswer(await askForHelp(helpBody(draft, screen)));
      setPhase("sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não consegui enviar o pedido. Tente de novo.");
      setPhase("form");
    }
  }

  if (phase === "sent" && answer) {
    return (
      <section ref={top} className="sheet help" aria-label="Pedido de ajuda enviado">
        <h2>Pedido enviado</h2>
        <p className="help-sent" role="status">
          {answer.message}
        </p>
        <div className="help-actions">
          {answer.whatsapp_url && (
            <a className="btn btn-primary" href={answer.whatsapp_url} target="_blank" rel="noreferrer">
              Falar agora pelo WhatsApp
            </a>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    );
  }

  const busy = phase === "sending";

  return (
    <section ref={top} className="sheet help" aria-label="Preciso de ajuda">
      <h2>Preciso de ajuda</h2>
      <p className="adm-muted">Conte o que travou. Uma pessoa do Vem Comer vai falar com você.</p>

      <div className="help-topics" role="radiogroup" aria-label="Assunto">
        {HELP_TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            role="radio"
            aria-checked={draft.topic === topic.id}
            className={draft.topic === topic.id ? "btn btn-outline is-on" : "btn btn-outline"}
            disabled={busy}
            onClick={() => {
              setDraft({ ...draft, topic: topic.id });
              setError("");
            }}
          >
            {topic.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>O que aconteceu? (se quiser)</span>
        <textarea
          value={draft.message}
          maxLength={HELP_MAX_MESSAGE}
          disabled={busy}
          placeholder="Escreva, ou toque no microfone do teclado do celular e fale."
          onChange={(event) => setDraft({ ...draft, message: event.target.value })}
        />
      </label>

      <label className="field">
        <span>Seu WhatsApp, se for diferente do cadastro (se quiser)</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft.phone}
          disabled={busy}
          placeholder="(84) 99999-1234"
          onChange={(event) => setDraft({ ...draft, phone: formatPhoneInput(event.target.value) })}
        />
      </label>

      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}

      <div className="help-actions">
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void send()}>
          {busy ? "Enviando…" : "Pedir ajuda"}
        </button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={onClose}>
          Agora não
        </button>
      </div>
    </section>
  );
}
