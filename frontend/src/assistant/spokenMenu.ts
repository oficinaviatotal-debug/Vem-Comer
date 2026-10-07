/**
 * The menu said the way people talk: "x-tudo 25 reais, x-salada 22 e de bebida coca lata 6".
 *
 * The phone's speech recognition gives plain text with few commas. The price is what tells
 * where one dish ends: every number that is a price closes the dish before it. The rest is
 * cleaning ("eu vendo", "que custa", "a"), headings ("de bebida", "pizzas:") and a guess of the
 * category from words of the dish ("coca" is a drink, "x-" is a sandwich).
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
]);

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

/* ---------------------------------------------------------------- reading */

type Part = { from: number; to: number };

/**
 * Turns everything the owner said into dishes. `currentCategory` is the heading that was in force
 * at the end of the previous phrase, so "de bebida: coca 6" and then "guaraná 5" both go to Bebidas.
 */
export function parseSpokenMenu(transcript: string, currentCategory = ""): SpokenMenu {
  const tokenized = tokenize(transcript);
  const { tokens, breaksAfter } = tokenized;
  const dishes: SpokenDish[] = [];
  const unclear: string[] = [];
  let heading = currentCategory;
  let finished = false;
  let lonePrice = "";

  // "... pronto" / "... só isso" at the very end closes the menu.
  let total = tokens.length;
  for (;;) {
    const tail = tokens.slice(0, total).map((token) => token.norm).join(" ");
    const closer = CLOSERS.find((phrase) => tail === phrase || tail.endsWith(` ${phrase}`));
    if (!closer) break;
    finished = true;
    total -= closer.split(" ").length;
  }

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

  /** One dish from [from, to), cleaned; or a piece for `unclear`. */
  const addDish = (part: Part, price: string) => {
    const opened = openSpan(part.from, part.to);
    if (opened.said) heading = opened.said;
    const from = opened.start;
    const { end } = closeSpan(from, part.to);
    if (end <= from) return;
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
    const name = tidyDishName(text);
    dishes.push({ name, price, category: heading || guessCategory(name), categorySaid: Boolean(heading) });
  };

  /** A whole stretch of dish words, with the price that closed it ("" at the end of the phrase). */
  const addSpan = (from: number, to: number, price: string, eachAfter = false) => {
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
    parts.forEach((part, index) => addDish(part, each || index === parts.length - 1 ? price : ""));
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
      else if (price && dishes.length > 0 && !dishes[dishes.length - 1].price) dishes[dishes.length - 1].price = price;
    } else {
      addSpan(spanStart, index, price, eachAfter);
    }
    spanStart = run.end;
    index = run.end;
  }
  addSpan(spanStart, total, "");

  return { dishes, unclear, finished, lonePrice, heading };
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
