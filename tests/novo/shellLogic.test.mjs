import test from "node:test";
import assert from "node:assert/strict";

import { menuViews } from "../../frontend/src/nav/navLogic.ts";
import {
  CALLS_WATCH_MS,
  FLAG_KEY,
  ORDERS_WATCH_MS,
  allowedViews,
  firstView,
  knownViews,
  noticesOf,
  ownerStartView,
  readFlag,
  screenOf,
  shownView,
  watchCalls,
  watchOrders,
} from "../../frontend/src/painel/shellLogic.ts";

const ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "COURIER"];
const ctx = (extra = {}) => ({ role: "OWNER", planBlocked: false, hasPlanTab: true, platformAdmin: false, ...extra });

// ---------------------------------------------------------------- a chave

test("a chave nasce desligada: sem parâmetro, sem marca no aparelho e sem build ligado, abre o painel antigo", () => {
  assert.deepEqual(readFlag("", null), { on: false, remember: null });
  assert.deepEqual(readFlag("?empresa=casa&painel=1", undefined, undefined), { on: false, remember: null });
  assert.deepEqual(readFlag("?empresa=casa&painel=1", "", ""), { on: false, remember: null });
  assert.equal(FLAG_KEY, "vem_painel_novo");
});

test("?novo=1 liga e o aparelho lembra; ?novo=0 desliga e o aparelho esquece; o parâmetro vale mais que a lembrança", () => {
  assert.deepEqual(readFlag("?painel=1&novo=1", null), { on: true, remember: "1" });
  assert.deepEqual(readFlag("?painel=1&novo=1", "0"), { on: true, remember: "1" });
  assert.deepEqual(readFlag("?painel=1&novo=0", "1", "1"), { on: false, remember: "0" });
});

test("sem parâmetro vale o que o aparelho lembrou; sem lembrança, o que o build marcou; lixo no parâmetro não liga nada", () => {
  assert.deepEqual(readFlag("?painel=1", "1"), { on: true, remember: null });
  assert.deepEqual(readFlag("?painel=1", "0", "1"), { on: false, remember: null });
  assert.deepEqual(readFlag("?painel=1", null, "1"), { on: true, remember: null });
  assert.deepEqual(readFlag("?painel=1", null, " 1 "), { on: true, remember: null });
  for (const junk of ["?novo=", "?novo=sim", "?novo=true", "?novo=2", "?Novo=1"]) {
    assert.deepEqual(readFlag(junk, null), { on: false, remember: null }, junk);
  }
  assert.equal(readFlag("?painel=1", null, "0").on, false);
  assert.equal(readFlag("?painel=1", null, "true").on, false);
});

// ---------------------------------------------------------------- quem abre o quê

test("a lista de telas permitidas só tem telas do menu, e o dono do sistema abre todas, na ordem do menu", () => {
  for (const role of ROLES) {
    for (const platformAdmin of [false, true]) {
      for (const hasPlanTab of [false, true]) {
        const allowed = allowedViews(ctx({ role, platformAdmin, hasPlanTab }));
        const expected = menuViews().filter((view) => {
          if (["aprovacoes", "assinaturas", "ajuda"].includes(view)) return platformAdmin;
          if (view === "plano") return hasPlanTab;
          return true;
        });
        // o catálogo também tem regras por papel: o que o menu não mostra ao papel não entra
        for (const view of allowed) assert.ok(expected.includes(view), `${role}: ${view} não devia abrir`);
      }
    }
  }
  assert.deepEqual(allowedViews(ctx({ platformAdmin: true })), menuViews(), "o dono do sistema abre todas as telas, na ordem do menu");
});

test("cada papel abre só o que o menu mostra a ele", () => {
  const kitchen = allowedViews(ctx({ role: "KITCHEN", hasPlanTab: false }));
  assert.ok(kitchen.includes("pedidos") && kitchen.includes("produtos"));
  for (const view of ["entregas", "acerto", "assistente", "custos", "pagamento", "marca", "usuarios", "mesa"]) {
    assert.ok(!kitchen.includes(view), `a cozinha não abre ${view}`);
  }
  const waiter = allowedViews(ctx({ role: "WAITER", hasPlanTab: false }));
  assert.ok(waiter.includes("mesa") && waiter.includes("mesas"));
  assert.ok(!waiter.includes("acerto") && !waiter.includes("usuarios") && !waiter.includes("assistente"));
  const cashier = allowedViews(ctx({ role: "CASHIER", hasPlanTab: false }));
  assert.ok(cashier.includes("acerto") && cashier.includes("mesa") && !cashier.includes("entregas"));
  assert.ok(allowedViews(ctx({ role: "OWNER" })).includes("usuarios"));
  assert.ok(!allowedViews(ctx({ role: "MANAGER" })).includes("usuarios"), "equipe é só do dono");
});

test("restaurante bloqueado abre só Pedidos, Entregas, Acerto e Plano", () => {
  const owner = allowedViews(ctx({ planBlocked: true }));
  assert.deepEqual(owner, ["pedidos", "entregas", "acerto", "plano"]);
  assert.deepEqual(allowedViews(ctx({ role: "WAITER", planBlocked: true, hasPlanTab: false })), ["pedidos"]);
});

test("pedir uma tela que o menu não mostra leva ao Hoje; bloqueado, leva ao Plano (ou aos Pedidos se não houver Plano)", () => {
  assert.equal(shownView("produtos", ctx()), "produtos");
  assert.equal(shownView("usuarios", ctx({ role: "MANAGER" })), "inicio");
  assert.equal(shownView("acerto", ctx({ role: "KITCHEN" })), "inicio");
  assert.equal(shownView("aprovacoes", ctx({ platformAdmin: false })), "inicio");
  assert.equal(shownView("aprovacoes", ctx({ platformAdmin: true })), "aprovacoes");
  assert.equal(shownView("coisa-que-nao-existe", ctx()), "inicio");
  assert.equal(shownView("produtos", ctx({ planBlocked: true })), "plano");
  assert.equal(shownView("inicio", ctx({ planBlocked: true })), "plano");
  assert.equal(shownView("pedidos", ctx({ planBlocked: true })), "pedidos");
  assert.equal(shownView("produtos", ctx({ planBlocked: true, hasPlanTab: false })), "pedidos");
});

test("a primeira tela é o Hoje; bloqueado, o Plano", () => {
  assert.equal(firstView({ planBlocked: false }), "inicio");
  assert.equal(firstView({ planBlocked: true }), "plano");
});

// ---------------------------------------------------------------- qual tela desenha cada nome

test("todo nome do menu tem uma tela, e a tela é nova ou antiga, nunca nenhuma", () => {
  const known = new Set(knownViews());
  for (const view of menuViews()) {
    assert.ok(known.has(view), `${view} está no menu mas o painel não sabe desenhar`);
    for (const role of ROLES) {
      const screen = screenOf(view, role);
      assert.ok(screen.kind === "new" || screen.kind === "old", `${role} ${view}`);
      assert.ok(typeof screen.id === "string" && screen.id, `${role} ${view}`);
    }
  }
  for (const view of known) assert.ok(menuViews().includes(view), `${view} não existe no menu`);
});

test("as telas novas são as das rodadas feitas; o resto ainda é a antiga", () => {
  const fresh = {
    inicio: "today",
    pedidos: "orders",
    mesa: "desk",
    entregas: "deliveries",
    acerto: "settle",
    assistente: "setup",
    produtos: "dishes",
    categorias: "categories",
    marca: "logo",
  };
  for (const [view, id] of Object.entries(fresh)) assert.deepEqual(screenOf(view, "OWNER"), { kind: "new", id }, view);
  const old = {
    custos: "costs",
    pagamento: "pix",
    meulink: "link",
    horario: "hours",
    entrega: "zones",
    usuarios: "team",
    plano: "plan",
    aprovacoes: "approvals",
    assinaturas: "subscriptions",
    ajuda: "help",
  };
  for (const [view, id] of Object.entries(old)) assert.deepEqual(screenOf(view, "OWNER"), { kind: "old", id }, view);
});

test("três nomes dependem de quem olha: Pedidos, Mesas e Números", () => {
  assert.deepEqual(screenOf("pedidos", "KITCHEN"), { kind: "new", id: "kitchen" });
  assert.deepEqual(screenOf("pedidos", "kitchen"), { kind: "new", id: "kitchen" }, "o papel pode chegar em minúsculas");
  for (const role of ["OWNER", "MANAGER", "CASHIER", "WAITER"]) assert.deepEqual(screenOf("pedidos", role), { kind: "new", id: "orders" }, role);

  for (const role of ["OWNER", "MANAGER"]) assert.deepEqual(screenOf("mesas", role), { kind: "old", id: "tables" }, role);
  for (const role of ["WAITER", "CASHIER", "KITCHEN"]) assert.deepEqual(screenOf("mesas", role), { kind: "new", id: "desk" }, role);

  for (const role of ["OWNER", "MANAGER"]) assert.deepEqual(screenOf("dashboard", role), { kind: "old", id: "business" }, role);
  for (const role of ["WAITER", "CASHIER", "KITCHEN"]) assert.deepEqual(screenOf("dashboard", role), { kind: "old", id: "summary" }, role);
});

test("nome desconhecido abre o Hoje, nunca uma tela em branco", () => {
  assert.deepEqual(screenOf("", "OWNER"), { kind: "new", id: "today" });
  assert.deepEqual(screenOf("xyz", "WAITER"), { kind: "new", id: "today" });
  assert.deepEqual(screenOf("inicio", null), { kind: "new", id: "today" });
});

// ---------------------------------------------------------------- a primeira vez

test("o dono que entra pela primeira vez e tem o cardápio vazio vai direto ao Assistente", () => {
  const base = { role: "OWNER", seen: false, planBlocked: false, products: 0 };
  assert.equal(ownerStartView(base), "assistente");
  assert.equal(ownerStartView({ ...base, products: 12 }), "inicio");
  assert.equal(ownerStartView({ ...base, seen: true }), "inicio", "quem já passou por aqui não é levado de novo");
});

test("sem resposta do servidor nunca se conclui cardápio vazio; gerente e equipe não são levados ao Assistente", () => {
  assert.equal(ownerStartView({ role: "OWNER", seen: false, planBlocked: false, products: null }), "inicio");
  for (const role of ["MANAGER", "WAITER", "KITCHEN", "CASHIER", null, undefined]) {
    assert.equal(ownerStartView({ role, seen: false, planBlocked: false, products: 0 }), "inicio", String(role));
  }
});

test("restaurante bloqueado: a primeira tela é o Plano, mesmo na primeira vez", () => {
  assert.equal(ownerStartView({ role: "OWNER", seen: false, planBlocked: true, products: 0 }), "plano");
});

// ---------------------------------------------------------------- o que o painel pergunta sozinho

test("os intervalos são os de sempre do painel antigo: pedidos a cada 5 s e mesas a cada 6 s", () => {
  assert.equal(ORDERS_WATCH_MS, 5000);
  assert.equal(CALLS_WATCH_MS, 6000);
});

test("o painel só olha os pedidos quando a tela da vez não olha (ou quando o menu aberto precisa do número)", () => {
  const closed = (view, role = "OWNER") => watchOrders({ view, role, menuOpen: false });
  assert.equal(closed("inicio"), false, "o Hoje já busca os pedidos");
  assert.equal(closed("pedidos"), false, "Pedidos já busca");
  assert.equal(closed("pedidos", "KITCHEN"), false, "a cozinha já busca");
  for (const view of ["produtos", "categorias", "mesa", "entregas", "acerto", "assistente", "marca", "custos", "plano", "usuarios"]) {
    assert.equal(closed(view), true, `${view} não busca pedidos, então o painel olha`);
  }
  assert.equal(watchOrders({ view: "inicio", role: "OWNER", menuOpen: true }), true, "o menu aberto mostra o número de pedidos em aberto");
  assert.equal(watchOrders({ view: "pedidos", role: "WAITER", menuOpen: true }), true);
});

test("o entregador não recebe o aviso de pedido novo, então o painel não olha os pedidos para ele", () => {
  assert.equal(watchOrders({ view: "produtos", role: "COURIER", menuOpen: true }), false);
  assert.equal(watchOrders({ view: "produtos", role: null, menuOpen: true }), false);
});

test("o painel olha as mesas que chamam só para quem vai a uma mesa, e não na tela de Abrir mesa (que apita sozinha)", () => {
  for (const role of ["OWNER", "MANAGER", "WAITER", "CASHIER"]) {
    assert.equal(watchCalls({ view: "produtos", role }), true, role);
    assert.equal(watchCalls({ view: "inicio", role }), true, `${role}: o Hoje mostra os chamados mas não apita`);
    assert.equal(watchCalls({ view: "mesa", role }), false, role);
  }
  assert.equal(watchCalls({ view: "mesas", role: "WAITER" }), false, "para o garçom, Mesas é a mesma tela de Abrir mesa");
  assert.equal(watchCalls({ view: "mesas", role: "OWNER" }), true, "para o dono, Mesas é o cadastro de QR, que não apita");
  for (const role of ["KITCHEN", "COURIER", null]) assert.equal(watchCalls({ view: "produtos", role }), false, String(role));
});

// ---------------------------------------------------------------- os avisos

const notice = (extra = {}) => noticesOf({ view: "produtos", role: "OWNER", plan: null, newOrder: false, calls: 0, ...extra });

test("sem nada a dizer, nenhum aviso", () => {
  assert.deepEqual(notice(), []);
});

test("o aviso do plano usa o texto que o servidor escreveu e leva ao Plano; bloqueado é urgente", () => {
  const [soon] = notice({ plan: { kind: "soon", text: "Seu plano vence em 3 dias." } });
  assert.deepEqual(soon, { id: "plan", tone: "info", text: "Seu plano vence em 3 dias.", action: "Ver plano", view: "plano" });
  assert.equal(notice({ plan: { kind: "today", text: "Vence hoje." } })[0].tone, "warn");
  assert.equal(notice({ plan: { kind: "blocked", text: "Bloqueado." } })[0].tone, "urgent");
});

test("pedido novo avisa e leva aos Pedidos; na tela de Pedidos o aviso some; o entregador não recebe", () => {
  assert.deepEqual(notice({ newOrder: true }), [
    { id: "order", tone: "warn", text: "Chegou um novo pedido.", action: "Ver pedidos", view: "pedidos" },
  ]);
  assert.deepEqual(notice({ newOrder: true, view: "pedidos" }), []);
  assert.deepEqual(notice({ newOrder: true, role: "COURIER" }), []);
});

test("mesa chamando avisa em qualquer tela menos Hoje e Abrir mesa, só para quem vai a uma mesa", () => {
  assert.deepEqual(notice({ calls: 1 }), [{ id: "calls", tone: "urgent", text: "1 mesa chamando", action: "Atender", view: "mesa" }]);
  assert.equal(notice({ calls: 3 })[0].text, "3 mesas chamando");
  assert.deepEqual(notice({ calls: 2, view: "mesa" }), []);
  assert.deepEqual(notice({ calls: 2, view: "inicio" }), []);
  assert.deepEqual(notice({ calls: 2, role: "KITCHEN" }), []);
});

test("vários avisos vêm do mais grave ao menos: plano, pedido novo, mesas", () => {
  const all = notice({ plan: { kind: "soon", text: "Vence logo." }, newOrder: true, calls: 2 });
  assert.deepEqual(all.map((item) => item.id), ["plan", "order", "calls"]);
  for (const item of all) assert.ok(menuViews().includes(item.view), `${item.view} não existe no menu`);
});
