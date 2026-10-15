import { useEffect, useRef } from "react";
import { SCAN_EVERY_MS, cameraErrorMessage } from "./tableDeskLogic";

/** O leitor de QR do próprio navegador (Chrome no Android). Não vem nos tipos do TypeScript. */
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options?: { formats?: string[] }) => Detector;

type Props = {
  /** Um QR foi lido: o texto dele. O leitor já parou e a câmera já fechou. */
  onCode: (text: string) => void;
  /** A câmera não abriu ou parou: o que dizer ao garçom. */
  onFail: (message: string) => void;
  onCancel: () => void;
};

/**
 * A câmera aberta com uma moldura. Lê o QR dentro do aplicativo, sem baixar biblioteca nenhuma: usa o leitor que o
 * navegador já tem. Nada é gravado nem enviado: o quadro é lido na hora e descartado. A câmera fecha ao ler, ao
 * cancelar e ao sair da tela.
 */
export default function QrScanner({ onCode, onFail, onCancel }: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  // Os avisos mudam a cada desenho da tela; o leitor guarda o mais novo sem reabrir a câmera.
  const latest = useRef({ onCode, onFail });
  latest.current = { onCode, onFail };

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    let timer = 0;

    const stop = () => {
      alive = false;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    async function start() {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
        if (!Detector) throw new DOMException("sem leitor", "NotFoundError");
        const detector = new Detector({ formats: ["qr_code"] });
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!alive) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const element = video.current;
        if (!element) return;
        element.srcObject = media;
        await element.play().catch(() => undefined);

        let reading = false;
        timer = window.setInterval(() => {
          if (reading || !alive || element.readyState < 2) return;
          reading = true;
          detector
            .detect(element)
            .then((found) => {
              const text = found.find((item) => item.rawValue)?.rawValue;
              if (text && alive) {
                stop();
                latest.current.onCode(text);
              }
            })
            .catch(() => undefined) // um quadro ruim não é erro: tenta no próximo
            .finally(() => {
              reading = false;
            });
        }, SCAN_EVERY_MS);
      } catch (error) {
        if (!alive) return;
        stop();
        latest.current.onFail(cameraErrorMessage(error instanceof DOMException ? error.name : ""));
      }
    }

    void start();
    return stop;
  }, []);

  return (
    <div className="td-scan">
      <div className="td-scan-frame">
        <video ref={video} className="td-scan-video" playsInline muted aria-label="Câmera lendo o QR da mesa" />
        <span className="td-scan-guide" aria-hidden="true" />
      </div>
      <p className="td-scan-hint" role="status">
        Aponte para o QR do cartaz da mesa. A leitura é sozinha.
      </p>
      <button type="button" className="btn btn-outline btn-block" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  );
}
