import { API_URL, HttpError, expireSession, getToken } from "./api";
import type { AnswerStatus, TitularList } from "./titularLogic";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(response: Response, fallback: string): Promise<HttpError> {
  if (response.status === 401) expireSession();
  const err = await response.json().catch(() => ({}));
  return new HttpError(err.error || fallback, response.status);
}

/** Pedidos do titular e denúncias abertos, do prazo mais curto ao mais longo. 403 para quem não é administrador. */
export async function fetchTitularList(): Promise<TitularList> {
  const response = await fetch(`${API_URL}/platform/solicitacoes`, { headers: authHeaders() });
  if (!response.ok) throw await readError(response, "Não consegui abrir a caixa de pedidos.");
  return response.json();
}

export async function answerTitular(
  id: string,
  body: { status: AnswerStatus; response: string; identity_verified: boolean },
): Promise<void> {
  const response = await fetch(`${API_URL}/platform/solicitacoes/${id}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Não consegui salvar a resposta.");
}

export type EraseScope = "pessoa" | "restaurante";

export type EraseResult = {
  executado: boolean;
  contagem: Record<string, number>;
  alvo: { role: string; name_hint: string; company_name: string } | null;
  aviso: string | null;
};

/** Simula (sem `confirmar`) ou executa (confirmar = "ANONIMIZAR") a eliminação, achando a pessoa pelo e-mail do pedido. */
export async function eraseByEmail(body: {
  email: string;
  escopo: EraseScope;
  request_id: string;
  confirmar?: string;
}): Promise<EraseResult> {
  const response = await fetch(`${API_URL}/platform/titular/anonimizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Não consegui agora; nada foi alterado.");
  return response.json();
}
