import { useEffect, useRef } from "react";
import "./novo.css";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import {
  DELIVERIES_BACK,
  DELIVERIES_CALL,
  DELIVERIES_CODE_ARIA,
  DELIVERIES_CODE_HINT,
  DELIVERIES_CODE_LABEL,
  DELIVERIES_CONFIRM,
  DELIVERIES_CONFIRMING,
  DELIVERIES_LOCKED,
  DELIVERIES_MAP,
  DELIVERIES_MAP_OPEN,
  DELIVERIES_NO_CODE,
  DELIVERIES_OTHER,
  DELIVERIES_PICKING,
  DELIVERIES_TABS_LABEL,
  DELIVERIES_TITLE,
} from "./copy";
import type { DeliveriesView, DeliveryCard } from "./types";

/** O que está indo ao servidor agora: o botão tocado mostra a palavra de espera e os outros esperam. */
export type DeliveriesBusy = { id: string; kind: "pick" | "deliver" } | null;

/** A entrega que está fechando: o que já foi digitado do código, se o código está completo e se travou. */
export type DeliveryForm = { id: string; code: string; ready: boolean; locked: boolean } | null;

/** Um aviso que pertence a uma entrega só (um erro ao pegar ou ao fechar). */
export type DeliveryNote = { id: string; text: string } | null;

/** O campo do código. Ao abrir, o foco vem para ele e o teclado de números sobe: foi isso que a pessoa pediu ao tocar em Entreguei. */
function CodeField({ value, onChange }: { value: string; onChange?: (code: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="nv-field is-code">
      <input
        ref={ref}
        id="nv-delivery-code"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        placeholder="0000"
        aria-label={DELIVERIES_CODE_ARIA}
        aria-describedby="nv-delivery-code-hint"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}

type ItemProps = {
  card: DeliveryCard;
  busy: DeliveriesBusy;
  form: DeliveryForm;
  note: DeliveryNote;
  onPick?: (id: string) => void;
  onOpen?: (id: string) => void;
  onCode?: (code: string) => void;
  onConfirm?: (id: string) => void;
  onCloseForm?: () => void;
};

/**
 * Uma entrega: para onde vai (o endereço em letra grande), quanto receber na porta e o troco a levar, ligar e abrir o mapa,
 * e embaixo o botão do momento: Peguei, depois Entreguei, que abre o campo dos 4 números do cliente. O cartão só informa
 * (sombra macia); só os botões e o campo se tocam, porque um toque sem querer fecha uma entrega.
 */
export function DeliveryItem({ card, busy, form, note, onPick, onOpen, onCode, onConfirm, onCloseForm }: ItemProps) {
  const locked = busy !== null;
  const mine = busy?.id === card.id ? busy.kind : null;
  const open = form?.id === card.id ? form : null;
  const message = note?.id === card.id ? note.text : "";
  const hands = card.stage === "ready" || card.stage === "going";
  const tape = card.stage === "ready" ? " is-warn" : card.stage === "going" ? "" : " is-closed";

  return (
    <li className={`nv-order nv-delivery is-${card.stage}${tape}`}>
      <div className="nv-order-head">
        <div className="nv-order-text">
          <h2 className="nv-order-where" id={`nv-delivery-${card.id}`} tabIndex={-1}>
            {card.who}
          </h2>
          <p className="nv-order-meta">{[card.number, card.time].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {card.stage === "other" ? (
        <p className="nv-order-chips">
          <span className="nv-order-chip is-prep">{DELIVERIES_OTHER}</span>
        </p>
      ) : null}

      {card.money ? (
        <p className="nv-order-chips">
          <span className={`nv-order-chip is-pay-${card.money.tone === "settled" ? "ok" : "wait"}`}>{card.money.text}</span>
        </p>
      ) : null}

      {card.stage !== "done" ? (
        <div className="nv-order-ship">
          <p className="nv-order-ship-main">{card.address}</p>
          {card.sub.map((line) => (
            <p key={line} className="nv-order-ship-sub">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {card.cash ? (
        <div className="nv-delivery-cash">
          <NvIcon name="cash" />
          <p>
            <b>{card.cash.main}</b>
            <span>{card.cash.sub}</span>
          </p>
        </div>
      ) : null}

      {hands && (card.phoneHref || card.mapHref) ? (
        <div className="nv-delivery-links">
          {card.phoneHref ? (
            <a className="nv-btn is-ghost" href={card.phoneHref} aria-label={`${DELIVERIES_CALL} para ${card.who}`}>
              <NvIcon name="phone" />
              {DELIVERIES_CALL}
            </a>
          ) : null}
          {card.mapHref ? (
            <a className="nv-btn is-ghost" href={card.mapHref} target="_blank" rel="noopener noreferrer" aria-label={`${DELIVERIES_MAP_OPEN}, ${card.address}`}>
              <NvIcon name="pin" />
              {DELIVERIES_MAP}
            </a>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="nv-error" role="alert">
          {message}
        </p>
      ) : null}

      {card.stage === "ready" && card.action ? (
        <button
          type="button"
          className="nv-btn is-green is-block"
          aria-label={mine === "pick" ? undefined : card.actionSpoken}
          disabled={locked}
          aria-busy={mine === "pick" || undefined}
          onClick={() => onPick?.(card.id)}
        >
          <NvIcon name="bag" />
          {mine === "pick" ? DELIVERIES_PICKING : card.action}
        </button>
      ) : null}

      {card.stage === "going" && card.action && !open ? (
        <button type="button" className="nv-btn is-green is-block" aria-label={card.actionSpoken} disabled={locked} onClick={() => onOpen?.(card.id)}>
          <NvIcon name="check" />
          {card.action}
        </button>
      ) : null}

      {card.stage === "going" && open ? (
        <form
          className="nv-delivery-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (open.ready && !open.locked && !locked) onConfirm?.(card.id);
          }}
        >
          {open.locked ? (
            <p className="nv-error" role="alert">
              {DELIVERIES_LOCKED}
            </p>
          ) : (
            <>
              {card.needsCode ? (
                <div className="nv-code-block">
                  <label className="nv-code-label" htmlFor="nv-delivery-code">
                    {DELIVERIES_CODE_LABEL}
                  </label>
                  <p className="nv-code-hint" id="nv-delivery-code-hint">
                    {DELIVERIES_CODE_HINT}
                  </p>
                  <CodeField value={open.code} onChange={onCode} />
                </div>
              ) : (
                <p className="nv-code-hint">{DELIVERIES_NO_CODE}</p>
              )}
              <button
                type="submit"
                className="nv-btn is-green is-block"
                disabled={locked || !open.ready}
                aria-busy={mine === "deliver" || undefined}
              >
                <NvIcon name="check" />
                {mine === "deliver" ? DELIVERIES_CONFIRMING : DELIVERIES_CONFIRM}
              </button>
            </>
          )}
          <button type="button" className="nv-btn is-ghost is-block" disabled={locked} onClick={onCloseForm}>
            {DELIVERIES_BACK}
          </button>
        </form>
      ) : null}
    </li>
  );
}

type Props = {
  view: DeliveriesView;
  busy?: DeliveriesBusy;
  form?: DeliveryForm;
  note?: DeliveryNote;
  /** Toque numa etapa (Para pegar, Na rua, Entregues). Sem isto a tela só mostra, como na página de conferência. */
  onTab?: (id: string) => void;
  onPick?: (id: string) => void;
  onOpen?: (id: string) => void;
  onCode?: (code: string) => void;
  onConfirm?: (id: string) => void;
  onCloseForm?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Entregas: três etapas em cima (Para pegar, Na rua, Entregues) e um cartão por entrega. Quem leva a entrega vê só o que precisa
 * na porta: o endereço, o dinheiro a receber e o troco, ligar e o mapa. O dinheiro que ainda deve ao caixa fica sempre no topo.
 */
export default function Deliveries({ view, busy = null, form = null, note = null, onTab, onPick, onOpen, onCode, onConfirm, onCloseForm, onMenu, showMenu = false }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-deliveries">
        <TopBar title={DELIVERIES_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-deliveries-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.notice || view.sub}
        </p>

        {view.held ? <p className="nv-held">{view.held}</p> : null}
        {view.notice ? (
          <p className="nv-ok" aria-hidden="true">
            {view.notice}
          </p>
        ) : null}

        <div className="nv-tabs" role="tablist" aria-label={DELIVERIES_TABS_LABEL}>
          {view.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`nv-deliveries-tab-${tab.id}`}
              aria-selected={tab.id === view.active}
              aria-controls="nv-deliveries-panel"
              className={`nv-tab${tab.id === view.active ? " is-on" : ""}`}
              onClick={() => onTab?.(tab.id)}
            >
              {tab.label}
              <b>{tab.count}</b>
            </button>
          ))}
        </div>

        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        <div role="tabpanel" id="nv-deliveries-panel" aria-labelledby={`nv-deliveries-tab-${view.active}`}>
          {view.cards.length === 0 && view.empty ? <p className="nv-empty">{view.empty}</p> : null}
          <ul className="nv-orders">
            {view.cards.map((card) => (
              <DeliveryItem
                key={card.id}
                card={card}
                busy={busy}
                form={form}
                note={note}
                onPick={onPick}
                onOpen={onOpen}
                onCode={onCode}
                onConfirm={onConfirm}
                onCloseForm={onCloseForm}
              />
            ))}
          </ul>
        </div>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
