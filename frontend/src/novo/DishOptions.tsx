import { useState, type FormEvent } from "react";
import "./novo.css";
import DictateButton from "./DictateButton";
import NvIcon from "./Icons";
import { Spinner, TopBar } from "./parts";
import {
  OPT_ADD_ITEM,
  OPT_AT_LEAST,
  OPT_BACK,
  OPT_BACK_ARMED,
  OPT_CHECK_BELOW,
  OPT_CLOSE_NOTICE,
  OPT_GONE,
  OPT_GROUP_NAME,
  OPT_GROUP_NAME_HINT,
  OPT_HAVE,
  OPT_HOW_MANY,
  OPT_ITEM_NAME_HINT,
  OPT_ITEM_PRICE_HINT,
  OPT_LOADING,
  OPT_MIC,
  OPT_MIC_LISTENING,
  OPT_MIC_OFF,
  OPT_NO,
  OPT_NOTE,
  OPT_PROBLEMS,
  OPT_REMOVE_GROUP,
  OPT_REMOVE_GROUP_ARMED,
  OPT_REQUIRED_Q,
  OPT_RETRY,
  OPT_SAVE,
  OPT_SAVING,
  OPT_SAY_EXAMPLE,
  OPT_TYPE_HINT,
  OPT_TYPE_LABEL,
  OPT_UNDERSTOOD,
  OPT_YES,
  OPT_YOU_SAID,
  DICTATE_OPT_GROUP,
  DICTATE_OPT_ITEM,
  DICTATE_OPT_TEXT,
} from "./copy";
import type { DishOptionsView, OptionGroupView } from "./types";

export type DishOptionsHandlers = {
  /** Tocar na bolinha grande: começa a ouvir, ou para e usa o que já foi ouvido. */
  onMic?: () => void;
  /** O que foi escrito na caixa de baixo, para virar grupos. */
  onText?: (text: string) => void;
  onCloseSaid?: () => void;
  onStarter?: (kind: string) => void;
  onGroupName?: (group: string, value: string) => void;
  onRequired?: (group: string, required: boolean) => void;
  onMax?: (group: string, delta: 1 | -1) => void;
  onMin?: (group: string, delta: 1 | -1) => void;
  onItemName?: (group: string, item: string, value: string) => void;
  onItemPrice?: (group: string, item: string, value: string) => void;
  onItemFlip?: (group: string, item: string) => void;
  onAddItem?: (group: string) => void;
  onRemoveItem?: (group: string, item: string) => void;
  onRemoveGroup?: (group: string) => void;
  onSave?: () => void;
  onBack?: () => void;
  onRetry?: () => void;
};

type Props = { view: DishOptionsView } & DishOptionsHandlers;

/** O menos e o mais de um número (pode escolher até, pelo menos). Só tocam; o número no meio informa. */
function Stepper({ label, value, canLess, canMore, onLess, onMore, id }: { label: string; value: number; canLess: boolean; canMore: boolean; onLess?: () => void; onMore?: () => void; id: string }) {
  return (
    <div className="nv-optrow" role="group" aria-labelledby={id}>
      <span className="nv-optrow-label" id={id}>
        {label}
      </span>
      <span className="nv-step nv-optstep">
        <button type="button" aria-label={`Menos: ${label}`} disabled={!canLess} onClick={onLess}>
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={`Mais: ${label}`} disabled={!canMore} onClick={onMore}>
          +
        </button>
      </span>
    </div>
  );
}

function GroupCard({ group, onGroupName, onRequired, onMax, onMin, onItemName, onItemPrice, onItemFlip, onAddItem, onRemoveItem, onRemoveGroup }: { group: OptionGroupView } & DishOptionsHandlers) {
  const label = group.name.trim() || `grupo ${group.position}`;
  return (
    <li className="nv-order nv-optgroup" aria-label={label}>
      <div className="nv-dishform-field">
        <label className="nv-code-label" htmlFor={`nv-opt-name-${group.uid}`}>
          {OPT_GROUP_NAME}
        </label>
        <div className="nv-field">
          <input
            id={`nv-opt-name-${group.uid}`}
            maxLength={60}
            autoComplete="off"
            placeholder={OPT_GROUP_NAME_HINT}
            value={group.name}
            onChange={(event) => onGroupName?.(group.uid, event.target.value)}
          />
          <DictateButton id={`nv-opt-name-${group.uid}`} label={DICTATE_OPT_GROUP} max={60} onText={(text) => onGroupName?.(group.uid, text)} />
        </div>
      </div>

      <div className="nv-optrow" role="group" aria-labelledby={`nv-opt-req-${group.uid}`}>
        <span className="nv-optrow-label" id={`nv-opt-req-${group.uid}`}>
          {OPT_REQUIRED_Q}
        </span>
        <span className="nv-optseg">
          <button type="button" className={`nv-btn is-small ${group.required ? "is-green" : "is-ghost"}`} aria-pressed={group.required} onClick={() => onRequired?.(group.uid, true)}>
            {OPT_YES}
          </button>
          <button type="button" className={`nv-btn is-small ${group.required ? "is-ghost" : "is-green"}`} aria-pressed={!group.required} onClick={() => onRequired?.(group.uid, false)}>
            {OPT_NO}
          </button>
        </span>
      </div>

      <Stepper id={`nv-opt-max-${group.uid}`} label={OPT_HOW_MANY} value={group.max} canLess={group.canLess} canMore={group.canMore} onLess={() => onMax?.(group.uid, -1)} onMore={() => onMax?.(group.uid, 1)} />
      {group.required ? (
        <Stepper id={`nv-opt-min-${group.uid}`} label={OPT_AT_LEAST} value={group.min} canLess={group.canMinLess} canMore={group.canMinMore} onLess={() => onMin?.(group.uid, -1)} onMore={() => onMin?.(group.uid, 1)} />
      ) : null}
      <p className="nv-optrule">{group.sentence}</p>

      <ul className="nv-optitems" aria-label={`Opções de ${label}`}>
        {group.items.map((item) => (
          <li key={item.uid} className={`nv-optitem${item.active ? "" : " is-off"}`}>
            <div className="nv-field">
              <input
                id={`nv-opt-iname-${group.uid}-${item.uid}`}
                maxLength={60}
                autoComplete="off"
                aria-label={`Nome de ${item.spoken}`}
                placeholder={OPT_ITEM_NAME_HINT}
                value={item.name}
                onChange={(event) => onItemName?.(group.uid, item.uid, event.target.value)}
              />
              <DictateButton
                id={`nv-opt-iname-${group.uid}-${item.uid}`}
                label={DICTATE_OPT_ITEM(item.spoken)}
                max={60}
                onText={(text) => onItemName?.(group.uid, item.uid, text)}
              />
            </div>
            <div className="nv-optitem-line">
              <div className="nv-field nv-optprice">
                <input
                  inputMode="decimal"
                  maxLength={10}
                  autoComplete="off"
                  aria-label={`Preço a mais de ${item.spoken}`}
                  placeholder={OPT_ITEM_PRICE_HINT}
                  value={item.price}
                  onChange={(event) => onItemPrice?.(group.uid, item.uid, event.target.value)}
                />
              </div>
              <button
                type="button"
                className={`nv-btn is-small ${item.active ? "is-green" : "is-ghost"}`}
                aria-pressed={item.active}
                aria-label={`${item.spoken}: ${item.active ? OPT_HAVE : OPT_GONE}. Toque para mudar`}
                onClick={() => onItemFlip?.(group.uid, item.uid)}
              >
                <NvIcon name={item.active ? "check" : "close"} />
                {item.active ? OPT_HAVE : OPT_GONE}
              </button>
              <button type="button" className="nv-icon-btn is-danger" aria-label={`Tirar ${item.spoken}`} onClick={() => onRemoveItem?.(group.uid, item.uid)}>
                <NvIcon name="trash" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="nv-optacts">
        <button type="button" className="nv-btn is-ghost is-small" disabled={!group.canAddItem} onClick={() => onAddItem?.(group.uid)}>
          <NvIcon name="plus" />
          {OPT_ADD_ITEM}
        </button>
        <button type="button" className={`nv-btn is-ghost is-small${group.armed ? " is-armed" : ""}`} onClick={() => onRemoveGroup?.(group.uid)}>
          <NvIcon name="trash" />
          {group.armed ? OPT_REMOVE_GROUP_ARMED : OPT_REMOVE_GROUP}
        </button>
      </div>
    </li>
  );
}

/** Escrever as opções do mesmo jeito que se fala: "tamanho pequeno, grande mais 6. Adicionais bacon 4". */
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
      <label className="nv-text" htmlFor="nv-opt-type">
        <span>{OPT_TYPE_LABEL}</span>
      </label>
      <div className="nv-typerow">
        <div className="nv-field is-area">
          <textarea id="nv-opt-type" value={text} rows={3} maxLength={1200} autoComplete="off" placeholder={OPT_TYPE_HINT} onChange={(event) => setText(event.target.value)} />
          <DictateButton id="nv-opt-type" label={DICTATE_OPT_TEXT} max={1200} append value={text} onText={setText} />
        </div>
        <button type="submit" className="nv-btn is-green" disabled={!ready}>
          {OPT_NOTE}
        </button>
      </div>
    </form>
  );
}

/**
 * As opções de um prato: tamanho, adicionais, "sem cebola". Quem fala, escreve ou toca em um modelo monta o que o cliente vai
 * escolher; nada vale até tocar em "Salvar as opções". Os campos são afundados (escrever); os botões, em relevo (tocar); o que
 * só informa (a regra em palavras, o que foi entendido) fica liso. A barra de baixo diz o que falta e fica à vista.
 */
export default function DishOptions({ view, ...on }: Props) {
  const ready = view.stage === "ready";
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-options">
        <TopBar title={view.title} sub={view.sub} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-opt-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        {view.stage === "loading" ? (
          <>
            <p className="nv-working is-big" aria-hidden="true">
              <Spinner />
              {OPT_LOADING}
            </p>
            <button type="button" className="nv-btn is-ghost is-block" onClick={on.onBack}>
              <NvIcon name="back" />
              {OPT_BACK}
            </button>
          </>
        ) : null}

        {view.stage === "error" ? (
          <>
            <p className="nv-error" role="alert">
              {view.error}
            </p>
            <button type="button" className="nv-btn is-green is-block" onClick={on.onRetry}>
              {OPT_RETRY}
            </button>
            <button type="button" className="nv-btn is-ghost is-block" onClick={on.onBack}>
              <NvIcon name="back" />
              {OPT_BACK}
            </button>
          </>
        ) : null}

        {ready ? (
          <>
            <p className="nv-code-hint">{view.intro}</p>

            {view.canListen ? (
              <button type="button" className={`nv-btn is-fire is-tall is-block nv-mic${view.listening ? " is-listening" : ""}`} aria-pressed={view.listening} onClick={on.onMic}>
                <NvIcon name="mic" />
                {view.listening ? OPT_MIC_LISTENING : OPT_MIC}
              </button>
            ) : (
              <p className="nv-code-hint">{OPT_MIC_OFF}</p>
            )}

            {view.listening ? (
              <p className="nv-heard" aria-hidden="true">
                {view.heard || OPT_SAY_EXAMPLE}
              </p>
            ) : (
              <p className="nv-code-hint">{OPT_SAY_EXAMPLE}</p>
            )}

            <TypeBox onText={on.onText} />

            {view.said && !view.listening ? (
              <div className="nv-optsaid">
                {view.said.said ? (
                  <p>
                    <strong>{OPT_YOU_SAID}</strong> “{view.said.said}”
                  </p>
                ) : null}
                {view.said.lines.length > 0 ? (
                  <>
                    <p>
                      <strong>{OPT_UNDERSTOOD}</strong>
                    </p>
                    <ul>
                      {view.said.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="nv-code-hint">{OPT_CHECK_BELOW}</p>
                  </>
                ) : (
                  <p className="nv-error" role="alert">
                    {view.said.unclear}
                  </p>
                )}
                {view.said.notes.length > 0 ? (
                  <ul className="nv-optnotes">
                    {view.said.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="nv-btn is-ghost is-small" onClick={on.onCloseSaid}>
                  {OPT_CLOSE_NOTICE}
                </button>
              </div>
            ) : null}

            {view.groups.length > 0 ? (
              <ul className="nv-orders">
                {view.groups.map((group) => (
                  <GroupCard key={group.uid} group={group} {...on} />
                ))}
              </ul>
            ) : null}

            {view.starters.length > 0 ? (
              <div className="nv-optstarters" role="group" aria-label={view.startersLabel}>
                <p className="nv-code-label">{view.startersLabel}</p>
                <div className="nv-optstarters-row">
                  {view.starters.map((starter) => (
                    <button key={starter.kind} type="button" className="nv-btn is-ghost is-small" onClick={() => on.onStarter?.(starter.kind)}>
                      <NvIcon name="plus" />
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {view.problems.length > 0 ? (
              <div className="nv-error" role="alert">
                <p>{OPT_PROBLEMS}</p>
                <ul className="nv-optnotes">
                  {view.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.notice ? (
              view.notice.ok ? (
                <p className="nv-ok" aria-hidden="true">
                  {view.notice.text}
                </p>
              ) : (
                <p className="nv-error" role="alert">
                  {view.notice.text}
                </p>
              )
            ) : null}

            <div className="nv-savebar">
              {view.hint ? <p className="nv-code-hint">{view.hint}</p> : null}
              {view.dirty || view.saving ? (
                <>
                  <button type="button" className="nv-btn is-green is-tall is-block" disabled={view.saving} aria-busy={view.saving || undefined} onClick={on.onSave}>
                    <NvIcon name="check" />
                    {view.saving ? OPT_SAVING : OPT_SAVE}
                  </button>
                  <button type="button" className={`nv-btn is-ghost is-small is-block${view.backArmed ? " is-armed" : ""}`} disabled={view.saving} onClick={on.onBack}>
                    <NvIcon name="back" />
                    {view.backArmed ? OPT_BACK_ARMED : OPT_BACK}
                  </button>
                </>
              ) : (
                /* Nada por salvar: o próximo passo é voltar aos pratos, e é o botão principal. */
                <button type="button" className="nv-btn is-green is-tall is-block" onClick={on.onBack}>
                  <NvIcon name="back" />
                  {OPT_BACK}
                </button>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
