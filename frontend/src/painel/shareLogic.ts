/**
 * Divulgar (o "Meu link" do painel), versão nova: o link do restaurante, a mensagem pronta e o cartão de um prato para
 * postar. Só conta, sem React nem rede: tests/novo/shareLogic.test.mjs roda isto no Node.
 *
 * Nada aqui manda coisa a ninguém. O dono toca em copiar, em mandar no WhatsApp (abre o WhatsApp com o texto pronto, e é
 * ele quem escolhe quem recebe), em baixar a imagem ou em compartilhar o cartão. Não há lista de contatos, não há envio
 * sozinho, não há dado de cliente: só o link do restaurante, o nome, o nome e o preço de um prato.
 *
 * A regra do preço e do nome é a do cadastro: o cartão nunca inventa. Prato esgotado não vira cartão (o cliente tocaria
 * e não poderia pedir), prato sem preço válido também não.
 */
import type { Product } from "../customer/types.ts";
import { shareMessage, whatsappShareUrl } from "../nav/navLogic.ts";
import {
  SHARE_DISH_LABEL,
  SHARE_DISHES_EMPTY,
  SHARE_DISHES_NONE_NOW,
  SHARE_FORMAT_FEED,
  SHARE_FORMAT_FEED_HINT,
  SHARE_FORMAT_STATUS,
  SHARE_FORMAT_STATUS_HINT,
} from "../novo/copy.ts";
import { money } from "../novo/format.ts";
import { plainPhraser, type Phraser } from "../novo/phrasing.ts";
import { SHARE_SAY_CAPTION, SHARE_SAY_MESSAGE, SHARE_SAY_MESSAGE_NO_NAME } from "../novo/shareCopy.ts";
import type { ShareCardView, ShareDishView, ShareFormatView, ShareManual, ShareView } from "../novo/types.ts";
import { restaurantUrl } from "../service/links.ts";

export type { ShareView };

// ---------------------------------------------------------------- o link e a mensagem

/** O link do restaurante: só o restaurante, nunca mesa nem painel. */
export function shareLink(origin: string, pathname: string, slug: string): string {
  return restaurantUrl(origin, pathname, slug);
}

const cleanName = (name: string | null | undefined): string => String(name ?? "").replace(/\s+/g, " ").trim();

/** O que o cliente lê: uma frase e, na linha de baixo, só o link. */
function withLink(line: string, url: string): string {
  return `${line}\n${url}`;
}

/**
 * A mensagem pronta. Sem falador (ou com `plainPhraser`) é a de sempre da tela antiga, palavra por palavra; com o
 * falador, uma das outras formas.
 */
export function messageOf(phraser: Phraser, name: string | null | undefined, url: string): string {
  const place = cleanName(name);
  if (phraser === plainPhraser) return shareMessage(place, url);
  return withLink(place ? phraser.say(SHARE_SAY_MESSAGE, place) : phraser.say(SHARE_SAY_MESSAGE_NO_NAME), url);
}

/** Tenta algumas vezes até sair uma mensagem diferente da que está na tela (o sorteio não repete, mas a sacola pode recomeçar). */
function different(next: () => string, current: string): string {
  let text = next();
  for (let tries = 0; tries < 6 && text === current; tries += 1) text = next();
  return text;
}

/** "Outra mensagem": sempre uma forma diferente da que o dono está vendo. */
export function anotherMessage(phraser: Phraser, name: string | null | undefined, url: string, current: string): string {
  return different(() => messageOf(phraser, name, url), current);
}

/** O WhatsApp abre com o texto pronto; quem recebe é o dono quem escolhe lá. */
export function whatsappHref(text: string): string {
  return whatsappShareUrl(text);
}

// ---------------------------------------------------------------- os pratos que viram cartão

export type ShareDishInput = {
  id: string;
  name: string;
  price: number;
  /** Endereço da foto (já resolvido) ou nada. */
  photo: string | null;
};

/** Quantos pratos aparecem antes de "Ver mais". */
export const DISH_PAGE = 8;

const priceOf = (value: number | string): number => {
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
};

/**
 * Os pratos que podem virar cartão: disponíveis, com nome e preço. Os com foto vêm primeiro (o cartão com foto vende
 * mais), cada grupo na ordem do cardápio. `resolve` transforma o caminho da foto em endereço.
 */
export function dishChoices(products: readonly Product[], resolve: (path: string | null | undefined) => string): ShareDishInput[] {
  const choices: ShareDishInput[] = [];
  for (const product of products) {
    const name = cleanName(product.name);
    const price = priceOf(product.price);
    if (!name || product.sold_out || !(price > 0)) continue;
    choices.push({ id: product.id, name, price, photo: resolve(product.image_url || product.thumb_url) || null });
  }
  return [...choices.filter((dish) => dish.photo), ...choices.filter((dish) => !dish.photo)];
}

/** O texto que vai junto com o cartão: uma frase sobre o prato e o link na linha de baixo. */
export function captionOf(phraser: Phraser, dish: string, price: number, url: string): string {
  return withLink(phraser.say(SHARE_SAY_CAPTION, dish, money(price)), url);
}

export function anotherCaption(phraser: Phraser, dish: string, price: number, url: string, current: string): string {
  return different(() => captionOf(phraser, dish, price, url), current);
}

// ---------------------------------------------------------------- o cartão

export type CardFormat = "feed" | "status";

/** Largura e altura em pixels: 4:5 para o feed do Instagram e 9:16 para o status e os stories. */
export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  status: { width: 1080, height: 1920 },
};

export const CARD_FORMATS: readonly CardFormat[] = ["feed", "status"];

/** Tudo o que o desenho do cartão precisa (e nada mais): o teste confere o desenho com isto. */
export type CardSpec = {
  format: CardFormat;
  width: number;
  height: number;
  restaurant: string;
  dish: string;
  priceText: string;
  photo: string | null;
  brand: boolean;
  /** O link sem "https://", para caber no cartão. */
  linkText: string;
};

const RESTAURANT_MAX = 40;
const DISH_MAX = 60;

function cut(text: string, max: number): string {
  const clean = cleanName(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** O link do jeito que cabe numa imagem: sem "https://" e sem a barra do fim. */
export function linkForCard(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function cardSpec(input: { format: CardFormat; restaurant: string | null | undefined; dish: ShareDishInput; url: string; brand: boolean }): CardSpec {
  const size = CARD_SIZES[input.format];
  return {
    format: input.format,
    width: size.width,
    height: size.height,
    restaurant: cut(input.restaurant ?? "", RESTAURANT_MAX),
    dish: cut(input.dish.name, DISH_MAX),
    priceText: money(input.dish.price),
    photo: input.dish.photo,
    brand: input.brand,
    linkText: linkForCard(input.url),
  };
}

/** Nome do arquivo que vai para a galeria: sem acento, sem espaço, nunca vazio. */
export function cardFileName(dish: string, format: CardFormat): string {
  const slug = cleanName(dish)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug ? `cartao-${slug}-${format}.png` : `cartao-${format}.png`;
}

// ---------------------------------------------------------------- o que a tela mostra

export type ShareInput = {
  person: string;
  /** O nome do restaurante, para a mensagem e o cartão. */
  name: string;
  link: string;
  message: string;
  /** A situação da busca dos pratos. */
  load: "loading" | "ready" | "error";
  error: string;
  /** Todos os pratos que podem virar cartão (já filtrados por `dishChoices`) e quantos produtos o cardápio tem. */
  dishes: readonly ShareDishInput[];
  totalProducts: number;
  showAll: boolean;
  selectedId: string | null;
  format: CardFormat;
  brand: boolean;
  caption: string;
  /** A imagem pronta (endereço) ou nada enquanto monta. */
  image: string | null;
  busy: boolean;
  cardError: string;
  canSendFile: boolean;
  copied: ShareManual["id"] | null;
  manual: ShareManual | null;
  live: string;
};

const FORMAT_TEXT: Record<CardFormat, { label: string; hint: string }> = {
  feed: { label: SHARE_FORMAT_FEED, hint: SHARE_FORMAT_FEED_HINT },
  status: { label: SHARE_FORMAT_STATUS, hint: SHARE_FORMAT_STATUS_HINT },
};

function formatsOf(selected: CardFormat): ShareFormatView[] {
  return CARD_FORMATS.map((id) => ({ id, label: FORMAT_TEXT[id].label, hint: FORMAT_TEXT[id].hint, selected: id === selected }));
}

function dishViews(input: ShareInput): ShareDishView[] {
  const shown = input.showAll ? input.dishes : input.dishes.slice(0, DISH_PAGE);
  return shown.map((dish) => ({
    id: dish.id,
    name: dish.name,
    priceText: money(dish.price),
    photo: dish.photo,
    selected: dish.id === input.selectedId,
    label: `${SHARE_DISH_LABEL(dish.name)}, ${money(dish.price)}`,
  }));
}

function cardOf(input: ShareInput): ShareCardView | null {
  const dish = input.dishes.find((candidate) => candidate.id === input.selectedId);
  if (!dish) return null;
  const priceText = money(dish.price);
  const format = FORMAT_TEXT[input.format].label;
  return {
    dishName: dish.name,
    caption: input.caption,
    formats: formatsOf(input.format),
    brand: input.brand,
    image: input.image,
    busy: input.busy,
    error: input.cardError,
    canSendFile: input.canSendFile,
    alt: `Cartão de ${dish.name}, ${priceText}, no tamanho ${format}`,
    captionHref: whatsappHref(input.caption),
  };
}

export function shareViewOf(input: ShareInput): ShareView {
  const ready = input.load === "ready";
  const dishes = ready ? dishViews(input) : [];
  const hidden = ready && !input.showAll ? Math.max(0, input.dishes.length - DISH_PAGE) : 0;
  return {
    sub: input.person,
    link: input.link,
    openHref: input.link,
    message: input.message,
    messageHref: whatsappHref(input.message),
    load: input.load,
    error: input.load === "error" ? input.error : "",
    dishes,
    hiddenDishes: hidden,
    dishesHint: ready && input.dishes.length === 0 ? (input.totalProducts > 0 ? SHARE_DISHES_NONE_NOW : SHARE_DISHES_EMPTY) : "",
    card: ready ? cardOf(input) : null,
    copied: input.copied,
    manual: input.manual,
    live: input.live,
  };
}
