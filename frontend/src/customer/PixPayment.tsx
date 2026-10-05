import { useEffect, useRef, useState } from "react";
import { fetchOrderPix, HttpError, type PixCode } from "../service/api";
import { copyText } from "../service/clipboard";
import { formatMoney } from "../service/format";
import { orderPaymentView } from "./payment";

type Props = {
  orderId: string;
  token: string;
  method?: string;
  status?: string;
  /**
   * Element ids must be unique on the page, so only the slip the guide points at
   * carries them (the guide looks for #cust-pix-copy and #cust-pix-status).
   */
  guideTarget: boolean;
  onHelp: () => void;
};

type Load = "loading" | "ready" | "missing" | "error";
type Copied = "" | "ok" | "manual";

/** The payment part of the order slip: the Pix code to pay, "received", or what to do at the table. */
export default function PixPayment(props: Props) {
  const view = orderPaymentView(props.method, props.status);

  if (view.kind === "paid") {
    return (
      <div className="cust-pay is-paid" id={props.guideTarget ? "cust-pix-status" : undefined} role="status">
        <strong>Pagamento recebido</strong>
        <span>Obrigado! O restaurante confirmou o seu pagamento.</span>
      </div>
    );
  }

  if (view.kind === "at-table") {
    return <p className="cust-note">{view.text}</p>;
  }

  return <PixDue {...props} />;
}

function PixDue({ orderId, token, guideTarget, onHelp }: Props) {
  const [state, setState] = useState<Load>("loading");
  const [code, setCode] = useState<PixCode | null>(null);
  const [copied, setCopied] = useState<Copied>("");
  const [attempt, setAttempt] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchOrderPix(orderId, token)
      .then((found) => {
        if (!alive) return;
        setCode(found);
        setState("ready");
      })
      .catch((error) => {
        if (!alive) return;
        // 404: the restaurant has no Pix any more. Anything else: try again.
        setState(error instanceof HttpError && error.status === 404 ? "missing" : "error");
      });
    return () => {
      alive = false;
    };
  }, [orderId, token, attempt]);

  async function copy() {
    if (!code) return;
    const done = await copyText(code.payload, field.current);
    setCopied(done ? "ok" : "manual");
  }

  if (state === "missing") {
    return <p className="cust-note">Você acerta o pagamento com o atendente.</p>;
  }

  return (
    <section className="cust-pix" aria-label="Pagamento com Pix">
      <h3>Pague com Pix</h3>

      {state === "error" ? (
        <>
          <p className="msg-error" role="alert">
            Não deu para mostrar o código agora. Confira a internet.
          </p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </>
      ) : (
        <>
          <div className="leader-row cust-pix-amount">
            <span>Valor</span>
            <span className="leader" aria-hidden="true" />
            <span className="money">{code ? formatMoney(code.amount) : "…"}</span>
          </div>
          {code && <p className="cust-note">Recebedor: {code.receiver_name}</p>}

          <button
            type="button"
            id={guideTarget ? "cust-pix-copy" : undefined}
            className="btn btn-primary btn-block"
            onClick={() => void copy()}
            disabled={!code}
          >
            {code ? "Copiar código Pix" : "Gerando o código…"}
          </button>

          <p className="cust-note cust-pix-copied" role="status">
            {copied === "ok" && "Código copiado. Agora cole no app do seu banco."}
            {copied === "manual" && "Não deu para copiar sozinho. Toque e segure no código abaixo para copiar."}
          </p>

          <ol className="cust-pix-steps">
            <li>Abra o app do seu banco e escolha Pix, depois Pix Copia e Cola.</li>
            <li>Cole o código, confira o valor e o nome do recebedor e pague.</li>
          </ol>

          {code && (
            <>
              <label className="field">
                <span>Código Pix Copia e Cola</span>
                <textarea
                  ref={field}
                  readOnly
                  rows={4}
                  value={code.payload}
                  onFocus={(event) => event.currentTarget.select()}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </label>

              <figure className="cust-pix-qr">
                <img src={code.qr_data_url} alt="QR code Pix deste pedido" width={200} height={200} />
                <figcaption className="cust-note">Ou leia este QR code com o app do banco em outro celular.</figcaption>
              </figure>
            </>
          )}

          <p className="cust-pay" id={guideTarget ? "cust-pix-status" : undefined} role="status">
            <span>Depois de pagar, o restaurante confirma e aqui aparece Pagamento recebido.</span>
          </p>
        </>
      )}

      <button type="button" className="btn btn-quiet btn-sm" onClick={onHelp}>
        Como pagar? Me ajude
      </button>
    </section>
  );
}
