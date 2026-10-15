import { useCallback, useEffect, useRef, useState } from "react";
import "../ui.css";
import "../business/business.css";
import "./nav.css";
import NavIcon from "./NavIcon";
import PauseStrip from "../service/PauseStrip";
import { fetchBusiness } from "../business/businessApi";
import {
  LEVEL_ICON,
  LEVEL_NAME,
  attentionHeadline,
  changeTone,
  compareLine,
  countText,
  emptyText,
  isEmpty,
  moneyShort,
  moneyText,
  updatedText,
  type BusinessView,
} from "../business/businessLogic";
import {
  activityCards,
  firstName,
  greeting,
  isManager,
  roleLine,
  shortcutsFor,
  type OrderLite,
} from "./navLogic";

const REFRESH_MS = 60_000;
/** How many warnings fit on this screen; the rest are one tap away in "Seu negócio". */
const NOTES_ON_HOME = 3;

type Props = {
  companyId: string;
  role: string | null | undefined;
  name: string;
  /** The restaurant's name, shown under the greeting. */
  place: string;
  /** The orders the panel already polls every few seconds. */
  orders: OrderLite[];
  onGo: (view: string) => void;
};

/**
 * "Hoje": the first screen of the panel. It answers "what is happening and what needs me" before anything else:
 * the stage of each order, today's sales and the warnings (for the owner and the manager), and the big buttons of
 * what this role does most. The functions themselves live in the menu of three lines.
 *
 * Nothing here is estimated: the tiles count the orders the panel already has, the sales and the warnings come
 * from the same server numbers as "Seu negócio".
 */
export default function HomeView({ companyId, role, name, place, orders, onGo }: Props) {
  const manager = isManager(role);
  const cards = activityCards(role, orders, Date.now());
  const shortcuts = shortcutsFor(role);
  const first = firstName(name);
  const hello = greeting(new Date().getHours());
  const showPause = manager || String(role ?? "").toUpperCase() === "KITCHEN";

  return (
    <section className="hm" aria-label="Hoje">
      <header className="hm-hero">
        <h1 className="hm-hello">{first ? `${hello}, ${first}!` : `${hello}!`}</h1>
        <p className="hm-line">
          {roleLine(role)}
          {place ? ` · ${place}` : ""}
        </p>
        <span className="hm-live">
          <i aria-hidden="true" />
          Atualiza sozinho
        </span>
      </header>

      {showPause && <PauseStrip />}

      <div className="hm-tiles" role="group" aria-label="Pedidos agora">
        {cards.map((card) => (
          <button key={card.key} type="button" className={`hm-tile hm-tile-${card.tone}`} onClick={() => onGo(card.go)}>
            <span className="hm-tile-count">{countText(card.count)}</span>
            <span className="hm-tile-label">{card.label}</span>
            <span className="hm-tile-note">{card.note}</span>
          </button>
        ))}
      </div>

      {manager && <TodaySales companyId={companyId} onGo={onGo} />}

      <h2 className="hm-section">O que você quer fazer?</h2>
      <div className="hm-shortcuts">
        {shortcuts.map((item) => (
          <button key={item.view} type="button" className="hm-shortcut" onClick={() => onGo(item.view)}>
            <span className="hm-shortcut-icon">
              <NavIcon name={item.icon} />
            </span>
            <span className="hm-shortcut-text">
              <span className="hm-shortcut-label">{item.label}</span>
              <span className="hm-shortcut-hint">{item.hint}</span>
            </span>
            <span className="hm-shortcut-go">
              <NavIcon name="chevron" size={22} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Today's sales and the warnings, from the same server numbers as "Seu negócio". A failure never blocks the screen. */
function TodaySales({ companyId, onGo }: { companyId: string; onGo: (view: string) => void }) {
  const [view, setView] = useState<BusinessView | null>(null);
  const [failed, setFailed] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  // The newest request wins: a slow answer never overwrites a newer one.
  const latest = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      const ticket = ++latest.current;
      try {
        const next = await fetchBusiness(companyId, "hoje");
        if (ticket !== latest.current) return;
        setView(next);
        setFailed("");
        setUpdated(new Date());
      } catch (error) {
        if (ticket !== latest.current) return;
        // A quiet refresh that fails keeps the numbers already on screen.
        if (!quiet) setFailed(error instanceof Error ? error.message : "Não consegui abrir as vendas agora.");
      }
    },
    [companyId],
  );

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      latest.current += 1;
    };
  }, [load]);

  if (!view) {
    return (
      <div className="biz-card hm-sales" aria-busy={!failed}>
        <h3>Vendas de hoje</h3>
        {failed ? (
          <>
            <p className="hm-sales-empty" role="alert">
              {failed}
            </p>
            <button type="button" className="btn btn-outline" onClick={() => void load(false)}>
              Tentar de novo
            </button>
          </>
        ) : (
          <p className="hm-sales-empty">Carregando…</p>
        )}
      </div>
    );
  }

  const tone = changeTone(view.compare.revenue_pct);
  const notes = view.attention.slice(0, NOTES_ON_HOME);
  const hidden = view.attention.length - notes.length;

  return (
    <>
      <div className="biz-hero hm-sales-hero">
        <p className="biz-hero-label">Vendido hoje</p>
        <p className="biz-big" aria-live="polite">
          {moneyShort(view.summary.revenue)}
        </p>
        {isEmpty(view) ? (
          <p className="hm-sales-line">{emptyText("hoje")}</p>
        ) : (
          <>
            <p className={`biz-delta biz-delta-${tone}`}>
              {view.compare.enough_data && tone !== "none" && (
                <span className="biz-arrow" aria-hidden="true">
                  {tone === "up" ? "▲" : tone === "down" ? "▼" : "＝"}
                </span>
              )}
              {compareLine(view)}
            </p>
            <p className="hm-sales-line">
              {countText(view.summary.orders)} {view.summary.orders === 1 ? "pedido" : "pedidos"}
              {view.summary.avg_ticket !== null ? ` · ticket médio ${moneyText(view.summary.avg_ticket)}` : ""}
            </p>
          </>
        )}
        {updated && <p className="hm-sales-updated">{updatedText(updated)}</p>}
      </div>

      {failed && (
        <p className="biz-stale" role="status">
          {failed} Mostrando os últimos números que consegui.
        </p>
      )}

      <div className="biz-card">
        <h3>{attentionHeadline(view.attention)}</h3>
        {notes.length > 0 && (
          <ul className="biz-notes">
            {notes.map((note) => (
              <li key={note.id} className={`biz-note biz-note-${note.level}`}>
                <span className="biz-note-icon" aria-hidden="true">
                  {LEVEL_ICON[note.level]}
                </span>
                <div className="biz-note-body">
                  <p className="biz-note-title">
                    <span className="biz-sr">{LEVEL_NAME[note.level]}: </span>
                    {note.title}
                  </p>
                  <p className="biz-note-text">{note.text}</p>
                  {note.go && (
                    <button type="button" className="biz-note-go" onClick={() => onGo(note.go as string)}>
                      {note.go === "custos" ? "Abrir Custos" : "Ver pedidos"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-outline" onClick={() => onGo("dashboard")}>
          {hidden > 0 ? `Ver os outros ${hidden} avisos e todos os números` : "Ver todos os números"}
        </button>
      </div>
    </>
  );
}
