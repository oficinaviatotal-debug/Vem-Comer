import { useState } from "react";
import { createFeedback } from "../service/api";
import { orderMemory } from "./orderMemory";

type Props = {
  companyId: string;
  orderId: string;
  /** Every order of this visit: one answer covers them all, so none asks again. */
  allOrderIds: string[];
  onSent: () => void;
};

const FOOD = ["ótima", "boa", "regular", "ruim"];
const SERVICE = ["ótimo", "bom", "regular", "ruim"];

function Choices(props: {
  legend: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="cust-choice cust-choice-4">
      <legend>{props.legend}</legend>
      {props.options.map((option) => (
        <label key={option} className="cust-choice-opt">
          <input
            type="radio"
            name={props.name}
            checked={props.value === option}
            onChange={() => props.onChange(option)}
          />
          <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Shown once an order is ready. One answer per visit, remembered on this phone. */
export default function OrderFeedback({ companyId, orderId, allOrderIds, onSent }: Props) {
  const [sent, setSent] = useState(() => orderMemory.feedbackSent(orderId));
  const [food, setFood] = useState("");
  const [service, setService] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (sent) {
    return <p className="cust-thanks">Obrigado pela sua avaliação!</p>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!food || !service || busy) return;
    setBusy(true);
    setError("");
    try {
      // The feedback table also has a delivery rating; table orders have no delivery.
      await createFeedback(companyId, food, service, "não se aplica", comment.trim());
      for (const id of new Set([orderId, ...allOrderIds])) orderMemory.markFeedbackSent(id);
      setSent(true);
      onSent();
    } catch {
      setError("Não deu para enviar a avaliação. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cust-feedback" onSubmit={submit}>
      <h3>Como foi?</h3>
      <Choices legend="A comida" name={`food-${orderId}`} options={FOOD} value={food} onChange={setFood} />
      <Choices
        legend="O atendimento"
        name={`service-${orderId}`}
        options={SERVICE}
        value={service}
        onChange={setService}
      />
      <label className="field">
        <span>Quer contar mais? (opcional)</span>
        <textarea
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {error && (
        <p className="msg-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-mata btn-block" disabled={!food || !service || busy}>
        {busy ? "Enviando…" : "Enviar avaliação"}
      </button>
    </form>
  );
}
