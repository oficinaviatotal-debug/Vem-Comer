import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { ModelPick, ModelPrices, ModelTypes, type MenuModelHandlers } from "./MenuModel";
import { MenuLive as Live, Spinner, TopBar, VoiceOrb } from "./parts";
import {
  MENU_ADD_PAGE,
  MENU_BACK,
  MENU_CANCEL,
  MENU_CHANGE,
  MENU_CLOSE_EDIT,
  MENU_DONE_MORE,
  MENU_DONE_SEE,
  MENU_EMPTY_REVIEW,
  MENU_GALLERY,
  MENU_INSIDE_HINT,
  MENU_INSIDE_LABEL,
  MENU_MIC,
  MENU_MIC_LISTENING,
  MENU_MIC_OFF,
  MENU_MISSING_HEADING,
  MENU_NAME_LABEL,
  MENU_NO_PRICE,
  MENU_NOTE,
  MENU_PAGES_HELP,
  MENU_PAGES_LABEL,
  MENU_PREPARING,
  MENU_PRICE_HINT,
  MENU_PRICE_LABEL,
  MENU_SAVING,
  MENU_SPEAK_EMPTY,
  MENU_SPEAK_EXAMPLE,
  MENU_TAKE_OUT,
  MENU_TAKE_PHOTO,
  MENU_TITLE,
  MENU_TYPE_HELP,
  MENU_TYPE_HINT,
  MENU_TYPE_LABEL,
  MENU_UNCLEAR,
  MENU_USE_GUESS,
} from "./copy";
import type { MenuDoorCard, MenuReviewDish, MenuReviewGroup, MenuSetupView } from "./types";

type Stage<K extends MenuSetupView["stage"]> = Extract<MenuSetupView, { stage: K }>;

export type MenuSetupHandlers = MenuModelHandlers & {
  /** A porta: fotos tiradas ou escolhidas, um arquivo, ou falar os pratos. */
  onPhotos?: (files: File[]) => void;
  onFile?: (file: File) => void;
  onSpeak?: () => void;
  /** "Escrever os pratos": a mesma tela de falar, com o campo de escrever já pronto. */
  onWrite?: () => void;
  onModel?: () => void;
  /** A bolinha de voz: começa a ouvir os pratos (na porta) ou liga e desliga o microfone (na tela de falar). */
  onOrb?: () => void;
  /** As páginas da foto. */
  onAddPhotos?: (files: File[]) => void;
  onRemovePage?: (id: number) => void;
  onRead?: () => void;
  onBack?: () => void;
  /** Lendo. */
  onCancel?: () => void;
  /** Falar. */
  onMic?: () => void;
  onText?: (text: string) => void;
  onRemoveDish?: (id: string) => void;
  onUnclear?: (text: string) => void;
  onFinish?: () => void;
  /** Conferir. */
  onEdit?: (id: string | null) => void;
  onChange?: (id: string, name: string, price: string, inside: string) => void;
  onUse?: (id: string) => void;
  onSave?: () => void;
  /** Cadastrado. */
  onMore?: () => void;
  onSeeMenu?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

type Props = MenuSetupHandlers & {
  view: MenuSetupView;
  /** Algo está indo ao servidor (cadastrando): nada mais se toca até voltar. */
  busy?: boolean;
};

/** Arquivos escolhidos: copia a lista antes de esvaziar o campo (esvaziar apaga a lista) e deixa escolher o mesmo arquivo de novo. */
function takeFiles(event: ChangeEvent<HTMLInputElement>): File[] {
  const chosen = event.target.files ? Array.from(event.target.files) : [];
  event.target.value = "";
  return chosen;
}

// ------------------------------------------------------------------------------------------------ a porta

const DOOR_ICON = { photo: "camera", gallery: "image", file: "doc", speak: "mic", write: "edit", model: "categories" } as const;

function DoorBody({ card }: { card: MenuDoorCard }) {
  return (
    <>
      <span className="nv-door-icon" aria-hidden="true">
        <NvIcon name={DOOR_ICON[card.id]} />
      </span>
      <span className="nv-door-text">
        <b>{card.title}</b>
        <span>{card.hint}</span>
      </span>
      {card.badge ? <span className="nv-door-badge">{card.badge}</span> : null}
      {card.state === "ready" ? (
        <span className="nv-door-go" aria-hidden="true">
          <NvIcon name="chevron" />
        </span>
      ) : null}
    </>
  );
}

function Door({ view, onPhotos, onFile, onSpeak, onWrite, onModel, onMenu, showMenu }: { view: Stage<"door"> } & MenuSetupHandlers) {
  /** Os cartões que abrem outra tela ao toque; os outros abrem a câmera, a galeria ou os arquivos do celular. */
  const tap = { speak: onSpeak, write: onWrite, model: onModel } as const;
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <Live text={view.error || view.sub} />
      {view.error ? (
        <p className="nv-error" role="alert">
          {view.error}
        </p>
      ) : null}
      {view.loading ? (
        <p className="nv-working" aria-hidden="true">
          <Spinner />
          {view.sub}
        </p>
      ) : (
        <ul className="nv-door">
          {view.cards.map((card) => (
            <li key={card.id}>
              {card.state !== "ready" ? (
                <div className="nv-doorcard is-off" aria-disabled="true">
                  <DoorBody card={card} />
                </div>
              ) : card.id === "speak" || card.id === "write" || card.id === "model" ? (
                <button type="button" className="nv-doorcard is-ready" onClick={tap[card.id]}>
                  <DoorBody card={card} />
                </button>
              ) : (
                <label className="nv-doorcard is-ready">
                  <DoorBody card={card} />
                  {card.id === "photo" || card.id === "gallery" ? (
                    <input
                      className="nv-sr"
                      type="file"
                      accept={card.accept}
                      capture={card.id === "photo" ? "environment" : undefined}
                      multiple={card.id === "gallery"}
                      aria-label={card.title}
                      onChange={(event) => {
                        const files = takeFiles(event);
                        if (files.length > 0) onPhotos?.(files);
                      }}
                    />
                  ) : (
                    <input
                      className="nv-sr"
                      type="file"
                      accept={card.accept}
                      aria-label={card.title}
                      onChange={(event) => {
                        const [file] = takeFiles(event);
                        if (file) onFile?.(file);
                      }}
                    />
                  )}
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {view.foot ? <p className="nv-code-hint">{view.foot}</p> : null}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ as páginas

/** Um botão que abre a câmera ou a galeria. O campo de arquivo fica escondido dentro dele e o toque no rótulo o abre. */
function PickButton({
  icon,
  label,
  camera,
  disabled,
  tone,
  onPick,
}: {
  icon: "camera" | "image";
  label: string;
  camera: boolean;
  disabled: boolean;
  tone: "green" | "ghost";
  onPick?: (files: File[]) => void;
}) {
  return (
    <label className={`nv-btn nv-filebtn is-${tone} is-block${disabled ? " is-off" : ""}`} aria-disabled={disabled || undefined}>
      <NvIcon name={icon} />
      {label}
      <input
        className="nv-sr"
        type="file"
        accept="image/*"
        capture={camera ? "environment" : undefined}
        multiple={!camera}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const files = takeFiles(event);
          if (files.length > 0) onPick?.(files);
        }}
      />
    </label>
  );
}

function Pages({ view, onAddPhotos, onRemovePage, onRead, onBack, onMenu, showMenu }: { view: Stage<"pages"> } & MenuSetupHandlers) {
  const none = view.pages.length === 0;
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <Live text={view.busy ? MENU_PREPARING : view.message || view.sub} />
      <p className="nv-code-hint">{MENU_PAGES_HELP}</p>

      {view.pages.length > 0 ? (
        <ul className="nv-pages" aria-label={MENU_PAGES_LABEL}>
          {view.pages.map((page) => (
            <li key={page.id}>
              <img src={page.src} alt={page.label} />
              <button
                type="button"
                className="nv-pages-remove"
                aria-label={`Tirar a ${page.label.toLowerCase().replace(" do cardápio", "")}`}
                disabled={view.busy}
                onClick={() => onRemovePage?.(page.id)}
              >
                <NvIcon name="close" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {view.busy ? (
        <p className="nv-working" aria-hidden="true">
          <Spinner />
          {MENU_PREPARING}
        </p>
      ) : null}

      {view.message ? (
        <p className="nv-error" role="alert">
          {view.message}
        </p>
      ) : null}

      <div className="nv-menu-actions">
        {view.canRead ? (
          <button type="button" className="nv-btn is-green is-tall is-block" onClick={onRead}>
            <NvIcon name="check" />
            {view.readLabel}
          </button>
        ) : null}
        {view.canAdd ? (
          <>
            <PickButton icon="camera" label={none ? MENU_TAKE_PHOTO : MENU_ADD_PAGE} camera tone={view.canRead ? "ghost" : "green"} disabled={view.busy} onPick={onAddPhotos} />
            <PickButton icon="image" label={MENU_GALLERY} camera={false} tone="ghost" disabled={view.busy} onPick={onAddPhotos} />
          </>
        ) : null}
        <button type="button" className="nv-btn is-ghost is-block" disabled={view.busy} onClick={onBack}>
          <NvIcon name="back" />
          {MENU_BACK}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ lendo

function Reading({ view, onCancel }: { view: Stage<"reading"> } & MenuSetupHandlers) {
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} />
      <Live text={view.text} />
      <p className="nv-working is-big" aria-hidden="true">
        <Spinner />
        {view.text}
      </p>
      <button type="button" className="nv-btn is-ghost is-block" onClick={onCancel}>
        {MENU_CANCEL}
      </button>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ falar

/** Escrever os pratos: um por linha (Enter muda de linha). Quem escreve pouco escreve só "x-tudo 25, tem ovo e bacon". */
function TypeBox({ onText }: { onText?: (text: string) => void }) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    onText?.(text.trim());
    setText("");
  }
  return (
    <form className="nv-typebox" onSubmit={send}>
      <label className="nv-text" htmlFor="nv-menu-type">
        <span>{MENU_TYPE_LABEL}</span>
      </label>
      <p className="nv-code-hint" id="nv-menu-type-help">
        {MENU_TYPE_HELP}
      </p>
      <div className="nv-typerow">
        <div className="nv-field is-area">
          <textarea
            id="nv-menu-type"
            value={text}
            rows={3}
            maxLength={1200}
            autoComplete="off"
            aria-describedby="nv-menu-type-help"
            placeholder={MENU_TYPE_HINT}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <button type="submit" className="nv-btn is-green" disabled={!ready}>
          {MENU_NOTE}
        </button>
      </div>
    </form>
  );
}

function Speak({ view, onMic, onText, onRemoveDish, onUnclear, onFinish, onBack, onMenu, showMenu }: { view: Stage<"speak"> } & MenuSetupHandlers) {
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <Live text={view.notice || view.sub} />
      <p className="nv-code-hint">{MENU_SPEAK_EXAMPLE}</p>

      {view.canListen ? (
        <button
          type="button"
          className={`nv-btn is-fire is-tall is-block nv-mic${view.listening ? " is-listening" : ""}`}
          aria-pressed={view.listening}
          onClick={onMic}
        >
          <NvIcon name="mic" />
          {view.listening ? MENU_MIC_LISTENING : MENU_MIC}
        </button>
      ) : (
        <p className="nv-code-hint">{MENU_MIC_OFF}</p>
      )}

      {view.listening && view.heard ? (
        <p className="nv-heard" aria-hidden="true">
          {view.heard}
        </p>
      ) : null}

      {view.notice ? (
        <p className="nv-ok" aria-hidden="true">
          {view.notice}
        </p>
      ) : null}

      {view.unclear.length > 0 ? (
        <div className="nv-unclear">
          <p className="nv-code-hint">{MENU_UNCLEAR}</p>
          {view.unclear.map((piece) => (
            <button key={piece} type="button" className="nv-btn is-ghost is-block" onClick={() => onUnclear?.(piece)}>
              {piece}
            </button>
          ))}
        </div>
      ) : null}

      <TypeBox onText={onText} />

      {view.groups.length === 0 ? (
        <p className="nv-empty">{MENU_SPEAK_EMPTY}</p>
      ) : (
        <ul className="nv-orders">
          {view.groups.map((group) => (
            <li key={group.id} className="nv-order nv-heardgroup">
              <h2 className="nv-order-where nv-dish-group">{group.name}</h2>
              <ul className="nv-dishrows">
                {group.dishes.map((dish) => (
                  <li key={dish.id} className={`nv-dishrow${dish.missing ? " is-missing" : ""}`}>
                    <div className="nv-dishrow-line">
                      <div className="nv-dishrow-main">
                        <p className="nv-dishrow-name">{dish.name}</p>
                        <p className="nv-dishrow-price">{dish.missing ? MENU_NO_PRICE : dish.price}</p>
                        {dish.inside ? <p className="nv-dishrow-inside">{dish.inside}</p> : null}
                      </div>
                      <div className="nv-dishrow-acts">
                        <button type="button" className="nv-icon-btn is-danger" aria-label={`${MENU_TAKE_OUT} ${dish.name}`} onClick={() => onRemoveDish?.(dish.id)}>
                          <NvIcon name="trash" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="nv-menu-actions">
        {view.finish ? (
          <button type="button" className="nv-btn is-green is-tall is-block" onClick={onFinish}>
            <NvIcon name="check" />
            {view.finish}
          </button>
        ) : null}
        <button type="button" className="nv-btn is-ghost is-block" onClick={onBack}>
          <NvIcon name="back" />
          {MENU_BACK}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ conferir

type ReviewDishProps = {
  dish: MenuReviewDish;
  editing: boolean;
  locked: boolean;
  onEdit?: (id: string | null) => void;
  onChange?: (id: string, name: string, price: string, inside: string) => void;
  onRemoveDish?: (id: string) => void;
  onUse?: (id: string) => void;
};

/** Um prato na conferência. Fechado: só informa (nome, preço, e o aviso se o preço parece engano). Aberto: dois campos e Pronto. */
function ReviewDishRow({ dish, editing, locked, onEdit, onChange, onRemoveDish, onUse }: ReviewDishProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const insideRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) (dish.missing ? priceRef.current : nameRef.current)?.focus();
    // Só ao abrir: abrir de novo depois de um erro não deve tirar o foco de onde a pessoa está escrevendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (editing) {
    return (
      <li className="nv-dishrow is-editing">
        <form
          className="nv-dishedit"
          onSubmit={(event) => {
            event.preventDefault();
            onChange?.(dish.id, nameRef.current?.value ?? dish.name, priceRef.current?.value ?? dish.priceValue, insideRef.current?.value ?? dish.inside);
          }}
        >
          <label className="nv-text" htmlFor={`nv-dish-name-${dish.id}`}>
            <span>{MENU_NAME_LABEL}</span>
          </label>
          <div className="nv-field">
            <input id={`nv-dish-name-${dish.id}`} ref={nameRef} defaultValue={dish.name} maxLength={80} autoComplete="off" />
          </div>
          <label className="nv-text" htmlFor={`nv-dish-price-${dish.id}`}>
            <span>{MENU_PRICE_LABEL}</span>
          </label>
          <div className="nv-field">
            <input id={`nv-dish-price-${dish.id}`} ref={priceRef} defaultValue={dish.priceValue} inputMode="decimal" autoComplete="off" placeholder={MENU_PRICE_HINT} />
          </div>
          <label className="nv-text" htmlFor={`nv-dish-inside-${dish.id}`}>
            <span>{MENU_INSIDE_LABEL}</span>
          </label>
          <div className="nv-field is-area">
            <textarea id={`nv-dish-inside-${dish.id}`} ref={insideRef} defaultValue={dish.inside} rows={2} maxLength={300} autoComplete="off" placeholder={MENU_INSIDE_HINT} />
          </div>
          <div className="nv-dishedit-acts">
            <button type="submit" className="nv-btn is-green is-small" disabled={locked}>
              <NvIcon name="check" />
              {MENU_CLOSE_EDIT}
            </button>
            <button type="button" className="nv-btn is-ghost is-small is-quiet" aria-label={`${MENU_TAKE_OUT} ${dish.name}`} disabled={locked} onClick={() => onRemoveDish?.(dish.id)}>
              {MENU_TAKE_OUT}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`nv-dishrow${dish.missing ? " is-missing" : ""}`}>
      <div className="nv-dishrow-line">
        <div className="nv-dishrow-main">
          <p className="nv-dishrow-name">{dish.name}</p>
          <p className="nv-dishrow-price">{dish.missing ? MENU_NO_PRICE : dish.price}</p>
          {dish.inside ? <p className="nv-dishrow-inside">{dish.inside}</p> : null}
        </div>
        <div className="nv-dishrow-acts">
          <button type="button" className={`nv-icon-btn${dish.missing ? " is-needed" : ""}`} aria-label={`${MENU_CHANGE} ${dish.name}`} disabled={locked} onClick={() => onEdit?.(dish.id)}>
            <NvIcon name="edit" />
          </button>
          <button type="button" className="nv-icon-btn is-danger" aria-label={`${MENU_TAKE_OUT} ${dish.name}`} disabled={locked} onClick={() => onRemoveDish?.(dish.id)}>
            <NvIcon name="trash" />
          </button>
        </div>
      </div>
      {dish.doubt ? (
        <div className="nv-dishrow-doubt">
          <p>{dish.doubt.text}</p>
          {dish.doubt.use ? (
            <button type="button" className="nv-btn is-fire is-small" disabled={locked} onClick={() => onUse?.(dish.id)}>
              {MENU_USE_GUESS} {dish.doubt.use.replace(".", ",")}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ReviewCard({ group, tone, editing, locked, ...rest }: { group: MenuReviewGroup; tone: "" | " is-warn"; editing: string | null; locked: boolean } & Omit<ReviewDishProps, "dish" | "editing" | "locked">) {
  return (
    <li className={`nv-order nv-menu-card${tone}`}>
      <h2 className="nv-order-where nv-dish-group">{group.name}</h2>
      <ul className="nv-dishrows">
        {group.dishes.map((dish) => (
          <ReviewDishRow key={dish.id} dish={dish} editing={editing === dish.id} locked={locked} {...rest} />
        ))}
      </ul>
    </li>
  );
}

function Review({ view, busy, onEdit, onChange, onRemoveDish, onUse, onSave, onBack, onMenu, showMenu }: { view: Stage<"review">; busy: boolean } & MenuSetupHandlers) {
  const nothing = view.missing.length === 0 && view.groups.length === 0;
  const rest = { onEdit, onChange, onRemoveDish, onUse };
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <Live text={view.error || view.sub} />
      {nothing ? null : <p className="nv-code-hint">{view.intro}</p>}
      {view.error ? (
        <p className="nv-error" role="alert">
          {view.error}
        </p>
      ) : null}

      {nothing ? (
        <p className="nv-empty">{MENU_EMPTY_REVIEW}</p>
      ) : (
        <ul className="nv-orders">
          {view.missing.length > 0 ? (
            <ReviewCard group={{ id: "missing", name: MENU_MISSING_HEADING, dishes: view.missing }} tone=" is-warn" editing={view.editing} locked={busy} {...rest} />
          ) : null}
          {view.groups.map((group) => (
            <ReviewCard key={group.id} group={group} tone="" editing={view.editing} locked={busy} {...rest} />
          ))}
        </ul>
      )}

      <button type="button" className="nv-btn is-ghost is-block" disabled={busy} onClick={onBack}>
        <NvIcon name="back" />
        {MENU_BACK}
      </button>

      {view.saveNote || view.canSave ? (
        <div className="nv-savebar">
          {view.saveNote ? <p className="nv-code-hint">{view.saveNote}</p> : null}
          {view.canSave ? (
            <button type="button" className="nv-btn is-green is-tall is-block" disabled={busy} aria-busy={busy || undefined} onClick={onSave}>
              <NvIcon name="check" />
              {busy ? MENU_SAVING : view.saveLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ cadastrado

function Done({ view, onMore, onSeeMenu }: { view: Stage<"done"> } & MenuSetupHandlers) {
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} />
      <Live text={[view.headline, view.detail].filter(Boolean).join(". ")} />
      <section className="nv-menu-done" aria-label={view.headline}>
        <span className="nv-menu-done-mark" aria-hidden="true">
          <NvIcon name="check" />
        </span>
        <h2 className="nv-lead">{view.headline}</h2>
        {view.detail ? <p className="nv-code-hint">{view.detail}</p> : null}
      </section>
      <div className="nv-menu-actions">
        {onSeeMenu ? (
          <button type="button" className="nv-btn is-green is-tall is-block" onClick={onSeeMenu}>
            <NvIcon name="fork" />
            {MENU_DONE_SEE}
          </button>
        ) : null}
        <button type="button" className="nv-btn is-ghost is-block" onClick={onMore}>
          <NvIcon name="plus" />
          {MENU_DONE_MORE}
        </button>
      </div>
    </>
  );
}

/**
 * Montar o cardápio: a porta (foto, arquivo, falar os pratos ou começar de um modelo), as páginas fotografadas, a leitura, o falar,
 * as três telas do modelo (o tipo, os pratos, os preços), a conferência e o cadastrado. Só desenha o que recebe; ler a foto, entender a fala e cadastrar são do servidor e da lógica testada.
 * Quem cadastra confere cada prato: o que está sem preço fica separado no alto e não entra no cadastro.
 */
export default function MenuSetup({ view, busy = false, ...handlers }: Props) {
  // A bolinha leva a pessoa a falar os pratos: na porta e no fim. Na tela de falar já existe o botão grande "Falar", e a bolinha cobriria a lixeira dos pratos;
  // onde há fotos ou conferência ela também fica de fora para não atrapalhar.
  const orb = view.stage === "door" || view.stage === "done";
  return (
    <div className="nv-root">
      <main className={`nv-screen nv-page-menu is-${view.stage}`}>
        {view.stage === "door" ? <Door view={view} {...handlers} /> : null}
        {view.stage === "pages" ? <Pages view={view} {...handlers} /> : null}
        {view.stage === "types" ? <ModelTypes view={view} {...handlers} /> : null}
        {view.stage === "pick" ? <ModelPick view={view} {...handlers} /> : null}
        {view.stage === "prices" ? <ModelPrices view={view} {...handlers} /> : null}
        {view.stage === "reading" ? <Reading view={view} {...handlers} /> : null}
        {view.stage === "speak" ? <Speak view={view} {...handlers} /> : null}
        {view.stage === "review" ? <Review view={view} busy={busy} {...handlers} /> : null}
        {view.stage === "done" ? <Done view={view} {...handlers} /> : null}
      </main>

      {orb ? (
        <div className="nv-dock is-float">
          <VoiceOrb label="Falar os pratos" onPress={handlers.onOrb} />
        </div>
      ) : null}
    </div>
  );
}
