import test from "node:test";
import assert from "node:assert/strict";

import { ticketOf } from "../../frontend/src/cozinha/kitchenLogic.ts";
import {
  CLOCK_MS,
  DONE_LIMIT,
  ORDERS_CHANGED,
  ORDERS_POLL_MS,
  canReceive,
  cardOf,
  changeText,
  firstTab,
  moveCheck,
  nextStatusOf,
  ordersOfTab,
  ordersTabs,
  ordersViewOf,
  payCheck,
  seesContact,
  subOf,
  tabIdsFor,
} from "../../frontend/src/painel/ordersLogic.ts";

const NOW = 1_800_000_000_000;
/** O dinheiro sai com espaço que não quebra linha ("R$\u00a050,00"): bom na tela, e aqui comparamos com espaço comum. */
const n = (text) => String(text).replace(/\u00a0/g, " ");
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();

let counter = 0;
const order = (extra = {}) => {
  counter += 1;
  return {
    id: `${String(1000 + counter)}-ped`,
    customer_name: "Maria",
    status: "PENDING_PAYMENT",
    created_at: ago(5),
    order_type: "mesa",
    table_number: "4",
    total_price: 42,
    payment_method: "dinheiro",
    payment_status: "PENDING",
    payment_change: 0,
    items: [{ name: "Açaí 500 ml", quantity: 2 }],
    ...extra,
  };
};
const delivery = (extra = {}) =>
  order({
    order_type: "entrega",
    table_number: null,
    delivery_fee: 6,
    delivery_zone: "Centro",
    delivery_address: { street: "Rua das Flores", number: "120", complement: "apto 3", neighborhood: "Centro", cep: "59000000", reference: "Portão azul" },
    customer_phone: "84999998888",
    total_price: 48,
    ...extra,
  });

test("o ritmo: pergunta a cada 5 s (como a tela antiga e a cozinha) e o relógio anda a cada 30 s; encerrados são os 20 mais novos", () => {
  assert.equal(ORDERS_POLL_MS, 5000);
  assert.equal(CLOCK_MS, 30000);
  assert.equal(DONE_LIMIT, 20);
});

test("quem recebe dinheiro (dono, gerente, caixa) tem quatro etapas; garçom e cozinha têm três, sem a aba Receber", () => {
  for (const role of ["OWNER", "MANAGER", "CASHIER"]) {
    assert.deepEqual(tabIdsFor(role), ["new", "doing", "receive", "done"], role);
    assert.equal(canReceive(role), true, role);
  }
  for (const role of ["WAITER", "KITCHEN", "COURIER", "", null, undefined, "xyz"]) {
    assert.deepEqual(tabIdsFor(role), ["new", "doing", "done"], String(role));
    assert.equal(canReceive(role), false, String(role));
  }
  assert.equal(canReceive("cashier"), true, "o papel vale em minúsculas também, como na regra do servidor");
});

test("cada pedido cai na etapa certa: aguardando é Novo; preparo, pronto e a caminho são Andamento; entregue e pago é Feito", () => {
  const list = [
    order({ id: "n1", status: "PENDING_PAYMENT" }),
    order({ id: "d1", status: "em preparo" }),
    delivery({ id: "d2", status: "pronto" }),
    delivery({ id: "d3", status: "saiu para entrega" }),
    order({ id: "f1", status: "concluido", payment_status: "PAID" }),
  ];
  const ids = (tab, role = "OWNER") => ordersOfTab(list, tab, role).map((o) => o.id).sort();
  assert.deepEqual(ids("new"), ["n1"]);
  assert.deepEqual(ids("doing"), ["d1", "d2", "d3"]);
  assert.deepEqual(ids("done"), ["f1"]);
  assert.deepEqual(ids("receive"), ["d1", "d2", "d3", "n1"], "tudo que ainda não foi pago, em qualquer etapa");
});

test("pedido entregue e ainda não pago fica em Receber para quem recebe, e em Feitos para quem não tem a aba Receber (nunca some)", () => {
  const list = [order({ id: "u1", status: "concluido", payment_status: "PENDING" }), order({ id: "p1", status: "concluido", payment_status: "PAID" })];
  assert.deepEqual(ordersOfTab(list, "done", "CASHIER").map((o) => o.id), ["p1"]);
  assert.deepEqual(ordersOfTab(list, "receive", "CASHIER").map((o) => o.id), ["u1"]);
  assert.deepEqual(ordersOfTab(list, "done", "WAITER").map((o) => o.id).sort(), ["p1", "u1"]);
});

test("um estado que o painel não conhece continua à vista em Andamento, sem botão: um pedido nunca some da tela", () => {
  const strange = order({ id: "x1", status: "estado novo do servidor" });
  assert.deepEqual(ordersOfTab([strange], "doing", "OWNER").map((o) => o.id), ["x1"]);
  const card = cardOf(strange, "OWNER", NOW);
  assert.equal(card.action, "");
  assert.equal(card.skip, "");
  assert.equal(card.status, "estado novo do servidor");
});

test("quem esperou mais vem primeiro; nos Feitos o mais novo vem primeiro e só os 20 mais novos aparecem", () => {
  const open = [order({ id: "b", created_at: ago(5) }), order({ id: "a", created_at: ago(30) }), order({ id: "c", created_at: ago(12) })];
  assert.deepEqual(ordersOfTab(open, "new", "OWNER").map((o) => o.id), ["a", "c", "b"]);
  const done = Array.from({ length: 25 }, (_, i) => order({ id: `f${i}`, status: "concluido", payment_status: "PAID", created_at: ago(100 + i) }));
  const shown = ordersOfTab(done, "done", "OWNER");
  assert.equal(shown.length, 20);
  assert.equal(shown[0].id, "f0", "o mais novo primeiro");
  assert.equal(shown[19].id, "f19");
  assert.equal(ordersOfTab([order({ created_at: "data estragada" })], "new", "OWNER").length, 1, "data estragada não derruba nem esconde");
});

test("as abas mostram quantos pedidos há em cada uma, na ordem Novos, Andamento, Receber, Feitos", () => {
  const list = [order({ status: "PENDING_PAYMENT" }), order({ status: "em preparo" }), order({ status: "em preparo", payment_status: "PAID" })];
  const tabs = ordersTabs(list, "OWNER");
  assert.deepEqual(tabs.map((t) => [t.id, t.label, t.count]), [
    ["new", "Novos", 1],
    ["doing", "Andamento", 2],
    ["receive", "Receber", 2],
    ["done", "Feitos", 0],
  ]);
  assert.deepEqual(ordersTabs(list, "WAITER").map((t) => t.id), ["new", "doing", "done"]);
});

test("a etapa que abre sozinha: o caixa começa pelo dinheiro a receber, os outros pelo pedido novo; sem pedido nenhum, Novos", () => {
  const list = [order({ status: "PENDING_PAYMENT" }), order({ status: "em preparo" })];
  assert.equal(firstTab(list, "CASHIER"), "receive");
  assert.equal(firstTab(list, "OWNER"), "new");
  assert.equal(firstTab([list[1]], "OWNER"), "doing");
  assert.equal(firstTab([], "CASHIER"), "new");
  assert.equal(firstTab(list, "WAITER"), "new");
  const onlyUnpaidDone = [order({ status: "concluido", payment_status: "PENDING" })];
  assert.equal(firstTab(onlyUnpaidDone, "CASHIER"), "receive");
  assert.notEqual(firstTab(onlyUnpaidDone, "WAITER"), "receive", "quem não tem a aba Receber nunca cai nela");
});

test("a etapa tocada vale; se não existe para este papel, abre a primeira com pedido", () => {
  const list = [order({ status: "PENDING_PAYMENT" }), order({ status: "em preparo" })];
  assert.equal(ordersViewOf({ orders: list, role: "OWNER", now: NOW, chosen: "doing" }).active, "doing");
  assert.equal(ordersViewOf({ orders: list, role: "WAITER", now: NOW, chosen: "receive" }).active, "new");
  assert.equal(ordersViewOf({ orders: list, role: "OWNER", now: NOW, chosen: "inventada" }).active, "new");
  assert.equal(ordersViewOf({ orders: list, role: "OWNER", now: NOW, chosen: null }).active, "new");
});

test("a frase de cima diz quantos esperam aceite, depois quantos andam, ou que está tudo quieto", () => {
  assert.equal(subOf([]), "Nenhum pedido agora");
  assert.equal(subOf([order({ status: "concluido" })]), "Nenhum pedido agora");
  assert.equal(subOf([order({ status: "PENDING_PAYMENT" })]), "1 pedido novo para aceitar");
  assert.equal(subOf([order(), order()]), "2 pedidos novos para aceitar");
  assert.equal(subOf([order({ status: "em preparo" })]), "1 pedido em andamento");
  assert.equal(subOf([order({ status: "em preparo" }), order({ status: "pronto", order_type: "entrega" })]), "2 pedidos em andamento");
});

test("a etapa vazia diz o que fazer ou esperar, em frase inteira", () => {
  const view = ordersViewOf({ orders: [], role: "OWNER", now: NOW });
  assert.equal(view.cards.length, 0);
  assert.match(view.empty, /\.$/);
  for (const chosen of ["new", "doing", "receive", "done"]) {
    assert.match(ordersViewOf({ orders: [], role: "OWNER", now: NOW, chosen }).empty, /\.$/, chosen);
  }
});

// ------------------------------------------------------------------------------------------------ dinheiro e troco

test("troco: diz com quanto o cliente paga e quanto devolver; igual ao total é 'sem troco'; pago, outro meio ou valor estranho não mostram nada", () => {
  const cash = (extra) => order({ total_price: 42, payment_method: "dinheiro", payment_status: "PENDING", ...extra });
  assert.equal(n(changeText(cash({ payment_change: 50 }))), "Cliente paga com R$ 50,00 · devolver R$ 8,00");
  assert.equal(n(changeText(cash({ payment_change: "100.00", total_price: "59.80" }))), "Cliente paga com R$ 100,00 · devolver R$ 40,20");
  assert.equal(n(changeText(cash({ payment_change: 42 }))), "Cliente paga com R$ 42,00 · sem troco");
  assert.equal(changeText(cash({ payment_change: 50, payment_status: "PAID" })), "", "já recebido: nada a devolver");
  assert.equal(changeText(cash({ payment_change: 0 })), "");
  assert.equal(changeText(cash({ payment_change: null })), "");
  assert.equal(changeText(cash({ payment_change: "abc" })), "");
  assert.equal(changeText(cash({ payment_change: -5 })), "");
  assert.equal(changeText(order({ payment_method: "pix", payment_change: 50 })), "", "só dinheiro tem troco");
  assert.equal(changeText(order({ payment_method: "cartao", payment_change: 50 })), "");
});

test("o total, a taxa de entrega e o que o chip de pagamento diz vêm do que o servidor gravou", () => {
  const card = cardOf(delivery({ total_price: 48, delivery_fee: 6, payment_method: "pix", payment_status: "PENDING" }), "OWNER", NOW);
  assert.equal(n(card.total), "R$ 48,00");
  assert.equal(n(card.split), "Itens R$ 42,00 + entrega R$ 6,00");
  assert.equal(card.pay.chip, "Pix: aguardando");
  assert.equal(card.pay.chipTone, "wait");
  const paid = cardOf(order({ payment_method: "pix", payment_status: "PAID" }), "OWNER", NOW);
  assert.equal(paid.pay.chip, "Pix pago");
  assert.equal(paid.pay.chipTone, "ok");
  assert.equal(cardOf(order({ payment_method: "cartao" }), "OWNER", NOW).pay.chip, "Cartão: receber");
  assert.equal(cardOf(order(), "OWNER", NOW).split, "", "sem taxa, sem linha extra");
  assert.equal(n(cardOf(order({ total_price: "lixo" }), "OWNER", NOW).total), "R$ 0,00");
});

test("'Pagamento recebido' só aparece para dono, gerente e caixa, e só enquanto não está pago", () => {
  const unpaid = order({ payment_status: "PENDING" });
  for (const role of ["OWNER", "MANAGER", "CASHIER"]) assert.equal(cardOf(unpaid, role, NOW).receive, "Pagamento recebido", role);
  for (const role of ["WAITER", "KITCHEN", "COURIER", null]) assert.equal(cardOf(unpaid, role, NOW).receive, "", String(role));
  assert.equal(cardOf(order({ payment_status: "PAID" }), "OWNER", NOW).receive, "");
  assert.equal(cardOf(order({ payment_status: "paid" }), "OWNER", NOW).receive, "", "PAID em minúsculas também conta como pago");
  assert.equal(cardOf(order({ payment_status: undefined }), "OWNER", NOW).receive, "Pagamento recebido", "sem registro de pagamento ainda é a receber, como na tela antiga");
});

// ------------------------------------------------------------------------------------------------ o pedido na tela

test("o cartão de mesa traz mesa, nome, código curto, etapa, itens com escolhas e a observação", () => {
  const card = cardOf(
    order({
      id: "a1b2-xyz",
      customer_name: "  Dona   Lúcia ",
      table_number: "4",
      items: [
        { name: "Açaí 500 ml", quantity: 2, options: [{ name: "granola" }, { name: "banana", price: 2 }], note: "sem leite condensado" },
        { name: "Suco de caju", quantity: 1 },
      ],
    }),
    "OWNER",
    NOW,
  );
  assert.equal(card.where, "Mesa 4");
  assert.equal(card.kind, "mesa");
  assert.equal(card.who, "Dona Lúcia");
  assert.equal(card.number, "#A1B2");
  assert.equal(card.status, "Aguardando");
  assert.equal(card.tone, "wait");
  assert.deepEqual(card.lines, [
    { qty: 2, name: "Açaí 500 ml", detail: "granola, banana" },
    { qty: 1, name: "Suco de caju", detail: undefined },
  ]);
  assert.equal(card.note, "Açaí 500 ml: sem leite condensado");
  assert.equal(card.ship, null, "mesa não tem endereço");
});

test("as linhas do pedido são as mesmas da comanda da cozinha (quem cozinha e quem cobra leem a mesma coisa)", () => {
  const o = order({ items: [{ name: "X-Burguer", quantity: 3, options: [{ name: "bacon" }], note: "um sem cebola" }, { name: "Batata", quantity: 0 }] });
  const ticket = ticketOf(o, NOW);
  const card = cardOf(o, "OWNER", NOW);
  assert.deepEqual(card.lines, ticket.lines);
  assert.equal(card.note, ticket.note);
});

test("'Cliente Balcão' não aparece como nome; sem nome o cartão só traz o código", () => {
  assert.equal(cardOf(order({ customer_name: "Cliente Balcão" }), "OWNER", NOW).who, "");
  assert.equal(cardOf(order({ customer_name: "   " }), "OWNER", NOW).who, "");
  assert.equal(cardOf(order({ customer_name: null }), "OWNER", NOW).who, "");
});

test("a espera: verde até 10 min, amarela até 20, vermelha depois; pedido encerrado não pinta espera", () => {
  assert.equal(cardOf(order({ created_at: ago(3) }), "OWNER", NOW).wait, "ok");
  assert.equal(cardOf(order({ created_at: ago(12) }), "OWNER", NOW).wait, "warn");
  assert.equal(cardOf(order({ created_at: ago(25) }), "OWNER", NOW).wait, "late");
  assert.equal(cardOf(order({ created_at: ago(90), status: "concluido" }), "OWNER", NOW).wait, "ok");
  assert.equal(cardOf(order({ created_at: ago(25) }), "OWNER", NOW).minutes, 25);
});

test("a entrega traz endereço, região, referência e o telefone para ligar; só quem despacha e atende vê isso", () => {
  const o = delivery();
  for (const role of ["OWNER", "MANAGER", "CASHIER", "WAITER"]) {
    assert.equal(seesContact(role), true, role);
    const ship = cardOf(o, role, NOW).ship;
    assert.equal(ship.main, "Rua das Flores, 120 · apto 3 · Centro", role);
    assert.deepEqual(ship.sub, ["CEP 59000-000 · Região Centro", "Referência: Portão azul"], role);
    assert.equal(ship.phone, "(84) 99999-8888", role);
    assert.equal(ship.phoneHref, "tel:84999998888", role);
  }
  for (const role of ["KITCHEN", "COURIER", "", null, undefined]) {
    assert.equal(seesContact(role), false, String(role));
    const ship = cardOf(o, role, NOW).ship;
    assert.equal(ship.main, "Região Centro", String(role));
    assert.deepEqual(ship.sub, []);
    assert.equal(ship.phone, "");
    assert.equal(ship.phoneHref, "");
    const everything = JSON.stringify(cardOf(o, role, NOW));
    assert.ok(!/Rua das Flores|99999|Portão|59000/.test(everything), `a cozinha não recebe endereço nem telefone (${String(role)})`);
  }
});

test("o link de telefone só leva dígitos: nada que o cliente digitou vira outro tipo de link", () => {
  for (const phone of ["84 99999-8888; javascript:alert(1)", "tel:+55 (84) 9 9999-8888", "<script>alert(1)</script>", "javascript:alert(1)", "   ", null, undefined, "123"]) {
    const href = cardOf(delivery({ customer_phone: phone }), "OWNER", NOW).ship.phoneHref;
    assert.ok(href === "" || /^tel:\d{10,11}$/.test(href), `${phone} -> ${href}`);
  }
  assert.equal(cardOf(delivery({ customer_phone: "+55 (84) 99999-8888" }), "OWNER", NOW).ship.phoneHref, "tel:84999998888");
  assert.equal(cardOf(delivery({ customer_phone: null }), "OWNER", NOW).ship.phoneHref, "");
});

test("entrega sem endereço manda ligar para o cliente; com o entregador, mostra quem leva", () => {
  const none = cardOf(delivery({ delivery_address: null }), "OWNER", NOW).ship;
  assert.equal(none.main, "Sem endereço: ligue para o cliente");
  const out = cardOf(delivery({ status: "saiu para entrega", courier_name: "Carlos" }), "OWNER", NOW).ship;
  assert.equal(out.courier, "Com o entregador Carlos");
  const done = cardOf(delivery({ status: "concluido", courier_name: "Carlos" }), "OWNER", NOW);
  assert.equal(done.ship.courier, "Entregue por Carlos");
  assert.equal(done.status, "Entregue");
  assert.equal(cardOf(order({ status: "concluido" }), "OWNER", NOW).status, "Pronto", "mesa pronta diz 'Pronto', entrega diz 'Entregue'");
});

test("retirada diz que o cliente retira no balcão; o telefone só para quem pode vê-lo", () => {
  const o = order({ order_type: "retirada", table_number: null, customer_phone: "84988887777" });
  assert.equal(cardOf(o, "OWNER", NOW).ship.main, "Cliente retira no balcão");
  assert.equal(cardOf(o, "OWNER", NOW).ship.phone, "(84) 98888-7777");
  assert.equal(cardOf(o, "OWNER", NOW).ship.phoneHref, "tel:84988887777");
  assert.equal(cardOf(o, "KITCHEN", NOW).ship.phone, "");
  assert.equal(cardOf(o, "KITCHEN", NOW).ship.phoneHref, "");
  assert.equal(cardOf(o, "OWNER", NOW).where, "Retirada");
});

// ------------------------------------------------------------------------------------------------ os botões

test("o botão grande é o próximo passo da regra do servidor; o atalho 'Já saiu para entrega' só na entrega que está em preparo", () => {
  const steps = [
    [order({ status: "PENDING_PAYMENT" }), "Aceitar pedido", ""],
    [order({ status: "em preparo" }), "Pedido pronto", ""],
    [delivery({ status: "em preparo" }), "Pronto para entrega", "Já saiu para entrega"],
    [delivery({ status: "pronto" }), "Saiu para entrega", ""],
    [delivery({ status: "saiu para entrega" }), "Entregue", ""],
    [order({ status: "concluido" }), "", ""],
  ];
  for (const [o, action, skip] of steps) {
    const card = cardOf(o, "OWNER", NOW);
    assert.equal(card.action, action, `${o.status} ${o.order_type}`);
    assert.equal(card.skip, skip, `${o.status} ${o.order_type}`);
  }
});

test("cada botão é lido com a mesa e o código do pedido, para dois 'Aceitar pedido' nunca soarem iguais", () => {
  const card = cardOf(order({ id: "a1b2-xyz", table_number: "7", customer_name: "Rafael", total_price: 31.5 }), "OWNER", NOW);
  assert.equal(card.actionSpoken, "Aceitar pedido. Mesa 7, pedido A1B2.");
  assert.equal(n(card.receiveSpoken), "Pagamento recebido. Mesa 7, Rafael, R$ 31,50.");
  const shortcut = cardOf(delivery({ id: "c3d4-xyz", status: "em preparo" }), "OWNER", NOW);
  assert.equal(shortcut.skipSpoken, "Já saiu para entrega. Entrega, pedido C3D4.");
  assert.equal(cardOf(order({ status: "concluido", payment_status: "PAID" }), "OWNER", NOW).actionSpoken, "");
  assert.ok(!/#/.test(card.actionSpoken), "o leitor não soletra o jogo da velha");
});

test("para onde o toque leva o pedido sai do que o servidor mandou, nunca do que a tela mostra", () => {
  assert.equal(nextStatusOf(order({ status: "PENDING_PAYMENT" }), "advance"), "em preparo");
  assert.equal(nextStatusOf(order({ status: "em preparo" }), "advance"), "concluido");
  assert.equal(nextStatusOf(delivery({ status: "em preparo" }), "advance"), "pronto");
  assert.equal(nextStatusOf(delivery({ status: "em preparo" }), "skip"), "saiu para entrega");
  assert.equal(nextStatusOf(delivery({ status: "pronto" }), "advance"), "saiu para entrega");
  assert.equal(nextStatusOf(delivery({ status: "saiu para entrega" }), "advance"), "concluido");
  assert.equal(nextStatusOf(order({ status: "em preparo" }), "skip"), null, "mesa não tem atalho");
  assert.equal(nextStatusOf(order({ status: "concluido" }), "advance"), null);
  assert.equal(nextStatusOf(order({ status: "coisa estranha" }), "advance"), null);
});

test("antes de mandar o toque a tela olha o pedido de novo: se mudou nesse meio tempo, não manda (o servidor aceitaria levar o pedido para trás)", () => {
  const seen = order({ id: "k1", status: "PENDING_PAYMENT" });
  assert.equal(moveCheck(seen, [{ ...seen }]), "go");
  assert.equal(moveCheck(seen, [{ ...seen, status: "em preparo" }]), "changed", "outra pessoa já aceitou");
  assert.equal(moveCheck(seen, [{ ...seen, status: "concluido" }]), "changed");
  assert.equal(moveCheck(seen, []), "changed", "o pedido saiu da lista");
  assert.equal(moveCheck(seen, [order({ id: "outro" })]), "changed");
  assert.equal(ORDERS_CHANGED, "Este pedido já mudou. A tela foi atualizada.");
});

test("'Pagamento recebido' também confere antes: se já foi pago ou sumiu, não manda de novo", () => {
  const seen = order({ id: "p9", payment_status: "PENDING" });
  assert.equal(payCheck(seen, [{ ...seen }]), "go");
  assert.equal(payCheck(seen, [{ ...seen, payment_status: "PAID" }]), "changed");
  assert.equal(payCheck(seen, [{ ...seen, status: "em preparo" }]), "go", "mudar a etapa não impede de receber");
  assert.equal(payCheck(seen, []), "changed");
});

test("a tela inteira para um caixa: abre em Receber, com o botão do dinheiro e o troco à vista", () => {
  const list = [order({ id: "c1", payment_method: "dinheiro", payment_status: "PENDING", payment_change: 50, total_price: 42, status: "em preparo" }), order({ id: "c2", payment_status: "PAID" })];
  const view = ordersViewOf({ orders: list, role: "CASHIER", now: NOW });
  assert.equal(view.active, "receive");
  assert.equal(view.cards.length, 1);
  assert.equal(view.cards[0].id, "c1");
  assert.equal(n(view.cards[0].pay.extra), "Cliente paga com R$ 50,00 · devolver R$ 8,00");
  assert.equal(view.cards[0].receive, "Pagamento recebido");
  assert.equal(view.error, "");
  assert.equal(ordersViewOf({ orders: list, role: "CASHIER", now: NOW, error: "Deu ruim." }).error, "Deu ruim.");
});
