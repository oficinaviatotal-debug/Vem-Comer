import NvIcon, { type NvIconName } from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { minutesText, money } from "./format";
import type { GuideItem, TodoItem, Today } from "./types";

type Props = {
  today: Today;
  /** Toque num botão que leva a outra tela (os pedidos, os atalhos, os números). Sem isto a tela só mostra. */
  onGo?: (view: string) => void;
  /** Toque no botão de um "para fazer agora": atender a mesa ou conferir o Pix. */
  onTodo?: (item: TodoItem) => void;
  /** O item que está sendo enviado ao servidor agora: o botão espera para não mandar duas vezes. */
  busyId?: string | null;
  /** Frase pronta quando algo deu errado; diz o que fazer. */
  error?: string | null;
  /** O menu do painel. Sem ele (e sem `showMenu`) o botão não aparece. */
  onMenu?: () => void;
  showMenu?: boolean;
};

/** O ícone de cada atalho pela tela para onde ele leva; atalho de tela desconhecida usa o ícone de papel. */
const SHORTCUT_ICON: Record<string, NvIconName> = {
  pedidos: "receipt",
  assistente: "mic",
  mesas: "table",
  mesa: "table",
  meulink: "link",
  produtos: "bag",
  acerto: "pix",
};

const TODO_ICON: Record<"call" | "pix", NvIconName> = { call: "bell", pix: "pix" };

/** O ícone de cada passo de "O que falta". */
const GUIDE_ICON: Record<GuideItem["id"], NvIconName> = { menu: "mic", pix: "pix", tables: "table", photos: "bag" };

function hourLabel(from: number, index: number): string {
  return `${from + index}h`;
}

/**
 * "Hoje": a primeira tela do dono. Responde uma pergunta só: o que preciso fazer agora?
 * Em cima, o que está esperando (o número que mais pesa); no meio, as ações; embaixo, as vendas do dia.
 * Nada é estimado: cada número vem dos pedidos que o painel já tem.
 */
export default function OwnerToday({ today, onGo, onTodo, busyId = null, error = null, onMenu, showMenu = false }: Props) {
  const waitingText =
    today.waiting === 0
      ? "Nenhum pedido esperando"
      : today.waiting === 1
        ? "pedido esperando"
        : "pedidos esperando";

  return (
    <div className="nv-root">
      <main className="nv-screen">
        <TopBar title={today.greeting} sub={today.dateLine} onMenu={onMenu} showMenu={showMenu} />

        <section className="nv-now" aria-label="Agora">
          <p className="nv-now-big">
            {today.waiting === 0 ? "Tudo em dia" : today.waiting}
            <span>
              {today.waiting === 0 ? "Nenhum pedido esperando" : waitingText}
              {today.waiting > 0 ? `. O mais antigo está há ${minutesText(today.oldestMinutes)}.` : ""}
            </span>
          </p>
          <div className="nv-now-row">
            {[
              { count: today.cooking, text: "na cozinha", view: today.views.orders },
              { count: today.onTheWay, text: "a caminho", view: today.views.deliveries },
              { count: today.calling, text: "mesa chamando", view: today.views.tables },
            ].map((cell) => {
              const inside = (
                <>
                  <b>{cell.count}</b>
                  <span>{cell.text}</span>
                </>
              );
              // Com tela para onde ir, a caixa é tecla; sem ela (esta pessoa não tem a tela), só informa.
              const view = cell.view;
              return view ? (
                <button key={cell.text} type="button" className="nv-now-cell" onClick={() => onGo?.(view)}>
                  {inside}
                </button>
              ) : (
                <div key={cell.text} className="nv-now-cell">
                  {inside}
                </div>
              );
            })}
          </div>
          <button type="button" className="nv-btn is-fire is-block" onClick={() => onGo?.(today.views.orders)}>
            Ver os pedidos
          </button>
        </section>

        {error ? (
          <p className="nv-error" role="alert">
            {error}
          </p>
        ) : null}

        {today.todo.length > 0 ? (
          <section aria-labelledby="nv-todo-h">
            <h2 className="nv-h2" id="nv-todo-h" style={{ marginBottom: 14 }}>
              Para fazer agora
            </h2>
            <ul className="nv-todo">
              {today.todo.map((item) => (
                <li key={item.id} className={item.kind === "call" ? "is-call" : undefined}>
                  <span className="nv-todo-icon" aria-hidden="true">
                    <NvIcon name={TODO_ICON[item.kind]} />
                  </span>
                  {item.view ? (
                    <button type="button" className="nv-todo-text" onClick={() => onGo?.(item.view as string)}>
                      <strong>{item.title}</strong>
                      <span>{item.note}</span>
                    </button>
                  ) : (
                    <span className="nv-todo-text">
                      <strong>{item.title}</strong>
                      <span>{item.note}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className={`nv-btn ${item.kind === "call" ? "is-green" : "is-fire"}`}
                    disabled={busyId === item.id}
                    onClick={() => onTodo?.(item)}
                  >
                    {busyId === item.id ? "Enviando…" : item.action}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {today.guide && today.guide.length > 0 ? (
          <section aria-labelledby="nv-guide-h">
            <h2 className="nv-h2" id="nv-guide-h" style={{ marginBottom: 14 }}>
              O que falta
            </h2>
            <ul className="nv-todo">
              {today.guide.map((step) => (
                <li key={step.id}>
                  <span className="nv-todo-icon" aria-hidden="true">
                    <NvIcon name={GUIDE_ICON[step.id]} />
                  </span>
                  <button type="button" className="nv-todo-text" onClick={() => onGo?.(step.view)}>
                    <strong>{step.title}</strong>
                    <span>{step.note}</span>
                  </button>
                  <button type="button" className="nv-btn is-green" onClick={() => onGo?.(step.view)}>
                    {step.action}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {today.sales || today.salesMessage ? (
          <section className="nv-sales" aria-labelledby="nv-sales-h">
            <h2 className="nv-h2" id="nv-sales-h" style={{ fontSize: 17, marginBottom: 8 }}>
              Vendas de hoje
            </h2>
            {today.sales ? (
              <>
                <p className="nv-sales-total">{money(today.sales.total)}</p>
                <p className="nv-sales-note">
                  {today.sales.orders === 0
                    ? "Ainda sem vendas hoje."
                    : `${today.sales.orders} ${today.sales.orders === 1 ? "pedido" : "pedidos"}${
                        today.sales.averageTicket !== null ? `, ticket médio de ${money(today.sales.averageTicket)}` : ""
                      }`}
                </p>
                {today.sales.hours.length > 0 ? (
                  <>
                    <div className="nv-bars" role="img" aria-label="Pedidos por hora">
                      {today.sales.hours.map((count, index) => {
                        const max = Math.max(...today.sales!.hours, 1);
                        return (
                          <i
                            key={index}
                            className={index === today.sales!.nowIndex ? "is-now" : undefined}
                            style={{ height: `${Math.max(6, Math.round((count / max) * 100))}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="nv-bars-axis" aria-hidden="true">
                      <span>{hourLabel(today.sales.hoursFrom, 0)}</span>
                      <span>{hourLabel(today.sales.hoursFrom, Math.floor(today.sales.hours.length / 2))}</span>
                      <span>{hourLabel(today.sales.hoursFrom, today.sales.hours.length - 1)}</span>
                    </div>
                  </>
                ) : null}
                {/* O cartão inteiro é o botão (nv-hit): tocar em qualquer lugar das vendas abre os números. */}
                <button type="button" className="nv-link nv-hit" onClick={() => onGo?.(today.views.numbers)}>
                  Ver todos os números
                </button>
              </>
            ) : (
              <p className="nv-sales-note" role="status">
                {today.salesMessage}
              </p>
            )}
          </section>
        ) : null}

        {today.shortcuts.length > 0 ? (
          <section className="nv-quick" aria-label="Atalhos">
            {today.shortcuts.map((item) => (
              <button key={item.view} type="button" className="nv-quick-btn" onClick={() => onGo?.(item.view)}>
                <NvIcon name={SHORTCUT_ICON[item.view] ?? "doc"} /> {item.label}
              </button>
            ))}
          </section>
        ) : null}
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
