import { API_URL, HttpError, expireSession, getToken } from "../service/api";
import {
  OFFLINE_DELIVER,
  deliverResult,
  normalizeCash,
  normalizeOrders,
  type CashView,
  type CourierOrder,
  type DeliverResult,
} from "./courierLogic";

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

const base = (companyId: string) => `${API_URL}/companies/${encodeURIComponent(companyId)}`;

/** The deliveries ready to take, the ones he carries, and the ones delivered (with cash still open or in the last 12 h). */
export async function fetchCourierOrders(companyId: string, signal?: AbortSignal): Promise<CourierOrder[]> {
  const response = await fetch(`${base(companyId)}/courier/orders`, { headers: authHeaders(), signal });
  if (!response.ok) throw await readError(response, "Não consegui abrir as entregas.");
  return normalizeOrders(await response.json());
}

/** "Peguei". Tapping twice is fine: the second answer says `already`. */
export async function pickUpOrder(companyId: string, orderId: string): Promise<{ already: boolean }> {
  const response = await fetch(`${base(companyId)}/courier/orders/${encodeURIComponent(orderId)}/pickup`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw await readError(response, "Não consegui pegar o pedido. Tente de novo.");
  const data = await response.json().catch(() => ({}));
  return { already: data?.already === true };
}

/**
 * "Entreguei". A wrong code, a lock and a plain refusal come back as results (the screen shows them next to the
 * field); only a lost login throws. With no signal nothing is known, so the answer is "offline" and repeating is safe:
 * the server answers `already` for an order it already closed.
 */
export async function deliverOrder(companyId: string, orderId: string, code: string): Promise<DeliverResult> {
  let response: Response;
  try {
    response = await fetch(`${base(companyId)}/courier/orders/${encodeURIComponent(orderId)}/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { kind: "offline", message: OFFLINE_DELIVER };
  }
  if (response.status === 401) {
    expireSession();
    return { kind: "error", message: "Seu acesso terminou. Entre de novo." };
  }
  const body = await response.json().catch(() => ({}));
  return deliverResult(response.status, body);
}

/** The cash each courier received and has not handed in (cashier, manager, owner). */
export async function fetchCourierCash(companyId: string): Promise<CashView> {
  const response = await fetch(`${base(companyId)}/admin/courier-cash`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir o acerto dos motoqueiros.");
  return normalizeCash(await response.json());
}

/** The cashier counted the cash of these deliveries. */
export async function settleCourierCash(
  companyId: string,
  courierId: string,
  orderIds: string[]
): Promise<{ count: number; total: string }> {
  const response = await fetch(`${base(companyId)}/admin/courier-cash/${encodeURIComponent(courierId)}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ order_ids: orderIds }),
  });
  if (!response.ok) throw await readError(response, "Não consegui fazer o acerto. Tente de novo.");
  const data = await response.json();
  return { count: Number(data?.count) || 0, total: String(data?.total ?? "0.00") };
}
