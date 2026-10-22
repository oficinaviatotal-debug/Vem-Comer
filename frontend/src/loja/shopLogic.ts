/**
 * O cardápio do cliente, versão nova: transforma o que o servidor manda (restaurante, categorias, pratos) e a sacola
 * nos objetos que a tela nova mostra. Só conta, sem React nem rede: tests/novo/shopLogic.test.mjs roda isto no Node.
 *
 * Nada é inventado. Cada regra é a da tela antiga (customer/menuGroups, options, openness, cart): quem decide se o
 * restaurante recebe pedido é o servidor; a tela só repete o que ele diz. O que o servidor não tem (promoção, cidade,
 * taxa no topo, "mais pedidos") não aparece.
 */
import { cartCount, cartTotalCents, quantityOf, toCents, type CartLine } from "../customer/cart.ts";
import { groupProducts } from "../customer/menuGroups.ts";
import { closedState, isSoldOut } from "../customer/openness.ts";
import { hasOptions, hasPriceVariation, isUnavailable, minPriceCents } from "../customer/options.ts";
import type { Company, Menu, Product } from "../customer/types.ts";
import type { Cart, Category, Dish, DishAction, DishGroup, Fact, Shop } from "../novo/types.ts";

export type ShopInput = {
  company: Pick<Company, "name" | "logo_thumb_url" | "accepting_orders" | "hours">;
  /** Quem entrou pelo QR da mesa: o restaurante nunca está "fechado" para quem já está sentado. */
  fromTable: boolean;
  tableNumber: number | null;
  products: readonly Product[];
  menus: readonly Menu[];
  cart: readonly CartLine[];
  query: string;
  /** Escreve o endereço da imagem (ou "" quando não há foto): vem de `mediaUrl` do cliente da API. */
  media: (path: string | null | undefined) => string;
  /** Avisos que a tela guarda por conta própria (ex.: "Pizza acabou e saiu do seu pedido."). */
  extraNotices?: readonly string[];
};

export type ShopView = {
  shop: Shop;
  facts: Fact[];
  notices: string[];
  showSearch: boolean;
  categories: Category[];
  groups: DishGroup[];
  emptyText: string;
  cart: Cart;
  /** O restaurante não recebe pedido agora: os pratos aparecem, mas nada se põe na sacola. */
  closed: boolean;
};

/** Busca só ajuda quando o cardápio já é comprido o bastante para rolar. */
export const SEARCH_FROM = 8;

/** Sem pedido nenhum no cardápio ainda: o dono está montando. */
export const BUILDING_TEXT = "O cardápio ainda está sendo montado. Chame o atendente para pedir.";

export function notFoundText(query: string): string {
  return `Nada encontrado para “${query.trim()}”. Tente outra palavra.`;
}

/** "Aberto até 23h." vira "Aberto até 23h": numa pílula o ponto final sobra. */
const withoutDot = (text: string): string => text.trim().replace(/\.$/, "");

/** A pílula de horário: só quando o restaurante cadastrou horário e não está em pausa (a pausa tem o próprio aviso). */
export function factsOf(company: Pick<Company, "hours">): Fact[] {
  const hours = company.hours;
  if (hours?.configured !== true || hours.paused) return [];
  const text = withoutDot(String(hours.message ?? ""));
  return text ? [{ text, tone: hours.open_now === true ? "open" : "closed" }] : [];
}

/** O que o toque no prato faz, na mesma ordem de prioridade da tela antiga: fechado, esgotado, escolhas, simples. */
export function dishAction(product: Product, closed: boolean): { action: DishAction; stateText?: string } {
  if (closed) return { action: "none", stateText: "Sem pedidos agora" };
  if (isSoldOut(product)) return { action: "none", stateText: "Esgotado" };
  if (hasOptions(product)) {
    return isUnavailable(product) ? { action: "none", stateText: "Indisponível agora" } : { action: "choose" };
  }
  return { action: "add" };
}

function dishOf(product: Product, cart: readonly CartLine[], closed: boolean, media: ShopInput["media"]): Dish {
  const options = hasOptions(product);
  const from = options && hasPriceVariation(product);
  const photo = media(product.thumb_url);
  const description = (product.description ?? "").trim();
  return {
    id: product.id,
    name: product.name,
    description: description || undefined,
    price: (from ? minPriceCents(product) : toCents(product.price)) / 100,
    priceFrom: from || undefined,
    photo: photo || undefined,
    ...dishAction(product, closed),
    quantity: quantityOf([...cart], product.id),
  };
}

export function shopViewOf(input: ShopInput): ShopView {
  const { company, products, menus, query } = input;
  const closedNow = closedState(company, input.fromTable);
  const closed = closedNow !== null;
  const cart = [...input.cart];
  const searching = query.trim() !== "";

  const found = groupProducts([...products], [...menus], query);
  const all = searching ? found : groupProducts([...products], [...menus], "");

  const groups: DishGroup[] = found.map((group) => ({
    key: group.key,
    title: group.title,
    sections: group.sections.map((section) => ({
      title: section.title,
      dishes: section.items.map((product) => dishOf(product, cart, closed, input.media)),
    })),
  }));

  // Os azulejos de categoria só ajudam quando há mais de uma e a pessoa não está buscando.
  const categories: Category[] =
    searching || all.length < 2
      ? []
      : all.map((group) => {
          const withPhoto = group.items.map((product) => input.media(product.thumb_url)).find(Boolean);
          return { id: group.key, label: group.title, photo: withPhoto || undefined };
        });

  const logo = input.media(company.logo_thumb_url);
  return {
    shop: {
      name: company.name,
      logo: logo || undefined,
      sub: input.tableNumber !== null && input.tableNumber > 0 ? `Mesa ${input.tableNumber}` : undefined,
    },
    facts: factsOf(company),
    notices: [...(closedNow ? [closedNow.message] : []), ...(input.extraNotices ?? [])],
    showSearch: products.length >= SEARCH_FROM,
    categories,
    groups,
    emptyText: groups.length > 0 ? "" : searching ? notFoundText(query) : BUILDING_TEXT,
    cart: { items: cartCount(cart), total: cartTotalCents(cart) / 100 },
    closed,
  };
}
