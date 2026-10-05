import { useEffect, useRef } from "react";
import { formatMoney } from "../service/format";
import { cartTotalCents, lineTotalCents, type CartLine } from "./cart";
import type { PaymentMethod } from "./types";
import QuantityStepper from "./QuantityStepper";

type Props = {
  cart: CartLine[];
  tableNumber: number | null;
  tableLost: boolean;
  name: string;
  onName: (value: string) => void;
  payment: PaymentMethod;
  onPayment: (value: PaymentMethod) => void;
  paid: string;
  onPaid: (value: string) => void;
  sending: boolean;
  error: string;
  onMore: (line: CartLine) => void;
  onLess: (id: string) => void;
  onSend: () => void;
  onClose: () => void;
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
];

/** Bottom sheet with the order slip (comanda), the customer's name and payment. */
export default function CartSheet(props: Props) {
  const { cart, payment, sending, error } = props;
  const total = cartTotalCents(cart);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(props.onClose);

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
                    <p className="comanda-where">
                      {props.tableNumber ? `Mesa ${props.tableNumber}` : "Pedido"}
                    </p>
                    <p className="comanda-meta">Confira antes de enviar</p>
                  </div>
                </div>

                <ul className="comanda-items">
                  {cart.map((line) => (
                    <li className="cust-line" key={line.id}>
                      <div className="leader-row">
                        <span>{line.name}</span>
                        <span className="leader" aria-hidden="true" />
                        <span className="money">{formatMoney(lineTotalCents(line) / 100)}</span>
                      </div>
                      <QuantityStepper
                        label={line.name}
                        quantity={line.quantity}
                        onMore={() => props.onMore(line)}
                        onLess={() => props.onLess(line.id)}
                      />
                    </li>
                  ))}
                </ul>

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

            <label className="field" id="cust-name">
              <span>Seu nome (opcional)</span>
              <input
                value={props.name}
                onChange={(event) => props.onName(event.target.value)}
                maxLength={60}
                autoComplete="given-name"
                placeholder="Como podemos te chamar?"
              />
            </label>

            <fieldset className="cust-choice" id="cust-payment">
              <legend>Como você vai pagar?</legend>
              {METHODS.map((method) => (
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

            <p className="cust-note">Você acerta o pagamento com o atendente.</p>

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
