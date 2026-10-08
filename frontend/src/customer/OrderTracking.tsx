import { useEffect, useRef, useState } from "react";
import ItemDetails from "./ItemDetails";
import { fetchOrder, HttpError } from "../service/api";
import { formatMoney, shortOrderCode } from "../service/format";
import { customerStatus, STEP_LABELS } from "./labels";
import type { OrderView } from "./types";
import { orderMemory } from "./orderMemory";
import OrderFeedback from "./OrderFeedback";
import PixPayment from "./PixPayment";
import { keepPolling } from "./payment";
import { describeAddress, maskPhone, modeOfOrder, whereLabel } from "./delivery";

type Props = {
  companyId: string;
  orderId: string;
  token: string;
  tableNumber: number | null;
  /** Ask for feedback on this slip (only one ready order at a time does). */
  askFeedback: boolean;
  allOrderIds: string[];
  onFeedbackSent: () => void;
  /** Called on every refresh so the menu can show the latest status. */
  onUpdate: (order: OrderView) => void;
  /** The server no longer knows this order (expired link): forget it. */
  onGone: () => void;
  /** The customer is done with this slip. */
  onDismiss: () => void;
  /** This slip carries the element ids the payment guide points at. */
  pixGuideTarget: boolean;
  /** "Como pagar? Me ajude": opens the payment guide. */
  onPixHelp: () => void;
};

const POLL_MS = 5000;

/** The order slip with live status. Checks the server every few seconds until the order is ready. */
export default function OrderTracking(props: Props) {
  const { orderId, token } = props;
  const [order, setOrder] = useState<OrderView | null>(null);
  const [offline, setOffline] = useState(false);
  const callbacks = useRef(props);

  useEffect(() => {
    callbacks.current = props;
  });

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const poll = async () => {
      if (!alive) return;
      if (document.hidden) {
        timer = window.setTimeout(poll, POLL_MS);
        return;
      }
      try {
        const next: OrderView = await fetchOrder(orderId, token);
        if (!alive) return;
        setOrder(next);
        setOffline(false);
        callbacks.current.onUpdate(next);
        // Nothing left to wait for: ready, and no Pix payment still to be confirmed.
        if (!keepPolling(customerStatus(next.status, null).done, next.payment_method, next.payment_status)) return;
      } catch (error) {
        if (!alive) return;
        if (error instanceof HttpError && (error.status === 401 || error.status === 404)) {
          callbacks.current.onGone();
          return;
        }
        setOffline(true);
      }
      timer = window.setTimeout(poll, POLL_MS);
    };

    void poll();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [orderId, token]);

  if (!order) {
    return (
      <div className="comanda-wrap">
        <div className="comanda">
          <p className="cust-empty" role="status">
            {offline ? "Sem internet. Vamos tentar de novo." : "Buscando o seu pedido…"}
          </p>
        </div>
      </div>
    );
  }

  const status = customerStatus(order.status, props.tableNumber, order.order_type);
  const mode = props.tableNumber ? null : modeOfOrder(order.order_type);
  const fee = Number(order.delivery_fee) || 0;
  const address = describeAddress(order.delivery_address);

  return (
    <div className={status.done ? "comanda-wrap is-ready" : "comanda-wrap"}>
      <article className="comanda" aria-label={`Pedido ${shortOrderCode(order.id)}`}>
        <div className="comanda-head">
          <div>
            <p className="comanda-where">{whereLabel(mode, props.tableNumber)}</p>
            <p className="comanda-meta">
              <span>{shortOrderCode(order.id)}</span>
              {order.customer_name && <span>{order.customer_name}</span>}
            </p>
          </div>
        </div>

        {mode === "entrega" && (
          <p className="cust-handling">
            <strong>Entrega em:</strong> {address || "o endereço que você informou"}
            {order.delivery_zone && !address.toLowerCase().includes(order.delivery_zone.toLowerCase())
              ? ` (${order.delivery_zone})`
              : ""}
            {order.customer_phone ? ` · Telefone ${maskPhone(order.customer_phone)}` : ""}
          </p>
        )}
        {mode === "retirada" && (
          <p className="cust-handling">
            <strong>Retirada no local.</strong> Avise o atendente que o pedido é seu.
          </p>
        )}

        <div className="cust-status">
          <h2 aria-live="polite">{status.headline}</h2>
          {status.hint && <p>{status.hint}</p>}
          <ol className="cust-steps" aria-label="Andamento do pedido">
            {STEP_LABELS.map((label, index) => (
              <li
                key={label}
                className={index < status.step ? "is-done" : index === status.step ? "is-current" : ""}
                aria-current={index === status.step ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>
          {offline && <p className="cust-note">Sem internet. Mostrando o último andamento.</p>}
        </div>

        <ul className="comanda-items">
          {order.items?.map((item, index) => (
            <li className="comanda-item" key={`${item.name}-${index}`}>
              <div className="leader-row">
                <span>
                  <span className="comanda-qty">{item.quantity}x</span> {item.name}
                </span>
                <span className="leader" aria-hidden="true" />
                <span className="money">{formatMoney(item.total)}</span>
              </div>
              <ItemDetails options={item.options} note={item.note} />
            </li>
          ))}
        </ul>

        {mode === "entrega" && (
          <div className="leader-row cust-subtotal">
            <span>Taxa de entrega</span>
            <span className="leader" aria-hidden="true" />
            <span className="money">{fee > 0 ? formatMoney(fee) : "Grátis"}</span>
          </div>
        )}

        <div className="leader-row comanda-total">
          <span>Total</span>
          <span className="leader" aria-hidden="true" />
          <span className="money">{formatMoney(order.total_price)}</span>
        </div>

        <PixPayment
          orderId={order.id}
          token={token}
          method={order.payment_method}
          status={order.payment_status}
          guideTarget={props.pixGuideTarget}
          onHelp={props.onPixHelp}
        />

        {status.done && (props.askFeedback || orderMemory.feedbackSent(order.id)) && (
          <OrderFeedback
            companyId={props.companyId}
            orderId={order.id}
            allOrderIds={props.allOrderIds}
            onSent={props.onFeedbackSent}
          />
        )}

        {status.done && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={props.onDismiss}>
            Fechar este pedido
          </button>
        )}
      </article>
    </div>
  );
}
