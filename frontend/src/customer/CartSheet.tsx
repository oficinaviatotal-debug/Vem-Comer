import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../service/format";
import { cartTotalCents, lineKey, lineTotalCents, type CartLine } from "./cart";
import { DeliveryChoice, DeliveryForm, type DeliveryView } from "./DeliveryForm";
import { feeCents, whereLabel } from "./delivery";
import ItemDetails from "./ItemDetails";
import { NOTE_MAX, cleanNote, noteProblem } from "./options";
import type { PaymentMethod } from "./types";
import { availableMethods, paymentNote } from "./payment";
import QuantityStepper from "./QuantityStepper";

type Props = {
  cart: CartLine[];
  tableNumber: number | null;
  tableLost: boolean;
  name: string;
  onName: (value: string) => void;
  payment: PaymentMethod;
  /** The restaurant set a Pix key, so Pix is offered. */
  pixOn: boolean;
  /** Pickup / delivery: what is offered, the CEP, the address and the phone. */
  delivery: DeliveryView;
  onPayment: (value: PaymentMethod) => void;
  paid: string;
  onPaid: (value: string) => void;
  sending: boolean;
  error: string;
  /** One more / one less of a line, by its key. */
  onMore: (key: string) => void;
  onLess: (key: string) => void;
  /** Writes (or clears, with an empty text) the note of a line. */
  onNote: (key: string, note: string) => void;
  /** Reopens the choices of a line with options; missing when the dish is not on the menu any more. */
  onEdit: (line: CartLine) => void;
  canEdit: (line: CartLine) => boolean;
  onSend: () => void;
  onClose: () => void;
};

/** Small form under a line to write what the kitchen should know ("sem cebola"). */
function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const problem = noteProblem(draft);
  const boxRef = useRef<HTMLDivElement>(null);
  // The form opens at the bottom of a long order: bring it (and its Save button) into view, above the send bar.
  useEffect(() => {
    boxRef.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="cust-note-edit" ref={boxRef}>
      <label className="field">
        <span>Observação para a cozinha</span>
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={NOTE_MAX}
          placeholder="Ex.: sem cebola, bem passado"
          enterKeyHint="done"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !problem) onSave(cleanNote(draft));
          }}
        />
        <small>
          {draft.length}/{NOTE_MAX}
        </small>
      </label>
      {problem && (
        <p className="msg-error" role="alert">
          {problem}
        </p>
      )}
      <div className="cust-note-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(problem)} onClick={() => onSave(cleanNote(draft))}>
          Salvar
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Bottom sheet with the order slip (comanda), the customer's name and payment. */
export default function CartSheet(props: Props) {
  const { cart, payment, sending, error, delivery } = props;
  const subtotal = cartTotalCents(cart);
  // The fee is the one the server announced for this CEP (it charges its own again when the order arrives)
  const delivering = delivery.mode === "entrega" && !props.tableNumber;
  const fee = delivering ? feeCents(delivery.quote) : 0;
  const showFee = delivering && delivery.quote?.available === true;
  const total = subtotal + fee;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(props.onClose);
  // Key of the line whose note is being written.
  const [noteOf, setNoteOf] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current = props.onClose;
  }, [props.onClose]);

  // Keep the page behind from scrolling, close with Esc, and start reading
  // from the top of the sheet (useful for screen readers).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="cust-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="cust-sheet" role="dialog" aria-modal="true" aria-labelledby="cust-sheet-title">
        <div className="cust-sheet-bar">
          <h2 id="cust-sheet-title" ref={titleRef} tabIndex={-1}>
            Seu pedido
          </h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={props.onClose}>
            Voltar ao cardápio
          </button>
        </div>

        {cart.length === 0 ? (
          <p className="cust-empty">
            Seu pedido está vazio. Volte ao cardápio e toque em Adicionar.
          </p>
        ) : (
          <>
            <div className="comanda-wrap">
              <div className="comanda">
                <div className="comanda-head">
                  <div>
                    <p className="comanda-where">{whereLabel(delivery.mode, props.tableNumber)}</p>
                    <p className="comanda-meta">Confira antes de enviar</p>
                  </div>
                </div>

                <ul className="comanda-items">
                  {cart.map((line) => {
                    const key = lineKey(line);
                    return (
                      <li className="cust-line" key={key}>
                        <div className="leader-row">
                          <span>{line.name}</span>
                          <span className="leader" aria-hidden="true" />
                          <span className="money">{formatMoney(lineTotalCents(line) / 100)}</span>
                        </div>
                        <ItemDetails options={line.options} note={line.note} />
                        <div className="cust-line-actions">
                          <QuantityStepper
                            label={line.name}
                            quantity={line.quantity}
                            onMore={() => props.onMore(key)}
                            onLess={() => props.onLess(key)}
                          />
                          <div className="cust-line-links">
                            {line.options?.length && props.canEdit(line) ? (
                              <button type="button" className="btn btn-quiet btn-sm" onClick={() => props.onEdit(line)}>
                                Mudar opções
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              onClick={() => setNoteOf(noteOf === key ? null : key)}
                              aria-expanded={noteOf === key}
                            >
                              Observação
                            </button>
                          </div>
                        </div>
                        {noteOf === key && (
                          <NoteEditor
                            initial={line.note ?? ""}
                            onSave={(text) => {
                              props.onNote(key, text);
                              setNoteOf(null);
                            }}
                            onCancel={() => setNoteOf(null)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>

                {showFee && (
                  <>
                    <div className="leader-row cust-subtotal">
                      <span>Pratos</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="money">{formatMoney(subtotal / 100)}</span>
                    </div>
                    <div className="leader-row cust-subtotal">
                      <span>Taxa de entrega</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="money">{fee === 0 ? "Grátis" : formatMoney(fee / 100)}</span>
                    </div>
                  </>
                )}

                <div className="leader-row comanda-total">
                  <span>Total</span>
                  <span className="leader" aria-hidden="true" />
                  <span className="money">{formatMoney(total / 100)}</span>
                </div>
              </div>
            </div>

            {props.tableLost && (
              <p className="cust-note" role="alert">
                Não encontramos esta mesa. Se o envio não funcionar, chame o atendente.
              </p>
            )}

            <DeliveryChoice view={delivery} />

            <label className="field" id="cust-name">
              <span>{delivering ? "Seu nome" : "Seu nome (opcional)"}</span>
              <input
                value={props.name}
                onChange={(event) => props.onName(event.target.value)}
                maxLength={60}
                autoComplete="given-name"
                placeholder="Como podemos te chamar?"
              />
            </label>

            <DeliveryForm view={delivery} />

            <fieldset className={props.pixOn ? "cust-choice" : "cust-choice cust-choice-2"} id="cust-payment">
              <legend>Como você vai pagar?</legend>
              {availableMethods(props.pixOn).map((method) => (
                <label key={method.value} className="cust-choice-opt">
                  <input
                    type="radio"
                    name="payment"
                    value={method.value}
                    checked={payment === method.value}
                    onChange={() => props.onPayment(method.value)}
                  />
                  <span>{method.label}</span>
                </label>
              ))}
            </fieldset>

            {payment === "dinheiro" && (
              <div className="cust-cash">
                <label className="field">
                  <span>Vou pagar com (R$)</span>
                  <input
                    value={props.paid}
                    onChange={(event) => props.onPaid(event.target.value)}
                    inputMode="decimal"
                    placeholder="Ex.: 50"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => props.onPaid((total / 100).toFixed(2).replace(".", ","))}
                >
                  Tenho o valor certinho
                </button>
              </div>
            )}

            <p className="cust-note">{paymentNote(payment)}</p>

            {error && (
              <p className="msg-error" role="alert">
                {error}
              </p>
            )}

            <div className="cust-send-wrap">
              <button
                type="button"
                id="cust-send"
                className="btn btn-primary btn-block"
                onClick={props.onSend}
                disabled={sending}
              >
                {sending ? "Enviando…" : `Enviar pedido · ${formatMoney(total / 100)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
