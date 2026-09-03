import { useEffect, useState } from "react";
import { fetchAdminOrders, updateOrderStatus, fetchProducts, fetchMenus, createProduct, deleteProduct } from "./api";

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

type AdminPanelProps = {
  companyId: string;
  onBack: () => void;
};

export default function AdminPanel({ companyId, onBack }: AdminPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [companyId]);

  async function handleStatusChange(orderId: string, newStatus: string) {
    try {
      await updateOrderStatus(orderId, newStatus);
      loadOrders();
    } catch (err) {
      console.error(err);
    }
  }

  const [view, setView] = useState<"pedidos" | "produtos">("pedidos");
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMenuId, setNewMenuId] = useState("");

  async function loadProducts() {
    try {
      const [productsData, menusData] = await Promise.all([fetchProducts(companyId), fetchMenus(companyId)]);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setMenus(Array.isArray(menusData) ? menusData : []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (view === "produtos") loadProducts();
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

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
        Carregando painel de pedidos...
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontWeight: "800" }}>Painel de Controle</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="button-action" onClick={() => setView("pedidos")} style={{ backgroundColor: view === "pedidos" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "pedidos" ? "#fff" : "var(--text-main)" }}>
            Pedidos
          </button>
          <button className="button-action" onClick={() => setView("produtos")} style={{ backgroundColor: view === "produtos" ? "var(--color-accent)" : "var(--bg-tertiary)", color: view === "produtos" ? "#fff" : "var(--text-main)" }}>
            Produtos
          </button>
          <button className="button-action" onClick={onBack} style={{ backgroundColor: "var(--text-main)", color: "#fff" }}>
            Voltar para o Cardápio
          </button>
        </div>
      </div>

      {view === "produtos" ? (
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
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhum pedido recebido ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {orders.map((order) => (
            <div key={order.id} style={{ padding: "1.5rem", borderRadius: "12px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.2rem" }}>{order.customer_name}</h3>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ID: {order.id}</span>
                </div>
                <span style={{ padding: "0.4rem 0.8rem", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", backgroundColor: "var(--bg-tertiary)", color: "var(--color-accent)" }}>
                  {order.status}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--border-color)", borderBottom: "1px dashed var(--border-color)", padding: "0.75rem 0", fontSize: "0.95rem" }}>
                <div>
                  Pagamento: <strong style={{ textTransform: "capitalize" }}>{order.payment_method}</strong>
                  {order.payment_method === "dinheiro" && order.payment_change > 0 && (
                    <span> (Troco para R$ {Number(order.payment_change).toFixed(2)})</span>
                  )}
                </div>
                <div>
                  Total: <strong>R$ {Number(order.total_price).toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button className="button-action" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }} onClick={() => handleStatusChange(order.id, "em preparo")}>
                  Aceitar / Em Preparo
                </button>
                <button className="button-action" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", backgroundColor: "#22c55e", color: "#fff" }} onClick={() => handleStatusChange(order.id, "concluido")}>
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