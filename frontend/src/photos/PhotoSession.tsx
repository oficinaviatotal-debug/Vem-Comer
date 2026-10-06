import { useEffect, useRef, useState } from "react";
import "../ui.css";
import "./photos.css";
import { fetchProducts } from "../service/api";
import { canSpeak, speakAsync, stopSpeaking } from "../assistant/voiceIO";
import PhotoPicker from "./PhotoPicker";
import { dishesNeedingPhoto, photoPrompt, photoSummary, type SessionDish } from "./photoLogic";

type Props = {
  companyId: string;
  /** Read the prompts aloud (follows the assistant's "Voz ligada"). */
  voice: boolean;
  /** Opens the screen that lists the dishes. */
  onSeeMenu?: () => void;
  /** Leaves the photo step without finishing. */
  onBack?: () => void;
  /** Called whenever the saved photos change, so the lists behind can refresh. */
  onChanged?: () => void;
};

/** Goes through the dishes that have no photo, one at a time. */
export default function PhotoSession({ companyId, voice, onSeeMenu, onBack, onChanged }: Props) {
  const [dishes, setDishes] = useState<SessionDish[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [index, setIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const spoken = useRef(-1);

  function load() {
    setLoadError("");
    setDishes(null);
    fetchProducts(companyId)
      .then((products) => setDishes(dishesNeedingPhoto(products)))
      .catch((reason: unknown) =>
        setLoadError(reason instanceof Error ? reason.message : "Não consegui buscar os pratos.")
      );
  }

  useEffect(() => {
    load();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const dish = dishes && !finished ? dishes[index] : undefined;

  // Says the dish when the screen moves to it (once per dish).
  useEffect(() => {
    if (!dishes || !dish || spoken.current === index) return;
    spoken.current = index;
    if (voice && canSpeak()) void speakAsync(photoPrompt(dish.name, index, dishes.length));
  }, [dishes, dish, index, voice]);

  useEffect(() => {
    if (finished && voice && canSpeak()) void speakAsync(photoSummary(savedIds.length));
    // only when the step closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function next() {
    stopSpeaking();
    if (!dishes || index >= dishes.length - 1) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
  }

  function finishNow() {
    stopSpeaking();
    setFinished(true);
  }

  if (loadError) {
    return (
      <div className="sheet asst-done">
        <p className="msg-error">{loadError}</p>
        <button type="button" className="btn btn-outline btn-block" onClick={load}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!dishes) {
    return (
      <div className="sheet asst-done">
        <p role="status">Buscando os pratos…</p>
      </div>
    );
  }

  if (dishes.length === 0 || finished) {
    const message = dishes.length === 0 ? "Todos os pratos já têm foto." : photoSummary(savedIds.length);
    return (
      <div className="sheet asst-done">
        <h3>{dishes.length === 0 ? "Fotos em dia" : "Fotos dos pratos"}</h3>
        <p>{message}</p>
        <div className="asst-actions">
          {onBack && (
            <button type="button" className="btn btn-outline" onClick={onBack}>
              Voltar
            </button>
          )}
          {onSeeMenu && (
            <button type="button" className="btn btn-primary" onClick={onSeeMenu}>
              Ver o cardápio
            </button>
          )}
        </div>
      </div>
    );
  }

  const current = dishes[index];
  const hasPhoto = savedIds.includes(current.id);
  const last = index >= dishes.length - 1;

  return (
    <div className="sheet photo-session">
      <p className="photo-session-progress">
        Prato {index + 1} de {dishes.length}
      </p>
      <h3 className="photo-session-name">{current.name}</h3>

      <PhotoPicker
        key={current.id}
        productId={current.id}
        productName={current.name}
        onSaved={() => {
          setSavedIds((ids) => (ids.includes(current.id) ? ids : [...ids, current.id]));
          onChanged?.();
        }}
        onRemoved={() => {
          setSavedIds((ids) => ids.filter((id) => id !== current.id));
          onChanged?.();
        }}
      />

      <div className="asst-actions">
        <button type="button" className="btn btn-quiet" onClick={finishNow}>
          Terminar por aqui
        </button>
        {hasPhoto ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            {last ? "Terminei" : "Próximo prato"}
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={next}>
            {last ? "Pular e terminar" : "Pular este prato"}
          </button>
        )}
      </div>
    </div>
  );
}
