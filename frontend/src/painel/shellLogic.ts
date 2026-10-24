/**
 * A casca do painel, versão nova: as regras que ligam as telas novas umas às outras. Quem decide o que cada pessoa
 * pode abrir, qual tela é nova e qual ainda é a antiga, o que aparece num aviso no alto e quando o painel precisa
 * perguntar ao servidor por conta própria. Só conta, sem React nem rede: tests/novo/shellLogic.test.mjs roda isto no Node.
 *
 * Nenhuma regra de permissão nasceu aqui. **O menu é a única fonte** do que uma pessoa pode abrir: a lista de telas
 * permitidas sai de `nav/navLogic.menuFor` (as regras de sempre das abas) com o bloqueio do plano de `service/subscriptionView`.
 * Quem tenta abrir uma tela que o menu não mostra volta ao "Hoje" (ou, com o restaurante bloqueado por falta de pagamento, ao Plano).
 *
 * A chave que liga tudo isto é desligada por padrão: sem `?novo=1` no endereço (nem o aparelho marcado antes), o painel que
 * abre é o antigo, igual a hoje.
 */
import { canOpenTable, isManager, menuFor } from "../nav/navLogic.ts";
import { barTitle } from "../mesa/callsLogic.ts";
import { wantsNewOrderAlert } from "../service/newOrders.ts";
import { viewAllowed, type Banner } from "../service/subscriptionView.ts";

// ---------------------------------------------------------------- a chave

/** O nome do parâmetro do endereço e a marca que o aparelho guarda. */
export const FLAG_PARAM = "novo";
export const FLAG_KEY = "vem_painel_novo";

export type FlagReading = {
  /** O painel novo deve abrir? */
  on: boolean;
  /** O que gravar no aparelho: "1" liga, "0" desliga, `null` não mexe. */
  remember: "1" | "0" | null;
};

/**
 * Lê a chave. `?novo=1` liga (e o aparelho lembra), `?novo=0` desliga (e o aparelho esquece). Sem parâmetro vale o que o
 * aparelho lembrou e, depois, o que o servidor de build marcou (`VITE_PAINEL_NOVO=1`). Sem nada disso: desligado.
 */
export function readFlag(search: string, remembered: string | null | undefined, built: string | null | undefined = ""): FlagReading {
  const asked = new URLSearchParams(search).get(FLAG_PARAM);
  if (asked === "1") return { on: true, remember: "1" };
  if (asked === "0") return { on: false, remember: "0" };
  if (remembered === "1") return { on: true, remember: null };
  if (remembered === "0") return { on: false, remember: null };
  return { on: String(built ?? "").trim() === "1", remember: null };
}

// ---------------------------------------------------------------- quem pode abrir o quê

export type ShellContext = {
  role: string | null | undefined;
  /** O restaurante está bloqueado por falta de pagamento (só Pedidos, Entregas, Acerto e Plano abrem). */
  planBlocked: boolean;
  /** O restaurante tem um plano de que falar. */
  hasPlanTab: boolean;
  /** É o dono do sistema (vê Aprovações, Assinaturas e Chamados). */
  platformAdmin: boolean;
};

/** As telas que esta pessoa pode abrir agora, na ordem do menu. */
export function allowedViews(context: ShellContext): string[] {
  return menuFor({
    role: context.role,
    allowed: (screen) => viewAllowed(screen, context.planBlocked),
    hasPlanTab: context.hasPlanTab,
    platformAdmin: context.platformAdmin,
    openOrders: 0,
    helpCount: null,
  }).flatMap((group) => group.items.map((item) => item.view));
}

/** A primeira tela de quem entra: o Hoje; ou o Plano, quando o restaurante está bloqueado. */
export function firstView(context: Pick<ShellContext, "planBlocked">): string {
  return context.planBlocked ? "plano" : "inicio";
}

/**
 * A tela que de fato abre quando alguém pede `wanted`: a própria, se o menu dela a mostra; senão a primeira tela.
 * Bloqueado por falta de pagamento, a saída é o Plano (e, sem Plano, os Pedidos, que sempre abrem).
 */
export function shownView(wanted: string, context: ShellContext): string {
  const allowed = allowedViews(context);
  if (allowed.includes(wanted)) return wanted;
  if (context.planBlocked) return allowed.includes("plano") ? "plano" : "pedidos";
  return "inicio";
}

// ---------------------------------------------------------------- qual tela desenha cada nome

/** As telas que já são do visual novo. */
export type NewScreen = "today" | "orders" | "kitchen" | "desk" | "deliveries" | "settle" | "setup" | "dishes" | "categories" | "logo" | "hours" | "share";

/** As telas que ainda são as antigas, dentro da moldura nova (cada uma sai quando chegar a sua rodada). */
export type OldScreen =
  | "tables"
  | "summary"
  | "business"
  | "costs"
  | "pix"
  | "zones"
  | "team"
  | "plan"
  | "approvals"
  | "subscriptions"
  | "help";

export type ScreenChoice = { kind: "new"; id: NewScreen } | { kind: "old"; id: OldScreen };

const NEW_BY_VIEW: Record<string, NewScreen> = {
  inicio: "today",
  pedidos: "orders",
  mesa: "desk",
  entregas: "deliveries",
  acerto: "settle",
  assistente: "setup",
  produtos: "dishes",
  categorias: "categories",
  marca: "logo",
  horario: "hours",
  meulink: "share",
};

const OLD_BY_VIEW: Record<string, OldScreen> = {
  custos: "costs",
  pagamento: "pix",
  entrega: "zones",
  usuarios: "team",
  plano: "plan",
  aprovacoes: "approvals",
  assinaturas: "subscriptions",
  ajuda: "help",
};

/**
 * Qual tela desenha este nome. Três nomes dependem de quem olha:
 * - Pedidos: a cozinha tem a fila dela; todos os outros, a tela de pedidos e caixa;
 * - Mesas: o dono e o gerente cadastram as mesas e imprimem o QR (tela antiga, por enquanto); a equipe do salão vê os
 *   chamados e as mesas (a tela nova de Abrir mesa);
 * - Números: o dono e o gerente veem as vendas e o lucro; os outros, o resumo.
 */
export function screenOf(view: string, role: string | null | undefined): ScreenChoice {
  if (view === "pedidos") return { kind: "new", id: String(role ?? "").toUpperCase() === "KITCHEN" ? "kitchen" : "orders" };
  if (view === "mesas") return isManager(role) ? { kind: "old", id: "tables" } : { kind: "new", id: "desk" };
  if (view === "dashboard") return { kind: "old", id: isManager(role) ? "business" : "summary" };
  const fresh = NEW_BY_VIEW[view];
  if (fresh) return { kind: "new", id: fresh };
  const old = OLD_BY_VIEW[view];
  if (old) return { kind: "old", id: old };
  return { kind: "new", id: "today" };
}

/** Todo nome de tela que o painel entende (os mesmos do menu). */
export function knownViews(): string[] {
  return ["dashboard", "mesas", "pedidos", ...Object.keys(NEW_BY_VIEW), ...Object.keys(OLD_BY_VIEW)].filter(
    (view, index, all) => all.indexOf(view) === index,
  );
}

// ---------------------------------------------------------------- a primeira vez

/**
 * Para onde vai o dono que entra pela primeira vez neste aparelho: com o cardápio vazio, direto ao Assistente (voz e
 * foto, sem digitar); com cardápio, ao Hoje, onde a lista "O que falta" guia o resto. `products` é `null` enquanto o
 * servidor não respondeu (ou falhou): nunca se conclui "vazio" de uma busca que não voltou.
 */
export function ownerStartView(input: { role: string | null | undefined; seen: boolean; planBlocked: boolean; products: number | null }): string {
  if (input.planBlocked) return "plano";
  if (String(input.role ?? "").toUpperCase() !== "OWNER" || input.seen) return "inicio";
  return input.products === 0 ? "assistente" : "inicio";
}

// ---------------------------------------------------------------- o que o painel pergunta por conta própria

/** De quanto em quanto tempo o painel olha os pedidos quando a tela da vez não olha sozinha. */
export const ORDERS_WATCH_MS = 5000;
/** E as mesas que chamam. */
export const CALLS_WATCH_MS = 6000;

/** As telas que já buscam os pedidos sozinhas (e apitam o pedido novo). */
const WATCH_THEIR_ORDERS: NewScreen[] = ["today", "orders", "kitchen"];

/**
 * O painel olha os pedidos para avisar "Chegou um novo pedido" e para contar os em aberto no menu. Não olha quando a
 * tela da vez já faz isso (para não perguntar duas vezes ao servidor) nem para quem não recebe esse aviso (o entregador).
 */
export function watchOrders(input: { view: string; role: string | null | undefined; menuOpen: boolean }): boolean {
  if (!wantsNewOrderAlert(input.role)) return false;
  const screen = screenOf(input.view, input.role);
  const itself = screen.kind === "new" && WATCH_THEIR_ORDERS.includes(screen.id);
  // O menu aberto mostra o número de pedidos em aberto: ali o painel precisa do número mesmo que a tela já busque.
  return !itself || input.menuOpen;
}

/** O painel olha as mesas que chamam para quem vai a uma mesa; a tela de Abrir mesa já faz isso e apita sozinha. */
export function watchCalls(input: { view: string; role: string | null | undefined }): boolean {
  if (!canOpenTable(input.role)) return false;
  const screen = screenOf(input.view, input.role);
  return !(screen.kind === "new" && screen.id === "desk");
}

// ---------------------------------------------------------------- os avisos no alto

export type NoticeTone = "info" | "warn" | "urgent";

export type Notice = {
  id: "plan" | "order" | "calls";
  tone: NoticeTone;
  text: string;
  /** O botão do aviso e a tela para onde ele leva. */
  action: string;
  view: string;
};

export type NoticeInput = {
  view: string;
  role: string | null | undefined;
  /** O aviso do plano que o servidor escreveu (vencendo, vence hoje, bloqueado), já escolhido por `bannerOf`. */
  plan: Banner | null;
  /** Chegou pedido novo desde que a pessoa olhou. */
  newOrder: boolean;
  /** Quantas mesas estão chamando. */
  calls: number;
};

/**
 * Os avisos que acompanham a pessoa em qualquer tela, do mais grave ao menos: o plano, o pedido novo e as mesas.
 * Cada um diz o que houve e leva, num toque, à tela onde se resolve. Um aviso some na tela que já mostra o assunto.
 */
export function noticesOf(input: NoticeInput): Notice[] {
  const notices: Notice[] = [];
  if (input.plan) {
    notices.push({
      id: "plan",
      tone: input.plan.kind === "blocked" ? "urgent" : input.plan.kind === "today" ? "warn" : "info",
      text: input.plan.text,
      action: "Ver plano",
      view: "plano",
    });
  }
  if (input.newOrder && wantsNewOrderAlert(input.role) && input.view !== "pedidos") {
    notices.push({ id: "order", tone: "warn", text: "Chegou um novo pedido.", action: "Ver pedidos", view: "pedidos" });
  }
  // O Hoje e a Abrir mesa já mostram as mesas que chamam.
  if (input.calls > 0 && canOpenTable(input.role) && input.view !== "mesa" && input.view !== "inicio") {
    notices.push({ id: "calls", tone: "urgent", text: barTitle(input.calls), action: "Atender", view: "mesa" });
  }
  return notices;
}
