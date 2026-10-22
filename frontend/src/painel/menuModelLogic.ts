/**
 * Montar o cardápio começando de um modelo: escolher o tipo do negócio, tocar nos pratos que vende, categoria por categoria,
 * dizer o preço de cada um e conferir. Só conta, sem React nem rede: tests/novo/menuModelLogic.test.mjs roda isto no Node.
 *
 * Nenhuma regra mudou. Marcar pratos, anotar um prato que falta, pedir um preço por vez, tirar prato e o que vai no cadastro vêm
 * da mesma máquina do assistente antigo (`assistant/assistantFlow`, `doorLogic`), que já é testada. Aqui só se transforma esse
 * estado nas telas novas e se escreve a frase. A conferência e o cadastro são os de `menuSetupLogic`.
 *
 * Duas regras de cuidado: o que o servidor manda (tipos de negócio, pratos do modelo) é lido com desconfiança (formato, tamanho,
 * repetidos) e só entra como texto; e o preço de cada prato é sempre o que a pessoa escreveu, nunca um palpite.
 */
import {
  addItem,
  cleanItemName,
  currentCategory,
  currentPriceItem,
  nextCategory,
  previousCategory,
  selectedInCategory,
  selectedItems,
  setCurrentPrice,
  skipCurrentPrice,
  backOnePrice,
  startFromTemplate,
  toggleAllInCategory,
  toggleItem,
  type FlowState,
  type TemplateFull,
} from "../assistant/assistantFlow.ts";
import { filterTemplates } from "../assistant/doorLogic.ts";
import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import {
  MENU_MODEL_LOADING,
  MENU_MODEL_OPENING,
  MENU_MODEL_SUB,
  MENU_PICK_CLEAR_ALL,
  MENU_PICK_INTRO,
  MENU_PICK_MARK_ALL,
  MENU_PICK_NEED_ONE,
  MENU_PICK_NONE,
  MENU_PICK_PRICES,
  MENU_PRICE_BAD,
  MENU_PRICES_LAST,
  MENU_PRICES_NEXT,
} from "../novo/copy.ts";
import type { MenuModelTile, MenuSetupView } from "../novo/types.ts";
import { dishId, priceIsUsable } from "./menuSetupLogic.ts";

export type { MenuModelTile };

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** Quanto se aceita do servidor. Um modelo de verdade tem poucas dezenas de pratos por categoria. */
export const MAX_TYPES = 60;
export const MAX_CATEGORIES = 40;
export const MAX_DISHES = 200;

const squash = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** O desenho do tipo (emoji) vem do servidor: só os primeiros 4 caracteres e sempre como texto. Sem desenho, a inicial do nome. */
const iconOf = (icon: unknown, name: string): string => {
  const drawn = Array.from(squash(icon)).slice(0, 4).join("");
  return drawn || Array.from(name)[0] || "";
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// ------------------------------------------------------------------------------------------------ o que o servidor manda

/**
 * A lista de tipos de negócio. Entra só o que tem identificador simples e nome; repetido e tipo sem nome ficam de fora.
 * Resposta que não é uma lista vale `null` (a tela diz que não entendeu em vez de mostrar uma lista vazia como se fosse verdade).
 */
export function modelTypesOf(raw: unknown): MenuModelTile[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: MenuModelTile[] = [];
  for (const entry of raw.slice(0, MAX_TYPES)) {
    if (!isObject(entry)) continue;
    const id = typeof entry.id === "string" ? entry.id : "";
    const name = squash(entry.name).slice(0, 40).trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, icon: iconOf(entry.icon, name) });
  }
  return out;
}

/**
 * O modelo escolhido: categorias com os pratos que o servidor tem para esse tipo. Nome limpo ("x-burguer  grande" vira
 * "X-burguer grande"), repetido na categoria sai, categoria sem prato sai. Sem nenhuma categoria com prato, vale `null`.
 */
export function modelOf(raw: unknown, id: string): TemplateFull | null {
  if (!isObject(raw) || !Array.isArray(raw.categories)) return null;
  const categories: TemplateFull["categories"] = [];
  for (const category of raw.categories.slice(0, MAX_CATEGORIES)) {
    if (!isObject(category) || !Array.isArray(category.items)) continue;
    const name = cleanItemName(squash(category.name));
    const seen = new Set<string>();
    const items: Array<{ name: string }> = [];
    for (const item of category.items.slice(0, MAX_DISHES)) {
      const dish = cleanItemName(isObject(item) ? squash(item.name) : "");
      const key = normalizeSpeech(dish);
      if (!dish || seen.has(key)) continue;
      seen.add(key);
      items.push({ name: dish });
    }
    if (name && items.length > 0) categories.push({ name, items });
  }
  if (categories.length === 0) return null;
  const title = squash(raw.name) || "Modelo";
  return { id, name: title, icon: iconOf(raw.icon, title), categories };
}

/** O estado de quem acabou de escolher o tipo: nenhum prato marcado, na primeira categoria. */
export const startModel = (model: TemplateFull): FlowState => startFromTemplate(model);

// ------------------------------------------------------------------------------------------------ escolher o tipo

export const modelNotFoundText = (query: string): string => `Não achei “${query.trim()}”. Tente outra palavra, ou volte e fale os pratos.`;

export type TypesInput = {
  /** `null` até a primeira resposta do servidor. */
  types: readonly MenuModelTile[] | null;
  query: string;
  error: string;
  /** Um tipo foi escolhido e o servidor ainda não mandou os pratos dele. */
  opening: boolean;
};

export function typesViewOf(input: TypesInput): MenuSetupView {
  const waiting = input.types === null && !input.error;
  const tiles = input.types ? filterTemplates([...input.types], input.query) : [];
  const working = input.opening ? MENU_MODEL_OPENING : waiting ? MENU_MODEL_LOADING : "";
  return {
    stage: "types",
    sub: MENU_MODEL_SUB,
    loading: waiting,
    working,
    error: input.error,
    query: input.query,
    tiles,
    // "Não achei" só quando a lista já veio e a busca não deixou nenhum: nunca enquanto espera.
    empty: input.types !== null && input.types.length > 0 && tiles.length === 0 ? modelNotFoundText(input.query) : "",
    canRetry: input.types === null && Boolean(input.error),
  };
}

// ------------------------------------------------------------------------------------------------ tocar nos pratos

export type PickInput = { flow: FlowState; notice: string };

export function pickViewOf(input: PickInput): MenuSetupView {
  const { flow } = input;
  const total = flow.categories.length;
  const index = Math.min(Math.max(0, flow.categoryIndex), Math.max(0, total - 1));
  const category = currentCategory({ ...flow, categoryIndex: index });
  const marked = category ? selectedInCategory(flow, index) : 0;
  const all = selectedItems(flow).length;
  const last = index >= total - 1;
  const following = flow.categories[index + 1];
  const everyMarked = Boolean(category) && category!.items.length > 0 && marked === category!.items.length;

  const count = marked === 0 ? MENU_PICK_NONE : plural(marked, "marcado", "marcados");
  const title = category?.name ?? "";
  return {
    stage: "pick",
    sub: `Categoria ${index + 1} de ${Math.max(1, total)}`,
    title,
    intro: MENU_PICK_INTRO,
    count,
    dishes: (category?.items ?? []).map((item, itemIndex) => ({ id: dishId(index, itemIndex), name: item.name, selected: item.selected })),
    markAll: everyMarked ? MENU_PICK_CLEAR_ALL : MENU_PICK_MARK_ALL,
    notice: input.notice,
    next: last ? (all > 0 ? `${MENU_PICK_PRICES} (${all})` : MENU_PICK_PRICES) : `Próxima: ${following?.name ?? ""}`,
    canNext: !last || all > 0,
    note: last && all === 0 ? MENU_PICK_NEED_ONE : all > marked ? `${plural(all, "prato marcado", "pratos marcados")} até agora.` : "",
    live: `${title}. ${count}`,
  };
}

/** Toca num prato da categoria que está na tela: marca ou desmarca. Prato de outra categoria ou número estranho não muda nada. */
export function toggleDish(flow: FlowState, id: string): FlowState {
  const found = /^(\d{1,3})-(\d{1,4})$/.exec(id);
  if (!found) return flow;
  const categoryIndex = Number(found[1]);
  if (categoryIndex !== flow.categoryIndex) return flow;
  return toggleItem(flow, categoryIndex, Number(found[2]));
}

/** "Marcar todos" ou, quando todos já estão marcados, "Tirar todos", na categoria que está na tela. */
export const toggleCategory = (flow: FlowState): FlowState => toggleAllInCategory(flow, flow.categoryIndex);

export type TakeOutcome = { flow: FlowState; notice: string };

/** O prato que a pessoa escreveu porque faltava na lista: entra marcado (ou, se já existe, só marca). */
export function takeDish(flow: FlowState, text: string): TakeOutcome {
  const result = addItem(flow, flow.categoryIndex, text);
  if (result.added.length > 0) return { flow: result.state, notice: `Anotei ${result.added[0]}.` };
  if (result.selected.length > 0) return { flow: result.state, notice: `Marquei ${result.selected[0]}.` };
  return { flow, notice: cleanItemName(text) ? "Esse prato já está marcado." : "" };
}

/** Segue: para a próxima categoria, ou, na última, para os preços. Sem nenhum prato marcado na última, fica onde está. */
export const goNext = (flow: FlowState): FlowState => nextCategory(flow);

/** Volta uma categoria; na primeira devolve `null` (quem chama volta à escolha do tipo). */
export const goBackPick = (flow: FlowState): FlowState | null => (flow.categoryIndex > 0 ? previousCategory(flow) : null);

/** Em que tela a pessoa está, olhando só o estado do assistente. */
export const whereOf = (flow: FlowState): "pick" | "prices" | "review" => (flow.step === "prices" ? "prices" : flow.step === "review" ? "review" : "pick");

// ------------------------------------------------------------------------------------------------ um preço por vez

export type PricesInput = { flow: FlowState; problem: "" | "price" };

/** `null` quando a pessoa não está nos preços ou não há prato esperando preço (quem chama mostra a conferência). */
export function pricesViewOf(input: PricesInput): MenuSetupView | null {
  const current = input.flow.step === "prices" ? currentPriceItem(input.flow) : undefined;
  if (!current) return null;
  const total = selectedItems(input.flow).length;
  const position = input.flow.priceCursor + 1;
  return {
    stage: "prices",
    sub: `Prato ${position} de ${total}`,
    dishId: dishId(current.categoryIndex, current.itemIndex),
    name: current.name,
    group: current.categoryName,
    value: current.price ? current.price.replace(".", ",") : "",
    problem: input.problem === "price" ? MENU_PRICE_BAD : "",
    next: position >= total ? MENU_PRICES_LAST : MENU_PRICES_NEXT,
  };
}

export type PriceOutcome = { flow: FlowState; problem: "" | "price" };

/**
 * O que está no campo vale como preço deste prato e segue para o próximo. Campo vazio num prato que já tem preço (a pessoa voltou)
 * mantém o preço; campo vazio sem preço, ou texto que não é número, não segue e diz o problema.
 */
export function takePrice(flow: FlowState, text: string): PriceOutcome {
  const typed = text.trim();
  const current = currentPriceItem(flow);
  if (!current) return { flow, problem: "" };
  const wanted = typed || current.price;
  if (!wanted || !priceIsUsable(wanted)) return { flow, problem: "price" };
  const next = setCurrentPrice(flow, wanted);
  return { flow: next, problem: next === flow ? "price" : "" };
}

/** "Tirar este prato": ele sai do cardápio e vem o próximo. */
export const dropDish = (flow: FlowState): FlowState => skipCurrentPrice(flow);

/** Volta um prato; do primeiro, volta para a última categoria; da conferência, volta ao último prato. */
export const backPrice = (flow: FlowState): FlowState => backOnePrice(flow);
