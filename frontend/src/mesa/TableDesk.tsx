import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "../ui.css";
import "./tableDesk.css";
import { answerTableCall, fetchTableCalls, fetchTables } from "../service/api";
import { formatMoney } from "../service/format";
import { statusLabel, statusTone } from "../service/orderStatus";
import { waitText, waitingMinutes } from "../nav/navLogic";
import NavIcon from "../nav/NavIcon";
import QrScanner from "./QrScanner";
import { formatWaiting, parsePanelCalls, type PanelCall } from "./callsLogic";
import {
  DESK_POLL_MS,
  NO_CALLS,
  NO_ORDERS,
  NO_SCAN_TEXT,
  activeOrdersOfTable,
  callsOfTable,
  codeMessage,
  deskTiles,
  readTableCode,
  scanSupport,
  tableById,
  tableByNumber,
  tableHeadline,
  tableTitle,
  type DeskOrder,
  type ScanSupport,
  type TableRef,
} from "./tableDeskLogic";

type Props = {
  companyId: string;
  slug: string;
  /** The orders the panel already polls every few seconds. */
  orders: DeskOrder[];
  /** The customer link of one table: where a waiter takes an order for a guest who does not use the phone. */
  tableUrl: (tableId: string) => string;
};

/** What this phone can do to read a QR inside the app. */
function detectSupport(): ScanSupport {
  if (typeof window === "undefined") return "none";
  const policy = (document as unknown as { permissionsPolicy?: { allowsFeature(name: string): boolean } })
    .permissionsPolicy;
  return scanSupport({
    hasDetector: "BarcodeDetector" in window,
    hasCamera: Boolean(navigator.mediaDevices?.getUserMedia),
    secure: window.isSecureContext,
    policyAllows: policy ? policy.allowsFeature("camera") : undefined,
  });
}

/**
 * "Abrir mesa": the waiter reads the QR of the table with the camera (or types the number, or taps it in the list)
 * and lands on that table: who is calling, what is in progress and the button to take an order for it.
 *
 * Nothing here changes an order or the money. The only thing it can do is mark a call as answered, the same button
 * the bar at the top of the panel has.
 */
export default function TableDesk({ companyId, slug, orders, tableUrl }: Props) {
  const [tables, setTables] = useState<TableRef[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [calls, setCalls] = useState<PanelCall[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [callError, setCallError] = useState("");
  const support = useMemo(detectSupport, []);
  const typedField = useRef<HTMLInputElement | null>(null);

  const loadTables = useCallback(async () => {
    setLoadError("");
    try {
      const rows: unknown = await fetchTables(companyId);
      const list: TableRef[] = Array.isArray(rows)
        ? rows
            .filter((row): row is TableRef => Boolean(row) && typeof row.id === "string" && Number(row.number) > 0)
            .map((row) => ({ id: row.id, number: Number(row.number), status: row.status }))
        : [];
      setTables(list);
    } catch {
      setLoadError("Não consegui abrir a lista de mesas. Confira a internet.");
    }
  }, [companyId]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const refreshCalls = useCallback(async () => {
    if (document.hidden) return;
    try {
      setCalls(parsePanelCalls(await fetchTableCalls(companyId)));
    } catch {
      /* weak signal: keeps what is on screen and tries again */
    }
  }, [companyId]);

  useEffect(() => {
    void refreshCalls();
    const timer = window.setInterval(() => void refreshCalls(), DESK_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void refreshCalls();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCalls]);

  const tiles = useMemo(() => deskTiles(tables ?? [], orders, calls), [tables, orders, calls]);
  const table = selected && tables ? tableById(tables, selected) : null;

  function open(next: TableRef) {
    setSelected(next.id);
    setMessage("");
    setTyped("");
    setCallError("");
    window.scrollTo({ top: 0 });
  }

  function onCode(text: string) {
    setScanning(false);
    const read = readTableCode(text, slug);
    const found = read.kind === "table" && tables ? tableById(tables, read.tableId) : null;
    if (found) open(found);
    else setMessage(codeMessage(read, false));
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    if (!tables) return;
    const found = tableByNumber(tables, typed);
    if (found) {
      open(found);
    } else {
      setMessage(typed.trim() ? "Não achei essa mesa no cadastro. Confira o número ou toque na lista." : "Digite o número da mesa.");
      typedField.current?.focus();
    }
  }

  async function answer(call: PanelCall) {
    setCallError("");
    setCalls((current) => current.filter((item) => item.id !== call.id));
    try {
      await answerTableCall(companyId, call.id);
    } catch {
      setCallError("Não deu para marcar como atendida. Confira a internet.");
      void refreshCalls();
    }
  }

  // ---------------------------------------------------------------- one table

  if (table) {
    const tableCalls = callsOfTable(calls, table.number);
    const tableOrders = activeOrdersOfTable(orders, table.number);
    return (
      <section className="td" aria-label={tableTitle(table.number)}>
        <button type="button" className="td-back" onClick={() => setSelected(null)}>
          <span aria-hidden="true">‹</span> Outras mesas
        </button>
        <div className="sheet td-card">
          <h2 className="td-title">{tableTitle(table.number)}</h2>
          <p className="td-headline" role="status" aria-live="polite">
            {tableHeadline(tableCalls.length, tableOrders.length)}
          </p>

          <h3 className="td-h3">Chamados</h3>
          {tableCalls.length === 0 ? (
            <p className="adm-muted">{NO_CALLS}</p>
          ) : (
            <ul className="td-list">
              {tableCalls.map((call) => (
                <li key={call.id} className={`td-row td-call${call.urgency === "urgent" ? " is-urgent" : ""}`}>
                  <span className="td-row-text">
                    <strong>{call.text}</strong>
                    <small>
                      {formatWaiting(call.waiting_seconds)}
                      {call.repeats > 0 ? ", chamou de novo" : ""}
                    </small>
                  </span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void answer(call)}>
                    Atender
                  </button>
                </li>
              ))}
            </ul>
          )}
          {callError && (
            <p className="msg-error" role="alert">
              {callError}
            </p>
          )}

          <h3 className="td-h3">Pedidos em andamento</h3>
          {tableOrders.length === 0 ? (
            <p className="adm-muted">{NO_ORDERS}</p>
          ) : (
            <ul className="td-list">
              {tableOrders.map((order) => {
                const minutes = waitingMinutes(order.created_at, Date.now());
                return (
                  <li key={order.id} className="td-row">
                    <span className="td-row-text">
                      <strong>{order.customer_name || "Sem nome"}</strong>
                      <small>
                        <span className={`td-chip td-chip-${statusTone(order.status)}`}>
                          {statusLabel(order.status, "mesa")}
                        </span>
                        {minutes !== null ? ` ${waitText(minutes)}` : ""}
                      </small>
                    </span>
                    <span className="td-money">{formatMoney(Number(order.total_price) || 0)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <a className="btn btn-primary btn-block td-order" href={tableUrl(table.id)} target="_blank" rel="noopener noreferrer">
            Fazer um pedido para esta mesa
          </a>
          <p className="td-fine">Abre o cardápio desta mesa, como o cliente vê, para você pedir por ele.</p>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------- which table

  return (
    <section className="td" aria-label="Abrir mesa">
      <h2 className="td-ask">Qual mesa?</h2>

      {scanning ? (
        <QrScanner
          onCode={onCode}
          onFail={(text) => {
            setScanning(false);
            setMessage(text);
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <>
          {support === "camera" ? (
            <button
              type="button"
              className="btn btn-primary btn-block td-scan-btn"
              disabled={!tables}
              onClick={() => {
                setMessage("");
                setScanning(true);
              }}
            >
              <NavIcon name="qr" size={26} /> Ler o QR da mesa
            </button>
          ) : (
            <p className="td-fine">{NO_SCAN_TEXT}</p>
          )}

          <form className="td-type" onSubmit={submitTyped}>
            <label className="field">
              <span>Ou digite o número da mesa</span>
              <input
                ref={typedField}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="go"
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setMessage("");
                }}
                placeholder="Ex.: 4"
                maxLength={8}
              />
            </label>
            <button type="submit" className="btn btn-outline" disabled={!tables}>
              Abrir
            </button>
          </form>

          <p className="td-message" role="status" aria-live="polite">
            {message}
          </p>
          {loadError && (
            <p className="msg-error" role="alert">
              {loadError}{" "}
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => void loadTables()}>
                Tentar de novo
              </button>
            </p>
          )}

          {tables === null && !loadError && <p className="adm-muted">Abrindo as mesas…</p>}
          {tables !== null && tiles.length === 0 && (
            <p className="adm-muted">Ainda não há mesas cadastradas. Cadastre em Mesas, no menu.</p>
          )}
          {tiles.length > 0 && (
            <>
              <h3 className="td-h3">Todas as mesas</h3>
              <div className="td-grid">
                {tiles.map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    className={`td-tile td-tile-${tile.tone}`}
                    aria-label={`Mesa ${tile.number}: ${tile.note}`}
                    onClick={() => {
                      const found = tableById(tables ?? [], tile.id);
                      if (found) open(found);
                    }}
                  >
                    <span className="td-tile-number">{tile.number}</span>
                    <span className="td-tile-note">{tile.note}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
