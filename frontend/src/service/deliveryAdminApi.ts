import { API_URL, HttpError, expireSession, getToken } from "./api";
import type { ApiDelivery } from "./deliveryDraft";

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

/** The delivery settings of the restaurant of the login: pickup, pause and every region (also the turned-off ones). */
export async function fetchAdminDelivery(): Promise<ApiDelivery> {
  const response = await fetch(`${API_URL}/admin/delivery`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir a entrega.");
  return response.json();
}

/** Replaces the regions and the switches. The server checks everything and says why when it refuses. */
export async function saveAdminDelivery(payload: ApiDelivery): Promise<ApiDelivery> {
  const response = await fetch(`${API_URL}/admin/delivery`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar a entrega.");
  return response.json();
}
