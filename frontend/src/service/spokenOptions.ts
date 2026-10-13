/**
 * The options of a dish said the way people talk, to fill the editor without typing:
 *
 *   "tamanho pequeno, médio mais 5, grande mais 10. adicionais bacon 4, ovo 2 e meio. sem cebola"
 *
 * Pure logic, no microphone: tests/ui/spokenOptions.test.mjs runs it in Node. Nothing is saved from here: the
 * editor shows what was understood and the owner confirms with "Salvar opções".
 *
 * What a number means is never guessed in silence:
 * - "mais 5", "5 reais a mais", "+5": an extra of R$ 5,00.
 * - A bare number in a size ("grande 50") is the price of the whole dish in that size, when it is at least the
 *   price of the dish; far below it ("grande 10" on a R$ 28,50 dish) it is an extra; in between it is left empty
 *   and the owner is told, because a wrong guess here is a wrong price for every customer.
 * - A bare number anywhere else ("bacon 4") is an extra.
 */

import { NUMBER_WORDS, normalizeSpeech, parseSpokenNumber } from "../onboarding/tourEngine.ts";
import { LIMITS, type StarterKind } from "./optionsDraft.ts";

export type SpokenOptionItem = { name: string; cents: number };

export type SpokenOptionGroup = {
  name: string;
  kind: StarterKind;
  min: number;
  max: number;
  items: SpokenOptionItem[];
};

export type SpokenOptions = {
  groups: SpokenOptionGroup[];
  /** One line per group, for the screen: "Tamanho: Pequeno, Médio (+ R$ 5,00)". */
  lines: string[];
  /** What was left empty or ignored, in words for the owner. */
  notes: string[];
};

type Tok = { raw: string; norm: string; brk: boolean };

const SIZE_WORDS = new Set([
  "pequeno", "pequena", "p", "medio", "media", "m", "grande", "g", "gg", "gigante", "familia", "broto",
  "individual", "mini", "simples", "duplo", "dupla", "triplo", "meia", "inteira", "inteiro",
]);

/** Said before the first option of a group: nothing to keep. */
const FILLERS = new Set([
  "eu", "nos", "o", "a", "os", "as", "um", "uma", "uns", "umas", "tambem", "ai", "entao", "depois", "agora", "ainda",
  "ne", "tipo", "seguinte", "tem", "tenho", "temos", "ter", "vai", "pode", "podem", "posso", "da", "de", "do", "dos",
  "das", "pra", "para", "que", "cliente", "escolher", "escolhe", "opcao", "opcoes", "no", "na", "prato", "quero",
  "queria", "colocar", "coloca", "cadastrar", "adicionar", "adiciona", "grupo", "e", "ou", "com", "sao", "seria",
  "sera", "bom", "olha", "primeiro", "outro", "outra",
]);

const CLOSERS: string[][] = [["so", "isso"], ["era", "isso"], ["mais", "nada"], ["pronto"], ["acabou"], ["terminei"], ["fim"], ["chega"]];

/** After a number: the number is part of the name ("300 ml", "4 fatias"), not a price. */
const MEASURES = new Set([
  "ml", "l", "litro", "litros", "g", "gr", "grama", "gramas", "kg", "quilo", "quilos", "cm", "fatia", "fatias",
  "pedaco", "pedacos", "unidade", "unidades", "un", "bola", "bolas", "pessoa", "pessoas", "sabor", "sabores",
]);

/** Between an option and its price, or between two options: "o médio é 5", "o grande fica 10", "sai por 3". */
const GLUE_WORDS = new Set(["e", "ou", "tambem", "custa", "custam", "fica", "ficam", "sai", "saem", "vale", "valem", "por"]);

/** "o" before a size said again ("... grande o médio é 5"): only the size matters. */
const ARTICLES = new Set(["o", "a", "os", "as", "um", "uma"]);

const MONEY = new Set(["reais", "real", "conto", "contos", "pila", "pilas", "centavos", "centavo"]);

/** Heads of a group, in the words an owner uses. "tirar" and "sem" make a "Retirar" group of "Sem ..." options. */
type Head = { name: string; kind: StarterKind; sure: boolean };

const HEADS = new Map<string, Head>(Object.entries({
  tamanho: { name: "Tamanho", kind: "tamanho", sure: true },
  tamanhos: { name: "Tamanho", kind: "tamanho", sure: true },
  adicional: { name: "Adicionais", kind: "adicionais", sure: true },
  adicionais: { name: "Adicionais", kind: "adicionais", sure: true },
  extra: { name: "Adicionais", kind: "adicionais", sure: false },
  extras: { name: "Adicionais", kind: "adicionais", sure: false },
  complemento: { name: "Complementos", kind: "adicionais", sure: false },
  complementos: { name: "Complementos", kind: "adicionais", sure: false },
  retirar: { name: "Retirar", kind: "retirar", sure: true },
  retira: { name: "Retirar", kind: "retirar", sure: true },
  tirar: { name: "Retirar", kind: "retirar", sure: true },
  tira: { name: "Retirar", kind: "retirar", sure: true },
  remover: { name: "Retirar", kind: "retirar", sure: true },
  sabor: { name: "Sabor", kind: "outro", sure: false },
  sabores: { name: "Sabor", kind: "outro", sure: false },
  borda: { name: "Borda", kind: "outro", sure: false },
  bordas: { name: "Borda", kind: "outro", sure: false },
  molho: { name: "Molho", kind: "outro", sure: false },
  molhos: { name: "Molho", kind: "outro", sure: false },
  recheio: { name: "Recheio", kind: "outro", sure: false },
  recheios: { name: "Recheio", kind: "outro", sure: false },
  cobertura: { name: "Cobertura", kind: "outro", sure: false },
  coberturas: { name: "Cobertura", kind: "outro", sure: false },
  calda: { name: "Calda", kind: "outro", sure: false },
  caldas: { name: "Calda", kind: "outro", sure: false },
  massa: { name: "Massa", kind: "outro", sure: false },
  massas: { name: "Massa", kind: "outro", sure: false },
  ponto: { name: "Ponto", kind: "outro", sure: false },
} as Record<string, Head>));

const MAX_NAME_WORDS = 5;

/** "Grande", "Pizza média", "500 ml": an option that is a size. */
function isSizeName(name: string): boolean {
  const text = normalizeSpeech(name);
  return text.split(" ").some((word) => SIZE_WORDS.has(word)) || /(^| )\d+ (ml|l|litros?|g|gr|gramas?|kg|cm)( |$)/.test(text);
}

const isDigits = (word: string) => /^\d+$/.test(word);

/** Can this token be the cents or the last part of a price ("50", "cinquenta") and not the start of a name ("700 ml")? */
function endsAPrice(toks: Tok[], index: number): boolean {
  const word = toks[index]?.norm;
  if (!word || !isNumberWord(word)) return false;
  const value = Number(parseSpokenNumber(word, false));
  if (!Number.isFinite(value) || value >= 100) return false;
  const unit = toks[index + 1]?.norm;
  return !(unit && MEASURES.has(unit));
}
const isNumberWord = (word: string) => isDigits(word) || NUMBER_WORDS.has(word);

const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const cap = (text: string) => (text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : text);

/** "R$ 4,50" -> "4 virgula 50"; "+5" -> "mais 5"; "5reais" -> "5 reais"; "dois e meio" -> "dois virgula 5". */
function prepare(transcript: string): string {
  return transcript
    .replace(/r\$\s*/gi, " ")
    .replace(/\+\s*/g, " mais ")
    .replace(/(\d)[.,](\d{1,2})(?!\d)/g, "$1 virgula $2")
    .replace(/(\d)(?=\p{L})/gu, "$1 ");
}

function tokenize(transcript: string): Tok[] {
  const toks: Tok[] = [];
  for (const word of prepare(transcript).trim().split(/\s+/).filter(Boolean)) {
    const raw = word.replace(/^[,;.!?:()"']+|[,;.!?:()"']+$/g, "");
    const norm = normalizeSpeech(raw).replace(/ /g, "");
    const brk = /[,;.!?:]$/.test(word);
    if (!norm) {
      if (brk && toks.length > 0) toks[toks.length - 1].brk = true;
      continue;
    }
    toks.push({ raw, norm, brk });
  }
  return toks;
}

/** Drops "pronto", "só isso" and the like at the end. */
function withoutCloser(toks: Tok[]): Tok[] {
  const norms = toks.map((tok) => tok.norm);
  for (const closer of CLOSERS) {
    const start = norms.length - closer.length;
    if (start > 0 && closer.every((word, i) => norms[start + i] === word)) return toks.slice(0, start);
  }
  return toks;
}

/**
 * The number that starts at `from` ("5", "dois e cinquenta", "2 e meio", "4 virgula 50", "5 reais e 50 centavos").
 * Returns cents and the index after the last token used, or null when it is not a clean number.
 */
function readNumber(toks: Tok[], from: number): { cents: number; next: number } | null {
  const parts: string[] = [];
  let i = from;
  let last: "number" | "glue" | "money" | null = null;
  while (i < toks.length) {
    const norm = toks[i].norm;
    const after = toks[i + 1]?.norm;
    let used = 1;
    let ends = false;
    if (isNumberWord(norm)) {
      // two numbers in a row are one only when both are words: "vinte cinco", but not "5 10"
      if (last === "number" && (isDigits(norm) || isDigits(toks[i - 1].norm))) break;
      parts.push(norm);
      last = "number";
    } else if (norm === "virgula" && last === "number" && after && isNumberWord(after)) {
      parts.push(norm);
      last = "glue";
    } else if (norm === "e" && last !== null && last !== "glue" && after === "meio") {
      parts.push("virgula", "5");
      used = 2;
      ends = true;
    } else if (norm === "e" && last !== null && last !== "glue" && endsAPrice(toks, i + 1)) {
      parts.push(norm);
      last = "glue";
    } else if (MONEY.has(norm) && last === "number") {
      parts.push(norm);
      last = "money";
    } else {
      break;
    }
    i += used;
    if (ends || toks[i - 1].brk) break;
  }
  if (last === null) return null;
  const parsed = parseSpokenNumber(parts.join(" "));
  if (parsed === null) return null;
  const cents = Math.round(Number(parsed) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > LIMITS.maxPriceCents) return null;
  return { cents, next: i };
}

type Draft = { name: string; cents: number | null; marked: boolean };

type Building = {
  head: { name: string; kind: StarterKind };
  /** Items of a "tirar" group get "Sem " in front. */
  removal: boolean;
  items: Draft[];
};

export function parseSpokenOptions(transcript: string, basePriceCents = 0): SpokenOptions {
  const toks = withoutCloser(tokenize(transcript));
  const notes: string[] = [];
  const built: Building[] = [];
  /** The group being filled. In an object, so the helpers below and the loop see the same value. */
  const at: { group: Building | null; last: Draft | null; each: boolean } = { group: null, last: null, each: false };

  let nameWords: string[] = [];
  let nameNorms: string[] = [];

  const open = (head: { name: string; kind: StarterKind }, removal = head.kind === "retirar") => {
    const key = head.name.toLowerCase();
    const existing = built.find((group) => group.head.name.toLowerCase() === key);
    at.group = existing ?? { head, removal, items: [] };
    at.last = null;
    if (!existing) built.push(at.group);
  };

  const closeItem = () => {
    if (nameWords.length === 0) return;
    let words = nameWords;
    if (words.length > MAX_NAME_WORDS) {
      notes.push(`"${words.join(" ")}" ficou comprido: confira se não são vários itens juntos.`);
    }
    if (!at.group) open(isSizeName(words.join(" ")) ? { name: "Tamanho", kind: "tamanho" } : { name: "Opções", kind: "outro" });
    const group = at.group as Building;
    if (group.removal && nameNorms[0] !== "sem") words = ["Sem", ...words];
    const name = words.join(" ");
    // Said again ("o médio é 5" after listing the sizes): the same option, so the price lands on it
    const again = group.items.find((item) => normalizeSpeech(item.name) === normalizeSpeech(name));
    if (again) {
      at.last = again;
    } else {
      at.last = { name, cents: null, marked: false };
      group.items.push(at.last);
    }
    nameWords = [];
    nameNorms = [];
  };

  /** The price goes to the option just said; after "cada" it goes to every option still without one. */
  const givePrice = (cents: number, marked: boolean, each = at.each) => {
    closeItem();
    at.each = false;
    const group = at.group;
    const targets = each && group ? group.items.filter((item) => item.cents === null) : at.last ? [at.last] : [];
    if (targets.length === 0) {
      notes.push(`Ouvi ${money(cents)} sem saber de qual opção. Confira os preços.`);
      return;
    }
    for (const target of targets) {
      if (target.cents !== null && target.cents !== cents) {
        notes.push(`${cap(target.name)}: ouvi dois preços (${money(target.cents)} e ${money(cents)}). Ficou o primeiro, confira.`);
        continue;
      }
      target.cents = cents;
      target.marked = marked;
    }
  };

  for (let i = 0; i < toks.length; i += 1) {
    const tok = toks[i];
    const norm = tok.norm;
    const head = HEADS.get(norm);
    const atStart = nameWords.length === 0;

    // A group heading: "tamanho", "adicionais", "tirar"... The words after it ("de", ":") are fillers.
    if (head && (atStart || head.sure)) {
      // "ponto da carne" is the name of the group, not "ponto" and an option "carne..."
      let opening: Head = head;
      if (norm === "ponto" && toks[i + 1]?.norm === "da" && toks[i + 2]?.norm === "carne") {
        opening = { ...head, name: "Ponto da carne" };
        i += 2;
      }
      // Words before the first heading ("a pizza tem tamanho...") are only talk
      if (!at.group) {
        nameWords = [];
        nameNorms = [];
      } else {
        closeItem();
      }
      open(opening);
      continue;
    }

    // "sem cebola": an option of the "Retirar" group, wherever it was said
    if (norm === "sem") {
      closeItem();
      if (!at.group || !at.group.removal) open({ name: "Retirar", kind: "retirar" }, true);
      nameWords.push("Sem");
      nameNorms.push("sem");
      if (tok.brk) closeItem();
      continue;
    }

    // "mais 5": an extra for the option just said
    if (norm === "mais" && toks[i + 1] && isNumberWord(toks[i + 1].norm)) {
      const number = readNumber(toks, i + 1);
      if (number) {
        givePrice(number.cents, true);
        i = number.next - 1;
        continue;
      }
    }

    if (isNumberWord(norm)) {
      const number = readNumber(toks, i);
      // "300 ml", "4 fatias", "dois sabores": the number belongs to the name
      const unit = toks[i + 1]?.norm;
      if (number && number.next === i + 1 && unit && MEASURES.has(unit)) {
        nameWords.push(tok.raw, toks[i + 1].raw);
        nameNorms.push(norm, unit);
        i += 1;
        if (toks[i].brk) closeItem();
        continue;
      }
      if (number) {
        // "5 reais a mais": an extra said the other way round
        let next = number.next;
        let marked = false;
        const after = toks[next]?.norm;
        const further = toks[next + 1]?.norm;
        if (after === "a" && further === "mais") {
          marked = true;
          next += 2;
        } else if (after === "de" && further && ["acrescimo", "adicional", "extra"].includes(further)) {
          marked = true;
          next += 2;
        } else if (after === "extra") {
          marked = true;
          next += 1;
        }
        let each = at.each;
        if (toks[next]?.norm === "cada") {
          each = true;
          next += toks[next + 1] && ["um", "uma"].includes(toks[next + 1].norm) ? 2 : 1;
        }
        givePrice(number.cents, marked, each);
        i = next - 1;
        continue;
      }
      // not a clean number: it stays out, and the owner is told
      notes.push(`Não entendi o número "${tok.raw}". Confira o preço dessa opção.`);
      continue;
    }

    // "cada um 3 reais": the next price is for every option still without one
    if (norm === "cada" || norm === "todos" || norm === "todas") {
      closeItem();
      at.each = true;
      if (toks[i + 1] && ["um", "uma"].includes(toks[i + 1].norm)) i += 1;
      continue;
    }

    // Words that open a phrase and are not part of an option
    if (atStart && (FILLERS.has(norm) || GLUE_WORDS.has(norm) || norm === "mais")) continue;

    // Separators between options, and the words between an option and its price
    if (!atStart && (GLUE_WORDS.has(norm) || norm === "mais")) {
      closeItem();
      continue;
    }

    // "... grande o médio é 5": the article before a size said again is not part of the name
    if (!atStart && ARTICLES.has(norm) && nameNorms.every((word) => SIZE_WORDS.has(word))) {
      closeItem();
      continue;
    }

    // Sizes said in a row with no commas: "pequeno médio grande"
    if (!atStart && SIZE_WORDS.has(norm) && nameNorms.every((word) => SIZE_WORDS.has(word))) closeItem();

    nameWords.push(tok.raw);
    nameNorms.push(norm);
    if (tok.brk) closeItem();
  }
  closeItem();

  return finish(built, basePriceCents, notes);
}

/** From what was heard to groups with real extras, limits and one sentence per group. */
function finish(built: Building[], basePriceCents: number, notes: string[]): SpokenOptions {
  const groups: SpokenOptionGroup[] = [];
  const lines: string[] = [];

  for (const group of built) {
    let { name, kind } = group.head;
    if (name === "Opções" && group.items.length >= 2 && group.items.every((item) => isSizeName(item.name))) {
      name = "Tamanho";
      kind = "tamanho";
    } else if (name === "Opções" && group.items.every((item) => item.cents === null)) {
      // Words with no heading, no size and no price are most likely talk, not options: better to ask than to fill the screen with them
      notes.push(
        `Não entendi onde colocar: ${group.items.map((item) => cap(item.name)).join(", ")}. Diga antes o tipo: tamanho, adicionais ou sem...`
      );
      continue;
    } else if (name === "Opções") {
      notes.push("Não ouvi o nome do grupo (tamanho, adicionais...). Chamei de Opções: mude o nome se quiser.");
    }

    const seen = new Set<string>();
    const items: SpokenOptionItem[] = [];
    for (const item of group.items.slice(0, LIMITS.items)) {
      const key = normalizeSpeech(item.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const name60 = item.name.length > LIMITS.name ? item.name.slice(0, LIMITS.name).trim() : item.name;
      const label = cap(name60);
      let cents = 0;
      if (item.cents !== null) {
        if (kind === "retirar") {
          notes.push(`${label}: tirar um ingrediente não custa nada, então ignorei o preço.`);
        } else if (item.marked || kind !== "tamanho") {
          cents = item.cents;
        } else if (basePriceCents > 0 && item.cents >= basePriceCents) {
          cents = item.cents - basePriceCents;
        } else if (basePriceCents > 0 && item.cents * 2 > basePriceCents) {
          notes.push(
            `${label}: ouvi ${money(item.cents)}, e o prato custa ${money(basePriceCents)}. Não sei se é o preço total ou o acréscimo: deixei sem preço extra, confira.`
          );
        } else {
          cents = item.cents;
        }
      }
      items.push({ name: label, cents });
    }
    if (items.length === 0) continue;

    const pick = (n: number, top: number) => Math.min(n, top);
    const max = kind === "tamanho" ? 1 : kind === "outro" ? 1 : pick(items.length, 3);
    const min = kind === "tamanho" || name === "Sabor" || name === "Ponto da carne" ? 1 : 0;
    groups.push({ name, kind, min: Math.min(min, items.length), max: Math.max(1, max), items });

    const shown = items
      .map((item) => (item.cents > 0 ? `${item.name} (+ ${money(item.cents)})` : item.name))
      .join(", ");
    lines.push(`${name}: ${shown}`);
  }

  return { groups: groups.slice(0, LIMITS.groups), lines, notes };
}

/** Said when nothing was understood. */
export const SPOKEN_OPTIONS_HELP =
  "Fale assim: tamanho pequeno, médio mais 5, grande mais 10. Adicionais bacon 4, ovo 2 e meio. Sem cebola.";
