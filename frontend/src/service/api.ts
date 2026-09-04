const currentHost = window.location.hostname;
const apiHost = currentHost.replace("-5174.", "-5000.");
export const API_URL = `https://${apiHost}/api`;

const TOKEN_KEY = "vc_token";
const USER_KEY = "vc_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): { id: string; name: string; email: string; role: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Email ou senha inválidos");
  const data = await response.json();
  setToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}


export async function fetchCompany(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}`);
  if (!response.ok) throw new Error("Falha ao buscar estabelecimento");
  return response.json();
}

export async function fetchProducts(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/products`);
  if (!response.ok) throw new Error("Falha ao buscar produtos");
  return response.json();
}

export async function fetchMenus(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/menus`);
  if (!response.ok) throw new Error("Falha ao buscar categorias");
  return response.json();
}

export async function createOrder(
  companyId: string,
  customerName: string,
  totalPrice: number,
  items: unknown[],
  paymentMethod: string,
  paymentChange: number
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_name: customerName,
      total_price: totalPrice,
      items,
      payment_method: paymentMethod,
      payment_change: paymentChange
    }),
  });
  if (!response.ok) throw new Error("Falha ao criar pedido");
  return response.json();
}

export async function createFeedback(
  companyId: string,
  food: string,
  service: string,
  delivery: string,
  comment: string
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/feedbacks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ food, service, delivery, comment }),
  });
  if (!response.ok) throw new Error("Falha ao enviar feedback");
  return response.json();
}

export async function fetchOrder(orderId: string) {
  const response = await fetch(`${API_URL}/orders/${orderId}`);
  if (!response.ok) throw new Error("Falha ao buscar pedido");
  return response.json();
}

export async function fetchAdminOrders(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/orders`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao buscar pedidos do paines");
  return response.json();
}

export async function updateOrderStatus(orderId: string, status: string) {
  const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Falha ao atualizar status do pedido");
  return response.json();
}

export async function createProduct(
  companyId: string,
  name: string,
  description: string,
  price: number,
  menuId: string
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, description, price, menu_id: menuId }),
  });
  if (!response.ok) throw new Error("Falha ao criar produto");
  return response.json();
}

export async function deleteProduct(productId: string) {
  const response = await fetch(`${API_URL}/admin/products/${productId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao remover produto");
  return response.json();
}

export async function createMenu(companyId: string, name: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/menus`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Falha ao criar categoria");
  return response.json();
}

export async function deleteMenu(menuId: string) {
  const response = await fetch(`${API_URL}/admin/menus/${menuId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao remover categoria");
  return response.json();
}

export async function fetchUsers(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/users`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao buscar usuários");
  return response.json();
}

export async function createUser(companyId: string, name: string, email: string, password: string, role: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, email, password, role }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao criar usuário");
  }
  return response.json();
}

export async function deactivateUser(userId: string) {
  const response = await fetch(`${API_URL}/admin/users/${userId}/deactivate`, {
    method: "PUT",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao desativar usuário");
  return response.json();
}

export async function deleteUser(userId: string) {
  const response = await fetch(`${API_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao apagar usuário");
  }
  return response.json();
}