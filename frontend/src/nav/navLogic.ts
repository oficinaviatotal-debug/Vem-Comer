/**
 * Rules for the panel's side menu, the "Hoje" screen and the start screen of each role.
 *
 * The panel used to be 15 tabs in a row, the same screen for the owner and for the cook. Now the functions live in a
 * menu of three lines on the left, grouped by subject, and the first screen shows what is happening. This file only
 * decides WHAT each role sees; the screens draw it.
 *
 * Pure logic, no screens: tests/nav/navLogic.test.mjs runs it in Node.
 * Keep this file free of imports from other project files (Node runs it as it is). The order statuses below are
 * copied from service/orderStatus.ts on purpose and a test keeps the two in step.
 */

// ---------------------------------------------------------------- who is who

export const MANAGER_ROLES = ["OWNER", "MANAGER"];

/** Owner and manager: they see every screen of the restaurant. */
export function isManager(role: string | null | undefined): boolean {
  return MANAGER_ROLES.includes(String(role ?? "").toUpperCase());
}

/** Who settles the cash the couriers bring back. The server checks it again. */
export function canSettleCash(role: string | null | undefined): boolean {
  return ["OWNER", "MANAGER", "CASHIER"].includes(String(role ?? "").toUpperCase());
}

/** Who may tell the system "the Pix arrived". Same list as customer/payment.ts; the server checks it again. */
export function canConfirmPix(role: string | null | undefined): boolean {
  return ["OWNER", "MANAGER", "CASHIER"].includes(String(role ?? "").toUpperCase());
}

// ---------------------------------------------------------------- the menu

export type IconName =
  | "home"
  | "orders"
  | "assistant"
  | "products"
  | "costs"
  | "categories"
  | "tables"
  | "zones"
  | "hours"
  | "deliveries"
  | "settle"
  | "business"
  | "payment"
  | "brand"
  | "team"
  | "plan"
  | "subscriptions"
  | "help"
  | "kitchen"
  | "waiter"
  | "cashier"
  | "courier"
  | "customer"
  | "owner"
  | "link"
  | "approvals"
  | "sales"
  | "qr";

export type NavGroupKey = "hoje" | "vender" | "cardapio" | "numeros" | "loja" | "plataforma";

export type NavItem = {
  /** The panel screen this opens (the same words as the panel's `view`). */
  view: string;
  label: string;
  /** One short line under the label: what the screen is for. */
  hint: string;
  icon: IconName;
  /** A small number on the item (orders in progress, open help requests). */
  badge: number | null;
};

export type NavGroup = { key: NavGroupKey; title: string | null; items: NavItem[] };

export type NavContext = {
  role: string | null | undefined;
  /** What the plan still allows (a blocked restaurant keeps only the orders in progress and the way to pay). */
  allowed: (view: string) => boolean;
  /** The restaurant has a plan to talk about. */
  hasPlanTab: boolean;
  /** The person who owns the platform (sees Aprovações, Assinaturas and Chamados). */
  platformAdmin: boolean;
  openOrders: number;
  helpCount: number | null;
  /** Decisions waiting for the owner of the platform (null or missing: not known). */
  approvalsCount?: number | null;
  /** The new look of the panel (`?novo=1`). A few screens only exist there; the old panel never passes this. */
  newPanel?: boolean;
};

type Entry = {
  group: NavGroupKey;
  view: string;
  label: string | ((role: string) => string);
  hint: string;
  icon: IconName;
  /** Who sees it. Omitted: every role of the restaurant. */
  roles?: string[];
  /** Shown only when the plan has something to say / for the platform owner. */
  need?: "plan" | "platform";
  /** The screen exists only in the new look of the panel. */
  newOnly?: boolean;
};

const MANAGERS = MANAGER_ROLES;
const CASH = ["OWNER", "MANAGER", "CASHIER"];
/** Who goes to a table: "Abrir mesa" (read the QR, see its calls and orders). The kitchen and the couriers do not. */
const TABLE_ROLES = ["OWNER", "MANAGER", "WAITER", "CASHIER"];

/** Who opens a table and answers its calls (the same list as the "Abrir mesa" item of the menu). */
export function canOpenTable(role: string | null | undefined): boolean {
  return TABLE_ROLES.includes(String(role ?? "").toUpperCase());
}

/**
 * Every screen of the panel, in the order of the menu. The visibility rules are the ones the tabs always had
 * (who saw what before still sees it): the menu changed the way to reach the screens, not who may open them.
 */
const CATALOG: Entry[] = [
  { group: "hoje", view: "inicio", label: "Hoje", hint: "O que está acontecendo agora", icon: "home" },

  { group: "vender", view: "pedidos", label: "Pedidos", hint: "Aceitar, preparar e entregar", icon: "orders" },
  { group: "vender", view: "mesa", label: "Abrir mesa", hint: "Leia o QR ou digite o número", icon: "qr", roles: TABLE_ROLES },
  { group: "vender", view: "mesas", label: "Mesas", hint: "QR Code e chamados do salão", icon: "tables" },
  { group: "vender", view: "entregas", label: "Entregas", hint: "Quem está na rua e o que falta", icon: "deliveries", roles: MANAGERS },
  { group: "vender", view: "acerto", label: "Acerto de caixa", hint: "Dinheiro que os entregadores trouxeram", icon: "settle", roles: CASH },

  { group: "cardapio", view: "assistente", label: "Assistente", hint: "Monte o cardápio falando ou com foto", icon: "assistant", roles: MANAGERS },
  { group: "cardapio", view: "produtos", label: "Produtos", hint: "Preços, fotos e o que esgotou", icon: "products" },
  { group: "cardapio", view: "categorias", label: "Categorias", hint: "As seções do cardápio", icon: "categories" },

  {
    group: "numeros",
    view: "dashboard",
    label: (role) => (MANAGERS.includes(role) ? "Seu negócio" : "Resumo"),
    hint: "Vendas, horários e o que dá lucro",
    icon: "business",
  },
  { group: "numeros", view: "custos", label: "Custos", hint: "Custo de cada prato e CMV", icon: "costs", roles: MANAGERS },
  { group: "numeros", view: "pagamento", label: "Pagamento", hint: "Pix direto na sua conta", icon: "payment", roles: MANAGERS },

  { group: "loja", view: "meulink", label: "Meu link", hint: "Para mandar no WhatsApp e no Instagram", icon: "link", roles: MANAGERS },
  { group: "loja", view: "horario", label: "Horário", hint: "Abrir, pausar e fechar", icon: "hours", roles: MANAGERS },
  { group: "loja", view: "entrega", label: "Regiões de entrega", hint: "Taxas por região e retirada", icon: "zones", roles: MANAGERS },
  { group: "loja", view: "marca", label: "Marca", hint: "Logomarca e cores", icon: "brand", roles: MANAGERS },
  { group: "loja", view: "usuarios", label: "Equipe", hint: "Quem entra no painel", icon: "team", roles: ["OWNER"] },
  { group: "loja", view: "plano", label: "Plano", hint: "Pagamento e vencimento", icon: "plan", need: "plan" },

  { group: "plataforma", view: "aprovacoes", label: "Aprovações", hint: "O que espera o seu aval", icon: "approvals", need: "platform" },
  { group: "plataforma", view: "assinaturas", label: "Assinaturas", hint: "Restaurantes e planos", icon: "subscriptions", need: "platform" },
  { group: "plataforma", view: "vendas", label: "Vendas", hint: "Quem procurar para conquistar", icon: "sales", need: "platform", newOnly: true },
  { group: "plataforma", view: "ajuda", label: "Chamados", hint: "Pedidos de ajuda dos donos", icon: "help", need: "platform" },
];

const GROUP_TITLES: Record<NavGroupKey, string | null> = {
  hoje: null,
  vender: "Vender",
  cardapio: "Cardápio",
  numeros: "Números",
  loja: "Minha loja",
  plataforma: "Dono do sistema",
};

const GROUP_ORDER: NavGroupKey[] = ["hoje", "vender", "cardapio", "numeros", "loja", "plataforma"];

function labelOf(entry: Entry, role: string): string {
  return typeof entry.label === "function" ? entry.label(role) : entry.label;
}

/** The menu this person sees, grouped, without empty groups. */
export function menuFor(context: NavContext): NavGroup[] {
  const role = String(context.role ?? "").toUpperCase();
  const groups: NavGroup[] = GROUP_ORDER.map((key) => ({ key, title: GROUP_TITLES[key], items: [] }));

  for (const entry of CATALOG) {
    if (entry.roles && !entry.roles.includes(role)) continue;
    if (entry.need === "plan" && !context.hasPlanTab) continue;
    if (entry.need === "platform" && !context.platformAdmin) continue;
    if (entry.newOnly && !context.newPanel) continue;
    if (!context.allowed(entry.view)) continue;

    let badge: number | null = null;
    if (entry.view === "pedidos" && context.openOrders > 0) badge = context.openOrders;
    if (entry.view === "ajuda" && context.helpCount) badge = context.helpCount;
    if (entry.view === "aprovacoes" && context.approvalsCount) badge = context.approvalsCount;

    const group = groups.find((item) => item.key === entry.group);
    group?.items.push({ view: entry.view, label: labelOf(entry, role), hint: entry.hint, icon: entry.icon, badge });
  }

  return groups.filter((group) => group.items.length > 0);
}

/**
 * Every screen name the menu can open (the panel keeps its own list; a test compares the two). By default this is the
 * new panel's list; `{ newPanel: false }` leaves out the screens that only exist there, which is the old panel's list.
 */
export function menuViews(options: { newPanel?: boolean } = {}): string[] {
  const newPanel = options.newPanel !== false;
  return CATALOG.filter((entry) => newPanel || !entry.newOnly).map((entry) => entry.view);
}

/** The name on top of the screen, next to the menu button. */
export function viewTitle(view: string, role: string | null | undefined): string {
  const upper = String(role ?? "").toUpperCase();
  const entry = CATALOG.find((item) => item.view === view);
  return entry ? labelOf(entry, upper) : "Painel";
}

// ---------------------------------------------------------------- the "Hoje" screen

/** Order statuses, as the server writes them (service/orderStatus.ts has the same words; a test compares). */
export const STATUS = {
  pending: "PENDING_PAYMENT",
  preparing: "em preparo",
  ready: "pronto",
  out: "saiu para entrega",
  done: "concluido",
} as const;

export type OrderLite = {
  status: string;
  order_type?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at: string;
};

export type ActivityTone = "wait" | "prep" | "go" | "ok";

export type ActivityCard = {
  key: string;
  label: string;
  count: number;
  /** A short line under the number. Never an invented one: it says what the number is. */
  note: string;
  tone: ActivityTone;
  /** The screen the tile opens. */
  go: string;
};

/** Whole minutes since the order came in, or null when the time cannot be read (or is in the future). */
export function waitingMinutes(createdAt: string, nowMs: number): number | null {
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.floor((nowMs - then) / 60000);
  return minutes < 0 ? null : minutes;
}

/** "agora", "há 7 min", "há 1 h 20 min": how long something has been waiting. */
export function waitText(minutes: number): string {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `há ${hours} h` : `há ${hours} h ${rest} min`;
}

export function oldestWait(orders: OrderLite[], nowMs: number): number | null {
  let oldest: number | null = null;
  for (const order of orders) {
    const minutes = waitingMinutes(order.created_at, nowMs);
    if (minutes !== null && (oldest === null || minutes > oldest)) oldest = minutes;
  }
  return oldest;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isPixToCheck(order: OrderLite, nowMs: number): boolean {
  if (String(order.payment_method ?? "").toLowerCase() !== "pix") return false;
  if (String(order.payment_status ?? "").toUpperCase() === "PAID") return false;
  // Only the last day: an old order nobody ever marked is a habit of the house, not news for today.
  const then = Date.parse(order.created_at);
  return Number.isFinite(then) && nowMs - then <= DAY_MS;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * The tiles of the "Hoje" screen. They count only what the panel already knows (the orders it polls every few
 * seconds); nothing here is estimated. Each tile opens the screen where the person acts on it.
 */
export function activityCards(roleInput: string | null | undefined, orders: OrderLite[], nowMs: number): ActivityCard[] {
  const role = String(roleInput ?? "").toUpperCase();
  const pending = orders.filter((order) => order.status === STATUS.pending);
  const preparing = orders.filter((order) => order.status === STATUS.preparing);
  const ready = orders.filter((order) => order.status === STATUS.ready);
  const out = orders.filter((order) => order.status === STATUS.out);
  const pix = orders.filter((order) => isPixToCheck(order, nowMs));

  const wait = oldestWait(pending, nowMs);
  const newCard: ActivityCard = {
    key: "novos",
    label: "Novos",
    count: pending.length,
    note: pending.length === 0 ? "Nenhum esperando" : wait === null ? "Esperando aceite" : `O mais antigo: ${waitText(wait)}`,
    tone: "wait",
    go: "pedidos",
  };
  const prepWait = oldestWait(preparing, nowMs);
  const kitchenCard: ActivityCard = {
    key: "cozinha",
    label: "Na cozinha",
    count: preparing.length,
    note: preparing.length === 0 ? "Cozinha livre" : prepWait === null ? "Em preparo" : `O mais antigo: ${waitText(prepWait)}`,
    tone: "prep",
    go: "pedidos",
  };
  const readyCard: ActivityCard = {
    key: "prontos",
    label: plural(ready.length, "Pronto para sair", "Prontos para sair"),
    count: ready.length,
    note: ready.length === 0 ? "Nada esperando entregador" : "Esperando o entregador",
    tone: "go",
    go: "pedidos",
  };
  const deliveryCount = ready.length + out.length;
  const deliveriesCard: ActivityCard = {
    key: "entregas",
    label: "Entregas",
    count: deliveryCount,
    note:
      deliveryCount === 0
        ? "Nenhuma em andamento"
        : `${ready.length} esperando, ${out.length} na rua`,
    tone: "go",
    go: "entregas",
  };
  const pixCard: ActivityCard = {
    key: "pix",
    label: "Pix a conferir",
    count: pix.length,
    note: pix.length === 0 ? "Tudo conferido" : "Confira no banco e toque em Pagamento recebido",
    tone: pix.length === 0 ? "ok" : "wait",
    go: "pedidos",
  };

  if (isManager(role)) return [newCard, kitchenCard, deliveriesCard, pixCard];
  if (role === "KITCHEN") return [newCard, kitchenCard, readyCard];
  if (role === "CASHIER") return [pixCard, newCard];
  // The waiter: what is going on in the house.
  const tableOrders = orders.filter((order) => String(order.order_type ?? "") === "mesa");
  const tablePending = tableOrders.filter((order) => order.status === STATUS.pending);
  const tablePreparing = tableOrders.filter((order) => order.status === STATUS.preparing);
  return [
    {
      key: "mesa-novos",
      label: "Novos nas mesas",
      count: tablePending.length,
      note: tablePending.length === 0 ? "Nenhum esperando" : "Esperando aceite",
      tone: "wait",
      go: "pedidos",
    },
    {
      key: "mesa-cozinha",
      label: "Mesas na cozinha",
      count: tablePreparing.length,
      note: tablePreparing.length === 0 ? "Nada em preparo" : "Em preparo",
      tone: "prep",
      go: "pedidos",
    },
  ];
}

export type Shortcut = { view: string; label: string; hint: string; icon: IconName };

/** The big buttons under the tiles: the three or four things this person does most. */
export function shortcutsFor(roleInput: string | null | undefined): Shortcut[] {
  const role = String(roleInput ?? "").toUpperCase();
  if (isManager(role)) {
    return [
      { view: "pedidos", label: "Ver pedidos", hint: "Aceitar e acompanhar", icon: "orders" },
      { view: "assistente", label: "Falar o cardápio", hint: "Cadastre por voz ou foto", icon: "assistant" },
      { view: "mesas", label: "Mesas e QR Code", hint: "Imprima o cartaz da mesa", icon: "tables" },
      { view: "meulink", label: "Mandar meu link", hint: "WhatsApp e Instagram", icon: "link" },
      { view: "dashboard", label: "Ver os números", hint: "Vendas, lucro e horários", icon: "business" },
    ];
  }
  if (role === "KITCHEN") {
    return [
      { view: "pedidos", label: "Abrir a fila da cozinha", hint: "Os pedidos, do mais antigo ao mais novo", icon: "kitchen" },
      { view: "produtos", label: "Marcar o que esgotou", hint: "O cliente deixa de pedir", icon: "products" },
    ];
  }
  if (role === "CASHIER") {
    return [
      { view: "pedidos", label: "Receber pagamentos", hint: "Confirme o Pix e o que foi pago", icon: "cashier" },
      { view: "acerto", label: "Acerto de caixa", hint: "Dinheiro dos entregadores", icon: "settle" },
    ];
  }
  return [
    { view: "mesa", label: "Abrir uma mesa", hint: "Leia o QR ou digite o número", icon: "qr" },
    { view: "mesas", label: "Ver as mesas", hint: "Chamados e QR Code", icon: "waiter" },
    { view: "pedidos", label: "Ver pedidos", hint: "O que a cozinha está fazendo", icon: "orders" },
    { view: "produtos", label: "Marcar o que esgotou", hint: "O cliente deixa de pedir", icon: "products" },
  ];
}

/** The words that go with the restaurant's link when the owner sends it to customers. */
export function shareMessage(placeName: string | null | undefined, url: string): string {
  const name = String(placeName ?? "").trim();
  return name ? `${name}: veja o cardápio e faça o seu pedido pelo celular.\n${url}` : `Veja o cardápio e faça o seu pedido pelo celular.\n${url}`;
}

/** Opens WhatsApp with the message ready; the person picks who gets it. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type PlatformCard = {
  key: string;
  label: string;
  /** null: the number is not known yet or could not be read (the card shows a dash, never a made-up zero). */
  count: number | null;
  note: string;
  tone: "wait" | "ok";
  go: string;
};

/**
 * What only the owner of the platform sees on "Hoje": the decisions waiting for his go-ahead, the restaurants that need
 * him (plan late or about to be) and the help requests waiting for an answer. The numbers come from the server;
 * nothing is estimated here.
 */
export function platformCards(input: {
  needsAttention: number | null;
  helpOpen: number | null;
  approvalsPending?: number | null;
}): PlatformCard[] {
  const { needsAttention, helpOpen } = input;
  const approvalsPending = input.approvalsPending ?? null;
  const approvals: PlatformCard =
    approvalsPending === null
      ? { key: "plataforma-aprovacoes", label: "Aprovações", count: null, note: "Toque para ver", tone: "wait", go: "aprovacoes" }
      : {
          key: "plataforma-aprovacoes",
          label: "Aprovações",
          count: approvalsPending,
          note:
            approvalsPending === 0
              ? "Nada espera o seu aval"
              : approvalsPending === 1
                ? "1 decisão espera o seu aval"
                : `${approvalsPending} decisões esperam o seu aval`,
          tone: approvalsPending === 0 ? "ok" : "wait",
          go: "aprovacoes",
        };
  const plans: PlatformCard =
    needsAttention === null
      ? { key: "plataforma-planos", label: "Assinaturas", count: null, note: "Toque para ver", tone: "wait", go: "assinaturas" }
      : {
          key: "plataforma-planos",
          label: "Assinaturas",
          count: needsAttention,
          note:
            needsAttention === 0
              ? "Todos os restaurantes em dia"
              : needsAttention === 1
                ? "1 restaurante precisa de você"
                : `${needsAttention} restaurantes precisam de você`,
          tone: needsAttention === 0 ? "ok" : "wait",
          go: "assinaturas",
        };
  const help: PlatformCard =
    helpOpen === null
      ? { key: "plataforma-ajuda", label: "Chamados", count: null, note: "Toque para ver", tone: "wait", go: "ajuda" }
      : {
          key: "plataforma-ajuda",
          label: "Chamados",
          count: helpOpen,
          note: helpOpen === 0 ? "Nenhum pedido de ajuda" : "Donos esperando resposta",
          tone: helpOpen === 0 ? "ok" : "wait",
          go: "ajuda",
        };
  return [approvals, plans, help];
}

/** "Bom dia", "Boa tarde" or "Boa noite" by the hour on the person's own clock (0 to 23). */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Forms of address people put in front of a name: "Seu João" is greeted as "Seu João", never as just "Seu". */
const TITLES = new Set(["seu", "dona", "dom", "sr", "sra", "srta", "dr", "dra", "tia", "tio", "chef"]);

/**
 * "GD Oliveira" -> "GD"; "Seu João da Cozinha" -> "Seu João".
 * An empty name gives an empty string, and the screen then greets without a name.
 */
export function firstName(name: string | null | undefined): string {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const next = words[1];
  if (next && TITLES.has(first.toLowerCase().replace(/\.$/, ""))) return `${first} ${next}`;
  return first;
}

/** What the top of "Hoje" says for each role: one line of what this person is here to do. */
export function roleLine(roleInput: string | null | undefined): string {
  switch (String(roleInput ?? "").toUpperCase()) {
    case "KITCHEN":
      return "Sua fila de hoje";
    case "WAITER":
      return "O salão agora";
    case "CASHIER":
      return "O caixa agora";
    default:
      return "O seu restaurante agora";
  }
}

// ---------------------------------------------------------------- the start screen (bare address)

export type EntryKey = "cozinha" | "garcom" | "caixa" | "entregador" | "dono";

export type EntryRole = {
  key: EntryKey;
  label: string;
  hint: string;
  /** The role the account must have to land on the matching screen. */
  role: string;
  icon: IconName;
  /** What the sign-in screen says when the person came through this button. */
  loginTitle: string;
  loginLead: string;
};

/** The buttons of the start screen, the team first and the owner last. */
export const ENTRY_ROLES: EntryRole[] = [
  {
    key: "cozinha",
    label: "Cozinha",
    hint: "Fila de pedidos",
    role: "KITCHEN",
    icon: "kitchen",
    loginTitle: "Entrar na cozinha",
    loginLead: "Use o e-mail e a senha que o dono criou para você.",
  },
  {
    key: "garcom",
    label: "Garçom",
    hint: "Mesas e chamados",
    role: "WAITER",
    icon: "waiter",
    loginTitle: "Entrar como garçom",
    loginLead: "Use o e-mail e a senha que o dono criou para você.",
  },
  {
    key: "caixa",
    label: "Caixa",
    hint: "Receber e acertar",
    role: "CASHIER",
    icon: "cashier",
    loginTitle: "Entrar no caixa",
    loginLead: "Use o e-mail e a senha que o dono criou para você.",
  },
  {
    key: "entregador",
    label: "Entregador",
    hint: "Minhas entregas",
    role: "COURIER",
    icon: "courier",
    loginTitle: "Entrar como entregador",
    loginLead: "Use o e-mail e a senha que o restaurante criou para você.",
  },
  {
    key: "dono",
    label: "Dono ou gerente",
    hint: "O painel do restaurante",
    role: "OWNER",
    icon: "owner",
    loginTitle: "Área do restaurante",
    loginLead: "Entre com o e-mail e a senha do seu cadastro.",
  },
];

export const TEAM_ENTRIES: EntryRole[] = ENTRY_ROLES.filter((entry) => entry.key !== "dono");

/** Which button the person tapped, read from `?funcao=` in the address; null for anything unknown. */
export function entryRoleFromSearch(search: string): EntryRole | null {
  const key = new URLSearchParams(search).get("funcao");
  return ENTRY_ROLES.find((entry) => entry.key === key) ?? null;
}

/** The sign-in address for a button of the start screen. Only the origin and the path are kept. */
export function entryRoleUrl(origin: string, pathname: string, key: EntryKey): string {
  const url = new URL(pathname || "/", origin);
  url.searchParams.set("entrar", "1");
  url.searchParams.set("funcao", key);
  return url.toString();
}
