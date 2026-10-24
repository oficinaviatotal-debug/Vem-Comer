import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ENTRY_ROLES,
  STATUS,
  TEAM_ENTRIES,
  activityCards,
  canConfirmPix,
  canSettleCash,
  entryRoleFromSearch,
  entryRoleUrl,
  firstName,
  greeting,
  isManager,
  menuFor,
  menuViews,
  platformCards,
  roleLine,
  shareMessage,
  shortcutsFor,
  viewTitle,
  waitText,
  waitingMinutes,
  whatsappShareUrl,
} from "../../frontend/src/nav/navLogic.ts";
import {
  STATUS_DONE,
  STATUS_OUT,
  STATUS_PENDING,
  STATUS_PREPARING,
  STATUS_READY,
} from "../../frontend/src/service/orderStatus.ts";
import { BLOCKED_VIEWS, viewAllowed } from "../../frontend/src/service/subscriptionView.ts";
import { roleLabel } from "../../frontend/src/service/format.ts";
import { canConfirmPayment } from "../../frontend/src/customer/payment.ts";

const everything = () => true;

function base(role, extra = {}) {
  return { role, allowed: everything, hasPlanTab: true, platformAdmin: false, openOrders: 0, helpCount: null, ...extra };
}

const viewsOf = (context) => menuFor(context).flatMap((group) => group.items.map((item) => item.view));

// ---------------------------------------------------------------- who sees what

test("the menu shows each role exactly what the old tabs showed", () => {
  // The rules below are the ones the row of tabs in AdminPanel had before the menu existed.
  // Two screens are new: "meulink" (Meu link, only the owner and the manager) and "mesa" (Abrir mesa, who serves the
  // floor: owner, manager, waiter and cashier; the kitchen does not go to tables).
  const staff = ["inicio", "pedidos", "mesas", "produtos", "categorias", "dashboard"];
  assert.deepEqual(new Set(viewsOf(base("WAITER", { hasPlanTab: false }))), new Set([...staff, "mesa"]));
  assert.deepEqual(new Set(viewsOf(base("KITCHEN", { hasPlanTab: false }))), new Set(staff));
  assert.deepEqual(new Set(viewsOf(base("CASHIER", { hasPlanTab: false }))), new Set([...staff, "acerto", "mesa"]));

  const manager = [
    ...staff,
    "mesa",
    "assistente",
    "custos",
    "entrega",
    "horario",
    "entregas",
    "acerto",
    "pagamento",
    "marca",
    "meulink",
    "plano",
  ];
  assert.deepEqual(new Set(viewsOf(base("MANAGER"))), new Set(manager));
  assert.deepEqual(new Set(viewsOf(base("OWNER"))), new Set([...manager, "usuarios"]));
});

test("Equipe is only for the owner, and Plano only when there is a plan to talk about", () => {
  assert.ok(!viewsOf(base("MANAGER")).includes("usuarios"));
  assert.ok(viewsOf(base("OWNER")).includes("usuarios"));
  assert.ok(!viewsOf(base("OWNER", { hasPlanTab: false })).includes("plano"));
  assert.ok(viewsOf(base("OWNER")).includes("plano"));
});

test("Aprovações, Assinaturas and Chamados are only for the platform owner, and Aprovações comes first", () => {
  for (const role of ["OWNER", "MANAGER", "WAITER", "KITCHEN", "CASHIER"]) {
    for (const view of ["aprovacoes", "assinaturas", "ajuda"]) {
      assert.ok(!viewsOf(base(role)).includes(view), `${role} must not see ${view}`);
    }
  }
  const platform = viewsOf(base("OWNER", { platformAdmin: true }));
  assert.ok(platform.includes("aprovacoes") && platform.includes("assinaturas") && platform.includes("ajuda"));
  const group = menuFor(base("OWNER", { platformAdmin: true })).find((item) => item.key === "plataforma");
  assert.deepEqual(group.items.map((item) => item.view), ["aprovacoes", "assinaturas", "ajuda"]);
});

test("a blocked plan keeps only the orders in progress, the deliveries, the cash and the way to pay", () => {
  const blocked = (view) => viewAllowed(view, true);
  const shown = viewsOf(base("OWNER", { allowed: blocked }));
  assert.deepEqual(new Set(shown), new Set(BLOCKED_VIEWS));
  // and the same screens vanish for the cashier too, except what they may open
  assert.deepEqual(new Set(viewsOf(base("CASHIER", { allowed: blocked }))), new Set(["pedidos", "acerto", "plano"]));
});

test("an unknown or missing role never sees the manager's screens", () => {
  for (const role of [undefined, null, "", "VISITOR"]) {
    const shown = viewsOf(base(role, { hasPlanTab: false }));
    for (const hidden of ["assistente", "custos", "pagamento", "marca", "usuarios", "entregas", "horario", "entrega"]) {
      assert.ok(!shown.includes(hidden), `${role}: ${hidden}`);
    }
  }
});

test("role checks are case-insensitive and safe with empty values", () => {
  assert.equal(isManager("owner"), true);
  assert.equal(isManager("Manager"), true);
  assert.equal(isManager("WAITER"), false);
  assert.equal(isManager(undefined), false);
  assert.equal(canSettleCash("cashier"), true);
  assert.equal(canSettleCash("KITCHEN"), false);
});

test("the Pix rule is the same as the one the order screen uses", () => {
  for (const role of ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "COURIER", "", undefined]) {
    assert.equal(canConfirmPix(role), canConfirmPayment(role, "PENDING"), String(role));
  }
});

// ---------------------------------------------------------------- the menu itself

test("the menu starts with Hoje and has no empty group", () => {
  for (const role of ["OWNER", "MANAGER", "WAITER", "KITCHEN", "CASHIER"]) {
    const groups = menuFor(base(role));
    assert.equal(groups[0].key, "hoje", role);
    assert.equal(groups[0].items[0].view, "inicio", role);
    assert.equal(groups[0].title, null);
    for (const group of groups) assert.ok(group.items.length > 0, `${role}: ${group.key} is empty`);
  }
});

test("the groups come in the order the person works: sell, menu, numbers, shop, platform", () => {
  const keys = menuFor(base("OWNER", { platformAdmin: true })).map((group) => group.key);
  assert.deepEqual(keys, ["hoje", "vender", "cardapio", "numeros", "loja", "plataforma"]);
});

test("every item has a label, a hint and a view once, and never repeats", () => {
  const items = menuFor(base("OWNER", { platformAdmin: true })).flatMap((group) => group.items);
  const views = items.map((item) => item.view);
  assert.equal(new Set(views).size, views.length);
  for (const item of items) {
    assert.ok(item.label.trim(), item.view);
    assert.ok(item.hint.trim(), item.view);
    assert.ok(item.hint.length <= 48, `${item.view}: the hint is too long for a narrow phone`);
  }
});

test("the numbers screen is 'Seu negócio' for the owner and 'Resumo' for the team", () => {
  const label = (role) => menuFor(base(role)).flatMap((g) => g.items).find((i) => i.view === "dashboard").label;
  assert.equal(label("OWNER"), "Seu negócio");
  assert.equal(label("MANAGER"), "Seu negócio");
  assert.equal(label("WAITER"), "Resumo");
  assert.equal(viewTitle("dashboard", "KITCHEN"), "Resumo");
  assert.equal(viewTitle("dashboard", "OWNER"), "Seu negócio");
  assert.equal(viewTitle("inicio", "OWNER"), "Hoje");
  assert.equal(viewTitle("nao-existe", "OWNER"), "Painel");
});

test("badges: orders in progress on Pedidos, open requests on Chamados, decisions on Aprovações, nothing when zero", () => {
  const find = (groups, view) => groups.flatMap((g) => g.items).find((i) => i.view === view);
  const withOrders = menuFor(base("OWNER", { openOrders: 4, platformAdmin: true, helpCount: 2, approvalsCount: 3 }));
  assert.equal(find(withOrders, "pedidos").badge, 4);
  assert.equal(find(withOrders, "ajuda").badge, 2);
  assert.equal(find(withOrders, "aprovacoes").badge, 3);
  const quiet = menuFor(base("OWNER", { platformAdmin: true, helpCount: 0, approvalsCount: 0 }));
  assert.equal(find(quiet, "pedidos").badge, null);
  assert.equal(find(quiet, "ajuda").badge, null);
  assert.equal(find(quiet, "aprovacoes").badge, null);
  // not known (still loading or failed): no number, never a made-up one
  assert.equal(find(menuFor(base("OWNER", { platformAdmin: true })), "aprovacoes").badge, null);
  assert.equal(find(menuFor(base("OWNER", { platformAdmin: true, approvalsCount: null })), "aprovacoes").badge, null);
});

test("every screen the menu opens exists in AdminPanel.tsx (and Hoje is the only addition)", () => {
  const panel = readFileSync(new URL("../../frontend/src/service/AdminPanel.tsx", import.meta.url), "utf8");
  const block = panel.match(/const ADMIN_VIEWS: string\[\] = \[([\s\S]*?)\];/);
  assert.ok(block, "ADMIN_VIEWS not found in AdminPanel.tsx");
  const known = [...block[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  // the old panel never shows the screens that only exist in the new look (like Vendas)
  for (const view of menuViews({ newPanel: false })) assert.ok(known.includes(view), `${view} is not an admin view`);
  // and the other way round: no screen of the panel is left without a way in
  for (const view of known) assert.ok(menuViews({ newPanel: false }).includes(view), `${view} has no menu entry`);
});

test("Vendas only exists in the new panel and only for the owner of the platform", () => {
  const roles = ["OWNER", "MANAGER", "WAITER", "CASHIER", "KITCHEN", "COURIER", null];
  for (const role of roles) {
    // the old panel never passes `newPanel`: Vendas must not leak into it, not even for the platform owner
    assert.ok(!viewsOf(base(role, { platformAdmin: true })).includes("vendas"), `old panel, ${role}`);
    assert.ok(!viewsOf(base(role, { platformAdmin: false, newPanel: true })).includes("vendas"), `new panel, not platform, ${role}`);
  }
  assert.ok(viewsOf(base("OWNER", { platformAdmin: true, newPanel: true })).includes("vendas"));
  const group = menuFor(base("OWNER", { platformAdmin: true, newPanel: true })).find((item) => item.key === "plataforma");
  assert.deepEqual(group.items.map((item) => item.view), ["aprovacoes", "assinaturas", "vendas", "ajuda"]);
  assert.ok(menuViews().includes("vendas") && !menuViews({ newPanel: false }).includes("vendas"));
});

// ---------------------------------------------------------------- statuses

test("the order statuses are the same words as service/orderStatus.ts", () => {
  assert.equal(STATUS.pending, STATUS_PENDING);
  assert.equal(STATUS.preparing, STATUS_PREPARING);
  assert.equal(STATUS.ready, STATUS_READY);
  assert.equal(STATUS.out, STATUS_OUT);
  assert.equal(STATUS.done, STATUS_DONE);
});

// ---------------------------------------------------------------- the Hoje tiles

const NOW = Date.parse("2026-10-15T15:00:00Z");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();
const order = (status, minutes, extra = {}) => ({ status, created_at: ago(minutes), ...extra });

test("waiting time: whole minutes, empty for a time we cannot read", () => {
  assert.equal(waitingMinutes(ago(7), NOW), 7);
  assert.equal(waitingMinutes(ago(0), NOW), 0);
  assert.equal(waitingMinutes("not a date", NOW), null);
  assert.equal(waitingMinutes("", NOW), null);
  assert.equal(waitingMinutes(ago(-5), NOW), null, "a clock ahead of ours is not news");
});

test("waitText says it the way a person would", () => {
  assert.equal(waitText(0), "agora");
  assert.equal(waitText(1), "há 1 min");
  assert.equal(waitText(59), "há 59 min");
  assert.equal(waitText(60), "há 1 h");
  assert.equal(waitText(80), "há 1 h 20 min");
});

test("the manager's tiles count each stage and say how long the oldest has been waiting", () => {
  const orders = [
    order(STATUS.pending, 3),
    order(STATUS.pending, 12),
    order(STATUS.preparing, 20),
    order(STATUS.ready, 5, { order_type: "entrega" }),
    order(STATUS.out, 9, { order_type: "entrega" }),
    order(STATUS.out, 30, { order_type: "entrega" }),
    order(STATUS.done, 40),
  ];
  const cards = activityCards("OWNER", orders, NOW);
  assert.deepEqual(cards.map((card) => card.key), ["novos", "cozinha", "entregas", "pix"]);
  const byKey = Object.fromEntries(cards.map((card) => [card.key, card]));
  assert.equal(byKey.novos.count, 2);
  assert.equal(byKey.novos.note, "O mais antigo: há 12 min");
  assert.equal(byKey.cozinha.count, 1);
  assert.equal(byKey.cozinha.note, "O mais antigo: há 20 min");
  assert.equal(byKey.entregas.count, 3);
  assert.equal(byKey.entregas.note, "1 esperando, 2 na rua");
  assert.equal(byKey.pix.count, 0);
});

test("with nothing going on the tiles say so and never show an invented number", () => {
  const cards = activityCards("MANAGER", [], NOW);
  for (const card of cards) assert.equal(card.count, 0, card.key);
  assert.equal(cards[0].note, "Nenhum esperando");
  assert.equal(cards[1].note, "Cozinha livre");
  assert.equal(cards[2].note, "Nenhuma em andamento");
  assert.equal(cards[3].note, "Tudo conferido");
  assert.equal(cards[3].tone, "ok");
});

test("Pix to check: only Pix, not yet paid, from the last day", () => {
  const orders = [
    order(STATUS.pending, 5, { payment_method: "pix", payment_status: "PENDING" }),
    order(STATUS.preparing, 50, { payment_method: "PIX", payment_status: "PENDING" }),
    order(STATUS.pending, 5, { payment_method: "pix", payment_status: "PAID" }),
    order(STATUS.pending, 5, { payment_method: "dinheiro", payment_status: "PENDING" }),
    order(STATUS.done, 60 * 25, { payment_method: "pix", payment_status: "PENDING" }),
  ];
  const pix = activityCards("OWNER", orders, NOW).find((card) => card.key === "pix");
  assert.equal(pix.count, 2);
  assert.equal(pix.tone, "wait");
});

test("the kitchen sees the queue, not the money", () => {
  const cards = activityCards("KITCHEN", [order(STATUS.pending, 2), order(STATUS.ready, 4)], NOW);
  assert.deepEqual(cards.map((card) => card.key), ["novos", "cozinha", "prontos"]);
  assert.equal(cards[2].label, "Pronto para sair");
  assert.equal(cards[2].count, 1);
});

test("the cashier sees the Pix to check first", () => {
  const cards = activityCards("CASHIER", [], NOW);
  assert.deepEqual(cards.map((card) => card.key), ["pix", "novos"]);
});

test("the waiter sees only the table orders", () => {
  const orders = [
    order(STATUS.pending, 2, { order_type: "mesa" }),
    order(STATUS.pending, 2, { order_type: "entrega" }),
    order(STATUS.preparing, 8, { order_type: "mesa" }),
    order(STATUS.preparing, 8, { order_type: "retirada" }),
  ];
  const cards = activityCards("WAITER", orders, NOW);
  assert.equal(cards[0].count, 1);
  assert.equal(cards[1].count, 1);
});

test("every tile opens a screen the role can really open", () => {
  for (const role of ["OWNER", "MANAGER", "KITCHEN", "CASHIER", "WAITER"]) {
    const allowed = new Set(viewsOf(base(role)));
    for (const card of activityCards(role, [], NOW)) {
      assert.ok(allowed.has(card.go), `${role}: the tile "${card.key}" opens ${card.go}, which the menu hides`);
    }
    for (const shortcut of shortcutsFor(role)) {
      assert.ok(allowed.has(shortcut.view), `${role}: the button "${shortcut.label}" opens ${shortcut.view}, which the menu hides`);
    }
  }
});

test("every role has between two and five big buttons, each with a verb and a hint", () => {
  for (const role of ["OWNER", "MANAGER", "KITCHEN", "CASHIER", "WAITER"]) {
    const list = shortcutsFor(role);
    assert.ok(list.length >= 2 && list.length <= 5, role);
    for (const item of list) {
      assert.ok(item.label.trim() && item.hint.trim(), role);
    }
  }
});

test("greeting follows the hour and the first name is only the first", () => {
  assert.equal(greeting(5), "Bom dia");
  assert.equal(greeting(11), "Bom dia");
  assert.equal(greeting(12), "Boa tarde");
  assert.equal(greeting(17), "Boa tarde");
  assert.equal(greeting(18), "Boa noite");
  assert.equal(greeting(2), "Boa noite");
  assert.equal(firstName("GD Oliveira"), "GD");
  assert.equal(firstName("  Maria  "), "Maria");
  assert.equal(firstName(""), "");
  assert.equal(firstName(null), "");
  // A form of address stays with the name; alone, it is just the name.
  assert.equal(firstName("Seu João da Cozinha"), "Seu João");
  assert.equal(firstName("Dona Rosa Alves"), "Dona Rosa");
  assert.equal(firstName("Dr. Paulo Lima"), "Dr. Paulo");
  assert.equal(firstName("Seu"), "Seu");
  assert.equal(roleLine("KITCHEN"), "Sua fila de hoje");
  assert.equal(roleLine("OWNER"), "O seu restaurante agora");
});

// ---------------------------------------------------------------- the start screen

test("the start screen has one button per function, the team first and the owner last", () => {
  assert.deepEqual(
    ENTRY_ROLES.map((entry) => entry.key),
    ["cozinha", "garcom", "caixa", "entregador", "dono"]
  );
  assert.deepEqual(TEAM_ENTRIES.map((entry) => entry.key), ["cozinha", "garcom", "caixa", "entregador"]);
});

test("each button points to a role the system really has", () => {
  for (const entry of ENTRY_ROLES) {
    assert.notEqual(roleLabel(entry.role), entry.role, `${entry.key}: ${entry.role} has no name in format.ts`);
    assert.ok(entry.loginTitle.trim() && entry.loginLead.trim());
    assert.ok(entry.hint.length <= 28, `${entry.key}: the hint would not fit in a half-width button`);
  }
});

test("the sign-in address of a button keeps only the origin, the path and the two words it needs", () => {
  const url = new URL(entryRoleUrl("https://vem.example", "/app/", "garcom"));
  assert.equal(url.origin, "https://vem.example");
  assert.equal(url.pathname, "/app/");
  assert.equal(url.searchParams.get("entrar"), "1");
  assert.equal(url.searchParams.get("funcao"), "garcom");
  assert.equal([...url.searchParams.keys()].length, 2);
});

test("the button is read back from the address, and anything else is ignored", () => {
  assert.equal(entryRoleFromSearch("?entrar=1&funcao=cozinha").key, "cozinha");
  assert.equal(entryRoleFromSearch("?funcao=dono").key, "dono");
  assert.equal(entryRoleFromSearch("?entrar=1&funcao=hacker"), null);
  assert.equal(entryRoleFromSearch("?entrar=1"), null);
  assert.equal(entryRoleFromSearch(""), null);
});

// ---------------------------------------------------------------- the restaurant's own link

test("Meu link is for the owner and the manager, and waits while the plan is blocked", () => {
  assert.ok(viewsOf(base("OWNER")).includes("meulink"));
  assert.ok(viewsOf(base("MANAGER")).includes("meulink"));
  for (const role of ["WAITER", "KITCHEN", "CASHIER"]) {
    assert.ok(!viewsOf(base(role)).includes("meulink"), role);
  }
  const blocked = base("OWNER", { allowed: (view) => viewAllowed(view, true) });
  assert.ok(!viewsOf(blocked).includes("meulink"));
  assert.equal(viewTitle("meulink", "OWNER"), "Meu link");
  assert.ok(shortcutsFor("OWNER").some((item) => item.view === "meulink"));
});

test("the message that goes with the link carries the name and the link, and WhatsApp gets it encoded", () => {
  const url = "https://vemcomer.example/?empresa=acaiteria-do-joao";
  const text = shareMessage("Açaiteria do João", url);
  assert.ok(text.startsWith("Açaiteria do João:"));
  assert.ok(text.endsWith(url));
  // Without a name the message still works.
  assert.ok(shareMessage("  ", url).endsWith(url));
  assert.ok(shareMessage(null, url).endsWith(url));

  const wa = new URL(whatsappShareUrl(text));
  assert.equal(wa.origin, "https://wa.me");
  assert.equal(wa.searchParams.get("text"), text);
});

// ---------------------------------------------------------------- only for the owner of the platform

test("the platform strip shows what the server counted and a dash when it does not know", () => {
  const [approvals, plans, help] = platformCards({ needsAttention: 2, helpOpen: 0, approvalsPending: 3 });
  assert.equal(approvals.count, 3);
  assert.equal(approvals.note, "3 decisões esperam o seu aval");
  assert.equal(approvals.tone, "wait");
  assert.equal(approvals.go, "aprovacoes");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 0, approvalsPending: 1 })[0].note, "1 decisão espera o seu aval");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 0, approvalsPending: 0 })[0].note, "Nada espera o seu aval");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 0, approvalsPending: 0 })[0].tone, "ok");
  assert.equal(plans.count, 2);
  assert.equal(plans.note, "2 restaurantes precisam de você");
  assert.equal(plans.tone, "wait");
  assert.equal(plans.go, "assinaturas");
  assert.equal(help.count, 0);
  assert.equal(help.tone, "ok");
  assert.equal(help.go, "ajuda");

  assert.equal(platformCards({ needsAttention: 1, helpOpen: 3 })[1].note, "1 restaurante precisa de você");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 3 })[1].note, "Todos os restaurantes em dia");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 3 })[1].tone, "ok");
  assert.equal(platformCards({ needsAttention: 0, helpOpen: 3 })[2].tone, "wait");

  // Not known (still loading or failed): never a made-up zero.
  const unknown = platformCards({ needsAttention: null, helpOpen: null, approvalsPending: null });
  assert.equal(unknown.length, 3);
  for (const card of unknown) {
    assert.equal(card.count, null);
    assert.equal(card.tone, "wait");
  }
  assert.equal(platformCards({ needsAttention: 1, helpOpen: 1 })[0].count, null);
});

test("the platform cards open screens that only the platform owner's menu has", () => {
  const owner = viewsOf(base("OWNER", { platformAdmin: true }));
  const plain = viewsOf(base("OWNER", { platformAdmin: false }));
  for (const card of platformCards({ needsAttention: 1, helpOpen: 1, approvalsPending: 1 })) {
    assert.ok(owner.includes(card.go), card.go);
    assert.ok(!plain.includes(card.go), card.go);
  }
});
