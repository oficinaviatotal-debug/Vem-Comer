/**
 * Pratos e categorias do painel, versão nova: transforma o que o servidor manda (pratos e categorias, os mesmos da tela
 * antiga) nas telas novas. Só conta, sem React nem rede: tests/novo/dishesLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado e nenhuma regra mudou. Quem agrupa os pratos (e acha "pure" em "Purê") é o mesmo código que monta o
 * cardápio do cliente (`customer/menuGroups`), então o dono vê na mesma ordem que o cliente. O que o servidor deixa
 * fazer fica claro aqui: criar prato, **mudar nome, preço, texto e categoria** (rota nova, `PUT /api/admin/products/<id>`),
 * marcar esgotou/voltou, voltar tudo, remover, criar e remover categoria. Mudar só manda o que a pessoa de fato mexeu.
 *
 * Quem pode o quê é do servidor (dono e gerente criam e removem; a cozinha só marca o que esgotou). A tela só esconde o
 * que a pessoa não pode, para não oferecer um botão que o servidor vai recusar.
 */
import { normalizePrice } from "../assistant/assistantLogic.ts";
import { cleanItemName } from "../assistant/assistantFlow.ts";
import { toCents } from "../customer/cart.ts";
import { groupProducts, OTHER_KEY } from "../customer/menuGroups.ts";
import { isSoldOut } from "../customer/openness.ts";
import type { Menu, Product } from "../customer/types.ts";
import {
  CATS_EMPTY,
  CATS_LOADING,
  CATS_NAME_MISSING,
  CATS_NAME_TWICE,
  CATS_NONE_SUB,
  DISH_NAME_MISSING,
  DISH_NAME_TWICE,
  DISH_NO_MENU,
  DISHES_BACK,
  DISHES_EMPTY_KITCHEN,
  DISHES_EMPTY_OWNER,
  DISHES_LOADING,
  DISHES_NONE_SUB,
  DISHES_SOLD,
  DISHES_TITLE,
  DISHES_TITLE_KITCHEN,
  MENU_PRICE_BAD,
} from "../novo/copy.ts";
import { money } from "../novo/format.ts";
import type { CategoriesView, CategoryRow, DishForm, DishList, DishRow, DishesView } from "../novo/types.ts";
import { groupsBadge } from "../service/optionsDraft.ts";

export type { CategoriesView, DishForm, DishesView };

/** O primeiro toque na lixeira espera o segundo por 4 s (como o botão de remover da tela antiga). */
export const ARM_MS = 4000;

/** A busca só ajuda quando a lista já é comprida o bastante para rolar (o mesmo ponto do cardápio do cliente). */
export const SEARCH_FROM = 8;

/** A tela pergunta de novo a cada 30 s, só com ela à vista; é para ver o que outro aparelho marcou (cozinha e gerente). */
export const DISHES_POLL_MS = 30_000;

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const plain = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function notFoundText(query: string): string {
  return `Nenhum prato com “${query.trim()}”. Tente outra palavra.`;
}

export const soldOutCount = (products: readonly Pick<Product, "sold_out">[]): number => products.filter(isSoldOut).length;

/** A faixa de cima: quantos estão esgotados e o que isso quer dizer para o cliente. */
export function soldOutAlert(count: number): string {
  if (count <= 0) return "";
  const what = count === 1 ? "1 prato esgotado" : `${count} pratos esgotados`;
  return `${what}. O cliente vê, mas não consegue pedir.`;
}

/** A mesma lista com um prato marcado (ou desmarcado). Os outros não mudam. */
export function withSoldOut(products: readonly Product[], id: string, soldOut: boolean): Product[] {
  return products.map((product) => (product.id === id ? { ...product, sold_out: soldOut } : product));
}

/** "Voltou tudo": nenhum prato fica esgotado. */
export function allBack(products: readonly Product[]): Product[] {
  return products.map((product) => (isSoldOut(product) ? { ...product, sold_out: false } : product));
}

/** Prato que aponta para uma categoria que o servidor não mandou (desligada) conta como sem categoria: o dono vê todos. */
function normalized(products: readonly Product[], menus: readonly Menu[]): Product[] {
  const known = new Set(menus.map((menu) => menu.id));
  return products.map((product) => (product.menu_id && !known.has(product.menu_id) ? { ...product, menu_id: null } : product));
}

// ------------------------------------------------------------------------------------------------ pratos

export type DishesInput = {
  /** `null` até a primeira resposta do servidor: nada de "Nenhum prato ainda" enquanto não carregou. */
  products: readonly Product[] | null;
  menus: readonly Menu[] | null;
  canManage: boolean;
  query: string;
  /** O prato cuja lixeira já recebeu o primeiro toque (ou null). */
  armed: string | null;
  /** O prato que o formulário de cima está mudando (ou null/ausente). */
  editing?: string | null;
  /** Escreve o endereço da foto (ou "" quando não há): vem de `mediaUrl` do cliente da API. */
  media: (path: string | null | undefined) => string;
  error: string;
  notice: string;
};

function rowOf(product: Product, input: DishesInput): DishRow {
  const soldOut = isSoldOut(product);
  const photo = input.media(product.thumb_url);
  const badge = groupsBadge(product.option_groups?.length);
  return {
    id: product.id,
    name: product.name,
    price: money(toCents(product.price) / 100),
    photo: photo || undefined,
    soldOut,
    badge: badge || undefined,
    noPhoto: input.canManage && !photo ? true : undefined,
    toggle: soldOut ? DISHES_BACK : DISHES_SOLD,
    toggleSpoken: `${product.name} ${soldOut ? "voltou" : "esgotou"}`,
    armed: input.canManage && input.armed === product.id,
    editing: input.canManage && input.editing === product.id,
  };
}

export function dishesViewOf(input: DishesInput): DishesView {
  const { products, menus, canManage, query } = input;
  const title = canManage ? DISHES_TITLE : DISHES_TITLE_KITCHEN;

  if (products === null || menus === null) {
    // Sem resposta ainda: não diz que "não há pratos". Se a primeira busca falhou, o erro fala por si.
    const sub = input.error ? "" : DISHES_LOADING;
    return {
      title,
      sub,
      live: input.notice || sub,
      loading: true,
      canManage,
      showSearch: false,
      alert: "",
      lists: [],
      empty: "",
      categories: [],
      error: input.error,
      notice: input.notice,
    };
  }

  const all = [...products];
  const menuList = [...menus];
  const sold = soldOutCount(all);
  const searching = query.trim() !== "";
  const groups = groupProducts(normalized(all, menuList), menuList, query);

  const lists: DishList[] = groups.map((group) => ({
    key: group.key,
    // Sem nenhuma categoria criada o cabeçalho só repetiria o título da tela.
    title: group.key === OTHER_KEY ? (menuList.length > 0 ? DISH_NO_MENU : "") : group.title,
    count: plural(group.items.length, "prato", "pratos"),
    sections: group.sections.map((section) => ({
      title: section.title,
      rows: section.items.map((product) => rowOf(product, input)),
    })),
  }));

  const sub =
    all.length === 0 ? DISHES_NONE_SUB : `${plural(all.length, "prato", "pratos")}${sold > 0 ? ` · ${sold} ${sold === 1 ? "esgotado" : "esgotados"}` : ""}`;
  const empty = all.length === 0 ? (canManage ? DISHES_EMPTY_OWNER : DISHES_EMPTY_KITCHEN) : searching && lists.length === 0 ? notFoundText(query) : "";

  return {
    title,
    sub,
    live: input.notice || sub,
    loading: false,
    canManage,
    showSearch: all.length >= SEARCH_FROM,
    alert: soldOutAlert(sold),
    lists,
    empty,
    categories: menuList.map((menu) => ({ id: menu.id, name: menu.name })),
    error: input.error,
    notice: input.notice,
    hint: canManage ? noPhotoHint(all.filter((product) => !input.media(product.thumb_url)).length) : "",
  };
}

/** Diz quantos pratos estão sem foto e o que fazer; nada quando todos têm. */
export function noPhotoHint(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count === 1
    ? "1 prato está sem foto. Toque no lápis dele para pôr a foto."
    : `${count} pratos estão sem foto. Toque no lápis do prato para pôr a foto.`;
}

/** A foto nova (ou nenhuma) no prato, na lista da tela, sem esperar a próxima busca. */
export function withPhoto(products: readonly Product[], id: string, thumb: string | null, image: string | null): Product[] {
  return products.map((product) => (product.id === id ? { ...product, thumb_url: thumb, image_url: image } : product));
}

// ------------------------------------------------------------------------------------------------ prato novo

/** O formulário vazio. Depois de adicionar um prato a categoria fica (quem cadastra bebidas cadastra várias seguidas). */
export const emptyDishForm = (menuId = ""): DishForm => ({ name: "", price: "", menuId, description: "", problem: "", editId: null });

export function formAfterAdd(form: DishForm): DishForm {
  return emptyDishForm(form.menuId);
}

export function dishProblemText(problem: DishForm["problem"]): string {
  if (problem === "name") return DISH_NAME_MISSING;
  if (problem === "twice") return DISH_NAME_TWICE;
  if (problem === "price") return MENU_PRICE_BAD;
  return "";
}

export type DishToSend = { name: string; description: string; price: number; menuId: string | null };
export type DishCheck = { ok: true; dish: DishToSend } | { ok: false; problem: "name" | "twice" | "price" };

/**
 * O que o formulário diz, conferido antes de ir ao servidor: nome (limpo: "x-burguer  grande" vira "X-burguer grande"),
 * preço em reais ("49,90" ou "R$ 49,90"; nunca zero) e se o prato já existe na categoria. O servidor confere de novo.
 */
export function dishCheck(form: Pick<DishForm, "name" | "price" | "menuId" | "description">, products: readonly Product[], menus: readonly Menu[]): DishCheck {
  const name = cleanItemName(form.name);
  if (!name) return { ok: false, problem: "name" };
  const price = normalizePrice(form.price);
  if (price === null) return { ok: false, problem: "price" };
  const menuId = menus.some((menu) => menu.id === form.menuId) ? form.menuId : null;
  const same = normalized(products, menus).some((product) => (product.menu_id ?? null) === menuId && plain(product.name) === plain(name));
  if (same) return { ok: false, problem: "twice" };
  return { ok: true, dish: { name, description: form.description.replace(/\s+/g, " ").trim(), price: Number(price), menuId } };
}

// ------------------------------------------------------------------------------------------------ mudar um prato

const squash = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();

/** O preço como se escreve no campo: "25,00". Volta pelo mesmo caminho do preço novo (`normalizePrice`). */
export const priceText = (price: number | string): string => (toCents(price) / 100).toFixed(2).replace(".", ",");

/**
 * O formulário de um prato que já existe, preenchido com o que ele tem agora. Categoria que o servidor não mandou (desligada)
 * aparece como "Sem categoria", mas só vai ao servidor se a pessoa mexer nela.
 */
export function formOfDish(product: Product, menus: readonly Menu[]): DishForm {
  const known = Boolean(product.menu_id) && menus.some((menu) => menu.id === product.menu_id);
  return {
    name: product.name,
    price: priceText(product.price),
    menuId: known && product.menu_id ? product.menu_id : "",
    description: product.description ?? "",
    problem: "",
    editId: product.id,
  };
}

/** Só o que mudou. Um campo ausente não vai ao servidor e, lá, não muda. */
export type DishPatch = { name?: string; description?: string; price?: number; menuId?: string | null };
export type EditCheck = { ok: true; patch: DishPatch } | { ok: false; problem: "name" | "twice" | "price" };

/**
 * O que a pessoa mexeu no prato, conferido antes de ir ao servidor. **O nome só vai se o texto mudou**: tirar a maiúscula
 * automática de um nome que já estava assim salvo seria renomear sem ninguém pedir. Repetido só conta quando o nome ou a
 * categoria mudam (mudar só o preço nunca é barrado por um repetido que já existia), e o prato não conta contra si mesmo.
 * Sem nada mudado o `patch` vem vazio: quem chama fecha o formulário sem falar com o servidor.
 */
export function dishEditCheck(
  form: Pick<DishForm, "name" | "price" | "menuId" | "description">,
  product: Product,
  products: readonly Product[],
  menus: readonly Menu[],
): EditCheck {
  const typed = cleanItemName(form.name);
  if (!typed) return { ok: false, problem: "name" };
  const price = normalizePrice(form.price);
  if (price === null) return { ok: false, problem: "price" };

  const menuId = menus.some((menu) => menu.id === form.menuId) ? form.menuId : null;
  const was = normalized([product], menus)[0]?.menu_id ?? null;

  const patch: DishPatch = {};
  if (squash(form.name) !== squash(product.name)) patch.name = typed;
  if (squash(form.description) !== squash(product.description)) patch.description = squash(form.description);
  if (toCents(price) !== toCents(product.price)) patch.price = Number(price);
  if (menuId !== was) patch.menuId = menuId;

  if (patch.name !== undefined || patch.menuId !== undefined) {
    const name = patch.name ?? product.name;
    const finalMenu = patch.menuId !== undefined ? patch.menuId : was;
    const same = normalized(products, menus).some(
      (other) => other.id !== product.id && (other.menu_id ?? null) === finalMenu && plain(other.name) === plain(name),
    );
    if (same) return { ok: false, problem: "twice" };
  }
  return { ok: true, patch };
}

/** A mesma lista com o prato mudado, para a tela mostrar na hora o que o servidor aceitou. Os outros não mudam. */
export function withEdit(products: readonly Product[], id: string, patch: DishPatch): Product[] {
  return products.map((product) =>
    product.id !== id
      ? product
      : {
          ...product,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.price !== undefined ? { price: patch.price } : {}),
          ...(patch.menuId !== undefined ? { menu_id: patch.menuId } : {}),
        },
  );
}

// ------------------------------------------------------------------------------------------------ categorias

export type CategoriesInput = {
  menus: readonly Menu[] | null;
  products: readonly Product[] | null;
  armed: string | null;
  error: string;
  notice: string;
};

export function categoriesViewOf(input: CategoriesInput): CategoriesView {
  const { menus, products } = input;
  if (menus === null || products === null) {
    const sub = input.error ? "" : CATS_LOADING;
    return { sub, live: input.notice || sub, loading: true, rows: [], empty: "", error: input.error, notice: input.notice };
  }
  const rows: CategoryRow[] = menus.map((menu) => {
    const count = products.filter((product) => product.menu_id === menu.id).length;
    return { id: menu.id, name: menu.name, count: count === 0 ? "Nenhum prato" : plural(count, "prato", "pratos"), armed: input.armed === menu.id };
  });
  const sub = rows.length === 0 ? CATS_NONE_SUB : plural(rows.length, "categoria", "categorias");
  return { sub, live: input.notice || sub, loading: false, rows, empty: rows.length === 0 ? CATS_EMPTY : "", error: input.error, notice: input.notice };
}

export type CategoryCheck = { ok: true; name: string } | { ok: false; problem: "name" | "twice" };

export function categoryCheck(text: string, menus: readonly Menu[]): CategoryCheck {
  const name = cleanItemName(text);
  if (!name) return { ok: false, problem: "name" };
  if (menus.some((menu) => plain(menu.name) === plain(name))) return { ok: false, problem: "twice" };
  return { ok: true, name };
}

export const categoryProblemText = (problem: "" | "name" | "twice"): string =>
  problem === "name" ? CATS_NAME_MISSING : problem === "twice" ? CATS_NAME_TWICE : "";

// ------------------------------------------------------------------------------------------------ avisos

/** As frases de "feito". Dizem o nome, para quem não estava olhando saber o que mudou. */
export const dishAddedText = (name: string): string => `${name} adicionado.`;
export const dishRemovedText = (name: string): string => `${name} removido.`;
export const dishSavedText = (name: string): string => `${name} salvo.`;
export const categoryAddedText = (name: string): string => `${name} adicionada.`;
export const categoryRemovedText = (name: string): string => `${name} removida.`;

/**
 * A frase do erro. O servidor escreve em português nos erros de quem fez algo errado (400, 403, 404): essa frase passa como veio.
 * Erro do servidor (500) e falta de sinal usam a nossa, que diz o que fazer.
 */
export function wordsOf(error: unknown, fallback: string): string {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 0;
  const message = error instanceof Error ? error.message.trim() : "";
  return status >= 400 && status < 500 && message ? message : fallback;
}
