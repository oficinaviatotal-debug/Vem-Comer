/**
 * Understands a recipe card said out loud, against the ingredients the
 * restaurant already registered:
 *
 *   "frango à milanesa: 1,2 kg de peito de frango, 300 gramas de farinha de rosca,
 *    quatro ovos, rende 6 porções, porção de 250 gramas"
 *
 * Pure logic, no microphone: tests/costs/recipeSpeech.test.mjs runs it in Node.
 * Nothing is saved from here: the screen shows what was understood and the
 * owner confirms with "Salvar ficha".
 */

import { baseOf, type BaseUnit, type InputUnit, type RecipeDraftLine } from "./costLogic.ts";

export type SpeechIngredient = { id: string; name: string; unit: BaseUnit };

export type RecipeSpeech = {
  lines: RecipeDraftLine[];
  /** Pieces that did not become a line, already explained for the screen. */
  unknown: string[];
  yieldPortions: number | null;
  portionGrams: number | null;
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8,
  nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
};

const UNIT_WORDS: Record<string, InputUnit> = {
  kg: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg", quilograma: "kg", quilogramas: "kg",
  g: "g", gr: "g", grama: "g", gramas: "g",
  l: "l", litro: "l", litros: "l",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  un: "un", unidade: "un", unidades: "un",
  dz: "dz", duzia: "dz", duzias: "dz",
};

const STOP = new Set(["de", "do", "da", "dos", "das", "e", "com", "o", "a", "os", "as"]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,.;:\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word: string): string {
  if (word.length >= 4 && /(oes|aes|aos)$/.test(word)) return `${word.slice(0, -3)}ao`;
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return normalize(text)
    .replace(/[,.;:]/g, " ")
    .split(" ")
    .filter((word) => word && !STOP.has(word))
    .map(stem);
}

/** "duzentos e cinquenta" -> "250", "mil e duzentos" -> "1200", "um vírgula dois" -> "1,2". */
function numbersFromWords(text: string): string {
  const tokens = text.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!(tokens[i] in NUMBER_WORDS) && tokens[i] !== "mil") {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    let total = 0;
    let current = 0;
    let j = i;
    while (j < tokens.length) {
      const token = tokens[j];
      if (token === "mil") {
        total += (current || 1) * 1000;
        current = 0;
        j += 1;
      } else if (token in NUMBER_WORDS) {
        current += NUMBER_WORDS[token];
        j += 1;
      } else if (token === "e" && j + 1 < tokens.length && (tokens[j + 1] in NUMBER_WORDS || tokens[j + 1] === "mil")) {
        j += 1;
      } else {
        break;
      }
    }
    out.push(String(total + current));
    i = j;
  }
  return out.join(" ").replace(/(\d+) virgula (\d+)/g, "$1,$2");
}

function toNumber(text: string): number {
  return Number(text.replace(",", "."));
}

function decimalText(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace(".", ",");
}

/** "1 quilo e meio" -> "1,5 kg"; "1 kg e 200 gramas" -> "1,2 kg"; "meia duzia" -> "0,5 dz". */
function joinCompounds(text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?) ?(kg|quilos?|kilos?|l|litros?|duzias?) e (?:meio|meia)\b/g, (_, n, unit) => `${decimalText(toNumber(n) + 0.5)} ${unit}`)
    .replace(/(\d+) ?(kg|quilos?|kilos?) e (\d{1,3}) ?(?:g|gr|gramas?)?\b/g, (_, kg, _unit, g) => `${decimalText(Number(kg) + Number(g) / 1000)} kg`)
    .replace(/(\d+) ?(l|litros?) e (\d{1,3}) ?(?:ml|mililitros?)?\b/g, (_, l, _unit, ml) => `${decimalText(Number(l) + Number(ml) / 1000)} l`)
    .replace(/\b(?:meio|meia) (kg|quilos?|kilos?|l|litros?|duzias?)\b/g, (_, unit) => `0,5 ${unit}`);
}

function findIngredient(name: string, ingredients: SpeechIngredient[]): SpeechIngredient | null {
  const said = words(name);
  if (said.length === 0) return null;
  let best: SpeechIngredient | null = null;
  let bestScore = 0;
  for (const ingredient of ingredients) {
    const own = words(ingredient.name);
    if (own.length === 0) continue;
    const saidInOwn = said.every((word) => own.includes(word));
    const ownInSaid = own.every((word) => said.includes(word));
    if (!saidInOwn && !ownInSaid) continue;
    // exact names win, then the closest in size
    const score = (saidInOwn && ownInSaid ? 100 : 50) - Math.abs(own.length - said.length);
    if (score > bestScore || (score === bestScore && best && ingredient.name.length < best.name.length)) {
      best = ingredient;
      bestScore = score;
    }
  }
  return best;
}

export function parseRecipeSpeech(transcript: string, ingredients: SpeechIngredient[]): RecipeSpeech {
  let text = joinCompounds(numbersFromWords(normalize(transcript)));
  const result: RecipeSpeech = { lines: [], unknown: [], yieldPortions: null, portionGrams: null };

  const yieldMatch = text.match(/\b(?:rende|serve|da|faz|sao)\s+(\d+)\s*(?:porcao|porcoes|pratos?|pessoas?|marmitas?)\b/);
  if (yieldMatch) {
    const value = Number(yieldMatch[1]);
    if (Number.isInteger(value) && value >= 1 && value <= 500) result.yieldPortions = value;
    text = text.replace(yieldMatch[0], " ");
  }

  const gramsMatch = text.match(/\b(?:porcao|porcoes|cada prato|cada porcao)\s+(?:de|com|tem)\s+(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|kg|quilos?)\b/);
  if (gramsMatch) {
    const value = toNumber(gramsMatch[1]) * (/^(kg|quilo)/.test(gramsMatch[2]) ? 1000 : 1);
    if (value > 0) result.portionGrams = value;
    text = text.replace(gramsMatch[0], " ");
  }

  const chunks = text
    .split(/\s*(?:;|:|\.(?!\d)|,(?!\d)|(?<!\d),|\se\s(?=\d)|\smais\s(?=\d))\s*/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const taken = new Set<string>();
  for (const chunk of chunks) {
    // words before the number (the dish's name, "e", "mais") are dropped
    const match = chunk.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)?\s*(.*)$/);
    if (!match) {
      // "sal a gosto", or the dish's name said at the start: only report what looks like an ingredient
      const found = findIngredient(chunk, ingredients);
      if (found) result.unknown.push(`${found.name}: diga a quantidade (ex.: 10 gramas de ${found.name.toLowerCase()}).`);
      continue;
    }
    const quantity = toNumber(match[1]);
    let unitWord = match[2] ?? "";
    let rest = match[3] ?? "";
    let unit: InputUnit | null = UNIT_WORDS[unitWord] ?? null;
    if (!unit && unitWord) {
      // the word after the number is part of the name: "4 ovos"
      rest = `${unitWord} ${rest}`.trim();
      unitWord = "";
    }
    rest = rest.replace(/^(?:de|do|da|dos|das)\s+/, "");
    const ingredient = findIngredient(rest, ingredients);
    if (!ingredient) {
      if (rest) result.unknown.push(`${rest}: não está nos insumos. Cadastre lá embaixo e fale de novo.`);
      continue;
    }
    if (!unit && ingredient.unit === "un") unit = "un";
    if (!unit || baseOf(unit) !== ingredient.unit) {
      const hint = ingredient.unit === "g" ? "gramas ou quilos" : ingredient.unit === "ml" ? "ml ou litros" : "unidades";
      result.unknown.push(`${ingredient.name}: diga em ${hint}.`);
      continue;
    }
    if (!(quantity > 0)) continue;
    if (taken.has(ingredient.id)) {
      result.unknown.push(`${ingredient.name} apareceu duas vezes: ficou a primeira.`);
      continue;
    }
    taken.add(ingredient.id);
    result.lines.push({ ingredientId: ingredient.id, quantity: decimalText(quantity), unit });
  }

  return result;
}

/** Puts what was said into the card: lines for the same ingredient are replaced, new ones added. */
export function mergeSpokenLines(current: RecipeDraftLine[], spoken: RecipeDraftLine[]): RecipeDraftLine[] {
  const replaced = new Map(spoken.map((line) => [line.ingredientId, line]));
  const kept = current
    .filter((line) => line.ingredientId)
    .map((line) => replaced.get(line.ingredientId) ?? line);
  const keptIds = new Set(kept.map((line) => line.ingredientId));
  return [...kept, ...spoken.filter((line) => !keptIds.has(line.ingredientId))];
}
