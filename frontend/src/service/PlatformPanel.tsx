import { useEffect, useMemo, useState } from "react";
import "../ui.css";
import "../admin.css";
import "../plan.css";
import { fetchPlatformList, recordPlatformPayment } from "./subscriptionApi";
import {
  PAYMENT_METHODS,
  attentionSummary,
  blankPaymentForm,
  chargeMessage,
  filterCompanies,
  fullDate,
  needsAttention,
  paymentBody,
  paymentFormProblem,
  planAmountText,
  shortDate,
  stateLabel,
  whatsappUrl,
  type PaymentForm,
  type PlatformCompany,
  type PlatformList,
} from "./subscriptionView";

type Load = "loading" | "ready" | "error";

/**
 * Tab "Assinaturas", only for GD's logins (the server decides who): every restaurant with its plan, the late ones
 * first. Two buttons per restaurant: "Cobrar" opens WhatsApp with the message ready, and "Registrar pagamento" records
 * the month received (the server moves the due date). Nothing here touches the restaurant's data.
 */
export default function PlatformPanel() {
  const [load, setLoad] = useState<Load>("loading");
  const [data, setData] = useState<PlatformList | null>(null);
  const [error, setError] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentForm>({ amount: "", method: "pix", reference: "" });
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ id: string; text: string } | null>(null);

  async function open(keepFilter = false) {
    setLoad("loading");
    setError("");
    try {
      const list = await fetchPlatformList();
      setData(list);
      if (!keepFilter) setOnlyAttention(list.needs_attention > 0);
      setLoad("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui abrir a lista.");
      setLoad("error");
    }
  }

  useEffect(() => {
    void open();
  }, []);

  const shown = useMemo(
    () => filterCompanies(data?.companies ?? [], onlyAttention, search),
    [data, onlyAttention, search]
  );

  function startPayment(company: PlatformCompany) {
    setOpenId(company.company_id);
    setForm(blankPaymentForm(company.subscription));
    setFormError("");
    setDone(null);
  }

  async function send(company: PlatformCompany) {
    const problem = paymentFormProblem(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const result = await recordPlatformPayment(company.company_id, paymentBody(form));
      setOpenId(null);
      setDone({ id: company.company_id, text: `Registrado. Pago até ${fullDate(result.period_end)}.` });
      await open(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não consegui registrar o pagamento.");
    } finally {
      setSending(false);
    }
  }

  if (load === "loading" && !data) {
    return (
      <section className="sheet plan" aria-label="Assinaturas">
        <h2>Assinaturas</h2>
        <p className="adm-muted" role="status">
          Abrindo a lista…
        </p>
      </section>
    );
  }

  if (load === "error" && !data) {
    return (
      <section className="sheet plan" aria-label="Assinaturas">
        <h2>Assinaturas</h2>
        <p className="msg-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void open()}>
          Tentar de novo
        </button>
      </section>
    );
  }

  const total = data?.companies.length ?? 0;

  return (
    <section className="sheet plan" aria-label="Assinaturas">
      <h2>Assinaturas</h2>
      <p className="plan-summary">
        <strong>{attentionSummary(data?.needs_attention ?? 0)}</strong>
        <span className="adm-muted"> · {total} no total</span>
      </p>
      <p className="adm-muted">
        {data?.enforced
          ? "Cobrança LIGADA no servidor: quem vence fica sem pedido novo no dia seguinte."
          : "Cobrança DESLIGADA no servidor: ninguém é bloqueado, as situações são só informação."}
      </p>

      <div className="plan-filters">
        <button
          type="button"
          className={onlyAttention ? "btn btn-outline btn-sm is-on" : "btn btn-outline btn-sm"}
          aria-pressed={onlyAttention}
          onClick={() => setOnlyAttention(!onlyAttention)}
        >
          {onlyAttention ? "Só quem pede atenção" : "Todos"}
        </button>
        <label className="field plan-search">
          <span className="sr-only">Buscar restaurante</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar restaurante ou dono"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="adm-muted">{onlyAttention ? "Ninguém pede atenção agora." : "Nenhum restaurante encontrado."}</p>
      ) : (
        <ul className="plan-list">
          {shown.map((company) => {
            const plan = company.subscription;
            const label = stateLabel(plan);
            const charge = needsAttention(plan)
              ? whatsappUrl(company.owner_phone, chargeMessage(company.owner_name, company.name, plan))
              : null;
            const opened = openId === company.company_id;
            return (
              <li key={company.company_id} className={`plan-co plan-${label.tone}`}>
                <div className="plan-co-head">
                  <strong>{company.name}</strong>
                  <span className={label.tone === "ok" ? "chip chip-done" : label.tone === "quiet" ? "chip" : "chip chip-wait"}>
                    {label.text}
                  </span>
                </div>
                <p className="adm-muted plan-co-meta">
                  {company.owner_name || "Sem dono cadastrado"}
                  {plan.state !== "none" && ` · ${planAmountText(plan)}`}
                  {plan.due_date && ` · até ${shortDate(plan.due_date)}`}
                </p>

                {done?.id === company.company_id && (
                  <p className="msg-ok" role="status">
                    {done.text}
                  </p>
                )}

                {!opened && (
                  <div className="plan-actions">
                    {charge && (
                      <a className="btn btn-outline btn-sm" href={charge} target="_blank" rel="noreferrer">
                        Cobrar no WhatsApp
                      </a>
                    )}
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => startPayment(company)}>
                      Registrar pagamento
                    </button>
                  </div>
                )}

                {opened && (
                  <form
                    className="plan-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send(company);
                    }}
                  >
                    <label className="field">
                      <span>Valor recebido</span>
                      <input
                        inputMode="decimal"
                        value={form.amount}
                        onChange={(event) => setForm({ ...form, amount: event.target.value })}
                        autoComplete="off"
                      />
                    </label>
                    <label className="field">
                      <span>Como foi pago</span>
                      <select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Anotação (opcional)</span>
                      <input
                        value={form.reference}
                        maxLength={120}
                        onChange={(event) => setForm({ ...form, reference: event.target.value })}
                        placeholder="Ex.: Pix de 13/10"
                        autoComplete="off"
                      />
                    </label>
                    {formError && (
                      <p className="msg-error" role="alert">
                        {formError}
                      </p>
                    )}
                    <div className="plan-actions">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={sending}>
                        {sending ? "Registrando…" : `Registrar ${form.amount.trim() ? `R$ ${form.amount.trim()}` : "pagamento"} de ${company.name}`}
                      </button>
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpenId(null)} disabled={sending}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
