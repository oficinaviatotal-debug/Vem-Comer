/**
 * Rules of the first screen of the menu assistant ("Como você quer cadastrar o seu cardápio?"):
 * what each door can do on this server, and the search in the list of business types.
 * No browser APIs here, so everything can be tested from plain Node.
 */

import { normalizeSpeech } from "../onboarding/tourEngine.ts";
import type { ReadyMenuOptions } from "./menuPhotoLogic.ts";

/** "loading": the server is still being asked. "ready": works. "off": this server cannot do it (no AI key, old version). */
export type DoorStatus = "loading" | "ready" | "off";

export type DoorStatuses = {
  /** Photo of a menu (needs the AI key on the server). */
  photo: DoorStatus;
  /** Spreadsheet, and PDF when `pdf` is on. */
  file: DoorStatus;
  /** A PDF can be sent too (needs the AI key). */
  pdf: boolean;
};

/** `null` = the server has not answered yet. */
export function doorStatuses(options: ReadyMenuOptions | null): DoorStatuses {
  if (!options) return { photo: "loading", file: "loading", pdf: false };
  return {
    photo: options.photo ? "ready" : "off",
    file: options.file ? "ready" : "off",
    pdf: options.pdf,
  };
}

/** The line under "Enviar arquivo". Says only what this server really reads. */
export function fileHint(statuses: DoorStatuses): string {
  if (statuses.file === "loading") return "Vendo o que este servidor lê…";
  if (statuses.file === "off") return "Ainda não está disponível neste servidor.";
  return statuses.pdf
    ? "Planilha, PDF ou o cardápio que alguém fez para você."
    : "Planilha do Excel ou CSV, com o nome do prato e o preço.";
}

/** The line under "Tirar foto do cardápio". */
export function photoHint(statuses: DoorStatuses): string {
  if (statuses.photo === "loading") return "Vendo o que este servidor lê…";
  if (statuses.photo === "off") return "Ainda não está ligado neste servidor. Use a planilha ou fale os pratos.";
  return "Eu leio os pratos, os preços e as categorias e deixo tudo pronto.";
}

/** What people call each kind of business, besides its name. Keyed by the template id; unknown ids match by name only. */
const SYNONYMS: Record<string, string[]> = {
  lanchonete: ["lanche", "lanches", "sanduiche", "x-tudo", "cachorro quente", "hot dog", "trailer", "carrinho"],
  pizzaria: ["pizza", "pizzas", "esfiha"],
  restaurante: ["marmita", "marmitaria", "prato feito", "pf", "almoco", "self service", "comida caseira", "quilo", "restaurante"],
  bar: ["cerveja", "petisco", "petiscos", "drink", "drinks", "boteco", "tira gosto", "porcao", "porcoes", "choperia"],
  acai: ["acai", "suco", "sucos", "vitamina", "smoothie"],
  padaria: ["pao", "paes", "padaria", "confeitaria", "cafe da manha"],
  churrasco: ["espetinho", "espetinhos", "carne", "churrascaria", "grelha"],
  japones: ["sushi", "temaki", "yakisoba", "oriental", "sashimi"],
  tapiocaria: ["tapioca", "tapiocas", "crepioca", "cuscuz", "beiju", "goma"],
  salgados: ["salgado", "salgados", "coxinha", "coxinhas", "salgadinho", "salgadinhos", "risole", "kibe", "festa", "cento", "empada", "esfiha"],
  pastelaria: ["pastel", "pasteis", "pastelzinho", "feira", "caldo de cana", "garapa"],
  hamburgueria: ["hamburguer", "hamburgueres", "burger", "burguer", "smash", "x-burguer", "artesanal"],
  cafeteria: ["cafe", "cafes", "cafe da manha", "cappuccino", "expresso", "brunch", "lanche da tarde"],
  bolos: ["bolo", "bolos", "torta", "tortas", "bolo no pote", "confeitaria", "aniversario", "encomenda"],
  doces: ["doce", "doces", "docinho", "docinhos", "brigadeiro", "sobremesa", "sobremesas", "chocolate", "trufa", "brownie", "churros", "pudim"],
  sorveteria: ["sorvete", "sorvetes", "picole", "picoles", "casquinha", "milkshake", "gelato", "gelateria", "sundae"],
  crepe: ["crepe", "crepes", "waffle", "waffles", "panqueca", "panquecas"],
  regional: ["regional", "nordestina", "nordestino", "baiana", "mineira", "caseira", "tipica", "acaraje", "feijoada", "sertao"],
};

export function registerSynonyms(id: string, words: string[]) {
  SYNONYMS[id] = words;
}

function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * The business types that match what the owner typed. Accents, capitals and plurals do not matter;
 * every word typed must start a word of the name or of a synonym. Empty search: the whole list, in the same order.
 */
export function filterTemplates<T extends { id: string; name: string }>(templates: T[], query: string): T[] {
  const words = normalizeSpeech(query).split(" ").filter(Boolean).map(stem);
  if (words.length === 0) return templates;
  return templates.filter((template) => {
    const haystack = [template.name, ...(SYNONYMS[template.id] ?? [])].flatMap((text) => normalizeSpeech(text).split(" ")).map(stem);
    return words.every((word) => haystack.some((candidate) => candidate.startsWith(word)));
  });
}
