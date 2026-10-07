import { useEffect, useRef, useState } from "react";
import "./feedback.css";
import { sendFeedback } from "../service/api";
import { canListen, hear, type Hearing } from "../assistant/voiceIO";
import {
  FACES,
  MAX_COMMENT,
  askedRecently,
  feedbackPayload,
  followUp,
  markAsked,
  type FeedbackContext,
  type Rating,
} from "./feedbackLogic";

const STORAGE_KEY = "vc_como_foi";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* sem armazenamento: pode perguntar de novo, sem problema */
  }
}

type Props = { context: FeedbackContext; title?: string };

type Stage = "ask" | "comment" | "sending" | "thanks";

/**
 * "Como foi?" no fim de uma tarefa. Pequeno e fácil de fechar: nunca fica na frente do próximo passo.
 * A mesma tarefa só pergunta de novo no dia seguinte (neste celular).
 */
export default function FeedbackAsk({ context, title = "Como foi?" }: Props) {
  const [hidden, setHidden] = useState(() => askedRecently(readStored(), context, Date.now()));
  const [stage, setStage] = useState<Stage>("ask");
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState("");
  const hearingRef = useRef<Hearing | null>(null);

  useEffect(() => () => hearingRef.current?.cancel(), []);

  if (hidden) return null;

  function pick(value: Rating) {
    setRating(value);
    writeStored(markAsked(readStored(), context, Date.now()));
    setStage("comment");
  }

  async function send(withComment: boolean) {
    if (rating === null) return;
    hearingRef.current?.cancel();
    setListening(false);
    setStage("sending");
    setProblem("");
    const ok = await sendFeedback(feedbackPayload(context, rating, withComment ? comment : ""));
    if (ok) {
      setStage("thanks");
    } else {
      setStage("comment");
      setProblem("Não consegui enviar agora. Tente de novo daqui a pouco.");
    }
  }

  async function dictate() {
    if (listening) {
      hearingRef.current?.cancel();
      setListening(false);
      return;
    }
    const before = comment.trim();
    setListening(true);
    const hearing = hear({
      timeoutMs: 20000,
      onPartial: (text) => setComment(before ? `${before} ${text}` : text),
    });
    hearingRef.current = hearing;
    const said = await hearing.result;
    hearingRef.current = null;
    setListening(false);
    if (said) setComment((before ? `${before} ${said}` : said).slice(0, MAX_COMMENT));
  }

  if (stage === "thanks") {
    return (
      <div className="como-foi" role="status">
        <p className="como-foi-thanks">Obrigado! A gente melhora um pouco todo dia com o que você diz.</p>
      </div>
    );
  }

  return (
    <div className="como-foi" aria-label={title}>
      <div className="como-foi-head">
        <p className="como-foi-title">{title}</p>
        <button type="button" className="como-foi-close" aria-label="Fechar" onClick={() => setHidden(true)}>
          ×
        </button>
      </div>

      {stage === "ask" && (
        <div className="como-foi-faces" role="group" aria-label="Escolha um rostinho">
          {FACES.map((face) => (
            <button key={face.rating} type="button" className="como-foi-face" onClick={() => pick(face.rating)}>
              <span aria-hidden="true">{face.face}</span>
              <small>{face.label}</small>
            </button>
          ))}
        </div>
      )}

      {(stage === "comment" || stage === "sending") && rating !== null && (
        <form
          className="como-foi-comment"
          onSubmit={(event) => {
            event.preventDefault();
            void send(true);
          }}
        >
          <label className="field">
            <span>{followUp(rating)}</span>
            <textarea
              rows={2}
              maxLength={MAX_COMMENT}
              value={comment}
              placeholder="Ex.: a voz está robótica"
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {problem && <p className="msg-error">{problem}</p>}
          <div className="como-foi-actions">
            {canListen() && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => void dictate()}>
                {listening ? "Ouvindo… toque para parar" : "Falar"}
              </button>
            )}
            <button type="button" className="btn btn-quiet btn-sm" disabled={stage === "sending"} onClick={() => void send(false)}>
              Pular
            </button>
            <button type="submit" className="btn btn-outline btn-sm" disabled={stage === "sending" || !comment.trim()}>
              {stage === "sending" ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
