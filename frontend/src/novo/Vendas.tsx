import "./novo.css";
import DictateButton from "./DictateButton";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import {
  SALES_ADD,
  SALES_ANOTHER,
  SALES_BACK,
  SALES_CHANNEL_TITLE,
  SALES_COPIED,
  SALES_COPY,
  SALES_FORGET,
  SALES_FORGET_ASK,
  SALES_FORGET_YES,
  SALES_FORM_CANCEL,
  SALES_FORM_CITY,
  SALES_FORM_DICTATE,
  SALES_FORM_EMAIL,
  SALES_FORM_INSTAGRAM,
  SALES_FORM_INTRO,
  SALES_FORM_KIND,
  SALES_FORM_NAME,
  SALES_FORM_NEIGHBORHOOD,
  SALES_FORM_NOTE,
  SALES_FORM_PASTE,
  SALES_FORM_PERSON,
  SALES_FORM_PHONE,
  SALES_FORM_READ,
  SALES_FORM_READING,
  SALES_FORM_SAVE,
  SALES_FORM_SAVING,
  SALES_FORM_SEEN,
  SALES_FORM_SEEN_HINT,
  SALES_FORM_SITE,
  SALES_FORM_SOURCE,
  SALES_FORM_SOURCE_HINT,
  SALES_FORM_SOURCE_PLACEHOLDER,
  SALES_FORM_TITLE,
  SALES_FUNNEL_EMPTY,
  SALES_FUNNEL_TITLE,
  SALES_INTRO,
  SALES_LESS,
  SALES_LOADING,
  SALES_MANUAL,
  SALES_MORE,
  SALES_NO_ASK,
  SALES_NO_CHANNEL,
  SALES_NO_CHANNEL_CLOSE,
  SALES_NO_CONFIRM,
  SALES_NO_YES,
  SALES_OPEN_HINT,
  SALES_REPLY_ASK,
  SALES_REPLY_BUTTON,
  SALES_REPLY_LATER,
  SALES_RETRY,
  SALES_SCRIPT_TITLE,
  SALES_SENDER_HINT,
  SALES_SENDER_LABEL,
  SALES_SOURCES_TITLE,
  SALES_STAGE_TITLE,
  SALES_TITLE,
  SALES_TODAY_EMPTY,
  SALES_TODAY_TITLE,
  SALES_WAITING_EMPTY,
  SALES_WAITING_HINT,
  SALES_WAITING_TITLE,
  SALES_CLOSE,
} from "./vendasCopy";
import type { SalesCardView, SalesFormValues, SalesView } from "./types";

export type SalesHandlers = {
  onRetry?: () => void;
  onSender?: (text: string) => void;
  onAdd?: () => void;
  onChannel?: (id: string, channel: string) => void;
  onCopy?: (id: string) => void;
  onAnother?: (id: string) => void;
  onSent?: (id: string) => void;
  onAskReply?: (id: string) => void;
  onReply?: (id: string, result: string) => void;
  onStage?: (id: string, stage: string) => void;
  onMore?: (id: string) => void;
  onAskConfirm?: (id: string, kind: "nao_quer" | "apagar") => void;
  onCancelConfirm?: (id: string) => void;
  onConfirmNo?: (id: string) => void;
  onConfirmForget?: (id: string) => void;
  onField?: (field: keyof SalesFormValues, value: string) => void;
  onRead?: () => void;
  onSave?: () => void;
  onCancelForm?: () => void;
};

type Props = SalesHandlers & {
  view: SalesView;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

function Card({ card, handlers, list }: { card: SalesCardView; handlers: SalesHandlers; list: "today" | "waiting" }) {
  const draft = card.draft;
  const titleId = `nv-sale-${list}-${card.id}`;
  const external = draft?.openHref?.startsWith("https:") ?? false;
  return (
    <li className="nv-order nv-sale" aria-labelledby={titleId}>
      <div className="nv-sale-head">
        <h3 className="nv-sale-name" id={titleId}>
          {card.name}
        </h3>
        <span className="nv-order-chip">{card.stage}</span>
      </div>
      {card.meta ? <p className="nv-sale-meta">{card.meta}</p> : null}
      <p className="nv-sale-contact">{card.contact}</p>
      <p className="nv-sale-origin">{card.origin}</p>
      {card.line ? <p className="nv-sale-line">{card.line}</p> : null}
      {card.timing ? <p className={`nv-sale-time${card.goodTime ? " is-good" : ""}`}>{card.timing}</p> : null}

      {card.noChannel ? (
        <div className="nv-sale-box">
          <p className="nv-hint">{SALES_NO_CHANNEL}</p>
          <p className="nv-hint">{SALES_NO_CHANNEL_CLOSE}</p>
        </div>
      ) : null}

      {draft ? (
        <div className="nv-sale-box">
          {draft.channels.length > 0 ? (
            <div className="nv-sale-chans" role="group" aria-label={SALES_CHANNEL_TITLE}>
              {draft.channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  className={`nv-sale-chan${channel.selected ? " is-on" : ""}`}
                  aria-pressed={channel.selected}
                  onClick={() => handlers.onChannel?.(card.id, channel.id)}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          ) : null}
          {draft.subject ? (
            <p className="nv-sale-subject">
              <strong>Assunto:</strong> {draft.subject}
            </p>
          ) : null}
          {draft.text ? <p className="nv-share-bubble">{draft.text}</p> : null}
          {draft.script.length > 0 ? (
            <>
              <h4 className="nv-share-sub">{SALES_SCRIPT_TITLE}</h4>
              <ol className="nv-sale-script">
                {draft.script.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
          {draft.openHref ? (
            <a className="nv-btn is-fire is-block" href={draft.openHref} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              <NvIcon name={draft.channel === "ligacao" ? "phone" : "chat"} />
              {draft.openLabel}
            </a>
          ) : null}
          {draft.openHref && draft.channel !== "ligacao" ? <p className="nv-code-hint">{SALES_OPEN_HINT}</p> : null}
          <div className="nv-share-pair">
            <button type="button" className="nv-btn is-ghost is-small" onClick={() => handlers.onCopy?.(card.id)}>
              <NvIcon name={draft.copied ? "check" : "copy"} />
              {draft.copied ? SALES_COPIED : SALES_COPY}
            </button>
            {draft.text || draft.script.length > 0 ? (
              <button type="button" className="nv-btn is-ghost is-small" onClick={() => handlers.onAnother?.(card.id)}>
                <NvIcon name="sparkle" />
                {SALES_ANOTHER}
              </button>
            ) : null}
          </div>
          {draft.manual ? (
            <div className="nv-share-manual">
              <p className="nv-hint">{SALES_MANUAL}</p>
              <textarea readOnly rows={5} value={draft.manual} aria-label="Texto para copiar" onFocus={(event) => event.currentTarget.select()} />
            </div>
          ) : null}
        </div>
      ) : null}

      {card.canMarkSent ? (
        <button type="button" className="nv-btn is-green is-block" disabled={card.busy} onClick={() => handlers.onSent?.(card.id)}>
          <NvIcon name="check" />
          {card.sendLabel}
        </button>
      ) : null}
      {card.canClose ? (
        <button type="button" className="nv-btn is-ghost is-block" disabled={card.busy} onClick={() => handlers.onStage?.(card.id, "sem_resposta")}>
          {SALES_CLOSE}
        </button>
      ) : null}

      <div className="nv-share-pair">
        <button type="button" className="nv-btn is-ghost is-small" aria-expanded={card.replyOpen} disabled={card.busy} onClick={() => handlers.onAskReply?.(card.id)}>
          <NvIcon name="chat" />
          {SALES_REPLY_BUTTON}
        </button>
        <button type="button" className="nv-btn is-ghost is-small" aria-expanded={card.moreOpen} disabled={card.busy} onClick={() => handlers.onMore?.(card.id)}>
          {card.moreOpen ? SALES_LESS : SALES_MORE}
        </button>
      </div>

      {card.replyOpen && !card.confirm ? (
        <div className="nv-sale-box" role="group" aria-label={SALES_REPLY_ASK}>
          <h4 className="nv-share-sub">{SALES_REPLY_ASK}</h4>
          {card.replies.map((reply) => (
            <button key={reply.id} type="button" className="nv-btn is-ghost is-block" disabled={card.busy} onClick={() => handlers.onReply?.(card.id, reply.id)}>
              {reply.label}
            </button>
          ))}
          <button type="button" className="nv-btn is-ghost is-block" disabled={card.busy} onClick={() => handlers.onAskConfirm?.(card.id, "nao_quer")}>
            {SALES_NO_CONFIRM}
          </button>
          <button type="button" className="nv-link" onClick={() => handlers.onAskReply?.(card.id)}>
            {SALES_REPLY_LATER}
          </button>
        </div>
      ) : null}

      {card.moreOpen && !card.confirm ? (
        <div className="nv-sale-box">
          {card.stages.length > 0 ? (
            <>
              <h4 className="nv-share-sub">{SALES_STAGE_TITLE}</h4>
              {card.stages.map((stage) => (
                <button key={stage.id} type="button" className="nv-btn is-ghost is-block" disabled={card.busy} onClick={() => handlers.onStage?.(card.id, stage.id)}>
                  {stage.label}
                </button>
              ))}
            </>
          ) : null}
          <button type="button" className="nv-btn is-ghost is-block" disabled={card.busy} onClick={() => handlers.onAskConfirm?.(card.id, "apagar")}>
            <NvIcon name="trash" />
            {SALES_FORGET}
          </button>
        </div>
      ) : null}

      {card.confirm === "nao_quer" || card.confirm === "apagar" ? (
        <div className="nv-sale-box is-warn" role="alertdialog" aria-label={card.confirm === "nao_quer" ? SALES_NO_CONFIRM : SALES_FORGET} aria-describedby={`${titleId}-ask`}>
          <p className="nv-sale-ask" id={`${titleId}-ask`}>
            {card.confirm === "nao_quer" ? SALES_NO_ASK : SALES_FORGET_ASK}
          </p>
          <button
            type="button"
            className="nv-btn is-alert is-block"
            disabled={card.busy}
            onClick={() => (card.confirm === "nao_quer" ? handlers.onConfirmNo?.(card.id) : handlers.onConfirmForget?.(card.id))}
          >
            {card.confirm === "nao_quer" ? SALES_NO_YES : SALES_FORGET_YES}
          </button>
          <button type="button" className="nv-btn is-ghost is-block" onClick={() => handlers.onCancelConfirm?.(card.id)}>
            {SALES_BACK}
          </button>
        </div>
      ) : null}

      {card.error ? (
        <p className="nv-error" role="alert">
          {card.error}
        </p>
      ) : null}
    </li>
  );
}

function Field({ id, label, value, onChange, hint, type = "text", autoComplete = "off", inputMode }: { id: string; label: string; value: string; onChange: (value: string) => void; hint?: string; type?: string; autoComplete?: string; inputMode?: "text" | "tel" | "email" | "url" }) {
  return (
    <div className="nv-sale-fieldrow">
      <label className="nv-sale-label" htmlFor={id}>
        {label}
      </label>
      <div className="nv-field">
        <input id={id} type={type} value={value} autoComplete={autoComplete} inputMode={inputMode} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(event) => onChange(event.currentTarget.value)} />
      </div>
      {hint ? (
        <p className="nv-code-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({ id, label, value, onChange, options, placeholder, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; placeholder?: string; hint?: string }) {
  return (
    <div className="nv-sale-fieldrow">
      <label className="nv-sale-label" htmlFor={id}>
        {label}
      </label>
      <div className="nv-field is-select">
        <select id={id} value={value} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(event) => onChange(event.currentTarget.value)}>
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <NvIcon name="chevron" />
      </div>
      {hint ? (
        <p className="nv-code-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Form({ view, handlers }: { view: NonNullable<SalesView["form"]>; handlers: SalesHandlers }) {
  const values = view.values;
  const set = (field: keyof SalesFormValues) => (value: string) => handlers.onField?.(field, value);
  return (
    <section className="nv-order nv-sale-form" aria-labelledby="nv-sale-form-title">
      <h2 className="nv-h2" id="nv-sale-form-title">
        {SALES_FORM_TITLE}
      </h2>
      <p className="nv-code-hint">{SALES_FORM_INTRO}</p>

      <div className="nv-sale-fieldrow">
        <label className="nv-sale-label" htmlFor="nv-sale-paste">
          {SALES_FORM_PASTE}
        </label>
        <div className="nv-field is-area">
          <textarea id="nv-sale-paste" rows={4} value={values.paste} onChange={(event) => set("paste")(event.currentTarget.value)} />
          <DictateButton id="nv-sale-paste" label={SALES_FORM_DICTATE} append value={values.paste} max={2000} onText={set("paste")} />
        </div>
      </div>
      <button type="button" className="nv-btn is-ghost is-block" disabled={view.reading || !values.paste.trim()} onClick={handlers.onRead}>
        <NvIcon name="sparkle" />
        {view.reading ? SALES_FORM_READING : SALES_FORM_READ}
      </button>
      {view.readNote ? (
        <p className="nv-hint nv-sale-readnote" role="status">
          {view.readNote}
        </p>
      ) : null}

      <Field id="nv-sale-name" label={SALES_FORM_NAME} value={values.name} onChange={set("name")} />
      <Select id="nv-sale-kind" label={SALES_FORM_KIND} value={values.kind} onChange={set("kind")} options={view.kinds} />
      <Field id="nv-sale-city" label={SALES_FORM_CITY} value={values.city} onChange={set("city")} autoComplete="address-level2" />
      <Field id="nv-sale-neighborhood" label={SALES_FORM_NEIGHBORHOOD} value={values.neighborhood} onChange={set("neighborhood")} />
      <Field id="nv-sale-person" label={SALES_FORM_PERSON} value={values.person} onChange={set("person")} />
      <Field id="nv-sale-phone" label={SALES_FORM_PHONE} value={values.phone} onChange={set("phone")} type="tel" inputMode="tel" />
      <Field id="nv-sale-email" label={SALES_FORM_EMAIL} value={values.email} onChange={set("email")} type="email" inputMode="email" />
      <Field id="nv-sale-instagram" label={SALES_FORM_INSTAGRAM} value={values.instagram} onChange={set("instagram")} />
      <Field id="nv-sale-site" label={SALES_FORM_SITE} value={values.site} onChange={set("site")} inputMode="url" />
      <Select id="nv-sale-source" label={SALES_FORM_SOURCE} value={values.source} onChange={set("source")} options={view.sources} placeholder={SALES_FORM_SOURCE_PLACEHOLDER} hint={SALES_FORM_SOURCE_HINT} />
      <Field id="nv-sale-seen" label={SALES_FORM_SEEN} value={values.seen} onChange={set("seen")} hint={SALES_FORM_SEEN_HINT} />
      <Field id="nv-sale-note" label={SALES_FORM_NOTE} value={values.note} onChange={set("note")} />

      {view.error ? (
        <p className="nv-error" role="alert">
          {view.error}
        </p>
      ) : null}
      <button type="button" className="nv-btn is-green is-block" disabled={view.saving} onClick={handlers.onSave}>
        <NvIcon name="check" />
        {view.saving ? SALES_FORM_SAVING : SALES_FORM_SAVE}
      </button>
      <button type="button" className="nv-btn is-ghost is-block" disabled={view.saving} onClick={handlers.onCancelForm}>
        {SALES_FORM_CANCEL}
      </button>
    </section>
  );
}

/**
 * Vendas: o caderno do dono do sistema para conquistar restaurantes. Mostra quem procurar hoje, o rascunho do que escrever
 * (que abre o WhatsApp ou o e-mail com o texto pronto), quem espera resposta e o caminho de cada negócio até pagar.
 * **Nada é enviado por aqui**: a pessoa confere, manda ela mesma e só então toca em "Já mandei".
 */
export default function Vendas({ view, onMenu, showMenu = false, ...handlers }: Props) {
  const ready = view.load === "ready";
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-sales">
        <TopBar title={SALES_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-sales-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        <p className="nv-code-hint">{SALES_INTRO}</p>

        {view.load === "loading" ? <p className="nv-empty">{SALES_LOADING}</p> : null}
        {view.load === "error" ? (
          <>
            <p className="nv-error" role="alert">
              {view.error}
            </p>
            <button type="button" className="nv-btn is-ghost is-block" onClick={handlers.onRetry}>
              {SALES_RETRY}
            </button>
          </>
        ) : null}

        {ready && view.notes.length > 0 ? (
          <div className="nv-sale-notes">
            {view.notes.map((note) => (
              <p key={note} className="nv-sale-note">
                {note}
              </p>
            ))}
          </div>
        ) : null}

        {ready && view.saved ? (
          <p className="nv-hint nv-sale-saved" role="status">
            {view.saved}
          </p>
        ) : null}

        {ready && view.form ? <Form view={view.form} handlers={handlers} /> : null}
        {ready && !view.form ? (
          <button type="button" className="nv-btn is-fire is-block" onClick={handlers.onAdd}>
            <NvIcon name="plus" />
            {SALES_ADD}
          </button>
        ) : null}

        {ready ? (
          <div className="nv-sale-sender">
            <label className="nv-sale-label" htmlFor="nv-sale-sender">
              {SALES_SENDER_LABEL}
            </label>
            <div className="nv-field">
              <input id="nv-sale-sender" type="text" value={view.sender} maxLength={30} autoComplete="given-name" aria-describedby="nv-sale-sender-hint" onChange={(event) => handlers.onSender?.(event.currentTarget.value)} />
            </div>
            <p className="nv-code-hint" id="nv-sale-sender-hint">
              {SALES_SENDER_HINT}
            </p>
          </div>
        ) : null}

        {ready ? (
          <section className="nv-sale-section" aria-labelledby="nv-sale-today">
            <h2 className="nv-h2" id="nv-sale-today">
              {SALES_TODAY_TITLE}
            </h2>
            {view.today.length === 0 ? <p className="nv-empty">{SALES_TODAY_EMPTY}</p> : null}
            <ul className="nv-sale-list">
              {view.today.map((card) => (
                <Card key={card.id} card={card} handlers={handlers} list="today" />
              ))}
            </ul>
            {view.todayMore ? <p className="nv-hint">{view.todayMore}</p> : null}
          </section>
        ) : null}

        {ready ? (
          <section className="nv-sale-section" aria-labelledby="nv-sale-waiting">
            <h2 className="nv-h2" id="nv-sale-waiting">
              {SALES_WAITING_TITLE}
            </h2>
            <p className="nv-code-hint">{SALES_WAITING_HINT}</p>
            {view.waiting.length === 0 ? <p className="nv-empty">{SALES_WAITING_EMPTY}</p> : null}
            <ul className="nv-sale-list">
              {view.waiting.map((card) => (
                <Card key={card.id} card={card} handlers={handlers} list="waiting" />
              ))}
            </ul>
            {view.waitingMore ? <p className="nv-hint">{view.waitingMore}</p> : null}
          </section>
        ) : null}

        {ready ? (
          <section className="nv-sale-section" aria-labelledby="nv-sale-funnel">
            <h2 className="nv-h2" id="nv-sale-funnel">
              {SALES_FUNNEL_TITLE}
            </h2>
            {view.funnel.total === 0 ? (
              <p className="nv-empty">{SALES_FUNNEL_EMPTY}</p>
            ) : (
              <>
                <ul className="nv-sale-funnel">
                  {view.funnel.stages.map((stage) => (
                    <li key={stage.id}>
                      <span className="nv-sale-funnel-label">{stage.label}</span>
                      <span className="nv-sale-funnel-bar" aria-hidden="true">
                        <i style={{ width: `${stage.share}%`, minWidth: stage.share > 0 ? undefined : 0 }} />
                      </span>
                      <b>{stage.count}</b>
                    </li>
                  ))}
                </ul>
                {view.funnel.sources.length > 0 ? (
                  <>
                    <h3 className="nv-share-sub">{SALES_SOURCES_TITLE}</h3>
                    <ul className="nv-sale-sources">
                      {view.funnel.sources.map((source) => (
                        <li key={source.id}>
                          <strong>{source.label}</strong>
                          <span>{source.line}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </main>

      <div className="nv-dock">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
