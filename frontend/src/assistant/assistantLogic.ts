/**
 * Pure helpers for the menu assistant: understanding what the owner says.
 *
 * The phone's speech recognition returns plain lowercase text with no commas
 * and no way to tell where one dish ends and the next begins. Without a paid
 * language model the safe approach is to lean on the ready-made menu of the
 * business type: dishes that are in the template are recognised by name (even
 * with a plural, a missing accent or a one-letter recognition slip), and only
 * what is left over becomes a new dish. When what is left over looks like
 * several dishes glued together, it is reported back as "not understood"
 * instead of being saved as one strange dish.
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";

/* ------------------------------------------------------------------ tokens */

/** Words the recognizer writes differently from how the menu spells them. */
const VARIANTS: Record<string, string> = {
  xis: "x",
  burger: "burguer",
  hamburger: "hamburguer",
  cheeseburger: "cheeseburguer",
  mucarela: "mussarela",
  muzzarela: "mussarela",
  mozarela: "mussarela",
  mozzarela: "mussarela",
  mozzarella: "mussarela",
  sanduiche: "sanduiche",
  sandwich: "sanduiche",
};

/** "coxinhas" -> "coxinha", "paes" -> "pao", "limoes" -> "limao". */
export function stem(token: string): string {
  let word = token;
  if (word.length >= 4 && /(oes|aes|aos)$/.test(word)) return `${word.slice(0, -3)}ao`;
  if (word.length > 3 && word.endsWith("s")) word = word.slice(0, -1);
  return word;
}

type Token = { norm: string; word: number };

type Tokenized = {
  tokens: Token[];
  words: string[];
  /** Token indexes after which the speaker (or the keyboard) put a comma or similar. */
  breaksAfter: Set<number>;
};

function tokenize(text: string): Tokenized {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tokens: Token[] = [];
  const breaksAfter = new Set<number>();

  words.forEach((word, wordIndex) => {
    const pieces = normalizeSpeech(word).split(" ").filter(Boolean);
    for (const piece of pieces) {
      tokens.push({ norm: stem(VARIANTS[piece] ?? piece), word: wordIndex });
    }
    if (pieces.length > 0 && /[,;.!?]$/.test(word)) breaksAfter.add(tokens.length - 1);
  });

  return { tokens, words, breaksAfter };
}

function nameTokens(name: string): string[] {
  return tokenize(name).tokens.map((token) => token.norm);
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  if (a.length < b.length) return a.slice(i) === b.slice(i + 1);
  return a.slice(i + 1) === b.slice(i);
}

/** Same word, allowing one wrong letter on words long enough for that to be safe. */
function sameToken(said: string, wanted: string): boolean {
  if (said === wanted) return true;
  return said.length >= 5 && wanted.length >= 5 && editDistanceAtMostOne(said, wanted);
}

/* -------------------------------------------------------------- dish lists */

export type SpokenItems = {
  /** Indexes (in the list that was given) of the template dishes that were named. */
  matched: number[];
  /** New dishes, spelled the way the person said them. */
  custom: string[];
  /** Pieces that could not be turned into a dish (usually several dishes run together). */
  unclear: string[];
  /** The person ended the phrase with "pronto" (or similar): this category is finished. */
  finished: boolean;
};

/** Words that open a phrase ("eu tenho ...") and are not part of a dish name. */
const LEAD_WORDS = new Set([
  "eu", "meu", "meus", "minha", "minhas", "aqui", "tenho", "tem", "temos", "vendo",
  "vendemos", "sao", "quero", "queria", "adicionar", "adiciona", "coloca", "colocar",
  "tambem", "mais", "ainda", "e", "ai", "entao", "ok", "alem", "disso", "depois",
  "tambem", "outro", "outra", "outros", "outras",
]);

/** "meus pratos são ...": the plural noun before "são" is not a dish either. */
const LEAD_NOUNS = new Set([
  "prato", "lanche", "bebida", "sobremesa", "porcao", "salgado", "petisco", "pizza",
  "carne", "espetinho", "acompanhamento", "suco", "cerveja", "doce", "pao", "cafe",
  "item", "coisa",
]);

/** "coxinha e pão de queijo, pronto": the closing word is not a dish, it ends the category. */
const CLOSERS = new Set(["pronto", "terminei", "acabou", "proxima", "proximo", "fim", "chega", "passa"]);

/** Between two dishes people say "e" or "mais". */
const SEPARATORS = new Set(["e", "mais", "tambem", "alem", "depois", "ainda"]);

const CONNECTORS = new Set(["de", "do", "da", "dos", "das", "com", "sem", "ao", "a", "em", "no", "na"]);

/** More words than this without a pause is almost surely several dishes in a row. */
const MAX_CUSTOM_TOKENS = 6;
/** Five or more words with no "de"/"com" in them: most likely a list, not one name. */
const MIN_WORDS_FOR_A_RUN = 5;

function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : text;
}

function spanText(tokenized: Tokenized, from: number, to: number): string {
  const wordIndexes: number[] = [];
  for (let i = from; i < to; i += 1) {
    const word = tokenized.tokens[i].word;
    if (wordIndexes[wordIndexes.length - 1] !== word) wordIndexes.push(word);
  }
  return wordIndexes
    .map((index) => tokenized.words[index].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .join(" ");
}

type Candidate = { itemIndex: number; tokens: string[] };

/** Every way a dish may be named: the full name, and the name without "(unidade)"-style notes. */
function candidatesFor(itemNames: string[]): Candidate[] {
  const withoutNotes = itemNames.map((name) => nameTokens(name.replace(/\(.*?\)/g, " ")));
  const full = itemNames.map(nameTokens);
  const candidates: Candidate[] = [];

  itemNames.forEach((_, index) => {
    if (full[index].length > 0) candidates.push({ itemIndex: index, tokens: full[index] });
    const short = withoutNotes[index];
    const differs = short.join(" ") !== full[index].join(" ");
    const unique = withoutNotes.filter((tokens) => tokens.join(" ") === short.join(" ")).length === 1;
    if (differs && unique && short.length > 0) candidates.push({ itemIndex: index, tokens: short });
  });

  // Longest names first, so "calabresa acebolada" is taken before "calabresa".
  return candidates.sort((a, b) => b.tokens.length - a.tokens.length);
}

function findSequence(tokens: Token[], used: boolean[], wanted: string[]): number {
  for (let start = 0; start + wanted.length <= tokens.length; start += 1) {
    let ok = true;
    for (let offset = 0; offset < wanted.length; offset += 1) {
      if (used[start + offset] || !sameToken(tokens[start + offset].norm, wanted[offset])) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
  }
  return -1;
}

/**
 * Understands a phrase like "tenho x-burguer, pastel de carne e pão de queijo"
 * against the dishes of the category on screen.
 */
export function interpretSpokenItems(transcript: string, itemNames: string[]): SpokenItems {
  const tokenized = tokenize(transcript);
  const { tokens, breaksAfter } = tokenized;
  const used: boolean[] = tokens.map(() => false);
  const matched = new Set<number>();

  for (const candidate of candidatesFor(itemNames)) {
    if (matched.has(candidate.itemIndex)) continue;
    const start = findSequence(tokens, used, candidate.tokens);
    if (start < 0) continue;
    for (let offset = 0; offset < candidate.tokens.length; offset += 1) used[start + offset] = true;
    matched.add(candidate.itemIndex);
  }

  const custom: string[] = [];
  const unclear: string[] = [];
  let finished = false;

  let spanStart = -1;
  const closeSpan = (end: number) => {
    if (spanStart < 0) return;
    let from = spanStart;
    let to = end;
    spanStart = -1;

    // Closing words ("pronto") end the category; they are never part of a dish.
    while (to > from && CLOSERS.has(tokens[to - 1].norm)) {
      finished = true;
      to -= 1;
    }

    // Drop the opening words of the phrase ("eu tenho", "meus pratos são", "e").
    for (;;) {
      if (from >= to) return;
      const word = tokens[from].norm;
      if (LEAD_WORDS.has(word)) {
        from += 1;
      } else if (CLOSERS.has(word)) {
        finished = true;
        from += 1;
      } else if (LEAD_NOUNS.has(word) && from + 1 < to && tokens[from + 1].norm === "sao") {
        from += 2;
      } else {
        break;
      }
    }

    if (from >= to) return;
    end = to;
    const length = end - from;
    const text = spanText(tokenized, from, end);
    if (!text) return;

    const spanTokens = tokens.slice(from, end).map((token) => token.norm);
    const hasConnector = spanTokens.some((token) => CONNECTORS.has(token));
    const startsOrEndsWithConnector =
      CONNECTORS.has(spanTokens[0]) || CONNECTORS.has(spanTokens[spanTokens.length - 1]);
    // Several short words with no "de"/"com" between them are usually several dishes in a row.
    const looksLikeAList = length >= MIN_WORDS_FOR_A_RUN && !hasConnector;

    if (length > MAX_CUSTOM_TOKENS || startsOrEndsWithConnector || looksLikeAList) {
      unclear.push(text);
    } else if (length === 1 && tokens[from].norm.length < 3) {
      unclear.push(text);
    } else {
      custom.push(capitalize(text));
    }
  };

  for (let i = 0; i < tokens.length; i += 1) {
    if (used[i]) {
      closeSpan(i);
      continue;
    }
    if (SEPARATORS.has(tokens[i].norm)) {
      closeSpan(i);
      continue;
    }
    if (spanStart < 0) spanStart = i;
    if (breaksAfter.has(i)) closeSpan(i + 1);
  }
  closeSpan(tokens.length);

  return { matched: [...matched].sort((a, b) => a - b), custom, unclear, finished };
}

/* ----------------------------------------------------------- business type */

/** What people call their business, mapped to a template id. Words are stemmed like the speech. */
const BUSINESS_WORDS: Record<string, string[]> = {
  lanchonete: ["lanchonete", "lanche", "hamburgueria", "hamburguer", "trailer", "dogueria", "cachorro"],
  pizzaria: ["pizzaria", "pizza", "pizzaiolo"],
  restaurante: ["restaurante", "marmitaria", "marmita", "quentinha", "caseira", "comida"],
  bar: ["bar", "boteco", "botequim", "choperia"],
  acai: ["acai", "sorveteria", "sorvete", "picole", "gelateria"],
  padaria: ["padaria", "cafeteria", "confeitaria", "cafe", "doceria"],
  churrasco: ["churrasco", "churrascaria", "espetinho", "espetaria", "churrasquinho", "espeto"],
  japones: ["japones", "japonesa", "sushi", "temaki", "oriental", "sushiman"],
};

export type BusinessOption = { id: string; name: string };

/**
 * Which business type was said. Null when nothing matches or when two types
 * match (the person then taps the right card instead of the app guessing).
 */
export function matchBusinessType(transcript: string, options: BusinessOption[]): string | null {
  const said = new Set(tokenize(transcript).tokens.map((token) => token.norm));
  if (said.size === 0) return null;

  const found = new Set<string>();
  for (const option of options) {
    const words = new Set<string>(
      (BUSINESS_WORDS[option.id] ?? []).map((word) => stem(word))
    );
    // Types the server may add later still work through the words of their name.
    if (!BUSINESS_WORDS[option.id]) {
      for (const token of nameTokens(option.name)) {
        if (token.length > 3 && !CONNECTORS.has(token)) words.add(token);
      }
    }
    if ([...words].some((word) => said.has(word))) found.add(option.id);
  }

  return found.size === 1 ? [...found][0] : null;
}

/* ---------------------------------------------------------------- commands */

export type AssistantCommand =
  | "next"
  | "skip"
  | "back"
  | "repeat"
  | "confirm"
  | "all"
  | "no"
  | "none";

const COMMANDS: Array<[AssistantCommand, string[]]> = [
  ["repeat", ["repete", "repetir", "de novo", "nao entendi", "como assim", "ouvir de novo", "fala de novo"]],
  ["back", ["voltar", "volta", "anterior", "errei", "errado", "corrigir", "corrige", "de volta"]],
  [
    "confirm",
    ["cadastrar", "cadastra", "confirmar", "confirma", "salvar", "salva", "tudo certo", "esta certo",
      "ta certo", "certo", "sim", "isso mesmo", "pode ser", "ok", "beleza", "pode"],
  ],
  [
    "next",
    ["pronto", "proxima", "proximo", "continuar", "continua", "seguir", "avancar", "terminei", "terminou",
      "acabou", "so isso", "e isso", "fim", "chega", "passar", "passa", "ja falei", "pode ir"],
  ],
  ["all", ["todos", "todas", "tudo", "marcar todos", "marca todos", "seleciona tudo", "selecionar tudo"]],
  ["skip", ["pular", "pula", "nenhum", "nenhuma", "nada", "nao tenho", "nao vendo", "nao tem"]],
  ["no", ["nao", "negativo", "cancelar", "cancela"]],
];

const MAX_COMMAND_WORDS = 4;

/**
 * A short phrase that is a command ("pronto", "pular", "cadastrar"). Longer
 * phrases are dishes, never commands, so "tenho pizza de frango com pronto"
 * cannot jump a step by accident. Some dishes are made of command words ("X-Tudo"),
 * so on the dish screen look for dishes first and for commands second.
 */
export function parseAssistantCommand(transcript: string): AssistantCommand {
  const text = normalizeSpeech(transcript);
  if (!text) return "none";
  const words = text.split(" ");
  if (words.length > MAX_COMMAND_WORDS) return "none";

  const padded = ` ${text} `;
  for (const [command, phrases] of COMMANDS) {
    if (phrases.some((phrase) => padded.includes(` ${phrase} `))) return command;
  }
  return "none";
}

/* ------------------------------------------------------------------ prices */

/** "18,5", "R$ 18", "18.50" -> "18.50". Null for zero, negative, text or absurd values. */
export function normalizePrice(input: string): string | null {
  const text = input.trim().toLowerCase().replace("r$", "").replace(/\s+/g, "");
  if (!text) return null;
  const decimal = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) return null;
  const value = Number(decimal);
  if (!Number.isFinite(value) || value <= 0 || value > 99999.99) return null;
  return value.toFixed(2);
}

/** "18.50" -> "R$ 18,50" (with a dot for thousands: "R$ 1.234,50"). */
export function formatPrice(price: string): string {
  const [whole, cents = "00"] = Number(price).toFixed(2).split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/** How the voice should say it: "18 reais e 50 centavos". */
export function spokenPrice(price: string): string {
  const [whole, cents = "00"] = Number(price).toFixed(2).split(".");
  const reais = `${Number(whole)} ${Number(whole) === 1 ? "real" : "reais"}`;
  return cents === "00" ? reais : `${reais} e ${Number(cents)} centavos`;
}
