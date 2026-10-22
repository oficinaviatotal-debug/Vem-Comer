import NvIcon from "./Icons";
import { VoiceOrb } from "./parts";
import { CallCard } from "./Desk";
import {
  DESK_BACK,
  DESK_CALLS_OF_TABLE,
  DESK_MAKE_ORDER,
  DESK_MAKE_ORDER_NOTE,
  DESK_NO_CALLS,
  DESK_NO_ORDERS,
  DESK_ORDERS_HEADING,
} from "./copy";
import type { DeskTableView } from "./types";

type Props = {
  view: DeskTableView;
  busyId?: string | null;
  onBack?: () => void;
  onAnswer?: (callId: string) => void;
};

/**
 * Uma mesa aberta: o que existe nela agora (chamados e pedidos em andamento) e o botão para fazer um pedido por quem
 * não usa o celular. Nada aqui muda um pedido nem o dinheiro; a única coisa que se faz é marcar um chamado como atendido.
 */
export default function DeskTable({ view, busyId = null, onBack, onAnswer }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-desk">
        <header className="nv-top">
          <button type="button" className="nv-icon-btn" aria-label={DESK_BACK} onClick={onBack}>
            <NvIcon name="back" />
          </button>
          <div className="nv-top-text">
            <h1 className="nv-name" id="nv-desk-table-title" tabIndex={-1}>
              {view.title}
            </h1>
            <p className="nv-sub" role="status" aria-live="polite">
              {view.headline}
            </p>
          </div>
        </header>

        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        <section aria-labelledby="nv-desk-t-calls-h">
          <h2 className="nv-h2" id="nv-desk-t-calls-h" style={{ marginBottom: 14 }}>
            {DESK_CALLS_OF_TABLE}
          </h2>
          {view.calls.length === 0 ? (
            <p className="nv-empty">{DESK_NO_CALLS}</p>
          ) : (
            <ul className="nv-deskcalls">
              {view.calls.map((call) => (
                <CallCard key={call.id} call={call} busyId={busyId} onAnswer={onAnswer} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="nv-desk-t-orders-h">
          <h2 className="nv-h2" id="nv-desk-t-orders-h" style={{ marginBottom: 14 }}>
            {DESK_ORDERS_HEADING}
          </h2>
          {view.orders.length === 0 ? (
            <p className="nv-empty">{DESK_NO_ORDERS}</p>
          ) : (
            <ul className="nv-deskorders">
              {view.orders.map((order) => (
                <li key={order.id} className="nv-deskorder">
                  <span className="nv-deskorder-text">
                    <b>{order.name}</b>
                    <span>
                      <span className={`nv-deskorder-chip is-${order.tone}`}>{order.status}</span>
                      {order.wait ? ` ${order.wait}` : ""}
                    </span>
                  </span>
                  <span className="nv-deskorder-price">{order.price}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {view.orderHref ? (
          <section className="nv-deskmake">
            <a
              className="nv-btn is-fire is-block is-tall"
              href={view.orderHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${DESK_MAKE_ORDER} (abre em outra aba)`}
            >
              <NvIcon name="fork" />
              {DESK_MAKE_ORDER}
            </a>
            <p className="nv-desk-fine">{DESK_MAKE_ORDER_NOTE}</p>
          </section>
        ) : null}
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
