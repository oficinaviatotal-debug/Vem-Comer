import type { ChangeEvent, ReactNode } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { Spinner, TopBar } from "./parts";
import {
  LOGO_ADJUSTED,
  LOGO_ADJUSTED_ALT,
  LOGO_AS_SEEN,
  LOGO_BACK,
  LOGO_CANCEL,
  LOGO_FRAME_ALT,
  LOGO_FRAME_NONE,
  LOGO_LISTENING,
  LOGO_LOADING,
  LOGO_MAKER_SAVE,
  LOGO_NAME_LABEL,
  LOGO_NEXT,
  LOGO_OTHER_PICK,
  LOGO_OTHER_TAKE,
  LOGO_PICK,
  LOGO_PREV,
  LOGO_REMOVE,
  LOGO_REMOVE_ARMED,
  LOGO_RETRY,
  LOGO_REVIEW_NOT_SAVED,
  LOGO_REVIEW_TITLE,
  LOGO_SAVING,
  LOGO_SAY_FOOD,
  LOGO_SAY_FOOD_EXAMPLE,
  LOGO_SAY_NAME,
  LOGO_SAY_NAME_EXAMPLE,
  LOGO_SENT,
  LOGO_SENT_ALT,
  LOGO_TAKE,
  LOGO_USE,
  LOGO_USE_ADJUSTED,
  LOGO_USE_ORIGINAL,
} from "./copy";
import type { LogoHomeView, LogoMakerView, LogoReviewView, LogoView } from "./types";

export type LogoHandlers = {
  /** A imagem da logomarca: tirada na hora ou escolhida no celular (na tela de início e na de "Ficou bom?"). */
  onFile?: (file: File) => void;
  onMake?: () => void;
  /** Remover: o primeiro toque só arma, o segundo remove (quem decide é o container). */
  onRemove?: () => void;
  onBack?: () => void;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
  onRetry?: () => void;
  /** "Sim, usar esta": salva a que está à mostra. */
  onUse?: () => void;
  onToggleRefined?: () => void;
  onCancel?: () => void;
  onFood?: (id: string) => void;
  onPalette?: (id: string) => void;
  onModel?: (id: string) => void;
  onName?: (value: string) => void;
  /** A bolinha de falar: `target` diz o que está sendo dito (o que vende ou o nome). */
  onMic?: (target: "food" | "name") => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSave?: () => void;
};

/**
 * Os desenhos da logomarca (feitos num canvas pelo container): o tipo de comida, a prévia e cada modelo. A tela só guarda o
 * lugar deles; sem o desenho (na conferência), o botão aparece só com o nome.
 */
export type LogoPictures = {
  food?: (id: string) => ReactNode;
  live?: () => ReactNode;
  model?: (id: string, label: string) => ReactNode;
};

type Props = { view: LogoView; pictures?: LogoPictures } & LogoHandlers;

/** Um campo de arquivo dentro de um botão: o toque no rótulo abre a câmera (`camera`) ou os arquivos do celular. */
function FileButton({ camera, label, icon, tone, small, disabled, onFile }: { camera: boolean; label: string; icon: "camera" | "image"; tone: "is-green" | "is-ghost"; small?: boolean; disabled: boolean; onFile?: (file: File) => void }) {
  const take = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Limpa o campo: escolher a mesma imagem outra vez também funciona.
    event.target.value = "";
    if (file) onFile?.(file);
  };
  return (
    <label className={`nv-btn nv-filebtn ${tone} is-block${small ? " is-small" : ""}${disabled ? " is-off" : ""}`} aria-disabled={disabled || undefined}>
      <NvIcon name={icon} />
      {label}
      <input className="nv-sr" type="file" accept="image/*" capture={camera ? "environment" : undefined} disabled={disabled} onChange={take} />
    </label>
  );
}

function Notice({ notice }: { notice: { ok: boolean; text: string } | null }) {
  if (!notice) return null;
  return notice.ok ? (
    <p className="nv-ok" aria-hidden="true">
      {notice.text}
    </p>
  ) : (
    <p className="nv-error" role="alert">
      {notice.text}
    </p>
  );
}

function Home({ home, on }: { home: LogoHomeView; on: LogoHandlers }) {
  const wait = home.working !== "";
  return (
    <>
      {/* O que o cliente vê agora. Só informa: liso, sem relevo. */}
      <div className={`nv-logoframe${home.hasLogo ? "" : " is-none"}`}>
        {home.hasLogo ? (
          <img src={home.logoSrc} alt={LOGO_FRAME_ALT} />
        ) : (
          <span className="nv-logoframe-none">
            <NvIcon name="brand" />
            {LOGO_FRAME_NONE}
          </span>
        )}
      </div>
      <p className="nv-logolead">{home.lead}</p>
      <p className="nv-code-hint">{home.next}</p>

      {wait ? (
        <p className="nv-working" aria-hidden="true">
          <Spinner />
          {home.working}
        </p>
      ) : null}
      <Notice notice={home.notice} />

      <div className="nv-logoacts">
        <FileButton camera label={LOGO_TAKE} icon="camera" tone="is-green" disabled={wait} onFile={on.onFile} />
        <FileButton camera={false} label={LOGO_PICK} icon="image" tone="is-ghost" disabled={wait} onFile={on.onFile} />
        <button type="button" id="nv-logo-make" className="nv-btn is-ghost is-block" disabled={wait} onClick={on.onMake}>
          <NvIcon name="sparkle" />
          {home.makeLabel}
        </button>
        {home.hasLogo ? (
          <button type="button" className={`nv-btn is-ghost is-block${home.removeArmed ? " is-armed" : ""}`} disabled={wait} onClick={on.onRemove}>
            <NvIcon name="trash" />
            {home.removeArmed ? LOGO_REMOVE_ARMED : LOGO_REMOVE}
          </button>
        ) : null}
      </div>

      <p className="nv-code-hint">{home.tip}</p>
      <button type="button" className="nv-btn is-ghost is-block" disabled={wait} onClick={on.onBack}>
        <NvIcon name="back" />
        {LOGO_BACK}
      </button>
    </>
  );
}

function Review({ review, on }: { review: LogoReviewView; on: LogoHandlers }) {
  const refined = review.refinedSrc !== "";
  return (
    <>
      <h2 className="nv-logoask">{LOGO_REVIEW_TITLE}</h2>
      <p className="nv-code-hint">{review.lead}</p>

      <div className="nv-logocompare">
        <figure>
          <div className="nv-logoframe">{review.originalSrc ? <img src={review.originalSrc} alt={LOGO_SENT_ALT} /> : null}</div>
          <figcaption>{LOGO_SENT}</figcaption>
        </figure>
        {refined ? (
          <figure>
            <div className="nv-logoframe">
              <img src={review.refinedSrc} alt={LOGO_ADJUSTED_ALT} />
            </div>
            <figcaption>{LOGO_ADJUSTED}</figcaption>
          </figure>
        ) : null}
      </div>

      {/* Como o cliente vê: o selo redondo e branco ao lado do nome, como no alto do cardápio. Só informa. */}
      <div className="nv-logoseen" role="group" aria-label={LOGO_AS_SEEN}>
        <span className="nv-logobadge">{review.shownSrc ? <img src={review.shownSrc} alt="" /> : null}</span>
        <strong>{review.restaurant}</strong>
      </div>
      <p className="nv-code-hint">{LOGO_AS_SEEN}</p>

      {review.warnings.map((warning) => (
        <p key={warning} className="nv-logowarn" role="alert">
          {warning}
        </p>
      ))}
      {review.error ? (
        <p className="nv-error" role="alert">
          {review.error}
        </p>
      ) : null}

      <div className="nv-logoacts">
        <p className="nv-code-hint">{LOGO_REVIEW_NOT_SAVED}</p>
        <button type="button" id="nv-logo-use" className="nv-btn is-green is-tall is-block" disabled={review.busy} aria-busy={review.saving || undefined} onClick={on.onUse}>
          <NvIcon name="check" />
          {review.saving ? LOGO_SAVING : LOGO_USE}
        </button>
        {refined ? (
          <button type="button" className="nv-btn is-ghost is-small is-block" disabled={review.busy} onClick={on.onToggleRefined}>
            {review.useRefined ? LOGO_USE_ORIGINAL : LOGO_USE_ADJUSTED}
          </button>
        ) : null}
        <FileButton camera label={LOGO_OTHER_TAKE} icon="camera" tone="is-ghost" small disabled={review.busy} onFile={on.onFile} />
        <FileButton camera={false} label={LOGO_OTHER_PICK} icon="image" tone="is-ghost" small disabled={review.busy} onFile={on.onFile} />
        <button type="button" className="nv-btn is-ghost is-small is-block" disabled={review.busy} onClick={on.onCancel}>
          {LOGO_CANCEL}
        </button>
      </div>
    </>
  );
}

/** O botão grande de falar e o que ele ouviu. O dizer do sistema fica numa região que já existia, para o leitor de tela anunciar. */
function Voice({ maker, target, label, example, on }: { maker: LogoMakerView; target: "food" | "name"; label: string; example: string; on: LogoHandlers }) {
  const mine = maker.listening === target;
  return (
    <div className="nv-logovoice">
      {maker.canListen ? (
        <button
          type="button"
          className={`nv-btn ${target === "food" ? "is-fire is-tall" : "is-ghost is-small"} is-block nv-mic${mine ? " is-listening" : ""}`}
          aria-pressed={mine}
          disabled={maker.saving || (maker.listening !== "" && !mine)}
          onClick={() => on.onMic?.(target)}
        >
          <NvIcon name="mic" />
          {mine ? LOGO_LISTENING : label}
        </button>
      ) : null}
      {mine ? (
        <p className="nv-heard" aria-hidden="true">
          {maker.heard || example}
        </p>
      ) : null}
      <p className="nv-code-hint nv-logosaid" role="status" aria-live="polite">
        {mine ? "" : maker.said}
      </p>
    </div>
  );
}

function Maker({ maker, pictures, on }: { maker: LogoMakerView; pictures?: LogoPictures; on: LogoHandlers }) {
  return (
    <>
      <p className="nv-code-label">{maker.stepText}</p>
      <h2 className="nv-logoask" id="nv-logo-q">
        {maker.question}
      </h2>
      {maker.help ? <p className="nv-code-hint">{maker.help}</p> : null}

      {maker.step === 1 ? (
        <>
          <Voice maker={maker} target="food" label={LOGO_SAY_FOOD} example={LOGO_SAY_FOOD_EXAMPLE} on={on} />
          <div className="nv-logogrid" role="radiogroup" aria-labelledby="nv-logo-q">
            {maker.foods.map((food) => (
              <button key={food.id} type="button" role="radio" aria-checked={food.picked} className="nv-logopick" onClick={() => on.onFood?.(food.id)}>
                {pictures?.food ? pictures.food(food.id) : null}
                <span>{food.label}</span>
                {food.hint ? <span className="nv-logopick-guess">{food.hint}</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {maker.step === 2 ? (
        <>
          {pictures?.live ? <div className="nv-logolive">{pictures.live()}</div> : null}
          <div className="nv-logogrid" role="radiogroup" aria-labelledby="nv-logo-q">
            {maker.palettes.map((palette) => (
              <button key={palette.id} type="button" role="radio" aria-checked={palette.picked} className="nv-logopick" onClick={() => on.onPalette?.(palette.id)}>
                <span className="nv-logoswatch" style={{ background: palette.color }} aria-hidden="true" />
                <span>{palette.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {maker.step === 3 ? (
        <>
          <div className="nv-dishform-field">
            <label className="nv-code-label" htmlFor="nv-logo-name">
              {LOGO_NAME_LABEL}
            </label>
            <div className="nv-field">
              <input id="nv-logo-name" value={maker.name} maxLength={40} autoComplete="off" enterKeyHint="done" onChange={(event) => on.onName?.(event.target.value)} />
            </div>
            <p className="nv-code-hint">{maker.nameHelp}</p>
          </div>
          <Voice maker={maker} target="name" label={LOGO_SAY_NAME} example={LOGO_SAY_NAME_EXAMPLE} on={on} />
          {maker.cutNote ? (
            <p className="nv-logowarn" role="status">
              {maker.cutNote}
            </p>
          ) : null}
          <div className="nv-logogrid is-two" role="radiogroup" aria-labelledby="nv-logo-q">
            {maker.models.map((model) => (
              <button key={model.id} type="button" role="radio" aria-checked={model.picked} aria-label={model.label} className="nv-logopick is-model" onClick={() => on.onModel?.(model.id)}>
                {pictures?.model ? pictures.model(model.id, model.label) : <span>{model.label}</span>}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {maker.error ? (
        <p className="nv-error" role="alert">
          {maker.error}
        </p>
      ) : null}

      <div className="nv-savebar">
        {maker.nextHint ? <p className="nv-code-hint">{maker.nextHint}</p> : null}
        {maker.step === 3 ? (
          <button type="button" id="nv-logo-save" className="nv-btn is-green is-tall is-block" disabled={maker.saving} aria-busy={maker.saving || undefined} onClick={on.onSave}>
            <NvIcon name="check" />
            {maker.saving ? LOGO_SAVING : LOGO_MAKER_SAVE}
          </button>
        ) : (
          <button type="button" id="nv-logo-next" className="nv-btn is-green is-tall is-block" disabled={!maker.canNext} onClick={on.onNext}>
            {LOGO_NEXT}
          </button>
        )}
        <button type="button" className="nv-btn is-ghost is-small is-block" disabled={maker.saving} onClick={maker.step === 1 ? on.onCancel : on.onPrev}>
          <NvIcon name="back" />
          {maker.step === 1 ? LOGO_CANCEL : LOGO_PREV}
        </button>
      </div>
    </>
  );
}

/**
 * A logomarca do restaurante: o que o cliente vê agora e três jeitos de trocar (tirar foto, escolher do celular, criar uma
 * em três toques). Nada vale até a pessoa dizer "sim" em "Ficou bom?" ou tocar em "Usar esta logomarca". Os botões são em
 * relevo (tocar); a logomarca e o "como o cliente vê" são lisos (só informam); o nome é um campo afundado (escrever).
 * A tela sempre diz o que falta e o que fazer em seguida.
 */
export default function Logo({ view, pictures, ...on }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-logo">
        <TopBar title={view.title} sub={view.sub} onMenu={on.onMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-logo-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        {view.stage === "loading" ? (
          <>
            <p className="nv-working is-big" aria-hidden="true">
              <Spinner />
              {LOGO_LOADING}
            </p>
            <button type="button" className="nv-btn is-ghost is-block" onClick={on.onBack}>
              <NvIcon name="back" />
              {LOGO_BACK}
            </button>
          </>
        ) : null}

        {view.stage === "error" ? (
          <>
            <p className="nv-error" role="alert">
              {view.error}
            </p>
            <button type="button" className="nv-btn is-green is-block" onClick={on.onRetry}>
              {LOGO_RETRY}
            </button>
            <button type="button" className="nv-btn is-ghost is-block" onClick={on.onBack}>
              <NvIcon name="back" />
              {LOGO_BACK}
            </button>
          </>
        ) : null}

        {view.stage === "home" && view.home ? <Home home={view.home} on={on} /> : null}
        {view.stage === "review" && view.review ? <Review review={view.review} on={on} /> : null}
        {view.stage === "maker" && view.maker ? <Maker maker={view.maker} pictures={pictures} on={on} /> : null}
      </main>
    </div>
  );
}
