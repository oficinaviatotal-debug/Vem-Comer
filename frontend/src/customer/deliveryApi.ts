import { API_URL } from "../service/api";
import type { DeliveryInfo, Quote } from "./delivery";

/** What the restaurant offers: pickup, delivery and its regions. Anything that fails means "nothing new to offer". */
export async function fetchDeliveryInfo(companyId: string): Promise<DeliveryInfo | null> {
  try {
    const response = await fetch(`${API_URL}/companies/${companyId}/delivery`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object") return null;
    return {
      pickup: data.pickup !== false,
      delivery: data.delivery === true,
      paused: data.paused === true,
      zones: Array.isArray(data.zones) ? data.zones : [],
    };
  } catch {
    return null;
  }
}

/** "Delivery to this CEP?": the region, fee and minimum order, or why not. Throws when the answer did not come. */
export async function quoteDelivery(companyId: string, cep: string, signal?: AbortSignal): Promise<Quote> {
  const response = await fetch(`${API_URL}/companies/${companyId}/delivery/quote?cep=${encodeURIComponent(cep)}`, { signal });
  if (!response.ok) throw new Error("quote failed");
  const data = await response.json();
  if (data?.available === true) {
    return {
      available: true,
      zone: String(data.zone ?? ""),
      fee: data.fee ?? "0.00",
      min_order: data.min_order ?? "0.00",
      eta_minutes: typeof data.eta_minutes === "number" ? data.eta_minutes : null,
    };
  }
  return { available: false, reason: data?.reason, message: String(data?.message ?? "Não deu para conferir o CEP.") };
}
