import type { FormEvent, ReactNode } from "react";
import NvIcon, { type NvIconName } from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import {
  DESK_ALL_HEADING,
  DESK_ANSWER,
  DESK_AGAIN_FLAG,
  DESK_CALLS_HEADING,
  DESK_OPEN,
  DESK_RETRY,
  DESK_SCAN,
  DESK_SENDING,
  DESK_TITLE,
  DESK_TYPE_HINT,
  DESK_TYPE_LABEL,
} from "./copy";
import type { CallKind, DeskCall, DeskView } from "./types";

const ICONS: Record<CallKind, NvIconName> = { garcom: "bell", conta: "receipt", agua: "drop", limpeza: "sparkle" };

type CardProps = {
  call: DeskCall;
  /** O chamado que está sendo marcado agora: o botão espera para não mandar duas vezes. */
  busyId?: string | null;
  /** Toque na mesa (a parte de cima do cartão): abre a mesa. Sem isto, ou com a mesa fora do cadastro, só informa. */
  onOpen?: (tableId: string) => void;
  onAnswer?: (callId: string) => void;
};

/**
 * Um chamado: a mesa, o que ela quer, há quanto tempo espera e o botão grande "Já atendi". A fita de cima muda de cor
 * pelo que o servidor diz da espera (verde, amarela, vermelha) e a palavra ("Está demorando", "Urgente") repete a cor
 * para quem não a vê. Só o botão de baixo marca como atendido: o resto do cartão abre a mesa ou informa.
 */
export function CallCard({ call, busyId = null, onOpen, onAnswer }: CardProps) {
  const head = (
    <>
      <span className="nv-deskcall-icon" aria-hidden="true">
        <NvIcon name={ICONS[call.kind]} />
      </span>
      <span className="nv-deskcall-text">
        <b className="nv-deskcall-where">{call.where}</b>
        <span className="nv-deskcall-what">{call.what}</span>
      </span>
      <span className="nv-wait">
        <NvIcon name="clock" /> {call.wait}
      </span>
    </>
  );
  const busy = busyId === call.id;
  const tableId = call.tableId;
  return (
    <li className={`nv-deskcall is-${call.tone}`}>
      {onOpen && tableId ? (
        <button type="button" className="nv-deskcall-head is-open" aria-label={`Abrir a ${call.where.toLowerCase()}`} onClick={() => onOpen(tableId)}>
          {head}
          <span className="nv-deskcall-go" aria-hidden="true">
            <NvIcon name="chevron" />
          </span>
        </button>
      ) : (
        <div className="nv-deskcall-head">{head}</div>
      )}
      {call.word || call.again ? (
        <p className="nv-deskcall-flags">
          {call.word ? <span className="nv-deskcall-flag is-word">{call.word}</span> : null}
          {call.again ? <span className="nv-deskcall-flag">{DESK_AGAIN_FLAG}</span> : null}
        </p>
      ) : null}
      <button
        type="button"
        className="nv-btn is-green is-block"
        aria-label={call.spoken}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => onAnswer?.(call.id)}
      >
        <NvIcon name="check" />
        {busy ? DESK_SENDING : DESK_ANSWER}
      </button>
    </li>
  );
}

type Props = {
  view: DeskView;
  busyId?: string | null;
  /** O número que a pessoa está digitando para abrir uma mesa. */
  typed?: string;
  onType?: (value: string) => void;
  onSubmitTyped?: () => void;
  onOpen?: (tableId: string) => void;
  onAnswer?: (callId: string) => void;
  /** Tentar abrir a lista de mesas de novo (só aparece quando ela falhou). */
  onRetry?: () => void;
  /** Ler o QR da mesa com a câmera. Sem isto (o aparelho não lê QR aqui dentro), o botão não aparece. */
  onScan?: () => void;
  /** A câmera aberta: no lugar do botão do QR e da caixa do número, enquanto lê. */
  scanner?: ReactNode;
  /** Quando o aparelho não lê QR aqui dentro: a frase que diz o que fazer no lugar do botão. */
  scanNote?: string;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Mesas: quem está chamando vem primeiro, com o botão de atender; embaixo, o jeito de abrir uma mesa (ler o QR do
 * cartaz ou digitar o número) e todas as mesas da casa, cada uma com o que existe agora. De uma mão só, sem escrever
 * quase nada: o garçom toca na mesa e vê o que ela pediu.
 */
export default function Desk({
  view,
  busyId = null,
  typed = "",
  onType,
  onSubmitTyped,
  onOpen,
  onAnswer,
  onRetry,
  onScan,
  scanner,
  scanNote,
  onMenu,
  showMenu = false,
}: Props) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmitTyped?.();
  };
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-desk">
        <TopBar title={DESK_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-desk-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.sub}
        </p>

        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        {view.calls.length > 0 ? (
          <section aria-labelledby="nv-desk-calls-h">
            <h2 className="nv-h2" id="nv-desk-calls-h" style={{ marginBottom: 14 }}>
              {DESK_CALLS_HEADING}
            </h2>
            <ul className="nv-deskcalls">
              {view.calls.map((call) => (
                <CallCard key={call.id} call={call} busyId={busyId} onOpen={onOpen} onAnswer={onAnswer} />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="nv-find" aria-label="Abrir uma mesa">
          {scanner ?? (
            <>
              {onScan ? (
                <button type="button" className="nv-btn is-fire is-block is-tall" onClick={onScan}>
                  <NvIcon name="qr" />
                  {DESK_SCAN}
                </button>
              ) : scanNote ? (
                <p className="nv-desk-fine">{scanNote}</p>
              ) : null}
              <form className="nv-desk-type" onSubmit={submit}>
                <label className="nv-desk-label" htmlFor="nv-desk-number">
                  {DESK_TYPE_LABEL}
                </label>
                <div className="nv-desk-row">
                  <span className="nv-field">
                    <NvIcon name="table" />
                    <input
                      id="nv-desk-number"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      enterKeyHint="go"
                      maxLength={8}
                      placeholder={DESK_TYPE_HINT}
                      value={typed}
                      onChange={(event) => onType?.(event.target.value)}
                    />
                  </span>
                  <button type="submit" className="nv-btn is-ghost">
                    {DESK_OPEN}
                  </button>
                </div>
              </form>
              <p className="nv-desk-msg" role="status" aria-live="polite">
                {view.message}
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="nv-desk-all-h">
          <h2 className="nv-h2" id="nv-desk-all-h" style={{ marginBottom: 14 }}>
            {DESK_ALL_HEADING}
          </h2>
          {view.tilesMessage ? (
            <p className="nv-empty" role={view.tilesFailed ? "alert" : "status"}>
              {view.tilesMessage}
            </p>
          ) : null}
          {view.tilesFailed && onRetry ? (
            <button type="button" className="nv-btn is-ghost is-block" onClick={onRetry}>
              {DESK_RETRY}
            </button>
          ) : null}
          {view.tiles && view.tiles.length > 0 ? (
            <ul className="nv-desk-grid">
              {view.tiles.map((tile) => (
                <li key={tile.id}>
                  <button type="button" className={`nv-desktile is-${tile.tone}`} aria-label={tile.spoken} onClick={() => onOpen?.(tile.id)}>
                    <span className="nv-desktile-num">{tile.number}</span>
                    <span className="nv-desktile-note">{tile.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
