/**
 * The delivery regions said the way people talk, to fill the "Entrega" tab without typing:
 *
 *   "Centro, taxa 5 reais, CEP 30110 e 30120, pedido mínimo 20, prazo 40 minutos. Norte, taxa 8, CEP 31000."
 *
 * Pure logic, no microphone: tests/ui/spokenZones.test.mjs runs it in Node. Nothing is saved from here: the editor
 * shows what was understood and the owner confirms with "Salvar".
 *
 * How it reads:
 * - words before a keyword (taxa, CEP, mínimo, prazo) are the name of the region; a new region starts at the next
 *   name after one that already has data, or after a full stop;
 * - "taxa", "frete", "por" before a value, or "grátis"/"sem taxa", set the fee; "mínimo" the minimum order;
 * - a number of 5 to 8 digits is the start of a CEP (with or without the word CEP); "30.110" and "30110-000" read too;
 * - "40 minutos", "meia hora", "uma hora e meia" or "prazo 40" set the time;
 * - what it could not use is said in `notes`, never guessed in silence.
 */

import { NUMBER_WORDS, normalizeSpeech, parseSpokenNumber } from "../onboarding/tourEngine.ts";
import { LIMITS, reais, type SpokenZone } from "./deliveryDraft.ts";

export type SpokenZones = {
  zones: SpokenZone[];
  /** One line per region, for the screen: "Centro: CEP 30110, 30120 · taxa R$ 5,00". */
  lines: string[];
  /** What was left out or could not be read, in words for the owner. */
  notes: string[];
};

export const SPOKEN_ZONES_HELP =
  "Fale assim: Centro, taxa 5, CEP 30110 e 30120, pedido mínimo 20, prazo 40 minutos. Depois a próxima região.";

type Tok = { raw: string; norm: string; brk: boolean };

const CEP_WORDS = new Set(["cep", "ceps", "cepe", "sep", "seps"]);
const FEE_WORDS = new Set(["taxa", "frete", "cobro", "cobramos", "cobra", "cobrar", "custa", "fica", "ficando"]);
const MIN_WORDS = new Set(["minimo", "minima", "minimos"]);
const FREE_WORDS = new Set(["gratis", "gratuita", "gratuito", "graca"]);
const TIME_WORDS = new Set(["prazo", "tempo", "demora", "leva", "levamos", "demoramos"]);
const MINUTE_WORDS = new Set(["minuto", "minutos", "min", "mins"]);
const HOUR_WORDS = new Set(["hora", "horas", "h"]);
const MONEY_WORDS = new Set(["reais", "real", "centavos", "centavo", "virgula"]);

/** Never part of a name, wherever they are. */
const SKIP = new Set(["dentro", "aproximadamente", "cerca", "uns", "umas", "ate", "mais", "ou"]);

/** Said before the name of a region: nothing to keep. */
const LEAD = new Set([
  "e", "o", "a", "os", "as", "um", "uma", "tambem", "depois", "agora", "ainda", "entao", "ai", "tem", "temos", "ter",
  "no", "na", "nos", "nas", "em", "para", "pra", "pro", "pelo", "regiao", "regioes", "bairro", "bairros",
  "entrego", "entregamos", "entregar", "entrega", "entregas", "faco", "fazemos", "fazer", "atendo", "atendemos",
  "cobre", "cobrindo", "cobrimos", "eu", "gente", "quero", "queria", "cadastrar", "cadastra", "adicionar", "adiciona", "colocar",
  "coloca", "seguinte", "olha", "de", "da", "do", "das", "dos", "que", "sao", "seria", "com", "pedido", "valor",
  "um", "so", "sem",
]);

/** "nova região Centro": these only count as filler when a region word follows ("Nova Lima" is a name). */
const LEAD_BEFORE_REGION = new Set(["nova", "novo", "outra", "outro", "primeira", "primeiro", "proxima", "proximo", "segunda", "segundo"]);
const REGION_WORDS = new Set(["regiao", "regioes", "bairro", "bairros", "area"]);

/** Connectives left at the end of a name, right before its keyword: "Centro, pedido mínimo 20" -> "Centro". */
const TRAIL = new Set(["pedido", "a", "o", "os", "as", "de", "da", "do", "das", "dos", "com", "e", "tem", "ele", "ela", "cobra", "fica", "sai", "por", "em", "no", "na", "valor", "um", "uma"]);

const CLOSERS: string[][] = [["so", "isso"], ["era", "isso"], ["mais", "nada"], ["pronto"], ["acabou"], ["terminei"], ["fim"], ["chega"]];

/** Between a keyword and its value: "taxa de 5", "taxa é 5", "mínimo a partir de 20". */
const GLUE = new Set(["de", "do", "da", "e", "eh", "era", "sera", "seria", "igual", "a", "partir", "um", "uma", "por", "com"]);

const isDigits = (word: string) => /^\d+$/.test(word);
const isNumberWord = (word: string) => isDigits(word) || NUMBER_WORDS.has(word);

/** "R$ 4,50" -> "4 virgula 50"; "30.110" -> "30110"; "30110-000" -> "30110000"; "5reais" -> "5 reais". */
function prepare(transcript: string): string {
  return transcript
    .replace(/r\$\s*/gi, " ")
    .replace(/(\d{1,3})\.(\d{3})(?!\d)/g, "$1$2")
    .replace(/(\d{4,5})\s*-\s*(\d{1,3})(?!\d)/g, "$1$2")
    .replace(/(\d)[.,](\d{1,2})(?!\d)/g, "$1 virgula $2")
    .replace(/(\d)(?=\p{L})/gu, "$1 ")
    .replace(/,/g, " ");
}

function tokenize(transcript: string): Tok[] {
  const toks: Tok[] = [];
  // A full stop, ";" or a new line ends a region (the commas of the owner's speech do not).
  const segments = prepare(transcript).split(/[;\n]|\.(?=\s|$)/);
  for (const segment of segments) {
    let first = true;
    for (const word of segment.trim().split(/\s+/).filter(Boolean)) {
      const norm = normalizeSpeech(word);
      if (!norm) continue;
      for (const piece of norm.split(" ")) {
        toks.push({ raw: word.replace(/[^\p{L}\p{N}'-]/gu, ""), norm: piece, brk: first });
        first = false;
      }
    }
  }
  return toks;
}

type Acc = {
  words: string[];
  prefixes?: string[];
  feeCents?: number;
  minCents?: number;
  eta?: number;
  /** Has a value other than the name: the next name starts another region. */
  started: boolean;
};

const cap = (text: string) => (text ? text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1) : text);

/** Do these two number words make one number ("vinte" + "cinco", "cento" + "vinte"), or are they two numbers? */
function joinsWith(previous: string, current: string): boolean {
  if (isDigits(previous) || isDigits(current)) return false;
  const p = Number(parseSpokenNumber(previous, false));
  const c = Number(parseSpokenNumber(current, false));
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0) return false;
  return (p >= 100 && p % 100 === 0 && c < 100) || (p % 100 >= 20 && p % 10 === 0 && c < 10);
}

/**
 * Where a run of number words that starts at `at` ends: "cinco", "cinco e cinquenta", "5 reais 50". Two numbers
 * side by side are one only when they read as one ("vinte cinco"), never "5 40". `pure` leaves out the words of
 * money ("reais", "meio"), for times. Returns `at` when there is no number.
 */
function numberRun(toks: Tok[], at: number, allowBigDigits = false, pure = false): number {
  let end = at;
  let sawNumber = false;
  let last = ""; // the last number word, while nothing but spaces came after it
  for (let i = at; i < toks.length; i += 1) {
    const word = toks[i].norm;
    if (i > at && toks[i].brk) break;
    if (isNumberWord(word)) {
      if (isDigits(word) && !allowBigDigits && word.length > 4) break;
      if (last && !joinsWith(last, word)) break;
      sawNumber = true;
      last = word;
      end = i + 1;
    } else if (!pure && MONEY_WORDS.has(word) && sawNumber) {
      last = "";
      end = i + 1;
    } else if (!pure && (word === "meio" || word === "meia") && sawNumber) {
      last = "";
      end = i + 1;
    } else if (word === "e" && sawNumber && i + 1 < toks.length && !toks[i + 1].brk) {
      const after = toks[i + 1].norm;
      if (isNumberWord(after) || (!pure && (after === "meio" || after === "meia"))) {
        last = "";
        continue;
      }
      break;
    } else {
      break;
    }
  }
  return sawNumber ? end : at;
}

/** A value in reais from a run of words, in cents, or null when it does not read as one clean number. */
function readMoney(words: string[]): number | null {
  const joined = words.join(" ").replace(/\b(meio|meia)\b/g, "virgula 5");
  const value = parseSpokenNumber(joined, true);
  if (value === null) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/** Does a number start at `at` and a unit of time follow it ("40 minutos", "2 horas")? Then it is not money. */
function isTimeAt(toks: Tok[], at: number): boolean {
  const end = numberRun(toks, at, false, true);
  if (end === at) return false;
  const unit = toks[end]?.norm;
  return Boolean(unit && !toks[end].brk && (MINUTE_WORDS.has(unit) || HOUR_WORDS.has(unit)));
}

/** "40 minutos", "meia hora", "uma hora e meia", "2 horas". Minutes and the token after it, or null. */
function readTime(toks: Tok[], at: number, bare: boolean): { minutes: number; next: number } | null {
  const first = toks[at]?.norm;
  if (first === "meia" && toks[at + 1]?.norm === "hora") return { minutes: 30, next: at + 2 };

  const end = numberRun(toks, at, false, true);
  if (end === at) return null;
  const parsed = parseSpokenNumber(toks.slice(at, end).map((t) => t.norm).join(" "), false);
  if (parsed === null) return null;
  const value = Number(parsed);
  const unit = toks[end]?.norm;

  if (unit && !toks[end].brk && MINUTE_WORDS.has(unit)) return { minutes: value, next: end + 1 };
  if (unit && !toks[end].brk && HOUR_WORDS.has(unit)) {
    let minutes = value * 60;
    let next = end + 1;
    if (toks[next]?.norm === "e" && (toks[next + 1]?.norm === "meia" || toks[next + 1]?.norm === "meio")) {
      minutes += 30;
      next += 2;
    }
    return { minutes, next };
  }
  return bare ? { minutes: value, next: end } : null;
}

/** Is the word at `index` filler at the start of a name ("eu entrego no centro" -> "centro")? */
function isLeadWord(words: string[], index: number): boolean {
  const word = normalizeSpeech(words[index]);
  if (LEAD.has(word)) return true;
  return LEAD_BEFORE_REGION.has(word) && REGION_WORDS.has(normalizeSpeech(words[index + 1] ?? ""));
}

export function parseSpokenZones(transcript: string, known: string[] = []): SpokenZones {
  const toks = tokenize(transcript);
  const done: Acc[] = [];
  const notes: string[] = [];
  const dropped: string[] = [];
  let cur: Acc | null = null;

  const close = () => {
    if (cur) done.push(cur);
    cur = null;
  };

  /** The region an attribute belongs to: the current one, or none (then the attribute has no name to go with). */
  const target = (word: string): Acc | null => {
    if (!cur) notes.push(`Ouvi "${word}" antes do nome de uma região. Diga o nome primeiro.`);
    return cur;
  };

  for (let i = 0; i < toks.length; i += 1) {
    const { norm, raw, brk } = toks[i];

    // "só isso", "pronto": nothing after it counts
    if (CLOSERS.some((closer) => closer.every((word, k) => toks[i + k]?.norm === word))) break;

    if (brk) close();

    // ---- time: "40 minutos", "meia hora", "prazo 40"
    const timeKeyword = TIME_WORDS.has(norm);
    if (timeKeyword || isNumberWord(norm) || norm === "meia") {
      const start = timeKeyword ? i + 1 : i;
      const time = readTime(toks, start, timeKeyword);
      if (time) {
        const acc = target(raw);
        if (acc) {
          acc.eta = time.minutes;
          acc.started = true;
        }
        i = time.next - 1;
        continue;
      }
      if (timeKeyword) continue;
    }

    // ---- CEP: the word, and the numbers after it
    if (CEP_WORDS.has(norm) || (isDigits(norm) && norm.length >= 5 && norm.length <= 8)) {
      const acc = target(raw);
      let j = CEP_WORDS.has(norm) ? i + 1 : i;
      while (j < toks.length && !toks[j].brk) {
        const word = toks[j].norm;
        if (isDigits(word) && word.length >= 3 && word.length <= 8 && !isTimeAt(toks, j)) {
          if (acc) {
            acc.prefixes = acc.prefixes ?? [];
            if (!acc.prefixes.includes(word)) acc.prefixes.push(word);
            acc.started = true;
          }
          j += 1;
        } else if (word === "e" || word === "ou" || word === "de" || word === "comecando" || word === "com" || word === "em") {
          j += 1;
        } else {
          break;
        }
      }
      if (CEP_WORDS.has(norm) && j === i + 1) notes.push("Ouvi CEP, mas não ouvi os números. Diga o começo do CEP, como 30110.");
      i = j - 1;
      continue;
    }

    // ---- "sem taxa", "sem mínimo"
    if (norm === "sem" && (FEE_WORDS.has(toks[i + 1]?.norm) || MIN_WORDS.has(toks[i + 1]?.norm))) {
      const acc = target(raw);
      if (acc) {
        if (FEE_WORDS.has(toks[i + 1].norm)) acc.feeCents = 0;
        else acc.minCents = 0;
        acc.started = true;
      }
      i += 1;
      continue;
    }

    // ---- free
    if (FREE_WORDS.has(norm)) {
      const acc = target(raw);
      if (acc) {
        acc.feeCents = 0;
        acc.started = true;
      }
      continue;
    }

    // ---- fee, minimum order: the keyword, a little glue, and the value
    const isFee = FEE_WORDS.has(norm) || (norm === "por" && cur !== null && isNumberWord(toks[i + 1]?.norm ?? ""));
    const isMin = MIN_WORDS.has(norm) || (norm === "partir" && toks[i + 1]?.norm === "de");
    if (isFee || isMin) {
      const acc = target(raw);
      let j = i + 1;
      while (j < toks.length && !toks[j].brk && GLUE.has(toks[j].norm) && !isNumberWord(toks[j].norm)) j += 1;
      if (isFee && FREE_WORDS.has(toks[j]?.norm ?? "")) {
        if (acc) {
          acc.feeCents = 0;
          acc.started = true;
        }
        i = j;
        continue;
      }
      let end = numberRun(toks, j);
      // "40 reais 50 minutos": the 50 is the time, not cents
      for (let k = j + 1; k < end; k += 1) {
        if (isNumberWord(toks[k].norm) && isTimeAt(toks, k)) {
          end = k;
          while (end > j && !isNumberWord(toks[end - 1].norm) && !MONEY_WORDS.has(toks[end - 1].norm)) end -= 1;
          break;
        }
      }
      if (end === j || isTimeAt(toks, j)) {
        notes.push(`Ouvi "${raw}", mas não ouvi o valor. Diga o valor logo depois, como ${isFee ? "taxa 5" : "mínimo 20"}.`);
        i = j - 1;
        continue;
      }
      const cents = readMoney(toks.slice(j, end).map((t) => t.norm));
      if (cents === null) {
        notes.push(`Não entendi o valor depois de "${raw}". Diga assim: ${isFee ? "taxa 5" : "mínimo 20"} reais.`);
      } else if (acc) {
        const max = isFee ? LIMITS.maxFeeCents : LIMITS.maxMinOrderCents;
        if (cents > max) {
          notes.push(`${isFee ? "Taxa" : "Pedido mínimo"} de ${reais(cents)} passa do máximo de ${reais(max)}. Deixei em branco.`);
        } else if (isFee) {
          acc.feeCents = cents;
        } else {
          acc.minCents = cents;
        }
        acc.started = true;
      }
      i = end - 1;
      continue;
    }

    // ---- "uma região": an article that is also a number
    if (norm === "um" || norm === "uma") continue;

    // ---- a number nobody asked for
    if (isNumberWord(norm)) {
      const end = numberRun(toks, i, true);
      notes.push(`Não sei a que região pertence o número "${toks.slice(i, end).map((t) => t.raw).join(" ")}". Diga a palavra antes dele (taxa, mínimo, CEP ou prazo).`);
      i = end - 1;
      continue;
    }

    // ---- words that are never a name
    if (SKIP.has(norm) || MINUTE_WORDS.has(norm) || HOUR_WORDS.has(norm) || MONEY_WORDS.has(norm)) continue;

    // ---- a word of a name
    const naming: boolean = cur !== null && !(cur as Acc).started;
    const filler = LEAD.has(norm) || (LEAD_BEFORE_REGION.has(norm) && REGION_WORDS.has(toks[i + 1]?.norm ?? ""));
    if (!naming && filler) continue;
    if (naming) {
      (cur as Acc).words.push(raw);
      continue;
    }
    // a name after a region that already has data: another region starts
    close();
    cur = { words: [raw], started: false };
  }
  close();

  const zones: SpokenZone[] = [];
  const lines: string[] = [];
  for (const acc of done) {
    while (acc.words.length > 0 && isLeadWord(acc.words, 0)) acc.words.shift();
    while (acc.words.length > 0 && TRAIL.has(normalizeSpeech(acc.words[acc.words.length - 1]))) acc.words.pop();
    const name = acc.words.map((w, k) => (k === 0 ? cap(w) : w)).join(" ").trim();
    const hasData = acc.prefixes !== undefined || acc.feeCents !== undefined || acc.minCents !== undefined || acc.eta !== undefined;
    if (!name || !hasData) {
      if (name) dropped.push(name);
      continue;
    }
    const zone: SpokenZone = { name };
    if (acc.prefixes) zone.prefixes = acc.prefixes;
    if (acc.feeCents !== undefined) zone.feeCents = acc.feeCents;
    if (acc.minCents !== undefined) zone.minCents = acc.minCents;
    if (acc.eta !== undefined) zone.eta = acc.eta;
    zones.push(zone);

    const parts: string[] = [];
    if (zone.prefixes) parts.push(`CEP ${zone.prefixes.join(", ")}`);
    if (zone.feeCents !== undefined) parts.push(zone.feeCents === 0 ? "entrega grátis" : `taxa ${reais(zone.feeCents)}`);
    if (zone.minCents !== undefined) parts.push(zone.minCents === 0 ? "sem mínimo" : `mínimo ${reais(zone.minCents)}`);
    if (zone.eta !== undefined) parts.push(`${zone.eta} min`);
    lines.push(`${name}: ${parts.join(" · ")}`);

    const isKnown = known.some((other) => normalizeSpeech(other) === normalizeSpeech(name));
    if (!isKnown) {
      if (!zone.prefixes) notes.push(`${name}: não ouvi os CEPs. Escreva o começo do CEP na região antes de salvar.`);
      if (zone.feeCents === undefined) notes.push(`${name}: não ouvi a taxa. Fica grátis se você não preencher.`);
    }
  }

  if (dropped.length > 0) {
    notes.push(`Não usei: "${dropped.join(" ")}" (era só conversa, sem CEP, taxa, mínimo ou prazo).`);
  }
  if (zones.length > LIMITS.zones) {
    notes.push(`Use no máximo ${LIMITS.zones} regiões. As últimas ficaram de fora.`);
    zones.length = LIMITS.zones;
    lines.length = LIMITS.zones;
  }
  return { zones, lines, notes };
}
