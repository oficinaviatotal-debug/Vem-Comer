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
const MAX_DESCRIPTION = 300;
const MAX_SUBCATEGORY = 100;

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
    const items: ParsedMenu["categories"][number]["items"] = [];
    for (const rawItem of Array.isArray(category.items) ? category.items : []) {
      if (total >= MAX_ITEMS) break;
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as { name?: unknown; price?: unknown; description?: unknown; subcategory?: unknown };
      const itemName = text(item.name, MAX_NAME);
      if (!itemName) continue;
      const price = typeof item.price === "string" || typeof item.price === "number" ? normalizePrice(String(item.price)) : null;
      const entry: ParsedMenu["categories"][number]["items"][number] = { name: itemName, price: price ?? "" };
      const description = text(item.description, MAX_DESCRIPTION);
      const subcategory = text(item.subcategory, MAX_SUBCATEGORY);
      if (description) entry.description = description;
      if (subcategory && subcategory.toLowerCase() !== name.toLowerCase()) entry.subcategory = subcategory;
      items.push(entry);
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

/** The sentence shown when a spreadsheet or PDF had no menu in it. */
export function unreadableFileText(parsed: ParsedMenu, photoAvailable: boolean): string {
  const base = photoAvailable
    ? "Não achei pratos com preço nesse arquivo. Escolha outro, ou tire uma foto do cardápio."
    : "Não achei pratos com preço nesse arquivo. Cada linha precisa ter o nome do prato e o preço.";
  return parsed.notes ? `${base} (${parsed.notes})` : base;
}

/** Biggest spreadsheet the server reads (same number as the server's). */
export const MENU_FILE_MAX_BYTES = 2 * 1024 * 1024;
/** Biggest PDF the server reads. */
export const MENU_PDF_MAX_BYTES = 10 * 1024 * 1024;

function looksLikePdf(file: { name: string; type: string }): boolean {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

/**
 * Checks a chosen file before it is sent, so a heavy or empty file does not wait for a round trip to fail.
 * Returns the sentence to show, or "" when the file may go. What the file really is gets decided by the server,
 * which looks inside it instead of trusting the name.
 */
export function menuFileProblem(file: { name: string; type: string; size: number }, pdfEnabled: boolean): string {
  if (file.size <= 0) return "Esse arquivo está vazio. Escolha outro.";
  if (looksLikePdf(file)) {
    if (!pdfEnabled) return "Ainda não leio PDF por aqui. Mande uma planilha (Excel ou CSV).";
    if (file.size > MENU_PDF_MAX_BYTES) return "O PDF é pesado demais (o máximo é 10 MB). Mande um menor, ou tire fotos das páginas.";
    return "";
  }
  if (file.size > MENU_FILE_MAX_BYTES) return "A planilha é grande demais (o máximo é 2 MB). Deixe só a lista de pratos e preços.";
  return "";
}

/** What the "ready menu" card can offer on this server. */
export type ReadyMenuOptions = { photo: boolean; file: boolean; pdf: boolean };
/** "photo": only photos. "file": only spreadsheets. "both": photos and files. false: nothing. */
export type ReadyMenuMode = false | "photo" | "file" | "both";

export function readyMenuOptions(capabilities: { photo_menu: boolean; file_menu: boolean; pdf_menu: boolean }): ReadyMenuOptions {
  return {
    photo: capabilities.photo_menu,
    file: capabilities.file_menu,
    // a PDF is read by the AI: a server that cannot read photos cannot read PDFs either
    pdf: capabilities.file_menu && capabilities.pdf_menu,
  };
}

export function readyMenuMode(options: ReadyMenuOptions): ReadyMenuMode {
  if (options.photo) return options.file ? "both" : "photo";
  return options.file ? "file" : false;
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

const FILE_WORDS = new Set(["planilha", "planilhas", "excel", "csv", "pdf", "arquivo", "arquivos"]);

/** Whether the owner said they have the menu in a file (spreadsheet or PDF), and did not say they do not. */
export function wantsFile(transcript: string): boolean {
  const words = normalizeSpeech(transcript).split(" ");
  return words.some((word, at) => FILE_WORDS.has(word) && !words.slice(Math.max(0, at - 2), at).some((w) => NEGATIONS.has(w)));
}

/** Whether the owner asked for a ready menu in any form: a photo, a spreadsheet or a PDF. */
export function wantsReadyMenu(transcript: string): boolean {
  return wantsPhoto(transcript) || wantsFile(transcript);
}
