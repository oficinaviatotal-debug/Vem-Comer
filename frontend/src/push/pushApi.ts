import { API_URL, HttpError, expireSession, getToken } from "../service/api";
import { normalizeTestResult, type SubscriptionBody, type TestResult } from "./pushLogic";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  // um login que acabou manda o painel de volta para a tela de entrada, em vez de um erro que nunca some
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

const base = (companyId: string) => `${API_URL}/companies/${encodeURIComponent(companyId)}/push`;

export type PushConfig = { enabled: boolean; key: string };

/** O servidor liga o aviso? E qual é a chave pública para o celular se inscrever. */
export async function fetchPushConfig(): Promise<PushConfig> {
  const response = await fetch(`${API_URL}/push/config`);
  if (!response.ok) throw await readError(response, "Não consegui abrir o aviso no celular.");
  const data = await response.json().catch(() => ({}));
  return { enabled: data?.enabled === true && typeof data?.key === "string", key: String(data?.key ?? "") };
}

export async function sendSubscription(companyId: string, body: SubscriptionBody): Promise<void> {
  const response = await fetch(`${base(companyId)}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Não consegui ativar o aviso neste celular.");
}

export async function removeSubscription(companyId: string, endpoint: string): Promise<void> {
  const response = await fetch(`${base(companyId)}/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) throw await readError(response, "Não consegui desligar o aviso neste celular.");
}

export async function sendTestPush(companyId: string): Promise<TestResult> {
  const response = await fetch(`${base(companyId)}/test`, { method: "POST", headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui enviar o aviso de teste.");
  return normalizeTestResult(await response.json().catch(() => ({})));
}
