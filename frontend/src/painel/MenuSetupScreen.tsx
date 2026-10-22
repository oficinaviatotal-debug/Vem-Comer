import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MenuSetup from "../novo/MenuSetup";
import {
  MENU_FULL,
  MENU_MODEL_EMPTY,
  MENU_MODEL_ERROR,
  MENU_MODEL_NONE,
  MENU_MODEL_OPEN_ERROR,
  MENU_NAME_BAD,
  MENU_ONLY_FIT,
  MENU_PRICE_BAD,
  MENU_READ_ODD,
  MENU_SAVE_ERROR,
  MENU_SPEAK_EMPTY,
  MENU_TOO_HEAVY,
} from "../novo/copy";
import { fetchMenuCapabilities, fetchMenuTemplate, fetchMenuTemplates, HttpError, importMenu, readMenuFile, readMenuPhotos } from "../service/api";
import { prepareMenuPage } from "../photos/photoFiles";
import { photoErrorText } from "../photos/photoLogic";
import { canListen, DICTATION_PATIENCE_MS, hear, type Hearing } from "../assistant/voiceIO";
import { importPayload, selectedItems, startFromParsed, startSpeak, type FlowState } from "../assistant/assistantFlow";
import {
  fitsTogether,
  menuFileProblem,
  normalizeReading,
  pagesLeft,
  readyMenuOptions,
  unreadableFileText,
  unreadableText,
  type ReadyMenuOptions,
} from "../assistant/menuPhotoLogic";
import {
  backPrice,
  dropDish,
  goBackPick,
  goNext,
  modelOf,
  modelTypesOf,
  pickViewOf,
  pricesViewOf,
  startModel,
  takeDish,
  takePrice,
  toggleCategory,
  toggleDish,
  typesViewOf,
  whereOf,
  type MenuModelTile,
} from "./menuModelLogic";
import {
  addUnclear,
  applyEdit,
  doneViewOf,
  doorViewOf,
  pagesViewOf,
  readFailureText,
  readingViewOf,
  reviewViewOf,
  saveResultOf,
  speakViewOf,
  takeOut,
  takeSpoken,
  useGuess,
  whenNotHeard,
  type MenuSaveResult,
} from "./menuSetupLogic";

type Props = {
  companyId: string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
  /** "Ver os pratos" depois de cadastrar. Sem isto o botão não aparece. */
  onSeeMenu?: () => void;
};

type Where = "door" | "types" | "pick" | "prices" | "pages" | "reading" | "speak" | "review" | "done";
type Page = { id: number; blob: Blob; url: string };

/** O servidor espera até 85 s pela leitura; aqui um pouco mais que isso. */
const READ_TIMEOUT_MS = 100_000;

/** Frase do erro do servidor quando há (ele escreve em português); sem resposta, a frase de "sem sinal". */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof HttpError && error.status > 0 ? error.message : fallback);

/**
 * Montar o cardápio de verdade: foto, arquivo ou falar os pratos, conferir e cadastrar. Ler a foto é do servidor; entender a fala,
 * tirar prato e conferir preço vêm da lógica testada do assistente. Prato sem preço não entra no cadastro, e o cadastro só
 * acrescenta (o que já existe não repete), então tocar duas vezes por engano não duplica nada.
 */
export default function MenuSetupScreen({ companyId, onMenu, onSeeMenu }: Props) {
  const [where, setWhere] = useState<Where>("door");
  const [options, setOptions] = useState<ReadyMenuOptions | null>(null);
  const [doorError, setDoorError] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [pagesMessage, setPagesMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [flow, setFlow] = useState<FlowState>(startSpeak);
  const [notice, setNotice] = useState("");
  const [unclear, setUnclear] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<MenuSaveResult | null>(null);
  // Começar de um modelo: a lista de tipos (guardada enquanto a tela está aberta), a busca, e os avisos de cada etapa.
  const [models, setModels] = useState<MenuModelTile[] | null>(null);
  const [typesError, setTypesError] = useState("");
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState(false);
  const [pickNotice, setPickNotice] = useState("");
  const [priceProblem, setPriceProblem] = useState<"" | "price">("");

  const alive = useRef(true);
  /** Cada ação nova leva um número; uma ação antiga que termina tarde vê que passou da vez e para. */
  const run = useRef(0);
  /** A lista de tipos e a abertura de um modelo têm número próprio: voltar e entrar de novo não cancela uma e não deixa a outra passar da vez. */
  const typesRun = useRef(0);
  const openRun = useRef(0);
  const openingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const readKind = useRef<"photo" | "file">("photo");
  const nextId = useRef(1);
  const pagesRef = useRef<Page[]>([]);
  pagesRef.current = pages;
  const flowRef = useRef<FlowState>(flow);
  flowRef.current = flow;
  const headingRef = useRef("");
  const hearing = useRef<Hearing | null>(null);
  const session = useRef(0);
  const heardRef = useRef("");
  const silent = useRef(0);
  const working = useRef(false);
  const voiceWorks = useMemo(() => canListen(), []);

  useEffect(() => {
    alive.current = true;
    void fetchMenuCapabilities().then((capabilities) => {
      if (alive.current) setOptions(readyMenuOptions(capabilities));
    });
    return () => {
      alive.current = false;
      run.current += 1;
      typesRun.current += 1;
      openRun.current += 1;
      session.current += 1;
      controller.current?.abort();
      hearing.current?.cancel();
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, []);

  // A cada etapa nova o foco vai para a frase de aviso: o leitor de tela fala o que mudou e o teclado não fica para trás.
  // Marcando pratos, cada categoria nova também conta como etapa nova. Nos preços o foco fica no campo do preço, que já o toma.
  const first = useRef(true);
  const stepKey = where === "pick" ? `pick-${flow.categoryIndex}` : where;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (stepKey === "prices") return;
    document.getElementById("nv-menu-live")?.focus();
  }, [stepKey]);

  // ------------------------------------------------------------------------------------------ a foto

  const clearPages = useCallback(() => {
    pagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const room = pagesLeft(pagesRef.current.length);
    if (room === 0) {
      setPagesMessage(MENU_FULL);
      return;
    }
    const mine = ++run.current;
    setPreparing(true);
    setPagesMessage("");
    setFailed(false);
    const blobs: Blob[] = [];
    let problem = "";
    for (const file of files.slice(0, room)) {
      try {
        blobs.push(await prepareMenuPage(file));
      } catch (reason) {
        problem = photoErrorText(reason);
      }
      if (mine !== run.current || !alive.current) return;
    }
    const fresh = blobs.map((blob) => ({ id: nextId.current++, blob, url: URL.createObjectURL(blob) }));
    setPages((current) => [...current, ...fresh]);
    setPagesMessage([problem, files.length > room ? MENU_ONLY_FIT : ""].filter(Boolean).join(" "));
    setPreparing(false);
  }, []);

  const removePage = useCallback((id: number) => {
    const page = pagesRef.current.find((current) => current.id === id);
    if (page) URL.revokeObjectURL(page.url);
    setPages((current) => current.filter((candidate) => candidate.id !== id));
    setPagesMessage("");
    setFailed(false);
  }, []);

  /** Uma leitura: mostra a espera, manda, e mostra o que voltou. `kind` decide para onde se volta se der errado. */
  const runReading = useCallback(async (kind: "photo" | "file", send: (signal: AbortSignal) => Promise<unknown>) => {
    const mine = ++run.current;
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), READ_TIMEOUT_MS);
    readKind.current = kind;
    setWhere("reading");
    const fall = (message: string, unreadable = false) => {
      if (kind === "photo") {
        if (unreadable) clearPages();
        setPagesMessage(message);
        setFailed(!unreadable);
        setWhere("pages");
      } else {
        setDoorError(message);
        setWhere("door");
      }
    };
    try {
      const answer = await send(abort.signal);
      if (mine !== run.current || !alive.current) return;
      const parsed = normalizeReading(answer);
      if (!parsed) return fall(MENU_READ_ODD);
      const read = parsed.readable ? startFromParsed(parsed) : null;
      if (!read || selectedItems(read).length === 0) return fall(kind === "photo" ? unreadableText(parsed) : unreadableFileText(parsed, options?.photo === true), true);
      setFlow(read);
      headingRef.current = "";
      setEditing(null);
      setReviewError("");
      setWhere("review");
    } catch (reason) {
      if (mine !== run.current || !alive.current) return;
      fall(readFailureText(reason));
    } finally {
      window.clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
    }
  }, [clearPages, options]);

  const read = useCallback(() => {
    const current = pagesRef.current;
    if (current.length === 0) return;
    if (!fitsTogether(current.map((page) => page.blob.size))) {
      setPagesMessage(MENU_TOO_HEAVY);
      return;
    }
    void runReading("photo", (signal) =>
      readMenuPhotos(
        current.map((page) => page.blob),
        signal,
      ),
    );
  }, [runReading]);

  const readFile = useCallback(
    (file: File) => {
      const problem = menuFileProblem(file, options?.pdf === true);
      if (problem) {
        setDoorError(problem);
        return;
      }
      setDoorError("");
      void runReading("file", (signal) => readMenuFile(file, signal));
    },
    [options, runReading],
  );

  const cancelReading = useCallback(() => {
    run.current += 1;
    controller.current?.abort();
    setPagesMessage("");
    setDoorError("");
    setPreparing(false);
    setWhere(readKind.current === "photo" ? "pages" : "door");
  }, []);

  // ------------------------------------------------------------------------------------------ falar

  const stopListening = useCallback(() => {
    session.current += 1;
    hearing.current?.cancel();
    hearing.current = null;
    heardRef.current = "";
    setListening(false);
    setHeard("");
  }, []);

  const finishSpeaking = useCallback(() => {
    if (selectedItems(flowRef.current).length === 0) {
      setNotice(MENU_SPEAK_EMPTY);
      return;
    }
    stopListening();
    setUnclear([]);
    setEditing(null);
    setReviewError("");
    setWhere("review");
  }, [stopListening]);

  const take = useCallback(
    (text: string) => {
      const out = takeSpoken(flowRef.current, text, headingRef.current);
      setFlow(out.flow);
      flowRef.current = out.flow;
      headingRef.current = out.heading;
      setNotice(out.notice);
      setUnclear(out.unclear);
      if (out.finished) finishSpeaking();
    },
    [finishSpeaking],
  );

  const mic = useCallback(async () => {
    if (hearing.current) {
      // Tocar para parar não joga fora o que já foi ouvido: vai para a lista como se a pessoa tivesse terminado a frase.
      const words = heardRef.current.trim();
      stopListening();
      if (words) take(words);
      return;
    }
    if (!canListen()) return;
    const mine = ++session.current;
    setListening(true);
    setHeard("");
    setNotice("");
    heardRef.current = "";
    const listener = hear({
      onPartial: (text) => {
        if (mine !== session.current) return;
        heardRef.current = text;
        setHeard(text);
      },
      patienceMs: DICTATION_PATIENCE_MS,
    });
    hearing.current = listener;
    const transcript = await listener.result;
    if (mine !== session.current || !alive.current) return;
    hearing.current = null;
    heardRef.current = "";
    setListening(false);
    setHeard("");
    if (!transcript) {
      silent.current += 1;
      setNotice(whenNotHeard(silent.current));
      return;
    }
    silent.current = 0;
    take(transcript);
  }, [stopListening, take]);

  // ------------------------------------------------------------------------------------------ cadastrar

  const save = useCallback(async () => {
    if (working.current) return;
    const payload = importPayload(flowRef.current);
    if (payload.categories.length === 0) return;
    working.current = true;
    setSaving(true);
    setReviewError("");
    try {
      const answer = await importMenu(companyId, payload);
      if (!alive.current) return;
      setResult(saveResultOf(answer));
      setEditing(null);
      setWhere("done");
    } catch (failure) {
      if (alive.current) setReviewError(wordsOf(failure, MENU_SAVE_ERROR));
    } finally {
      working.current = false;
      if (alive.current) setSaving(false);
    }
  }, [companyId]);

  // ------------------------------------------------------------------------------------------ começar de um modelo

  /** Troca o estado do assistente e vai para a tela que ele pede: marcar, preço ou conferir. */
  const go = useCallback((next: FlowState) => {
    flowRef.current = next;
    setFlow(next);
    const target = whereOf(next);
    if (target === "review") {
      setEditing(null);
      setReviewError("");
    }
    setWhere(target);
  }, []);

  /** Muda o estado sem trocar de tela (marcar, desmarcar, anotar um prato). */
  const update = useCallback((change: (current: FlowState) => FlowState) => {
    const next = change(flowRef.current);
    flowRef.current = next;
    setFlow(next);
  }, []);

  const loadTypes = useCallback(async () => {
    const mine = ++typesRun.current;
    setTypesError("");
    setModels(null);
    try {
      const tiles = modelTypesOf(await fetchMenuTemplates());
      if (mine !== typesRun.current || !alive.current) return;
      if (!tiles) return setTypesError(MENU_READ_ODD);
      if (tiles.length === 0) return setTypesError(MENU_MODEL_NONE);
      setModels(tiles);
    } catch (reason) {
      if (mine !== typesRun.current || !alive.current) return;
      setTypesError(wordsOf(reason, MENU_MODEL_ERROR));
    }
  }, []);

  const openTypes = useCallback(() => {
    setQuery("");
    setTypesError("");
    setWhere("types");
    if (models === null) void loadTypes();
  }, [loadTypes, models]);

  const chooseType = useCallback(
    async (id: string) => {
      if (openingRef.current) return;
      const mine = ++openRun.current;
      openingRef.current = true;
      setOpening(true);
      setTypesError("");
      try {
        const model = modelOf(await fetchMenuTemplate(id), id);
        if (mine !== openRun.current || !alive.current) return;
        if (!model) return setTypesError(MENU_MODEL_EMPTY);
        headingRef.current = "";
        setPickNotice("");
        setPriceProblem("");
        go(startModel(model));
      } catch (reason) {
        if (mine !== openRun.current || !alive.current) return;
        setTypesError(wordsOf(reason, MENU_MODEL_OPEN_ERROR));
      } finally {
        if (mine === openRun.current) {
          openingRef.current = false;
          if (alive.current) setOpening(false);
        }
      }
    },
    [go],
  );

  // ------------------------------------------------------------------------------------------ voltar

  const goDoor = useCallback(() => {
    run.current += 1;
    openRun.current += 1;
    openingRef.current = false;
    setOpening(false);
    setTypesError("");
    setQuery("");
    setPickNotice("");
    setPriceProblem("");
    stopListening();
    clearPages();
    setPagesMessage("");
    setFailed(false);
    setPreparing(false);
    setDoorError("");
    setNotice("");
    setUnclear([]);
    setEditing(null);
    setReviewError("");
    setWhere("door");
  }, [clearPages, stopListening]);

  const back = useCallback(() => {
    if (where === "pages") return goDoor();
    if (where === "speak") return goDoor();
    if (where === "types") return goDoor();
    if (where === "pick") {
      // Primeira categoria: volta à escolha do tipo (o que foi marcado só se perde se escolher outro tipo).
      const earlier = goBackPick(flowRef.current);
      setPickNotice("");
      if (!earlier) return setWhere("types");
      return go(earlier);
    }
    if (where === "prices") {
      setPriceProblem("");
      return go(backPrice(flowRef.current));
    }
    if (where === "review") {
      setEditing(null);
      setReviewError("");
      if (flowRef.current.source === "template") return go(backPrice(flowRef.current));
      if (flowRef.current.source === "speech") return setWhere("speak");
      if (pagesRef.current.length > 0) return setWhere("pages");
      return goDoor();
    }
    goDoor();
  }, [go, goDoor, where]);

  const startSpeaking = useCallback(() => {
    const fresh = startSpeak();
    setFlow(fresh);
    flowRef.current = fresh;
    headingRef.current = "";
    silent.current = 0;
    setNotice("");
    setUnclear([]);
    setWhere("speak");
  }, []);

  // ------------------------------------------------------------------------------------------ a tela

  const view = (() => {
    switch (where) {
      case "door":
        return doorViewOf({ options, voiceWorks, error: doorError });
      case "types":
        return typesViewOf({ types: models, query, error: typesError, opening });
      case "pick":
        return pickViewOf({ flow, notice: pickNotice });
      case "prices":
        // Sem prato esperando preço não há o que perguntar: a conferência é a tela certa.
        return pricesViewOf({ flow, problem: priceProblem }) ?? reviewViewOf({ flow, editing, error: reviewError });
      case "pages":
        return pagesViewOf({ pages, busy: preparing, photoEnabled: options?.photo === true, room: pagesLeft(pages.length), failed, message: pagesMessage });
      case "reading":
        return readingViewOf();
      case "speak":
        return speakViewOf({ flow, listening, canListen: voiceWorks, heard, notice, unclear });
      case "review":
        return reviewViewOf({ flow, editing, error: reviewError });
      default:
        return doneViewOf(result);
    }
  })();

  return (
    <MenuSetup
      view={view}
      busy={saving}
      onPhotos={(files) => {
        setWhere("pages");
        void addFiles(files);
      }}
      onFile={readFile}
      onSpeak={startSpeaking}
      onModel={openTypes}
      onQuery={(text) => {
        setQuery(text);
        setTypesError((current) => (models === null ? current : ""));
      }}
      onChooseType={(id) => void chooseType(id)}
      onRetryTypes={() => void loadTypes()}
      onToggleDish={(id) => {
        setPickNotice("");
        update((current) => toggleDish(current, id));
      }}
      onToggleAll={() => {
        setPickNotice("");
        update(toggleCategory);
      }}
      onAddDish={(text) => {
        const out = takeDish(flowRef.current, text);
        update(() => out.flow);
        setPickNotice(out.notice);
      }}
      onNext={() => {
        setPickNotice("");
        setPriceProblem("");
        go(goNext(flowRef.current));
      }}
      onPrice={(text) => {
        const out = takePrice(flowRef.current, text);
        setPriceProblem(out.problem);
        if (!out.problem) go(out.flow);
      }}
      onDropDish={() => {
        setPriceProblem("");
        go(dropDish(flowRef.current));
      }}
      onAddPhotos={(files) => void addFiles(files)}
      onRemovePage={removePage}
      onRead={read}
      onBack={back}
      onCancel={cancelReading}
      onMic={() => void mic()}
      onText={take}
      onRemoveDish={(id) => {
        setFlow((current) => takeOut(current, id));
        setEditing((current) => (current === id ? null : current));
      }}
      onUnclear={(text) => {
        setFlow((current) => addUnclear(current, text, headingRef.current));
        setUnclear((current) => current.filter((value) => value !== text));
      }}
      onFinish={finishSpeaking}
      onEdit={(id) => {
        setEditing(id);
        setReviewError("");
      }}
      onChange={(id, name, price) => {
        const outcome = applyEdit(flow, id, name, price);
        if (outcome.problem) return setReviewError(outcome.problem === "price" ? MENU_PRICE_BAD : MENU_NAME_BAD);
        setFlow(outcome.flow);
        setEditing(null);
        setReviewError("");
      }}
      onUse={(id) => setFlow((current) => useGuess(current, id))}
      onSave={() => void save()}
      onMore={goDoor}
      onSeeMenu={onSeeMenu}
      onMenu={onMenu}
    />
  );
}
