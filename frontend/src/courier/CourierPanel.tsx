import { useEffect, useRef, useState } from "react";
import "../ui.css";
import "./courier.css";
import { HttpError } from "../service/api";
import { formatTime, shortOrderCode } from "../service/format";
import { alertDevice } from "../service/alertDevice";
import { knownOrderIds, newOrders } from "../service/newOrders";
import { maskPhone } from "../customer/delivery";
import { deliverOrder, fetchCourierOrders, pickUpOrder } from "./courierApi";
import {
  COURIER_POLL_MS,
  EMPTY_TEXT,
  cashHeld,
  cashHeldText,
  cashLine,
  cashLineText,
  codeIsComplete,
  deliveredText,
  groupOrders,
  headline,
  mapsUrl,
  moneyText,
  centsOf,
  onlyCodeDigits,
  telUrl,
  type CourierOrder,
} from "./courierLogic";

type Props = {
  companyId: string;
};

type Note = { id: string; text: string };

/**
 * The deliveries on the courier's phone: take one ("Peguei"), go, and close it with the 4-digit code the customer
 * shows ("Entreguei"). Owner and manager see the same list, and also what other couriers carry.
 */
export default function CourierPanel({ companyId }: Props) {
  const [orders, setOrders] = useState<CourierOrder[] | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const alive = useRef(true);
  /** The deliveries waiting to be taken at the last check; null until the first one (opening makes no noise). */
  const knownReady = useRef<Set<string> | null>(null);

  async function reload() {
    try {
      const rows = await fetchCourierOrders(companyId);
      if (!alive.current) return;
      const waiting = groupOrders(rows).ready;
      if (newOrders(knownReady.current, waiting).length > 0) alertDevice("ready");
      knownReady.current = knownOrderIds(waiting);
      setOrders(rows);
      setProblem("");
    } catch (error) {
      if (!alive.current) return;
      const known = error instanceof HttpError && error.status > 0;
      setProblem(known ? error.message : "Sem sinal. Mostrando a última lista que carregou.");
    }
  }

  useEffect(() => {
    alive.current = true;
    void reload();
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload();
    }, COURIER_POLL_MS);
    function onVisible() {
      if (!document.hidden) void reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [companyId]);

  // the form closes by itself if the delivery is no longer open (the restaurant closed it, or it was delivered)
  useEffect(() => {
    if (open && orders && !orders.some((order) => order.id === open && order.status !== "concluido")) {
      setOpen(null);
      setCode("");
    }
  }, [orders, open]);

  function openForm(order: CourierOrder) {
    setOpen(order.id);
    setCode("");
    setNote(null);
    setNotice("");
  }

  function closeForm() {
    setOpen(null);
    setCode("");
    setNote(null);
  }

  async function pickUp(order: CourierOrder) {
    setBusy(order.id);
    setNotice("");
    setNote(null);
    try {
      await pickUpOrder(companyId, order.id);
      setNotice(`O pedido de ${order.customer_name || "cliente"} está com você. Boa entrega!`);
    } catch (error) {
      const known = error instanceof HttpError && error.status > 0;
      setNote({ id: order.id, text: known ? error.message : "Sem sinal. Tente de novo." });
    } finally {
      setBusy(null);
    }
    await reload();
  }

  async function deliver(order: CourierOrder) {
    if (order.needs_code && !codeIsComplete(code)) return;
    setBusy(order.id);
    setNote(null);
    const result = await deliverOrder(companyId, order.id, order.needs_code ? code : "");
    if (!alive.current) return;
    setBusy(null);

    if (result.kind === "done") {
      setNotice(deliveredText(result));
      closeForm();
      await reload();
      return;
    }
    if (result.kind === "locked") {
      setLocked((current) => (current.includes(order.id) ? current : [...current, order.id]));
      setNote({ id: order.id, text: result.message });
      setCode("");
      return;
    }
    // wrong code or no signal: stay on the field, clear what was typed so the next try is a clean one
    setNote({ id: order.id, text: result.message });
    if (result.kind === "wrong") setCode("");
    if (result.kind === "error") await reload();
  }

  if (orders === null) {
    return (
      <section className="sheet crr" aria-label="Entregas">
        <p className="crr-empty" role="status">
          {problem || "Abrindo as entregas…"}
        </p>
        {problem && (
          <button type="button" className="btn btn-outline" onClick={() => void reload()}>
            Tentar de novo
          </button>
        )}
      </section>
    );
  }

  const groups = groupOrders(orders);
  const held = cashHeldText(cashHeld(orders));
  const summary = headline(groups);
  const nothing = orders.length === 0;

  function card(order: CourierOrder, mode: "ready" | "going" | "other") {
    const cash = cashLine(order);
    const tel = telUrl(order.phone);
    const map = mapsUrl(order);
    const isOpen = open === order.id;
    const isLocked = locked.includes(order.id);
    const message = note && note.id === order.id ? note.text : "";

    return (
      <li className="crr-card" key={order.id} aria-label={`Entrega ${shortOrderCode(order.id)}`}>
        <div className="crr-head">
          <strong className="crr-who">{order.customer_name || "Cliente"}</strong>
          <span className="chip chip-go">{shortOrderCode(order.id)}</span>
        </div>

        <p className="crr-address">{order.address || "Endereço não informado"}</p>
        {order.zone && <p className="crr-meta">Região: {order.zone}</p>}
        {order.reference && <p className="crr-meta">Referência: {order.reference}</p>}

        {mode !== "other" && cash && (
          <p className="crr-cash" role="note">
            <span aria-hidden="true">💵 </span>
            {cashLineText(cash)}
          </p>
        )}

        {mode !== "other" && (tel || map) && (
          <div className="crr-links">
            {tel && (
              <a className="btn btn-outline" href={tel}>
                <span aria-hidden="true">📞</span> Ligar {order.phone ? maskPhone(order.phone) : ""}
              </a>
            )}
            {map && (
              <a className="btn btn-outline" href={map} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">📍</span> Abrir no mapa
              </a>
            )}
          </div>
        )}

        {mode === "other" && <p className="crr-meta">Está com outro motoqueiro.</p>}

        {message && !isOpen && (
          <p className="msg-error" role="alert">
            {message}
          </p>
        )}

        {mode === "ready" && (
          <button
            type="button"
            className="btn btn-primary btn-block crr-big"
            disabled={busy !== null}
            onClick={() => void pickUp(order)}
          >
            {busy === order.id ? "Pegando…" : "Peguei"}
          </button>
        )}

        {mode === "going" && !isOpen && (
          <button
            type="button"
            className="btn btn-mata btn-block crr-big"
            disabled={busy !== null}
            onClick={() => openForm(order)}
          >
            Entreguei
          </button>
        )}

        {mode === "going" && isOpen && (
          <form
            className="crr-code"
            onSubmit={(event) => {
              event.preventDefault();
              void deliver(order);
            }}
          >
            {isLocked ? (
              <p className="msg-error" role="alert">
                {message || "Código bloqueado. Avise o restaurante: ele fecha a entrega pela tela dele."}
              </p>
            ) : (
              <>
                {order.needs_code ? (
                  <label className="field">
                    <span>Código do cliente</span>
                    <small>Peça ao cliente os 4 números que aparecem no pedido dele. Só entregue o pedido depois.</small>
                    <input
                      className="crr-code-input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      maxLength={4}
                      placeholder="0000"
                      aria-label="Código do cliente, 4 números"
                      value={code}
                      onChange={(event) => setCode(onlyCodeDigits(event.target.value))}
                    />
                  </label>
                ) : (
                  <p className="crr-meta">Este pedido não tem código. Confirme só depois de entregar.</p>
                )}
                {message && (
                  <p className="msg-error" role="alert">
                    {message}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-mata btn-block crr-big"
                  disabled={busy !== null || (order.needs_code && !codeIsComplete(code))}
                >
                  {busy === order.id ? "Confirmando…" : "Confirmar entrega"}
                </button>
              </>
            )}
            <button type="button" className="btn btn-quiet btn-block" disabled={busy !== null} onClick={closeForm}>
              Voltar
            </button>
          </form>
        )}
      </li>
    );
  }

  return (
    <section className="sheet crr" aria-label="Entregas">
      {summary && <h2 className="crr-summary">{summary}</h2>}

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
      {held && (
        <p className="crr-held" role="note">
          <span aria-hidden="true">💵 </span>
          {held}
        </p>
      )}

      {nothing && !problem && (
        <p className="crr-empty" role="status">
          {EMPTY_TEXT}
        </p>
      )}

      {groups.going.length > 0 && (
        <>
          <h3 className="crr-title">A caminho</h3>
          <ul className="crr-list">{groups.going.map((order) => card(order, "going"))}</ul>
        </>
      )}

      {groups.ready.length > 0 && (
        <>
          <h3 className="crr-title">Prontos para pegar</h3>
          <ul className="crr-list">{groups.ready.map((order) => card(order, "ready"))}</ul>
        </>
      )}

      {groups.other.length > 0 && (
        <>
          <h3 className="crr-title">Com outros motoqueiros</h3>
          <ul className="crr-list">{groups.other.map((order) => card(order, "other"))}</ul>
        </>
      )}

      {groups.done.length > 0 && (
        <>
          <h3 className="crr-title">Entregues</h3>
          <ul className="crr-list crr-done">
            {groups.done.map((order) => {
              const cashCents = centsOf(order.cash_received);
              return (
                <li className="crr-card crr-card-done" key={order.id}>
                  <div className="crr-head">
                    <strong className="crr-who">{order.customer_name || "Cliente"}</strong>
                    <span className="crr-meta">{formatTime(order.delivered_at)}</span>
                  </div>
                  {cashCents > 0 && (
                    <p className="crr-meta">
                      {order.settled
                        ? `Dinheiro ${moneyText(cashCents)}: acertado com o caixa.`
                        : `Dinheiro ${moneyText(cashCents)}: ainda com você.`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button type="button" className="btn btn-quiet btn-block" onClick={() => void reload()}>
        Atualizar
      </button>
    </section>
  );
}
