import test from "node:test";
import assert from "node:assert/strict";

import {
  DISH_TABS,
  PERIODS,
  attentionHeadline,
  changeText,
  changeTone,
  cmvSentence,
  cmvStatus,
  compareLine,
  countText,
  dishDetail,
  dishEmpty,
  dishList,
  dishValue,
  dishWidths,
  emptyText,
  hourBars,
  hourSentence,
  isEmpty,
  minutesText,
  moneyShort,
  moneyText,
  moneyTile,
  percentText,
  personLine,
  ticketLine,
  timeNote,
  timeValue,
  updatedText,
  weekdayBars,
  weekdaySentence,
} from "../../frontend/src/business/businessLogic.ts";

const plain = (text) => text.replace(/ /g, " ");

function hours(spec) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  for (const [hour, orders, revenue] of spec) rows[hour] = { hour, orders, revenue };
  return rows;
}

function view(over = {}) {
  return {
    period: "hoje",
    label: "Hoje",
    from: "2026-10-14T03:00:00+00:00",
    to: "2026-10-14T18:00:00+00:00",
    summary: { revenue: 600, orders: 12, avg_ticket: 50, dishes: 14, delivery_fees: 0 },
    previous: { revenue: 480, orders: 12, avg_ticket: 40, dishes: 12, delivery_fees: 0 },
    compare: { enough_data: true, revenue_pct: 25, orders_pct: 0, ticket_pct: 25, against: "ontem até esta hora" },
    hours: hours([[11, 3, 150], [12, 6, 300], [13, 3, 150]]),
    peak: { hour: 12, label: "12h", orders: 6, revenue: 300 },
    weak: { hour: 11, label: "11h", orders: 3, revenue: 150 },
    weekdays: null,
    dishes: {
      by_quantity: [{ name: "Pizza · Grande", quantity: 8, revenue: 320, profit: 224, cmv: 30, cost_partial: false }],
      by_revenue: [{ name: "Pizza · Grande", quantity: 8, revenue: 320, profit: 224, cmv: 30, cost_partial: false }],
      by_profit: [{ name: "Pizza · Grande", quantity: 8, revenue: 320, profit: 224, cmv: 30, cost_partial: false }],
      cmv_real: 31.2,
      cost_coverage: 100,
      without_cost: [],
      distinct: 3,
    },
    cmv_target: 35,
    channels: [],
    payments: [],
    times: {
      kitchen: { median_min: 15, samples: 12 },
      delivery: { median_min: null, samples: 2 },
      table_call: { median_min: null, samples: 0 },
    },
    service: [],
    attention: [],
    min_samples: 5,
    ...over,
  };
}

test("the three periods are today, 7 days and 30 days, in that order", () => {
  assert.deepEqual(PERIODS.map((p) => p.key), ["hoje", "7d", "30d"]);
});

test("money is in reais with comma, and never NaN", () => {
  assert.equal(plain(moneyText(1234.5)), "R$ 1.234,50");
  assert.equal(plain(moneyText(null)), "R$ 0,00");
  assert.equal(plain(moneyText(Number.NaN)), "R$ 0,00");
  assert.equal(plain(moneyShort(1200)), "R$ 1.200");
  assert.equal(plain(moneyShort(49.9)), "R$ 49,90");
});

test("tile money keeps cents below R$ 1.000 and drops them above, so it fits a small phone", () => {
  assert.equal(plain(moneyTile(78.29)), "R$ 78,29");
  assert.equal(plain(moneyTile(999.99)), "R$ 999,99");
  assert.equal(plain(moneyTile(1234.5)), "R$ 1.235");
  assert.equal(plain(moneyTile(null)), "R$ 0,00");
});

test("counts get thousand separators", () => {
  assert.equal(countText(12345), "12.345");
  assert.equal(countText(7), "7");
  assert.equal(countText(null), "0");
});

test("percent and minutes read naturally", () => {
  assert.equal(percentText(31.2), "31,2%");
  assert.equal(percentText(null), "—");
  assert.equal(minutesText(4.5), "4,5 min");
  assert.equal(minutesText(32.4), "32 min");
});

test("change tone and text: up, down, flat and nothing to compare", () => {
  assert.equal(changeTone(25), "up");
  assert.equal(changeTone(-20), "down");
  assert.equal(changeTone(0.4), "flat");
  assert.equal(changeTone(null), "none");
  assert.equal(changeText(25), "25% a mais");
  assert.equal(changeText(-20), "20% a menos");
  assert.equal(changeText(0), "igual ao período anterior");
  assert.equal(changeText(null), "sem base para comparar");
});

test("compare line names what it is compared against, and says when it cannot", () => {
  assert.match(plain(compareLine(view())), /^25% a mais que ontem até esta hora \(R\$ 480,00\)\.$/);
  const few = view({ compare: { enough_data: false, revenue_pct: null, orders_pct: null, ticket_pct: null, against: "x" } });
  assert.match(compareLine(few), /Poucos pedidos para comparar/);
  const none = view({
    summary: { revenue: 0, orders: 0, avg_ticket: null, dishes: 0, delivery_fees: 0 },
    compare: { enough_data: false, revenue_pct: null, orders_pct: null, ticket_pct: null, against: "x" },
  });
  assert.equal(compareLine(none), "Ainda sem pedidos neste período.");
});

test("ticket line", () => {
  assert.equal(ticketLine(view()), "25% a mais que antes");
  assert.equal(ticketLine(view({ compare: { ...view().compare, enough_data: false, ticket_pct: null } })), "por pedido");
  assert.equal(ticketLine(view({ summary: { ...view().summary, avg_ticket: null } })), "Sem pedidos ainda");
});

test("hour chart: padded by one hour, strongest hour is full height, empty hours have no bar", () => {
  const view1 = view();
  const bars = hourBars(view1.hours, view1.peak, view1.weak);
  assert.equal(bars[0].hour, 10, "one hour before the first sale");
  assert.equal(bars.length, 6, "padded at the end up to six bars");
  assert.equal(bars[bars.length - 1].hour, 15);
  const peak = bars.find((b) => b.hour === 12);
  assert.equal(peak.kind, "peak");
  assert.equal(peak.height, 100);
  assert.equal(bars.find((b) => b.hour === 11).kind, "weak");
  assert.equal(bars.find((b) => b.hour === 11).height, 50);
  const empty = bars.find((b) => b.hour === 10);
  assert.equal(empty.kind, "empty");
  assert.equal(empty.height, 0);
});

test("hour chart: no sales means no chart", () => {
  assert.deepEqual(hourBars(hours([]), null, null), []);
});

test("hour chart: a tiny hour is still visible", () => {
  const rows = hours([[12, 1, 1], [13, 9, 1000]]);
  assert.equal(hourBars(rows, null, null).find((b) => b.hour === 12).height, 6);
});

test("hour chart: stays inside the day", () => {
  const rows = hours([[0, 3, 100], [1, 3, 100], [23, 4, 100]]);
  const bars = hourBars(rows, null, null);
  assert.equal(bars[0].hour, 0);
  assert.equal(bars[bars.length - 1].hour, 23);
});

test("hour sentence: with answer, without enough orders, and without any", () => {
  assert.match(plain(hourSentence(view())), /Sua hora mais forte é 12h: R\$ 300,00 em 6 pedidos\. A mais fraca é 11h/);
  assert.match(hourSentence(view({ peak: null, weak: null })), /poucos pedidos para dizer/);
  assert.match(hourSentence(view({ peak: null, weak: null, hours: hours([]) })), /Quando os pedidos chegarem/);
});

test("dish tabs, lists, values and details", () => {
  assert.deepEqual(DISH_TABS.map((t) => t.key), ["quantidade", "faturamento", "lucro"]);
  const v = view();
  const row = dishList(v, "lucro")[0];
  assert.equal(dishValue(row, "quantidade"), "8 un.");
  assert.equal(plain(dishValue(row, "faturamento")), "R$ 320,00");
  assert.equal(plain(dishValue(row, "lucro")), "R$ 224,00");
  assert.equal(plain(dishDetail(row, "quantidade")), "R$ 320,00 vendidos");
  assert.equal(dishDetail(row, "lucro"), "8 un. vendidas · CMV 30%");
  assert.match(dishDetail({ ...row, cost_partial: true }, "lucro"), /custo só de parte das vendas/);
  assert.equal(dishValue({ ...row, profit: null }, "lucro"), "sem custo");
});

test("dish bars are relative to the largest and never vanish", () => {
  const rows = [{ quantity: 10 }, { quantity: 5 }, { quantity: 0 }].map((r) => ({ ...r, revenue: 0, profit: null }));
  assert.deepEqual(dishWidths(rows, "quantidade"), [100, 50, 4]);
  assert.deepEqual(dishWidths([], "quantidade"), []);
});

test("dish empty messages are honest about why", () => {
  const none = view({ dishes: { ...view().dishes, distinct: 0 } });
  assert.match(dishEmpty(none, "quantidade"), /Quando vender/);
  assert.match(dishEmpty(view(), "lucro"), /ficha dos pratos na aba Custos/);
});

test("CMV status against the target", () => {
  assert.equal(cmvStatus(30, 35, 90), "bom");
  assert.equal(cmvStatus(35, 35, 90), "bom");
  assert.equal(cmvStatus(37, 35, 90), "atencao");
  assert.equal(cmvStatus(40, 35, 90), "alto");
  assert.equal(cmvStatus(40, 35, 30), "sem_dado", "too few sales have cost to judge");
  assert.equal(cmvStatus(null, 35, null), "sem_dado");
});

test("CMV sentence says how much of the sales it covers", () => {
  assert.match(plain(cmvSentence(view())), /De cada R\$ 100 vendidos, R\$ 31,20 foram para ingredientes \(sua meta é R\$ 35,00\)\. Todas as vendas têm custo\./);
  const partial = view({ dishes: { ...view().dishes, cost_coverage: 62.5 } });
  assert.match(cmvSentence(partial), /sobre 62,5% das vendas/);
  const none = view({ dishes: { ...view().dishes, cmv_real: null, cost_coverage: null } });
  assert.match(cmvSentence(none), /Sem vendas com custo calculado/);
});

test("times: median or an honest 'poucos dados' with the count", () => {
  assert.equal(timeValue({ median_min: 15, samples: 12 }), "15 min");
  assert.equal(timeValue({ median_min: null, samples: 2 }), "poucos dados");
  assert.equal(timeNote({ median_min: 15, samples: 12 }, 5), "Em 12 registros.");
  assert.equal(timeNote({ median_min: null, samples: 2 }, 5), "2 de 5 registros para mostrar um tempo confiável.");
  assert.equal(timeNote({ median_min: null, samples: 0 }, 5), "Nenhum registro neste período.");
});

test("person line mentions only what the person did", () => {
  const base = { name: "Ana", role: "Garçom", calls_answered: 0, call_median_min: null, deliveries: 0, delivery_median_min: null };
  assert.equal(personLine({ ...base, calls_answered: 1 }), "1 chamado atendido");
  assert.equal(personLine({ ...base, calls_answered: 7, call_median_min: 2 }), "7 chamados atendidos, metade em 2 min ou menos");
  assert.equal(personLine({ ...base, deliveries: 5, delivery_median_min: 20 }), "5 entregas, metade em 20 min ou menos");
  assert.equal(
    personLine({ ...base, calls_answered: 2, deliveries: 1 }),
    "2 chamados atendidos · 1 entrega",
  );
  assert.equal(personLine(base), "");
});

test("person line has no ranking words", () => {
  const text = personLine({ name: "Ana", role: "Garçom", calls_answered: 9, call_median_min: 1, deliveries: 9, delivery_median_min: 9 });
  assert.doesNotMatch(text, /melhor|pior|ranking|lugar|top/i);
});

test("attention headline counts the urgent first", () => {
  const note = (level) => ({ id: level, level, title: "", text: "", go: null });
  assert.match(attentionHeadline([]), /Nada preocupante/);
  assert.equal(attentionHeadline([note("alerta")]), "1 coisa precisa de você agora");
  assert.equal(attentionHeadline([note("alerta"), note("alerta"), note("bom")]), "2 coisas precisam de você agora");
  assert.equal(attentionHeadline([note("atencao")]), "1 ponto de atenção");
  assert.equal(attentionHeadline([note("bom"), note("info")]), "2 avisos");
  assert.equal(attentionHeadline([note("bom")]), "1 aviso");
});

test("weekday bars use the average per day with sales and mark the best day", () => {
  const rows = [
    { weekday: 0, name: "segunda", orders: 4, revenue: 400, days_with_sales: 4, avg_revenue: 100 },
    { weekday: 1, name: "terça", orders: 2, revenue: 300, days_with_sales: 1, avg_revenue: 300 },
    { weekday: 2, name: "quarta", orders: 0, revenue: 0, days_with_sales: 0, avg_revenue: null },
    { weekday: 3, name: "quinta", orders: 3, revenue: 150, days_with_sales: 1, avg_revenue: 150 },
  ];
  const bars = weekdayBars(rows);
  assert.equal(bars.find((b) => b.name === "terça").best, true);
  assert.equal(bars.find((b) => b.name === "terça").height, 100);
  assert.equal(bars.find((b) => b.name === "segunda").height, 33);
  assert.equal(bars.find((b) => b.name === "quarta").height, 0);
  assert.equal(bars[0].short, "seg");
  assert.match(plain(weekdaySentence(rows)), /^Terça é o dia que mais rende: em média R\$ 300,00 por dia com vendas\.$/);
});

test("weekday bars: nothing for today, and no claim from fewer than three days", () => {
  assert.deepEqual(weekdayBars(null), []);
  assert.deepEqual(weekdayBars([]), []);
  const two = [
    { weekday: 0, name: "segunda", orders: 4, revenue: 400, days_with_sales: 1, avg_revenue: 400 },
    { weekday: 1, name: "terça", orders: 4, revenue: 200, days_with_sales: 1, avg_revenue: 200 },
  ];
  assert.match(weekdaySentence(two), /Com mais dias de vendas/);
});

test("empty state", () => {
  const none = view({ summary: { revenue: 0, orders: 0, avg_ticket: null, dishes: 0, delivery_fees: 0 } });
  assert.equal(isEmpty(none), true);
  assert.equal(isEmpty(view()), false);
  assert.match(emptyText("hoje"), /Ainda sem vendas hoje/);
  assert.match(emptyText("7d"), /Nenhuma venda neste período/);
});

test("updated text pads the time", () => {
  assert.equal(updatedText(new Date(2026, 9, 14, 9, 5)), "Atualizado às 09:05");
});
