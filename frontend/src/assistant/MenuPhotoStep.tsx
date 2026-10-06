import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import "../ui.css";
import "../photos/photos.css";
import "./assistant.css";
import { readMenuPhotos } from "../service/api";
import { prepareMenuPage } from "../photos/photoFiles";
import { MENU_MAX_PHOTOS, photoErrorText } from "../photos/photoLogic";
import type { ParsedMenu } from "./assistantFlow";
import {
  fitsTogether,
  normalizeReading,
  pagesLeft,
  readingErrorText,
  unreadableText,
} from "./menuPhotoLogic";

type Props = {
  /** Called with a menu the server could read. Return false when the assistant cannot use it. */
  onRead: (menu: ParsedMenu) => boolean | void;
  /** The owner prefers to pick the type of business instead. */
  onBack: () => void;
  /** The reading started: the assistant says it may take a while. */
  onReading?: () => void;
};

type Page = { id: number; blob: Blob; url: string };
type Phase = "choose" | "preparing" | "reading" | "unreadable" | "error";

/** The server waits up to 85 s for the AI; a little more than that here. */
const READ_TIMEOUT_MS = 100_000;

/** Photographing the pages of the owner's own menu, then sending them to be read. */
export default function MenuPhotoStep({ onRead, onBack, onReading }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [phase, setPhase] = useState<Phase>("choose");
  const [message, setMessage] = useState("");
  const ids = useId();
  const nextId = useRef(1);
  /** Every new action takes a number; an older action that finishes late sees it is stale and stops. */
  const run = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const pagesRef = useRef<Page[]>([]);
  pagesRef.current = pages;

  useEffect(
    () => () => {
      run.current += 1;
      controller.current?.abort();
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    },
    []
  );

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const room = pagesLeft(pagesRef.current.length);
    if (room === 0) {
      setMessage(`Já tem ${MENU_MAX_PHOTOS} páginas. Toque em Ler o cardápio.`);
      return;
    }

    const mine = ++run.current;
    setPhase("preparing");
    setMessage("");
    const blobs: Blob[] = [];
    let problem = "";
    for (const file of files.slice(0, room)) {
      try {
        blobs.push(await prepareMenuPage(file));
      } catch (reason) {
        problem = photoErrorText(reason);
      }
      if (mine !== run.current) return;
    }

    const fresh = blobs.map((blob) => ({ id: nextId.current++, blob, url: URL.createObjectURL(blob) }));
    setPages((current) => [...current, ...fresh]);
    const extra = files.length > room ? `Só cabem ${MENU_MAX_PHOTOS} páginas; as outras ficaram de fora.` : "";
    setMessage([problem, extra].filter(Boolean).join(" "));
    setPhase("choose");
  }

  function removePage(id: number) {
    const page = pagesRef.current.find((current) => current.id === id);
    if (page) URL.revokeObjectURL(page.url);
    setPages((current) => current.filter((candidate) => candidate.id !== id));
    setMessage("");
    if (phase === "error" || phase === "unreadable") setPhase("choose");
  }

  function startOver() {
    run.current += 1;
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
    setMessage("");
    setPhase("choose");
  }

  async function read() {
    const current = pagesRef.current;
    if (current.length === 0) return;
    if (!fitsTogether(current.map((page) => page.blob.size))) {
      setMessage("As fotos ficaram pesadas demais juntas. Tire uma página de cada vez, ou tire menos páginas.");
      setPhase("choose");
      return;
    }

    const mine = ++run.current;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), READ_TIMEOUT_MS);
    setPhase("reading");
    setMessage("");
    onReading?.();
    try {
      const answer = await readMenuPhotos(
        current.map((page) => page.blob),
        abort.signal
      );
      if (mine !== run.current) return;
      const parsed = normalizeReading(answer);
      if (!parsed) {
        setMessage("O servidor respondeu algo que não entendi. Tente de novo.");
        setPhase("error");
        return;
      }
      if (!parsed.readable) {
        setMessage(unreadableText(parsed));
        setPhase("unreadable");
        return;
      }
      if (onRead(parsed) === false) {
        setMessage(unreadableText({ ...parsed, notes: "" }));
        setPhase("unreadable");
      }
    } catch (reason) {
      if (mine !== run.current) return;
      setMessage(readingErrorText(reason));
      setPhase("error");
    } finally {
      clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
    }
  }

  function cancelReading() {
    run.current += 1;
    controller.current?.abort();
    setPhase("choose");
    setMessage("");
  }

  const busy = phase === "preparing" || phase === "reading";
  const full = pagesLeft(pages.length) === 0;
  const inputProps = (role: "camera" | "gallery") => ({
    id: `${ids}-${role}`,
    "data-role": role,
    className: "photo-input",
    type: "file" as const,
    accept: "image/*",
    capture: role === "camera" ? ("environment" as const) : undefined,
    multiple: role === "gallery",
    disabled: busy,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      // the list of files is emptied together with the input, so copy it first
      const chosen = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = ""; // choosing the same photo again must still work
      void addFiles(chosen);
    },
  });
  const labelClass = (primary: boolean) =>
    ["btn", primary ? "btn-primary" : "btn-outline", "photo-btn", busy ? "is-disabled" : ""].filter(Boolean).join(" ");

  return (
    <div className="sheet asst-photo" aria-label="Foto do cardápio">
      <h3>Foto do cardápio</h3>
      <p className="asst-help">
        Tire uma foto de cada página, de frente, com boa luz e sem reflexo. A foto é usada só para ler o cardápio e
        não fica guardada no Vem Comer.
      </p>

      {pages.length > 0 && (
        <ul className="asst-pages" aria-label="Páginas do cardápio">
          {pages.map((page, index) => (
            <li key={page.id}>
              <img src={page.url} alt={`Página ${index + 1} do cardápio`} />
              <button
                type="button"
                className="asst-page-remove"
                aria-label={`Tirar a página ${index + 1}`}
                disabled={busy}
                onClick={() => removePage(page.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {phase === "preparing" && (
        <p className="photo-working" role="status">
          <span className="photo-spinner" aria-hidden="true" />
          Preparando a foto…
        </p>
      )}

      {phase === "reading" && (
        <>
          <p className="photo-working" role="status">
            <span className="photo-spinner" aria-hidden="true" />
            Lendo o cardápio… pode levar até 1 minuto.
          </p>
          <button type="button" className="btn btn-quiet" onClick={cancelReading}>
            Cancelar
          </button>
        </>
      )}

      {message && phase !== "reading" && (
        <p className="msg-error" role="alert">
          {message}
        </p>
      )}

      {!busy && (
        <div className="photo-buttons">
          {pages.length > 0 && phase !== "unreadable" && (
            <button id="assistant-read-menu" type="button" className="btn btn-primary photo-btn" onClick={() => void read()}>
              {phase === "error" ? "Tentar de novo" : "Ler o cardápio"}
            </button>
          )}

          {phase === "unreadable" ? (
            <button type="button" className="btn btn-primary photo-btn" onClick={startOver}>
              Tirar outra foto
            </button>
          ) : (
            !full && (
              <>
                <label htmlFor={`${ids}-camera`} className={labelClass(pages.length === 0)}>
                  <span aria-hidden="true">📷</span> {pages.length === 0 ? "Tirar foto do cardápio" : "Tirar outra página"}
                </label>
                <input {...inputProps("camera")} />
                <label htmlFor={`${ids}-gallery`} className={labelClass(false)}>
                  <span aria-hidden="true">🖼️</span> Escolher da galeria
                </label>
                <input {...inputProps("gallery")} />
              </>
            )
          )}
        </div>
      )}

      <button type="button" className="btn btn-quiet" disabled={busy} onClick={onBack}>
        Prefiro escolher o tipo do meu negócio
      </button>
    </div>
  );
}
