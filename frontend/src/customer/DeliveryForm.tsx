import { ADDRESS_LIMITS, MODE_LABELS, hasFullCep, maskCep, maskPhone, quoteLine, type Address, type Mode, type Quote } from "./delivery";

/** What the cart sheet needs to show pickup and delivery. */
export type DeliveryView = {
  /** The ways to receive the order the restaurant offers; empty means nothing to choose. */
  offered: Mode[];
  mode: Mode | null;
  onMode: (mode: Mode) => void;
  /** Delivery is turned off for now (the restaurant has regions): only a note. */
  paused: boolean;
  address: Address;
  onAddress: (address: Address) => void;
  phone: string;
  onPhone: (phone: string) => void;
  quote: Quote | null;
  quoting: boolean;
  quoteFailed: boolean;
  onRetryQuote: () => void;
  /** The address on the screen came from this phone's memory. */
  remembered: boolean;
  onForget: () => void;
};

/** "Como você quer receber?": two big tiles, only when the restaurant offers both. */
export function DeliveryChoice({ view }: { view: DeliveryView }) {
  if (view.paused && view.offered.length === 0) {
    return (
      <p className="cust-note" role="status" id="cust-delivery-paused">
        A entrega está pausada agora. Você pode retirar no local.
      </p>
    );
  }
  if (view.offered.length < 2) return null;
  return (
    <fieldset className="cust-choice cust-choice-2" id="cust-mode">
      <legend>Como você quer receber?</legend>
      {view.offered.map((mode) => (
        <label key={mode} className="cust-choice-opt">
          <input
            type="radio"
            name="mode"
            value={mode}
            checked={view.mode === mode}
            onChange={() => view.onMode(mode)}
          />
          <span>{MODE_LABELS[mode]}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** CEP first (it gives the fee), then the address and the phone. Only shown for a delivery. */
export function DeliveryForm({ view }: { view: DeliveryView }) {
  if (view.mode !== "entrega") return null;
  const { address } = view;
  const set = (patch: Partial<Address>) => view.onAddress({ ...address, ...patch });
  const full = hasFullCep(address.cep);
  const line = quoteLine(view.quote);

  return (
    <section className="cust-delivery" id="cust-delivery" aria-label="Endereço de entrega">
      <h3>Endereço de entrega</h3>

      <label className="field">
        <span>CEP</span>
        <input
          value={maskCep(address.cep)}
          onChange={(event) => set({ cep: maskCep(event.target.value) })}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
        />
      </label>

      {full && view.quoting && (
        <p className="cust-note" role="status">
          Conferindo o CEP…
        </p>
      )}
      {full && !view.quoting && view.quoteFailed && (
        <div className="cust-note" role="alert">
          <p>Não deu para conferir o CEP. Confira a internet.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={view.onRetryQuote}>
            Tentar de novo
          </button>
        </div>
      )}
      {full && !view.quoting && !view.quoteFailed && view.quote && (
        <p
          className={view.quote.available ? "cust-quote is-ok" : "cust-quote is-no"}
          role="status"
          id="cust-quote"
        >
          {line}
        </p>
      )}
      {!full && (
        <p className="cust-hint">Digite o CEP para ver a taxa e o prazo.</p>
      )}

      <label className="field">
        <span>Rua</span>
        <input
          value={address.street}
          onChange={(event) => set({ street: event.target.value })}
          maxLength={ADDRESS_LIMITS.street}
          autoComplete="address-line1"
          placeholder="Nome da rua ou avenida"
        />
      </label>

      <div className="cust-addr-row">
        <label className="field">
          <span>Número</span>
          <input
            value={address.number}
            onChange={(event) => set({ number: event.target.value })}
            maxLength={ADDRESS_LIMITS.number}
            autoComplete="off"
            placeholder="120 ou S/N"
          />
        </label>
        <label className="field">
          <span>Complemento (opcional)</span>
          <input
            value={address.complement}
            onChange={(event) => set({ complement: event.target.value })}
            maxLength={ADDRESS_LIMITS.complement}
            autoComplete="address-line2"
            placeholder="Apto, bloco, casa dos fundos"
          />
        </label>
      </div>

      <label className="field">
        <span>Bairro</span>
        <input
          value={address.neighborhood}
          onChange={(event) => set({ neighborhood: event.target.value })}
          maxLength={ADDRESS_LIMITS.neighborhood}
          autoComplete="address-level3"
        />
      </label>

      <label className="field">
        <span>Ponto de referência (opcional)</span>
        <input
          value={address.reference}
          onChange={(event) => set({ reference: event.target.value })}
          maxLength={ADDRESS_LIMITS.reference}
          autoComplete="off"
          placeholder="Ex.: portão azul, em frente à padaria"
        />
      </label>

      <label className="field">
        <span>Telefone com DDD</span>
        <input
          value={maskPhone(view.phone)}
          onChange={(event) => view.onPhone(maskPhone(event.target.value))}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(31) 99999-8888"
          maxLength={15}
        />
        <small>O entregador usa para avisar que chegou.</small>
      </label>

      {view.remembered && (
        <button type="button" className="btn btn-quiet btn-sm" onClick={view.onForget}>
          Esquecer meu endereço neste aparelho
        </button>
      )}
    </section>
  );
}
