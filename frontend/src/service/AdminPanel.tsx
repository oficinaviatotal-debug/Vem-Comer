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
  refreshSession,
  SESSION_EXPIRED_EVENT,
  SESSION_REFRESH_MS,
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
import ProductOptionsEditor from "./ProductOptionsEditor";
import { groupsBadge } from "./optionsDraft";
import OnboardingGuide from "../onboarding/OnboardingGuide";
import { ADMIN_TOUR, ADMIN_TOUR_ID } from "../onboarding/adminTour";
import { hasSeenGuide, markGuideSeen } from "../onboarding/guideStorage";
import ConfirmButton from "./ConfirmButton";
import PixSettingsPanel from "./PixSettingsPanel";
import DeliveryPanel from "./DeliveryPanel";
import HoursPanel from "./HoursPanel";
import PauseStrip from "./PauseStrip";
import { resetSoldOut, setSoldOut } from "./hoursApi";
import SubscriptionPanel from "./SubscriptionPanel";
import PlatformPanel from "./PlatformPanel";
import HelpSheet from "./HelpSheet";
import HelpInbox from "./HelpInbox";
import TitularInbox from "./TitularInbox";
import { fetchPlatformHelp } from "./helpApi";
import { suggestedTopic } from "./helpLogic";
import { useOwnerPlan } from "./useOwnerPlan";
import { bannerOf, hasPlanTab, viewAllowed } from "./subscriptionView";
import LogoPanel from "../logo/LogoPanel";
import { alertDevice } from "./alertDevice";
import { knownOrderIds, newOrders, wantsNewOrderAlert } from "./newOrders";
import CourierHome from "../courier/CourierHome";
import PushToggle from "../push/PushToggle";
import CourierPanel from "../courier/CourierPanel";
import CashSettlement from "../courier/CashSettlement";
import { adminPaymentChip, canConfirmPayment } from "../customer/payment";
import ItemDetails from "../customer/ItemDetails";
import { handlingView, itemsSubtotalCents } from "./orderHandling";
import {
  formatMoney,
  formatTime,
  paymentLabel,
  roleLabel,
  shortOrderCode,
} from "./format";
import {
  STATUS_DONE,
  isActiveStatus,
  nextAction,
  sortForKitchen,
  statusLabel,
  statusTone,
} from "./orderStatus";
import { tableOrderUrl as buildTableUrl } from "./links";
import { rememberCompany } from "./lastCompany";
import MenuAssistant from "../assistant/MenuAssistant";
import CostsPanel from "../costs/CostsPanel";
import BusinessPanel from "../business/BusinessPanel";
import CallsBar from "../mesa/CallsBar";
import AdminDrawer, { type DrawerAction } from "../nav/AdminDrawer";
import HomeView from "../nav/HomeView";
import NavIcon from "../nav/NavIcon";
import { menuFor, viewTitle } from "../nav/navLogic";
import TablePoster from "../mesa/TablePoster";
import "../ui.css";
import "../admin.css";

type OrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  /** Size, extras and the like the customer chose, copied into the order. */
  options?: { group?: string; name: string; price?: number | string }[] | null;
  /** What the customer wrote for the kitchen ("sem cebola"). */
  note?: string | null;
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
  /** "mesa", "retirada", "entrega" or "balcao"; an order from before delivery existed has none. */
  order_type?: string | null;
  /** What the server added to the total for delivery (the total already has it). */
  delivery_fee?: number | string | null;
  delivery_zone?: string | null;
  delivery_address?: Record<string, unknown> | null;
  customer_phone?: string | null;
  /** Name of the courier who took the delivery, when someone did. */
  courier_name?: string | null;
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
  /** Groups the customer is asked about (size, extras); only what is on sale. */
  option_groups?: unknown[] | null;
  /** Ran out today: stays on the menu, marked, and cannot be ordered. */
  sold_out?: boolean;
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
  | "inicio"
  | "pedidos"
  | "assistente"
  | "produtos"
  | "custos"
  | "categorias"
  | "dashboard"
  | "usuarios"
  | "mesas"
  | "pagamento"
  | "marca"
  | "entrega"
  | "entregas"
  | "acerto"
  | "horario"
  | "plano"
  | "assinaturas"
  | "ajuda";

const ADMIN_VIEWS: string[] = [
  "inicio",
  "pedidos",
  "assistente",
  "produtos",
  "custos",
  "categorias",
  "dashboard",
  "usuarios",
  "mesas",
  "pagamento",
  "marca",
  "entrega",
  "entregas",
  "acerto",
  "horario",
  "plano",
  "assinaturas",
  "ajuda",
];

function isAdminView(value: string): value is AdminView {
  return ADMIN_VIEWS.includes(value);
}

type AdminPanelProps = {
  companyId: string;
  companySlug: string;
  /** For the messages the owner sends about his plan ("Quero pagar o plano do restaurante ..."). */
  companyName?: string;
  onBack: () => void;
};

export default function AdminPanel({
  companyId,
  companySlug,
  companyName,
  onBack,
}: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [currentUser, setCurrentUser] = useState(getUser());

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  /** Shown on the login screen when the login was over (not a mistake of the person). */
  const [sessionNotice, setSessionNotice] = useState("");
  const userEmailRef = useRef(currentUser?.email ?? "");
  userEmailRef.current = currentUser?.email ?? userEmailRef.current;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  /** The orders the screen already knew at the last check; null until the first one answers (opening makes no noise). */
  const knownOrdersRef = useRef<Set<string> | null>(null);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);

  // The first screen is "Hoje": what is happening now. The functions are in the menu of three lines.
  const [view, setView] = useState<AdminView>("inicio");

  const [products, setProducts] = useState<Product[]>([]);
  const [soldOutError, setSoldOutError] = useState("");
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const canUseGuide =
    currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  // The plan (R$ 190 per month): the warning strip, the Plano tab and, when it is blocked, the only screens that
  // work (Pedidos, to finish what is in progress, and Plano). Failing to read it never breaks the panel.
  const { plan } = useOwnerPlan(isAuthenticated && canUseGuide);
  const planBlocked = plan?.blocked === true;

  // "Preciso de ajuda": the owner's sheet, and (GD only) how many requests are waiting, shown on the Chamados tab.
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpCount, setHelpCount] = useState<number | null>(null);
  const isPlatformAdmin = plan?.platform_admin === true;

  useEffect(() => {
    if (!isPlatformAdmin) return;
    let alive = true;
    fetchPlatformHelp()
      .then((help) => {
        if (alive) setHelpCount(help.open_count);
      })
      .catch(() => undefined); // the count is a courtesy: the tab still opens and says what went wrong
    return () => {
      alive = false;
    };
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!viewAllowed(view, planBlocked)) setView("plano");
  }, [planBlocked, view]);

  // The moment it turns blocked, the owner lands on how to pay; Pedidos stays one tap away.
  useEffect(() => {
    if (planBlocked) setView("plano");
  }, [planBlocked]);

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
      setSessionNotice("");
      rememberCompany(companySlug);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Email ou senha inválidos"
      );
    }
  }

  // A login that is over goes straight to the login screen (any screen can notice it).
  useEffect(() => {
    function onExpired() {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setLoginPassword("");
      if (userEmailRef.current) setLoginEmail(userEmailRef.current);
      setSessionNotice("Seu acesso terminou. Entre de novo para continuar de onde parou.");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // While the panel is open the login renews itself, so nobody is logged out in the middle of a shift.
  // Checking right away also catches a login that ended while the phone was closed.
  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshSession();
    const timer = window.setInterval(() => void refreshSession(), SESSION_REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refreshSession();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // The courier has his own list of deliveries; the orders of the whole restaurant are not his.
    if (currentUser?.role === "COURIER") {
      setLoading(false);
      return;
    }

    async function pollOrders() {
      try {
        const data = await fetchAdminOrders(companyId);
        const currentOrders = Array.isArray(data) ? data : [];

        setOrders(currentOrders);

        // By order number, not by how many there are: the server sends only the latest 200, so the count stops
        // growing in a restaurant with a long history and the alert would never come.
        if (newOrders(knownOrdersRef.current, currentOrders).length > 0) {
          setShowNewOrderAlert(true);
          if (wantsNewOrderAlert(currentUser?.role)) alertDevice("order");
        }

        knownOrdersRef.current = knownOrderIds(currentOrders);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    pollOrders();

    const interval = setInterval(pollOrders, 5000);

    return () => clearInterval(interval);
  }, [companyId, currentUser?.role]);

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setView("inicio");
    setMenuOpen(false);
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

  /** One tap: the dish ran out (or is back). The screen changes at once and goes back if the server says no. */
  async function handleSoldOut(productId: string, soldOut: boolean) {
    setSoldOutError("");
    const mark = (value: boolean) =>
      setProducts((list) => list.map((item) => (item.id === productId ? { ...item, sold_out: value } : item)));
    mark(soldOut);
    try {
      await setSoldOut(productId, soldOut);
    } catch (err) {
      mark(!soldOut);
      setSoldOutError(err instanceof Error ? err.message : "Não consegui marcar o prato. Tente de novo.");
    }
  }

  /** "Voltou tudo": the start of a new day. */
  async function handleResetSoldOut() {
    setSoldOutError("");
    try {
      await resetSoldOut();
      setProducts((list) => list.map((item) => ({ ...item, sold_out: false })));
    } catch (err) {
      setSoldOutError(err instanceof Error ? err.message : "Não consegui desmarcar os pratos. Tente de novo.");
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

  const planBanner = bannerOf(plan, view);

  const role = currentUser?.role;
  const canSettleCash = role === "OWNER" || role === "MANAGER" || role === "CASHIER";

  // The side menu: the same screens and the same permissions the row of tabs had, grouped by subject.
  const navGroups = menuFor({
    role,
    allowed: (screen) => viewAllowed(screen, planBlocked),
    hasPlanTab: Boolean(plan && hasPlanTab(plan)),
    platformAdmin: Boolean(plan?.platform_admin),
    openOrders: openOrdersCount,
    helpCount,
  });

  const drawerActions: DrawerAction[] = [
    {
      id: "admin-btn-customer",
      label: "Ver o cardápio do cliente",
      icon: "store",
      onClick: () => {
        setMenuOpen(false);
        onBack();
      },
    },
    ...(canUseGuide
      ? ([
          {
            id: "admin-btn-guide",
            label: "Guia passo a passo",
            icon: "guide",
            onClick: () => {
              setMenuOpen(false);
              setGuideOpen(true);
            },
          },
          {
            id: "admin-btn-help",
            label: "Preciso de ajuda",
            icon: "help",
            onClick: () => {
              setMenuOpen(false);
              setHelpOpen(true);
            },
          },
        ] as DrawerAction[])
      : []),
    {
      id: "admin-btn-logout",
      label: "Sair",
      icon: "logout",
      quiet: true,
      onClick: handleLogout,
    },
  ];

  if (isAuthenticated && role === "COURIER") {
    return (
      <CourierHome
        companyId={companyId}
        name={currentUser?.name ?? ""}
        onLogout={handleLogout}
        onBack={onBack}
      />
    );
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

          {sessionNotice && !loginError && (
            <p className="msg-ok" role="status">
              {sessionNotice}
            </p>
          )}

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
          onMenu={setMenuOpen}
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

      <header className="nav-bar">
        <button
          id="admin-menu-button"
          type="button"
          className="nav-burger"
          aria-label="Abrir o menu"
          aria-expanded={menuOpen}
          aria-controls="admin-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <NavIcon name="menu" size={26} />
          <span>Menu</span>
        </button>

        <img className="nav-bar-logo" src="/logo-vem-comer.png" alt="Vem Comer" />

        {openOrdersCount > 0 && view !== "pedidos" && (
          <button type="button" className="nav-bar-orders" onClick={() => setView("pedidos")}>
            {openOrdersCount} {openOrdersCount === 1 ? "pedido" : "pedidos"}
          </button>
        )}
      </header>

      {menuOpen && (
        <AdminDrawer
          groups={navGroups}
          current={view}
          place={companyName || "Meu restaurante"}
          person={currentUser ? `${currentUser.name}, ${roleLabel(currentUser.role)}` : ""}
          actions={drawerActions}
          guided={guideOpen}
          onClose={() => setMenuOpen(false)}
          onSelect={(next) => {
            if (isAdminView(next)) setView(next);
            setMenuOpen(false);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {helpOpen && canUseGuide && (
        <HelpSheet screen={view} suggested={suggestedTopic(view)} onClose={() => setHelpOpen(false)} />
      )}

      {view !== "inicio" && (
        <div className="nav-who">
          <h1 className="adm-title">{viewTitle(view, currentUser?.role)}</h1>
          {currentUser && (
            <p className="adm-lead">
              {currentUser.name}, {roleLabel(currentUser.role)}
            </p>
          )}
        </div>
      )}

      <CallsBar companyId={companyId} />

      <PushToggle companyId={companyId} />

      {planBanner && (
        <div className={`adm-alert plan-banner plan-banner-${planBanner.kind}`} role="status">
          <span>{planBanner.text}</span>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setView("plano")}
          >
            Ver plano
          </button>
        </div>
      )}

      {view === "pedidos" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER" ||
          currentUser?.role === "KITCHEN") && <PauseStrip />}

      {view === "inicio" ? (
        <HomeView
          companyId={companyId}
          role={currentUser?.role}
          name={currentUser?.name ?? ""}
          place={companyName ?? ""}
          orders={orders}
          onGo={(target) => {
            if (isAdminView(target)) setView(target);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : view === "custos" &&
      (currentUser?.role === "OWNER" ||
        currentUser?.role === "MANAGER") ? (
        <CostsPanel companyId={companyId} />
      ) : view === "dashboard" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <BusinessPanel
          companyId={companyId}
          onGo={(target) => setView(target)}
        />
      ) : view === "dashboard" ? (
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
      ) : view === "entrega" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <DeliveryPanel />
      ) : view === "entregas" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <CourierPanel companyId={companyId} />
      ) : view === "acerto" && canSettleCash ? (
        <CashSettlement companyId={companyId} />
      ) : view === "horario" &&
        (currentUser?.role === "OWNER" ||
          currentUser?.role === "MANAGER") ? (
        <HoursPanel />
      ) : view === "plano" && plan && hasPlanTab(plan) ? (
        <SubscriptionPanel
          plan={plan}
          restaurantName={companyName ?? companySlug}
        />
      ) : view === "assinaturas" && plan?.platform_admin ? (
        <PlatformPanel />
      ) : view === "ajuda" && plan?.platform_admin ? (
        <>
          <HelpInbox onCount={setHelpCount} />
          <TitularInbox />
        </>
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
          onAskHelp={() => setHelpOpen(true)}
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
            <>
            {products.some((item) => item.sold_out) && (
              <div className="adm-alert" role="status">
                <span>
                  {products.filter((item) => item.sold_out).length === 1
                    ? "1 prato esgotado. O cliente vê, mas não consegue pedir."
                    : `${products.filter((item) => item.sold_out).length} pratos esgotados. O cliente vê, mas não consegue pedir.`}
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void handleResetSoldOut()}>
                  Voltou tudo
                </button>
              </div>
            )}
            {soldOutError && (
              <p className="msg-error" role="alert">
                {soldOutError}
              </p>
            )}
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
                    {product.sold_out && <span className="chip chip-busy">Esgotado</span>}
                    {menuName(product.menu_id) && (
                      <span className="chip">{menuName(product.menu_id)}</span>
                    )}
                    {groupsBadge(product.option_groups?.length) && (
                      <span className="chip chip-done">{groupsBadge(product.option_groups?.length)}</span>
                    )}
                  </div>

                  <div className="adm-row-side">
                    <span className="money">{formatMoney(product.price)}</span>
                    <button
                      type="button"
                      className={product.sold_out ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
                      aria-pressed={Boolean(product.sold_out)}
                      aria-label={product.sold_out ? `${product.name} voltou` : `${product.name} esgotou`}
                      onClick={() => void handleSoldOut(product.id, !product.sold_out)}
                    >
                      {product.sold_out ? "Voltou" : "Esgotou"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-expanded={optionsFor === product.id}
                      onClick={() => {
                        setPhotoFor(null);
                        setOptionsFor(optionsFor === product.id ? null : product.id);
                      }}
                    >
                      {optionsFor === product.id ? "Fechar" : "Opções"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-expanded={photoFor === product.id}
                      onClick={() => {
                        setOptionsFor(null);
                        setPhotoFor(photoFor === product.id ? null : product.id);
                      }}
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

                  {optionsFor === product.id && (
                    <div className="adm-row-photo-picker">
                      <ProductOptionsEditor
                        productId={product.id}
                        productName={product.name}
                        price={product.price}
                        onSaved={() => loadProducts()}
                      />
                    </div>
                  )}

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
            </>
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

                      <TablePoster
                        restaurant={companyName ?? companySlug}
                        tableNumber={table.number}
                        qr={tableQrs[table.id]}
                      />
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
            const changeFor = Number(order.payment_change);
            const showName =
              order.customer_name && order.customer_name !== "Cliente Balcão";
            const handling = handlingView(order);
            const next = nextAction(order.status, handling.kind);

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
                      <h2 className="comanda-where">{handling.title}</h2>

                      <p className="comanda-meta">
                        {showName && <span>{order.customer_name}</span>}
                        <span>{formatTime(order.created_at)}</span>
                        <span>{shortOrderCode(order.id)}</span>
                      </p>
                    </div>

                    <span className={`chip chip-${statusTone(order.status)}`}>
                      {statusLabel(order.status, handling.kind)}
                    </span>
                  </header>

                  {(handling.kind === "entrega" ||
                    handling.kind === "retirada") && (
                    <div
                      className={`comanda-ship comanda-ship-${handling.kind}`}
                    >
                      <p className="comanda-ship-main">
                        {handling.kind === "entrega"
                          ? handling.address ||
                            "Sem endereço: ligue para o cliente"
                          : "Cliente retira no balcão"}
                      </p>
                      {handling.region && (
                        <p className="comanda-ship-sub">{handling.region}</p>
                      )}
                      {handling.reference && (
                        <p className="comanda-ship-sub">
                          Referência: {handling.reference}
                        </p>
                      )}
                      {handling.phone && (
                        <p className="comanda-ship-sub">
                          Telefone:{" "}
                          <a href={handling.phoneHref}>{handling.phone}</a>
                        </p>
                      )}
                      {handling.courierLine && (
                        <p className="comanda-ship-sub">
                          {handling.courierLine}
                        </p>
                      )}
                    </div>
                  )}

                  <ul className="comanda-items">
                    {(order.items ?? []).map((item, index) => (
                      <li key={index} className="comanda-item">
                        <div className="leader-row">
                          <span>
                            <span className="comanda-qty">{item.quantity}x</span>{" "}
                            {item.name}
                          </span>
                          <span className="leader" />
                          <span className="money">{formatMoney(item.total)}</span>
                        </div>
                        <ItemDetails options={item.options} note={item.note} />
                      </li>
                    ))}
                  </ul>

                  {handling.feeCents > 0 && (
                    <>
                      <div className="leader-row comanda-fee">
                        <span>Itens</span>
                        <span className="leader" />
                        <span className="money">
                          {formatMoney(
                            itemsSubtotalCents(
                              order.total_price,
                              handling.feeCents,
                            ) / 100,
                          )}
                        </span>
                      </div>
                      <div className="leader-row comanda-fee">
                        <span>Taxa de entrega</span>
                        <span className="leader" />
                        <span className="money">
                          {formatMoney(handling.feeCents / 100)}
                        </span>
                      </div>
                    </>
                  )}

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

                  {next?.skip && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm btn-block"
                      onClick={() =>
                        handleStatusChange(order.id, next.skip!.next)
                      }
                    >
                      {next.skip.label}
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
