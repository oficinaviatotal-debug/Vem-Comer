import { API_URL, HttpError, expireSession, getToken } from "./api";
import type { ApiHours, Day } from "./hoursDraft";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  // a login that is over sends the panel back to the login screen, instead of an error that never goes away
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

/** The seven days of the restaurant of the login, whether orders are paused, and whether it is open right now. */
export async function fetchAdminHours(): Promise<ApiHours> {
  const response = await fetch(`${API_URL}/admin/hours`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir o horário.");
  return response.json();
}

/** Replaces the whole week. The server checks everything and says why when it refuses. */
export async function saveAdminHours(week: { week: Day[] }): Promise<ApiHours> {
  const response = await fetch(`${API_URL}/admin/hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(week),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar o horário.");
  return response.json();
}

/** No hours at all: the restaurant takes orders at any time (the pause still works). */
export async function clearAdminHours(): Promise<void> {
  const response = await fetch(`${API_URL}/admin/hours`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui tirar o horário.");
}

/** Pauses (or resumes) every new order, at once. Orders already made go on. */
export async function setOrdersPaused(paused: boolean): Promise<boolean> {
  const response = await fetch(`${API_URL}/admin/orders-pause`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ paused }),
  });
  if (!response.ok) throw await readError(response, "Não consegui mudar a pausa. Tente de novo.");
  const data = await response.json();
  return Boolean(data.orders_paused);
}

/** One dish ran out (true) or is back (false). */
export async function setSoldOut(productId: string, soldOut: boolean): Promise<boolean> {
  const response = await fetch(`${API_URL}/admin/products/${encodeURIComponent(productId)}/sold-out`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ sold_out: soldOut }),
  });
  if (!response.ok) throw await readError(response, "Não consegui marcar o prato. Tente de novo.");
  const data = await response.json();
  return Boolean(data.sold_out);
}

/** "Voltou tudo": takes the sold-out mark off every dish. Returns how many were changed. */
export async function resetSoldOut(): Promise<number> {
  const response = await fetch(`${API_URL}/admin/products/sold-out/reset`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await readError(response, "Não consegui desmarcar os pratos. Tente de novo.");
  const data = await response.json();
  return Number(data.changed) || 0;
}
