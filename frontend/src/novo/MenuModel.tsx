import { useEffect, useRef, useState, type FormEvent } from "react";
import "./novo.css";
import DictateButton from "./DictateButton";
import NvIcon from "./Icons";
import { MenuLive, Spinner, TopBar } from "./parts";
import {
  MENU_BACK,
  MENU_MODEL_LABEL,
  MENU_MODEL_RETRY,
  MENU_MODEL_SEARCH_HINT,
  MENU_NOTE,
  MENU_PICK_ADD_HINT,
  MENU_PICK_ADD_LABEL,
  MENU_PRICE_HINT,
  MENU_PRICES_ASK,
  MENU_PRICES_DROP,
  MENU_TITLE,
  DICTATE_MODEL_SEARCH,
  DICTATE_MODEL_ADD,
} from "./copy";
import type { MenuSetupView } from "./types";

type Stage<K extends MenuSetupView["stage"]> = Extract<MenuSetupView, { stage: K }>;

/** O que a pessoa faz nas três telas do modelo. Cada tela usa só o que é dela. */
export type MenuModelHandlers = {
  /** Escolher o tipo. */
  onQuery?: (text: string) => void;
  onChooseType?: (id: string) => void;
  onRetryTypes?: () => void;
  /** Marcar os pratos. */
  onToggleDish?: (id: string) => void;
  onToggleAll?: () => void;
  onAddDish?: (text: string) => void;
  onNext?: () => void;
  /** Dizer o preço. */
  onPrice?: (text: string) => void;
  onDropDish?: () => void;
  onBack?: () => void;
  onMenu?: () => void;
  showMenu?: boolean;
};

// ------------------------------------------------------------------------------------------------ o tipo de negócio

export function ModelTypes({ view, onQuery, onChooseType, onRetryTypes, onBack, onMenu, showMenu }: { view: Stage<"types"> } & MenuModelHandlers) {
  const locked = Boolean(view.working);
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <MenuLive text={view.error || view.working || view.empty || view.sub} />

      <div className="nv-typebox">
        <label className="nv-text" htmlFor="nv-model-search">
          <span>{MENU_MODEL_LABEL}</span>
        </label>
        <div className="nv-field">
          <NvIcon name="search" />
          <input
            id="nv-model-search"
            value={view.query}
            maxLength={40}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={MENU_MODEL_SEARCH_HINT}
            disabled={view.loading}
            onChange={(event) => onQuery?.(event.target.value)}
            onKeyDown={(event) => {
              // Enter aqui não manda nada: a lista já mudou enquanto a pessoa escrevia.
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          <DictateButton id="nv-model-search" label={DICTATE_MODEL_SEARCH} max={40} disabled={view.loading} onText={(text) => onQuery?.(text)} />
        </div>
      </div>

      {view.working ? (
        <p className="nv-working" aria-hidden="true">
          <Spinner />
          {view.working}
        </p>
      ) : null}

      {view.error ? (
        <p className="nv-error" role="alert">
          {view.error}
        </p>
      ) : null}

      {view.canRetry ? (
        <button type="button" className="nv-btn is-green is-tall is-block" onClick={onRetryTypes}>
          {MENU_MODEL_RETRY}
        </button>
      ) : null}

      {view.tiles.length > 0 ? (
        <ul className="nv-typetiles">
          {view.tiles.map((tile) => (
            <li key={tile.id}>
              <button type="button" className="nv-typetile" disabled={locked} onClick={() => onChooseType?.(tile.id)}>
                <span className="nv-typetile-icon" aria-hidden="true">
                  {tile.icon}
                </span>
                <span className="nv-typetile-name">{tile.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {view.empty ? <p className="nv-empty">{view.empty}</p> : null}

      {/* Voltar nunca trava: se o servidor demora, a pessoa pode desistir e a resposta que chegar tarde não muda a tela. */}
      <button type="button" className="nv-btn is-ghost is-block" onClick={onBack}>
        <NvIcon name="back" />
        {MENU_BACK}
      </button>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ tocar nos pratos

/** "Falta um prato? Escreva aqui": o prato que o modelo não tem entra marcado na categoria que está na tela. */
function AddBox({ onAddDish }: { onAddDish?: (text: string) => void }) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    onAddDish?.(text.trim());
    setText("");
  }
  return (
    <form className="nv-typebox" onSubmit={send}>
      <label className="nv-text" htmlFor="nv-model-add">
        <span>{MENU_PICK_ADD_LABEL}</span>
      </label>
      <div className="nv-typerow">
        <div className="nv-field">
          <input
            id="nv-model-add"
            value={text}
            maxLength={80}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={MENU_PICK_ADD_HINT}
            onChange={(event) => setText(event.target.value)}
          />
          <DictateButton id="nv-model-add" label={DICTATE_MODEL_ADD} max={80} onText={setText} />
        </div>
        <button type="submit" className="nv-btn is-green" disabled={!ready}>
          {MENU_NOTE}
        </button>
      </div>
    </form>
  );
}

export function ModelPick({ view, onToggleDish, onToggleAll, onAddDish, onNext, onBack, onMenu, showMenu }: { view: Stage<"pick"> } & MenuModelHandlers) {
  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <MenuLive text={view.notice || view.live} />

      <section className="nv-pickhead" aria-labelledby="nv-pick-title">
        <h2 className="nv-lead" id="nv-pick-title">
          {view.title}
        </h2>
        <p className="nv-code-hint">{view.intro}</p>
        <div className="nv-pickbar">
          <p className="nv-pickcount">{view.count}</p>
          <button type="button" className="nv-btn is-ghost is-small" onClick={onToggleAll}>
            {view.markAll}
          </button>
        </div>
      </section>

      <div role="group" aria-labelledby="nv-pick-title" className="nv-opts-list">
        {view.dishes.map((dish) => (
          <button
            key={dish.id}
            type="button"
            role="checkbox"
            aria-checked={dish.selected}
            className={`nv-opt${dish.selected ? " is-on" : ""}`}
            onClick={() => onToggleDish?.(dish.id)}
          >
            <span className="nv-opt-mark" aria-hidden="true">
              <NvIcon name="check" />
            </span>
            <span className="nv-opt-name">{dish.name}</span>
          </button>
        ))}
      </div>

      {view.notice ? (
        <p className="nv-ok" aria-hidden="true">
          {view.notice}
        </p>
      ) : null}

      <AddBox onAddDish={onAddDish} />

      <button type="button" className="nv-btn is-ghost is-block" onClick={onBack}>
        <NvIcon name="back" />
        {MENU_BACK}
      </button>

      <div className="nv-savebar">
        {view.note ? <p className="nv-code-hint">{view.note}</p> : null}
        <button type="button" className="nv-btn is-green is-tall is-block" disabled={!view.canNext} onClick={onNext}>
          <NvIcon name="check" />
          {view.next}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ o preço de cada prato

export function ModelPrices({ view, onPrice, onDropDish, onBack, onMenu, showMenu }: { view: Stage<"prices"> } & MenuModelHandlers) {
  const field = useRef<HTMLInputElement>(null);
  // Cada prato novo recomeça com o foco no campo do preço: a pessoa só digita e toca no botão.
  useEffect(() => {
    field.current?.focus();
  }, [view.dishId]);

  return (
    <>
      <TopBar title={MENU_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
      <MenuLive text={view.problem || `${view.name}. ${view.sub}`} />

      <form
        key={view.dishId}
        className="nv-pricing"
        onSubmit={(event) => {
          event.preventDefault();
          onPrice?.(field.current?.value ?? "");
        }}
      >
        <p className="nv-pricing-group">{view.group}</p>
        <h2 className="nv-lead nv-pricing-dish" id="nv-price-dish">
          {view.name}
        </h2>
        <label className="nv-text" htmlFor="nv-model-price">
          <span>{MENU_PRICES_ASK}</span>
        </label>
        <div className="nv-field is-price">
          <span className="nv-price-cur" aria-hidden="true">
            R$
          </span>
          <input
            id="nv-model-price"
            ref={field}
            defaultValue={view.value}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            placeholder={MENU_PRICE_HINT}
            aria-describedby={view.problem ? "nv-price-dish nv-price-problem" : "nv-price-dish"}
            aria-invalid={view.problem ? true : undefined}
          />
        </div>
        {view.problem ? (
          <p className="nv-error" id="nv-price-problem" role="alert">
            {view.problem}
          </p>
        ) : null}
        <button type="submit" className="nv-btn is-green is-tall is-block">
          <NvIcon name="check" />
          {view.next}
        </button>
      </form>

      <div className="nv-menu-actions">
        <button type="button" className="nv-btn is-ghost is-block" onClick={onDropDish}>
          <NvIcon name="trash" />
          {MENU_PRICES_DROP}
        </button>
        <button type="button" className="nv-btn is-ghost is-block" onClick={onBack}>
          <NvIcon name="back" />
          {MENU_BACK}
        </button>
      </div>
    </>
  );
}
