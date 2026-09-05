import { useEffect, useState } from "react";
import { fetchAdminOrders, updateOrderStatus, fetchProducts, fetchMenus, createProduct, deleteProduct, createMenu, deleteMenu, login, logout, getToken, getUser, fetchUsers, createUser, deactivateUser, deleteUser, fetchTables, createTable, deleteTable } from "./api";

type Order = {
  id: string;
  customer_name: string;
  total_price: number;
  status: string;
  payment_method: string;
  payment_change: number;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  menu_id: string;
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

type AdminPanelProps = {
  companyId: string;
  onBack: () => void;
};

export default function AdminPanel({ companyId, onBack }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [currentUser, setCurrentUser] = useState(getUser());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastOrderCount, setLastOrderCount] = useState<number | null>(null);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState<boolean>(false);

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
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Email ou senha inválidos");
    }
  }

  useEffect(() => {
    async function pollOrders() {
      try {
        const data = await fetchAdminOrders(companyId);
        const currentOrders = Array.isArray(data) ? data : [];
        setOrders(currentOrders);

        if (lastOrderCount !== null && currentOrders.length > lastOrderCount) {
          setShowNewOrderAlert(true);
        }
        setLastOrderCount(currentOrders.length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    pollOrders();
    const interval = setInterval(pollOrders, 5000);
    return () => clearInterval(interval);
  }, [companyId, lastOrderCount]);

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setView("pedidos");
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    try {
      await updateOrderStatus(orderId, newStatus);
      const data = await fetchAdminOrders(companyId);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  const [view, setView] = useState<"pedidos" | "produtos" | "categorias" | "dashboard" | "usuarios" | "mesas">("pedidos");
  const [products, setProducts] = useState<Product[]>([]);
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
  const [newTableNumber, setNewTableNumber] = useState("");
  const [tableError, setTableError] = useState("");

  async function loadProducts() {
    try {
      const [productsData, menusData] = await Promise.all([fetchProducts(companyId), fetchMenus(companyId)]);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setMenus(Array.isArray(menusData) ? menusData : []);
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
    if (view === "produtos" || view === "categorias") loadProducts();
    if (view === "usuarios") loadUsers();
    if (view === "mesas") loadTables();
  }, [view, companyId]);

  async function handleCreateProduct() {
    if (!newName || !newPrice) return;
    try {
      await createProduct(companyId, newName, newDescription, Number(newPrice), newMenuId);
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
    if (!newUserName || !newUserEmail || !newUserPassword) return;
    try {
      await createUser(companyId, newUserName, newUserEmail, newUserPassword, newUserRole);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("WAITER");
      loadUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Erro ao criar usuário");
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
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateTable() {
    setTableError("");
    if (!newTableNumber) return;
    try {
      await createTable(companyId, newTableNumber);
      setNewTableNumber("");
      loadTables();
    } catch (err) {
      setTableError(err instanceof Error ? err.message : "Erro ao criar mesa");
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
    return `${window.location.origin}${window.location.pathname}?mesa=${tableId}`;
  }

  function tableQrCodeUrl(tableId: string) {
    return `https://qrserver.com{encodeURIComponent(tableOrderUrl(tableId))}`;
  }
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: "360px", margin: "4rem auto", padding: "2rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 style={{ margin: "0 0 0.5rem 0", textAlign: "center" }}>Painel de Controle</h2>
        <input placeholder="Email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
        <input placeholder="Senha" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
        {loginError && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{loginError}</p>}
        <button className="button-action" onClick={handleLogin} style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}>
          Entrar
        </button>
        <button className="button-action" onClick={onBack} style={{ backgroundColor: "transparent", color: "var(--text-muted)" }}>
          Voltar para o Cardápio
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
        Carregando painel de pedidos...
      </div>
    );
  }
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const ordersByStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const ordersByPayment = orders.reduce<Record<string, number>>((acc, o) => {
    const key = o.payment_method || "Não informado";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: "1rem" }}>
      {showNewOrderAlert && (
        <div style={{ padding: "1rem 1.5rem", backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px", color: "#b45309", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: "700" }}>🔔 Atenção: Um novo pedido de mesa acabou de chegar!</span>
          <button 
            type="button" 
            onClick={() => setShowNewOrderAlert(false)}
            style={{ background: "none", border: "none", color: "#b45309", fontWeight: "700", cursor: "pointer", fontSize: "1rem" }}
          >
            Dispensar
          </button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontWeight: "800" }}>Painel de Controle</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button id="admin-tab-pedidos" className="button-action" onClick={() => setView("pedidos")} style={{ backgroundColor: view === "pedidos" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "pedidos" ? "#fff" : "var(--text-main)" }}>
            Pedidos
          </button>
          <button id="admin-tab-produtos" className="button-action" onClick={() => setView("produtos")} style={{ backgroundColor: view === "produtos" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "produtos" ? "#fff" : "var(--text-main)" }}>
            Produtos
          </button>
          <button id="admin-tab-categorias" className="button-action" onClick={() => setView("categorias")} style={{ backgroundColor: view === "categorias" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "categorias" ? "#fff" : "var(--text-main)" }}>
            Categorias
          </button>
          <button id="admin-tab-mesas" className="button-action" onClick={() => setView("mesas")} style={{ backgroundColor: view === "mesas" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "mesas" ? "#fff" : "var(--text-main)" }}>
            Mesas
          </button>
          <button id="admin-tab-dashboard" className="button-action" onClick={() => setView("dashboard")} style={{ backgroundColor: view === "dashboard" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "dashboard" ? "#fff" : "var(--text-main)" }}>
            Dashboard
          </button>
          {currentUser?.role === "OWNER" && (
            <button id="admin-tab-usuarios" className="button-action" onClick={() => setView("usuarios")} style={{ backgroundColor: view === "usuarios" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "usuarios" ? "#fff" : "var(--text-main)" }}>
              Usuários
            </button>
          )}
          <button id="admin-btn-logout" className="button-action" onClick={handleLogout} style={{ backgroundColor: "#ef4444", color: "#fff" }}>
            Sair
          </button>
          <button className="button-action" onClick={onBack} style={{ backgroundColor: "var(--text-main)", color: "#fff" }}>
            Voltar para o Cardápio
          </button>
        </div>
      </div>
      {view === "dashboard" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "180px", padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Faturamento total</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "800" }}>R$ {totalRevenue.toFixed(2)}</div>
            </div>
            <div style={{ flex: 1, minWidth: "180px", padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Pedidos</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "800" }}>{totalOrders}</div>
            </div>
            <div style={{ flex: 1, minWidth: "180px", padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Ticket médio</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "800" }}>R$ {avgTicket.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "220px", padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: "0 0 1rem 0" }}>Pedidos por status</h3>
              {Object.entries(ordersByStatus).map(([status, count]) => (
                <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px dashed var(--border-color)" }}>
                  <span style={{ textTransform: "capitalize" }}>{status}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: "220px", padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: "0 0 1rem 0" }}>Pedidos por pagamento</h3>
              {Object.entries(ordersByPayment).map(([method, count]) => (
                <div key={method} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px dashed var(--border-color)" }}>
                  <span style={{ textTransform: "capitalize" }}>{method}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : view === "usuarios" && currentUser?.role === "OWNER" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Novo Usuário</h3>
            <input placeholder="Nome" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <input placeholder="Email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <input placeholder="Senha (mín. 8 caracteres)" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <option value="MANAGER">Gerente</option>
              <option value="WAITER">Garçom</option>
              <option value="CASHIER">Caixa</option>
              <option value="KITCHEN">Cozinha</option>
              <option value="COURIER">Entregador</option>
            </select>
            {userError && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{userError}</p>}
            <button className="button-action" onClick={handleCreateUser} style={{ backgroundColor: "#22c55e", color: "#fff" }}>
              Adicionar Usuário
            </button>
          </div>

          {users.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhum usuário cadastrado.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} style={{ padding: "1rem 1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ opacity: user.active ? 1 : 0.5 }}>
                  <strong>{user.name}</strong> — {user.email}
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{user.role}{!user.active && " · Desativado"}</div>
                </div>
                {user.active && user.role !== "OWNER" && (
                  <button className="button-action" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }} onClick={() => handleDeactivateUser(user.id)}>
                    Desativar
                  </button>
                )}
                {!user.active && (
                  <button className="button-action" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "#fff" }} onClick={() => handleDeleteUser(user.id)}>
                    Apagar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : view === "produtos" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Novo Produto</h3>
            <input placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <input placeholder="Descrição" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <input placeholder="Preço" type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <select value={newMenuId} onChange={(e) => setNewMenuId(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <option value="">Selecione a categoria</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>{menu.name}</option>
              ))}
            </select>
            <button className="button-action" onClick={handleCreateProduct} style={{ backgroundColor: "#22c55e", color: "#fff" }}>
              Adicionar Produto
            </button>
          </div>

          {products.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhum produto cadastrado.</p>
          ) : (
            products.map((product) => (
              <div key={product.id} style={{ padding: "1rem 1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{product.name}</strong> — R$ {Number(product.price).toFixed(2)}
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{product.description}</div>
                </div>
                <button className="button-action" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "#fff" }} onClick={() => handleDeleteProduct(product.id)}>
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      ) : view === "categorias" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Nova Categoria</h3>
            <input placeholder="Nome da categoria" value={newMenuName} onChange={(e) => setNewMenuName(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            <button className="button-action" onClick={handleCreateMenu} style={{ backgroundColor: "#22c55e", color: "#fff" }}>
              Adicionar Categoria
            </button>
          </div>

          {menus.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhuma categoria cadastrada.</p>
          ) : (
            menus.map((menu) => (
              <div key={menu.id} style={{ padding: "1rem 1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{menu.name}</strong>
                <button
                  className="button-action"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "#fff" }}
                  onClick={() => handleDeleteMenu(menu.id)}
                >
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      ) : view === "mesas" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Nova Mesa</h3>
            <input placeholder="Número da mesa (ex: 1)" type="number" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--border-color)" }} />
            {tableError && <p style={{ color: "#ef4444", fontSize: "0.85rem", margin: 0 }}>{tableError}</p>}
            <button className="button-action" onClick={handleCreateTable} style={{ backgroundColor: "#22c55e", color: "#fff" }}>
              Adicionar Mesa
            </button>
          </div>

          {tables.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhuma mesa cadastrada.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              {tables.map((table) => (
                <div
                  key={table.id}
                  style={{ width: "200px", padding: "1rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
                >
                  Mesa {table.number}
                  <span style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem", borderRadius: "999px", backgroundColor: table.status === "livre" ? "#22c55e" : "#ef4444", color: "#fff" }}>
                    {table.status === "livre" ? "Livre" : "Ocupada"}
                  </span>
                  <img
                    src={tableQrCodeUrl(table.id)}
                    alt={`QR code da Mesa ${table.number}`}
                    width={140}
                    height={140}
                    style={{ borderRadius: "8px" }}
                  />
                  <button
                    className="button-action"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", width: "100%", backgroundColor: "#ef4444", color: "#fff" }}
                    onClick={() => handleDeleteTable(table.id)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhum pedido recebido ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.2rem" }}>{order.customer_name}</h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ID: {order.id}</span>
                <span style={{ padding: "0.4rem 0.8rem", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", backgroundColor: "var(--bg-tertiary)", color: "var(--color-accent)" }}>
                  {order.status}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border-color)", borderBottom: "1px dashed var(--border-color)", padding: "0.75rem 0", fontSize: "0.95rem" }}>
                <span>
                  Pagamento: <strong style={{ textTransform: "capitalize" }}>{order.payment_method}</strong>
                  {order.payment_method === "dinheiro" && order.payment_change > 0 && (
                    <span>(Troco para R$ {Number(order.payment_change).toFixed(2)})</span>
                  )}
                </span>
                <strong>Total: R$ {Number(order.total_price).toFixed(2)}</strong>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  className="button-action"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                  onClick={() => handleStatusChange(order.id, "em preparo")}
                >
                  Aceitar / Em Preparo
                </button>
                <button
                  className="button-action"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", backgroundColor: "#22c55e", color: "#fff" }}
                  onClick={() => handleStatusChange(order.id, "concluido")}
                >
                  Pronto para Entrega
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
