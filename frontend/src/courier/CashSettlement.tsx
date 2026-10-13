import { useEffect, useRef, useState } from "react";
import "../ui.css";
import "./courier.css";
import { HttpError } from "../service/api";
import { formatTime } from "../service/format";
import ConfirmButton from "../service/ConfirmButton";
import { fetchCourierCash, settleCourierCash } from "./courierApi";
import {
  NO_CASH_TEXT,
  moneyText,
  centsOf,
  selectedCents,
  settleLabel,
  settledText,
  type CashGroup,
  type CashView,
} from "./courierLogic";

type Props = {
  companyId: string;
};

/**
 * "Acerto": the cash that couriers received at the door and have not handed in yet. The cashier counts what each one
 * hands over, ticks the deliveries it covers (all of them by default) and settles. Settling also marks the orders'
 * payment as received. The list does not refresh by itself, so the total the cashier counted never changes under him.
 */
export default function CashSettlement({ companyId }: Props) {
  const [view, setView] = useState<CashView | null>(null);
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  /** Deliveries the cashier took OUT of the settlement (everything else is in). */
  const [left, setLeft] = useState<string[]>([]);
  const alive = useRef(true);

  async function load() {
    try {
      const next = await fetchCourierCash(companyId);
      if (!alive.current) return;
      setView(next);
      setProblem("");
    } catch (error) {
      if (!alive.current) return;
      const known = error instanceof HttpError && error.status > 0;
      setProblem(known ? error.message : "Sem sinal. Tente de novo.");
    }
  }

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [companyId]);

  const selectedOf = (group: CashGroup): string[] =>
    group.orders.map((order) => order.id).filter((id) => !left.includes(id));

  function toggle(id: string) {
    setLeft((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function settle(group: CashGroup) {
    const ids = selectedOf(group);
    if (ids.length === 0 || busy) return;
    setBusy(true);
    setNotice("");
    setProblem("");
    try {
      const result = await settleCourierCash(companyId, group.courier_id, ids);
      if (!alive.current) return;
      setNotice(settledText(result));
      setLeft([]);
    } catch (error) {
      if (!alive.current) return;
      const known = error instanceof HttpError && error.status > 0;
      setProblem(known ? error.message : "Sem sinal. Nada foi acertado. Tente de novo.");
    } finally {
      if (alive.current) setBusy(false);
    }
    await load();
  }

  if (view === null) {
    return (
      <section className="sheet crr" aria-label="Acerto dos motoqueiros">
        <p className="crr-empty" role="status">
          {problem || "Abrindo o acerto…"}
        </p>
        {problem && (
          <button type="button" className="btn btn-outline" onClick={() => void load()}>
            Tentar de novo
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="sheet crr" aria-label="Acerto dos motoqueiros">
      <h2 className="crr-summary">Dinheiro com os motoqueiros</h2>
      <p className="crr-meta">
        É o dinheiro que cada motoqueiro recebeu na porta e ainda não entregou ao caixa. Conte o dinheiro, confira as
        entregas e toque em Recebi. O pagamento desses pedidos passa a pago.
      </p>

      {notice && (
        <p className="msg-ok crr-notice" role="status">
          {notice}
        </p>
      )}
      {problem && (
        <p className="msg-error" role="alert">
          {problem}
        </p>
      )}

      {view.couriers.length === 0 && !problem && (
        <p className="crr-empty" role="status">
          {NO_CASH_TEXT}
        </p>
      )}

      {view.couriers.map((group) => {
        const chosen = selectedOf(group);
        return (
          <article className="crr-card" key={group.courier_id} aria-label={`Dinheiro com ${group.name}`}>
            <div className="crr-head">
              <strong className="crr-who">{group.name}</strong>
              <span className="crr-total">{moneyText(centsOf(group.total))}</span>
            </div>

            <ul className="crr-cashlist">
              {group.orders.map((order) => (
                <li key={order.id}>
                  <label className="crr-check">
                    <input
                      type="checkbox"
                      checked={!left.includes(order.id)}
                      disabled={busy}
                      onChange={() => toggle(order.id)}
                    />
                    <span>
                      {order.customer_name || "Cliente"}
                      {order.zone ? ` · ${order.zone}` : ""}
                      {order.delivered_at ? ` · ${formatTime(order.delivered_at)}` : ""}
                    </span>
                    <span className="crr-amount">{moneyText(centsOf(order.amount))}</span>
                  </label>
                </li>
              ))}
            </ul>

            <p className="crr-meta">
              Marcado: <strong>{moneyText(selectedCents(group, chosen))}</strong>
            </p>

            {chosen.length > 0 ? (
              <div className="crr-settle">
                {/* the key restarts the two taps when the ticks change, so the second tap never confirms another total */}
                <ConfirmButton
                  key={chosen.join(",")}
                  tone="ok"
                  label={settleLabel(group, chosen)}
                  confirmLabel="Toque de novo para confirmar"
                  onConfirm={() => void settle(group)}
                />
              </div>
            ) : (
              <p className="crr-meta">Marque as entregas que o motoqueiro entregou ao caixa.</p>
            )}
          </article>
        );
      })}

      <button type="button" className="btn btn-quiet btn-block" disabled={busy} onClick={() => void load()}>
        Atualizar
      </button>
    </section>
  );
}
