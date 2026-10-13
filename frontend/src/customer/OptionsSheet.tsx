import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../service/format";
import { MAX_PER_ITEM, toCents, type ChosenOption } from "./cart";
import {
  NOTE_MAX,
  chosenOptions,
  countIn,
  deltaLabel,
  firstProblem,
  groupProblem,
  groupsOf,
  noteProblem,
  ruleText,
  toggleChoice,
  unitCents,
  type Selection,
} from "./options";
import type { Product } from "./types";

export type OptionsPick = {
  options: ChosenOption[];
  note: string;
  quantity: number;
};

type Props = {
  product: Product;
  /** Set when an existing line of the order is being changed. */
  initial?: { selection: Selection; note: string; quantity: number };
  onConfirm: (pick: OptionsPick) => void;
  onClose: () => void;
};

/** Bottom sheet where the customer picks size, extras and the like, writes a note and sets the quantity. */
export default function OptionsSheet({ product, initial, onConfirm, onClose }: Props) {
  const groups = groupsOf(product);
  const [selection, setSelection] = useState<Selection>(initial?.selection ?? {});
  const [note, setNote] = useState(initial?.note ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [tried, setTried] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Same behavior as the order sheet: the page behind does not scroll, Esc closes, reading starts at the top.
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

  const chosen = chosenOptions(groups, selection);
  const unit = unitCents(toCents(product.price), chosen);
  const total = unit * quantity;
  const problem = firstProblem(groups, selection) ?? noteProblem(note);
  const editing = Boolean(initial);

  function confirm() {
    if (problem) {
      setTried(true);
      // Take the customer to what is missing instead of leaving the error out of sight.
      const target = groups.find((group) => groupProblem(group, selection));
      if (target) document.getElementById(`opt-group-${target.id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    onConfirm({ options: chosen, note: note.replace(/\s+/g, " ").trim(), quantity });
  }

  return (
    <div
      className="cust-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cust-sheet" role="dialog" aria-modal="true" aria-labelledby="opt-title">
        <div className="cust-sheet-bar">
          <h2 id="opt-title" ref={titleRef} tabIndex={-1}>
            {product.name}
          </h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cancelar
          </button>
        </div>

        {product.description && <p className="opt-desc">{product.description}</p>}

        {groups.map((group) => {
          const single = group.max_choices <= 1;
          const picked = selection[group.id] ?? [];
          const full = !single && countIn(selection, group) >= group.max_choices;
          const missing = tried ? groupProblem(group, selection) : null;
          return (
            <fieldset className="opt-group" id={`opt-group-${group.id}`} key={group.id}>
              <legend>
                <span className="opt-name">{group.name}</span>
                <span className={group.min_choices > 0 ? "opt-rule is-required" : "opt-rule"}>
                  {ruleText(group)}
                </span>
              </legend>

              {group.items.length === 0 && <p className="cust-note">Indisponível agora.</p>}

              {group.items.map((item) => {
                const checked = picked.includes(item.id);
                const price = deltaLabel(item);
                return (
                  <label
                    key={item.id}
                    className={checked ? "opt-row is-checked" : "opt-row"}
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={`opt-${group.id}`}
                      checked={checked}
                      disabled={full && !checked}
                      onChange={() => setSelection((current) => toggleChoice(current, group, item.id))}
                      // A required radio cannot be cleared by tapping it again; an optional one can.
                      onClick={() => {
                        if (single && checked && group.min_choices === 0) {
                          setSelection((current) => toggleChoice(current, group, item.id));
                        }
                      }}
                    />
                    <span className="opt-mark" aria-hidden="true" />
                    <span className="opt-label">{item.name}</span>
                    {price && <span className="opt-price">{price}</span>}
                  </label>
                );
              })}

              {missing && (
                <p className="msg-error" role="alert">
                  {missing}
                </p>
              )}
            </fieldset>
          );
        })}

        <label className="field opt-note">
          <span>Observação (opcional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX}
            placeholder="Ex.: sem cebola, bem passado"
            enterKeyHint="done"
          />
          <small>
            {note.length}/{NOTE_MAX}
          </small>
        </label>
        {tried && noteProblem(note) && (
          <p className="msg-error" role="alert">
            {noteProblem(note)}
          </p>
        )}

        <div className="cust-send-wrap opt-foot">
          <div className="cust-step" role="group" aria-label={`Quantidade de ${product.name}`}>
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              aria-label="Tirar um"
            >
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.min(MAX_PER_ITEM, current + 1))}
              aria-label="Mais um"
            >
              +
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={confirm}>
            {editing ? "Salvar" : "Adicionar"} · {formatMoney(total / 100)}
          </button>
        </div>
      </div>
    </div>
  );
}
