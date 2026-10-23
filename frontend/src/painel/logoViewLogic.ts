/**
 * Logomarca, versão nova: as contas da tela. Só conta, sem React, sem rede e sem canvas:
 * tests/novo/logoViewLogic.test.mjs roda isto no Node.
 *
 * Nada aqui inventa regra. Que tipos de comida, cores e modelos existem, como adivinhar o tipo pelo nome e o que fazer
 * com o arquivo do dono vêm de `logo/logoLogic` (o mesmo código da tela antiga, já testado). O servidor continua sendo a
 * palavra final e a frase dele, quando recusa, passa como veio (`wordsOf`).
 *
 * Nada é salvo antes de a pessoa dizer "sim": a imagem que ela manda passa por "Ficou bom?", e a logomarca criada só vai
 * para o servidor quando ela toca em "Usar esta logomarca".
 */
import {
  DEFAULT_PALETTE,
  FOODS,
  NAME_MAX_CHARS,
  PALETTES,
  TEMPLATES,
  cleanName,
  guessFood,
  paletteById,
  type FoodId,
  type LogoSpec,
  type PaletteId,
  type TemplateId,
} from "../logo/logoLogic.ts";
import {
  LOGO_FOOD_MIC_OFF,
  LOGO_GUESS,
  LOGO_HEARD_FOOD,
  LOGO_HEARD_FOOD_NONE,
  LOGO_HEARD_NAME,
  LOGO_HEARD_NONE,
  LOGO_LEAD_HAS,
  LOGO_LEAD_NONE,
  LOGO_LOADING,
  LOGO_MAKE,
  LOGO_MAKE_ANOTHER,
  LOGO_NAME_CUT,
  LOGO_NAME_EMPTY,
  LOGO_NAME_FALLBACK,
  LOGO_NAME_HINT,
  LOGO_NAME_MIC_OFF,
  LOGO_NEXT_HAS,
  LOGO_NEXT_HINT,
  LOGO_NEXT_NONE,
  LOGO_OPENING,
  LOGO_OPEN_FAIL,
  LOGO_Q1,
  LOGO_Q2,
  LOGO_Q2_HINT,
  LOGO_Q3,
  LOGO_REMOVING,
  LOGO_REVIEW_LEAD,
  LOGO_REVIEW_LEAD_REFINED,
  LOGO_REVIEW_NOT_SAVED,
  LOGO_REVIEW_TITLE,
  LOGO_SAVING,
  LOGO_SMALL,
  LOGO_STEP_OF,
  LOGO_SUB_FALLBACK,
  LOGO_TIP,
  LOGO_TITLE,
  LOGO_TOO_LIGHT,
} from "../novo/copy.ts";
import type { LogoHomeView, LogoMakerView, LogoPick, LogoReviewView, LogoView } from "../novo/types.ts";

export { NAME_MAX_CHARS };

/** O nome de cada modelo, para quem usa leitor de tela (a figura em si é um desenho). */
export const MODEL_LABEL: Record<TemplateId, string> = {
  selo: "Selo redondo",
  quadrado: "Quadrado com faixa",
  claro: "Claro",
  redondo: "Redondo claro",
  letras: "Só as letras",
  toldo: "Toldo de loja",
};

// ------------------------------------------------------------------------------------------------ criar em três toques

export type MakerStep = 1 | 2 | 3;

export type MakerState = {
  step: MakerStep;
  food: FoodId | null;
  /** O tipo que o sistema adivinhou pelo nome do restaurante. Fica marcado "parece ser este" enquanto a pessoa escolhe outro. */
  guess: FoodId | null;
  palette: PaletteId;
  /** A pessoa já escolheu a cor: trocar o tipo de comida não troca mais a cor por ela. */
  paletteTouched: boolean;
  template: TemplateId;
  name: string;
  /** Em quais modelos o nome ficou cortado (comprido demais). */
  cutIn: Record<string, boolean>;
};

/** O começo do criar: o nome do restaurante já vem escrito e, se ele diz o que vende ("Pizzaria do Zé"), o tipo já vem marcado. */
export function startMaker(restaurantName: string): MakerState {
  const guess = guessFood(restaurantName);
  return {
    step: 1,
    food: guess,
    guess,
    palette: guess ? DEFAULT_PALETTE[guess] : "verde",
    paletteTouched: false,
    template: "quadrado",
    name: cleanName(restaurantName),
    cutIn: {},
  };
}

export function pickFood(state: MakerState, food: FoodId): MakerState {
  if (state.food === food) return state;
  return { ...state, food, palette: state.paletteTouched ? state.palette : DEFAULT_PALETTE[food] };
}

export function pickPalette(state: MakerState, palette: PaletteId): MakerState {
  if (state.palette === palette && state.paletteTouched) return state;
  return { ...state, palette, paletteTouched: true };
}

export function pickModel(state: MakerState, template: TemplateId): MakerState {
  return state.template === template ? state : { ...state, template };
}

export function typeName(state: MakerState, value: string): MakerState {
  return { ...state, name: value.slice(0, NAME_MAX_CHARS) };
}

/** Do passo 1 para o 2 só com o tipo escolhido. Os outros passos não pedem nada. */
export function nextStep(state: MakerState): MakerState {
  if (state.step === 1) return state.food === null ? state : { ...state, step: 2 };
  if (state.step === 2) return { ...state, step: 3 };
  return state;
}

export function prevStep(state: MakerState): MakerState {
  if (state.step === 3) return { ...state, step: 2 };
  if (state.step === 2) return { ...state, step: 1 };
  return state;
}

/** O desenho avisou que o nome ficou cortado (ou coube) neste modelo. Sem mudança, devolve o mesmo estado. */
export function markCut(state: MakerState, template: TemplateId, cut: boolean): MakerState {
  if (Boolean(state.cutIn[template]) === cut) return state;
  return { ...state, cutIn: { ...state.cutIn, [template]: cut } };
}

/** A logomarca que está sendo montada, do jeito que o desenho e o arquivo precisam. Sem tipo escolhido, vale "Outro". */
export function makerSpec(state: MakerState, template: TemplateId = state.template): LogoSpec {
  return { template, food: state.food ?? "geral", palette: state.palette, name: state.name };
}

/** Os seis modelos com o tipo, a cor e o nome de agora. */
export function modelSpecs(state: MakerState): LogoSpec[] {
  const clean = cleanName(state.name);
  return TEMPLATES.map((template) => ({ template, food: state.food ?? "geral", palette: state.palette, name: clean }));
}

/** O que impede de salvar: sem nome, a logomarca sairia em branco. Vazio quando está tudo certo. */
export function nameProblem(state: MakerState): string {
  return cleanName(state.name) === "" ? LOGO_NAME_EMPTY : "";
}

// ------------------------------------------------------------------------------------------------ entender o que foi dito

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O tipo de comida que a pessoa disse ("pizzaria", "lanchonete", "açaí"). Usa as mesmas palavras que adivinham pelo nome do
 * restaurante; "outro" vale "Outro". Sem pista, devolve null: a tela diz que não entendeu e manda tocar numa figura.
 */
export function foodFromWords(words: string): FoodId | null {
  const found = guessFood(words);
  if (found) return found;
  return /\boutr[oa]s?\b/.test(plain(words)) ? "geral" : null;
}

const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "na", "no"]);

/**
 * O nome ditado vira nome de restaurante: sem ponto no fim, primeira letra de cada palavra grande em maiúscula
 * ("pizzaria do zé" -> "Pizzaria do Zé"). O resto fica como o celular escreveu, para não estragar "BBQ" ou "JC".
 */
export function nameFromWords(words: string): string {
  const clean = cleanName(words.replace(/[.!?,;:]+$/g, ""));
  if (clean === "") return "";
  const spelled = clean
    .split(" ")
    .map((word, index) => {
      if (index > 0 && LOWER_WORDS.has(word.toLocaleLowerCase("pt-BR"))) return word;
      const letters = Array.from(word);
      return letters[0].toLocaleUpperCase("pt-BR") + letters.slice(1).join("");
    })
    .join(" ");
  return cleanName(spelled);
}

/** O que a bolinha respondeu ao tipo de comida dito. `food` é o que foi entendido (null = nada). */
export function saidFoodText(words: string, food: FoodId | null): string {
  if (words.trim() === "") return LOGO_HEARD_NONE;
  if (!food) return LOGO_HEARD_FOOD_NONE;
  const label = FOODS.find((entry) => entry.id === food)?.label ?? "";
  return LOGO_HEARD_FOOD(label);
}

/** O que a bolinha respondeu ao nome ditado. */
export function saidNameText(words: string, name: string): string {
  if (words.trim() === "" || name === "") return LOGO_HEARD_NONE;
  return LOGO_HEARD_NAME(name);
}

// ------------------------------------------------------------------------------------------------ erros

/**
 * A frase de quando abrir ou preparar a imagem falha no próprio celular. As frases de `logo/logoFiles` e `photos/photoFiles`
 * já são em português e dizem o que fazer ("Escolha outra"): passam como vieram. Erro do navegador (em inglês) não passa.
 */
export function localFailText(error: unknown, fallback: string = LOGO_OPEN_FAIL): string {
  const message = error instanceof Error ? error.message.trim() : "";
  return message !== "" && /\b(não|escolha|tente|imagem|foto)\b/i.test(message) ? message : fallback;
}

/**
 * O nome do arquivo que vai para o servidor, pelo tipo da imagem. Não leva o nome que o celular deu à foto (IMG_2231.jpg,
 * nome da pessoa, data): a logomarca é pública e o nome do arquivo não precisa ir junto.
 */
export function uploadNameOf(type: string): string {
  const kind = type.toLowerCase();
  if (kind === "image/jpeg") return "logomarca.jpg";
  if (kind === "image/webp") return "logomarca.webp";
  return "logomarca.png";
}

// ------------------------------------------------------------------------------------------------ a tela

export type ReviewInput = {
  originalSrc: string;
  refinedSrc: string;
  useRefined: boolean;
  tooLight: boolean;
  small: boolean;
};

export type LogoViewInput = {
  load: "loading" | "ready" | "error";
  loadError: string;
  /** O nome do restaurante. */
  name: string;
  /** O endereço da logomarca de agora, já conferido (`mediaUrl`). Vazio = não tem. */
  logoSrc: string;
  mode: "home" | "review" | "maker";
  working: "" | "opening" | "saving" | "removing";
  notice: { ok: boolean; text: string } | null;
  removeArmed: boolean;
  review: ReviewInput | null;
  maker: MakerState | null;
  canListen: boolean;
  listening: "" | "food" | "name";
  heard: string;
  said: string;
};

/** O que a tela diz enquanto espera o servidor ou o aparelho. */
export function workingText(working: LogoViewInput["working"]): string {
  if (working === "opening") return LOGO_OPENING;
  if (working === "saving") return LOGO_SAVING;
  if (working === "removing") return LOGO_REMOVING;
  return "";
}

function homeViewOf(input: LogoViewInput): LogoHomeView {
  const hasLogo = input.logoSrc !== "";
  return {
    logoSrc: input.logoSrc,
    hasLogo,
    lead: hasLogo ? LOGO_LEAD_HAS : LOGO_LEAD_NONE,
    next: hasLogo ? LOGO_NEXT_HAS : LOGO_NEXT_NONE,
    tip: LOGO_TIP,
    makeLabel: hasLogo ? LOGO_MAKE_ANOTHER : LOGO_MAKE,
    removeArmed: input.removeArmed,
    working: workingText(input.working),
    notice: input.notice,
  };
}

function reviewViewOf(input: LogoViewInput, review: ReviewInput): LogoReviewView {
  const refined = review.refinedSrc !== "";
  const warnings: string[] = [];
  if (review.tooLight) warnings.push(LOGO_TOO_LIGHT);
  if (review.small) warnings.push(LOGO_SMALL);
  const useRefined = refined && review.useRefined;
  return {
    originalSrc: review.originalSrc,
    refinedSrc: review.refinedSrc,
    useRefined,
    shownSrc: useRefined ? review.refinedSrc : review.originalSrc,
    lead: refined ? LOGO_REVIEW_LEAD_REFINED : LOGO_REVIEW_LEAD,
    restaurant: input.name.trim() || LOGO_NAME_FALLBACK,
    warnings,
    busy: input.working !== "",
    saving: input.working === "saving",
    error: input.notice && !input.notice.ok ? input.notice.text : "",
  };
}

function pickListOf<T extends string>(ids: readonly T[], labelOf: (id: T) => string, picked: T | null, extra?: (id: T) => Partial<LogoPick>): LogoPick[] {
  return ids.map((id) => ({ id, label: labelOf(id), picked: picked === id, ...(extra ? extra(id) : {}) }));
}

function makerViewOf(input: LogoViewInput, state: MakerState): LogoMakerView {
  const anyCut = TEMPLATES.some((template) => state.cutIn[template]);
  const question = state.step === 1 ? LOGO_Q1 : state.step === 2 ? LOGO_Q2 : LOGO_Q3;
  const micOff = state.step === 1 ? LOGO_FOOD_MIC_OFF : LOGO_NAME_MIC_OFF;
  return {
    step: state.step,
    stepText: LOGO_STEP_OF(state.step),
    question,
    help: state.step === 2 ? LOGO_Q2_HINT : "",
    foods: FOODS.map((food) => ({
      id: food.id,
      label: food.label,
      picked: state.food === food.id,
      ...(state.guess === food.id && state.food !== food.id ? { hint: LOGO_GUESS } : {}),
    })),
    palettes: pickListOf(
      PALETTES.map((palette) => palette.id),
      (id) => PALETTES.find((palette) => palette.id === id)?.label ?? id,
      state.palette,
      (id) => ({ color: paletteById(id).main }),
    ),
    models: pickListOf(TEMPLATES, (id) => MODEL_LABEL[id], state.template),
    name: state.name,
    nameHelp: LOGO_NAME_HINT,
    cutNote: anyCut ? LOGO_NAME_CUT : "",
    canListen: input.canListen,
    listening: input.listening,
    heard: input.heard,
    said: input.said || (input.canListen ? "" : micOff),
    canNext: state.step !== 1 || state.food !== null,
    nextHint: state.step === 1 && state.food === null ? LOGO_NEXT_HINT : "",
    saving: input.working === "saving",
    error: input.notice && !input.notice.ok ? input.notice.text : "",
  };
}

/** Tudo o que a tela mostra, montado do que o container guarda. A tela nova só desenha isto. */
export function logoViewOf(input: LogoViewInput): LogoView {
  const base = { title: LOGO_TITLE, sub: input.name.trim() || LOGO_SUB_FALLBACK };
  if (input.load === "loading") {
    return { ...base, stage: "loading", error: "", home: null, review: null, maker: null, live: LOGO_LOADING };
  }
  if (input.load === "error") {
    return { ...base, stage: "error", error: input.loadError, home: null, review: null, maker: null, live: input.loadError };
  }
  const working = workingText(input.working);
  if (input.mode === "review" && input.review) {
    const review = reviewViewOf(input, input.review);
    return {
      ...base,
      stage: "review",
      error: "",
      home: null,
      review,
      maker: null,
      live: working || review.error || `${LOGO_REVIEW_TITLE} ${LOGO_REVIEW_NOT_SAVED}`,
    };
  }
  if (input.mode === "maker" && input.maker) {
    const maker = makerViewOf(input, input.maker);
    return {
      ...base,
      stage: "maker",
      error: "",
      home: null,
      review: null,
      maker,
      live: working || maker.error || `${maker.stepText}. ${maker.question}`,
    };
  }
  const home = homeViewOf(input);
  return {
    ...base,
    stage: "home",
    error: "",
    home,
    review: null,
    maker: null,
    live: working || input.notice?.text || `${home.lead} ${home.next}`,
  };
}
