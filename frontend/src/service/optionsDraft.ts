/**
 * The owner's editor of options per dish (size, extras, "no onion"): pure logic, no browser APIs.
 *
 * The screen works on a draft (what is typed, as text) and only sends the payload when it passes the same
 * checks the server makes. The server stays the authority: it checks again and says why it refused.
 */

export type DraftItem = {
  /** Only for React keys: stable while the owner types. */
  uid: string;
  /** Present for an option that already exists; keeps it (and a cart in use) when only the price changes. */
  id?: string;
  name: string;
  /** Extra price as typed ("6,50"); empty means free. */
  price: string;
  /** False = "acabou": stays on the list but the customer cannot pick it. */
  active: boolean;
};

export type DraftGroup = {
  uid: string;
  id?: string;
  name: string;
  /** 0 = optional, 1 or more = the customer must pick at least that many. */
  min: number;
  max: number;
  items: DraftItem[];
};

/** What GET /api/admin/products/<id>/options returns for each group. */
export type ApiGroup = {
  id: string;
  name: string;
  min_choices: number;
  max_choices: number;
  items: { id: string; name: string; price_delta: number | string; active: boolean }[];
};

export type OptionsPayload = {
  groups: {
    id?: string;
    name: string;
    min_choices: number;
    max_choices: number;
    items: { id?: string; name: string; price_delta: string; active: boolean }[];
  }[];
};

export const LIMITS = {
  groups: 8,
  items: 30,
  name: 60,
  pick: 20,
  maxPriceCents: 99999,
} as const;

let counter = 0;
const nextUid = () => `d${(counter += 1)}`;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * "6,50", "6.5", "R$ 6,50", "1.250,00" -> cents. Empty is free (0). Not a usable price -> null.
 * Same reading as the customer's cash field: a comma makes the dots thousands marks.
 */
export function parsePriceCents(text: string): number | null {
  const cleaned = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents <= LIMITS.maxPriceCents ? cents : null;
}

/** Cents or a server value ("6.00") shown the way the owner types it: "6,00"; free shows empty. */
export function priceToInput(value: number | string | null | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return (Math.round(number * 100) / 100).toFixed(2).replace(".", ",");
}

export function fromApi(groups: ApiGroup[] | null | undefined): DraftGroup[] {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    uid: nextUid(),
    id: group.id,
    name: group.name,
    min: group.min_choices,
    max: group.max_choices,
    items: (group.items ?? []).map((item) => ({
      uid: nextUid(),
      id: item.id,
      name: item.name,
      price: priceToInput(item.price_delta),
      active: item.active !== false,
    })),
  }));
}

/** Keeps min and max possible for the number of options: min up to the count, max from min (at least 1) to the count. */
export function fitGroup(group: DraftGroup): DraftGroup {
  const count = group.items.length;
  const top = Math.min(count, LIMITS.pick);
  const min = Math.max(0, Math.min(group.min, top));
  const max = Math.max(1, Math.min(Math.max(group.max, min), Math.max(top, 1)));
  return min === group.min && max === group.max ? group : { ...group, min, max };
}

/** What goes to the server. Call only after `validate` finds nothing. */
export function toPayload(groups: DraftGroup[]): OptionsPayload {
  return {
    groups: groups.map((group) => {
      const fitted = fitGroup(group);
      return {
        ...(fitted.id ? { id: fitted.id } : {}),
        name: oneLine(fitted.name),
        min_choices: fitted.min,
        max_choices: fitted.max,
        items: fitted.items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          name: oneLine(item.name),
          price_delta: ((parsePriceCents(item.price) ?? 0) / 100).toFixed(2),
          active: item.active,
        })),
      };
    }),
  };
}

/** Everything wrong, in words for the owner (the same rules the server applies). Empty list = can save. */
export function validate(groups: DraftGroup[]): string[] {
  const problems: string[] = [];
  if (groups.length > LIMITS.groups) {
    problems.push(`Use no máximo ${LIMITS.groups} grupos de opções por prato.`);
  }

  const groupNames = new Set<string>();
  groups.forEach((raw, index) => {
    const group = fitGroup(raw);
    const name = oneLine(group.name);
    const label = name || `Grupo ${index + 1}`;

    if (!name) problems.push(`${label}: escreva o nome do grupo.`);
    else if (name.length > LIMITS.name) problems.push(`${label}: use até ${LIMITS.name} letras no nome.`);
    else if (groupNames.has(name.toLowerCase())) problems.push(`Dois grupos com o nome ${name}. Use nomes diferentes.`);
    groupNames.add(name.toLowerCase());

    if (group.items.length === 0) problems.push(`${label}: coloque pelo menos uma opção.`);
    if (group.items.length > LIMITS.items) problems.push(`${label}: use no máximo ${LIMITS.items} opções.`);

    const itemNames = new Set<string>();
    group.items.forEach((item, position) => {
      const itemName = oneLine(item.name);
      if (!itemName) {
        problems.push(`${label}: escreva o nome da opção ${position + 1}.`);
      } else if (itemName.length > LIMITS.name) {
        problems.push(`${label} / ${itemName}: use até ${LIMITS.name} letras.`);
      } else if (itemNames.has(itemName.toLowerCase())) {
        problems.push(`${label}: a opção ${itemName} está repetida.`);
      }
      itemNames.add(itemName.toLowerCase());
      if (parsePriceCents(item.price) === null) {
        problems.push(`${label} / ${itemName || `opção ${position + 1}`}: preço inválido. Escreva assim: 6,50.`);
      }
    });
  });
  return problems;
}

/** The rule in plain words, under the group, so the owner sees what the customer will see. */
export function sentence(group: Pick<DraftGroup, "min" | "max">): string {
  const { min, max } = group;
  if (min > 0 && min === max) return min === 1 ? "O cliente escolhe 1." : `O cliente escolhe ${min}.`;
  if (min > 0) return `O cliente escolhe de ${min} a ${max}.`;
  return max === 1 ? "O cliente pode escolher 1, se quiser." : `O cliente pode escolher até ${max}, se quiser.`;
}

export type StarterKind = "tamanho" | "adicionais" | "retirar" | "outro";

export const STARTERS: { kind: StarterKind; label: string }[] = [
  { kind: "tamanho", label: "Tamanho" },
  { kind: "adicionais", label: "Adicionais" },
  { kind: "retirar", label: "Retirar" },
  { kind: "outro", label: "Outro grupo" },
];

const newItem = (name: string, price = ""): DraftItem => ({ uid: nextUid(), name, price, active: true });

/** A ready-made group to edit instead of typing everything: the names are only suggestions. */
export function starter(kind: StarterKind): DraftGroup {
  switch (kind) {
    case "tamanho":
      return fitGroup({
        uid: nextUid(),
        name: "Tamanho",
        min: 1,
        max: 1,
        items: [newItem("Pequeno"), newItem("Médio"), newItem("Grande")],
      });
    case "adicionais":
      return fitGroup({ uid: nextUid(), name: "Adicionais", min: 0, max: 3, items: [newItem("")] });
    case "retirar":
      return fitGroup({
        uid: nextUid(),
        name: "Retirar",
        min: 0,
        max: 3,
        items: [newItem("Sem cebola"), newItem("Sem tomate")],
      });
    default:
      return fitGroup({ uid: nextUid(), name: "", min: 0, max: 1, items: [newItem("")] });
  }
}

export function blankItem(): DraftItem {
  return newItem("");
}

/** Short text for the dish row: "2 grupos de opções" or nothing. */
export function groupsBadge(count: number | null | undefined): string {
  const total = Number(count) || 0;
  if (total <= 0) return "";
  return total === 1 ? "1 grupo de opções" : `${total} grupos de opções`;
}

const sameName = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** A group made from a list (what was said out loud), with each price in cents. */
export function groupFrom(parts: {
  name: string;
  min: number;
  max: number;
  items: { name: string; cents: number }[];
}): DraftGroup {
  return fitGroup({
    uid: nextUid(),
    name: parts.name,
    min: parts.min,
    max: parts.max,
    items: parts.items.map((item) => newItem(item.name, item.cents > 0 ? priceToInput(item.cents / 100) : "")),
  });
}

/**
 * Puts groups said out loud next to what is already on the screen. A group with the same name receives the
 * options it does not have yet; an option already there keeps its "Acabou" and takes the new price only if one
 * was said; the rest are added as new groups. Never goes past the limits.
 */
export function mergeGroups(current: DraftGroup[], added: DraftGroup[]): DraftGroup[] {
  const result = current.map((group) => ({ ...group, items: [...group.items] }));
  for (const incoming of added) {
    const target = result.find((group) => sameName(group.name) === sameName(incoming.name));
    if (!target) {
      if (result.length < LIMITS.groups) result.push({ ...incoming, items: [...incoming.items] });
      continue;
    }
    const known = new Set(target.items.map((item) => sameName(item.name)));
    // An option still empty (a ready-made group waiting for its first name) gives its place to the first new one.
    target.items = target.items.filter((item) => item.name.trim() !== "" || item.id);
    for (const item of incoming.items) {
      if (known.has(sameName(item.name))) {
        // Said again with a price: that is the new price. Said again with none: nothing to change.
        const there = target.items.find((other) => sameName(other.name) === sameName(item.name));
        if (there && item.price !== "" && there.price !== item.price) {
          target.items = target.items.map((other) => (other === there ? { ...other, price: item.price } : other));
        }
        continue;
      }
      if (target.items.length >= LIMITS.items) continue;
      known.add(sameName(item.name));
      target.items.push(item);
    }
    Object.assign(target, fitGroup(target));
  }
  return result;
}

