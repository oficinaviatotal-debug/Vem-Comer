import type { CSSProperties, ReactNode, RefObject } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { money } from "./format";
import { OFFLINE_NOTE, PIX_AFTER_TEXT, PIX_ERROR_TEXT, PIX_MISSING_TEXT, PIX_STEPS, RATING_THANKS, copiedText } from "./copy";
import { onRadioKeys, radioTab } from "./keys";
import type { Option, Pix, Rating, Track } from "./types";

/** A página do acompanhamento: o topo com "voltar" e, embaixo dele, um comprovante por pedido. */
export function TrackingPage({
  title = "Acompanhe o seu pedido",
  sub,
  backLabel = "Voltar ao cardápio",
  onBack,
  children,
}: {
  title?: string;
  sub?: string;
  backLabel?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-track">
        <header className="nv-top">
          <button type="button" className="nv-icon-btn" aria-label={backLabel} onClick={onBack}>
            <NvIcon name="back" />
          </button>
          <div className="nv-top-text">
            <h1 className="nv-name">{title}</h1>
            {sub ? <p className="nv-sub">{sub}</p> : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

/** Enquanto o primeiro andamento não chegou: uma frase que diz o que está acontecendo. */
export function TrackWaiting({ text }: { text: string }) {
  return (
    <p className="nv-empty" role="status">
      {text}
    </p>
  );
}

function PickRow({ label, options, onPick }: { label: string; options: Option[]; onPick?: (id: string) => void }) {
  const anyOn = options.some((option) => option.on);
  return (
    <fieldset className="nv-rate-group">
      <legend>{label}</legend>
      <div className="nv-picks is-4" role="radiogroup" aria-label={label}>
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.on}
            tabIndex={radioTab(index, option.on, anyOn)}
            onKeyDown={onRadioKeys}
            className={`nv-pick${option.on ? " is-on" : ""}`}
            onClick={() => onPick?.(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** "Como foi?": comida e atendimento em teclas, um comentário e o botão de enviar. Depois de enviar, só o agradecimento. */
function RatingBox({
  rating,
  maxComment,
  onFood,
  onService,
  onComment,
  onSend,
}: {
  rating: Rating;
  maxComment: number;
  onFood?: (id: string) => void;
  onService?: (id: string) => void;
  onComment?: (text: string) => void;
  onSend?: () => void;
}) {
  if (rating.sent) {
    return (
      <p className="nv-thanks" role="status">
        <NvIcon name="check" />
        {RATING_THANKS}
      </p>
    );
  }
  return (
    <section className="nv-rate" aria-label="Avaliação">
      <h2 className="nv-h2">Como foi?</h2>
      <PickRow label="A comida" options={rating.food} onPick={onFood} />
      <PickRow label="O atendimento" options={rating.service} onPick={onService} />
      <label className="nv-text">
        <span>Quer contar mais? (opcional)</span>
        <textarea rows={3} maxLength={maxComment} value={rating.comment} onChange={(event) => onComment?.(event.target.value)} />
      </label>
      {rating.error ? (
        <p className="nv-error" role="alert">
          {rating.error}
        </p>
      ) : null}
      <button type="button" className="nv-btn is-green is-block" disabled={!rating.canSend} onClick={onSend}>
        {rating.busy ? "Enviando…" : "Enviar avaliação"}
      </button>
    </section>
  );
}

/** O Pix a pagar: valor, botão grande de copiar, o código e o QR. O código vem de outra busca e pode falhar sozinho. */
function PixBox({
  pix,
  fieldRef,
  onCopy,
  onRetry,
}: {
  pix: Pix;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
  onCopy?: () => void;
  onRetry?: () => void;
}) {
  if (pix.state === "missing") return <p className="nv-hint">{PIX_MISSING_TEXT}</p>;
  return (
    <section className="nv-pix" aria-label="Pagamento com Pix">
      <h2 className="nv-h2">Pague com Pix</h2>
      {pix.state === "error" ? (
        <>
          <p className="nv-error" role="alert">
            {PIX_ERROR_TEXT}
          </p>
          <button type="button" className="nv-btn is-ghost is-small" onClick={onRetry}>
            Tentar de novo
          </button>
        </>
      ) : (
        <>
          <p className="nv-leader">
            <span>Valor</span>
            <i aria-hidden="true" />
            <b>{pix.amount !== undefined ? money(pix.amount) : "…"}</b>
          </p>
          {pix.receiver ? <p className="nv-hint">Recebedor: {pix.receiver}</p> : null}
          <button type="button" className="nv-btn is-green is-block" disabled={!pix.payload} onClick={onCopy}>
            {pix.payload ? "Copiar código Pix" : "Gerando o código…"}
          </button>
          <p className="nv-hint" role="status">
            {copiedText(pix.copied)}
          </p>
          <ol className="nv-pix-steps">
            {PIX_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {pix.payload ? (
            <>
              <label className="nv-text">
                <span>Código Pix Copia e Cola</span>
                <textarea
                  ref={fieldRef}
                  readOnly
                  rows={4}
                  value={pix.payload}
                  onFocus={(event) => event.currentTarget.select()}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>
              {pix.qr ? (
                <figure className="nv-qr">
                  <img src={pix.qr} alt="QR code Pix deste pedido" width={200} height={200} />
                  <figcaption className="nv-hint">Ou leia este QR code com o app do banco em outro celular.</figcaption>
                </figure>
              ) : null}
            </>
          ) : null}
          <p className="nv-hint">{PIX_AFTER_TEXT}</p>
        </>
      )}
    </section>
  );
}

type SlipProps = {
  track: Track;
  /** O Pix: só entra quando o pedido é Pix e ainda não foi pago (`track.payment.kind === "pix"`). */
  pix?: Pix | null;
  pixFieldRef?: RefObject<HTMLTextAreaElement | null>;
  onCopy?: () => void;
  onPixRetry?: () => void;
  /** A avaliação: só entra no pedido pronto que ainda não foi avaliado (ou acabou de ser). */
  rating?: Rating | null;
  maxComment?: number;
  onFood?: (id: string) => void;
  onService?: (id: string) => void;
  onComment?: (text: string) => void;
  onSendRating?: () => void;
  /** "Fechar este pedido": só aparece quando o pedido está pronto. */
  onDismiss?: () => void;
};

/**
 * O comprovante de um pedido: onde e para quem, o andamento, o código de entrega, a comanda, o pagamento e a avaliação.
 * O andamento, o valor e o código vêm do servidor e se atualizam sozinhos; aqui só se mostram.
 */
export function TrackSlip({
  track,
  pix = null,
  pixFieldRef,
  onCopy,
  onPixRetry,
  rating = null,
  maxComment = 500,
  onFood,
  onService,
  onComment,
  onSendRating,
  onDismiss,
}: SlipProps) {
  const { status } = track;
  return (
    <article className="nv-track" aria-label={`Pedido ${track.code}`}>
      <header className="nv-track-head">
        <h2 className="nv-where">{track.where}</h2>
        <p className="nv-chips">
          {track.code ? <span className="nv-fact">{track.code}</span> : null}
          {track.customerName ? <span className="nv-fact">{track.customerName}</span> : null}
        </p>
      </header>

      {track.handling ? (
        <p className="nv-handling">
          <b>{track.handling.title}</b> {track.handling.text}
          {track.handling.phone ? (
            <>
              {" "}
              · Telefone <span className="nv-nowrap">{track.handling.phone}</span>
            </>
          ) : null}
        </p>
      ) : null}

      <section className={`nv-status${status.done ? " is-done" : ""}`}>
        <h2 aria-live="polite">{status.headline}</h2>
        {status.hint ? <p>{status.hint}</p> : null}
        <ol className="nv-steps" aria-label="Andamento do pedido" style={{ "--nv-steps": status.steps.length } as CSSProperties}>
          {status.steps.map((step) => (
            <li key={step.label} className={`is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
              {step.label}
            </li>
          ))}
        </ol>
        {track.offline ? <p className="nv-hint">{OFFLINE_NOTE}</p> : null}
      </section>

      {track.deliveryCode ? (
        <section className="nv-dcode" role="group" aria-label={track.deliveryCode.title}>
          <h2>{track.deliveryCode.title}</h2>
          <p className="nv-dcode-digits" aria-label={track.deliveryCode.spoken}>
            {track.deliveryCode.digits.map((digit, index) => (
              <span key={index} className="nv-dcode-digit" aria-hidden="true">
                {digit}
              </span>
            ))}
          </p>
          <p className="nv-dcode-hint">{track.deliveryCode.hint}</p>
        </section>
      ) : null}

      {/* Pix a pagar é a próxima coisa a fazer: vem antes da comanda. Pago e "acerta na hora" ficam embaixo dela. */}
      {track.payment.kind === "pix" && pix ? <PixBox pix={pix} fieldRef={pixFieldRef} onCopy={onCopy} onRetry={onPixRetry} /> : null}

      <section className="nv-slip" aria-label="Seus pratos">
        <ul className="nv-slip-lines">
          {track.lines.map((line) => (
            <li key={line.key}>
              <p className="nv-slip-top">
                <span>
                  {line.quantity}× {line.name}
                </span>
                <span>{money(line.total)}</span>
              </p>
              {line.detail ? <p className="nv-slip-detail">{line.detail}</p> : null}
              {line.note ? (
                <p className="nv-slip-note">
                  <b>Obs.:</b> {line.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="nv-slip-sum">
          {track.fee !== null ? (
            <p className="nv-leader">
              <span>Taxa de entrega</span>
              <i aria-hidden="true" />
              <b>{track.fee > 0 ? money(track.fee) : "Grátis"}</b>
            </p>
          ) : null}
          <p className="nv-leader is-total">
            <span>Total</span>
            <i aria-hidden="true" />
            <b>{money(track.total)}</b>
          </p>
        </div>
      </section>

      {track.payment.kind === "paid" ? (
        <p className="nv-paid" role="status">
          <NvIcon name="check" />
          <span>
            <b>{track.payment.title}</b>
            {track.payment.text}
          </span>
        </p>
      ) : null}
      {track.payment.kind === "later" ? <p className="nv-hint">{track.payment.text}</p> : null}

      {rating ? (
        <RatingBox rating={rating} maxComment={maxComment} onFood={onFood} onService={onService} onComment={onComment} onSend={onSendRating} />
      ) : null}

      {status.done && onDismiss ? (
        <button type="button" className="nv-btn is-ghost is-block" onClick={onDismiss}>
          Fechar este pedido
        </button>
      ) : null}
    </article>
  );
}
