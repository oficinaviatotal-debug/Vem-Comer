/**
 * Rules for the "Seu negócio" tab of the restaurant panel: how the numbers from the server turn into short
 * sentences, bars and chips. The server (backend/insights.py) does the sums; nothing here recomputes them.
 *
 * Pure logic, no screens: tests/business/businessLogic.test.mjs runs it in Node.
 * The rule for every sentence: if the server has no number (too little data), say so. Never fill a gap.
 */

export type PeriodKey = "hoje" | "7d" | "30d";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
];

export type Level = "alerta" | "atencao" | "info" | "bom";

export type Summary = {
  revenue: number;
  orders: number;
  avg_ticket: number | null;
  dishes: number;
  delivery_fees: number;
};

export type HourRow = { hour: number; orders: number; revenue: number };
export type HourMark = { hour: number; label: string; orders: number; revenue: number } | null;

export type DishRow = {
  name: string;
  quantity: number;
  revenue: number;
  profit: number | null;
  cmv: number | null;
  cost_partial: boolean;
};

export type ShareRow = { key: string; label: string; orders: number; revenue: number; share: number };
export type TimeEntry = { median_min: number | null; samples: number };

export type PersonRow = {
  name: string;
  role: string;
  calls_answered: number;
  call_median_min: number | null;
  deliveries: number;
  delivery_median_min: number | null;
};

export type AttentionNote = {
  id: string;
  level: Level;
  title: string;
  text: string;
  go: "custos" | "pedidos" | null;
};

export type WeekdayRow = {
  weekday: number;
  name: string;
  orders: number;
  revenue: number;
  days_with_sales: number;
  avg_revenue: number | null;
};

export type BusinessView = {
  period: PeriodKey;
  label: string;
  from: string;
  to: string;
  summary: Summary;
  previous: Summary;
  compare: {
    enough_data: boolean;
    revenue_pct: number | null;
    orders_pct: number | null;
    ticket_pct: number | null;
    against: string;
  };
  hours: HourRow[];
  peak: HourMark;
  weak: HourMark;
  weekdays: WeekdayRow[] | null;
  dishes: {
    by_quantity: DishRow[];
    by_revenue: DishRow[];
    by_profit: DishRow[];
    cmv_real: number | null;
    cost_coverage: number | null;
    without_cost: string[];
    distinct: number;
  };
  cmv_target: number;
  channels: ShareRow[];
  payments: ShareRow[];
  times: { kitchen: TimeEntry; delivery: TimeEntry; table_call: TimeEntry };
  service: PersonRow[];
  attention: AttentionNote[];
  min_samples: number;
};

const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** 1234.5 -> "R$ 1.234,50". Anything that is not a number shows as R$ 0,00. */
export function moneyText(value: number | null | undefined): string {
  const number = Number(value);
  return MONEY.format(Number.isFinite(number) ? number : 0);
}

/** A price without cents when it is round: 1200 -> "R$ 1.200", 49.9 -> "R$ 49,90". For big tiles that must fit. */
export function moneyShort(value: number | null | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return MONEY.format(0);
  return Number.isInteger(number)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(number)
    : MONEY.format(number);
}

/** 12345 -> "12.345". */
export function countText(value: number | null | undefined): string {
  const number = Number(value);
  return new Intl.NumberFormat("pt-BR").format(Number.isFinite(number) ? number : 0);
}

/** For the small tiles: cents up to R$ 999,99, whole reais from R$ 1.000 on, so "R$ 1.235" still fits a 320 px phone. */
export function moneyTile(value: number | null | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return MONEY.format(0);
  if (Math.abs(number) >= 1000) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(number);
  }
  return MONEY.format(number);
}

export function percentText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${NUMBER.format(Math.round(value * 10) / 10)}%`;
}

/** 12 -> "12 min"; 4.5 -> "4,5 min". */
export function minutesText(value: number): string {
  return value < 10 ? `${NUMBER.format(value)} min` : `${Math.round(value)} min`;
}

// ---------------------------------------------------------------- comparação

export type Tone = "up" | "down" | "flat" | "none";

export function changeTone(pct: number | null | undefined): Tone {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "none";
  if (Math.abs(pct) < 1) return "flat";
  return pct > 0 ? "up" : "down";
}

/** "25% a mais", "20% a menos", "igual", or "sem base para comparar". */
export function changeText(pct: number | null | undefined): string {
  const tone = changeTone(pct);
  if (tone === "none") return "sem base para comparar";
  if (tone === "flat") return "igual ao período anterior";
  const size = percentText(Math.abs(pct as number));
  return tone === "up" ? `${size} a mais` : `${size} a menos`;
}

/** The line under the big number: what it is being compared with, or why it is not. */
export function compareLine(view: BusinessView): string {
  if (!view.compare.enough_data) {
    return view.summary.orders === 0
      ? "Ainda sem pedidos neste período."
      : `Poucos pedidos para comparar (a comparação começa com ${view.min_samples} pedidos nos dois períodos).`;
  }
  return `${changeText(view.compare.revenue_pct)} que ${view.compare.against} (${moneyText(view.previous.revenue)}).`;
}

export function ticketLine(view: BusinessView): string {
  if (view.summary.avg_ticket === null) return "Sem pedidos ainda";
  if (!view.compare.enough_data || view.compare.ticket_pct === null) return "por pedido";
  return `${changeText(view.compare.ticket_pct)} que antes`;
}

// ---------------------------------------------------------------- horários

export type HourBar = {
  hour: number;
  label: string;
  orders: number;
  revenue: number;
  height: number;
  kind: "peak" | "weak" | "normal" | "empty";
  showLabel: boolean;
};

const MIN_BARS = 6;

/**
 * The hours the chart shows: from one hour before the first sale to one after the last, at least six bars.
 * Height is relative to the strongest hour; an hour with sales is never drawn shorter than a sliver.
 */
export function hourBars(hours: HourRow[], peak: HourMark, weak: HourMark): HourBar[] {
  const active = hours.filter((row) => row.orders > 0);
  if (active.length === 0) return [];

  let first = Math.max(0, active[0].hour - 1);
  let last = Math.min(23, active[active.length - 1].hour + 1);
  while (last - first + 1 < MIN_BARS) {
    if (last < 23) last += 1;
    if (last - first + 1 < MIN_BARS && first > 0) first -= 1;
    if (first === 0 && last === 23) break;
  }

  const top = Math.max(...hours.map((row) => row.revenue), 0);
  const span = last - first + 1;
  const bars: HourBar[] = [];
  for (let hour = first; hour <= last; hour += 1) {
    const row = hours[hour];
    const kind: HourBar["kind"] =
      peak && peak.hour === hour ? "peak" : weak && weak.hour === hour ? "weak" : row.orders > 0 ? "normal" : "empty";
    const raw = top > 0 ? (row.revenue / top) * 100 : 0;
    bars.push({
      hour,
      label: `${hour}h`,
      orders: row.orders,
      revenue: row.revenue,
      height: row.orders > 0 ? Math.max(6, Math.round(raw)) : 0,
      kind,
      showLabel: span <= 9 || hour % 2 === 0,
    });
  }
  return bars;
}

export function hourSentence(view: BusinessView): string {
  if (!view.peak) {
    const total = view.hours.reduce((sum, row) => sum + row.orders, 0);
    return total === 0
      ? "Quando os pedidos chegarem, aqui aparece a hora que mais vende."
      : "Ainda são poucos pedidos para dizer qual é a melhor hora (a conta começa com 10 pedidos em 3 horários).";
  }
  const peak = `Sua hora mais forte é ${view.peak.label}: ${moneyText(view.peak.revenue)} em ${view.peak.orders} pedido${view.peak.orders === 1 ? "" : "s"}.`;
  return view.weak ? `${peak} A mais fraca é ${view.weak.label} (${moneyText(view.weak.revenue)}).` : peak;
}

// ---------------------------------------------------------------- pratos

export type DishTab = "quantidade" | "faturamento" | "lucro";

export const DISH_TABS: { key: DishTab; label: string }[] = [
  { key: "quantidade", label: "Mais saem" },
  { key: "faturamento", label: "Mais faturam" },
  { key: "lucro", label: "Mais lucram" },
];

export function dishList(view: BusinessView, tab: DishTab): DishRow[] {
  if (tab === "faturamento") return view.dishes.by_revenue;
  if (tab === "lucro") return view.dishes.by_profit;
  return view.dishes.by_quantity;
}

/** The main number of a dish row for the tab chosen, as text. */
export function dishValue(row: DishRow, tab: DishTab): string {
  if (tab === "quantidade") return `${row.quantity} un.`;
  if (tab === "faturamento") return moneyText(row.revenue);
  return row.profit === null ? "sem custo" : moneyText(row.profit);
}

/** The small line under the dish name. */
export function dishDetail(row: DishRow, tab: DishTab): string {
  if (tab === "quantidade") return `${moneyText(row.revenue)} vendidos`;
  if (tab === "faturamento") return `${row.quantity} un. vendidas`;
  const parts = [`${row.quantity} un. vendidas`];
  if (row.cmv !== null) parts.push(`CMV ${percentText(row.cmv)}`);
  if (row.cost_partial) parts.push("custo só de parte das vendas");
  return parts.join(" · ");
}

/** Bar widths (0-100) for a list, relative to its largest value in the tab. */
export function dishWidths(rows: DishRow[], tab: DishTab): number[] {
  const values = rows.map((row) => (tab === "quantidade" ? row.quantity : tab === "faturamento" ? row.revenue : row.profit ?? 0));
  const top = Math.max(...values, 0);
  return values.map((value) => (top > 0 ? Math.max(4, Math.round((value / top) * 100)) : 0));
}

export function dishEmpty(view: BusinessView, tab: DishTab): string {
  if (view.dishes.distinct === 0) return "Quando vender, os pratos aparecem aqui.";
  if (tab === "lucro") {
    return "Ainda não há prato vendido com custo calculado. Preencha a ficha dos pratos na aba Custos e o lucro aparece aqui.";
  }
  return "Nada para mostrar neste período.";
}

export type CmvStatus = "sem_dado" | "bom" | "atencao" | "alto";

/** Real CMV against the target: ok up to the target, a warning up to 3 points above, high beyond that. */
export function cmvStatus(cmv: number | null, target: number, coverage: number | null): CmvStatus {
  if (cmv === null || coverage === null || coverage < 50) return "sem_dado";
  if (cmv <= target) return "bom";
  return cmv <= target + 3 ? "atencao" : "alto";
}

export function cmvSentence(view: BusinessView): string {
  const { cmv_real: cmv, cost_coverage: coverage } = view.dishes;
  if (cmv === null || coverage === null) return "Sem vendas com custo calculado neste período.";
  const base = `De cada R$ 100 vendidos, ${moneyText(cmv)} foram para ingredientes (sua meta é ${moneyText(view.cmv_target)}).`;
  const note =
    coverage >= 99.5
      ? "Todas as vendas têm custo."
      : `Conta feita sobre ${percentText(coverage)} das vendas, as que têm custo calculado.`;
  return `${base} ${note}`;
}

// ---------------------------------------------------------------- tempos e equipe

/** "12 min", or "poucos dados" with how many records there are. */
export function timeValue(entry: TimeEntry): string {
  return entry.median_min === null ? "poucos dados" : minutesText(entry.median_min);
}

export function timeNote(entry: TimeEntry, minSamples: number): string {
  if (entry.median_min !== null) {
    return `Em ${entry.samples} registro${entry.samples === 1 ? "" : "s"}.`;
  }
  return entry.samples === 0
    ? "Nenhum registro neste período."
    : `${entry.samples} de ${minSamples} registros para mostrar um tempo confiável.`;
}

export const TIME_LABELS = {
  kitchen: "Cozinha",
  delivery: "Entrega",
  table_call: "Chamados",
} as const;

export function personLine(person: PersonRow): string {
  const parts: string[] = [];
  if (person.calls_answered > 0) {
    const plural = person.calls_answered === 1 ? "chamado atendido" : "chamados atendidos";
    parts.push(
      `${person.calls_answered} ${plural}${person.call_median_min === null ? "" : `, metade em ${minutesText(person.call_median_min)} ou menos`}`,
    );
  }
  if (person.deliveries > 0) {
    const plural = person.deliveries === 1 ? "entrega" : "entregas";
    parts.push(
      `${person.deliveries} ${plural}${person.delivery_median_min === null ? "" : `, metade em ${minutesText(person.delivery_median_min)} ou menos`}`,
    );
  }
  return parts.join(" · ");
}

// ---------------------------------------------------------------- avisos

export const LEVEL_ICON: Record<Level, string> = { alerta: "!", atencao: "!", info: "i", bom: "✓" };
export const LEVEL_NAME: Record<Level, string> = {
  alerta: "Urgente",
  atencao: "Atenção",
  info: "Informação",
  bom: "Boa notícia",
};

export function attentionHeadline(notes: AttentionNote[]): string {
  if (notes.length === 0) return "Nada preocupante agora. Seguem os números do período.";
  const urgent = notes.filter((n) => n.level === "alerta").length;
  if (urgent > 0) return urgent === 1 ? "1 coisa precisa de você agora" : `${urgent} coisas precisam de você agora`;
  const watch = notes.filter((n) => n.level === "atencao").length;
  if (watch > 0) return watch === 1 ? "1 ponto de atenção" : `${watch} pontos de atenção`;
  return notes.length === 1 ? "1 aviso" : `${notes.length} avisos`;
}

// ---------------------------------------------------------------- dias da semana

export type WeekdayBar = { name: string; short: string; height: number; revenue: number; orders: number; best: boolean };

/** One bar per weekday, by the average per day that had sales (so a day with 4 Mondays is not 4 times better). */
export function weekdayBars(rows: WeekdayRow[] | null): WeekdayBar[] {
  if (!rows) return [];
  const values = rows.map((row) => row.avg_revenue ?? 0);
  const top = Math.max(...values, 0);
  if (top <= 0) return [];
  const best = values.indexOf(top);
  return rows.map((row, index) => ({
    name: row.name,
    short: row.name.slice(0, 3),
    height: values[index] > 0 ? Math.max(6, Math.round((values[index] / top) * 100)) : 0,
    revenue: values[index],
    orders: row.orders,
    best: index === best,
  }));
}

export function weekdaySentence(rows: WeekdayRow[] | null): string {
  const bars = weekdayBars(rows);
  const withSales = bars.filter((bar) => bar.revenue > 0);
  if (withSales.length < 3) return "Com mais dias de vendas, aqui aparece qual dia da semana rende mais.";
  const best = bars.find((bar) => bar.best) as WeekdayBar;
  return `${best.name.charAt(0).toUpperCase()}${best.name.slice(1)} é o dia que mais rende: em média ${moneyText(best.revenue)} por dia com vendas.`;
}

// ---------------------------------------------------------------- tela vazia

export function isEmpty(view: BusinessView): boolean {
  return view.summary.orders === 0;
}

export function emptyText(period: PeriodKey): string {
  return period === "hoje"
    ? "Ainda sem vendas hoje. Assim que o primeiro pedido for aceito, os números aparecem aqui."
    : "Nenhuma venda neste período. Escolha outro período acima ou volte quando houver pedidos.";
}

export function updatedText(now: Date): string {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `Atualizado às ${hours}:${minutes}`;
}
