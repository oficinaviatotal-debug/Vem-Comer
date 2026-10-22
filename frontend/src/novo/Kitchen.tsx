import NvIcon from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { minutesText, waitTone } from "./format";
import type { Tab, Ticket } from "./types";

type Props = {
  tabs: Tab[];
  activeTab: string;
  tickets: Ticket[];
  /** Toque numa etapa (Novos, Fazendo, Prontos). Sem isto a tela só mostra, como na página de conferência. */
  onTab?: (id: string) => void;
  /** Toque no botão grande da comanda. */
  onAction?: (id: string) => void;
  /** A comanda que está sendo enviada ao servidor agora: o botão espera para não mandar duas vezes. */
  busyId?: string | null;
  /** Frase pronta quando algo deu errado; diz o que fazer. */
  error?: string | null;
  /** O que escrever quando a etapa não tem comanda. */
  emptyText?: string;
};

/**
 * Cozinha: uma comanda por pedido, a mais antiga primeiro. A fita no topo muda de cor pelo tempo de espera
 * (verde, amarela, vermelha) e o botão de baixo é grande o bastante para tocar com a mão suja de farinha.
 */
export default function Kitchen({ tabs, activeTab, tickets, onTab, onAction, busyId = null, error = null, emptyText }: Props) {
  return (
    <div className="nv-root">
      <main className="nv-screen">
        <TopBar title="Cozinha" sub="A comanda mais antiga fica em cima" />

        <div className="nv-tabs" role="tablist" aria-label="Etapas">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              className={`nv-tab${tab.id === activeTab ? " is-on" : ""}`}
              onClick={() => onTab?.(tab.id)}
            >
              {tab.label}
              <b>{tab.count}</b>
            </button>
          ))}
        </div>

        {error ? (
          <p className="nv-error" role="alert">
            {error}
          </p>
        ) : null}

        {tickets.length === 0 && emptyText ? <p className="nv-empty">{emptyText}</p> : null}

        <ul className="nv-tickets">
          {[...tickets]
            .sort((a, b) => b.minutes - a.minutes)
            .map((ticket) => {
              const tone = waitTone(ticket.minutes);
              return (
                <li key={ticket.id} className={`nv-ticket${tone === "late" ? " is-late" : tone === "warn" ? " is-warn" : ""}`}>
                  <div className="nv-ticket-head">
                    <p className="nv-ticket-num">
                      {ticket.number}
                      <span className="nv-ticket-where">{ticket.where}</span>
                    </p>
                    <span className="nv-wait">
                      <NvIcon name="clock" /> {minutesText(ticket.minutes)}
                    </span>
                  </div>
                  <ul className="nv-lines">
                    {ticket.lines.map((line, index) => (
                      <li key={`${index}-${line.name}`}>
                        <b>{line.qty}×</b>
                        {line.name}
                        {line.detail ? <small>{line.detail}</small> : null}
                      </li>
                    ))}
                  </ul>
                  {ticket.note ? <p className="nv-note">{ticket.note}</p> : null}
                  {ticket.action ? (
                    <button
                      type="button"
                      className="nv-btn is-green is-block"
                      disabled={busyId === ticket.id}
                      onClick={() => onAction?.(ticket.id)}
                    >
                      {busyId === ticket.id ? "Enviando…" : ticket.action}
                    </button>
                  ) : null}
                </li>
              );
            })}
        </ul>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
