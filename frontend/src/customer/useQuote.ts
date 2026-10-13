import { useEffect, useState } from "react";
import { cepDigits, type Quote } from "./delivery";
import { quoteDelivery } from "./deliveryApi";

type Answer = { cep: string; quote: Quote | null; failed: boolean };

export type QuoteState = {
  /** The answer for the CEP on the screen now; never one for a CEP that was edited since. */
  quote: Quote | null;
  quoting: boolean;
  failed: boolean;
  retry: () => void;
};

/** Asks the server "delivery to this CEP?" as soon as the CEP has 8 digits, and again when it changes. */
export function useQuote(companyId: string, cep: string, enabled: boolean): QuoteState {
  const digits = cepDigits(cep);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const wants = enabled && digits.length === 8;

  useEffect(() => {
    if (!wants) return;
    const controller = new AbortController();
    quoteDelivery(companyId, digits, controller.signal)
      .then((quote) => setAnswer({ cep: digits, quote, failed: false }))
      .catch(() => {
        if (!controller.signal.aborted) setAnswer({ cep: digits, quote: null, failed: true });
      });
    return () => controller.abort();
  }, [companyId, digits, wants, attempt]);

  const current = wants && answer && answer.cep === digits ? answer : null;
  return {
    quote: current?.quote ?? null,
    quoting: wants && current === null,
    failed: current?.failed ?? false,
    retry: () => {
      setAnswer(null);
      setAttempt((n) => n + 1);
    },
  };
}
