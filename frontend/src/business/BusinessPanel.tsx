import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBusiness } from "./businessApi";
import {
  DISH_TABS,
  LEVEL_ICON,
  LEVEL_NAME,
  PERIODS,
  TIME_LABELS,
  attentionHeadline,
  changeText,
  changeTone,
  cmvSentence,
  countText,
  cmvStatus,
  compareLine,
  dishDetail,
  dishEmpty,
  dishList,
  dishValue,
  dishWidths,
  emptyText,
  hourBars,
  hourSentence,
  isEmpty,
  moneyShort,
  moneyText,
  moneyTile,
  percentText,
  personLine,
  ticketLine,
  timeNote,
  timeValue,
  updatedText,
  weekdayBars,
  weekdaySentence,
  type BusinessView,
  type DishTab,
  type PeriodKey,
  type ShareRow,
} from "./businessLogic";
import "./business.css";

type Props = {
  companyId: string;
  /** Takes the owner to the tab where a warning is solved ("custos", "pedidos"). */
  onGo?: (target: "custos" | "pedidos") => void;
};

/** How often "Hoje" renews itself while the tab is open and visible. */
const REFRESH_MS = 60_000;

function Shares({ title, rows }: { title: string; rows: ShareRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="biz-shares">
      <h4>{title}</h4>
      <div className="biz-sharebar" role="img" aria-label={rows.map((r) => `${r.label} ${percentText(r.share)}`).join(", ")}>
        {rows.map((row, index) => (
          <span key={row.key || "nd"} className={`biz-seg biz-seg-${index % 4}`} style={{ flexGrow: Math.max(row.share, 4) }} />
        ))}
      </div>
      <ul className="biz-sharelist">
        {rows.map((row, index) => (
          <li key={row.key || "nd"}>
            <span className={`biz-dot biz-seg-${index % 4}`} aria-hidden="true" />
            <span className="biz-sharename">{row.label}</span>
            <span className="biz-sharenum">
              {percentText(row.share)} · {moneyShort(row.revenue)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Seu negócio": what the owner wants to know every day, in this order: how much came in (and against what),
 * what needs attention, when the house is busy, which dishes pay, how fast the service is, and who did what.
 * Every number comes from the server; when there is too little data the card says so instead of guessing.
 */
export default function BusinessPanel({ companyId, onGo }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("hoje");
  const [view, setView] = useState<BusinessView | null>(null);
  const [failed, setFailed] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DishTab>("quantidade");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  /** The newest request wins: a slow answer for an old period never overwrites the one on screen. */
  const latest = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      const ticket = ++latest.current;
      if (!quiet) setLoading(true);
      try {
        const next = await fetchBusiness(companyId, period);
        if (ticket !== latest.current) return;
        setView(next);
        setFailed("");
        setUpdated(new Date());
      } catch (error) {
        if (ticket !== latest.current) return;
        // A quiet refresh that fails keeps the numbers already on screen.
        if (!quiet) setFailed(error instanceof Error ? error.message : "Não consegui abrir os números agora.");
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    },
    [companyId, period],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (period !== "hoje") return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [period, load]);

  const periodChips = (
    <div className="biz-periods" role="group" aria-label="Período">
      {PERIODS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.key === period ? "biz-period is-active" : "biz-period"}
          aria-pressed={item.key === period}
          onClick={() => setPeriod(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  if (!view) {
    return (
      <section className="biz" aria-label="Seu negócio" aria-busy={loading}>
        <header className="biz-head">
          <h2>Seu negócio</h2>
          {periodChips}
        </header>
        {failed ? (
          <div className="biz-fail" role="alert">
            <p>{failed}</p>
            <button type="button" className="btn btn-outline" onClick={() => void load(false)}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className="biz-skeleton" aria-hidden="true">
            <span className="biz-sk biz-sk-hero" />
            <span className="biz-sk" />
            <span className="biz-sk" />
          </div>
        )}
        {!failed && <p className="adm-status">Carregando…</p>}
      </section>
    );
  }

  const data = view;
  const tone = changeTone(data.compare.revenue_pct);
  const bars = hourBars(data.hours, data.peak, data.weak);
  const dishes = dishList(data, tab);
  const widths = dishWidths(dishes, tab);
  const cmv = cmvStatus(data.dishes.cmv_real, data.cmv_target, data.dishes.cost_coverage);
  const weekdays = weekdayBars(data.weekdays);
  const empty = isEmpty(data);

  return (
    <section className="biz" aria-label="Seu negócio" aria-busy={loading}>
      <header className="biz-head">
        <h2>Seu negócio</h2>
        {periodChips}
      </header>

      {failed && (
        <p className="biz-stale" role="status">
          {failed} Mostrando os últimos números que consegui.
        </p>
      )}

      <div className="biz-hero">
        <p className="biz-hero-label">{data.period === "hoje" ? "Vendido hoje" : `Vendido nos ${data.label.toLowerCase()}`}</p>
        <p className="biz-big" aria-live="polite">
          {moneyShort(data.summary.revenue)}
        </p>
        <p className={`biz-delta biz-delta-${tone}`}>
          {data.compare.enough_data && tone !== "none" && (
            <span className="biz-arrow" aria-hidden="true">
              {tone === "up" ? "▲" : tone === "down" ? "▼" : "＝"}
            </span>
          )}
          <span>{compareLine(data)}</span>
        </p>
      </div>

      <div className="biz-tiles biz-tiles-3">
        <div className="biz-tile biz-tile-a">
          <span className="biz-tile-label">Pedidos</span>
          <span className="biz-tile-value">{countText(data.summary.orders)}</span>
          <span className="biz-tile-note">
            {data.compare.enough_data && data.compare.orders_pct !== null ? changeText(data.compare.orders_pct) : "aceitos"}
          </span>
        </div>
        <div className="biz-tile biz-tile-b">
          <span className="biz-tile-label">Ticket médio</span>
          <span className="biz-tile-value">
            {data.summary.avg_ticket === null ? "—" : moneyTile(data.summary.avg_ticket)}
          </span>
          <span className="biz-tile-note">{ticketLine(data)}</span>
        </div>
        <div className="biz-tile biz-tile-c">
          <span className="biz-tile-label">Pratos</span>
          <span className="biz-tile-value">{countText(data.summary.dishes)}</span>
          <span className="biz-tile-note">vendidos</span>
        </div>
      </div>

      <div className="biz-card">
        <h3>{attentionHeadline(data.attention)}</h3>
        {data.attention.length > 0 && (
          <ul className="biz-notes">
            {data.attention.map((note) => (
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
                  {note.go && onGo && (
                    <button type="button" className="biz-note-go" onClick={() => onGo(note.go as "custos" | "pedidos")}>
                      {note.go === "custos" ? "Abrir Custos" : "Ver pedidos"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {empty ? (
        <div className="biz-card biz-empty">
          <p>{emptyText(data.period)}</p>
        </div>
      ) : (
        <>
          <div className="biz-card">
            <h3>Horários</h3>
            {bars.length > 0 ? (
              <div
                className="biz-hours"
                role="img"
                aria-label={`Vendas por hora. ${hourSentence(data)}`}
              >
                {bars.map((bar) => (
                  <div key={bar.hour} className={`biz-hour biz-hour-${bar.kind}`}>
                    <span className="biz-hour-track">
                      <span className="biz-hour-bar" style={{ height: `${bar.height}%` }} />
                    </span>
                    <span className="biz-hour-label">{bar.showLabel ? bar.label : " "}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="biz-sentence">{hourSentence(data)}</p>
            {data.peak && (
              <p className="biz-legend" aria-hidden="true">
                <span className="biz-key biz-key-peak" /> mais forte <span className="biz-key biz-key-weak" /> mais fraca
              </p>
            )}
          </div>

          <div className="biz-card">
            <h3>Pratos</h3>
            <div className="biz-tabs" role="tablist" aria-label="Ordenar pratos">
              {DISH_TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={item.key === tab}
                  className={item.key === tab ? "biz-tab is-active" : "biz-tab"}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {dishes.length === 0 ? (
              <p className="biz-sentence">{dishEmpty(data, tab)}</p>
            ) : (
              <ol className="biz-dishes">
                {dishes.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="biz-dish">
                    <span className="biz-dish-pos" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="biz-dish-main">
                      <span className="biz-dish-top">
                        <span className="biz-dish-name">{row.name}</span>
                        <span className="biz-dish-value">{dishValue(row, tab)}</span>
                      </span>
                      <span className="biz-dish-detail">{dishDetail(row, tab)}</span>
                      <span className="biz-dish-track" aria-hidden="true">
                        <span className="biz-dish-fill" style={{ width: `${widths[index]}%` }} />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {data.dishes.without_cost.length > 0 && (
              <>
                <p className="biz-hint">Sem custo calculado: {data.dishes.without_cost.join(", ")}.</p>
                {onGo && (
                  <button type="button" className="biz-link" onClick={() => onGo("custos")}>
                    Preencher na aba Custos
                  </button>
                )}
              </>
            )}
          </div>

          <div className={`biz-card biz-cmv biz-cmv-${cmv}`}>
            <h3>Custo da comida (CMV)</h3>
            <p className="biz-cmv-number">
              {data.dishes.cmv_real === null ? "—" : percentText(data.dishes.cmv_real)}
              <span className="biz-cmv-target"> meta {percentText(data.cmv_target)}</span>
            </p>
            {data.dishes.cmv_real !== null && (
              <span className="biz-gauge" aria-hidden="true">
                <span className="biz-gauge-fill" style={{ width: `${Math.min(100, data.dishes.cmv_real)}%` }} />
                <span className="biz-gauge-mark" style={{ left: `${Math.min(100, data.cmv_target)}%` }} />
              </span>
            )}
            <p className="biz-sentence">{cmvSentence(data)}</p>
          </div>

          {(data.channels.length > 0 || data.payments.length > 0) && (
            <div className="biz-card">
              <h3>Como vendem e como pagam</h3>
              <Shares title="Onde o pedido nasce" rows={data.channels} />
              <Shares title="Forma de pagamento" rows={data.payments} />
            </div>
          )}

          {weekdays.length > 0 && (
            <div className="biz-card">
              <h3>Dias da semana</h3>
              <div className="biz-days" role="img" aria-label={`Média por dia da semana. ${weekdaySentence(data.weekdays)}`}>
                {weekdays.map((day) => (
                  <div key={day.name} className={day.best ? "biz-day is-best" : "biz-day"}>
                    <span className="biz-day-track">
                      <span className="biz-day-bar" style={{ height: `${day.height}%` }} />
                    </span>
                    <span className="biz-day-label">{day.short}</span>
                  </div>
                ))}
              </div>
              <p className="biz-sentence">{weekdaySentence(data.weekdays)}</p>
            </div>
          )}

          <div className="biz-card">
            <h3>Tempo de serviço</h3>
            <div className="biz-tiles biz-tiles-3 biz-times">
              {(["kitchen", "delivery", "table_call"] as const).map((key) => (
                <div key={key} className="biz-time">
                  <span className="biz-tile-label">{TIME_LABELS[key]}</span>
                  <span className={data.times[key].median_min === null ? "biz-time-value is-low" : "biz-time-value"}>
                    {timeValue(data.times[key])}
                  </span>
                  <span className="biz-time-note">{timeNote(data.times[key], data.min_samples)}</span>
                </div>
              ))}
            </div>
            <p className="biz-hint">
              O tempo mostrado é o do meio: metade dos casos foi mais rápida. Cozinha vai do pedido aceito até o prato
              pronto; pedido esquecido aberto por horas não entra na conta.
            </p>
          </div>

          {data.service.length > 0 && (
            <div className="biz-card">
              <h3>Equipe</h3>
              <p className="biz-hint biz-hint-top">Em ordem alfabética. É o que cada um fez, não um ranking.</p>
              <ul className="biz-people">
                {(showPeople ? data.service : data.service.slice(0, 4)).map((person) => (
                  <li key={`${person.name}-${person.role}`} className="biz-person">
                    <span className="biz-avatar" aria-hidden="true">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="biz-person-main">
                      <span className="biz-person-name">
                        {person.name} <span className="biz-person-role">{person.role}</span>
                      </span>
                      <span className="biz-person-line">{personLine(person)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {data.service.length > 4 && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPeople((v) => !v)}>
                  {showPeople ? "Mostrar menos" : `Ver todos (${data.service.length})`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <footer className="biz-foot">
        <p>
          Contam só os pedidos que a cozinha já aceitou. Pedido esperando pagamento não entra.
          {data.summary.delivery_fees > 0 && ` Taxa de entrega no período: ${moneyText(data.summary.delivery_fees)}.`}
        </p>
        <p className="biz-foot-row">
          <span>{updated ? updatedText(updated) : ""}</span>
          <button type="button" className="biz-link" onClick={() => void load(false)} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar agora"}
          </button>
        </p>
      </footer>
    </section>
  );
}
