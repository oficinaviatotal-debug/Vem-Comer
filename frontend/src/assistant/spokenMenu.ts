/**
 * The menu said the way people talk: "x-tudo 25 reais, x-salada 22 e de bebida coca lata 6".
 *
 * The phone's speech recognition gives plain text with few commas. The price is what tells
 * where one dish ends: every number that is a price closes the dish before it. The rest is
 * cleaning ("eu vendo", "que custa", "a"), headings ("de bebida", "pizzas:") and a guess of the
 * category from words of the dish ("coca" is a drink, "x-" is a sandwich).
 *
 * What goes inside the dish is read too: "x-tudo custa 25, vai ter ovo, bacon, hambúrguer e salame" gives
 * the dish "X-Tudo" at 25 with the description "Ovo, bacon, hambúrguer, salame". Only words the owner
 * said are kept; nothing is made up.
 *
 * Nothing here is guessed silently: a price that does not read as a clean number is left empty
 * (the assistant asks it later), and a long run of words with no price and no "de"/"com" is
 * returned as `unclear` for the owner to tap, never saved as one strange dish.
 */

import { NUMBER_WORDS, normalizeSpeech, parseSpokenNumber } from "../onboarding/tourEngine.ts";
import { normalizePrice, stem } from "./assistantLogic.ts";

export type SpokenDish = {
  /** As it was said, tidied: "X-Tudo", "Coca lata". */
  name: string;
  /** "25.00", or "" when no price was said or it was not a clean number. */
  price: string;
  /** "Bebidas", "Lanches"... from a heading the owner said, or guessed from the dish. */
  category: string;
  /** True when the owner said the heading ("de bebida ..."); a guess is false. */
  categorySaid: boolean;
  /** What goes inside, as the owner said it: "Ovo, bacon, hambúrguer, salame". "" when nothing was said. */
  description: string;
};

export type SpokenMenu = {
  dishes: SpokenDish[];
  /** Pieces that look like several dishes glued together, shown for the owner to tap. */
  unclear: string[];
  /** The phrase ended with "pronto", "só isso", "acabou"... */
  finished: boolean;
  /** The heading in force at the end ("de bebida..."): pass it to the next phrase. "" when none was said. */
  heading: string;
  /**
   * A price said with no dish before it ("vinte e cinco" after a pause): it belongs to the last
   * dish the owner said without a price. "" when there is none.
   */
  lonePrice: string;
  /**
   * What goes inside, said with no dish ("vai ter ovo e bacon" after a pause): it belongs to the last
   * dish the owner said. "" when there is none.
   */
  loneDescription: string;
};

/* ------------------------------------------------------------------ tokens */

type Token = { norm: string; base: string; word: number };

type Tokenized = { tokens: Token[]; words: string[]; breaksAfter: Set<number> };

/** Spellings of the recognizer that differ from the menu. */
const VARIANTS: Record<string, string> = {
  xis: "x",
  burger: "burguer",
  hamburger: "hamburguer",
  mucarela: "mussarela",
  mozarela: "mussarela",
  mozzarela: "mussarela",
  mozzarella: "mussarela",
  refri: "refrigerante",
};

/** "R$ 18,50" -> "18 virgula 50"; "25reais" -> "25 reais". The commas between dishes stay. */
function prepare(transcript: string): string {
  return transcript
    .replace(/r\$\s*/gi, " ")
    .replace(/(\d)[.,:](\d{1,2})(?!\d)/g, "$1 virgula $2")
    .replace(/(\d)(?=\p{L})/gu, "$1 ");
}

function tokenize(transcript: string): Tokenized {
  const words = prepare(transcript).trim().split(/\s+/).filter(Boolean);
  const tokens: Token[] = [];
  const breaksAfter = new Set<number>();
  words.forEach((word, wordIndex) => {
    const pieces = normalizeSpeech(word).split(" ").filter(Boolean);
    for (const piece of pieces) {
      const norm = VARIANTS[piece] ?? piece;
      tokens.push({ norm, base: stem(norm), word: wordIndex });
    }
    if (pieces.length > 0 && /[,;:.!?]$/.test(word)) breaksAfter.add(tokens.length - 1);
  });
  return { tokens, words, breaksAfter };
}

/* -------------------------------------------------------------- word sets */

/** Words around a number that belong to the price ("reais", "conto", "centavos"). */
const CURRENCY = new Set(["reais", "real", "conto", "contos", "pila", "pilas", "centavos", "centavo", "r", "rs"]);

/** Between the parts of one price: "dezoito e cinquenta", "dezoito com cinquenta", "18 virgula 50". */
const GLUE = new Set(["e", "com", "virgula"]);

/** After any number, these make it part of the dish: "coca 2 litros", "açaí 500 ml". */
const MEASURES = new Set(["litro", "litros", "l", "ml", "g", "gr", "grama", "gramas", "kg", "quilo", "quilos", "kilo", "cm", "unidade", "unidades", "un"]);

/**
 * After a small number, these PLURALS make it part of the dish: "pizza quatro queijos", "x-tudo com 2 carnes".
 * Singular is a new dish after a price: "coxinha 6 queijo quente 8".
 */
const COUNTED = new Set([
  "queijos", "sabores", "pedacos", "pecas", "fatias", "pessoas", "carnes", "ovos", "hamburgueres", "burgueres",
  "bolas", "camadas", "recheios", "estacoes", "porcoes",
]);
const MAX_COUNTED = 12;

/** Without a price, a phrase with these words is talk ("agora vou falar as bebidas"), not a dish. */
const NOT_A_DISH = new Set([
  "vou", "vamos", "falar", "fala", "falei", "quero", "queria", "gostaria", "mandar", "manda", "enviar", "envia",
  "fazer", "faz", "pode", "posso", "preciso", "precisa", "colocar", "cadastrar", "ver", "saber", "sei", "estou",
  "esta", "to", "foto", "fotos", "cardapio", "menu", "preco", "precos", "valor", "ajuda", "entendi", "entende",
  "como", "onde", "quanto", "qual", "porque", "obrigado", "obrigada", "oi", "ola", "tchau", "voce", "ce",
  "agora", "comecar", "comeca", "proximo", "proxima", "voltar", "repete", "repetir", "bom", "boa", "dia",
  "tarde", "noite",
]);

/** Words that open a phrase and are not part of a dish. */
const LEAD = new Set([
  "eu", "nos", "a", "o", "os", "as", "um", "uma", "uns", "umas", "e", "mais", "tambem", "ai", "entao",
  "depois", "agora", "ainda", "aqui", "la", "ne", "que", "tenho", "tem", "temos", "vendo", "vende",
  "vendemos", "quero", "queria", "cadastrar", "cadastra", "coloca", "colocar", "coloque", "bota", "botar",
  "adicionar", "adiciona", "anota", "anotar", "meu", "minha", "meus", "minhas", "no", "na", "cardapio",
  "nao", "isso", "outro", "outra", "tipo", "sim", "ok", "olha", "bom", "ta", "pronto",
  // "vamos lá, x-tudo 25", "vou falar o x-tudo", "vamos fazer o x-salada 22": talk before the dish
  "vamos", "vamo", "bora", "vou", "vai", "falar", "fala", "falo", "fazer", "faz", "seguinte", "primeiro",
  "proximo", "proxima",
  // "eu quero que você cadastre um x-tudo": the order itself is not part of the dish
  "voce", "ce", "cadastre", "registre", "registra", "registrar", "inclua", "inclui", "incluir", "crie", "cria",
  "criar", "salve", "salva", "salvar", "adicione", "anote", "pode", "posso", "por", "favor", "gostaria", "ter",
]);

/** "gostaria de cadastrar", "preciso pra cadastrar": the little word before the order is dropped with it. */
const COMMAND_VERBS = new Set([
  "cadastrar", "registrar", "incluir", "adicionar", "anotar", "criar", "colocar", "salvar", "botar", "fazer", "falar",
]);
const COMMAND_PREPS = new Set(["de", "pra", "para"]);

/**
 * A piece that starts with one of these is talk about a price, never a dish: "unidade se for o combo 3"
 * is the price of the same drink inside a combo. It is left out instead of becoming a strange dish.
 */
const PRICE_TALK_START = new Set(["unidade", "unidades", "un"]);
/** "se for o combo", "se tiver", "se quiser": a condition, not a dish. */
const CONDITION_WORD = "se";

/** Words that close a dish before its price: "x-tudo que custa", "coca sai a", "o x-salada é". */
const TRAIL = new Set([
  "custa", "custando", "e", "a", "o", "por", "sai", "saindo", "fica", "ficando", "vale", "valor", "preco",
  "de", "no", "na", "que", "ta", "esta", "apenas", "so", "somente", "com", "em", "pra", "para",
]);

/** "pastel e coxinha a seis cada": one price for every dish of the phrase. */
const EACH = new Set(["cada", "todos", "todas", "cada um", "cada uma"]);

/** Ends the whole menu when it is the last thing said. */
const CLOSERS = ["so isso", "e isso", "era isso", "mais nada", "pronto", "acabou", "terminei", "fim", "chega"];

/** Between two dishes with no price. */
const SEPARATORS = new Set(["e", "mais", "tambem"]);

/** A dish name may hold these between words; a long run without any of them is a list. */
const CONNECTORS = new Set(["de", "do", "da", "dos", "das", "com", "sem", "ao", "a", "na", "no"]);

/** "de bebida", "na parte de lanches": the words before a heading. */
const HEADING_PREP = new Set(["de", "da", "do", "das", "dos", "na", "nas", "no", "nos", "em", "pra", "para", "parte"]);

/** After a heading: "de bebida tem coca", "lanches são x-tudo". ("é" is left out: "o suco é 8" is a dish.) */
const HEADING_TAIL = new Set(["tem", "tenho", "temos", "sao", "eu"]);

/** "tenho uma lanchonete e vendo x-tudo": what comes before these verbs is not the dish. */
const SALE_VERBS = new Set([
  "vendo", "vende", "vendemos", "faco", "fazemos", "servimos", "sirvo", "temos", "tenho", "ofereco", "oferecemos",
]);

/** Spoken heading (stemmed) -> category name on the menu. */
const HEADINGS: Record<string, string> = Object.fromEntries(
  [
    ["bebida", "Bebidas"],
    ["refrigerante", "Bebidas"],
    ["drink", "Bebidas"],
    ["suco", "Sucos"],
    ["cerveja", "Cervejas"],
    ["lanche", "Lanches"],
    ["sanduiche", "Lanches"],
    ["hamburguer", "Lanches"],
    ["pizza", "Pizzas"],
    ["salgado", "Salgados"],
    ["porcao", "Porções"],
    ["petisco", "Porções"],
    ["sobremesa", "Sobremesas"],
    ["doce", "Sobremesas"],
    ["prato", "Pratos"],
    ["marmita", "Marmitas"],
    ["refeicao", "Pratos"],
    ["espetinho", "Espetinhos"],
    ["espeto", "Espetinhos"],
    ["acai", "Açaí"],
    ["combo", "Combos"],
    ["japones", "Japonês"],
    ["sushi", "Japonês"],
    ["cafe", "Cafés"],
  ].map(([word, name]) => [stem(word), name])
);

/** Dish words (stemmed) -> the category it most likely belongs to, checked in this order. */
const GUESSES: Array<[string, string[]]> = [
  ["Lanches", ["x", "hamburguer", "burguer", "cheeseburguer", "sanduiche", "misto", "quente", "bauru", "cachorro", "dog", "beirute", "wrap", "baguete", "tapioca"]],
  ["Pizzas", ["pizza", "calzone"]],
  ["Açaí", ["acai", "cupuacu"]],
  ["Japonês", ["sushi", "temaki", "sashimi", "uramaki", "niguiri", "hossomaki", "harumaki", "gyoza", "yakisoba", "combinado"]],
  ["Espetinhos", ["espetinho", "espeto", "churrasquinho"]],
  ["Bebidas", ["coca", "cola", "refrigerante", "guarana", "fanta", "sprite", "pepsi", "soda", "suco", "agua", "cerveja", "chopp", "chope", "skol", "brahma", "heineken", "itaipava", "budweiser", "antarctica", "antartica", "vinho", "caipirinha", "caipiroska", "drink", "dose", "whisky", "uisque", "vodka", "cachaca", "energetico", "cha", "cafe", "capuccino", "cappuccino", "achocolatado", "vitamina", "lata", "litro", "ml", "long"]],
  ["Salgados", ["coxinha", "pastel", "empada", "empadinha", "esfiha", "esfirra", "kibe", "quibe", "enroladinho", "risole", "joelho", "croquete", "bolinha", "salgado", "pao"]],
  ["Porções", ["porcao", "frita", "fritas", "isca", "mandioca", "macaxeira", "aipim", "polenta", "petisco", "tabua", "batata", "calabresa", "torresmo", "camarao"]],
  ["Sobremesas", ["pudim", "mousse", "sorvete", "torta", "bolo", "brigadeiro", "doce", "sobremesa", "brownie", "pave", "cocada", "quindim", "milkshake", "picole"]],
  ["Pratos", ["prato", "pf", "executivo", "marmita", "marmitex", "quentinha", "feijoada", "parmegiana", "strogonoff", "estrogonofe", "lasanha", "file", "bife", "frango", "peixe", "moqueca", "baiao", "galinhada", "arroz", "feijao", "macarrao", "escondidinho", "carne", "picanha", "costela", "sopa", "salada", "omelete", "cuscuz", "panqueca"]],
].map(([category, words]) => [category as string, (words as string[]).map(stem)]);

export const DEFAULT_CATEGORY = "Pratos";

/** Longest dish name that is still one dish when said without a pause or a "de"/"com". */
const MAX_PLAIN_WORDS = 5;
/** Longest name at all. */
const MAX_NAME_WORDS = 9;
/** A number said before a dish with no price word is a quantity up to this ("duas coxinhas"). */
const MAX_QUANTITY = 12;

const ROUND_TENS = new Set(["vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]);

/* ---------------------------------------------------------------- numbers */

const isDigits = (word: string) => /^\d+$/.test(word);
const isNumberWord = (word: string) => NUMBER_WORDS.has(word);

/** "um"/"uma" is an article ("uma coca") unless it is clearly part of a number ("vinte e um", "um real"). */
function isNumberAt(tokens: Token[], index: number): boolean {
  const word = tokens[index]?.norm;
  if (!word) return false;
  if (isDigits(word)) return word.length <= 6;
  if (!isNumberWord(word)) return false;
  if (word !== "um" && word !== "uma") return true;
  const before = tokens[index - 1]?.norm;
  const beforeThat = tokens[index - 2]?.norm;
  const after = tokens[index + 1]?.norm;
  const afterThat = tokens[index + 2]?.norm;
  if (before === "e" && beforeThat && (isNumberWord(beforeThat) || isDigits(beforeThat))) return true;
  if (after && CURRENCY.has(after)) return true;
  return after === "e" && Boolean(afterThat) && (isDigits(afterThat!) || (isNumberWord(afterThat!) && afterThat !== "um" && afterThat !== "uma"));
}

type Run = { start: number; numEnd: number; end: number; hasCurrency: boolean };

/** The longest stretch from `start` that reads as one price: numbers, "e"/"com"/"vírgula", "reais". */
function readRun(tokenized: Tokenized, start: number): Run {
  const { tokens, breaksAfter } = tokenized;
  let last = start;
  let index = start;
  while (index < tokens.length) {
    const word = tokens[index].norm;
    if (isNumberAt(tokens, index)) {
      last = index;
      index += 1;
      if (breaksAfter.has(last)) break;
      continue;
    }
    if (GLUE.has(word) || CURRENCY.has(word)) {
      if (breaksAfter.has(index)) break;
      index += 1;
      continue;
    }
    break;
  }
  let numEnd = last + 1;

  // "vinte e cinco e cinco coxinhas": the second "cinco" is how many coxinhas, not 5 centavos.
  const lastWord = tokens[last].norm;
  const lastValue = isDigits(lastWord) ? Number(lastWord) : NUMBER_VALUE[lastWord];
  const next = tokens[numEnd];
  if (
    last - 2 >= start &&
    tokens[last - 1].norm === "e" &&
    lastValue !== undefined &&
    lastValue > 0 &&
    lastValue < 10 &&
    !ROUND_TENS.has(tokens[last - 2].norm) &&
    next &&
    !CURRENCY.has(next.norm) &&
    !GLUE.has(next.norm) &&
    !isNumberAt(tokens, numEnd)
  ) {
    numEnd = last - 1;
    return { start, numEnd, end: numEnd, hasCurrency: false };
  }

  let end = numEnd;
  let hasCurrency = false;
  while (end < tokens.length && CURRENCY.has(tokens[end].norm)) {
    hasCurrency = true;
    end += 1;
  }
  for (let i = start; i < numEnd; i += 1) if (CURRENCY.has(tokens[i].norm)) hasCurrency = true;
  return { start, numEnd, end, hasCurrency };
}

const NUMBER_VALUE: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12,
};

/** The price of a run, "25.00", or "" when it is not a clean number. */
function runPrice(tokenized: Tokenized, run: Run): string {
  const text = tokenized.tokens
    .slice(run.start, run.end)
    .map((token) => (CURRENCY.has(token.norm) ? (token.norm.startsWith("centavo") ? "centavos" : "reais") : token.norm))
    .join(" ");
  const value = parseSpokenNumber(text);
  return value === null ? "" : normalizePrice(value) ?? "";
}

/** Small whole number of a run with no currency word, for "duas coxinhas"; null otherwise. */
function quantityOf(tokenized: Tokenized, run: Run): number | null {
  if (run.hasCurrency || run.end - run.start > 3) return null;
  const value = parseSpokenNumber(
    tokenized.tokens.slice(run.start, run.numEnd).map((token) => token.norm).join(" "),
    false
  );
  if (value === null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= MAX_QUANTITY ? number : null;
}

/* ------------------------------------------------------------------ names */

function spanText(tokenized: Tokenized, from: number, to: number): string {
  const wordIndexes: number[] = [];
  for (let i = from; i < to; i += 1) {
    const word = tokenized.tokens[i].word;
    if (wordIndexes[wordIndexes.length - 1] !== word) wordIndexes.push(word);
  }
  return wordIndexes
    .map((index) => tokenized.words[index].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .join(" ")
    .replace(/(\d) virgula (\d)/g, "$1,$2");
}

/** "x tudo", "xis-tudo", "x-tudo" -> "X-Tudo"; otherwise only the first letter goes up. */
export function tidyDishName(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim().replace(/^[.,;:!?-]+|[.,;:!?-]+$/g, "").trim();
  if (!text) return "";
  text = text.replace(/^(x|xis)[\s-]+(\p{L})/iu, (_, _x, letter: string) => `X-${letter.toLocaleUpperCase("pt-BR")}`);
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/** The category a dish most likely belongs to, from its words. */
export function guessCategory(name: string): string {
  const words = normalizeSpeech(name.replace(/-/g, " "))
    .split(" ")
    .filter(Boolean)
    .map((word) => stem(VARIANTS[word] ?? word));
  for (const [category, keys] of GUESSES as Array<[string, string[]]>) {
    if (words.some((word) => keys.includes(word))) return category;
  }
  return DEFAULT_CATEGORY;
}

/** Which category a heading word names, or "" when it is not a heading. */
function headingAt(tokens: Token[], index: number): string {
  return HEADINGS[tokens[index]?.base ?? ""] ?? "";
}

/* ------------------------------------------------------------ ingredients */

/**
 * Words that say what goes inside the dish: "x-tudo 25, vai ter ovo, bacon e salame", "x-salada leva alface e tomate".
 * Only these start a list of ingredients. "com" is part of many dish names ("pizza com catupiry"), so it counts only
 * right after a price ("x-tudo 25 com ovo e bacon").
 */
const INSIDE_STRONG: string[][] = [
  ["vai", "ter"], ["vai", "levar"], ["vai", "com"], ["vai", "dentro"], ["tem", "dentro"], ["leva"], ["levam"], ["levando"],
  ["contem"], ["vem", "com"], ["feito", "com"], ["feita", "com"], ["recheado", "com"], ["recheada", "com"],
  ["ingredientes"], ["ingrediente"],
];
/** "tem" is also how a list of dishes is opened ("tem coca 6"), so it counts only after a dish or a price. */
const INSIDE_WEAK = new Set(["tem", "tendo"]);
/** Dropped at the start of each ingredient: "um ovo", "com queijo", "são ovo". */
const INSIDE_SKIP = new Set([
  "vai", "ter", "leva", "levam", "levando", "levar", "tem", "tendo", "contem", "vem", "ingredientes", "ingrediente", "dentro", "sao", "e",
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "mais", "tambem", "ainda", "com",
]);
/** The owner trails off: "e etc", "entre outros", "e tal". Dropped from the end of the list. */
const FILLER_TAILS: string[][] = [
  ["etc"], ["et", "cetera"], ["e", "tal"], ["e", "outros"], ["e", "outras"], ["entre", "outros"], ["entre", "outras"],
  ["e", "mais"], ["e", "assim", "por", "diante"], ["e", "por", "ai", "vai"], ["por", "ai"], ["e", "outras", "coisas"],
];
const MAX_INGREDIENTS = 25;
const MAX_INGREDIENT_CHARS = 60;
/** What goes inside a dish: the server takes up to 500; the menu is kept shorter so it stays readable. */
export const MAX_DESCRIPTION_CHARS = 300;

/** "Bacon" -> "bacon"; "X-Bacon" stays (a name with a capital inside is a name). */
function lowerFirst(text: string): string {
  const rest = text.slice(1);
  return rest === rest.toLocaleLowerCase("pt-BR") ? text.charAt(0).toLocaleLowerCase("pt-BR") + rest : text;
}

/** ["ovo", "bacon", "salame"] -> "Ovo, bacon, salame". Kept to the size the menu has room for. */
export function joinIngredients(items: string[]): string {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of items) {
    const item = lowerFirst(raw.replace(/\s+/g, " ").trim().replace(/^[.,;:!?-]+|[.,;:!?-]+$/g, "").trim()).slice(0, MAX_INGREDIENT_CHARS).trim();
    const id = normalizeSpeech(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    clean.push(item);
    if (clean.length >= MAX_INGREDIENTS) break;
  }
  let text = clean.join(", ");
  if (text.length > MAX_DESCRIPTION_CHARS) {
    const cut = text.slice(0, MAX_DESCRIPTION_CHARS);
    const comma = cut.lastIndexOf(", ");
    text = comma > 0 ? cut.slice(0, comma) : cut.trim();
  }
  return text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : "";
}

/** How many words at the end are a closer ("pronto", "só isso"), and whether there was one. */
function closing(tokens: Token[]): { total: number; finished: boolean } {
  let total = tokens.length;
  let finished = false;
  for (;;) {
    const tail = tokens.slice(0, total).map((token) => token.norm).join(" ");
    const closer = CLOSERS.find((phrase) => tail === phrase || tail.endsWith(` ${phrase}`));
    if (!closer) break;
    finished = true;
    total -= closer.split(" ").length;
  }
  return { total, finished };
}

type Inside = { at: number; items: string[] };

/**
 * Cuts the "what goes inside" clauses out of what was said, so the price reader does not take "ovo" and "bacon" for dishes.
 * Returns the rest of the phrase and, for each clause, where it was cut (in words of the rest) and the ingredients.
 *
 * When it is not clear where a list ends (a price follows with no pause, as in "x-tudo 25 leva ovo e bacon x-salada 22"),
 * nothing is cut: the old reading stays and the owner sees the strange name on the conference screen, never a lost price.
 */
function pullInside(transcript: string, line = false): { text: string; clauses: Inside[] } {
  const tokenized = tokenize(transcript);
  const { tokens, words, breaksAfter } = tokenized;
  const { total } = closing(tokens);
  const cuts: Array<{ a: number; b: number; items: string[] }> = [];

  /** A dish before it, a price before it ("x-tudo custa 25 vai ter..."), or nothing; and whether an "e" joined them. */
  const subjectBefore = (index: number): { kind: "price" | "dish" | "none"; joined: boolean } => {
    let j = index - 1;
    let joined = false;
    while (j >= 0 && TRAIL.has(tokens[j].norm)) {
      if (SEPARATORS.has(tokens[j].norm)) joined = true;
      j -= 1;
    }
    if (j < 0) return { kind: "none", joined };
    if (isNumberAt(tokens, j) || CURRENCY.has(tokens[j].norm)) return { kind: "price", joined };
    const word = tokens[j].norm;
    if (LEAD.has(word) || HEADING_PREP.has(word) || headingAt(tokens, j)) return { kind: "none", joined };
    return { kind: "dish", joined };
  };

  const strongAt = (index: number): number => {
    for (const sequence of INSIDE_STRONG) {
      if (sequence.every((word, offset) => tokens[index + offset]?.norm === word)) return sequence.length;
    }
    return 0;
  };

  /** Where the list that starts at `from` ends; null when it is not safe to cut. */
  const clauseEnd = (from: number, kind: "price" | "dish" | "none"): number | null => {
    let j = from;
    let stop = -1;
    let end = total;
    while (j < total) {
      if (isNumberAt(tokens, j)) {
        const run = readRun(tokenized, j);
        const next = tokens[run.numEnd];
        // "2 ovos", "200 g de carne": an amount inside the list, not a price
        const amount =
          !run.hasCurrency &&
          next &&
          (MEASURES.has(next.norm) || (COUNTED.has(next.norm) && (quantityOf(tokenized, run) ?? MAX_COUNTED + 1) <= MAX_COUNTED));
        if (amount) {
          j = run.numEnd;
          continue;
        }
        stop = j;
        break;
      }
      const lastOfWord = j + 1 >= tokens.length || tokens[j + 1].word !== tokens[j].word;
      if (lastOfWord && /[.;!?]$/.test(words[tokens[j].word]) && tokens[j].norm !== "etc") {
        end = j + 1;
        break;
      }
      j += 1;
    }
    if (stop >= 0) {
      // a price follows
      if (kind === "none") return null;
      if (kind === "dish") {
        // "x-tudo tem ovo e bacon custa 25": the list stops before "custa"; the price is the dish's
        end = stop;
        while (end > from && TRAIL.has(tokens[end - 1].norm)) end -= 1;
      } else {
        // "x-tudo 25, vai ter ovo, bacon, x-salada 22": the price after the list is the next dish's. Only a pause tells where it starts.
        let pause = -1;
        for (let k = from; k < stop; k += 1) if (breaksAfter.has(k)) pause = k;
        if (pause < 0) return null;
        end = pause + 1;
      }
    }
    return end > from ? end : null;
  };

  /** The ingredients inside [from, end): split at pauses and at "e"; "etc" and the like dropped. */
  const itemsOf = (from: number, end: number): string[] => {
    let to = end;
    for (let again = true; again; ) {
      again = false;
      for (const filler of FILLER_TAILS) {
        const start = to - filler.length;
        if (start >= from && filler.every((word, offset) => tokens[start + offset].norm === word)) {
          to = start;
          again = true;
        }
      }
    }
    const items: string[] = [];
    const add = (a: number, b: number) => {
      const text = spanText(tokenized, a, b);
      if (text) items.push(text);
    };
    const flush = (a: number, b: number) => {
      let start = a;
      while (start < b && INSIDE_SKIP.has(tokens[start].norm)) start += 1;
      if (start >= b) return;
      // the words of the piece (a word like "x-bacon" has two tokens)
      const groups: Array<[number, number]> = [];
      for (let k = start; k < b; k += 1) {
        const last = groups[groups.length - 1];
        if (last && tokens[last[1] - 1].word === tokens[k].word) last[1] = k + 1;
        else groups.push([k, k + 1]);
      }
      // Two words are one ingredient ("queijo coalho", "molho verde"). Longer with no pause and no "e":
      // the phone wrote "ovo bacon salame" for "ovo, bacon, salame"; "de/com" and a number stay with their neighbours.
      if (groups.length <= 2) {
        add(start, b);
        return;
      }
      const glue = (g: number) => CONNECTORS.has(tokens[groups[g][0]].norm);
      let g = 0;
      while (g < groups.length) {
        let h = g;
        while (h + 1 < groups.length && (glue(h) || glue(h + 1) || isNumberAt(tokens, groups[h][0]))) h += 1;
        add(groups[g][0], groups[h][1]);
        g = h + 1;
      }
    };
    let itemStart = from;
    for (let k = from; k < to; k += 1) {
      if (SEPARATORS.has(tokens[k].norm)) {
        flush(itemStart, k);
        itemStart = k + 1;
      } else if (breaksAfter.has(k)) {
        flush(itemStart, k + 1);
        itemStart = k + 1;
      }
    }
    flush(itemStart, to);
    return items;
  };

  let index = 0;
  while (index < total) {
    let length = strongAt(index);
    const word = tokens[index].norm;
    const weak = length === 0 && INSIDE_WEAK.has(word);
    const afterPrice = length === 0 && word === "com";
    if (weak || afterPrice) length = 1;
    if (length === 0) {
      index += 1;
      continue;
    }
    const subject = subjectBefore(index);
    // "tem" and "com" start a list only after a dish or a price, and not as "25 e tem coca 6" (another dish)
    const fits = weak ? subject.kind !== "none" && !subject.joined : afterPrice ? subject.kind === "price" && !subject.joined : true;
    const end = fits ? clauseEnd(index + length, subject.kind) : null;
    if (end === null) {
      index += 1;
      continue;
    }
    const items = itemsOf(index + length, end);
    if (items.length > 0) cuts.push({ a: index, b: end, items });
    index = end;
  }

  // One dish per line, written: after the only price on the line, what is left is what goes inside ("x-tudo 25 ovo, bacon, salame").
  if (line && cuts.length === 0) {
    const prices: Run[] = [];
    for (let i = 0; i < total; i += 1) {
      if (!isNumberAt(tokens, i)) continue;
      const run = readRun(tokenized, i);
      const next = tokens[run.numEnd];
      const amount =
        !run.hasCurrency &&
        next &&
        (MEASURES.has(next.norm) || (COUNTED.has(next.norm) && (quantityOf(tokenized, run) ?? MAX_COUNTED + 1) <= MAX_COUNTED));
      if (amount) {
        i = run.numEnd - 1;
        continue;
      }
      prices.push(run);
      i = Math.max(i, run.end - 1);
    }
    const only = prices.length === 1 ? prices[0] : null;
    if (only && only.start >= 1 && only.end < total && !EACH.has(tokens[only.end].norm)) {
      const items = itemsOf(only.end, total);
      if (items.length > 0) cuts.push({ a: only.end, b: total, items });
    }
  }

  if (cuts.length === 0) return { text: transcript, clauses: [] };

  const drop = new Set<number>();
  const clauses: Inside[] = [];
  let removed = 0;
  for (const cut of cuts) {
    const firstWord = tokens[cut.a].word;
    const lastWord = tokens[cut.b - 1].word;
    let count = 0;
    for (let w = firstWord; w <= lastWord; w += 1) {
      if (!drop.has(w)) {
        drop.add(w);
        count += 1;
      }
    }
    clauses.push({ at: firstWord - removed, items: cut.items });
    removed += count;
  }
  const text = words.filter((_, w) => !drop.has(w)).join(" ");
  return { text, clauses };
}

/* ---------------------------------------------------------------- reading */

type Part = { from: number; to: number };

/**
 * Turns everything the owner said into dishes. `currentCategory` is the heading that was in force
 * at the end of the previous phrase, so "de bebida: coca 6" and then "guaraná 5" both go to Bebidas.
 */
export function parseSpokenMenu(transcript: string, currentCategory = ""): SpokenMenu {
  // Written on several lines (or with ";"): one dish per line, so what comes after the price of a line is what goes inside.
  const lines = transcript.split(/[\r\n;]+/).map((piece) => piece.trim()).filter(Boolean);
  if (lines.length < 2) return readPhrase(transcript, currentCategory, false);

  const merged: SpokenMenu = { dishes: [], unclear: [], finished: false, heading: currentCategory, lonePrice: "", loneDescription: "" };
  for (const piece of lines) {
    const one = readPhrase(piece, merged.heading, true);
    const last = merged.dishes[merged.dishes.length - 1];
    // a price or a list said alone on its line belongs to the dish before it
    if (one.lonePrice) {
      if (last && !last.price) last.price = one.lonePrice;
      else if (!last && !merged.lonePrice) merged.lonePrice = one.lonePrice;
    }
    if (one.loneDescription) {
      if (last && !last.description) last.description = one.loneDescription;
      else if (!last && !merged.loneDescription) merged.loneDescription = one.loneDescription;
    }
    merged.dishes.push(...one.dishes);
    merged.unclear.push(...one.unclear);
    merged.heading = one.heading;
    merged.finished = merged.finished || one.finished;
  }
  return merged;
}

function readPhrase(transcript: string, currentCategory: string, line: boolean): SpokenMenu {
  // What goes inside the dish is cut out first, so "ovo" and "bacon" are not read as dishes.
  const inside = pullInside(transcript, line);
  const tokenized = tokenize(inside.text);
  const { tokens, breaksAfter } = tokenized;
  const dishes: SpokenDish[] = [];
  /** Where each dish sits in the tokens: its words start at `from`; the dish (with its price) goes up to `upto`. */
  const bounds: Array<{ from: number; upto: number }> = [];
  const unclear: string[] = [];
  let heading = currentCategory;
  let lonePrice = "";

  // "... pronto" / "... só isso" at the very end closes the menu.
  const closed = closing(tokens);
  const total = closed.total;
  const finished = closed.finished;

  /**
   * Drops opening words ("eu vendo", "e", "a") and reads headings ("de bebida") at the start of
   * [from, to). Returns where the dish starts and the heading that was said, if any.
   */
  const openSpan = (from: number, to: number): { start: number; said: string } => {
    let start = from;
    let said = "";
    // "tenho uma lanchonete e vendo x-tudo": start after the verb when it comes early
    for (let i = from; i < Math.min(to - 1, from + 5); i += 1) {
      if (SALE_VERBS.has(tokens[i].norm)) start = i + 1;
    }
    for (;;) {
      while (start < to && LEAD.has(tokens[start].norm) && !headingAt(tokens, start)) start += 1;
      if (start >= to) return { start, said };
      // "gostaria de cadastrar um x-tudo": the little word goes with the order
      if (start + 1 < to && COMMAND_PREPS.has(tokens[start].norm) && COMMAND_VERBS.has(tokens[start + 1].norm)) {
        start += 2;
        continue;
      }
      // "de bebida (tem) ...", "na parte de lanches ..."
      let probe = start;
      let sawPrep = false;
      while (probe < to && HEADING_PREP.has(tokens[probe].norm)) {
        probe += 1;
        sawPrep = true;
      }
      const named = headingAt(tokens, probe);
      const plural = tokens[probe]?.norm.endsWith("s") ?? false;
      const after = tokens[probe + 1];
      const pauseAfter = breaksAfter.has(probe);
      const tailAfter = after ? HEADING_TAIL.has(after.norm) : false;
      const connectorAfter = after ? CONNECTORS.has(after.norm) : false;
      if (
        named &&
        probe < to &&
        (sawPrep || pauseAfter || tailAfter || (plural && !connectorAfter)) &&
        (probe + 1 < to || pauseAfter || sawPrep || plural)
      ) {
        said = named;
        start = probe + 1;
        while (start < to && HEADING_TAIL.has(tokens[start].norm)) start += 1;
        continue;
      }
      return { start, said };
    }
  };

  /** Drops the words between the dish and its price ("que custa", "sai a"). */
  const closeSpan = (from: number, to: number): { end: number; each: boolean } => {
    let end = to;
    let each = false;
    for (;;) {
      if (end <= from) break;
      const last = tokens[end - 1].norm;
      const lastTwo = end - 2 >= from ? `${tokens[end - 2].norm} ${last}` : "";
      if (lastTwo && EACH.has(lastTwo)) {
        each = true;
        end -= 2;
      } else if (EACH.has(last)) {
        each = true;
        end -= 1;
      } else if (TRAIL.has(last)) {
        end -= 1;
      } else {
        break;
      }
    }
    return { end, each };
  };

  /** Splits [from, to) at pauses, and also at "e"/"mais" when `atAnd`. */
  const split = (from: number, to: number, atAnd: boolean): Part[] => {
    const parts: Part[] = [];
    let start = from;
    for (let i = from; i < to; i += 1) {
      if (atAnd && SEPARATORS.has(tokens[i].norm)) {
        if (i > start) parts.push({ from: start, to: i });
        start = i + 1;
        continue;
      }
      if (breaksAfter.has(i)) {
        parts.push({ from: start, to: i + 1 });
        start = i + 1;
      }
    }
    if (start < to) parts.push({ from: start, to });
    return parts;
  };

  /**
   * "um x-tudo, no x-tudo custa 25": the name said twice around a pause or a little word is one name.
   * Returns how many words the name has once the repeat is gone.
   */
  const repeatLength = (from: number, end: number): number => {
    const length = end - from;
    for (let half = 1; half * 2 <= length; half += 1) {
      const same = Array.from({ length: half }, (_, k) => tokens[from + k].norm === tokens[end - half + k].norm).every(Boolean);
      const middle = tokens.slice(from + half, end - half).map((token) => token.norm);
      if (same && middle.length <= 2 && middle.every((word) => CONNECTORS.has(word) || LEAD.has(word))) return half;
    }
    return length;
  };

  /** One dish from [from, to), cleaned; or a piece for `unclear`. */
  const addDish = (part: Part, price: string, upto = part.to) => {
    const opened = openSpan(part.from, part.to);
    if (opened.said) heading = opened.said;
    const from = opened.start;
    const { end: closedEnd } = closeSpan(from, part.to);
    if (closedEnd <= from) return;
    const end = from + repeatLength(from, closedEnd);
    const length = end - from;
    const text = spanText(tokenized, from, end);
    if (!text) return;
    const words = tokens.slice(from, end).map((token) => token.norm);
    const hasConnector = words.some((word) => CONNECTORS.has(word));
    const edgeConnector = CONNECTORS.has(words[0]) || CONNECTORS.has(words[words.length - 1]);
    if (
      length > MAX_NAME_WORDS ||
      (length > MAX_PLAIN_WORDS && !hasConnector) ||
      edgeConnector ||
      (length === 1 && words[0].length < 2)
    ) {
      unclear.push(text);
      return;
    }
    if (!price && words.some((word) => NOT_A_DISH.has(word))) return;
    // Talk about a price ("unidade se for o combo 3"): not a dish, even with a number after it.
    if (PRICE_TALK_START.has(words[0]) || words.includes(CONDITION_WORD)) return;
    const name = tidyDishName(text);
    // the same name said just before, with no price yet ("x-tudo, no x-tudo custa 25"): one dish, now with its price
    const before = dishes[dishes.length - 1];
    if (before && !before.price && normalizeSpeech(before.name.replace(/-/g, " ")) === normalizeSpeech(name.replace(/-/g, " "))) {
      before.price = price;
      if (heading) {
        before.category = heading;
        before.categorySaid = true;
      }
      bounds[bounds.length - 1].upto = Math.max(bounds[bounds.length - 1].upto, upto);
      return;
    }
    dishes.push({ name, price, category: heading || guessCategory(name), categorySaid: Boolean(heading), description: "" });
    bounds.push({ from, upto: Math.max(upto, end) });
  };

  /** A whole stretch of dish words, with the price that closed it ("" at the end of the phrase). */
  const addSpan = (from: number, to: number, price: string, eachAfter = false, priceEnd = to) => {
    const opened = openSpan(from, to);
    if (opened.said) heading = opened.said;
    const start = opened.start;
    if (start >= to) return;
    const closed = closeSpan(start, to);
    const end = closed.end;
    const each = closed.each || eachAfter;
    if (end <= start) return;
    if (!price) {
      for (const part of split(start, end, true)) addDish(part, "");
      return;
    }
    const parts = split(start, end, each);
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      addDish(part, each || last ? price : "", last ? priceEnd : part.to);
    });
  };

  const hasDishWords = (from: number, to: number) => {
    const { start } = openSpan(from, to);
    return closeSpan(start, to).end > start;
  };

  let spanStart = 0;
  let index = 0;
  while (index < total) {
    if (!isNumberAt(tokens, index)) {
      index += 1;
      continue;
    }
    const run = readRun(tokenized, index);
    if (run.end > total) run.end = Math.max(run.numEnd, total);
    const next = tokens[run.numEnd];

    // "coca 2 litros", "pizza quatro queijos": the number is part of the name.
    if (
      !run.hasCurrency &&
      run.numEnd < total &&
      next &&
      // "x-tudo 25 unidade se for o combo 3": that "unidade" opens talk about a price, it is not a measure
      !(PRICE_TALK_START.has(next.norm) && tokens[run.numEnd + 1]?.norm === CONDITION_WORD) &&
      (MEASURES.has(next.norm) || (COUNTED.has(next.norm) && (quantityOf(tokenized, run) ?? MAX_COUNTED + 1) <= MAX_COUNTED))
    ) {
      index = run.numEnd;
      continue;
    }
    // "duas coxinhas 10": a small number before a dish, with nothing waiting for a price.
    if (
      !hasDishWords(spanStart, index) &&
      run.end < total &&
      tokens[run.end] &&
      !isNumberAt(tokens, run.end) &&
      quantityOf(tokenized, run) !== null
    ) {
      index = run.end;
      continue;
    }

    const price = runPrice(tokenized, run);
    // "pastel e coxinha a seis cada": "cada" after the price gives it to every dish of the phrase
    let eachAfter = false;
    if (run.end < total && tokens[run.end].norm === "cada") {
      eachAfter = true;
      run.end += 1;
      if (run.end < total && (tokens[run.end].norm === "um" || tokens[run.end].norm === "uma")) run.end += 1;
    }
    if (!hasDishWords(spanStart, index)) {
      // a price with no dish before it: the owner paused between the dish and the price
      if (price && dishes.length === 0 && !lonePrice) lonePrice = price;
      else if (price && dishes.length > 0 && !dishes[dishes.length - 1].price) {
        dishes[dishes.length - 1].price = price;
        bounds[bounds.length - 1].upto = run.end;
      }
    } else {
      addSpan(spanStart, index, price, eachAfter, run.end);
    }
    spanStart = run.end;
    index = run.end;
  }
  addSpan(spanStart, total, "");

  // What goes inside goes to the dish it was said about: the one whose words or price surround the place it was cut from.
  const inner: string[][] = dishes.map(() => []);
  const lone: string[] = [];
  for (const clause of inside.clauses) {
    const found = tokens.findIndex((token) => token.word >= clause.at);
    const place = found < 0 ? tokens.length : found;
    let target = -1;
    bounds.forEach((bound, i) => {
      if (bound.from < place && place <= bound.upto) target = i;
    });
    if (target < 0) {
      for (let i = bounds.length - 1; i >= 0; i -= 1) {
        if (bounds[i].upto <= place) {
          target = i;
          break;
        }
      }
    }
    if (target >= 0) inner[target].push(...clause.items);
    else lone.push(...clause.items);
  }
  dishes.forEach((dish, i) => {
    dish.description = joinIngredients(inner[i]);
  });

  return { dishes, unclear, finished, lonePrice, loneDescription: joinIngredients(lone), heading };
}

/** True when what was said has at least one dish with a price: a menu, not a command. */
export function soundsLikeMenu(transcript: string): boolean {
  return parseSpokenMenu(transcript).dishes.some((dish) => dish.price);
}

/** "tira a coca", "apaga o x-tudo", "remove pastel" -> "coca", "x-tudo", "pastel". Null otherwise. */
export function parseRemoval(transcript: string): string | null {
  const text = normalizeSpeech(transcript);
  const match = /^(?:nao\s+)?(?:tira|tirar|tire|apaga|apagar|apague|remove|remover|retira|retirar|exclui|excluir|cancela|cancelar)\s+(?:o|a|os|as|esse|essa|aquele|aquela)?\s*(.+)$/.exec(text);
  if (!match) return null;
  const name = match[1].replace(/\s+(do|da)\s+cardapio$/, "").trim();
  return name && name.split(" ").length <= MAX_NAME_WORDS ? name : null;
}
