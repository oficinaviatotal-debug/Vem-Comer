import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import "../ui.css";
import "../photos/photos.css";
import "./assistant.css";
import { readMenuFile, readMenuPhotos } from "../service/api";
import { prepareMenuPage } from "../photos/photoFiles";
import { MENU_MAX_PHOTOS, photoErrorText } from "../photos/photoLogic";
import type { ParsedMenu } from "./assistantFlow";
import {
  fitsTogether,
  MENU_FILE_ACCEPT as FILE_ACCEPT,
  MENU_SHEET_ACCEPT as SHEET_ACCEPT,
  menuFileProblem,
  normalizeReading,
  pagesLeft,
  readingErrorText,
  unreadableFileText,
  unreadableText,
} from "./menuPhotoLogic";

type Props = {
  /** Called with a menu the server could read. Return false when the assistant cannot use it. */
  onRead: (menu: ParsedMenu) => boolean | void;
  /** The owner prefers to pick the type of business instead. */
  onBack: () => void;
  /** The reading started: the assistant says it may take a while. */
  onReading?: () => void;
  /** Photos can be read (needs the AI key on the server). On by default. */
  photoEnabled?: boolean;
  /** A spreadsheet (Excel, CSV) can be read. Off by default: an older server does not have the route. */
  fileEnabled?: boolean;
  /** A PDF can be read (needs the AI key on the server). */
  pdfEnabled?: boolean;
  /** What the owner already chose on the first screen: the photos taken, or the file picked. It goes on from there. */
  initial?: { photos?: File[]; file?: File } | null;
};

type Page = { id: number; blob: Blob; url: string };
type Phase = "choose" | "preparing" | "reading" | "unreadable" | "error";

/** The server waits up to 85 s for the AI; a little more than that here. */
const READ_TIMEOUT_MS = 100_000;

/** Photographing the pages of the owner's own menu (or choosing a spreadsheet or PDF), then sending it to be read. */
export default function MenuPhotoStep({
  onRead,
  onBack,
  onReading,
  photoEnabled = true,
  fileEnabled = false,
  pdfEnabled = false,
  initial = null,
}: Props) {
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

  useEffect(() => {
    // The first screen already opened the camera (or the file picker): go on with what came back.
    // It starts on the next tick: if React mounts, unmounts and mounts this again (development), the first
    // timer is cleared by the cleanup below and only one reading is sent to the server.
    const timer = setTimeout(() => {
      if (initial?.file) void readFile(initial.file);
      else if (initial?.photos && initial.photos.length > 0) void addFiles(initial.photos);
    }, 0);
    return () => {
      clearTimeout(timer);
      run.current += 1;
      controller.current?.abort();
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /**
   * Runs one reading: shows the waiting state, sends, and shows what came back.
   * `kind` decides the words used when the menu could not be read.
   */
  async function runReading(kind: "photo" | "file", send: (signal: AbortSignal) => Promise<unknown>) {
    const mine = ++run.current;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), READ_TIMEOUT_MS);
    setPhase("reading");
    setMessage("");
    onReading?.();
    try {
      const answer = await send(abort.signal);
      if (mine !== run.current) return;
      const parsed = normalizeReading(answer);
      if (!parsed) {
        setMessage("O servidor respondeu algo que não entendi. Tente de novo.");
        setPhase("error");
        return;
      }
      if (!parsed.readable) {
        showUnreadable(kind, parsed);
        return;
      }
      if (onRead(parsed) === false) showUnreadable(kind, { ...parsed, notes: "" });
    } catch (reason) {
      if (mine !== run.current) return;
      setMessage(readingErrorText(reason));
      setPhase("error");
    } finally {
      clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
    }
  }

  function showUnreadable(kind: "photo" | "file", parsed: ParsedMenu) {
    if (kind === "photo") {
      setMessage(unreadableText(parsed));
      setPhase("unreadable");
      return;
    }
    // A file has nothing to retake: the owner just picks another one, so the buttons come back.
    setMessage(unreadableFileText(parsed, photoEnabled));
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
    await runReading("photo", (signal) =>
      readMenuPhotos(
        current.map((page) => page.blob),
        signal
      )
    );
  }

  async function readFile(file: File) {
    const problem = menuFileProblem(file, pdfEnabled);
    if (problem) {
      setMessage(problem);
      setPhase("choose");
      return;
    }
    await runReading("file", (signal) => readMenuFile(file, signal));
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
  const fileInputProps = {
    id: `${ids}-file`,
    "data-role": "file",
    className: "photo-input",
    type: "file" as const,
    accept: pdfEnabled ? FILE_ACCEPT : SHEET_ACCEPT,
    disabled: busy,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const chosen = event.target.files?.[0];
      event.target.value = ""; // choosing the same file again must still work
      if (chosen) void readFile(chosen);
    },
  };
  const fileOnly = !photoEnabled && fileEnabled;
  const labelClass = (primary: boolean) =>
    ["btn", primary ? "btn-primary" : "btn-outline", "photo-btn", busy ? "is-disabled" : ""].filter(Boolean).join(" ");

  return (
    <div className="sheet asst-photo" aria-label={fileOnly ? "Arquivo do cardápio" : "Foto do cardápio"}>
      <h3>{fileOnly ? "Planilha do cardápio" : "Foto do cardápio"}</h3>
      {fileOnly ? (
        <p className="asst-help">
          Escolha o arquivo do cardápio (Excel ou CSV), com o nome do prato e o preço em cada linha. O arquivo é usado
          só para ler o cardápio e não fica guardado no Vem Comer.
        </p>
      ) : (
        <p className="asst-help">
          Tire uma foto de cada página, de frente, com boa luz e sem reflexo.
          {fileEnabled ? " Se o cardápio já está numa planilha ou PDF, escolha o arquivo." : ""} A foto é usada só para
          ler o cardápio e não fica guardada no Vem Comer.
        </p>
      )}

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
            <>
              {photoEnabled && !full && (
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
              )}
              {fileEnabled && pages.length === 0 && (
                <>
                  <label htmlFor={`${ids}-file`} className={labelClass(fileOnly)}>
                    <span aria-hidden="true">📄</span> {pdfEnabled ? "Planilha ou PDF" : "Escolher a planilha"}
                  </label>
                  <input {...fileInputProps} />
                </>
              )}
            </>
          )}
        </div>
      )}

      <button type="button" className="btn btn-quiet" disabled={busy} onClick={onBack}>
        Prefiro escolher o tipo do meu negócio
      </button>
    </div>
  );
}
