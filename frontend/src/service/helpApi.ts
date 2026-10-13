import { API_URL, HttpError, expireSession, getToken } from "./api";
import { safeWhatsappUrl, type PlatformHelp } from "./helpLogic";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

export type HelpAnswer = { ok: boolean; already: boolean; message: string; whatsapp_url: string };

/** The owner asks for help. Asking again while a request is open updates it (the server says so in `already`). */
export async function askForHelp(body: { topic: string; message: string; screen: string; phone?: string }): Promise<HelpAnswer> {
  const response = await fetch(`${API_URL}/admin/help`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Não consegui enviar o pedido. Tente de novo ou fale com o suporte pelo WhatsApp.");
  const answer = await response.json();
  return {
    ok: answer?.ok === true,
    already: answer?.already === true,
    message: typeof answer?.message === "string" ? answer.message : "Recebi o seu pedido de ajuda.",
    whatsapp_url: safeWhatsappUrl(answer?.whatsapp_url),
  };
}

/** The administrator's inbox: open requests and the follow-up of the signups. 403 for anyone else. */
export async function fetchPlatformHelp(): Promise<PlatformHelp> {
  const response = await fetch(`${API_URL}/platform/help`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir a caixa de ajuda.");
  return response.json();
}

export async function resolveHelp(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/platform/help/${id}/resolve`, { method: "POST", headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui marcar como resolvido.");
}
