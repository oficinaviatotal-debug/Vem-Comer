import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import "./novo.css";
import NvIcon, { type NvIconName } from "./Icons";
import { money } from "./format";
import type { Bag, BagDelivery } from "./types";

/** Quanto a observação de uma linha pode ter (o servidor recusa mais que isso; ver customer/options.ts). */
const NOTE_MAX = 140;

type Props = {
  bag: Bag;
  /** O pedido está indo ao servidor: o botão espera para não mandar duas vezes. */
  sending?: boolean;
  /** Frase pronta quando algo deu errado; diz o que fazer. */
  error?: string | null;
  onBack?: () => void;
  onMore?: (key: string) => void;
  onLess?: (key: string) => void;
  /** "Mudar opções": reabre as escolhas da linha. */
  onEditLine?: (key: string) => void;
  /** Escreve (ou apaga, com texto vazio) a observação de uma linha. */
  onNote?: (key: string, text: string) => void;
  onMode?: (id: string) => void;
  onName?: (value: string) => void;
  /** Muda um campo do endereço; vem só o campo que mudou. */
  onAddress?: (patch: Partial<Pick<BagDelivery, "cep" | "street" | "number" | "complement" | "neighborhood" | "reference">>) => void;
  onPhone?: (value: string) => void;
  onRetryQuote?: () => void;
  onForget?: () => void;
  onPayment?: (id: string) => void;
  onPaid?: (value: string) => void;
  onSend?: () => void;
};

const PICK_ICON: Record<string, NvIconName> = {
  retirada: "store",
  entrega: "home",
  pix: "pix",
  cartao: "card",
  dinheiro: "cash",
};

/** Uma opção de "como receber" ou "como pagar": tecla que sobe; a que vale fica afundada e verde. */
function Picks({ label, options, onPick }: { label: string; options: Bag["modes"]; onPick?: (id: string) => void }) {
  return (
    <section className="nv-block" aria-label={label}>
      <h2 className="nv-h2">{label}</h2>
      <div className={`nv-picks${options.length >= 3 ? " is-3" : ""}`} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.on}
            className={`nv-pick${option.on ? " is-on" : ""}`}
            onClick={() => onPick?.(option.id)}
          >
            <NvIcon name={PICK_ICON[option.id] ?? "check"} />
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** O campo que o cliente escreve: rótulo em cima, campo afundado embaixo. */
function Text({
  label,
  value,
  onChange,
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="nv-text">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange?.(event.target.value)} {...rest} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** A observação de uma linha: abre embaixo dela, com Salvar e Cancelar. */
function NoteEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const tooLong = draft.replace(/\s+/g, " ").trim().length > NOTE_MAX;
  return (
    <div className="nv-note-edit">
      <Text
        label="Observação para a cozinha"
        value={draft}
        onChange={setDraft}
        placeholder="Ex.: sem cebola, bem passado"
        enterKeyHint="done"
        autoFocus
        hint={`${draft.length}/${NOTE_MAX}`}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !tooLong) onSave(draft);
        }}
      />
      {tooLong ? (
        <p className="nv-error" role="alert">
          A observação pode ter até {NOTE_MAX} letras.
        </p>
      ) : null}
      <div className="nv-note-actions">
        <button type="button" className="nv-btn is-green is-small" disabled={tooLong} onClick={() => onSave(draft)}>
          Salvar
        </button>
        <button type="button" className="nv-btn is-ghost is-small" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * A sacola do cliente: a comanda (cada prato com + e −, "Mudar opções" e "Observação"), o total, como receber, o nome,
 * o endereço, como pagar e o botão grande de enviar. Tudo recebe o que mostrar por props; quem liga ao servidor vem depois.
 * O − de um prato que está em 1 vira lixeira: tirar o último deixa claro que o prato sai do pedido.
 */
export default function BagScreen({
  bag,
  sending = false,
  error = null,
  onBack,
  onMore,
  onLess,
  onEditLine,
  onNote,
  onMode,
  onName,
  onAddress,
  onPhone,
  onRetryQuote,
  onForget,
  onPayment,
  onPaid,
  onSend,
}: Props) {
  const [noteOf, setNoteOf] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // O aviso de erro aparece perto do botão de enviar, mas a pessoa pode estar lá em cima: traz o aviso para a vista.
  useEffect(() => {
    if (!error) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    errorRef.current?.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [error]);
  const empty = bag.lines.length === 0;
  const { delivery } = bag;

  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-bag">
        <header className="nv-top">
          <button type="button" className="nv-icon-btn" aria-label="Voltar ao cardápio" onClick={onBack}>
            <NvIcon name="back" />
          </button>
          <div className="nv-top-text">
            <h1 className="nv-name">Seu pedido</h1>
            <p className="nv-sub">{empty ? "Nada na sacola ainda" : `${bag.where}. Confira antes de enviar`}</p>
          </div>
        </header>

        {bag.notices.map((text) => (
          <p key={text} className="nv-notice" role="status">
            {text}
          </p>
        ))}

        {empty ? (
          <>
            <p className="nv-empty">{bag.emptyText}</p>
            <button type="button" className="nv-btn is-green is-block" onClick={onBack}>
              Voltar ao cardápio
            </button>
          </>
        ) : (
          <>
            <section className="nv-slip" aria-label="Seus pratos">
              <ul className="nv-slip-lines">
                {bag.lines.map((line) => (
                  <li key={line.key}>
                    <p className="nv-slip-top">
                      <span>{line.name}</span>
                      <span>{money(line.total)}</span>
                    </p>
                    {line.detail ? <p className="nv-slip-detail">{line.detail}</p> : null}
                    {line.note ? (
                      <p className="nv-slip-note">
                        <b>Obs.:</b> {line.note}
                      </p>
                    ) : null}
                    <div className="nv-slip-actions">
                      <span className="nv-step" role="group" aria-label={`Quantidade de ${line.name}`}>
                        <button
                          type="button"
                          aria-label={line.quantity <= 1 ? `Tirar ${line.name} do pedido` : `Tirar um ${line.name}`}
                          onClick={() => onLess?.(line.key)}
                        >
                          {line.quantity <= 1 ? <NvIcon name="trash" /> : "−"}
                        </button>
                        <b aria-live="polite">{line.quantity}</b>
                        <button type="button" aria-label={`Colocar mais um ${line.name}`} onClick={() => onMore?.(line.key)}>
                          +
                        </button>
                      </span>
                      <span className="nv-slip-tools">
                        {line.canEdit ? (
                          <button type="button" className="nv-btn is-ghost is-small" onClick={() => onEditLine?.(line.key)}>
                            Mudar opções
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="nv-btn is-ghost is-small"
                          aria-expanded={noteOf === line.key}
                          onClick={() => setNoteOf(noteOf === line.key ? null : line.key)}
                        >
                          Observação
                        </button>
                      </span>
                    </div>
                    {noteOf === line.key ? (
                      <NoteEditor
                        initial={line.note ?? ""}
                        onSave={(text) => {
                          onNote?.(line.key, text);
                          setNoteOf(null);
                        }}
                        onCancel={() => setNoteOf(null)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="nv-slip-sum">
                {bag.fee !== null ? (
                  <>
                    <p className="nv-leader">
                      <span>Pratos</span>
                      <i aria-hidden="true" />
                      <b>{money(bag.subtotal)}</b>
                    </p>
                    <p className="nv-leader">
                      <span>Taxa de entrega</span>
                      <i aria-hidden="true" />
                      <b>{bag.fee === 0 ? "Grátis" : money(bag.fee)}</b>
                    </p>
                  </>
                ) : null}
                <p className="nv-leader is-total">
                  <span>Total</span>
                  <i aria-hidden="true" />
                  <b>{money(bag.total)}</b>
                </p>
              </div>
            </section>

            {bag.pausedNote ? (
              <p className="nv-notice" role="status">
                {bag.pausedNote}
              </p>
            ) : null}

            {bag.modes.length > 0 ? <Picks label="Como você quer receber?" options={bag.modes} onPick={onMode} /> : null}

            <Text
              label={bag.nameLabel}
              value={bag.name}
              onChange={onName}
              maxLength={60}
              autoComplete="given-name"
              placeholder="Como podemos te chamar?"
            />

            {delivery ? (
              <section className="nv-block" aria-label="Endereço de entrega">
                <h2 className="nv-h2">Endereço de entrega</h2>
                <Text
                  label="CEP"
                  value={delivery.cep}
                  onChange={(cep) => onAddress?.({ cep })}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  maxLength={9}
                />
                {delivery.quote ? (
                  <p className={`nv-quote is-${delivery.quote.tone}`} role="status">
                    {delivery.quote.text}
                  </p>
                ) : null}
                {delivery.quote?.tone === "fail" ? (
                  <button type="button" className="nv-btn is-ghost is-small" onClick={onRetryQuote}>
                    Tentar de novo
                  </button>
                ) : null}
                {delivery.hint ? <p className="nv-hint">{delivery.hint}</p> : null}
                <Text
                  label="Rua"
                  value={delivery.street}
                  onChange={(street) => onAddress?.({ street })}
                  maxLength={120}
                  autoComplete="address-line1"
                  placeholder="Nome da rua ou avenida"
                />
                <div className="nv-row2">
                  <Text
                    label="Número"
                    value={delivery.number}
                    onChange={(number) => onAddress?.({ number })}
                    maxLength={20}
                    autoComplete="off"
                    placeholder="120 ou S/N"
                  />
                  <Text
                    label="Complemento (opcional)"
                    value={delivery.complement}
                    onChange={(complement) => onAddress?.({ complement })}
                    maxLength={60}
                    autoComplete="address-line2"
                    placeholder="Apto, bloco"
                  />
                </div>
                <Text
                  label="Bairro"
                  value={delivery.neighborhood}
                  onChange={(neighborhood) => onAddress?.({ neighborhood })}
                  maxLength={80}
                  autoComplete="address-level3"
                />
                <Text
                  label="Ponto de referência (opcional)"
                  value={delivery.reference}
                  onChange={(reference) => onAddress?.({ reference })}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Ex.: portão azul, em frente à padaria"
                />
                <Text
                  label="Telefone com DDD"
                  value={delivery.phone}
                  onChange={onPhone}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(31) 99999-8888"
                  maxLength={15}
                  hint="O entregador usa para avisar que chegou."
                />
                {delivery.remembered ? (
                  <button type="button" className="nv-btn is-ghost is-small" onClick={onForget}>
                    Esquecer meu endereço neste aparelho
                  </button>
                ) : null}
              </section>
            ) : null}

            <Picks label="Como você vai pagar?" options={bag.payments} onPick={onPayment} />

            {bag.cash ? (
              <div className="nv-cash">
                <Text
                  label="Vou pagar com (R$)"
                  value={bag.cash.value}
                  onChange={onPaid}
                  inputMode="decimal"
                  placeholder="Ex.: 50"
                />
                <button type="button" className="nv-btn is-ghost is-small" onClick={() => onPaid?.(bag.cash!.exact)}>
                  Tenho o valor certinho
                </button>
              </div>
            ) : null}

            <p className="nv-hint">{bag.paymentNote}</p>

            {error ? (
              <p ref={errorRef} className="nv-error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </main>

      {empty ? null : (
        <div className="nv-dock">
          <button type="button" className="nv-btn is-green is-block nv-send" disabled={sending} onClick={onSend}>
            {sending ? "Enviando…" : `Enviar pedido · ${money(bag.total)}`}
          </button>
        </div>
      )}
    </div>
  );
}
