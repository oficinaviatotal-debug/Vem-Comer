import { useEffect, useRef, useState } from "react";
import {
  fetchAdminOrders,
  updateOrderStatus,
  fetchProducts,
  fetchMenus,
  createProduct,
  deleteProduct,
  createMenu,
  deleteMenu,
  login,
  logout,
  getToken,
  getUser,
  fetchUsers,
  createUser,
  deactivateUser,
  deleteUser,
  fetchTables,
  fetchTableQr,
  createTable,
  deleteTable,
  confirmPayment,
  mediaUrl,
} from "./api";
import PhotoPicker from "../photos/PhotoPicker";
import OnboardingGuide from "../onboarding/OnboardingGuide";
import { ADMIN_TOUR, ADMIN_TOUR_ID } from "../onboarding/adminTour";
import { hasSeenGuide, markGuideSeen } from "../onboarding/guideStorage";
import ConfirmButton from "./ConfirmButton";
import PixSettingsPanel from "./PixSettingsPanel";
import LogoPanel from "../logo/LogoPanel";
import { adminPaymentChip, canConfirmPayment } from "../customer/payment";
import {
  formatMoney,
  formatTime,
  paymentLabel,
  roleLabel,
  shortOrderCode,
} from "./format";
import {
  STATUS_DONE,
  STATUS_PREPARING,
  isActiveStatus,
  nextAction,
  sortForKitchen,
  statusLabel,
} from "./orderStatus";
import { tableOrderUrl as buildTableUrl } from "./links";
import { rememberCompany } from "./lastCompany";
import MenuAssistant from "../assistant/MenuAssistant";
import "../ui.css";
import "../admin.css";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type Order = {
  id: string;
  customer_name: string;
  total_price: number;
  status: string;
  payment_method: string;
  /** "PENDING" until someone at the restaurant confirms the money arrived, then "PAID". */
  payment_status?: string;
  payment_change: number;
  created_at: string;
  table_number?: string | null;
  items?: OrderItem[];
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  menu_id: string;
  thumb_url?: string | null;
  image_url?: string | null;
};

type Menu = {
  id: string;
  name: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type TableRow = {
  id: string;
  number: number;
  status: string;
};

type AdminView =
  | "pedidos"
  | "assistente"
  | "produtos"
  | "categorias"
  | "dashboard"
  | "usuarios"
  | "mesas"
  | "pagamento"
  | "marca";

const ADMIN_VIEWS: string[] = [
  "pedidos",
  "assistente",
  "produtos",
  "categorias",
  "dashboard",
  "usuarios",
  "mesas",
  "pagamento",
  "marca",
];

function isAdminView(value: string): value is AdminView {
  return ADMIN_VIEWS.includes(value);
}

type AdminPanelProps = {
  companyId: string;
  companySlug: string;
  onBack: () => void;
};

export default function AdminPanel({
  companyId,
  companySlug,
  onBack,
}: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [currentUser, setCurrentUser] = useState(getUser());

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const lastOrderCountRef = useRef<number | null>(null);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);

  const [view, setView] = useState<AdminView>("pedidos");

  const [products, setProducts] = useState<Product[]>([]);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMenuId, setNewMenuId] = useState("");
  const [newMenuName, setNewMenuName] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("WAITER");
  const [userError, setUserError] = useState("");

  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableQrs, setTableQrs] = useState<Record<string, string>>({});
  const [newTableNumber, setNewTableNumber] = useState("");
  const [tableError, setTableError] = useState("");

  const [payError, setPayError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Guided onboarding. Declared here, before any early return, so the hook
  // order never changes between renders.
  const [guideOpen, setGuideOpen] = useState(false);
  const canUseGuide =
    currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  useEffect(() => {
    // First time an owner opens the panel on this browser. With no menu yet the
    // owner goes straight to the Assistente (voice and touch, no typing);
    // with a menu, the tour of tables, Pix and orders is offered.
    if (
      !isAuthenticated ||
      currentUser?.role !== "OWNER" ||
      hasSeenGuide(ADMIN_TOUR_ID, currentUser.id)
    ) {
      return;
    }

    let cancelled = false;
    fetchProducts(companyId)
      .then((rows) => {
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length === 0) setView("assistente");
        else setGuideOpen(true);
      })
      .catch(() => {
        if (!cancelled) setGuideOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.role, companyId]);

  async function loadOrders() {
    try {
      const data = await fetchAdminOrders(companyId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoginError("");

    if (!loginEmail || !loginPassword) return;

    try {
      await login(loginEmail, loginPassword);

      setIsAuthenticated(true);
      setCurrentUser(getUser());
      rememberCompany(companySlug);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Email ou senha inválidos"
      );
    }
  }

  useEffect(() => {
    async function pollOrders() {
      try {
        const data = await fetchAdminOrders(companyId);
        const currentOrders = Array.isArray(data) ? data : [];

        setOrders(currentOrders);

        if (
          lastOrderCountRef.current !== null &&
          currentOrders.length > lastOrderCountRef.current
        ) {
          setShowNewOrderAlert(true);
        }

        lastOrderCountRef.current = currentOrders.length;
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    pollOrders();

    const interval = setInterval(pollOrders, 5000);

    return () => clearInterval(interval);
  }, [companyId]);

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setView("pedidos");
  }

  async function handleStatusChange(
    orderId: string,
    newStatus: string
  ) {
    try {
      await updateOrderStatus(orderId, newStatus);

      const data = await fetchAdminOrders(companyId);

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleConfirmPayment(orderId: string) {
    setPayError(null);
    setPayingId(orderId);

    try {
      await confirmPayment(orderId);

      const data = await fetchAdminOrders(companyId);

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setPayError({
        id: orderId,
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível confirmar o pagamento",
      });
    } finally {
      setPayingId(null);
    }
  }

  async function loadProducts() {
    try {
      const [productsData, menusData] = await Promise.all([
        fetchProducts(companyId),
        fetchMenus(companyId),
      ]);

      setProducts(
        Array.isArray(productsData) ? productsData : []
      );

      setMenus(
        Array.isArray(menusData) ? menusData : []
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function loadUsers() {
    try {
      const data = await fetchUsers(companyId);

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (
      view === "produtos" ||
      view === "categorias"
    ) {
      loadProducts();
    }

    if (view === "usuarios") {
      loadUsers();
    }

    if (view === "mesas") {
      loadTables();
    }
  }, [view, companyId]);

  async function handleCreateProduct() {
    if (!newName || !newPrice) return;

    try {
      await createProduct(
        companyId,
        newName,
        newDescription,
        Number(newPrice),
        newMenuId
      );

      setNewName("");
      setNewDescription("");
      setNewPrice("");
      setNewMenuId("");

      loadProducts();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteProduct(productId: string) {
    try {
      await deleteProduct(productId);
      loadProducts();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateMenu() {
    if (!newMenuName) return;

    try {
      await createMenu(companyId, newMenuName);

      setNewMenuName("");

      loadProducts();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteMenu(menuId: string) {
    try {
      await deleteMenu(menuId);
      loadProducts();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateUser() {
    setUserError("");

    if (
      !newUserName ||
      !newUserEmail ||
      !newUserPassword
    ) {
      return;
    }

    try {
      await createUser(
        companyId,
        newUserName,
        newUserEmail,
        newUserPassword,
        newUserRole
      );

      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("WAITER");

      loadUsers();
    } catch (err) {
      setUserError(
        err instanceof Error
          ? err.message
          : "Erro ao criar usuário"
      );
    }
  }

  async function handleDeactivateUser(userId: string) {
    try {
      await deactivateUser(userId);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function loadTables() {
    try {
      const data = await fetchTables(companyId);
      const rows: TableRow[] = Array.isArray(data) ? data : [];

      setTables(rows);

      const entries = await Promise.all(
        rows.map(async (row) => {
          try {
            const qr = await fetchTableQr(
              companyId,
              row.id,
              tableOrderUrl(row.id)
            );
            return [row.id, qr] as const;
          } catch (err) {
            console.error(err);
            return null;
          }
        })
      );

      setTableQrs(
        Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [string, string] => entry !== null
          )
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateTable() {
    setTableError("");

    if (!newTableNumber) return;

    try {
      await createTable(
        companyId,
        newTableNumber
      );

      setNewTableNumber("");

      loadTables();
    } catch (err) {
      setTableError(
        err instanceof Error
          ? err.message
          : "Erro ao criar mesa"
      );
    }
  }

  async function handleDeleteTable(tableId: string) {
    try {
      await deleteTable(tableId);
      loadTables();
    } catch (err) {
      console.error(err);
    }
  }

  function tableOrderUrl(tableId: string) {
    return buildTableUrl(
      window.location.origin,
      window.location.pathname,
      companySlug,
      tableId
    );
  }

  const sortedOrders = sortForKitchen(orders);
  const openOrdersCount = orders.filter((order) =>
    isActiveStatus(order.status)
  ).length;

  function tabClass(name: AdminView) {
    return view === name ? "adm-tab is-active" : "adm-tab";
  }

  if (!isAuthenticated) {
    return (
      <main className="adm adm-login-page">
        <form
          className="adm-login sheet"
          onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}
        >
          <img
            className="adm-login-logo"
            src="/logo-vem-comer.png"
            alt="Vem Comer"
          />

          <div>
            <h1 className="adm-title">Área do restaurante</h1>
            <p className="adm-lead">
              Entre com o e-mail e a senha do seu cadastro.
            </p>
          </div>

          <label className="field">
            <span>E-mail</span>
            <input
              id="admin-login-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="voce@restaurante.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              id="admin-login-password"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </label>

          {loginError && (
            <p className="msg-error" role="alert">
              {loginError}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block">
            Entrar
          </button>

          <button
            type="button"
            className="btn btn-quiet"
            onClick={onBack}
          >
            Voltar ao cardápio
          </button>
        </form>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="adm">
        <p className="adm-status" role="status">
          Carregando pedidos…
        </p>
      </main>
    );
  }

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.total_price),
    0
  );

  const totalOrders = orders.length;

  const avgTicket =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const ordersByStatus = orders.reduce<Record<string, number>>(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const ordersByPayment = orders.reduce<Record<string, number>>(
    (acc, o) => {
      const key = paymentLabel(o.payment_method);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  function menuName(menuId: string | null | undefined) {
    return menus.find((menu) => menu.id === menuId)?.name;
  }

  return (
    <div className="adm">
      {guideOpen && (
        <OnboardingGuide
          steps={ADMIN_TOUR}
          onNavigate={(target) => {
            if (isAdminView(target)) setView(target);
          }}
          onClose={() => {
            if (currentUser) markGuideSeen(ADMIN_TOUR_ID, currentUser.id);
            setGuideOpen(false);
          }}
        />
      )}

      {showNewOrderAlert && (
        <div className="adm-alert" role="alert">
          <span>Chegou um novo pedido.</span>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setView("pedidos");
              setShowNewOrderAlert(false);
            }}
          >
            Ver pedidos
          </button>
        </div>
      )}

      <header className="adm-bar">
        <img
          className="adm-logo"
          src="/logo-vem-comer.png"
          alt="Vem Comer"
        />

        <div className="adm-bar-actions">
          {canUseGuide && (
            <button
              id="admin-btn-guide"
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setGuideOpen(true)}
            >
              Guia
            </button>
          )}

          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={onBack}
          >
            Cardápio
          </button>

          <button
            id="admin-btn-logout"
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </header>

      <div className="adm-who">
        <h1 className="adm-title">Painel</h1>
        {currentUser && (
          <p className="adm-lead">
            {currentUser.name}, {roleLabel(currentUser.role)}
          </p>
        )}
      </div>

      <nav className="adm-tabs" aria-label="Seções do painel">
        <button
          id="admin-tab-pedidos"
          type="button"
          className={tabClass("pedidos")}
          aria-current={view === "pedidos" ? "page" : undefined}
          onClick={() => setView("pedidos")}
        >
          Pedidos
          {openOrdersCount > 0 && (
            <span
              className="adm-count"
              aria-label={`${openOrdersCount} em aberto`}
            >
              {openOrdersCount}
            </span>
          )}
        </button>

        {(currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") && (
          <button
            id="admin-tab-assistente"
            type="button"
            className={tabClass("assistente")}
            aria-current={view === "assistente" ? "page" : undefined}
            onClick={() => setView("assistente")}
          >
            Assistente
          </button>
        )}

        <button
          id="admin-tab-produtos"
          type="button"
          className={tabClass("produtos")}
          aria-current={view === "produtos" ? "page" : undefined}
          onClick={() => setView("produtos")}
        >
          Produtos
        </button>

        <button
          id="admin-tab-categorias"
          type="button"
          className={tabClass("categorias")}
          aria-current={view === "categorias" ? "page" : undefined}
          onClick={() => setView("categorias")}
        >
          Categorias
        </button>

        <button
          id="admin-tab-mesas"
          type="button"
          className={tabClass("mesas")}
          aria-current={view === "mesas" ? "page" : undefined}
          onClick={() => setView("mesas")}
        >
          Mesas
        </button>

        <button
          id="admin-tab-dashboard"
          type="button"
          className={tabClass("dashboard")}
          aria-current={view === "dashboard" ? "page" : undefined}
          onClick={() => setView("dashboard")}
        >
          Resumo
        </button>

        {(currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") && (
          <button
            id="admin-tab-pagamento"
            type="button"
            className={tabClass("pagamento")}
            aria-current={view === "pagamento" ? "page" : undefined}
            onClick={() => setView("pagamento")}
          >
            Pagamento
          </button>
        )}

        {(currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") && (
          <button
            id="admin-tab-marca"
            type="button"
            className={tabClass("marca")}
            aria-current={view === "marca" ? "page" : undefined}
            onClick={() => setView("marca")}
          >
            Marca
          </button>
        )}

        {currentUser?.role === "OWNER" && (
          <button
            id="admin-tab-usuarios"
            type="button"
            className={tabClass("usuarios")}
            aria-current={view === "usuarios" ? "page" : undefined}
            onClick={() => setView("usuarios")}
          >
            Equipe
          </button>
        )}
      </nav>

      {view === "dashboard" ? (
        <section className="sheet" aria-label="Resumo">
          <h2>Resumo</h2>

          <ul className="adm-summary">
            <li className="leader-row">
              <span>Total dos pedidos</span>
              <span className="leader" />
              <span className="money">{formatMoney(totalRevenue)}</span>
            </li>
            <li className="leader-row">
              <span>Pedidos</span>
              <span className="leader" />
              <span className="money">{totalOrders}</span>
            </li>
            <li className="leader-row">
              <span>Ticket médio</span>
              <span className="leader" />
              <span className="money">{formatMoney(avgTicket)}</span>
            </li>
          </ul>

          <h3 className="adm-subtitle">Pedidos por situação</h3>
          <ul className="adm-summary">
            {Object.entries(ordersByStatus).map(([status, count]) => (
              <li key={status} className="leader-row">
                <span>{statusLabel(status)}</span>
                <span className="leader" />
                <span className="money">{count}</span>
              </li>
            ))}
          </ul>

          <h3 className="adm-subtitle">Pedidos por pagamento</h3>
          <ul className="adm-summary">
            {Object.entries(ordersByPayment).map(([method, count]) => (
              <li key={method} className="leader-row">
                <span>{method}</span>
                <span className="leader" />
                <span className="money">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : view === "pagamento" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <PixSettingsPanel
          companyId={companyId}
          canEdit={currentUser?.role === "OWNER"}
        />
      ) : view === "marca" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <LogoPanel companyId={companyId} />
      ) : view === "usuarios" && currentUser?.role === "OWNER" ? (
        <section className="adm-stack" aria-label="Equipe">
          <form
            className="sheet"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateUser();
            }}
          >
            <h2>Nova pessoa na equipe</h2>

            <label className="field">
              <span>Nome</span>
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </label>

            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <small>Mínimo de 8 caracteres.</small>
            </label>

            <label className="field">
              <span>Função</span>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
              >
                <option value="MANAGER">Gerente</option>
                <option value="WAITER">Garçom</option>
                <option value="CASHIER">Caixa</option>
                <option value="KITCHEN">Cozinha</option>
                <option value="COURIER">Entregador</option>
              </select>
            </label>

            {userError && (
              <p className="msg-error" role="alert">
                {userError}
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
                <li
                  key={user.id}
                  className={user.active ? "adm-row" : "adm-row is-off"}
                >
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
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleDeactivateUser(user.id)}
                      >
                        Desativar
                      </button>
                    )}

                    {!user.active && (
                      <ConfirmButton
                        label="Apagar"
                        onConfirm={() => handleDeleteUser(user.id)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "assistente" ? (
        <MenuAssistant
          companyId={companyId}
          onSaved={loadProducts}
          onSeeMenu={() => setView("produtos")}
          onOpenGuide={() => setGuideOpen(true)}
        />
      ) : view === "produtos" ? (
        <section className="adm-stack" aria-label="Produtos">
          <form
            className="sheet"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateProduct();
            }}
          >
            <h2>Novo produto</h2>

            <label className="field">
              <span>Nome</span>
              <input
                id="admin-product-name"
                placeholder="Ex.: Combinado 20 peças"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Descrição (opcional)</span>
              <input
                id="admin-product-description"
                placeholder="O que vem no prato"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Preço em reais</span>
              <input
                id="admin-product-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="49,90"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select
                id="admin-product-menu"
                value={newMenuId}
                onChange={(e) => setNewMenuId(e.target.value)}
              >
                <option value="">Sem categoria</option>

                {menus.map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              id="admin-product-add"
              type="submit"
              className="btn btn-primary btn-block"
            >
              Adicionar Produto
            </button>
          </form>

          {products.length === 0 ? (
            <div className="adm-empty">
              <h2>Nenhum produto ainda</h2>
              <p>Preencha o nome e o preço acima e toque em Adicionar Produto.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setView("assistente")}
              >
                Cadastrar vários pratos com o assistente
              </button>
            </div>
          ) : (
            <ul className="adm-list">
              {products.map((product) => (
                <li key={product.id} className="adm-row adm-row-photo">
                  {mediaUrl(product.thumb_url) && (
                    <img
                      className="adm-thumb"
                      src={mediaUrl(product.thumb_url)}
                      alt=""
                      width={72}
                      height={54}
                      loading="lazy"
                    />
                  )}
                  <div className="adm-row-main">
                    <strong>{product.name}</strong>
                    {product.description && (
                      <p className="adm-muted">{product.description}</p>
                    )}
                    {menuName(product.menu_id) && (
                      <span className="chip">{menuName(product.menu_id)}</span>
                    )}
                  </div>

                  <div className="adm-row-side">
                    <span className="money">{formatMoney(product.price)}</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-expanded={photoFor === product.id}
                      onClick={() => setPhotoFor(photoFor === product.id ? null : product.id)}
                    >
                      {photoFor === product.id
                        ? "Fechar"
                        : product.thumb_url
                          ? "Trocar foto"
                          : "Colocar foto"}
                    </button>
                    <ConfirmButton
                      label="Remover"
                      onConfirm={() => handleDeleteProduct(product.id)}
                    />
                  </div>

                  {photoFor === product.id && (
                    <div className="adm-row-photo-picker">
                      <PhotoPicker
                        productId={product.id}
                        productName={product.name}
                        currentPhoto={product.image_url}
                        onSaved={() => loadProducts()}
                        onRemoved={() => loadProducts()}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "categorias" ? (
        <section className="adm-stack" aria-label="Categorias">
          <form
            className="sheet"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateMenu();
            }}
          >
            <h2>Nova categoria</h2>

            <label className="field">
              <span>Nome da categoria</span>
              <input
                id="admin-menu-name"
                placeholder="Ex.: Pratos"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
              />
            </label>

            <button
              id="admin-menu-add"
              type="submit"
              className="btn btn-primary btn-block"
            >
              Adicionar Categoria
            </button>
          </form>

          {menus.length === 0 ? (
            <div className="adm-empty">
              <h2>Nenhuma categoria ainda</h2>
              <p>Crie a primeira acima, por exemplo Pratos, Bebidas ou Sobremesas.</p>
            </div>
          ) : (
            <ul className="adm-list">
              {menus.map((menu) => (
                <li key={menu.id} className="adm-row">
                  <strong className="adm-row-main">{menu.name}</strong>

                  <ConfirmButton
                    label="Remover"
                    onConfirm={() => handleDeleteMenu(menu.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : view === "mesas" ? (
        <section className="adm-stack" aria-label="Mesas">
          <form
            className="sheet"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateTable();
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
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
              />
            </label>

            {tableError && (
              <p className="msg-error" role="alert">
                {tableError}
              </p>
            )}

            <button
              id="admin-table-add"
              type="submit"
              className="btn btn-primary btn-block"
            >
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

                    <span
                      className={
                        table.status === "livre"
                          ? "chip chip-free"
                          : "chip chip-busy"
                      }
                    >
                      {table.status === "livre" ? "Livre" : "Ocupada"}
                    </span>
                  </div>

                  {tableQrs[table.id] ? (
                    <>
                      <img
                        className="adm-qr"
                        src={tableQrs[table.id]}
                        alt={`QR code da Mesa ${table.number}`}
                        width={160}
                        height={160}
                      />

                      <a
                        className="btn btn-outline btn-sm btn-block"
                        href={tableQrs[table.id]}
                        download={`qr-mesa-${table.number}.png`}
                      >
                        Baixar QR
                      </a>
                    </>
                  ) : (
                    <span className="adm-muted">Gerando QR code…</span>
                  )}

                  <ConfirmButton
                    label="Remover"
                    onConfirm={() => handleDeleteTable(table.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : orders.length === 0 ? (
        <div className="adm-empty">
          <h2>Nenhum pedido ainda</h2>
          <p>
            Quando um cliente pedir pelo QR da mesa, o pedido aparece aqui e o
            painel avisa você.
          </p>
        </div>
      ) : (
        <ul className="adm-orders" aria-label="Pedidos">
          {sortedOrders.map((order) => {
            const next = nextAction(order.status);
            const changeFor = Number(order.payment_change);
            const showName =
              order.customer_name && order.customer_name !== "Cliente Balcão";

            return (
              <li
                key={order.id}
                className={
                  isActiveStatus(order.status)
                    ? "comanda-wrap"
                    : "comanda-wrap is-done"
                }
              >
                <article className="comanda">
                  <header className="comanda-head">
                    <div>
                      <h2 className="comanda-where">
                        {order.table_number
                          ? `Mesa ${order.table_number}`
                          : "Balcão"}
                      </h2>

                      <p className="comanda-meta">
                        {showName && <span>{order.customer_name}</span>}
                        <span>{formatTime(order.created_at)}</span>
                        <span>{shortOrderCode(order.id)}</span>
                      </p>
                    </div>

                    <span
                      className={
                        order.status === STATUS_DONE
                          ? "chip chip-done"
                          : order.status === STATUS_PREPARING
                            ? "chip chip-prep"
                            : "chip chip-wait"
                      }
                    >
                      {statusLabel(order.status)}
                    </span>
                  </header>

                  <ul className="comanda-items">
                    {(order.items ?? []).map((item, index) => (
                      <li key={index} className="leader-row">
                        <span>
                          <span className="comanda-qty">{item.quantity}x</span>{" "}
                          {item.name}
                        </span>
                        <span className="leader" />
                        <span className="money">{formatMoney(item.total)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="leader-row comanda-total">
                    <strong>Total</strong>
                    <span className="leader" />
                    <span className="money">
                      {formatMoney(order.total_price)}
                    </span>
                  </div>

                  <p className="comanda-pay">
                    Pagamento: <strong>{paymentLabel(order.payment_method)}</strong>
                    {order.payment_method === "dinheiro" && changeFor > 0 && (
                      <>, troco para {formatMoney(changeFor)}</>
                    )}{" "}
                    <span
                      className={
                        "chip chip-pay is-" +
                        adminPaymentChip(
                          order.payment_method,
                          order.payment_status
                        ).tone
                      }
                    >
                      {
                        adminPaymentChip(
                          order.payment_method,
                          order.payment_status
                        ).label
                      }
                    </span>
                  </p>

                  {canConfirmPayment(
                    currentUser?.role,
                    order.payment_status
                  ) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-block"
                      disabled={payingId === order.id}
                      onClick={() => handleConfirmPayment(order.id)}
                    >
                      {payingId === order.id
                        ? "Confirmando…"
                        : "Pagamento recebido"}
                    </button>
                  )}

                  {payError?.id === order.id && (
                    <p className="msg-error" role="alert">
                      {payError.message}
                    </p>
                  )}

                  {next && (
                    <button
                      type="button"
                      className={
                        next.next === STATUS_DONE
                          ? "btn btn-mata btn-block"
                          : "btn btn-primary btn-block"
                      }
                      onClick={() => handleStatusChange(order.id, next.next)}
                    >
                      {next.label}
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
