import { API_URL, HttpError, expireSession, getToken } from "../service/api";
import type { BusinessView, PeriodKey } from "./businessLogic";

/** Reads the owner's numbers for the period. 401 sends the panel back to the login; other failures say why. */
export async function fetchBusiness(companyId: string, period: PeriodKey, signal?: AbortSignal): Promise<BusinessView> {
  const token = getToken();
  const response = await fetch(`${API_URL}/companies/${companyId}/admin/business?period=${period}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) expireSession();
    const err = await response.json().catch(() => ({}));
    throw new HttpError(err.error || "Não consegui abrir os números agora. Tente de novo em instantes.", response.status);
  }
  return response.json();
}
