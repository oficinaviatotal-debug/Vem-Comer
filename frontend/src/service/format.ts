/** Brazilian formatting helpers shared by the customer app and the owner panel. */

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 49.9 -> "R$ 49,90". Anything that is not a finite number shows as R$ 0,00. */
export function formatMoney(value: number | string | null | undefined): string {
  const number = Number(value);
  return money.format(Number.isFinite(number) ? number : 0);
}

/** "Mon, 05 Oct 2026 15:35:44 GMT" or an ISO date -> "12:35" in the device's time zone. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Short code a person can read out loud: "dddddddd-0000-..." -> "#DDDD". */
export function shortOrderCode(id: string | null | undefined): string {
  const clean = String(id ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return clean ? `#${clean.slice(0, 4).toUpperCase()}` : "";
}

const ROLES: Record<string, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  WAITER: "Garçom",
  CASHIER: "Caixa",
  KITCHEN: "Cozinha",
  COURIER: "Entregador",
};

export function roleLabel(role: string | null | undefined): string {
  return ROLES[String(role ?? "")] ?? String(role ?? "");
}

const PAYMENTS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

export function paymentLabel(method: string | null | undefined): string {
  const key = String(method ?? "").toLowerCase();
  return PAYMENTS[key] ?? (key ? key : "Não informado");
}
