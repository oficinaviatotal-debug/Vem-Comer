import type { RefObject } from "react";
import { DESK_SCAN_CANCEL, DESK_SCAN_HINT } from "./copy";

type Props = {
  /** O elemento de vídeo onde a câmera aparece. Quem monta a tela abre a câmera e lê o QR; aqui só se desenha. */
  videoRef: RefObject<HTMLVideoElement | null>;
  onCancel?: () => void;
};

/** A câmera aberta com uma moldura, para o garçom saber onde apontar. */
export default function QrScan({ videoRef, onCancel }: Props) {
  return (
    <div className="nv-scan">
      <div className="nv-scan-frame">
        <video ref={videoRef} className="nv-scan-video" playsInline muted aria-label="Câmera lendo o QR da mesa" />
        <span className="nv-scan-guide" aria-hidden="true" />
      </div>
      <p className="nv-scan-hint" role="status">
        {DESK_SCAN_HINT}
      </p>
      <button type="button" className="nv-btn is-ghost is-block" onClick={onCancel}>
        {DESK_SCAN_CANCEL}
      </button>
    </div>
  );
}
