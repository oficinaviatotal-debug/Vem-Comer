import "./novo.css";
import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { SETTLE_ARMED, SETTLE_BUSY, SETTLE_HELP, SETTLE_PICK_HINT, SETTLE_REFRESH, SETTLE_TITLE } from "./copy";
import type { SettleGroup, SettleView } from "./types";

type GroupProps = {
  group: SettleGroup;
  /** O motoqueiro que está sendo acertado agora (ou null). Enquanto isso nada mais se toca. */
  busy: string | null;
  onToggle?: (groupId: string, orderId: string) => void;
  onSettle?: (groupId: string) => void;
};

/**
 * O dinheiro de um motoqueiro: o total que ele deve, cada entrega como linha que se marca (tudo vem marcado; o caixa tira o
 * que não veio), a soma do que está marcado e o botão de acertar, que pede um segundo toque para o valor que está na tela.
 */
export function SettleItem({ group, busy, onToggle, onSettle }: GroupProps) {
  const locked = busy !== null;
  const mine = busy === group.id;
  return (
    <li className="nv-order nv-settle">
      <div className="nv-order-head">
        <div className="nv-order-text">
          <h2 className="nv-order-where" id={`nv-settle-${group.id}`} tabIndex={-1}>
            {group.name}
          </h2>
        </div>
        <span className="nv-settle-owes">{group.total}</span>
      </div>

      <div role="group" aria-labelledby={`nv-settle-${group.id}`} className="nv-opts-list">
        {group.rows.map((row) => (
          <button
            key={row.id}
            type="button"
            role="checkbox"
            aria-checked={row.checked}
            aria-disabled={locked || undefined}
            className={`nv-opt${row.checked ? " is-on" : ""}${locked ? " is-blocked" : ""}`}
            onClick={() => {
              if (!locked) onToggle?.(group.id, row.id);
            }}
          >
            <span className="nv-opt-mark" aria-hidden="true">
              <NvIcon name="check" />
            </span>
            <span className="nv-opt-name">{row.label}</span>
            <span className="nv-opt-price">{row.amount}</span>
          </button>
        ))}
      </div>

      <div className="nv-order-money">
        <p className="nv-order-total">
          <span>Marcado</span>
          <b>{group.marked}</b>
        </p>
      </div>

      {group.button ? (
        <>
          <button
            type="button"
            className={`nv-btn is-block ${group.armed ? "is-green" : "is-fire"}`}
            aria-label={mine ? undefined : group.armed ? `${SETTLE_ARMED}. ${group.button}` : group.button}
            disabled={locked}
            aria-busy={mine || undefined}
            onClick={() => onSettle?.(group.id)}
          >
            <NvIcon name={group.armed ? "check" : "cash"} />
            {mine ? SETTLE_BUSY : group.armed ? SETTLE_ARMED : group.button}
          </button>
          {group.armed ? <p className="nv-settle-confirm">{group.button}</p> : null}
        </>
      ) : (
        <p className="nv-code-hint">{SETTLE_PICK_HINT}</p>
      )}
    </li>
  );
}

type Props = {
  view: SettleView;
  busy?: string | null;
  onToggle?: (groupId: string, orderId: string) => void;
  onSettle?: (groupId: string) => void;
  onRefresh?: () => void;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/**
 * Acerto do caixa: o dinheiro que cada motoqueiro recebeu na porta e ainda não entregou. A lista não se atualiza sozinha,
 * de propósito: o total que o caixa contou nunca muda debaixo dele. Para ver o que mudou, o botão de atualizar.
 */
export default function Settle({ view, busy = null, onToggle, onSettle, onRefresh, onMenu, showMenu = false }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-settle">
        <TopBar title={SETTLE_TITLE} sub={view.sub} onMenu={onMenu} showMenu={showMenu} />
        {/* Sempre na página: o leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <p className="nv-sr" id="nv-settle-live" role="status" aria-live="polite" tabIndex={-1}>
          {view.live}
        </p>

        <p className="nv-code-hint">{SETTLE_HELP}</p>

        {view.notice ? (
          <p className="nv-ok" aria-hidden="true">
            {view.notice}
          </p>
        ) : null}
        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        {view.empty ? <p className="nv-empty">{view.empty}</p> : null}
        <ul className="nv-orders">
          {view.groups.map((group) => (
            <SettleItem key={group.id} group={group} busy={busy} onToggle={onToggle} onSettle={onSettle} />
          ))}
        </ul>

        <button type="button" className="nv-btn is-ghost is-block" disabled={busy !== null} onClick={onRefresh}>
          {SETTLE_REFRESH}
        </button>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
