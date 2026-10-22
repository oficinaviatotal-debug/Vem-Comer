import NvIcon, { type NvIconName } from "./Icons";
import { TopBar, VoiceOrb } from "./parts";
import { minutesText, money } from "./format";
import type { Today } from "./types";

type Props = { today: Today };

const TODO_ICON: Record<"call" | "pix", NvIconName> = { call: "bell", pix: "pix" };

function hourLabel(from: number, index: number): string {
  return `${from + index}h`;
}

/**
 * "Hoje": a primeira tela do dono. Responde uma pergunta só: o que preciso fazer agora?
 * Em cima, o que está esperando (o número que mais pesa); no meio, as ações; embaixo, as vendas do dia.
 * Nada é estimado: cada número vem dos pedidos que o painel já tem.
 */
export default function OwnerToday({ today }: Props) {
  const waitingText =
    today.waiting === 0
      ? "Nenhum pedido esperando"
      : today.waiting === 1
        ? "pedido esperando"
        : "pedidos esperando";

  return (
    <div className="nv-root">
      <main className="nv-screen">
        <TopBar title={today.greeting} sub={today.dateLine} />

        <section className="nv-now" aria-label="Agora">
          <p className="nv-now-big">
            {today.waiting === 0 ? "Tudo em dia" : today.waiting}
            <span>
              {today.waiting === 0 ? "Nenhum pedido esperando" : waitingText}
              {today.waiting > 0 ? `. O mais antigo está há ${minutesText(today.oldestMinutes)}.` : ""}
            </span>
          </p>
          <div className="nv-now-row">
            <div className="nv-now-cell">
              <b>{today.cooking}</b>
              <span>na cozinha</span>
            </div>
            <div className="nv-now-cell">
              <b>{today.onTheWay}</b>
              <span>a caminho</span>
            </div>
            <div className="nv-now-cell">
              <b>{today.calling}</b>
              <span>mesa chamando</span>
            </div>
          </div>
          <button type="button" className="nv-btn is-fire is-block">
            Ver os pedidos
          </button>
        </section>

        {today.todo.length > 0 ? (
          <section aria-labelledby="nv-todo-h">
            <h2 className="nv-h2" id="nv-todo-h" style={{ marginBottom: 14 }}>
              Para fazer agora
            </h2>
            <ul className="nv-todo">
              {today.todo.map((item) => (
                <li key={item.id} className={item.kind === "call" ? "is-call" : undefined}>
                  <span className="nv-icon-btn" aria-hidden="true" style={{ width: 40, height: 40 }}>
                    <NvIcon name={TODO_ICON[item.kind]} />
                  </span>
                  <span className="nv-todo-text">
                    <strong>{item.title}</strong>
                    <span>{item.note}</span>
                  </span>
                  <button type="button" className={`nv-btn ${item.kind === "call" ? "is-green" : "is-fire"}`}>
                    {item.action}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="nv-sales" aria-labelledby="nv-sales-h">
          <h2 className="nv-h2" id="nv-sales-h" style={{ fontSize: 17, marginBottom: 8 }}>
            Vendas de hoje
          </h2>
          <p className="nv-sales-total">{money(today.salesTotal)}</p>
          <p className="nv-sales-note">
            {today.salesOrders} pedidos, ticket médio de {money(today.averageTicket)}
          </p>
          <div className="nv-bars" role="img" aria-label="Pedidos por hora">
            {today.hours.map((count, index) => {
              const max = Math.max(...today.hours, 1);
              return (
                <i
                  key={index}
                  className={index === today.nowIndex ? "is-now" : undefined}
                  style={{ height: `${Math.max(6, Math.round((count / max) * 100))}%` }}
                />
              );
            })}
          </div>
          <div className="nv-bars-axis" aria-hidden="true">
            <span>{hourLabel(today.hoursFrom, 0)}</span>
            <span>{hourLabel(today.hoursFrom, Math.floor(today.hours.length / 2))}</span>
            <span>{hourLabel(today.hoursFrom, today.hours.length - 1)}</span>
          </div>
        </section>

        <section className="nv-quick" aria-label="Atalhos">
          <button type="button" className="nv-quick-btn">
            <NvIcon name="receipt" /> Fazer um pedido
          </button>
          <button type="button" className="nv-quick-btn">
            <NvIcon name="table" /> Abrir mesa
          </button>
          <button type="button" className="nv-quick-btn">
            <NvIcon name="bag" /> Cardápio
          </button>
          <button type="button" className="nv-quick-btn">
            <NvIcon name="link" /> Meu link
          </button>
        </section>
      </main>

      <div className="nv-dock is-float">
        <VoiceOrb label="Falar com o Vem" />
      </div>
    </div>
  );
}
