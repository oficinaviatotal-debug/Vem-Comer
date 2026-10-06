import type { SignupBody } from "../signup/signupLogic";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/** An API answer that was not OK; lets screens tell "gone" (404/401) from "offline". */
export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Email ou senha inválidos");
  }
  const data = await response.json();
  setToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

/**
 * O cadastro de restaurantes pela internet está aberto?
 * "offline" = o pedido nem chegou (sem rede); "closed" = o servidor respondeu que não (ou é uma
 * versão antiga, sem essa rota).
 */
export async function fetchSignupStatus(): Promise<"open" | "closed" | "offline"> {
  try {
    const response = await fetch(`${API_URL}/signup/status`);
    if (!response.ok) return "closed";
    const data = await response.json().catch(() => ({}));
    return data.open === true ? "open" : "closed";
  } catch {
    return "offline";
  }
}

/** Cadastro que o servidor recusou. `status` 0 = o pedido não chegou; `field` = campo da tela com o problema. */
export class SignupFailure extends Error {
  status: number;
  field: string | null;

  constructor(message: string, status: number, field: string | null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

/** Cria o restaurante e o dono e já deixa o dono entrado (mesma sessão do login). */
export async function signupRestaurant(
  body: SignupBody
): Promise<{ id: string; name: string; slug: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SignupFailure("", 0, null);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SignupFailure(
      typeof data.error === "string" ? data.error : "",
      response.status,
      typeof data.field === "string" ? data.field : null
    );
  }

  setToken(data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.company;
}


export async function fetchCompany(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}`);
  if (!response.ok) throw new Error("Falha ao buscar estabelecimento");
  return response.json();
}

export async function fetchCompanyBySlug(slug: string) {
  const response = await fetch(`${API_URL}/companies/by-slug/${encodeURIComponent(slug)}`);

  if (!response.ok) {
    throw new Error("Estabelecimento não encontrado");
  }

  return response.json();
}

export async function fetchTable(companyId: string, tableId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/tables/${tableId}`);
  if (!response.ok) throw new Error("Falha ao buscar mesa");
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
  items: unknown[],
  paymentMethod: string,
  paymentChange: number,
  tableId?: string | null
) {
  const response = await fetch(`${API_URL}/companies/${companyId}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_name: customerName,
      items,
      payment_method: paymentMethod,
      payment_change: paymentChange,
      table_id: tableId || null
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new HttpError(err.error || "Falha ao criar pedido", response.status);
  }
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

export async function fetchOrder(orderId: string, trackingToken: string) {
  const response = await fetch(`${API_URL}/orders/${orderId}?tracking_token=${encodeURIComponent(trackingToken)}`);
  if (!response.ok) throw new HttpError("Falha ao buscar pedido", response.status);
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

export async function fetchTables(companyId: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/tables`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao buscar mesas");
  return response.json();
}

export async function fetchTableQr(
  companyId: string,
  tableId: string,
  tableUrl: string
): Promise<string> {
  const response = await fetch(
    `${API_URL}/companies/${companyId}/admin/tables/${tableId}/qr?url=${encodeURIComponent(tableUrl)}`,
    { headers: authHeaders() }
  );
  if (!response.ok) throw new Error("Falha ao gerar QR da mesa");
  const data = await response.json();
  return data.data_url as string;
}

export async function createTable(companyId: string, number: string) {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ number }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao criar mesa");
  }
  return response.json();
}

export async function deleteTable(tableId: string) {
  const response = await fetch(`${API_URL}/admin/tables/${tableId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao remover mesa");
  return response.json();
}

/** What a restaurant's Pix looks like to its owner. The key is always masked. */
export type PixSettings = {
  configured: boolean;
  key_type?: string;
  key_masked?: string;
  receiver_name?: string;
  city?: string;
};

/** A Pix "Copia e Cola" code with its QR image (a data: URL). */
export type PixCode = {
  payload: string;
  qr_data_url: string;
  receiver_name: string;
  amount: string;
};

/** Which payment options the restaurant offers. Anything that fails means "no Pix". */
export async function fetchPaymentOptions(companyId: string): Promise<{ pix: boolean }> {
  try {
    const response = await fetch(`${API_URL}/companies/${companyId}/payment-options`);
    if (!response.ok) return { pix: false };
    const data = await response.json();
    return { pix: data?.pix === true };
  } catch {
    return { pix: false };
  }
}

/** The Pix code for the customer's own order. The amount comes from the server. */
export async function fetchOrderPix(orderId: string, trackingToken: string): Promise<PixCode> {
  const response = await fetch(
    `${API_URL}/orders/${orderId}/pix?tracking_token=${encodeURIComponent(trackingToken)}`
  );
  if (!response.ok) throw new HttpError("Falha ao buscar o Pix", response.status);
  return response.json();
}

/** A person at the restaurant saw the money arrive. */
export async function confirmPayment(orderId: string) {
  const response = await fetch(`${API_URL}/orders/${orderId}/payment/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao confirmar o pagamento");
  }
  return response.json();
}

export async function fetchPixSettings(companyId: string): Promise<PixSettings> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/pix`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Falha ao buscar o Pix do restaurante");
  return response.json();
}

export type PixSettingsInput = {
  key_type: string;
  key: string;
  receiver_name: string;
  city: string;
  /** The owner's own password: changing where the money goes needs it again. */
  password: string;
};

export async function savePixSettings(companyId: string, input: PixSettingsInput): Promise<PixSettings> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/pix`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao salvar o Pix");
  }
  return response.json();
}

export async function removePixSettings(companyId: string, password: string): Promise<PixSettings> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/pix`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ remove: true, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao remover o Pix");
  }
  return response.json();
}

/** A R$ 1,00 code with the saved key, so the owner can test it with a real payment. */
export async function fetchPixPreview(companyId: string): Promise<PixCode> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/pix/preview`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao gerar o código de teste");
  }
  return response.json();
}

/* ---- Costs: ingredients, recipe card per dish and CMV (owner and manager only) ---- */

export type CostIngredient = {
  id: string;
  name: string;
  /** How the server keeps the quantity: "g", "ml" or "un". */
  unit: "g" | "ml" | "un";
  package_qty: number;
  package_price: number;
  unit_cost: number;
  /** In how many dishes' recipe cards it appears. */
  used_in: number;
};

export type CostRecipeLine = {
  ingredient_id: string;
  name: string;
  unit: "g" | "ml" | "un";
  quantity: number;
  cost: number;
};

export type CostStatusCode = "ok" | "atencao" | "alto" | "sem_custo" | "sem_preco";

export type CostProduct = {
  id: string;
  name: string;
  price: number;
  menu_id: string | null;
  portion: string | null;
  extra_cost: number;
  recipe: CostRecipeLine[];
  cost: number | null;
  cmv: number | null;
  margin: number | null;
  status: CostStatusCode;
  suggested_price: number | null;
};

export type CostView = {
  target: number;
  ingredients: CostIngredient[];
  products: CostProduct[];
  with_cost: number;
  period: {
    days: number;
    revenue: number | null;
    covered_revenue: number | null;
    cost: number | null;
    cmv: number | null;
    coverage: number | null;
  };
};

export type IngredientInput = { name: string; quantity: string; unit: string; price: string };

export type RecipeInput = {
  portion: string;
  extra_cost: string;
  items: Array<{ ingredient_id: string; quantity: string; unit: string }>;
};

export async function fetchCosts(companyId: string): Promise<CostView> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/costs`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir os custos.");
  return response.json();
}

export async function saveCostTarget(companyId: string, target: number): Promise<{ target: number }> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/costs/target`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ target }),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar a meta.");
  return response.json();
}

export async function saveIngredient(
  companyId: string,
  input: IngredientInput,
  ingredientId?: string,
): Promise<void> {
  const base = `${API_URL}/companies/${companyId}/admin/ingredients`;
  const response = await fetch(ingredientId ? `${base}/${ingredientId}` : base, {
    method: ingredientId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar o insumo.");
}

export async function deleteIngredient(companyId: string, ingredientId: string): Promise<void> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/ingredients/${ingredientId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await readError(response, "Não consegui remover o insumo.");
}

export async function saveRecipe(companyId: string, productId: string, input: RecipeInput): Promise<void> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/products/${productId}/recipe`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar a ficha do prato.");
}

/* ---- Menu assistant: ready-made menus and registering many dishes at once ---- */

export type MenuTemplateSummary = {
  id: string;
  name: string;
  icon: string;
  categories: Array<{ name: string; count: number }>;
};

export type MenuTemplate = {
  id: string;
  name: string;
  icon: string;
  categories: Array<{ name: string; items: Array<{ name: string }> }>;
};

export type MenuImportInput = {
  categories: Array<{ name: string; items: Array<{ name: string; price: string }> }>;
};

export type MenuImportResult = {
  menus_created: number;
  menus_reused: number;
  products_created: number;
  products_skipped: number;
};

async function readError(response: Response, fallback: string): Promise<HttpError> {
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

export async function fetchMenuTemplates(): Promise<MenuTemplateSummary[]> {
  const response = await fetch(`${API_URL}/admin/menu/templates`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Falha ao buscar os modelos de cardápio");
  return response.json();
}

export async function fetchMenuTemplate(templateId: string): Promise<MenuTemplate> {
  const response = await fetch(
    `${API_URL}/admin/menu/templates/${encodeURIComponent(templateId)}`,
    { headers: authHeaders() }
  );
  if (!response.ok) throw await readError(response, "Falha ao buscar o modelo de cardápio");
  return response.json();
}

export async function importMenu(
  companyId: string,
  input: MenuImportInput
): Promise<MenuImportResult> {
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/menu/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readError(response, "Falha ao cadastrar o cardápio");
  return response.json();
}

export type PhotoResult = {
  image_url: string | null;
  thumb_url: string | null;
  /** What the server improved, in words for the owner ("Mais luz", ...). */
  improvements: string[];
  /** Honest hints ("a foto ficou escura..."). */
  tips: string[];
};

/** Sends one dish photo (a JPEG made by photos/photoFiles). Replaces the old photo, if any. */
export async function uploadProductPhoto(productId: string, photo: Blob): Promise<PhotoResult> {
  const form = new FormData();
  form.append("photo", photo, "prato.jpg");
  // No Content-Type here: the browser writes it, with the boundary the server needs.
  const response = await fetch(`${API_URL}/admin/products/${productId}/photo`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!response.ok) throw await readError(response, "Não consegui enviar a foto.");
  return response.json();
}

/** What this server can do for the menu. Any failure means "not available": the screen then uses the ready-made lists. */
export async function fetchMenuCapabilities(): Promise<{ photo_menu: boolean }> {
  try {
    const response = await fetch(`${API_URL}/admin/menu/capabilities`, { headers: authHeaders() });
    if (!response.ok) return { photo_menu: false };
    const body = await response.json();
    return { photo_menu: body?.photo_menu === true };
  } catch {
    return { photo_menu: false };
  }
}

/**
 * Sends the photos of a menu (JPEGs made by photos/photoFiles) to be read.
 * Returns what the server answered, untouched: menuPhotoLogic.normalizeReading checks it.
 */
export async function readMenuPhotos(photos: Blob[], signal?: AbortSignal): Promise<unknown> {
  const form = new FormData();
  photos.forEach((photo, index) => form.append("photos", photo, `cardapio-${index + 1}.jpg`));
  // No Content-Type here: the browser writes it, with the boundary the server needs.
  const response = await fetch(`${API_URL}/admin/menu/parse-photo`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
    signal,
  });
  if (!response.ok) throw await readError(response, "Não consegui ler o cardápio.");
  return response.json();
}

export async function deleteProductPhoto(productId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/products/${productId}/photo`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw await readError(response, "Não consegui remover a foto.");
}

/**
 * Full address of a photo the server returned ("/media/..."). Anything that is not one of our
 * own photo paths gives an empty string, so a strange value can never end up in an <img>.
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path || !/^\/media\/[0-9a-f-]{36}\/[0-9a-f]{32}(-thumb)?\.webp$/.test(path)) return "";
  const origin = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : "";
  return origin + path;
}
