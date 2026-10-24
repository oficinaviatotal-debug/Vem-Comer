import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { menuFor, menuViews } from "../../frontend/src/nav/navLogic.ts";
import { ACTION, PLACE_FALLBACK, actionsOf, badgeSpoken, menuViewOf } from "../../frontend/src/painel/menuLogic.ts";

const base = (extra = {}) => ({
  role: "OWNER",
  allowed: () => true,
  hasPlanTab: true,
  platformAdmin: true,
  openOrders: 3,
  helpCount: 2,
  approvalsCount: 1,
  current: "inicio",
  place: "Açaí do João",
  personName: "João",
  canHelp: true,
  newPanel: true,
  ...extra,
});
const viewsOf = (menu) => menu.groups.flatMap((group) => group.items.map((item) => item.view));
const labelsOf = (menu) => menu.groups.flatMap((group) => group.items.map((item) => item.label));

test("o dono vê as telas de sempre, na ordem de sempre, em seis grupos", () => {
  const menu = menuViewOf(base());
  assert.deepEqual(menu.groups.map((group) => group.key), ["hoje", "vender", "cardapio", "numeros", "loja", "plataforma"]);
  assert.deepEqual(menu.groups.map((group) => group.title), [null, "Vender", "Cardápio", "Números", "Minha loja", "Dono do sistema"]);
  assert.deepEqual(viewsOf(menu), menuViews(), "o dono do sistema vê todas as telas do catálogo, na ordem do catálogo");
});

test("o menu novo é o menu antigo com outro desenho: cada papel vê exatamente o que as regras de sempre dizem", () => {
  for (const role of ["OWNER", "MANAGER", "WAITER", "CASHIER", "KITCHEN", "COURIER", null]) {
    for (const platformAdmin of [false, true]) {
      for (const hasPlanTab of [false, true]) {
        const input = base({ role, platformAdmin, hasPlanTab });
        const old = menuFor(input);
        const menu = menuViewOf(input);
        assert.deepEqual(
          menu.groups.map((group) => [group.key, group.items.map((item) => [item.view, item.label, item.hint, item.badge])]),
          old.map((group) => [group.key, group.items.map((item) => [item.view, item.label, item.hint, item.badge])]),
          `${role} admin=${platformAdmin} plano=${hasPlanTab}`,
        );
      }
    }
  }
});

test("garçom, caixa e cozinha só veem o que lhes cabe; o resto do menu nem aparece", () => {
  const waiter = viewsOf(menuViewOf(base({ role: "WAITER", platformAdmin: false, hasPlanTab: false })));
  assert.deepEqual(waiter, ["inicio", "pedidos", "mesa", "mesas", "produtos", "categorias", "dashboard"]);
  const cashier = viewsOf(menuViewOf(base({ role: "CASHIER", platformAdmin: false, hasPlanTab: false })));
  assert.ok(cashier.includes("acerto") && cashier.includes("mesa"));
  assert.ok(!cashier.includes("usuarios") && !cashier.includes("custos") && !cashier.includes("assistente"));
  const kitchen = viewsOf(menuViewOf(base({ role: "KITCHEN", platformAdmin: false, hasPlanTab: false })));
  assert.ok(!kitchen.includes("mesa") && !kitchen.includes("entregas") && !kitchen.includes("acerto"));
  assert.equal(labelsOf(menuViewOf(base({ role: "WAITER", platformAdmin: false }))).includes("Resumo"), true, "quem não é gerente vê 'Resumo', não 'Seu negócio'");
  assert.equal(labelsOf(menuViewOf(base({ role: "MANAGER" }))).includes("Seu negócio"), true);
});

test("o que é do dono do sistema e o plano só aparecem para quem tem direito", () => {
  const plain = viewsOf(menuViewOf(base({ platformAdmin: false, hasPlanTab: false })));
  for (const view of ["aprovacoes", "assinaturas", "ajuda", "plano"]) assert.ok(!plain.includes(view), view);
  const withPlan = viewsOf(menuViewOf(base({ platformAdmin: false, hasPlanTab: true })));
  assert.ok(withPlan.includes("plano") && !withPlan.includes("aprovacoes"));
});

test("restaurante bloqueado por falta de pagamento mantém só o que é permitido", () => {
  const menu = menuViewOf(base({ platformAdmin: false, allowed: (view) => ["pedidos", "plano"].includes(view) }));
  assert.deepEqual(viewsOf(menu), ["pedidos", "plano"]);
});

test("a tela de agora vem marcada, só uma; tela que o menu não tem não marca nada", () => {
  const marked = (menu) => menu.groups.flatMap((group) => group.items.filter((item) => item.current).map((item) => item.view));
  assert.deepEqual(marked(menuViewOf(base({ current: "inicio" }))), ["inicio"]);
  assert.deepEqual(marked(menuViewOf(base({ current: "mesas" }))), ["mesas"]);
  assert.deepEqual(marked(menuViewOf(base({ current: "nao-existe" }))), []);
});

test("o número aparece em Pedidos, Chamados e Aprovações, com frase para o leitor de tela", () => {
  const items = Object.fromEntries(menuViewOf(base()).groups.flatMap((group) => group.items.map((item) => [item.view, item])));
  assert.equal(items.pedidos.badge, 3);
  assert.equal(items.pedidos.badgeSpoken, "3 em aberto");
  assert.equal(items.ajuda.badge, 2);
  assert.equal(items.ajuda.badgeSpoken, "2 em aberto");
  assert.equal(items.aprovacoes.badge, 1);
  assert.equal(items.aprovacoes.badgeSpoken, "1 esperando o seu aval");
  assert.equal(items.mesas.badge, null);
  assert.equal(items.mesas.badgeSpoken, "");
  const none = Object.fromEntries(menuViewOf(base({ openOrders: 0, helpCount: null, approvalsCount: null })).groups.flatMap((group) => group.items.map((item) => [item.view, item])));
  assert.equal(none.pedidos.badge, null, "sem pedido em aberto, sem número");
  assert.equal(badgeSpoken("pedidos", 12), "12 em aberto");
});

test("o topo diz o restaurante e quem está dentro, e some a linha de quem ainda não carregou", () => {
  assert.equal(menuViewOf(base({ personName: "Maria", role: "MANAGER" })).person, "Maria, Gerente");
  assert.equal(menuViewOf(base({ personName: "João", role: "OWNER" })).person, "João, Dono");
  assert.equal(menuViewOf(base({ personName: "Ana", role: "COURIER" })).person, "Ana, Entregador");
  assert.equal(menuViewOf(base({ personName: null })).person, "");
  assert.equal(menuViewOf(base({ personName: "   " })).person, "");
  assert.equal(menuViewOf(base()).place, "Açaí do João");
  assert.equal(menuViewOf(base({ place: "" })).place, PLACE_FALLBACK);
  assert.equal(menuViewOf(base({ place: null })).place, "Meu restaurante");
});

test("fora das telas: ver o cardápio do cliente e Sair sempre; ajuda só quem pode; Sair por último e discreto", () => {
  const ids = (menu) => menu.actions.map((action) => action.id);
  assert.deepEqual(ids(menuViewOf(base({ canHelp: true }))), [ACTION.customer, ACTION.help, ACTION.logout]);
  assert.deepEqual(ids(menuViewOf(base({ canHelp: false }))), [ACTION.customer, ACTION.logout]);
  assert.deepEqual(ids(menuViewOf(base({ canHelp: undefined }))), [ACTION.customer, ACTION.logout]);
  const logout = actionsOf({ canHelp: true }).at(-1);
  assert.equal(logout.id, ACTION.logout);
  assert.equal(logout.quiet, true);
  assert.equal(logout.label, "Sair");
  assert.equal(actionsOf({}).find((action) => action.id === ACTION.customer).label, "Ver o cardápio do cliente");
});

test("todo ícone que o menu pode pedir existe no conjunto de ícones novo (senão a linha fica sem desenho)", () => {
  const icons = readFileSync(new URL("../../frontend/src/novo/Icons.tsx", import.meta.url), "utf8");
  const declared = new Set([...icons.matchAll(/^  \| "(\w+)"/gm)].map((match) => match[1]));
  declared.add("menu");
  const used = new Set();
  for (const role of ["OWNER", "MANAGER", "WAITER", "CASHIER", "KITCHEN", "COURIER"]) {
    const menu = menuViewOf(base({ role }));
    for (const group of menu.groups) for (const item of group.items) used.add(item.icon);
    for (const action of menu.actions) used.add(action.icon);
  }
  assert.ok(used.size > 15, "o teste olha vários ícones");
  for (const name of used) assert.ok(declared.has(name), `falta o ícone ${name}`);
  for (const name of declared) assert.ok(new RegExp(`^  ${name}: `, "m").test(icons) || name === "menu", `o ícone ${name} está no tipo mas sem desenho`);
});

test("nenhum texto do menu é palavra de jargão: o dono lê o que cada função faz em português simples", () => {
  const banned = /\b(dashboard|checkout|onboarding|template|upload|click here|backend|login|painel de controle)\b/i;
  for (const role of ["OWNER", "MANAGER", "WAITER", "CASHIER", "KITCHEN"]) {
    const menu = menuViewOf(base({ role }));
    const texts = [menu.place, menu.person, ...menu.groups.flatMap((group) => [group.title ?? "", ...group.items.flatMap((item) => [item.label, item.hint, item.badgeSpoken])]), ...menu.actions.map((action) => action.label)];
    for (const text of texts) assert.ok(!banned.test(text), `${role}: "${text}"`);
  }
});
