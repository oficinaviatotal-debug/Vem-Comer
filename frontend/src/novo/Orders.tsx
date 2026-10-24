import "./novo.css";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { minutesText } from "./format";
import { ORDERS_CALL, ORDERS_RECEIVING, ORDERS_SENDING, ORDERS_TABS_LABEL, ORDERS_TITLE } from "./copy";
import type { OrderCard, OrdersView } from "./types";

/** O que está indo ao servidor agora: o botão tocado mostra "Enviando…" e os outros esperam. */
export type OrdersBusy = { id: string; kind: "advance" | "skip" | "receive" } | null;

type CardProps = {
  card: OrderCard;
  busy: OrdersBusy;
  onAction?: (id: string, which: "advance" | "skip") => void;
  onReceive?: (id: string) => void;
  /** Na aba Receber o dinheiro vem primeiro; nas outras, avançar o pedido. */
  moneyFirst?: boolean;
};

/**
 * Um pedido: de onde vem (mesa, entrega, retirada) e há quanto tempo espera, para onde vai e como ligar, o que tem,
 * quanto custa e como paga. Embaixo, no máximo três botões: receber o dinheiro, avançar o pedido e o atalho pequeno.
 * O cartão só informa (sombra macia); só os botões se tocam, porque um toque sem querer muda um pedido ou o caixa.
 */
export function OrderItem({ card, busy, onAction, onReceive, moneyFirst = false }: CardProps) {
  const locked = busy !== null;
  const mine = busy?.id === card.id ? busy.kind : null;
  const closed = card.tone === "done";

  const receiveButton = card.receive ? (
    <button
      type="button"
      className="nv-btn is-fire is-block"
      aria-label={mine === "receive" ? undefined : card.receiveSpoken}
      disabled={locked}
      aria-busy={mine === "receive" || undefined}
      onClick={() => onReceive?.(card.id)}
    >
      <NvIcon name="cash" />
      {mine === "receive" ? ORDERS_RECEIVING : card.receive}
    </button>
  ) : null;

  const advanceButton = card.action ? (
    <button
      type="button"
      className="nv-btn is-green is-block"
      aria-label={mine === "advance" ? undefined : card.actionSpoken}
      disabled={locked}
      aria-busy={mine === "advance" || undefined}
      onClick={() => onAction?.(card.id, "advance")}
    >
      <NvIcon name="check" />
      {mine === "advance" ? ORDERS_SENDING : card.action}
    </button>
  ) : null;

  const skipButton = card.skip ? (
    <button
      type="button"
      className="nv-btn is-ghost is-block"
      aria-label={mine === "skip" ? undefined : card.skipSpoken}
      disabled={locked}
      aria-busy={mine === "skip" || undefined}
      onClick={() => onAction?.(card.id, "skip")}
    >
      {mine === "skip" ? ORDERS_SENDING : card.skip}
    </button>
  ) : null;

  return (
    <li className={`nv-order is-${card.wait}${closed ? " is-closed" : ""}`}>
      <div className="nv-order-head">
        <div className="nv-order-text">
          <h2 className="nv-order-where" id={`nv-order-${card.id}`} tabIndex={-1}>
            {card.where}
          </h2>
          <p className="nv-order-meta">{[card.who, card.number].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="nv-wait">
          <NvIcon name="clock" /> {closed ? card.time : minutesText(card.minutes)}
        </span>
      </div>

      <p className="nv-order-chips">
        <span className={`nv-order-chip is-${card.tone}`}>{card.status}</span>
        <span className={`nv-order-chip is-pay-${card.pay.chipTone}`}>{card.pay.chip}</span>
      </p>

      {card.ship ? (
        <div className="nv-order-ship">
          {card.ship.main ? <p className="nv-order-ship-main">{card.ship.main}</p> : null}
          {card.ship.sub.map((line) => (
            <p key={line} className="nv-order-ship-sub">
              {line}
            </p>
          ))}
          {card.ship.courier ? <p className="nv-order-ship-sub">{card.ship.courier}</p> : null}
          {card.ship.phoneHref ? (
            <a className="nv-btn is-ghost is-block" href={card.ship.phoneHref} aria-label={`${ORDERS_CALL}, ${card.ship.phone}`}>
              <NvIcon name="phone" />
              {card.ship.phone}
            </a>
          ) : null}
        </div>
      ) : null}

      <ul className="nv-lines">
        {card.lines.map((line, index) => (
          <li key={`${index}-${line.name}`}>
            <b>{line.qty}×</b>
            {line.name}
            {line.detail ? <small>{line.detail}</small> : null}
          </li>
        ))}
      </ul>
      {card.note ? <p className="nv-note">{card.note}</p> : null}

      <div className="nv-order-money">
        <p className="nv-order-total">
          <span>Total</span>
          <b>{card.total}</b>
        </p>
        {card.split ? <p className="nv-order-split">{card.split}</p> : null}
        {card.pay.extra ? <p className="nv-order-change">{card.pay.extra}</p> : null}
      </div>

      {moneyFirst ? receiveButton : advanceButton}
      {moneyFirst ? advanceButton : receiveButton}
      {skipButton}
    </li>
  );
}

type Props = {
  view: OrdersView;
  busy?: OrdersBusy;
  /** Toque numa etapa (Novos, Andamento, Receber, Feitos). Sem isto a tela só mostra, como na página de conferência. */
  onTab?: (id: string) => void;
  onAction?: (id: string, which: "advance" | "skip") => void;
  onReceive?: (id: string) => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Pedidos e caixa: as etapas do pedido em cima (Novos, Andamento, Receber e Feitos), e embaixo um cartão por pedido,
 * o que esperou mais primeiro. Quem não confirma pagamento não tem a aba Receber. Quem aceita, prepara, entrega e
 * recebe usa a mesma tela, só com os botões que são dele.
 */
export default function Orders({ view, busy = null, onTab, onAction, onReceive, onMenu, showMenu = false }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-orders">
        <TopBar title={ORDERS_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-orders-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.sub}
        </p>

        <div className={`nv-tabs${view.tabs.length === 4 ? " is-four" : ""}`} role="tablist" aria-label={ORDERS_TABS_LABEL}>
          {view.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`nv-orders-tab-${tab.id}`}
              aria-selected={tab.id === view.active}
              aria-controls="nv-orders-panel"
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

        <div role="tabpanel" id="nv-orders-panel" aria-labelledby={`nv-orders-tab-${view.active}`}>
          {view.cards.length === 0 ? <p className="nv-empty">{view.empty}</p> : null}
          <ul className="nv-orders">
            {view.cards.map((card) => (
              <OrderItem key={card.id} card={card} busy={busy} onAction={onAction} onReceive={onReceive} moneyFirst={view.active === "receive"} />
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
