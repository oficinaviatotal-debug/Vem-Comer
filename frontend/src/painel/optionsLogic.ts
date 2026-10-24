/**
 * Opções do prato (tamanho, adicionais, retirar), versão nova: as contas da tela. Só conta, sem React nem rede:
 * tests/novo/optionsLogic.test.mjs roda isto no Node.
 *
 * Nada aqui inventa regra. Quem confere nome, preço, mínimo e máximo é o mesmo código da tela antiga
 * (`service/optionsDraft`), que repete o que o servidor confere; quem entende a frase falada ou escrita é
 * `service/spokenOptions`. O servidor continua sendo a palavra final e a frase dele passa como veio.
 *
 * O que a pessoa fala ou escreve só vira rascunho na tela: nada é salvo até ela tocar em "Salvar as opções".
 */
import {
  LIMITS,
  STARTERS,
  blankItem,
  fitGroup,
  fromApi,
  groupFrom,
  groupsBadge,
  mergeGroups,
  sentence,
  starter,
  toPayload,
  validate,
  type DraftGroup,
  type DraftItem,
  type StarterKind,
} from "../service/optionsDraft.ts";
import { SPOKEN_OPTIONS_HELP, parseSpokenOptions } from "../service/spokenOptions.ts";
import type { Product } from "../customer/types.ts";
import {
  DISH_OPTIONS_CHANGE,
  DISH_OPTIONS_MAKE,
  DISH_OPTIONS_NONE,
  OPT_INTRO_HAS,
  OPT_INTRO_NONE,
  OPT_INTRO_NONE_VOICE,
  OPT_LOADING,
  OPT_NOT_HEARD,
  OPT_NOT_UNDERSTOOD,
  OPT_SAVED,
  OPT_SAVED_NONE,
  OPT_STARTERS_MORE,
  OPT_STARTERS_NONE,
  OPT_TITLE,
  OPT_UNDERSTOOD,
  OPT_UNSAVED,
} from "../novo/copy.ts";
import type { DishOptionsLine, DishOptionsView, OptionGroupView, OptionsHeardView } from "../novo/types.ts";

export type { DraftGroup, DraftItem, StarterKind };

/** Os grupos que o servidor mandou (`GET /api/admin/products/<id>/options`) viram o rascunho da tela. */
export function draftsOfApi(groups: Parameters<typeof fromApi>[0]): DraftGroup[] {
  return fromApi(groups);
}

/** Tudo o que está errado no rascunho, em frases para o dono (as mesmas regras que o servidor confere). Vazio = pode salvar. */
export function problemsOf(groups: DraftGroup[]): string[] {
  return validate(groups);
}

/** A fotografia do que está na tela, para saber se a pessoa mexeu depois do último "salvo". */
export function snapshotOf(groups: DraftGroup[]): string {
  return JSON.stringify(toPayload(groups));
}

export function isDirty(groups: DraftGroup[], saved: string): boolean {
  return snapshotOf(groups) !== saved;
}

// ------------------------------------------------------------------------------------------------ mexer nos grupos

const mapGroup = (groups: DraftGroup[], uid: string, change: (group: DraftGroup) => DraftGroup): DraftGroup[] =>
  groups.map((group) => (group.uid === uid ? change(group) : group));

/** O mais que o grupo pode pedir: o número de opções (e nunca mais que o limite), no mínimo 1. */
const topOf = (group: DraftGroup): number => Math.max(1, Math.min(group.items.length, LIMITS.pick));

export function renameGroup(groups: DraftGroup[], uid: string, name: string): DraftGroup[] {
  return mapGroup(groups, uid, (group) => ({ ...group, name }));
}

/** "O cliente precisa escolher? Sim" pede pelo menos 1; "Não" deixa livre (0). */
export function setRequired(groups: DraftGroup[], uid: string, required: boolean): DraftGroup[] {
  return mapGroup(groups, uid, (group) => fitGroup({ ...group, min: required ? Math.max(1, group.min) : 0 }));
}

/** O "pode escolher até": sobe ou desce de um em um, sem passar do mínimo nem do número de opções. */
export function stepMax(groups: DraftGroup[], uid: string, delta: 1 | -1): DraftGroup[] {
  return mapGroup(groups, uid, (group) => {
    const next = Math.max(Math.max(1, group.min), Math.min(topOf(group), group.max + delta));
    return fitGroup({ ...group, max: next });
  });
}

/** O "pelo menos": só vale para grupo obrigatório (1 ou mais), sem passar do máximo. */
export function stepMin(groups: DraftGroup[], uid: string, delta: 1 | -1): DraftGroup[] {
  return mapGroup(groups, uid, (group) => {
    const next = Math.max(1, Math.min(Math.min(group.max, topOf(group)), group.min + delta));
    return fitGroup({ ...group, min: next });
  });
}

const mapItem = (groups: DraftGroup[], groupUid: string, itemUid: string, change: (item: DraftItem) => DraftItem): DraftGroup[] =>
  mapGroup(groups, groupUid, (group) => ({ ...group, items: group.items.map((item) => (item.uid === itemUid ? change(item) : item)) }));

export function renameItem(groups: DraftGroup[], groupUid: string, itemUid: string, name: string): DraftGroup[] {
  return mapItem(groups, groupUid, itemUid, (item) => ({ ...item, name }));
}

export function priceItem(groups: DraftGroup[], groupUid: string, itemUid: string, price: string): DraftGroup[] {
  return mapItem(groups, groupUid, itemUid, (item) => ({ ...item, price }));
}

/** Tem / Acabou: a opção continua na lista, mas o cliente só escolhe a que tem. */
export function flipItem(groups: DraftGroup[], groupUid: string, itemUid: string): DraftGroup[] {
  return mapItem(groups, groupUid, itemUid, (item) => ({ ...item, active: !item.active }));
}

export function addItem(groups: DraftGroup[], groupUid: string): DraftGroup[] {
  return mapGroup(groups, groupUid, (group) => (group.items.length >= LIMITS.items ? group : { ...group, items: [...group.items, blankItem()] }));
}

export function removeItem(groups: DraftGroup[], groupUid: string, itemUid: string): DraftGroup[] {
  return mapGroup(groups, groupUid, (group) => fitGroup({ ...group, items: group.items.filter((item) => item.uid !== itemUid) }));
}

export function removeGroup(groups: DraftGroup[], uid: string): DraftGroup[] {
  return groups.filter((group) => group.uid !== uid);
}

/** Um modelo pronto (Tamanho, Adicionais, Retirar, Outro grupo) no fim da lista. Passou do limite, a lista não muda. */
export function addStarter(groups: DraftGroup[], kind: StarterKind): DraftGroup[] {
  return groups.length >= LIMITS.groups ? groups : [...groups, starter(kind)];
}

// ------------------------------------------------------------------------------------------------ falar ou escrever

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * O que foi falado ou escrito vira grupos na tela (junto com o que já estava lá). Não salva nada.
 * Se nada foi entendido, a lista fica como estava e a frase diz o que falar. Se o limite de grupos ou de opções
 * deixou algo de fora, a frase diz o quê (nada some em silêncio).
 */
export function hearOptions(groups: DraftGroup[], said: string, basePriceCents: number): { groups: DraftGroup[]; heard: OptionsHeardView } {
  const words = said.replace(/\s+/g, " ").trim();
  const parsed = words ? parseSpokenOptions(words, basePriceCents) : { groups: [], lines: [], notes: [] };
  if (parsed.groups.length === 0) {
    const lead = words ? OPT_NOT_UNDERSTOOD : OPT_NOT_HEARD;
    return { groups, heard: { said: words, lines: [], notes: parsed.notes, unclear: `${lead} ${SPOKEN_OPTIONS_HELP}` } };
  }
  const merged = mergeGroups(groups, parsed.groups.map(groupFrom));
  const notes = [...parsed.notes];
  for (const group of parsed.groups) {
    const there = merged.find((candidate) => plain(candidate.name) === plain(group.name));
    if (!there) {
      notes.push(`O limite é ${LIMITS.groups} grupos por prato. O grupo ${group.name} não entrou.`);
      continue;
    }
    for (const item of group.items) {
      if (!there.items.some((candidate) => plain(candidate.name) === plain(item.name))) {
        notes.push(`Em ${there.name || group.name}, o limite é ${LIMITS.items} opções. ${item.name} não entrou.`);
      }
    }
  }
  return { groups: merged, heard: { said: words, lines: parsed.lines, notes, unclear: "" } };
}

// ------------------------------------------------------------------------------------------------ a tela

export type OptionsViewInput = {
  load: "loading" | "ready" | "error";
  productName: string;
  groups: DraftGroup[];
  /** A fotografia do que o servidor tem (de `snapshotOf` logo depois de abrir ou salvar). */
  saved: string;
  canListen: boolean;
  listening: boolean;
  heard: string;
  said: OptionsHeardView | null;
  saving: boolean;
  problems: string[];
  notice: { ok: boolean; text: string } | null;
  /** A frase de quando as opções não abriram (a do servidor, se veio). */
  error: string;
  /** O grupo cuja lixeira já recebeu o primeiro toque. */
  armedGroup: string | null;
  backArmed: boolean;
};

const manyThings = (count: number) => (count === 1 ? "1 coisa" : `${count} coisas`);

/** O que falta para o cliente ver as opções: salvar, ou acertar antes. Vazio quando não há nada a dizer. */
export function optionsHint(groups: DraftGroup[], dirty: boolean): string {
  if (!dirty) return "";
  const problems = validate(groups).length;
  return problems > 0 ? `Tem ${manyThings(problems)} para acertar antes de salvar.` : OPT_UNSAVED;
}

export function savedTextOf(groupCount: number): string {
  return groupCount === 0 ? OPT_SAVED_NONE : OPT_SAVED;
}

function groupViewOf(group: DraftGroup, index: number, armed: boolean): OptionGroupView {
  const fitted = fitGroup(group);
  const top = topOf(fitted);
  return {
    uid: fitted.uid,
    position: index + 1,
    name: fitted.name,
    sentence: sentence(fitted),
    required: fitted.min > 0,
    max: fitted.max,
    canMore: fitted.max < top,
    canLess: fitted.max > Math.max(1, fitted.min),
    min: fitted.min,
    canMinMore: fitted.min < Math.min(fitted.max, top),
    canMinLess: fitted.min > 1,
    items: fitted.items.map((item, position) => ({
      uid: item.uid,
      name: item.name,
      price: item.price,
      active: item.active,
      spoken: item.name.trim() || `opção ${position + 1}`,
    })),
    canAddItem: fitted.items.length < LIMITS.items,
    armed,
  };
}

export function optionsViewOf(input: OptionsViewInput): DishOptionsView {
  const { load, groups, said } = input;
  const dirty = load === "ready" && isDirty(groups, input.saved);
  const intro = groups.length === 0 ? (input.canListen ? OPT_INTRO_NONE_VOICE : OPT_INTRO_NONE) : OPT_INTRO_HAS;
  const canAddGroup = groups.length < LIMITS.groups;
  const live =
    load === "loading"
      ? OPT_LOADING
      : load === "error"
        ? input.error
        : input.notice?.text ||
          (said ? (said.lines.length > 0 ? `${OPT_UNDERSTOOD} ${said.lines.join(". ")}` : said.unclear) : "") ||
          intro;
  return {
    stage: load,
    title: OPT_TITLE,
    sub: input.productName,
    intro,
    error: input.error,
    canListen: input.canListen,
    listening: input.listening,
    heard: input.heard,
    said,
    groups: groups.map((group, index) => groupViewOf(group, index, input.armedGroup === group.uid)),
    starters: canAddGroup ? STARTERS.map((entry) => ({ kind: entry.kind, label: entry.label })) : [],
    startersLabel: groups.length === 0 ? OPT_STARTERS_NONE : OPT_STARTERS_MORE,
    dirty,
    saving: input.saving,
    hint: optionsHint(groups, dirty),
    problems: input.problems,
    notice: input.notice,
    backArmed: input.backArmed,
    live,
  };
}

// ------------------------------------------------------------------------------------------------ no lápis do prato

/** O que o lápis diz das opções do prato hoje (pelo que o cardápio já mandou) e o que o botão diz. */
export function dishOptionsLineOf(product: Pick<Product, "option_groups">): DishOptionsLine {
  const groups = Array.isArray(product.option_groups) ? product.option_groups : [];
  if (groups.length === 0) return { summary: DISH_OPTIONS_NONE, button: DISH_OPTIONS_MAKE };
  const names = groups.map((group) => group.name).filter((name) => typeof name === "string" && name.trim() !== "");
  const badge = groupsBadge(groups.length);
  return { summary: names.length > 0 ? `${badge}: ${names.join(", ")}.` : `${badge}.`, button: DISH_OPTIONS_CHANGE };
}
