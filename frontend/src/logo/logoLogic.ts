/**
 * Regras puras do criador de logomarca: que tipos de comida existem, que cores, que modelos,
 * como encaixar o nome do restaurante e como garantir que o texto fica legível.
 * Nada aqui usa o navegador (canvas, fontes): dá para testar tudo pelo Node.
 * O desenho em si está em logoDraw.ts e logoGlyphs.ts.
 */

/** A logomarca é desenhada em um quadrado de 512 x 512; o servidor guarda no máximo isso. */
export const LOGO_SIZE = 512;

/** O nome escrito na logomarca. Mais comprido que isso não cabe em letra legível. */
export const NAME_MAX_CHARS = 40;

export type FoodId =
  | "pizza"
  | "hamburguer"
  | "cachorro-quente"
  | "sorvete"
  | "acai"
  | "prato"
  | "frango"
  | "pastel"
  | "bolo"
  | "cafe"
  | "suco"
  | "sushi"
  | "geral";

export type Food = { id: FoodId; label: string };

/** Na ordem em que aparecem na tela. "geral" (chapéu de cozinheiro) serve para quem não se encaixa. */
export const FOODS: readonly Food[] = [
  { id: "prato", label: "Comida caseira" },
  { id: "pizza", label: "Pizza" },
  { id: "hamburguer", label: "Hambúrguer" },
  { id: "cachorro-quente", label: "Cachorro-quente" },
  { id: "frango", label: "Frango e carnes" },
  { id: "pastel", label: "Pastel e salgados" },
  { id: "sushi", label: "Japonesa" },
  { id: "acai", label: "Açaí" },
  { id: "sorvete", label: "Sorvete" },
  { id: "bolo", label: "Bolos e doces" },
  { id: "cafe", label: "Café e padaria" },
  { id: "suco", label: "Sucos" },
  { id: "geral", label: "Outro" },
];

export function asFoodId(value: unknown): FoodId | null {
  return FOODS.some((food) => food.id === value) ? (value as FoodId) : null;
}

export type TemplateId = "selo" | "quadrado" | "claro" | "redondo" | "letras" | "toldo";

/** Os 6 modelos oferecidos, sempre nesta ordem. */
export const TEMPLATES: readonly TemplateId[] = ["selo", "quadrado", "claro", "redondo", "letras", "toldo"];

/** Modelos de fundo escuro (letra clara) e de fundo claro (letra escura). */
const DARK_TEMPLATES: readonly TemplateId[] = ["selo", "quadrado", "letras"];

export function isDarkTemplate(template: TemplateId): boolean {
  return DARK_TEMPLATES.includes(template);
}

/** Este modelo desenha as iniciais do nome no lugar do desenho de comida. */
export function usesInitials(template: TemplateId): boolean {
  return template === "letras";
}

export type PaletteId =
  | "vermelho"
  | "laranja"
  | "amarelo"
  | "verde"
  | "azul"
  | "roxo"
  | "marrom"
  | "rosa"
  | "grafite";

export type Palette = {
  id: PaletteId;
  label: string;
  /** Cor principal da fachada. */
  main: string;
  /** Versão bem escura da principal (faixa do nome, contorno). */
  deep: string;
  /** Versão bem clara da principal (fundo dos modelos claros). */
  soft: string;
  /** Cor de destaque sobre a principal (anel, detalhes). */
  accent: string;
};

/**
 * Cores já conferidas: texto sobre fundo >= 4,5:1 em todas as combinações usadas
 * (tests/logo/logoLogic.test.mjs confere de novo a cada mudança).
 */
export const PALETTES: readonly Palette[] = [
  { id: "vermelho", label: "Vermelho", main: "#B42318", deep: "#7F1D14", soft: "#FDECEA", accent: "#FFC83A" },
  { id: "laranja", label: "Laranja", main: "#C2410C", deep: "#8A2E08", soft: "#FFF1E6", accent: "#FFC83A" },
  { id: "amarelo", label: "Amarelo", main: "#FFC83A", deep: "#5C4200", soft: "#FFF6D6", accent: "#B42318" },
  { id: "verde", label: "Verde", main: "#1E6B3C", deep: "#123B2B", soft: "#E6F4EA", accent: "#FFC83A" },
  { id: "azul", label: "Azul", main: "#1D4ED8", deep: "#1E3A8A", soft: "#E8EEFF", accent: "#FFC83A" },
  { id: "roxo", label: "Roxo", main: "#6D28D9", deep: "#4C1D95", soft: "#F1E9FE", accent: "#FFC83A" },
  { id: "marrom", label: "Marrom", main: "#7C4A24", deep: "#4A2A12", soft: "#F7EDE3", accent: "#FFC83A" },
  { id: "rosa", label: "Rosa", main: "#BE185D", deep: "#831843", soft: "#FDE7F0", accent: "#FFC83A" },
  { id: "grafite", label: "Grafite", main: "#1F2937", deep: "#111827", soft: "#EEF0F3", accent: "#FFC83A" },
];

export function asPaletteId(value: unknown): PaletteId | null {
  return PALETTES.some((palette) => palette.id === value) ? (value as PaletteId) : null;
}

export function paletteById(id: PaletteId): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** A cor que combina com o tipo de comida, já escolhida quando o dono toca no tipo (ele pode trocar). */
export const DEFAULT_PALETTE: Readonly<Record<FoodId, PaletteId>> = {
  pizza: "vermelho",
  hamburguer: "laranja",
  "cachorro-quente": "vermelho",
  sorvete: "rosa",
  acai: "roxo",
  prato: "verde",
  frango: "laranja",
  pastel: "amarelo",
  bolo: "rosa",
  cafe: "marrom",
  suco: "laranja",
  sushi: "grafite",
  geral: "azul",
};

/* ------------------------------------------------------------------ contraste */

const WHITE = "#FFFFFF";
const INK = "#1B2A22";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contraste entre duas cores "#RRGGBB" (1 a 21). 4,5 é o mínimo para texto; 3 para desenho. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Branco ou o tom escuro da marca, o que ficar mais legível sobre este fundo. */
export function bestInk(background: string): string {
  return contrast(WHITE, background) >= contrast(INK, background) ? WHITE : INK;
}

/** A primeira cor da lista com contraste suficiente; se nenhuma tem, a de maior contraste. */
function firstReadable(background: string, candidates: string[], minimum: number): string {
  for (const color of candidates) {
    if (contrast(color, background) >= minimum) return color;
  }
  return candidates.reduce((best, color) => (contrast(color, background) > contrast(best, background) ? color : best));
}

export type LogoColors = {
  /** O fundo principal do modelo (o que aparece atrás do desenho). */
  field: string;
  /** Faixa onde o nome fica, quando o modelo tem uma. */
  band: string | null;
  /** Anel, borda, listras: enfeite. */
  rim: string;
  /** Desenho de comida: cor principal. */
  glyphFg: string;
  /** Desenho de comida: cor dos detalhes. */
  glyphDetail: string;
  /** Desenho de comida: cor do fundo que ele "recorta" (para fazer vãos entre as partes). */
  glyphCut: string;
  /** Cor do nome e o fundo em que ele está escrito. */
  nameInk: string;
  nameBg: string;
};

/** Todas as cores de um modelo numa paleta. Tudo calculado, nada sorteado. */
export function colorsFor(template: TemplateId, palette: Palette): LogoColors {
  if (isDarkTemplate(template)) {
    const onMain = bestInk(palette.main);
    const hasBand = template !== "selo";
    return {
      field: palette.main,
      band: hasBand ? palette.deep : null,
      rim: palette.accent,
      glyphFg: onMain,
      glyphDetail: palette.accent,
      glyphCut: palette.main,
      nameInk: hasBand ? bestInk(palette.deep) : onMain,
      nameBg: hasBand ? palette.deep : palette.main,
    };
  }
  // Modelos claros: desenho e nome em tom escuro; o detalhe usa a primeira cor que se enxerga no fundo claro.
  const detail = firstReadable(palette.soft, [palette.main, palette.accent, palette.deep], 3);
  return {
    field: palette.soft,
    band: null,
    rim: palette.deep,
    glyphFg: palette.deep,
    glyphDetail: detail,
    glyphCut: palette.soft,
    nameInk: palette.deep,
    nameBg: palette.soft,
  };
}

/* ------------------------------------------------------------------ nome */

/** Tira espaços sobrando e corta no limite. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_CHARS).trim();
}

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "na", "no", "&"]);

/** As letras grandes do modelo "letras": a inicial das duas primeiras palavras que importam ("Saiteria do João" -> "SJ"). */
export function initialsOf(name: string): string {
  const words = cleanName(name)
    .split(" ")
    .map((word) => word.replace(/[^\p{L}]/gu, ""))
    .filter((word) => word.length > 0);
  const important = words.filter((word) => !SMALL_WORDS.has(word.toLocaleLowerCase("pt-BR")));
  const chosen = (important.length > 0 ? important : words).slice(0, 2);
  return chosen.map((word) => Array.from(word)[0].toLocaleUpperCase("pt-BR")).join("");
}

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const FOOD_WORDS: ReadonlyArray<[FoodId, RegExp]> = [
  ["pizza", /\bpizz/],
  ["hamburguer", /\b(hamburg|burger|burguer|lanche|x-?tudo|smash)/],
  ["cachorro-quente", /\b(hot ?dog|cachorro|dogao|dog\b)/],
  ["sorvete", /\b(sorvet|gelat|picol|sundae|milk ?shake)/],
  ["acai", /\bacai/],
  ["pastel", /\b(pastel|salgad|coxinh|empad|esfiha|empanad|folhad)/],
  ["frango", /\b(frango|galeto|churrasc|espet|assad|carne|grill|rodizio|costela|bbq)/],
  ["sushi", /\b(sushi|japon|temaki|yakisoba|sashimi|oriental|niguiri)/],
  ["bolo", /\b(bolo|doce|confeit|brigadeir|cupcake|brownie|chocolat|torta|gelado|docer)/],
  ["cafe", /\b(cafe|padaria|panific|cafeteria|pao\b|paes\b|brunch)/],
  ["suco", /\b(suco|vitamina|polpa|bebida|smoothie|agua de coco|caldo de cana)/],
  ["prato", /\b(marmit|restaurante|caseir|self|prato|cozinha|comida|tempero|sabor|quentinha|feijoada|bar\b|boteco)/],
];

/** Adivinha o tipo de comida pelo nome ("Pizzaria do Zé" -> pizza). Sem pista, devolve null. */
export function guessFood(name: string): FoodId | null {
  const text = plain(name);
  for (const [food, pattern] of FOOD_WORDS) {
    if (pattern.test(text)) return food;
  }
  return null;
}

export type NameFit = {
  lines: string[];
  /** Tamanho da letra em pixels (na logomarca de 512). */
  size: number;
  /** Algumas palavras foram cortadas com "…" porque não coube nem na letra mínima. */
  truncated: boolean;
};

export type FitOptions = {
  maxSize: number;
  minSize: number;
  maxLines: number;
  /** Altura da caixa do nome; o bloco de linhas nunca passa disso. */
  height: number;
};

/** Como medir um texto: largura em pixels de `text` escrito em `size` pixels. Quem desenha injeta a medida real. */
export type Measure = (text: string, size: number) => number;

const SIZE_STEP = 2;

/** Espaço entre linhas do nome (múltiplo do tamanho da letra). */
export const LINE_HEIGHT = 1.12;

/** Duas linhas só valem a pena se a letra ficar pelo menos 15% maior que numa linha só. */
const MORE_LINES_GAIN = 1.15;

function widest(lines: string[], size: number, measure: Measure): number {
  return lines.reduce((most, line) => Math.max(most, measure(line, size)), 0);
}

/** Divide as palavras em `count` linhas, sem desordenar, deixando as linhas o mais parecidas possível. */
function splitBalanced(words: string[], count: number, size: number, measure: Measure): string[] {
  if (count === 1 || words.length === 1) return [words.join(" ")];
  let best: string[] = [words.join(" ")];
  let bestWidth = Infinity;
  if (count === 2) {
    for (let cut = 1; cut < words.length; cut += 1) {
      const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
      const width = widest(lines, size, measure);
      if (width < bestWidth) {
        bestWidth = width;
        best = lines;
      }
    }
    return best;
  }
  for (let a = 1; a < words.length - 1; a += 1) {
    for (let b = a + 1; b < words.length; b += 1) {
      const lines = [words.slice(0, a).join(" "), words.slice(a, b).join(" "), words.slice(b).join(" ")];
      const width = widest(lines, size, measure);
      if (width < bestWidth) {
        bestWidth = width;
        best = lines;
      }
    }
  }
  return best;
}

function ellipsize(text: string, size: number, width: number, measure: Measure): string {
  if (measure(text, size) <= width) return text;
  const chars = Array.from(text);
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join("").trimEnd()}…`;
    if (measure(candidate, size) <= width) return candidate;
  }
  return "…";
}

/** A maior letra com que o nome cabe em exatamente `lines` linhas, ou null se nem na letra mínima. */
function bestWith(
  words: string[],
  lines: number,
  width: number,
  measure: Measure,
  options: FitOptions
): { lines: string[]; size: number } | null {
  // Com mais linhas a letra tem um teto menor, senão o nome fica "alto demais" para a caixa.
  const ceiling = lines === 1 ? options.maxSize : Math.round(options.maxSize * 0.86);
  for (let size = ceiling; size >= options.minSize; size -= SIZE_STEP) {
    if (lines * size * LINE_HEIGHT > options.height) continue;
    const split = splitBalanced(words, lines, size, measure);
    if (widest(split, size, measure) <= width) return { lines: split, size };
  }
  return null;
}

/**
 * Encaixa o nome na largura dada: vê o que cabe em uma linha, em duas (e, se o modelo deixar, três),
 * e fica com a que deixa a letra maior; só no último caso corta com "…".
 * O nome nunca sai da caixa e a letra nunca fica menor que `minSize`.
 */
export function fitName(rawName: string, width: number, measure: Measure, options: FitOptions): NameFit {
  const name = cleanName(rawName);
  if (name === "") return { lines: [], size: options.maxSize, truncated: false };
  const words = name.split(" ");

  let chosen: { lines: string[]; size: number } | null = null;
  for (let lines = 1; lines <= Math.min(options.maxLines, words.length); lines += 1) {
    const fit = bestWith(words, lines, width, measure, options);
    if (!fit) continue;
    if (!chosen || fit.size >= chosen.size * MORE_LINES_GAIN) chosen = fit;
  }
  if (chosen) return { ...chosen, truncated: false };

  // Não coube nem na letra mínima: corta o que sobra, em até `maxLines` linhas.
  const lineCount = Math.max(1, Math.min(options.maxLines, words.length, Math.floor(options.height / (options.minSize * LINE_HEIGHT))));
  const split = splitBalanced(words, lineCount, options.minSize, measure);
  const cut = split.map((line) => ellipsize(line, options.minSize, width, measure));
  return { lines: cut, size: options.minSize, truncated: cut.some((line, index) => line !== split[index]) };
}

/* ------------------------------------------------------------------ medidas de cada modelo */

export type Box = { cx: number; top: number; width: number; height: number };
export type Circle = { cx: number; cy: number; r: number };

export type Layout = {
  glyph: Circle;
  name: Box;
  maxSize: number;
  minSize: number;
  maxLines: number;
};

/**
 * Onde ficam o desenho e o nome em cada modelo (quadrado de 512).
 * Tudo calculado para ficar dentro da forma: nos modelos redondos a caixa do nome é mais estreita,
 * porque a base do círculo é mais curta que o meio.
 */
export const LAYOUTS: Readonly<Record<TemplateId, Layout>> = {
  selo: {
    glyph: { cx: 256, cy: 172, r: 120 },
    name: { cx: 256, top: 306, width: 284, height: 116 },
    maxSize: 58,
    minSize: 26,
    maxLines: 2,
  },
  quadrado: {
    glyph: { cx: 256, cy: 166, r: 130 },
    name: { cx: 256, top: 338, width: 424, height: 150 },
    maxSize: 66,
    minSize: 28,
    maxLines: 2,
  },
  claro: {
    glyph: { cx: 256, cy: 162, r: 124 },
    name: { cx: 256, top: 326, width: 400, height: 150 },
    maxSize: 66,
    minSize: 28,
    maxLines: 2,
  },
  redondo: {
    glyph: { cx: 256, cy: 182, r: 108 },
    name: { cx: 256, top: 304, width: 262, height: 110 },
    maxSize: 54,
    minSize: 24,
    maxLines: 2,
  },
  letras: {
    glyph: { cx: 256, cy: 168, r: 118 },
    name: { cx: 256, top: 338, width: 424, height: 150 },
    maxSize: 66,
    minSize: 28,
    maxLines: 2,
  },
  toldo: {
    glyph: { cx: 256, cy: 262, r: 92 },
    name: { cx: 256, top: 360, width: 424, height: 130 },
    maxSize: 60,
    minSize: 28,
    maxLines: 2,
  },
};

/* ------------------------------------------------------------------ opções para a tela */

export type LogoSpec = {
  template: TemplateId;
  food: FoodId;
  palette: PaletteId;
  name: string;
};

/** Os 6 modelos para o dono escolher, já com o tipo, a cor e o nome dele. */
export function variantsFor(food: FoodId, palette: PaletteId, name: string): LogoSpec[] {
  const clean = cleanName(name);
  return TEMPLATES.map((template) => ({ template, food, palette, name: clean }));
}

/* ------------------------------------------------------------------ arquivo enviado pelo dono */

/** Logomarca que o dono já tem: PNG até este tamanho segue como está (mantém o fundo transparente). */
export const KEEP_AS_IS_BYTES = 3 * 1024 * 1024;

/** O servidor recusa acima disso (LOGO_MAX_BYTES no backend). */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** Lado maior ao reduzir uma logomarca grande antes de enviar. */
export const UPLOAD_MAX_SIDE = 1024;

/** O tipo da imagem: o que o celular informou ou, se veio vazio (acontece no Android), pelo fim do nome do arquivo. */
export function imageTypeOf(name: string, type: string): string {
  if (type) return type.toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "";
}

export type UploadPlan = "send-as-is" | "shrink-png" | "shrink-jpeg" | "refuse";

/** O que fazer com o arquivo que o dono escolheu. Só olha tipo e tamanho; o servidor confere os bytes de verdade. */
export function planUpload(type: string, bytes: number): UploadPlan {
  const kind = type.toLowerCase();
  if (kind === "image/png") return bytes <= KEEP_AS_IS_BYTES ? "send-as-is" : "shrink-png";
  if (kind === "image/jpeg" || kind === "image/webp") return bytes <= KEEP_AS_IS_BYTES ? "send-as-is" : "shrink-jpeg";
  return "refuse";
}
