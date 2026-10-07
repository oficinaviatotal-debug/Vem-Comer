/**
 * Rules for the "Custos" tab of the restaurant panel: units, quantities, the
 * live cost while the owner builds a dish's recipe card, and the sentences the
 * screen shows.
 *
 * Pure logic, no screens: tests/costs/costLogic.test.mjs runs it in Node.
 * The server (backend/costing.py) checks and computes everything again; these
 * functions only keep the screen honest while the owner types.
 */

/** How the database keeps a quantity: grams, millilitres or units. */
export type BaseUnit = "g" | "ml" | "un";

/** What the owner picks on the screen. */
export type InputUnit = "kg" | "g" | "l" | "ml" | "un" | "dz";

export type CostStatus = "ok" | "atencao" | "alto" | "sem_custo" | "sem_preco";

const UNITS: Record<InputUnit, { base: BaseUnit; factor: number; label: string }> = {
  kg: { base: "g", factor: 1000, label: "kg" },
  g: { base: "g", factor: 1, label: "g" },
  l: { base: "ml", factor: 1000, label: "L" },
  ml: { base: "ml", factor: 1, label: "ml" },
  un: { base: "un", factor: 1, label: "unidade" },
  dz: { base: "un", factor: 12, label: "dúzia" },
};

export const PACKAGE_UNITS: { value: InputUnit; label: string }[] = (
  ["kg", "g", "l", "ml", "un", "dz"] as InputUnit[]
).map((value) => ({ value, label: UNITS[value].label }));

/** Units that make sense for an ingredient kept in `base` (weight with weight, liquid with liquid). */
export function unitsFor(base: BaseUnit): { value: InputUnit; label: string }[] {
  return PACKAGE_UNITS.filter((unit) => UNITS[unit.value].base === base);
}

export function baseOf(unit: InputUnit): BaseUnit {
  return UNITS[unit].base;
}

export function isInputUnit(value: string): value is InputUnit {
  return Object.prototype.hasOwnProperty.call(UNITS, value);
}

/** "0,25" -> 0.25, "1.234,50" -> 1234.5, "18.9" -> 18.9. Empty or not a number -> null. */
export function parseDecimal(text: string | number | null | undefined): number | null {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  let clean = String(text ?? "").replace(/R\$/g, "").replace(/\s/g, "");
  if (!clean) return null;
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  // "1.000" or "2.500" with no comma: in Brazil the dot here separates thousands.
  else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, "");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

/** Quantity typed with a unit -> quantity in the database unit. null if invalid or not positive. */
export function toBase(quantity: string | number, unit: InputUnit): number | null {
  const value = parseDecimal(quantity);
  if (value === null || value <= 0) return null;
  return round(value * UNITS[unit].factor, 3);
}

const number = (digits: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** 250 g -> "250 g"; 1000 g -> "1 kg"; 1500 ml -> "1,5 L"; 1 un -> "1 unidade"; 12 un -> "12 unidades". */
export function formatQuantity(quantity: number, unit: BaseUnit): string {
  if (!Number.isFinite(quantity)) return "";
  if (unit === "g" && quantity >= 1000) return `${number(3).format(quantity / 1000)} kg`;
  if (unit === "ml" && quantity >= 1000) return `${number(3).format(quantity / 1000)} L`;
  if (unit === "un") return `${number(3).format(quantity)} ${quantity === 1 ? "unidade" : "unidades"}`;
  return `${number(3).format(quantity)} ${unit}`;
}

/**
 * A stored quantity back in the friendliest unit, for an edit field: 1000 g -> "1" kg.
 * Only whole grams (or millilitres) move to kg (or L), so saving again never changes the number.
 */
export function toInput(quantity: number, base: BaseUnit): { quantity: string; unit: InputUnit } {
  const whole = Number.isInteger(round(quantity, 3));
  if (base === "g" && quantity >= 1000 && whole) return { quantity: decimalText(quantity / 1000), unit: "kg" };
  if (base === "ml" && quantity >= 1000 && whole) return { quantity: decimalText(quantity / 1000), unit: "l" };
  return { quantity: decimalText(quantity), unit: base === "un" ? "un" : base };
}

function decimalText(value: number): string {
  return number(3).format(value).replace(/\./g, "");
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoneyPlain(value: number | null | undefined): string {
  return money.format(typeof value === "number" && Number.isFinite(value) ? value : 0).replace(/ /g, " ");
}

/** "R$ 18,90 por 1 kg" */
export function packageLabel(price: number, packageQty: number, unit: BaseUnit): string {
  return `${formatMoneyPlain(price)} por ${formatQuantity(packageQty, unit)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${number(1).format(value)}%`;
}

export function statusLabel(status: CostStatus): string {
  switch (status) {
    case "ok":
      return "Na meta";
    case "atencao":
      return "Atenção";
    case "alto":
      return "Custo alto";
    case "sem_preco":
      return "Sem preço";
    default:
      return "Sem ficha";
  }
}

/** CSS class of the status chip. */
export function statusChip(status: CostStatus): string {
  switch (status) {
    case "ok":
      return "chip chip-done";
    case "atencao":
      return "chip chip-wait";
    case "alto":
      return "chip chip-alto";
    default:
      return "chip";
  }
}

const ATTENTION_ORDER: Record<CostStatus, number> = {
  alto: 0,
  atencao: 1,
  sem_preco: 2,
  sem_custo: 3,
  ok: 4,
};

/** Most urgent first (high cost, then attention), then by name. Does not change the input. */
export function sortForAttention<T extends { status: CostStatus; name: string; cmv?: number | null }>(
  products: T[],
): T[] {
  return [...products].sort((a, b) => {
    const byStatus = ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    const byCmv = (b.cmv ?? -1) - (a.cmv ?? -1);
    if (byCmv !== 0) return byCmv;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export type ProductCost = {
  name: string;
  price: number;
  cost: number | null;
  cmv: number | null;
  status: CostStatus;
  suggested_price: number | null;
};

/** The one sentence under a dish: what it costs, what it sells for, and what to do. */
export function productSentence(product: ProductCost, target: number): string {
  if (product.status === "sem_custo" || product.cost === null) {
    return "Ainda sem ficha. Monte a ficha para saber quanto custa cada porção.";
  }
  if (product.status === "sem_preco") {
    return `Custa ${formatMoneyPlain(product.cost)} por porção, mas está sem preço de venda.`;
  }
  const base = `Custa ${formatMoneyPlain(product.cost)} e vende por ${formatMoneyPlain(product.price)}: CMV de ${formatPercent(product.cmv)}`;
  if (product.status === "ok") return `${base}, dentro da meta de ${target}%.`;
  const fix = product.suggested_price
    ? ` Para ficar na meta de ${target}%, o preço seria ${formatMoneyPlain(product.suggested_price)}, ou o custo precisa cair.`
    : "";
  return `${base}, acima da meta de ${target}%.${fix}`;
}

export type DraftLine = {
  quantity: string;
  unit: InputUnit;
  packageQty: number;
  packagePrice: number;
  /** How much of the package is left after cleaning, in % (100 = nothing is lost). */
  yieldPct?: number;
};

function usableFraction(yieldPct: number | undefined): number {
  const pct = typeof yieldPct === "number" && yieldPct > 0 ? Math.min(yieldPct, 100) : 100;
  return pct / 100;
}

/** Cost of one recipe line as typed (null while the quantity is not a valid number). */
export function draftLineCost(line: DraftLine): number | null {
  const quantity = toBase(line.quantity, line.unit);
  const usable = line.packageQty * usableFraction(line.yieldPct);
  if (quantity === null || !(usable > 0)) return null;
  return (quantity * line.packagePrice) / usable;
}

/** Cost of the whole recipe as typed (null while nothing valid yet). */
export function draftRecipeCost(lines: DraftLine[]): number | null {
  let total = 0;
  let counted = 0;
  for (const line of lines) {
    const cost = draftLineCost(line);
    if (cost === null) continue;
    total += cost;
    counted += 1;
  }
  return counted === 0 ? null : total;
}

/**
 * Live cost of ONE portion while the owner edits: the recipe divided by how many portions it
 * makes, plus the other costs per portion (packaging, gas). null when nothing valid yet.
 */
export function draftCost(lines: DraftLine[], extra: string, portions = 1): number | null {
  const extraValue = Math.max(parseDecimal(extra) ?? 0, 0);
  const recipe = draftRecipeCost(lines);
  if (recipe === null && extraValue <= 0) return null;
  const divisor = portions >= 1 ? portions : 1;
  return round((recipe ?? 0) / divisor + extraValue, 2);
}

/** "6" -> 6. Empty -> 1 (the card is one portion). Not a whole number from 1 to 500 -> null. */
export function parsePortions(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined || String(text).trim() === "") return 1;
  const value = parseDecimal(text);
  if (value === null || !Number.isInteger(value) || value < 1 || value > 500) return null;
  return value;
}

/** Trimming loss field: empty -> 100. Not a whole number from 1 to 100 -> null. */
export function parseYieldPct(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined || String(text).replace("%", "").trim() === "") return 100;
  const value = parseDecimal(String(text).replace("%", ""));
  if (value === null || !Number.isInteger(value) || value < 1 || value > 100) return null;
  return value;
}

export function cmvOf(cost: number | null, price: number): number | null {
  if (cost === null || !(price > 0)) return null;
  return round((cost * 100) / price, 1);
}

export type IngredientForm = { name: string; quantity: string; unit: InputUnit; price: string; yieldPct?: string };

/** First problem to show before sending a new or edited ingredient, or "" when it can go. */
export function ingredientFormProblem(form: IngredientForm): string {
  if (!form.name.trim()) return "Escreva o nome do insumo. Ex.: Peito de frango.";
  if (form.name.trim().length > 80) return "Nome do insumo: no máximo 80 letras.";
  if (toBase(form.quantity, form.unit) === null) return "Escreva o tamanho da embalagem. Ex.: 1 kg, 5 L, 30 unidades.";
  const price = parseDecimal(form.price);
  if (price === null || price < 0) return "Escreva quanto você pagou. Ex.: 18,90.";
  if (parseYieldPct(form.yieldPct) === null) {
    return "Aproveitamento: um número de 1 a 100. Ex.: 85 se de 1 kg sobram 850 g limpos.";
  }
  return "";
}

export type RecipeDraftLine = { ingredientId: string; quantity: string; unit: InputUnit };

/** First problem in the recipe card, or "". */
export function recipeProblem(
  lines: RecipeDraftLine[],
  extra: string,
  portions: string = "",
  portionGrams: string = "",
): string {
  if (parsePortions(portions) === null) return "Rende quantas porções: um número inteiro. Ex.: 6.";
  if (portionGrams.trim()) {
    const grams = parseDecimal(portionGrams);
    if (grams === null || grams <= 0) return "Peso da porção: escreva em gramas. Ex.: 300.";
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.ingredientId) return "Escolha o insumo de cada linha, ou tire a linha vazia.";
    if (seen.has(line.ingredientId)) return "O mesmo insumo aparece duas vezes. Junte numa linha só.";
    seen.add(line.ingredientId);
    if (toBase(line.quantity, line.unit) === null) return "Escreva quanto vai de cada insumo. Ex.: 250 g.";
  }
  if (extra.trim()) {
    const value = parseDecimal(extra);
    if (value === null || value < 0) return "Outros custos: escreva um valor. Ex.: 1,50.";
  }
  return "";
}

/**
 * What the server expects in PUT .../recipe. Numbers go as JSON numbers, never as text,
 * so "1.234" can never be read as one thousand on the other side.
 */
export function recipePayload(
  portion: string,
  extra: string,
  lines: RecipeDraftLine[],
  portions: string = "",
  portionGrams: string = "",
) {
  return {
    portion: portion.trim(),
    yield_portions: parsePortions(portions) ?? 1,
    portion_grams: portionGrams.trim() ? parseDecimal(portionGrams) : null,
    extra_cost: extra.trim() ? parseDecimal(extra) ?? 0 : 0,
    items: lines.map((line) => ({
      ingredient_id: line.ingredientId,
      quantity: parseDecimal(line.quantity) ?? 0,
      unit: line.unit,
    })),
  };
}

export type Period = {
  days: number;
  revenue: number | null;
  cost: number | null;
  cmv: number | null;
  coverage: number | null;
};

/** The headline of the tab: how the last 30 days went. */
export function periodSentence(period: Period, target: number): string {
  if (period.cmv === null || period.coverage === null) {
    return `Nos últimos ${period.days} dias ainda não houve venda de prato com ficha. Monte as fichas e o CMV aparece aqui.`;
  }
  const verdict = period.cmv <= target ? "dentro da meta" : "acima da meta";
  return `Nos últimos ${period.days} dias, o CMV pela ficha foi ${formatPercent(period.cmv)}, ${verdict} de ${target}%. ${number(0).format(period.coverage)}% das vendas tinham ficha.`;
}

/* ---- Profitability: menu engineering (Kasavana and Smith) ---- */

export type Quadrant = "estrela" | "cavalo" | "quebra_cabeca" | "cao";

export function quadrantLabel(quadrant: Quadrant | null | undefined): string {
  switch (quadrant) {
    case "estrela":
      return "Estrela";
    case "cavalo":
      return "Cavalo de tração";
    case "quebra_cabeca":
      return "Quebra-cabeça";
    case "cao":
      return "Cão";
    default:
      return "";
  }
}

export function quadrantChip(quadrant: Quadrant | null | undefined): string {
  switch (quadrant) {
    case "estrela":
      return "chip chip-done";
    case "cavalo":
      return "chip chip-wait";
    case "quebra_cabeca":
      return "chip chip-prep";
    case "cao":
      return "chip chip-alto";
    default:
      return "chip";
  }
}

/** What to do with the dish, in one sentence: the promotion, campaign or change that fits it. */
export function quadrantAction(quadrant: Quadrant | null | undefined): string {
  switch (quadrant) {
    case "estrela":
      return "Vende muito e dá bom lucro. Não mude a receita; ponha em destaque no cardápio e nos posts.";
    case "cavalo":
      return "Vende muito, mas dá pouco lucro. Suba um pouco o preço, acerte a porção ou troque um acompanhamento mais barato.";
    case "quebra_cabeca":
      return "Dá bom lucro, mas vende pouco. Faça promoção, foto melhor, combo e peça ao garçom para oferecer.";
    case "cao":
      return "Vende pouco e dá pouco lucro. Repense a receita e o preço, ou tire do cardápio.";
    default:
      return "Monte a ficha e venda pelo app para este prato entrar no ranking.";
  }
}

export type ProfitRow = {
  name: string;
  price: number;
  cost: number | null;
  sold_30d: number;
  profit_30d: number | null;
  quadrant: Quadrant | null;
};

/** Most profit in the last 30 days first; dishes without a card at the end. Does not change the input. */
export function sortByProfit<T extends ProfitRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = a.profit_30d ?? Number.NEGATIVE_INFINITY;
    const pb = b.profit_30d ?? Number.NEGATIVE_INFINITY;
    if (pa !== pb) return pb - pa;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export function profitSentence(row: ProfitRow): string {
  const sold = `Vendeu ${row.sold_30d} ${row.sold_30d === 1 ? "porção" : "porções"} em 30 dias`;
  if (row.profit_30d === null) return `${sold}. Sem ficha: o lucro aparece quando você montar a ficha.`;
  return `${sold} e deu ${formatMoneyPlain(row.profit_30d)} de lucro sobre o custo dos ingredientes.`;
}

/* ---- Stock by recipe card ---- */

export type StockInfo = {
  unit: BaseUnit;
  stock_controlled: boolean;
  stock_now: number | null;
  used_30d: number | null;
  days_left: number | null;
};

export function stockSentence(item: StockInfo): string {
  if (!item.stock_controlled || item.stock_now === null) {
    return "Estoque: não controlado. Toque em Estoque e diga quanto tem.";
  }
  if (item.stock_now <= 0) {
    return "Estoque: pela ficha, acabou. Conte de novo ou registre a compra.";
  }
  const days = item.days_left === null ? "" : ` · dá para uns ${item.days_left} ${item.days_left === 1 ? "dia" : "dias"}`;
  return `Estoque pela ficha: ${formatQuantity(item.stock_now, item.unit)}${days}.`;
}

/** "1 kg dá 4,2 pratos de Frango à milanesa" for each dish that uses the ingredient. */
export function portionsSentences(
  packageQty: number,
  unit: BaseUnit,
  rows: { name: string; portions: number }[],
): string[] {
  return rows.map(
    (row) => `${formatQuantity(packageQty, unit)} dá ${number(1).format(row.portions)} ${row.portions === 1 ? "prato" : "pratos"} de ${row.name}`,
  );
}
