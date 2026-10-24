import { useCallback, useEffect, useState } from "react";
import "../ui.css";
import "../admin.css";
import type { OldScreen } from "./shellLogic";
import BusinessPanel from "../business/BusinessPanel";
import CostsPanel from "../costs/CostsPanel";
import CourierHome from "../courier/CourierHome";
import ShareLinkView from "../nav/ShareLinkView";
import ApprovalsView from "../nav/ApprovalsView";
import TablePoster from "../mesa/TablePoster";
import PushToggle from "../push/PushToggle";
import ConfirmButton from "../service/ConfirmButton";
import DeliveryPanel from "../service/DeliveryPanel";
import HelpInbox from "../service/HelpInbox";
import HelpSheet from "../service/HelpSheet";
import PauseStrip from "../service/PauseStrip";
import PixSettingsPanel from "../service/PixSettingsPanel";
import PlatformPanel from "../service/PlatformPanel";
import SubscriptionPanel from "../service/SubscriptionPanel";
import TitularInbox from "../service/TitularInbox";
import {
  createTable,
  createUser,
  deactivateUser,
  deleteTable,
  deleteUser,
  fetchAdminOrders,
  fetchTableQr,
  fetchTables,
  fetchUsers,
} from "../service/api";
import { formatMoney, paymentLabel, roleLabel } from "../service/format";
import type { HelpTopic } from "../service/helpLogic";
import { tableOrderUrl as buildTableUrl } from "../service/links";
import { statusLabel } from "../service/orderStatus";
import type { OwnerPlan } from "../service/subscriptionView";

/**
 * A ponte: as telas do painel que ainda não foram refeitas no visual novo, funcionando como sempre. Este arquivo só é
 * baixado quando alguém abre uma delas. Cada tela sai daqui quando chega a sua rodada (a de cadastrar mesas e imprimir o
 * QR, a da equipe e o resumo estão aqui por serem trechos do painel antigo; as outras são as telas antigas inteiras).
 */

type StaffUser = { id: string; name: string; email: string; role: string; active: boolean };
type TableRow = { id: string; number: number; status: string };
type SummaryOrder = { status: string; payment_method: string; total_price: number | string };

// ---------------------------------------------------------------- Mesas: cadastrar e imprimir o QR

function TablesPanel({ companyId, slug, name }: { companyId: string; slug: string; name: string }) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");

  const urlOf = useCallback(
    (tableId: string) => buildTableUrl(window.location.origin, window.location.pathname, slug, tableId),
    [slug],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchTables(companyId);
      const rows: TableRow[] = Array.isArray(data) ? data : [];
      setTables(rows);
      const entries = await Promise.all(
        rows.map(async (row) => {
          try {
            return [row.id, await fetchTableQr(companyId, row.id, urlOf(row.id))] as const;
          } catch (err) {
            console.error(err);
            return null;
          }
        }),
      );
      setQrs(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    } catch (err) {
      console.error(err);
    }
  }, [companyId, urlOf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError("");
    if (!number) return;
    try {
      await createTable(companyId, number);
      setNumber("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar mesa");
    }
  }

  async function remove(tableId: string) {
    try {
      await deleteTable(tableId);
      void load();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className="adm-stack" aria-label="Mesas">
      <form
        className="sheet"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <h2>Nova mesa</h2>
        <label className="field">
          <span>Número da mesa</span>
          <input
            id="admin-table-number"
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="Ex.: 1"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        {error && (
          <p className="msg-error" role="alert">
            {error}
          </p>
        )}
        <button id="admin-table-add" type="submit" className="btn btn-primary btn-block">
          Adicionar Mesa
        </button>
      </form>

      {tables.length === 0 ? (
        <div id="admin-table-list" className="adm-empty">
          <h2>Nenhuma mesa ainda</h2>
          <p>Cada mesa ganha um QR Code. O cliente aponta a câmera e já pede.</p>
        </div>
      ) : (
        <ul id="admin-table-list" className="adm-tables">
          {tables.map((table) => (
            <li key={table.id} className="adm-table">
              <div className="adm-table-head">
                <div>
                  <span className="adm-table-label">Mesa</span>
                  <span className="adm-table-number">{table.number}</span>
                </div>
                <span className={table.status === "livre" ? "chip chip-free" : "chip chip-busy"}>
                  {table.status === "livre" ? "Livre" : "Ocupada"}
                </span>
              </div>
              {qrs[table.id] ? (
                <>
                  <img className="adm-qr" src={qrs[table.id]} alt={`QR code da Mesa ${table.number}`} width={160} height={160} />
                  <a className="btn btn-outline btn-sm btn-block" href={qrs[table.id]} download={`qr-mesa-${table.number}.png`}>
                    Baixar QR
                  </a>
                  <TablePoster restaurant={name} tableNumber={table.number} qr={qrs[table.id]} />
                </>
              ) : (
                <span className="adm-muted">Gerando QR code…</span>
              )}
              <ConfirmButton label="Remover" onConfirm={() => void remove(table.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Equipe

function TeamPanel({ companyId }: { companyId: string }) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("WAITER");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchUsers(companyId);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError("");
    if (!name || !email || !password) return;
    try {
      await createUser(companyId, name, email, password, role);
      setName("");
      setEmail("");
      setPassword("");
      setRole("WAITER");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  }

  async function act(run: () => Promise<unknown>) {
    try {
      await run();
      void load();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <section className="adm-stack" aria-label="Equipe">
      <form
        className="sheet"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <h2>Nova pessoa na equipe</h2>
        <label className="field">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <small>Mínimo de 8 caracteres.</small>
        </label>
        <label className="field">
          <span>Função</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="MANAGER">Gerente</option>
            <option value="WAITER">Garçom</option>
            <option value="CASHIER">Caixa</option>
            <option value="KITCHEN">Cozinha</option>
            <option value="COURIER">Entregador</option>
          </select>
        </label>
        {error && (
          <p className="msg-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block">
          Adicionar pessoa
        </button>
      </form>

      {users.length === 0 ? (
        <div className="adm-empty">
          <h2>Só você por aqui</h2>
          <p>Adicione garçons, cozinha e caixa para cada um ter o próprio acesso.</p>
        </div>
      ) : (
        <ul className="adm-list">
          {users.map((user) => (
            <li key={user.id} className={user.active ? "adm-row" : "adm-row is-off"}>
              <div className="adm-row-main">
                <strong>{user.name}</strong>
                <p className="adm-muted">{user.email}</p>
                <span className="chip">
                  {roleLabel(user.role)}
                  {!user.active && ", desativado"}
                </span>
              </div>
              <div className="adm-row-side">
                {user.active && user.role !== "OWNER" && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void act(() => deactivateUser(user.id))}>
                    Desativar
                  </button>
                )}
                {!user.active && <ConfirmButton label="Apagar" onConfirm={() => void act(() => deleteUser(user.id))} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Resumo (quem não é dono nem gerente)

function SummaryPanel({ companyId }: { companyId: string }) {
  const [orders, setOrders] = useState<SummaryOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchAdminOrders(companyId);
        if (!alive) return;
        setOrders(Array.isArray(data) ? data : []);
        setFailed(false);
      } catch (err) {
        console.error(err);
        if (alive) setFailed(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [companyId]);

  if (!orders) {
    return (
      <p className="adm-status" role="status">
        {failed ? "Não consegui abrir o resumo. Confira a internet; tento de novo sozinho." : "Carregando o resumo…"}
      </p>
    );
  }

  const total = orders.reduce((sum, order) => sum + Number(order.total_price), 0);
  const average = orders.length > 0 ? total / orders.length : 0;
  const count = (key: (order: SummaryOrder) => string) =>
    Object.entries(
      orders.reduce<Record<string, number>>((acc, order) => {
        const name = key(order);
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {}),
    );

  return (
    <section className="sheet" aria-label="Resumo">
      <h2>Resumo</h2>
      <ul className="adm-summary">
        <li className="leader-row">
          <span>Total dos pedidos</span>
          <span className="leader" />
          <span className="money">{formatMoney(total)}</span>
        </li>
        <li className="leader-row">
          <span>Pedidos</span>
          <span className="leader" />
          <span className="money">{orders.length}</span>
        </li>
        <li className="leader-row">
          <span>Ticket médio</span>
          <span className="leader" />
          <span className="money">{formatMoney(average)}</span>
        </li>
      </ul>
      <h3 className="adm-subtitle">Pedidos por situação</h3>
      <ul className="adm-summary">
        {count((order) => statusLabel(order.status)).map(([label, n]) => (
          <li key={label} className="leader-row">
            <span>{label}</span>
            <span className="leader" />
            <span className="money">{n}</span>
          </li>
        ))}
      </ul>
      <h3 className="adm-subtitle">Pedidos por pagamento</h3>
      <ul className="adm-summary">
        {count((order) => paymentLabel(order.payment_method)).map(([label, n]) => (
          <li key={label} className="leader-row">
            <span>{label}</span>
            <span className="leader" />
            <span className="money">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- a ponte

export type LegacyProps = {
  screen: OldScreen;
  companyId: string;
  slug: string;
  name: string;
  role: string | null | undefined;
  plan: OwnerPlan | null;
  /** Leva a outra tela do painel (as telas antigas têm botões que levam a outras). */
  onGo: (view: string) => void;
  /** O número de aprovações e de chamados esperando (só o dono do sistema); o menu mostra. */
  onApprovals: (count: number) => void;
  onHelp: (count: number) => void;
};

export default function LegacyView({ screen, companyId, slug, name, role, plan, onGo, onApprovals, onHelp }: LegacyProps) {
  switch (screen) {
    case "tables":
      return <TablesPanel companyId={companyId} slug={slug} name={name || slug} />;
    case "summary":
      return <SummaryPanel companyId={companyId} />;
    case "business":
      return <BusinessPanel companyId={companyId} onGo={onGo} />;
    case "costs":
      return <CostsPanel companyId={companyId} />;
    case "pix":
      return <PixSettingsPanel companyId={companyId} canEdit={role === "OWNER"} />;
    case "link":
      return <ShareLinkView slug={slug} name={name || slug} onGo={onGo} />;
    case "zones":
      return <DeliveryPanel />;
    case "team":
      return <TeamPanel companyId={companyId} />;
    case "plan":
      return plan ? (
        <SubscriptionPanel plan={plan} restaurantName={name || slug} />
      ) : (
        <p className="adm-status" role="status">
          Carregando o plano…
        </p>
      );
    case "approvals":
      return <ApprovalsView onCount={onApprovals} />;
    case "subscriptions":
      return <PlatformPanel />;
    case "help":
      return (
        <>
          <HelpInbox onCount={onHelp} />
          <TitularInbox />
        </>
      );
  }
}

// ---------------------------------------------------------------- peças soltas que a casca usa

/** "Pausar pedidos" no alto dos Pedidos: um toque para o restaurante parar de receber (e voltar). */
export function PauseExtra() {
  return (
    <div className="adm nv-legacy-strip">
      <PauseStrip />
    </div>
  );
}

/** "Aviso no celular": a notificação de pedido novo com o aplicativo fechado. Some sozinho quando não vale. */
export function PushExtra({ companyId }: { companyId: string }) {
  return (
    <div className="adm nv-legacy-strip">
      <PushToggle companyId={companyId} />
    </div>
  );
}

/** A folha "Preciso de ajuda" (só dono e gerente). */
export function HelpOverlay({ screen, suggested, onClose }: { screen: string; suggested: HelpTopic | ""; onClose: () => void }) {
  return <HelpSheet screen={screen} suggested={suggested} onClose={onClose} />;
}

/** O entregador: a tela de entregas que ele já conhece, inteira. */
export function CourierView({ companyId, name, onLogout, onBack }: { companyId: string; name: string; onLogout: () => void; onBack: () => void }) {
  return <CourierHome companyId={companyId} name={name} onLogout={onLogout} onBack={onBack} />;
}
