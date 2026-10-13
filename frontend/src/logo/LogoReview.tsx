import { useEffect, useState } from "react";
import "../ui.css";
import "./logo.css";
import type { LogoReviewResult } from "./logoFiles";

type Props = {
  review: LogoReviewResult;
  restaurantName: string;
  /** Abrindo outra imagem ou salvando: os botões esperam. */
  busy: boolean;
  /** Salvando a escolhida (e não só abrindo outra imagem). */
  saving: boolean;
  error: string;
  /** O dono disse "ficou bom": `blob` é a imagem que vai ser salva. */
  onUse: (blob: Blob) => void;
  /** O dono escolheu outra imagem no lugar desta. */
  onPick: (file: File | undefined) => void;
  onCancel: () => void;
};

/** Faz uma URL para mostrar o arquivo e a solta quando a tela fecha. */
function useObjectUrl(blob: Blob | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [blob]);
  return url;
}

/**
 * "Ficou bom?": a logomarca que o dono mandou ao lado de como o cliente vai ver no cardápio (selo redondo e branco
 * ao lado do nome). Se havia margem vazia em volta, a versão refinada vem escolhida e a original continua à mão.
 * Nada é salvo antes de o dono tocar em "Sim, usar".
 */
export default function LogoReview({ review, restaurantName, busy, saving, error, onUse, onPick, onCancel }: Props) {
  const [useRefined, setUseRefined] = useState(Boolean(review.refined));
  const chosen = useRefined && review.refined ? review.refined : review.original;
  const originalUrl = useObjectUrl(review.original);
  const refinedUrl = useObjectUrl(review.refined);
  const shownUrl = useRefined && review.refined ? refinedUrl : originalUrl;
  const name = restaurantName.trim() || "Seu restaurante";

  return (
    <section className="adm-stack" aria-label="Ficou bom?">
      <div className="sheet logo-review">
        <h2>Ficou bom?</h2>
        <p className="adm-lead">
          {review.refined
            ? "Tirei a margem vazia em volta e centralizei, para a logomarca aparecer maior no cardápio."
            : "Veja como o cliente vai ver a sua logomarca no cardápio."}
        </p>

        <div className="logo-compare">
          <figure>
            <div className="logo-frame">{originalUrl && <img src={originalUrl} alt="Logomarca que você enviou" />}</div>
            <figcaption>A que você enviou</figcaption>
          </figure>
          {review.refined && (
            <figure>
              <div className="logo-frame">{refinedUrl && <img src={refinedUrl} alt="Logomarca refinada" />}</div>
              <figcaption>Depois do ajuste</figcaption>
            </figure>
          )}
        </div>

        <div className="logo-as-seen" aria-label="Como o cliente vai ver">
          <span className="logo-badge">{shownUrl && <img src={shownUrl} alt="" />}</span>
          <strong>{name}</strong>
        </div>
        <p className="adm-muted">Assim o cliente vê, no alto do cardápio.</p>

        {review.tooLight && (
          <p className="msg-error" role="alert">
            Essa logomarca é muito clara e pode sumir no fundo branco do cardápio. Se não aparecer bem acima, escolha uma
            versão mais escura.
          </p>
        )}
        {review.small && (
          <p className="msg-error" role="alert">
            Essa imagem é pequena e pode ficar borrada. Se tiver uma maior, escolha ela.
          </p>
        )}
        {error && (
          <p className="msg-error" role="alert">
            {error}
          </p>
        )}

        <div className="logo-actions">
          <button type="button" id="logo-use" className="btn btn-primary btn-block" disabled={busy} onClick={() => onUse(chosen)}>
            {saving ? "Salvando…" : "Sim, usar esta"}
          </button>
          {review.refined && (
            <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => setUseRefined(!useRefined)}>
              {useRefined ? "Usar a original, sem ajuste" : "Usar a versão ajustada"}
            </button>
          )}
          <label htmlFor="logo-other" className={busy ? "btn btn-outline btn-block is-disabled" : "btn btn-outline btn-block"}>
            Não, escolher outra
          </label>
          <input
            id="logo-other"
            className="logo-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // permite escolher o mesmo arquivo de novo
              onPick(file);
            }}
          />
          <button type="button" className="btn btn-quiet btn-block" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
