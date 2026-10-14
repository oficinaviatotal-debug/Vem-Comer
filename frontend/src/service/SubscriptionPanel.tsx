import { useState } from "react";
import "../ui.css";
import "../admin.css";
import "../plan.css";
import {
  amountDueCents,
  fullDate,
  methodLabel,
  ownerMessage,
  reais,
  shortDate,
  stateLabel,
  whatsappUrl,
  type OwnerPlan,
} from "./subscriptionView";

type Props = {
  plan: OwnerPlan;
  restaurantName: string;
};

/**
 * Tab "Plano": what the owner pays, until when, how to pay and what was paid. When the plan is blocked this is the
 * screen he lands on (the panel keeps only this and the orders in progress): it says nothing was deleted and that
 * paying brings the restaurant back at once.
 */
export default function SubscriptionPanel({ plan, restaurantName }: Props) {
  const [copied, setCopied] = useState(false);
  const label = stateLabel(plan);
  const { pix_key: pixKey, pix_receiver: receiver, contact_phone: contact } = plan.payment_info;
  const mustPay = plan.state !== "active" || plan.warning !== null;
  const askUrl = whatsappUrl(contact, ownerMessage("pay", restaurantName, plan));
  const paidUrl = whatsappUrl(contact, ownerMessage("paid", restaurantName, plan));

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false); // the key stays on screen, selectable
    }
  }

  return (
    <section className="sheet plan" aria-label="Plano">
      <h2>Plano</h2>

      <div className={`plan-status plan-${label.tone}`} role={plan.blocked ? "alert" : "status"}>
        <span className={label.tone === "ok" ? "chip chip-done" : label.tone === "quiet" ? "chip" : "chip chip-wait"}>
          {label.text}
        </span>
        <p className="plan-message">
          {plan.message || "Tudo em dia. Obrigado por usar o Vem Comer."}
        </p>
      </div>

      <dl className="plan-facts">
        <div>
          <dt>Valor por mês</dt>
          <dd>{reais(plan.price_cents)}</dd>
        </div>
        {(plan.intro_discount_percent ?? 0) > 0 && (
          <div>
            <dt>Primeiro pagamento</dt>
            <dd>
              {reais(amountDueCents(plan))} ({plan.intro_discount_percent}% de desconto)
            </dd>
          </div>
        )}
        {plan.due_date && (
          <div>
            <dt>{plan.state === "past_due" ? "Venceu em" : "Pago até"}</dt>
            <dd>{fullDate(plan.due_date)}</dd>
          </div>
        )}
      </dl>

      {mustPay && (
        <div className="plan-pay">
          <h3>Como pagar</h3>
          {pixKey ? (
            <>
              <p className="adm-muted">Pague por Pix{receiver ? ` para ${receiver}` : ""}:</p>
              <p className="plan-key">
                <code>{pixKey}</code>
              </p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyKey()}>
                {copied ? "Chave copiada" : "Copiar chave Pix"}
              </button>
            </>
          ) : (
            <p className="adm-muted">Peça a chave Pix pelo WhatsApp e pague o valor acima.</p>
          )}

          <div className="plan-actions">
            {paidUrl && (
              <a className="btn btn-primary" href={paidUrl} target="_blank" rel="noreferrer">
                Já paguei: mandar comprovante
              </a>
            )}
            {askUrl && (
              <a className="btn btn-outline" href={askUrl} target="_blank" rel="noreferrer">
                Falar com o suporte
              </a>
            )}
          </div>
          {!paidUrl && !askUrl && (
            <p className="adm-muted">Fale com o suporte do Vem Comer para pagar.</p>
          )}
          {plan.blocked && (
            <p className="adm-muted">
              Os pedidos que já estão em andamento continuam na aba Pedidos.
            </p>
          )}
        </div>
      )}

      {plan.payments.length > 0 && (
        <div className="plan-history">
          <h3>Pagamentos</h3>
          <ul>
            {plan.payments.map((payment) => (
              <li key={payment.id}>
                <span>{shortDate(payment.paid_at)}</span>
                <span>{reais(payment.amount_cents)}</span>
                <span>{methodLabel(payment.method)}</span>
                <span className="adm-muted">até {shortDate(payment.period_end)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
