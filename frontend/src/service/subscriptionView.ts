/**
 * The plan ("Plano") of the restaurant, as the owner and GD see it: what is on screen and what the buttons send.
 * Pure logic, no React: tests/ui/subscriptionView.test.mjs runs it in Node.
 *
 * The server decides everything (backend/subscription.py): the state, the due date, the block and the message in
 * Portuguese. Here there is only the formatting, the banner choice and the WhatsApp texts.
 */
import { parseMoneyCents } from "./deliveryDraft.ts";

export type PlanState = "none" | "awaiting_payment" | "active" | "past_due" | "canceled";

export type PlanPayment = {
  id: string;
  amount_cents: number;
  period_start: string;
  period_end: string;
  method: string;
  paid_at: string;
};

export type PaymentInfo = { pix_key: string; pix_receiver: string; contact_phone: string };

/** What the server says about one restaurant's plan (the same shape for the owner and in GD's list). */
export type PlanView = {
  state: PlanState;
  blocks: boolean;
  due_date: string | null;
  days_left: number | null;
  warning: "soon" | "today" | null;
  price_cents: number;
  message: string;
};

/** `GET /api/admin/subscription`: the owner's own plan. */
export type OwnerPlan = PlanView & {
  /** Billing is turned on at the server. Off: the state shows but nothing is blocked. */
  enforced: boolean;
  /** Blocked for real: billing on AND the state blocks. */
  blocked: boolean;
  payment_info: PaymentInfo;
  payments: PlanPayment[];
  /** This login is one of GD's: it also sees every restaurant. */
  platform_admin: boolean;
};

/** One line of `GET /api/platform/subscriptions`. */
export type PlatformCompany = {
  company_id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  created_at: string | null;
  subscription: PlanView;
};

export type PlatformList = {
  enforced: boolean;
  today: string;
  needs_attention: number;
  companies: PlatformCompany[];
};

export const reais = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** "2026-11-05" -> "05/11". */
export function shortDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return match ? `${match[3]}/${match[2]}` : "";
}

/** "2026-11-05" -> "05/11/2026". */
export function fullDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export type Tone = "ok" | "warn" | "bad" | "quiet";

/** The small label next to a plan: "Em dia", "Vence em 3 dias", "Venceu", "Falta o 1º pagamento". */
export function stateLabel(plan: PlanView): { text: string; tone: Tone } {
  switch (plan.state) {
    case "awaiting_payment":
      return { text: "Falta o 1º pagamento", tone: "bad" };
    case "past_due":
      return { text: `Venceu em ${shortDate(plan.due_date)}`, tone: "bad" };
    case "canceled":
      return { text: "Cancelado", tone: "bad" };
    case "none":
      return { text: "Sem cobrança", tone: "quiet" };
    default:
      if (plan.warning === "today") return { text: "Vence hoje", tone: "warn" };
      if (plan.warning === "soon") {
        return { text: `Vence em ${plan.days_left} ${plan.days_left === 1 ? "dia" : "dias"}`, tone: "warn" };
      }
      return { text: `Em dia até ${shortDate(plan.due_date)}`, tone: "ok" };
  }
}

export type Banner = { kind: "soon" | "today" | "blocked"; text: string };

/**
 * The strip on top of the panel: the warnings ("vence em 3 dias", "vence hoje") and, when the plan is blocked, the
 * reminder on the screens that still work (Pedidos). On the Plano screen itself there is no strip, it says it all.
 * A plan that is fine, or that has no billing, shows nothing at all.
 */
export function bannerOf(plan: OwnerPlan | null | undefined, view = ""): Banner | null {
  if (!plan) return null;
  if (plan.blocked) return view === "plano" ? null : { kind: "blocked", text: plan.message };
  if (plan.warning === "today") return { kind: "today", text: plan.message };
  if (plan.warning === "soon") return { kind: "soon", text: plan.message };
  return null;
}

/** The owner has a Plano tab when there is a plan to talk about (a restaurant with no plan has nothing to pay). */
export function hasPlanTab(plan: OwnerPlan | null | undefined): boolean {
  return Boolean(plan && plan.state !== "none");
}

/** While blocked, only these screens work: the orders in progress must be finished, and the way to pay. */
export const BLOCKED_VIEWS = ["pedidos", "plano"] as const;

export function viewAllowed(view: string, blocked: boolean): boolean {
  return !blocked || (BLOCKED_VIEWS as readonly string[]).includes(view);
}

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  outro: "Outro",
};

export const methodLabel = (method: string): string => METHOD_LABELS[method] ?? method;

export const PAYMENT_METHODS: { value: string; label: string }[] = Object.entries(METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** "5584999991234" or "(84) 99999-1234" -> "5584999991234"; null when it does not look like a Brazilian phone. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length === 12 || digits.length === 13 ? digits : null;
}

export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** What the owner sends to ask how to pay, or to say he paid. */
export function ownerMessage(kind: "pay" | "paid", restaurant: string, plan: PlanView): string {
  const name = restaurant.trim() || "meu restaurante";
  return kind === "paid"
    ? `Oi! Já paguei o plano do Vem Comer (${reais(plan.price_cents)}) do restaurante ${name}. Segue o comprovante.`
    : `Oi! Quero pagar o plano do Vem Comer (${reais(plan.price_cents)}) do restaurante ${name}. Como faço?`;
}

/** The message GD sends to a restaurant that is late or about to be: ready, friendly, with what to do. */
export function chargeMessage(ownerName: string | null, restaurant: string, plan: PlanView): string {
  const hello = ownerName && ownerName.trim() ? `Oi, ${ownerName.trim().split(/\s+/)[0]}!` : "Oi!";
  const price = reais(plan.price_cents);
  if (plan.state === "awaiting_payment") {
    return `${hello} Falta o pagamento do primeiro mês do Vem Comer (${price}) do restaurante ${restaurant} para começar a vender. Posso te mandar a chave Pix?`;
  }
  if (plan.state === "past_due") {
    return `${hello} O plano do Vem Comer do restaurante ${restaurant} venceu em ${shortDate(plan.due_date)} (${price}). Quando pagar, o restaurante volta na hora e nada foi apagado. Posso te mandar a chave Pix?`;
  }
  if (plan.warning === "today") {
    return `${hello} O plano do Vem Comer do restaurante ${restaurant} vence hoje (${price}). Pagando hoje, não para amanhã.`;
  }
  return `${hello} Passando para avisar que o plano do Vem Comer do restaurante ${restaurant} vence em ${shortDate(plan.due_date)} (${price}).`;
}

/** Does GD need to do something about this restaurant? */
export function needsAttention(plan: PlanView): boolean {
  return plan.state === "past_due" || plan.state === "awaiting_payment" || plan.warning === "today" || plan.warning === "soon";
}

/** Filter of GD's list: "todos", or only the ones that need attention. */
export function filterCompanies(list: PlatformCompany[], onlyAttention: boolean, search = ""): PlatformCompany[] {
  const needle = search.trim().toLocaleLowerCase("pt-BR");
  return list.filter((company) => {
    if (onlyAttention && !needsAttention(company.subscription)) return false;
    if (!needle) return true;
    return [company.name, company.slug, company.owner_name ?? "", company.owner_email ?? ""]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(needle);
  });
}

/** "1 pede atenção", "3 pedem atenção", "Tudo em dia". */
export function attentionSummary(count: number): string {
  if (count === 0) return "Tudo em dia";
  return count === 1 ? "1 restaurante pede atenção" : `${count} restaurantes pedem atenção`;
}

export type PaymentForm = { amount: string; method: string; reference: string };

export function blankPaymentForm(plan: PlanView): PaymentForm {
  return { amount: (plan.price_cents / 100).toFixed(2).replace(".", ","), method: "pix", reference: "" };
}

/** The error in words, or null when the form can be sent (the server checks again). */
export function paymentFormProblem(form: PaymentForm): string | null {
  const cents = parseMoneyCents(form.amount, 1_000_000);
  if (cents === null || cents <= 0) return "Escreva o valor recebido, assim: 190,00 (até R$ 10.000,00).";
  if (!PAYMENT_METHODS.some((m) => m.value === form.method)) return "Escolha como foi pago.";
  if (form.reference.length > 120) return "A anotação ficou grande. Use até 120 letras.";
  return null;
}

/** The body of `POST /api/platform/subscriptions/<id>/payments`. */
export function paymentBody(form: PaymentForm): { amount: string; method: string; reference: string } {
  return { amount: form.amount.trim(), method: form.method, reference: form.reference.replace(/\s+/g, " ").trim() };
}
