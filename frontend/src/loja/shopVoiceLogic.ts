/**
 * A bolinha de voz do cliente: entende o que ele disse e faz o que a tela já sabe fazer ("quero dois pastéis de carne",
 * "buscar suco", "abrir a sacola", "chamar o garçom"). Só conta, sem React nem rede nem microfone:
 * tests/novo/shopVoiceLogic.test.mjs roda isto no Node. O microfone e a fala ficam em `useShopVoice.ts`.
 *
 * Regras de honestidade e de dinheiro (todas com teste):
 *  - **a voz nunca envia pedido, nunca paga e nunca chama o garçom sozinha.** "Enviar o pedido" só abre a sacola; o
 *    envio é o botão de sempre. Chamar o garçom abre a tela da mesa, onde o toque é da pessoa;
 *  - o que muda é só a **sacola**, que a pessoa vê, pode corrigir e só vira pedido quando toca em Enviar. A voz diz o que
 *    pôs e como a sacola ficou, e a faixa traz o botão **Desfazer**;
 *  - **prato com tamanho ou extras não vai direto**: a voz abre as escolhas dele e a pessoa toca em Adicionar. Só o prato
 *    simples entra na sacola falando;
 *  - **não adivinha**: mais de um prato com a palavra lista os nomes e pede o nome inteiro; nenhum prato diz isso (nunca
 *    o parecido);
 *  - **só diz o que o cardápio mostra**: esgotado, indisponível e restaurante sem pedidos saem como a tela diz, e não se
 *    põe na sacola o que a tela não deixa pôr;
 *  - o que a voz promete como exemplo ("quero Pastel de carne") é um prato de verdade do cardápio, nunca inventado.
 */
import { addToCart, cartCount, cartTotalCents, decrementItem, MAX_PER_ITEM, quantityOf, type CartLine } from "../customer/cart.ts";
import { groupProducts } from "../customer/menuGroups.ts";
import { isSoldOut } from "../customer/openness.ts";
import { hasOptions, isUnavailable } from "../customer/options.ts";
import type { Menu, Product } from "../customer/types.ts";
import { plainPhraser, type Phraser } from "../novo/phrasing.ts";
import { normalizeSpeech } from "../novo/speech.ts";
import {
  SAY_OPENING,
  SAY_HERE,
  SAY_SHOP_ADDED,
  SAY_SHOP_BAG_EMPTY,
  SAY_SHOP_CHOOSE,
  SAY_SHOP_CLOSED,
  SAY_SHOP_HELP,
  SAY_SHOP_LOADING,
  SAY_SHOP_LOAD_FAIL,
  SAY_SHOP_MANY,
  SAY_SHOP_MAX,
  SAY_SHOP_NONE,
  SAY_SHOP_NOT_IN_BAG,
  SAY_SHOP_NO_ORDERS,
  SAY_SHOP_NO_TABLE,
  SAY_SHOP_REMOVED,
  SAY_SHOP_SEARCH_FOUND,
  SAY_SHOP_SEARCH_NONE,
  SAY_SHOP_SOLD,
  SAY_SHOP_SEND_HERE,
  SAY_SHOP_TABLE_HERE,
  SAY_SHOP_TO_SEND,
  SAY_SHOP_TO_TABLE,
  SAY_SHOP_UNAVAILABLE,
  SAY_SHOP_UNKNOWN,
} from "../novo/voiceCopy.ts";
import { formatMoney } from "../service/format.ts";
import { findDish, namesText, wordsOf } from "./dishFinder.ts";

export type ShopScreenName = "menu" | "bag" | "tracking" | "table";

export type ShopVoiceInput = {
  /** O que o celular ouviu. */
  transcript: string;
  /** A tela aberta agora. */
  screen: ShopScreenName;
  /** O cardápio ainda abrindo ou que não abriu: a voz diz isso, nunca "nenhum prato". */
  load: "loading" | "ready" | "error";
  products: readonly Product[];
  menus: readonly Menu[];
  cart: readonly CartLine[];
  /** O restaurante não recebe pedido agora (o servidor disse: fechado, em pausa, fora do horário). */
  closed: boolean;
  /** Veio pelo QR de uma mesa que o servidor conhece. */
  hasTable: boolean;
  /** Quantos pedidos este celular já enviou. */
  ordersCount: number;
  /** A caixa de busca existe na tela do cardápio (só aparece com cardápio comprido). */
  searchable: boolean;
  /** Quem escolhe a forma de dizer cada frase. Sem ele, sempre a forma de referência. */
  phrase?: Phraser;
};

/**
 * O que fazer com o que a pessoa disse. `toMenu` diz que a ação acontece no cardápio: quem está no acompanhamento ou na
 * mesa é levado até lá para ver o que a voz fez.
 */
export type ShopAnswer =
  | { kind: "go"; screen: ShopScreenName; say: string }
  | { kind: "stay"; say: string; warn?: boolean }
  /** Buscar no cardápio. `fill`: a caixa de busca existe e recebe o texto; sem ela, só a frase. */
  | { kind: "search"; text: string; fill: boolean; toMenu: boolean; say: string }
  /** Abrir as escolhas do prato (tamanho, extras) com a quantidade já dita. A pessoa toca em Adicionar. */
  | { kind: "choose"; product: Product; quantity: number; toMenu: boolean; say: string }
  /** Prato simples: entra na sacola agora (e a faixa oferece Desfazer). `quantity` é o que de fato cabe. */
  | { kind: "add"; product: Product; quantity: number; toMenu: boolean; say: string }
  /** Tirar da sacola `quantity` do prato. */
  | { kind: "less"; product: Product; quantity: number; say: string }
  | { kind: "unknown"; say: string };

// ---------------------------------------------------------------- como a pessoa fala

type Target = { screen: ShopScreenName; says: readonly string[] };

/** Telas e como se fala cada uma (minúsculas, sem acento). A frase mais comprida que casar vale. */
const TARGETS: readonly Target[] = [
  {
    screen: "menu",
    says: ["cardapio", "menu", "voltar", "inicio", "tela inicial", "ver os pratos", "ver pratos", "ver o cardapio", "ver cardapio", "voltar ao cardapio", "voltar para o cardapio"],
  },
  {
    screen: "bag",
    says: [
      "sacola",
      "a sacola",
      "abrir a sacola",
      "ver a sacola",
      "ver sacola",
      "minha sacola",
      "carrinho",
      "ver pedido",
      "ver o pedido",
      "fechar o pedido",
      "fechar pedido",
      "finalizar",
      "finalizar o pedido",
      "finalizar pedido",
      "terminar o pedido",
      "terminar pedido",
      "enviar o pedido",
      "enviar pedido",
      "mandar o pedido",
      "mandar pedido",
      "fazer o pedido",
      "fazer pedido",
      "fazer um pedido",
      "quero pedir",
      "pagar",
      "pagamento",
    ],
  },
  {
    screen: "tracking",
    says: [
      "acompanhar",
      "acompanhar pedido",
      "acompanhar o pedido",
      "acompanhar meu pedido",
      "onde esta meu pedido",
      "onde esta o pedido",
      "cade meu pedido",
      "cade o pedido",
      "meus pedidos",
      "ver meus pedidos",
      "status do pedido",
      "como esta meu pedido",
      "como esta o pedido",
      "quanto falta",
    ],
  },
  {
    screen: "table",
    says: ["garcom", "chamar o garcom", "chamar garcom", "chamar atendente", "chamar o atendente", "atendente", "a conta", "pedir a conta", "pedir conta", "fechar a conta", "minha mesa", "mesa"],
  },
];

/** "Meu pedido" sozinho pode ser a sacola ou o acompanhamento: quem decide é o que a pessoa tem. */
const MY_ORDER_SAYS = ["meu pedido", "o meu pedido", "pedido"];

const HELP_SAYS = ["ajuda", "me ajuda", "ajudar", "socorro", "como funciona", "o que posso falar", "o que eu posso falar", "o que falo", "o que eu falo", "o que falar", "nao sei"];

/** Quem fala em enviar, fechar ou pagar o pedido: a voz abre a sacola e diz que o envio é no botão. */
const SEND_SAYS = ["enviar", "mandar o pedido", "mandar pedido", "finalizar", "fechar o pedido", "fechar pedido", "terminar", "fazer o pedido", "fazer pedido", "fazer um pedido", "quero pedir", "pagar", "pagamento"];

const SEARCH_VERBS = ["buscar", "busca", "procurar", "procura", "encontrar", "achar", "pesquisar", "tem", "voces tem", "vcs tem", "tem algum", "tem alguma"];

/** Jeitos de pedir um prato (tudo isto também está na lista de palavras de enchimento de `dishFinder.ts`). */
const ORDER_VERBS = ["quero", "queria", "queremos", "gostaria", "vou querer", "vou pedir", "me ve", "me de", "me da", "manda", "mandar", "traz", "trazer", "poe", "poem", "bota", "botar", "coloca", "colocar", "adiciona", "adicionar", "pedir"];

const REMOVE_VERBS = ["tira", "tirar", "remove", "remover", "retira", "retirar", "cancela", "cancelar"];

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  meia: 6, // só vale em "meia dúzia"
  duzia: 12,
};

/** A frase mais comprida (em letras) de `says` que aparece em `text`; 0 se nenhuma. */
function bestMatch(text: string, says: readonly string[]): number {
  let best = 0;
  for (const phrase of says) if (phrase.length > best && text.includes(` ${phrase} `)) best = phrase.length;
  return best;
}

const has = (text: string, says: readonly string[]): boolean => bestMatch(text, says) > 0;

/** Quantidade que se fala: até 20 (número maior é tamanho do prato, como "500", e fica no nome). */
const MOST_BY_VOICE = 20;

/**
 * "Dois pastéis de carne" → 2 e o resto das palavras. Vale o primeiro número da frase: por extenso até dez, "meia dúzia",
 * "dúzia", ou em algarismos até 20 (com ou sem "x"). Sem número, 1. O número é tirado das palavras do prato, e quem chama
 * tenta primeiro **com ele** (um prato chamado "Combo 2", ou "Açaí 500").
 */
function quantityIn(words: readonly string[]): { quantity: number; rest: string[]; found: boolean } {
  const spelled = words.map((word) => word.replace(/^(\d+)x$/, "$1"));
  const index = spelled.findIndex((word) => (/^\d{1,2}$/.test(word) && Number(word) >= 1 && Number(word) <= MOST_BY_VOICE) || word in NUMBER_WORDS);
  if (index < 0) return { quantity: 1, rest: [...words], found: false };
  const word = spelled[index];
  let quantity = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];
  let skip = 1;
  // "Meia dúzia": a segunda palavra faz parte do número.
  if (word === "meia" && spelled[index + 1] === "duzia") skip = 2;
  else if (word === "meia") return { quantity: 1, rest: [...words], found: false };
  quantity = Math.min(MAX_PER_ITEM, Math.max(1, quantity));
  return { quantity, rest: [...words.slice(0, index), ...words.slice(index + skip)], found: true };
}

// ---------------------------------------------------------------- o que a sacola diz

/** "A sacola está com 3 itens, R$ 27,00." / "A sacola ficou vazia." (sempre a conta de agora). */
export function bagText(cart: readonly CartLine[]): string {
  const items = cartCount([...cart]);
  if (items === 0) return "A sacola ficou vazia.";
  return `A sacola está com ${items} ${items === 1 ? "item" : "itens"}, ${formatMoney(cartTotalCents([...cart]) / 100)}.`;
}

/** "Pastel de carne" para um, "2 unidades de Pastel de carne" para mais. */
const whatOf = (name: string, quantity: number): string => (quantity > 1 ? `${quantity} unidades de ${name}` : name);

/** A sacola depois de pôr `quantity` do prato simples (cada um respeita o máximo por prato). */
export function cartWithAdded(cart: readonly CartLine[], product: Product, quantity: number): CartLine[] {
  let next: CartLine[] = [...cart];
  for (let count = 0; count < quantity; count += 1) next = addToCart(next, product);
  return next;
}

/** A sacola depois de tirar `quantity` do prato. */
export function cartWithLess(cart: readonly CartLine[], product: Product, quantity: number): CartLine[] {
  let next: CartLine[] = [...cart];
  for (let count = 0; count < quantity; count += 1) next = decrementItem(next, product.id);
  return next;
}

// ---------------------------------------------------------------- exemplos de verdade

/** Os pratos que se pedem agora: nem esgotado, nem indisponível, e só com o restaurante recebendo pedido. */
function orderable(input: Pick<ShopVoiceInput, "products" | "closed">): Product[] {
  if (input.closed) return [];
  return input.products.filter((product) => !isSoldOut(product) && !(hasOptions(product) && isUnavailable(product)));
}

/** Até três exemplos do que a pessoa pode dizer agora; o primeiro, quando há prato que se peça, é de verdade. */
export function examplesFor(input: Pick<ShopVoiceInput, "products" | "closed" | "hasTable" | "ordersCount" | "screen">, phrase: Phraser = plainPhraser): string {
  const items: string[] = [];
  const dish = orderable(input)[0];
  if (dish) items.push(`quero ${dish.name}`);
  if (input.screen !== "bag") items.push("abrir a sacola");
  if (input.ordersCount > 0 && input.screen !== "tracking") items.push("acompanhar o pedido");
  if (input.hasTable && input.screen !== "table") items.push("chamar o garçom");
  if (input.screen !== "menu") items.push("voltar ao cardápio");
  const chosen = phrase.window("cliente.exemplos", items, 3);
  if (chosen.length === 0) return "abrir a sacola";
  if (chosen.length === 1) return chosen[0];
  return `${chosen.slice(0, -1).join(", ")} ou ${chosen[chosen.length - 1]}`;
}

const WHERE: Record<ShopScreenName, { what: string; inside: string }> = {
  menu: { what: "o cardápio", inside: "no cardápio" },
  bag: { what: "a sacola", inside: "na sacola" },
  tracking: { what: "o acompanhamento do pedido", inside: "no acompanhamento do pedido" },
  table: { what: "a tela da mesa", inside: "na tela da mesa" },
};

// ---------------------------------------------------------------- a conta

export function interpretShopVoice(input: ShopVoiceInput): ShopAnswer {
  const phrase = input.phrase ?? plainPhraser;
  // "500 ml" e "500ml" são a mesma coisa: o celular escreve de um jeito ou de outro.
  const text = normalizeSpeech(input.transcript).replace(/ (\d+) (ml|l|g|kg) /g, " $1$2 ");
  const toMenu = input.screen === "tracking" || input.screen === "table";
  const unknown = (): ShopAnswer => ({ kind: "unknown", say: phrase.say(SAY_SHOP_UNKNOWN, examplesFor(input, phrase)) });

  if (text.trim() === "") return unknown();

  // Ajuda: a frase diz o que falar agora, com exemplos reais.
  if (has(text, HELP_SAYS)) return { kind: "stay", say: phrase.say(SAY_SHOP_HELP, examplesFor(input, phrase)) };

  const target = bestTarget(text);
  const ordering = has(text, ORDER_VERBS);
  const removing = has(text, REMOVE_VERBS);
  const heard = wordsOf(text);
  // "Pedido" é palavra de tela ("ver pedido"), não de prato: não entra na busca pelo nome.
  const dishWords = heard.filter((word) => word !== "pedido" && word !== "pedidos");

  // Buscar no cardápio: "buscar suco", "tem suco?". A pergunta "tem" só vale no começo da frase.
  const search = searchOf(text);
  if (search && !ordering && !removing && !target) return searchAnswer(input, phrase, search, input.screen !== "menu");

  // Pedir ou tirar um prato: o verbo + o nome. "Quero ver a sacola" não é prato: a tela ganha quando o prato não existe.
  if ((ordering || removing) && dishWords.length > 0) {
    const result = dishAnswer(input, phrase, dishWords, removing && !ordering, toMenu);
    if (!result.none || !target) return result.answer;
  }

  if (target) return screenAnswer(input, phrase, target, text);

  // "Meu pedido": a sacola, se tem coisa nela; senão o acompanhamento, se já pediu; senão a sacola (vazia).
  if (has(text, MY_ORDER_SAYS) && dishWords.length === 0) {
    const filled = cartCount([...input.cart]) > 0;
    return screenAnswer(input, phrase, !filled && input.ordersCount > 0 ? "tracking" : "bag", text);
  }

  // Só o nome do prato ("pastel de carne", "dois açaís"): é pedir.
  if (dishWords.length > 0) {
    const result = dishAnswer(input, phrase, dishWords, false, toMenu);
    if (!result.none) return result.answer;
  }
  return unknown();
}

function bestTarget(text: string): ShopScreenName | null {
  let best: { screen: ShopScreenName; size: number } | null = null;
  for (const target of TARGETS) {
    const size = bestMatch(text, target.says);
    if (size > 0 && (!best || size > best.size)) best = { screen: target.screen, size };
  }
  return best ? best.screen : null;
}

function searchOf(text: string): string | null {
  for (const verb of [...SEARCH_VERBS].sort((a, b) => b.length - a.length)) {
    if (text.startsWith(` ${verb} `)) {
      const rest = text.slice(verb.length + 2).trim();
      return rest === "" ? null : rest;
    }
  }
  return null;
}

/** Ir a uma tela: diz "abrindo…", "você já está…" ou o que falta (sem pedido, sem mesa, sacola vazia). */
function screenAnswer(input: ShopVoiceInput, phrase: Phraser, screen: ShopScreenName, text: string): ShopAnswer {
  if (screen === input.screen) {
    // Já na sacola e quer enviar: não há o que abrir, mas a pessoa ouve onde tocar (ou que não há o que enviar).
    if (screen === "bag" && has(text, SEND_SAYS)) {
      if (cartCount([...input.cart]) > 0) return { kind: "stay", say: phrase.say(SAY_SHOP_SEND_HERE) };
      return { kind: "stay", say: phrase.say(SAY_SHOP_BAG_EMPTY, orderable(input)[0]?.name ?? ""), warn: true };
    }
    // Já na mesa: o garçom e a conta são botões desta tela; a voz diz quais.
    if (screen === "table") return { kind: "stay", say: phrase.say(SAY_SHOP_TABLE_HERE) };
    return { kind: "stay", say: phrase.say(SAY_HERE, WHERE[screen].inside) };
  }
  if (screen === "tracking" && input.ordersCount === 0) return { kind: "stay", say: phrase.say(SAY_SHOP_NO_ORDERS), warn: true };
  if (screen === "table" && !input.hasTable) return { kind: "stay", say: phrase.say(SAY_SHOP_NO_TABLE), warn: true };
  if (screen === "bag" && cartCount([...input.cart]) === 0) {
    const example = orderable(input)[0]?.name ?? "";
    return { kind: "stay", say: phrase.say(SAY_SHOP_BAG_EMPTY, example), warn: true };
  }
  // Quem falou em enviar ou pagar ouve que o envio é no botão; quem pediu a mesa ouve onde tocar para chamar.
  if (screen === "bag" && has(text, SEND_SAYS)) return { kind: "go", screen, say: phrase.say(SAY_SHOP_TO_SEND) };
  if (screen === "table") return { kind: "go", screen, say: phrase.say(SAY_SHOP_TO_TABLE) };
  return { kind: "go", screen, say: phrase.say(SAY_OPENING, WHERE[screen].what) };
}

/** Os nomes dos pratos que a tela mostraria para esta busca (a mesma conta da tela do cardápio). */
function foundNames(input: ShopVoiceInput, query: string): string[] {
  return groupProducts([...input.products], [...input.menus], query).flatMap((group) => group.items.map((item) => item.name));
}

function searchAnswer(input: ShopVoiceInput, phrase: Phraser, said: string, toMenu: boolean): ShopAnswer {
  const notReady = notReadyAnswer(input, phrase);
  if (notReady) return notReady;
  // O texto da busca são as palavras que a pessoa falou, sem os "o", "de": a mesma conta da tela.
  const text = wordsOf(said).join(" ");
  if (text === "") return { kind: "unknown", say: phrase.say(SAY_SHOP_UNKNOWN, examplesFor(input, phrase)) };
  const names = foundNames(input, text);
  const say = names.length === 0 ? phrase.say(SAY_SHOP_SEARCH_NONE, text) : phrase.say(SAY_SHOP_SEARCH_FOUND, text, namesText(names));
  return { kind: "search", text, fill: input.searchable, toMenu, say };
}

function notReadyAnswer(input: ShopVoiceInput, phrase: Phraser): ShopAnswer | null {
  if (input.load === "loading") return { kind: "stay", say: phrase.say(SAY_SHOP_LOADING), warn: true };
  if (input.load === "error") return { kind: "stay", say: phrase.say(SAY_SHOP_LOAD_FAIL), warn: true };
  return null;
}

type DishResult = { answer: ShopAnswer; none: boolean };

/**
 * Pedir (ou tirar) um prato pelo nome. `none: true` quando nenhum prato casa: quem chama decide se a frase era, na
 * verdade, um pedido de tela ("quero ver a sacola").
 */
function dishAnswer(input: ShopVoiceInput, phrase: Phraser, words: readonly string[], removing: boolean, toMenu: boolean): DishResult {
  const notReady = notReadyAnswer(input, phrase);
  if (notReady) return { answer: notReady, none: false };
  const stay = (say: string, none = false): DishResult => ({ answer: { kind: "stay", say, warn: true }, none });

  // Primeiro com todas as palavras (o número pode ser do nome: "Combo 2", "Açaí 500"); se nada casar, com o número como quantidade.
  let quantity = 1;
  let found = findDish(input.products, words);
  if (found.kind === "none") {
    const counted = quantityIn(words);
    if (counted.found && counted.rest.length > 0) {
      found = findDish(input.products, counted.rest);
      quantity = counted.quantity;
    }
  }
  if (found.kind === "none") return stay(phrase.say(SAY_SHOP_NONE), true);
  if (found.kind === "many") return stay(phrase.say(SAY_SHOP_MANY, namesText(found.names)));

  const product = found.dish;
  const name = product.name;

  if (removing) {
    const have = quantityOf([...input.cart], product.id);
    if (have === 0) return stay(phrase.say(SAY_SHOP_NOT_IN_BAG, name));
    const take = Math.min(quantity, have);
    const after = cartWithLess(input.cart, product, take);
    return { answer: { kind: "less", product, quantity: take, say: phrase.say(SAY_SHOP_REMOVED, whatOf(name, take), bagText(after)) }, none: false };
  }

  // O que a tela não deixa pedir, a voz também não pede: restaurante sem pedidos, esgotado, indisponível.
  if (input.closed) return stay(phrase.say(SAY_SHOP_CLOSED));
  if (isSoldOut(product)) return stay(phrase.say(SAY_SHOP_SOLD, name));
  if (hasOptions(product)) {
    if (isUnavailable(product)) return stay(phrase.say(SAY_SHOP_UNAVAILABLE, name));
    return { answer: { kind: "choose", product, quantity, toMenu, say: phrase.say(SAY_SHOP_CHOOSE, name, quantity) }, none: false };
  }

  const before = quantityOf([...input.cart], product.id);
  const after = cartWithAdded(input.cart, product, quantity);
  const added = quantityOf(after, product.id) - before;
  if (added <= 0) return stay(phrase.say(SAY_SHOP_MAX, name));
  return { answer: { kind: "add", product, quantity: added, toMenu, say: phrase.say(SAY_SHOP_ADDED, whatOf(name, added), bagText(after)) }, none: false };
}
