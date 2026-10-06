import { useEffect, useRef, useState } from "react";
import "../ui.css";
import "./assistant.css";
import {
  fetchMenuTemplate,
  fetchMenuTemplates,
  importMenu,
  type MenuImportResult,
  type MenuTemplateSummary,
} from "../service/api";
import { parseSpokenNumber } from "../onboarding/tourEngine";
import PhotoSession from "../photos/PhotoSession";
import { prepareVoice } from "../onboarding/speech";
import {
  formatPrice,
  interpretSpokenItems,
  matchBusinessType,
  normalizePrice,
  parseAssistantCommand,
  type SpokenItems,
} from "./assistantLogic";
import {
  addItem,
  applySpoken,
  backOnePrice,
  currentCategory,
  currentPriceItem,
  editPrice,
  importPayload,
  initialFlow,
  nextCategory,
  previousCategory,
  removeItem,
  selectedInCategory,
  selectedItems,
  setCurrentPrice,
  setStep,
  skipCategory,
  skipCurrentPrice,
  startFromTemplate,
  toggleAllInCategory,
  toggleItem,
  type FlowState,
} from "./assistantFlow";
import { BUSINESS_QUESTION, MORE_OR_DONE, progressText, promptFor } from "./assistantPrompts";
import {
  LISTEN_DELAY_MS,
  canListen,
  canSpeak,
  chooseNextVoice,
  currentVoiceName,
  hear,
  speakAsync,
  stopSpeaking,
  voiceCount,
  type Hearing,
} from "./voiceIO";

type Props = {
  companyId: string;
  /** Called after the menu was saved, so the lists in the panel can refresh. */
  onSaved?: () => void;
  /** Opens the screen that lists the dishes. */
  onSeeMenu?: () => void;
  /** Opens the tour of tables, Pix and orders: the natural next step once the menu exists. */
  onOpenGuide?: () => void;
};

type Status = "idle" | "speaking" | "listening";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** After this many silent turns in a row the assistant stops listening and shows how to fix the microphone. */
const SILENT_TURNS_BEFORE_HELP = 2;

export default function MenuAssistant({ companyId, onSaved, onSeeMenu, onOpenGuide }: Props) {
  const [templates, setTemplates] = useState<MenuTemplateSummary[] | null>(null);
  const [templatesError, setTemplatesError] = useState("");
  const [flow, setFlow] = useState<FlowState>(initialFlow);
  const [started, setStarted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(canSpeak());
  const [micOn, setMicOn] = useState(canListen());
  const [status, setStatus] = useState<Status>("idle");
  const [prompt, setPrompt] = useState("");
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [unclear, setUnclear] = useState<string[]>([]);
  const [otherName, setOtherName] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [result, setResult] = useState<MenuImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [photosOn, setPhotosOn] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState("");

  // Everything the voice loop reads lives in refs: it keeps running between renders.
  const flowRef = useRef(flow);
  const templatesRef = useRef(templates);
  const voiceOnRef = useRef(voiceOn);
  const micOnRef = useRef(micOn);
  const sessionRef = useRef(0);
  const hearingRef = useRef<Hearing | null>(null);
  const silentTurnsRef = useRef(0);
  const savingRef = useRef(false);
  /** True while the notice on screen is only "I did not hear anything", which is stale once the screen moves on. */
  const silenceNoticeRef = useRef(false);
  templatesRef.current = templates;
  voiceOnRef.current = voiceOn;
  micOnRef.current = micOn;

  /* ------------------------------------------------------- loading models */

  function loadTemplates() {
    setTemplatesError("");
    fetchMenuTemplates()
      .then(setTemplates)
      .catch((err: unknown) =>
        setTemplatesError(err instanceof Error ? err.message : "Não foi possível carregar os modelos.")
      );
  }

  useEffect(() => {
    loadTemplates();
    prepareVoice();
    // The phone fills its list of voices a moment after the page opens.
    const voiceTimer = setTimeout(() => setVoiceLabel(currentVoiceName() ?? ""), 800);
    return () => {
      clearTimeout(voiceTimer);
      // Leaving the screen silences the assistant.
      sessionRef.current += 1;
      hearingRef.current?.cancel();
      stopSpeaking();
    };
  }, []);

  /* ------------------------------------------------------------- the voice */

  function commit(next: FlowState) {
    flowRef.current = next;
    setFlow(next);
  }

  function silence() {
    sessionRef.current += 1;
    hearingRef.current?.cancel();
    hearingRef.current = null;
    stopSpeaking();
    setStatus("idle");
    setHeard("");
  }

  async function listen(session: number) {
    if (!micOnRef.current || !canListen()) {
      setStatus("idle");
      return;
    }
    setStatus("listening");
    setHeard("");
    const hearing = hear({
      onPartial: (text) => {
        if (session === sessionRef.current) setHeard(text);
      },
    });
    hearingRef.current = hearing;
    const transcript = await hearing.result;
    if (session !== sessionRef.current) return;

    hearingRef.current = null;
    setStatus("idle");
    setHeard("");

    if (!transcript) {
      silentTurnsRef.current += 1;
      silenceNoticeRef.current = true;
      setNotice(
        silentTurnsRef.current >= SILENT_TURNS_BEFORE_HELP
          ? "Não estou ouvindo. Veja se o microfone está liberado no navegador (cadeado ao lado do endereço) ou use os botões."
          : "Não ouvi nada. Toque em Falar e diga de novo."
      );
      return;
    }

    silentTurnsRef.current = 0;
    silenceNoticeRef.current = false;
    setNotice(`Você disse: “${transcript}”`);
    handleHeard(transcript);
  }

  /** Says the text, then listens for the answer by itself. */
  async function say(message: string, listenAfter = true) {
    const session = ++sessionRef.current;
    hearingRef.current?.cancel();
    hearingRef.current = null;
    setPrompt(message);
    setHeard("");

    if (voiceOnRef.current && canSpeak()) {
      setStatus("speaking");
      await speakAsync(message);
      if (session !== sessionRef.current) return;
    }
    if (!listenAfter) {
      setStatus("idle");
      return;
    }
    await wait(LISTEN_DELAY_MS);
    if (session !== sessionRef.current) return;
    await listen(session);
  }

  /** Moves to a new state and asks its question. */
  function go(next: FlowState, before = "") {
    // The first price question explains what is happening; the next ones are just the dish.
    const intro = next.step === "prices" && flowRef.current.step !== "prices";
    commit(next);
    if (silenceNoticeRef.current) {
      silenceNoticeRef.current = false;
      setNotice("");
    }
    setUnclear([]);
    setPriceInput("");
    setProblem("");
    const question = promptFor(next, intro);
    void say(before ? `${before} ${question}` : question, next.step !== "saving" && next.step !== "done");
  }

  function tapMic() {
    if (status === "listening") {
      // Stopping also turns off the automatic listening until Falar is tapped again.
      setMicOn(false);
      micOnRef.current = false;
      silence();
      return;
    }
    const session = ++sessionRef.current;
    hearingRef.current?.cancel();
    stopSpeaking();
    silentTurnsRef.current = 0;
    if (!canListen()) {
      setNotice("Este navegador não escuta a voz. Use os botões.");
      return;
    }
    if (!micOnRef.current) setMicOn(true);
    micOnRef.current = true;
    void listen(session);
  }

  /** Tries the next Portuguese voice of the phone; the choice is remembered in this browser. */
  function changeVoice() {
    const name = chooseNextVoice();
    if (!name) {
      setNotice("Este celular só tem uma voz em português.");
      return;
    }
    setVoiceLabel(name);
    setVoiceOn(true);
    voiceOnRef.current = true;
    void say("Esta é a minha nova voz. Gostou?", false);
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    voiceOnRef.current = next;
    if (!next) stopSpeaking();
  }

  /* ------------------------------------------------------------- the steps */

  function start() {
    prepareVoice();
    setStarted(true);
    setPhotosOn(false);
    commit(initialFlow());
    setNotice("");
    setProblem("");
    setUnclear([]);
    void say(BUSINESS_QUESTION);
  }

  async function chooseType(templateId: string) {
    if (busy) return;
    silence();
    setBusy(true);
    setProblem("");
    try {
      const template = await fetchMenuTemplate(templateId);
      const next = startFromTemplate(template);
      setBusy(false);
      go(next, `${template.name}.`);
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "Não foi possível carregar o modelo.";
      setProblem(message);
      void say(`${message} Toque no tipo do seu negócio para tentar de novo.`, false);
    }
  }

  function advanceFromPick() {
    const state = flowRef.current;
    const next = nextCategory(state);
    if (next.step === "pick" && state.categoryIndex >= state.categories.length - 1) {
      void say("Você ainda não escolheu nenhum prato. Toque ou fale os pratos que você vende.");
      return;
    }
    go(next);
  }

  function handlePick(text: string) {
    const state = flowRef.current;
    const category = currentCategory(state);
    if (!category) return;

    // Dishes of the list first: some are made of command words ("X-Tudo").
    const spoken = interpretSpokenItems(text, category.items.map((item) => item.name));
    if (spoken.matched.length > 0) {
      applyDishes(spoken);
      return;
    }

    switch (parseAssistantCommand(text)) {
      case "next":
        return advanceFromPick();
      case "skip":
      case "no":
        return go(skipCategory(state), "Certo, nenhum aqui.");
      case "all": {
        commit(toggleAllInCategory(state));
        void say(`Marquei todos. ${MORE_OR_DONE}`);
        return;
      }
      case "back":
        return go(previousCategory(state));
      case "repeat":
        return void say(promptFor(state));
      default:
        break;
    }

    if (spoken.custom.length > 0) {
      applyDishes(spoken);
      return;
    }
    if (spoken.unclear.length > 0) {
      setUnclear(spoken.unclear);
      void say("Não consegui separar os pratos. Fale um de cada vez, ou toque na tela.");
      return;
    }
    void say("Não entendi. Fale o nome dos pratos, ou diga pronto.");
  }

  /** Ticks the dishes that were said and asks for more, or moves on when the person said "pronto". */
  function applyDishes(spoken: SpokenItems) {
    const state = flowRef.current;
    const applied = applySpoken(state, state.categoryIndex, spoken);
    commit(applied.state);
    setUnclear(spoken.unclear);
    if (spoken.finished) {
      advanceFromPick();
      return;
    }
    const extra = spoken.unclear.length > 0 ? " Uma parte eu não entendi, está na tela." : "";
    const news = applied.selected.length + applied.added.length > 0 ? "Anotado." : "Esses já estavam marcados.";
    void say(`${news}${extra} ${MORE_OR_DONE}`);
  }

  function acceptPrice(raw: string): boolean {
    const state = flowRef.current;
    const current = currentPriceItem(state);
    const next = setCurrentPrice(state, raw);
    if (!current || next === state) return false;
    setNotice(`${current.name}: ${formatPrice(normalizePrice(raw) ?? "0")}`);
    go(next);
    return true;
  }

  function handlePrice(text: string) {
    const state = flowRef.current;
    const spoken = parseSpokenNumber(text);
    if (spoken !== null && acceptPrice(spoken)) return;

    switch (parseAssistantCommand(text)) {
      case "skip":
        return go(skipCurrentPrice(state), "Tirei esse prato.");
      case "back":
        return go(backOnePrice(state));
      case "repeat":
      case "next":
        return void say(promptFor(state));
      default:
        break;
    }
    void say("Não entendi o preço. Fale só o valor, por exemplo: dezoito e cinquenta.");
  }

  async function save() {
    if (savingRef.current) return;
    const state = flowRef.current;
    const payload = importPayload(state);
    if (payload.categories.length === 0) {
      void say("Não tem nenhum prato com preço para cadastrar.", false);
      return;
    }
    savingRef.current = true;
    commit(setStep(state, "saving"));
    void say(promptFor(setStep(state, "saving")), false);
    try {
      const outcome = await importMenu(companyId, payload);
      setResult(outcome);
      savingRef.current = false;
      go(setStep(state, "done"));
      onSaved?.();
    } catch (err) {
      savingRef.current = false;
      const message = err instanceof Error ? err.message : "Não foi possível cadastrar.";
      setProblem(message);
      commit(setStep(state, "review"));
      void say(`Não consegui cadastrar. ${message}`, false);
    }
  }

  function handleReview(text: string) {
    const state = flowRef.current;
    switch (parseAssistantCommand(text)) {
      case "confirm":
        return void save();
      case "back":
        return go(backOnePrice(state));
      case "repeat":
        return void say(promptFor(state));
      default:
        void say("Para cadastrar, diga cadastrar. Para mudar um preço, toque nele.");
    }
  }

  function handleType(text: string) {
    const options = (templatesRef.current ?? []).map((t) => ({ id: t.id, name: t.name }));
    const id = matchBusinessType(text, options);
    if (id) {
      void chooseType(id);
      return;
    }
    if (parseAssistantCommand(text) === "repeat") {
      void say(BUSINESS_QUESTION);
      return;
    }
    void say("Não entendi. Toque no tipo do seu negócio, ou fale de novo.");
  }

  function handleHeard(text: string) {
    switch (flowRef.current.step) {
      case "type":
        return handleType(text);
      case "pick":
        return handlePick(text);
      case "prices":
        return handlePrice(text);
      case "review":
        return handleReview(text);
      default:
        return;
    }
  }

  /* ----------------------------------------------------------- touch input */

  function submitTypedPrice() {
    if (!acceptPrice(priceInput)) {
      setProblem("Digite só o valor, por exemplo 18,50.");
      return;
    }
    setProblem("");
  }

  function addOther(name = otherName) {
    const state = flowRef.current;
    const added = addItem(state, state.categoryIndex, name);
    commit(added.state);
    setOtherName("");
  }

  /* ------------------------------------------------------------------ view */

  const unsupported = !canListen();
  const category = currentCategory(flow);
  const priceItem = currentPriceItem(flow);
  const picked = selectedItems(flow);

  if (!started) {
    return (
      <section className="sheet asst" aria-label="Assistente do cardápio">
        <h2>Assistente do cardápio</h2>
        <p className="asst-lead">
          Eu pergunto, você fala. Escolhe o tipo do seu negócio, marca os pratos que vende e diz o
          preço de cada um. No fim, o cardápio fica pronto de uma vez.
        </p>
        {unsupported && (
          <p className="asst-help">
            Este navegador não escuta a voz. Dá para fazer tudo tocando nos botões; para falar, use o
            Chrome no celular.
          </p>
        )}
        {templatesError ? (
          <>
            <p className="msg-error">{templatesError}</p>
            <button type="button" className="btn btn-outline btn-block" onClick={loadTemplates}>
              Tentar de novo
            </button>
          </>
        ) : (
          <button
            id="assistant-start"
            type="button"
            className="btn btn-primary btn-block asst-start"
            disabled={templates === null}
            onClick={start}
          >
            {templates === null ? "Carregando…" : "Começar"}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="asst" aria-label="Assistente do cardápio">
      <p className="asst-progress">{progressText(flow)}</p>

      <div className="asst-bubble" aria-live="polite">
        <p>{prompt || promptFor(flow)}</p>
        {status === "speaking" && <small>Falando…</small>}
        {status === "listening" && (
          <small className="asst-listening">{heard ? `Ouvindo: ${heard}` : "Ouvindo… pode falar."}</small>
        )}
      </div>

      {notice && <p className="asst-notice">{notice}</p>}
      {problem && <p className="msg-error">{problem}</p>}

      {flow.step === "type" && (
        <div className="asst-types" role="group" aria-label="Tipo de negócio">
          {(templates ?? []).map((template) => (
            <button
              key={template.id}
              type="button"
              className="asst-type"
              disabled={busy}
              onClick={() => void chooseType(template.id)}
            >
              <span className="asst-type-icon" aria-hidden="true">{template.icon}</span>
              <span>{template.name}</span>
            </button>
          ))}
        </div>
      )}

      {flow.step === "pick" && category && (
        <div className="sheet asst-pick">
          <div className="asst-pick-head">
            <h3>{category.name}</h3>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => commit(toggleAllInCategory(flow))}>
              {category.items.every((item) => item.selected) ? "Desmarcar todos" : "Marcar todos"}
            </button>
          </div>

          <div className="asst-chips" role="group" aria-label={`Pratos de ${category.name}`}>
            {category.items.map((item, index) => (
              <button
                key={`${item.name}-${index}`}
                type="button"
                className={item.selected ? "asst-chip is-on" : "asst-chip"}
                aria-pressed={item.selected}
                onClick={() => commit(toggleItem(flow, flow.categoryIndex, index))}
              >
                {item.selected ? "✓ " : ""}
                {item.name}
              </button>
            ))}
          </div>

          {unclear.length > 0 && (
            <div className="asst-unclear">
              <p>Não separei isto. Se for um prato só, toque para adicionar:</p>
              <div className="asst-chips">
                {unclear.map((text) => (
                  <button
                    key={text}
                    type="button"
                    className="asst-chip"
                    onClick={() => {
                      addOther(text);
                      setUnclear((current) => current.filter((value) => value !== text));
                    }}
                  >
                    + {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="asst-other"
            onSubmit={(event) => {
              event.preventDefault();
              addOther();
            }}
          >
            <label className="field">
              <span>Outro prato</span>
              <input
                value={otherName}
                maxLength={150}
                placeholder="Digite o nome"
                onChange={(event) => setOtherName(event.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-outline" disabled={!otherName.trim()}>
              Adicionar
            </button>
          </form>

          <div className="asst-actions">
            {flow.categoryIndex > 0 && (
              <button type="button" className="btn btn-quiet" onClick={() => go(previousCategory(flow))}>
                Voltar
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => go(skipCategory(flow), "Certo, nenhum aqui.")}
            >
              Não vendo nada aqui
            </button>
            <button
              id="assistant-next"
              type="button"
              className="btn btn-primary"
              onClick={advanceFromPick}
            >
              {flow.categoryIndex < flow.categories.length - 1
                ? `Próxima: ${flow.categories[flow.categoryIndex + 1].name}`
                : "Ir para os preços"}
              {selectedInCategory(flow) > 0 ? ` (${selectedInCategory(flow)} marcados)` : ""}
            </button>
          </div>
        </div>
      )}

      {flow.step === "prices" && priceItem && (
        <form
          className="sheet asst-price"
          onSubmit={(event) => {
            event.preventDefault();
            submitTypedPrice();
          }}
        >
          <p className="asst-price-category">{priceItem.categoryName}</p>
          <h3 className="asst-price-name">{priceItem.name}</h3>
          <label className="field">
            <span>Quanto custa? (em reais)</span>
            <input
              id="assistant-price"
              className="asst-price-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="18,50"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={!priceInput.trim()}>
            Confirmar preço
          </button>
          <div className="asst-actions">
            <button type="button" className="btn btn-quiet" onClick={() => go(backOnePrice(flow))}>
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => go(skipCurrentPrice(flow), "Tirei esse prato.")}
            >
              Tirar este prato
            </button>
          </div>
        </form>
      )}

      {(flow.step === "review" || flow.step === "saving") && (
        <div className="sheet asst-review">
          <h3>Conferir o cardápio</h3>
          {flow.categories.map((cat, categoryIndex) => {
            const rows = cat.items
              .map((item, itemIndex) => ({ item, itemIndex }))
              .filter(({ item }) => item.selected);
            if (rows.length === 0) return null;
            return (
              <div key={cat.name} className="asst-review-group">
                <h4>{cat.name}</h4>
                <ul>
                  {rows.map(({ item, itemIndex }) => (
                    <li key={`${item.name}-${itemIndex}`}>
                      <span className="asst-review-name">{item.name}</span>
                      <input
                        aria-label={`Preço de ${item.name}`}
                        className="asst-review-price"
                        inputMode="decimal"
                        defaultValue={item.price ? item.price.replace(".", ",") : ""}
                        key={`${item.price}`}
                        onBlur={(event) => {
                          const next = editPrice(flowRef.current, categoryIndex, itemIndex, event.target.value);
                          if (next === flowRef.current) event.target.value = item.price.replace(".", ",");
                          else commit(next);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        aria-label={`Tirar ${item.name}`}
                        onClick={() => commit(removeItem(flow, categoryIndex, itemIndex))}
                      >
                        Tirar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="asst-actions">
            <button type="button" className="btn btn-quiet" onClick={() => go(backOnePrice(flow))}>
              Voltar
            </button>
            <button
              id="assistant-save"
              type="button"
              className="btn btn-primary"
              disabled={flow.step === "saving" || picked.length === 0}
              onClick={() => void save()}
            >
              {flow.step === "saving" ? "Cadastrando…" : `Cadastrar tudo (${picked.length})`}
            </button>
          </div>
        </div>
      )}

      {flow.step === "done" && photosOn && (
        <PhotoSession
          companyId={companyId}
          voice={voiceOn}
          onChanged={onSaved}
          onBack={() => setPhotosOn(false)}
          onSeeMenu={onSeeMenu}
        />
      )}

      {flow.step === "done" && !photosOn && (
        <div className="sheet asst-done">
          <h3>Cardápio cadastrado</h3>
          {result && (
            <p>
              {result.products_created} {result.products_created === 1 ? "prato novo" : "pratos novos"}
              {result.products_skipped > 0 ? `, ${result.products_skipped} já existiam` : ""}.
            </p>
          )}
          <p className="asst-help">Foto ajuda o cliente a escolher. Em breve: logomarca.</p>
          <div className="asst-actions">
            <button
              id="assistant-photos"
              type="button"
              className="btn btn-primary"
              onClick={() => {
                silence();
                setPhotosOn(true);
              }}
            >
              Colocar fotos nos pratos
            </button>
            {onOpenGuide && (
              <button type="button" className="btn btn-outline" onClick={onOpenGuide}>
                Continuar: mesas, Pix e pedidos
              </button>
            )}
            {onSeeMenu && (
              <button type="button" className="btn btn-outline" onClick={onSeeMenu}>
                Ver o cardápio
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => { setResult(null); start(); }}>
              Cadastrar mais pratos
            </button>
          </div>
        </div>
      )}

      {flow.step !== "saving" && flow.step !== "done" && (
        <div className="asst-bar">
          <button
            id="assistant-mic"
            type="button"
            className={status === "listening" ? "asst-mic is-listening" : "asst-mic"}
            disabled={unsupported}
            onClick={tapMic}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"
              />
            </svg>
            {status === "listening" ? "Ouvindo… toque para parar" : "Falar"}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-pressed={voiceOn}
            onClick={toggleVoice}
            disabled={!canSpeak()}
          >
            {voiceOn ? "Voz ligada" : "Voz desligada"}
          </button>
          {canSpeak() && voiceCount() > 1 && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={changeVoice}>
              Trocar voz
            </button>
          )}
          {status === "speaking" && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={silence}>
              Parar de falar
            </button>
          )}
          {voiceLabel && <small className="asst-voice-name">Voz: {voiceLabel}</small>}
        </div>
      )}
    </section>
  );
}
