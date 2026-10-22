import NvIcon from "./Icons";
import { Photo } from "./parts";
import { money } from "./format";
import type { Choices } from "./types";

type Props = {
  choices: Choices;
  /** Toque numa opção. */
  onPress?: (groupId: string, itemId: string) => void;
  onNote?: (text: string) => void;
  onMore?: () => void;
  onLess?: () => void;
  /** Toque no botão grande ("Adicionar · R$ 38,00"). */
  onConfirm?: () => void;
  /** Fechar: o X, o toque fora da folha e a tecla Esc (quem monta a tela escuta o Esc). */
  onClose?: () => void;
};

/**
 * As escolhas de um prato, numa folha que sobe de baixo: tamanho, extras, observação, quantidade e o total no botão.
 * A linha inteira de cada opção é o botão (60 px de altura): a marcada fica afundada e verde, as outras sobem.
 * Quem monta a tela cuida de tudo que é de fora da folha: rolar até o que falta, travar a rolagem de trás, o Esc.
 */
export default function ChoicesSheet({ choices, onPress, onNote, onMore, onLess, onConfirm, onClose }: Props) {
  return (
    <div className="nv-root nv-overlay">
      <div
        className="nv-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div className="nv-sheet" role="dialog" aria-modal="true" aria-labelledby="nv-sheet-title">
          <div className="nv-sheet-scroll">
            <header className="nv-sheet-head">
              <span className="nv-sheet-photo">
                <Photo src={choices.photo} art={choices.art} alt="" />
              </span>
              <div className="nv-sheet-title">
                <h2 id="nv-sheet-title" tabIndex={-1}>
                  {choices.title}
                </h2>
                {choices.description ? <p>{choices.description}</p> : null}
              </div>
              <button type="button" className="nv-icon-btn" aria-label="Fechar sem adicionar" onClick={onClose}>
                <NvIcon name="close" />
              </button>
            </header>

            {choices.groups.map((group) => (
              <section key={group.id} className="nv-opts" id={`nv-opt-group-${group.id}`} aria-labelledby={`nv-opt-h-${group.id}`}>
                <div className="nv-opts-head">
                  <h3 id={`nv-opt-h-${group.id}`}>{group.name}</h3>
                  <span className={`nv-rule${group.required ? " is-required" : ""}`}>{group.rule}</span>
                </div>
                {group.emptyText ? <p className="nv-notice">{group.emptyText}</p> : null}
                <div role={group.single ? "radiogroup" : "group"} aria-labelledby={`nv-opt-h-${group.id}`} className="nv-opts-list">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role={group.single ? "radio" : "checkbox"}
                      aria-checked={item.on}
                      aria-disabled={item.blocked || undefined}
                      className={`nv-opt${item.on ? " is-on" : ""}${item.blocked ? " is-blocked" : ""}`}
                      onClick={() => {
                        if (!item.blocked) onPress?.(group.id, item.id);
                      }}
                    >
                      <span className="nv-opt-mark" aria-hidden="true">
                        <NvIcon name="check" />
                      </span>
                      <span className="nv-opt-name">{item.name}</span>
                      {item.priceText ? <span className="nv-opt-price">{item.priceText}</span> : null}
                    </button>
                  ))}
                </div>
                {group.problem ? (
                  <p className="nv-error" role="alert">
                    {group.problem}
                  </p>
                ) : null}
              </section>
            ))}

            <label className="nv-text">
              <span>Observação (opcional)</span>
              <input
                value={choices.note.value}
                onChange={(event) => onNote?.(event.target.value)}
                maxLength={choices.note.max + 40}
                placeholder="Ex.: sem cebola, bem passado"
                enterKeyHint="done"
              />
              <small>
                {choices.note.count}/{choices.note.max}
              </small>
            </label>
            {choices.note.problem ? (
              <p className="nv-error" role="alert">
                {choices.note.problem}
              </p>
            ) : null}
          </div>

          <footer className="nv-sheet-foot">
            <span className="nv-step nv-qty" role="group" aria-label={`Quantidade de ${choices.title}`}>
              <button type="button" aria-label="Tirar um" disabled={!choices.canLess} onClick={onLess}>
                −
              </button>
              <b aria-live="polite">{choices.quantity}</b>
              <button type="button" aria-label="Mais um" disabled={!choices.canMore} onClick={onMore}>
                +
              </button>
            </span>
            <button type="button" className="nv-btn is-green nv-grow" onClick={onConfirm}>
              {choices.confirmLabel} · {money(choices.total)}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
