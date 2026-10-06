/**
 * Pure rules of "read my menu from a photo": what the server answered, what to say about it,
 * how many pages fit, and how to tell from a spoken sentence that the owner wants to send a photo.
 * No browser APIs here, so everything can be tested from plain Node.
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import { MENU_MAX_PHOTOS, MENU_MAX_TOTAL_BYTES } from "../photos/photoLogic.ts";
import { normalizePrice } from "./assistantLogic.ts";
import type { ParsedMenu } from "./assistantFlow.ts";

const MAX_CATEGORIES = 30;
const MAX_ITEMS = 300;
const MAX_NAME = 150;

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/**
 * The server already cleaned the answer, but the screen never trusts what comes over the network:
 * this keeps only known fields, short texts and valid prices. Null when the answer is not a reading at all.
 */
export function normalizeReading(raw: unknown): ParsedMenu | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as { readable?: unknown; categories?: unknown; notes?: unknown };
  if (typeof body.readable !== "boolean" || !Array.isArray(body.categories)) return null;

  const categories: ParsedMenu["categories"] = [];
  let total = 0;
  for (const rawCategory of body.categories.slice(0, MAX_CATEGORIES)) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const category = rawCategory as { name?: unknown; items?: unknown };
    const name = text(category.name, 100) || "Outros";
    const items: Array<{ name: string; price: string }> = [];
    for (const rawItem of Array.isArray(category.items) ? category.items : []) {
      if (total >= MAX_ITEMS) break;
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as { name?: unknown; price?: unknown };
      const itemName = text(item.name, MAX_NAME);
      if (!itemName) continue;
      const price = typeof item.price === "string" || typeof item.price === "number" ? normalizePrice(String(item.price)) : null;
      items.push({ name: itemName, price: price ?? "" });
      total += 1;
    }
    if (items.length > 0) categories.push({ name, items });
  }

  const readable = body.readable && categories.length > 0;
  return { readable, categories: readable ? categories : [], notes: text(body.notes, 300) };
}

export type ReadingCounts = { items: number; categories: number; withoutPrice: number };

export function readingCounts(parsed: ParsedMenu): ReadingCounts {
  let items = 0;
  let withoutPrice = 0;
  for (const category of parsed.categories) {
    for (const item of category.items) {
      items += 1;
      if (!item.price) withoutPrice += 1;
    }
  }
  return { items, categories: parsed.categories.length, withoutPrice };
}

/** What the assistant says right after the reading: how much it found and what is left to do. */
export function readingIntro(parsed: ParsedMenu): string {
  const { items, categories, withoutPrice } = readingCounts(parsed);
  const dishes = `${items} ${items === 1 ? "prato" : "pratos"}`;
  const groups = `${categories} ${categories === 1 ? "categoria" : "categorias"}`;
  const found = `Li o seu cardápio: ${dishes} em ${groups}.`;
  if (withoutPrice === 0) return found;
  return `${found} ${withoutPrice === 1 ? "Um prato está sem preço." : `${withoutPrice} pratos estão sem preço.`}`;
}

/** The sentence shown when the photo could not be read as a menu. */
export function unreadableText(parsed: ParsedMenu): string {
  const base = "Não consegui ler um cardápio nessa foto. Tire de novo mais perto, de frente, com boa luz e sem reflexo.";
  return parsed.notes ? `${base} (${parsed.notes})` : base;
}

/** How many more pages can be added. */
export function pagesLeft(count: number): number {
  return Math.max(0, MENU_MAX_PHOTOS - count);
}

/** True while the pages together are light enough for the server. */
export function fitsTogether(sizes: number[]): boolean {
  return sizes.reduce((sum, size) => sum + size, 0) <= MENU_MAX_TOTAL_BYTES;
}

/** The sentence shown to the owner when reading fails. Plain words, no technical terms. */
export function readingErrorText(reason: unknown): string {
  if (reason instanceof Error && reason.name === "AbortError") {
    return "A leitura demorou demais. Tente de novo, ou escolha o tipo do seu negócio.";
  }
  const message = reason instanceof Error ? reason.message : "";
  if (message && !/^(Failed|TypeError|NetworkError|Load failed|The operation|signal)/i.test(message)) return message;
  return "Não consegui enviar a foto. Veja se o celular está com internet e tente de novo.";
}

const STRONG_PHOTO_WORDS = new Set(["foto", "fotos", "fotografia", "fotografias", "fotografar", "fotografo", "imagem", "imagens", "camera"]);
const NEGATIONS = new Set(["nao", "nunca", "ainda", "sem"]);
const READY_MENU_PHRASES = [
  "cardapio pronto",
  "cardapio impresso",
  "cardapio de papel",
  "cardapio no papel",
  "ja tenho o cardapio",
  "ja tenho um cardapio",
  "ja tenho cardapio",
  "tenho o cardapio",
  "tenho um cardapio",
  "tenho cardapio",
  "tenho meu cardapio",
  "tenho o meu cardapio",
];

/**
 * Whether the owner said they already have a menu or want to send a photo of it.
 * Spoken sentences are long and messy ("eu já tenho um cardápio pronto eu gostaria de mandar uma foto"),
 * so this looks for the meaning anywhere in the sentence.
 */
export function wantsPhoto(transcript: string): boolean {
  const said = normalizeSpeech(transcript);
  if (!said) return false;
  if (said.split(" ").some((word) => STRONG_PHOTO_WORDS.has(word))) return true;
  const padded = ` ${said} `;
  return READY_MENU_PHRASES.some((phrase) => {
    const at = padded.indexOf(` ${phrase} `);
    if (at < 0) return false;
    // "não tenho cardápio" is the opposite of what this looks for
    const before = padded.slice(0, at).trim().split(" ").slice(-2);
    return !before.some((word) => NEGATIONS.has(word));
  });
}
