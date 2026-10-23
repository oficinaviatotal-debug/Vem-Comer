import "./novo.css";
import NvIcon, { type NvIconName } from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { TABLE_JOBS_TEXT, TABLE_MENU_TEXT } from "./copy";
import type { CallKind, CallTile, Shop, TableView } from "./types";

type Props = {
  shop: Shop;
  view: TableView;
  /** Toque num botão da mesa. Quem manda o aviso ao servidor é a tela de verdade; aqui só se desenha. */
  onCall: (kind: CallKind) => void;
  onMenu: () => void;
  onTrack?: () => void;
};

const ICONS: Record<CallKind, NvIconName> = { garcom: "bell", conta: "receipt", agua: "drop", limpeza: "sparkle" };

/**
 * Um botão da mesa. O nome dele nunca muda (quem olha de relance acha sempre no mesmo lugar); o que muda é a etiqueta
 * "Chamado" / "Atendido" embaixo e a cor: recém-chamado fica afundado e amarelo, atendido fica verde, e os dois
 * continuam lidos por inteiro por quem usa leitor de tela. Recém-chamado não usa `disabled`: o botão segue
 * focável para o leitor de tela dizer que já foi chamado, e o toque nele não faz nada.
 */
function Tile({ tile, size, onCall }: { tile: CallTile; size: "big" | "small"; onCall: (kind: CallKind) => void }) {
  return (
    <button
      type="button"
      className={`nv-call is-${size} is-${tile.state}`}
      aria-label={tile.spoken}
      aria-disabled={tile.locked || undefined}
      aria-busy={tile.state === "busy" || undefined}
      onClick={() => {
        if (!tile.locked) onCall(tile.kind);
      }}
    >
      <span className="nv-call-icon">
        <NvIcon name={tile.state === "answered" ? "check" : ICONS[tile.kind]} />
      </span>
      <span className="nv-call-text">
        <span className="nv-call-title">{tile.title}</span>
        {tile.status ? <span className="nv-call-status">{tile.status}</span> : null}
        {size === "big" && tile.note ? <span className="nv-call-note">{tile.note}</span> : null}
      </span>
    </button>
  );
}

/**
 * A tela da mesa: o que o cliente vê ao ler o QR da mesa. Pedir pelo cardápio é o botão mais largo; chamar o garçom e
 * pedir a conta são os dois botões seguintes; água e limpeza ficam menores. De uma mão só, sem rolar.
 */
export default function TablePage({ shop, view, onCall, onMenu, onTrack }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen nv-page-table">
        <TopBar mark={shop.mark} logo={shop.logo} title={view.title} sub={shop.name} />

        <p className="nv-lead">{view.sub}</p>

        <button type="button" className="nv-btn is-green is-block is-tall" onClick={onMenu}>
          <NvIcon name="fork" />
          {TABLE_MENU_TEXT}
        </button>

        {view.ordersCount > 0 && onTrack ? (
          <button type="button" className="nv-btn is-ghost is-block" onClick={onTrack}>
            <NvIcon name="receipt" />
            Acompanhar o seu pedido{view.ordersCount > 1 ? ` (${view.ordersCount})` : ""}
          </button>
        ) : null}

        <div className="nv-calls" aria-label="Chamar o atendente">
          {view.main.map((tile) => (
            <Tile key={tile.kind} tile={tile} size="big" onCall={onCall} />
          ))}
        </div>
        <div className="nv-calls is-small">
          {view.small.map((tile) => (
            <Tile key={tile.kind} tile={tile} size="small" onCall={onCall} />
          ))}
        </div>

        {/* Sempre na página (vazia, fica fora do desenho): leitor de tela só avisa o que muda dentro de uma região que já existia. */}
        <div className="nv-callnote" role="status" aria-live="polite">
          {view.notice}
        </div>
        {view.error ? (
          <p className="nv-error" role="alert">
            {view.error}
          </p>
        ) : null}

        {view.jobsHref ? (
          <a
            className="nv-btn is-ghost is-block"
            href={view.jobsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${TABLE_JOBS_TEXT} (abre em outra aba)`}
          >
            <NvIcon name="briefcase" />
            {TABLE_JOBS_TEXT}
          </a>
        ) : null}
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
