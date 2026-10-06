import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import "../ui.css";
import "./photos.css";
import { deleteProductPhoto, mediaUrl, uploadProductPhoto, type PhotoResult } from "../service/api";
import { toSendablePhoto } from "./photoFiles";
import { photoErrorText } from "./photoLogic";

type Props = {
  productId: string;
  productName: string;
  /** Path of the photo the dish already has ("/media/..."). */
  currentPhoto?: string | null;
  /** Called after a photo was saved on the server. */
  onSaved?: (result: PhotoResult) => void;
  /** Called after the photo was removed. */
  onRemoved?: () => void;
};

type Phase = "idle" | "working" | "done" | "error";

/** The three ways to get a photo: camera, gallery, or a short video (the best frame is used). */
export default function PhotoPicker({ productId, productName, currentPhoto, onSaved, onRemoved }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [before, setBefore] = useState("");
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [removed, setRemoved] = useState(false);
  const ids = useId();
  const latest = useRef(0);

  // Photo and video chosen for the previous dish must not leak into this one.
  useEffect(() => {
    latest.current += 1;
    setPhase("idle");
    setMessage("");
    setResult(null);
    setRemoved(false);
    setBefore((url) => {
      if (url) URL.revokeObjectURL(url);
      return "";
    });
  }, [productId]);

  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  useEffect(() => () => {
    if (before) URL.revokeObjectURL(before);
  }, [before]);

  async function choose(file: File | undefined) {
    if (!file) return;
    const mine = ++latest.current;
    setPhase("working");
    setMessage("Preparando a foto…");
    try {
      const photo = await toSendablePhoto(file);
      if (mine !== latest.current) return;
      setBefore(URL.createObjectURL(photo));
      setMessage("Melhorando a foto…");
      const saved = await uploadProductPhoto(productId, photo);
      if (mine !== latest.current) return;
      setResult(saved);
      setRemoved(false);
      setPhase("done");
      onSaved?.(saved);
    } catch (reason) {
      if (mine !== latest.current) return;
      setMessage(photoErrorText(reason));
      setPhase("error");
    }
  }

  async function remove() {
    const mine = ++latest.current;
    setPhase("working");
    setMessage("Removendo a foto…");
    try {
      await deleteProductPhoto(productId);
      if (mine !== latest.current) return;
      setResult(null);
      setRemoved(true);
      setPhase("idle");
      onRemoved?.();
    } catch (reason) {
      if (mine !== latest.current) return;
      setMessage(photoErrorText(reason));
      setPhase("error");
    }
  }

  const shown = result ? mediaUrl(result.image_url) : removed ? "" : mediaUrl(currentPhoto);
  const hasPhoto = Boolean(shown);
  const working = phase === "working";
  const inputProps = (name: string, accept: string, capture?: "environment") => ({
    id: `${ids}-${name}`,
    className: "photo-input",
    type: "file" as const,
    accept,
    capture,
    disabled: working,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = ""; // choosing the same file again must still work
      void choose(file);
    },
  });

  return (
    <div className="photo" aria-label={`Foto de ${productName}`}>
      {phase === "done" && result && before ? (
        <div className="photo-compare">
          <figure>
            <img src={before} alt={`Sua foto de ${productName}`} />
            <figcaption>Sua foto</figcaption>
          </figure>
          <figure>
            <img src={shown} alt={`Foto melhorada de ${productName}`} />
            <figcaption>Melhorada</figcaption>
          </figure>
        </div>
      ) : hasPhoto ? (
        <img className="photo-current" src={shown} alt={`Foto de ${productName}`} />
      ) : (
        <div className="photo-empty" aria-hidden="true">
          <span>📷</span>
        </div>
      )}

      {working && (
        <p className="photo-working" role="status">
          <span className="photo-spinner" aria-hidden="true" />
          {message}
        </p>
      )}

      {phase === "error" && (
        <p className="msg-error" role="alert">
          {message}
        </p>
      )}

      {phase === "done" && result && (
        <div className="photo-result" role="status">
          <p className="photo-saved">Foto salva no cardápio.</p>
          {result.improvements.length > 0 && (
            <ul className="photo-chips" aria-label="O que melhorou">
              {result.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {result.tips.map((tip) => (
            <p key={tip} className="photo-tip">
              {tip}
            </p>
          ))}
        </div>
      )}

      <div className="photo-buttons">
        <label
          htmlFor={`${ids}-camera`}
          className={working ? "btn btn-primary photo-btn is-disabled" : "btn btn-primary photo-btn"}
        >
          <span aria-hidden="true">📷</span> {hasPhoto ? "Tirar outra foto" : "Tirar foto"}
        </label>
        <input {...inputProps("camera", "image/*", "environment")} />

        <label
          htmlFor={`${ids}-gallery`}
          className={working ? "btn btn-outline photo-btn is-disabled" : "btn btn-outline photo-btn"}
        >
          <span aria-hidden="true">🖼️</span> Escolher da galeria
        </label>
        <input {...inputProps("gallery", "image/*,video/*")} />

        <label
          htmlFor={`${ids}-video`}
          className={working ? "btn btn-outline photo-btn is-disabled" : "btn btn-outline photo-btn"}
        >
          <span aria-hidden="true">🎬</span> Gravar vídeo do prato
        </label>
        <input {...inputProps("video", "video/*", "environment")} />
      </div>
      <p className="asst-help photo-help">
        No vídeo, eu escolho sozinho o melhor momento. Chegue perto do prato e use a luz da janela.
      </p>

      {hasPhoto && !working && (
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => void remove()}>
          Remover a foto
        </button>
      )}
    </div>
  );
}
