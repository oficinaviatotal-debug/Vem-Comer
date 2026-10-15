import { API_URL, HttpError, expireSession, getToken } from "./api";
import type { ApprovalsData, Decision } from "./approvalsLogic";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

/** The owner of the platform: what waits for his go-ahead and the registry of recent actions. 403 for anyone else. */
export async function fetchApprovals(): Promise<ApprovalsData> {
  const response = await fetch(`${API_URL}/platform/approvals`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir as aprovações.");
  const body = await response.json();
  return {
    pending: Array.isArray(body?.pending) ? body.pending : [],
    pending_count: typeof body?.pending_count === "number" ? body.pending_count : 0,
    recent: Array.isArray(body?.recent) ? body.recent : [],
  };
}

export type DecisionAnswer = { ok: boolean; already: boolean; status: string; status_label: string };

/** Approve, refuse or ask for a change. The server writes who decided from the login, never from what is sent here. */
export async function decideApproval(id: string, decision: Decision, note: string): Promise<DecisionAnswer> {
  const response = await fetch(`${API_URL}/platform/approvals/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ decision, note }),
  });
  if (!response.ok) throw await readError(response, "Não consegui registrar a decisão. Tente de novo.");
  const answer = await response.json();
  return {
    ok: answer?.ok === true,
    already: answer?.already === true,
    status: typeof answer?.status === "string" ? answer.status : "",
    status_label: typeof answer?.status_label === "string" ? answer.status_label : "",
  };
}
