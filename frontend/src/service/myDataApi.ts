import { API_URL, HttpError, expireSession, getToken } from "./api";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Baixa a cópia dos dados da própria conta (LGPD art. 18, II e V). O servidor monta o arquivo só com os dados de
 * quem está logado; a senha nunca vai. Com `includeOrders` (só vale para o dono) vão também os pedidos.
 */
export async function downloadMyData(includeOrders: boolean): Promise<void> {
  const response = await fetch(`${API_URL}/me/dados${includeOrders ? "?pedidos=1" : ""}`, { headers: authHeaders() });
  if (!response.ok) {
    if (response.status === 401) expireSession();
    const err = await response.json().catch(() => ({}));
    throw new HttpError(err.error || "Não consegui montar a cópia agora. Tente de novo em instantes.", response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meus-dados-vem-comer.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
