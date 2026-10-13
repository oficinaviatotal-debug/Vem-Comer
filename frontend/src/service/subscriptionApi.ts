import { API_URL, HttpError, expireSession, getToken } from "./api";
import type { OwnerPlan, PlatformList } from "./subscriptionView";

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

/** The plan of the restaurant of the login: state, due date, block, how to pay and the last payments. */
export async function fetchOwnerPlan(): Promise<OwnerPlan> {
  const response = await fetch(`${API_URL}/admin/subscription`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir o plano.");
  return response.json();
}

/** GD only: every restaurant with its plan, the late ones first. The server answers 403 to anyone else. */
export async function fetchPlatformList(): Promise<PlatformList> {
  const response = await fetch(`${API_URL}/platform/subscriptions`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir a lista de restaurantes.");
  return response.json();
}

/** GD only: one month received. The server moves the due date and says why when it refuses (for example, twice in a row). */
export async function recordPlatformPayment(
  companyId: string,
  body: { amount: string; method: string; reference: string }
): Promise<{ payment_id: string; period_end: string; amount_cents: number }> {
  const response = await fetch(`${API_URL}/platform/subscriptions/${companyId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Não consegui registrar o pagamento.");
  return response.json();
}
