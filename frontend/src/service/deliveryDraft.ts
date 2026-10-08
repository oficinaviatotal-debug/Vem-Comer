/**
 * The delivery regions the owner edits (tab "Entrega"): what is on screen, what is checked before saving, and what
 * is sent. Pure logic, no React: tests/ui/deliveryDraft.test.mjs runs it in Node.
 *
 * The server checks the same rules (backend/delivery.py) and has the last word; checking here only saves the owner a
 * round trip and says what is wrong in words. A region is a name, the start of the CEPs it covers ("30110" covers
 * 30110-000 to 30110-999), a fee, a minimum order and a time in minutes.
 */

export const LIMITS = {
  zones: 20,
  prefixes: 40,
  name: 60,
  maxFeeCents: 99999,
  maxMinOrderCents: 999999,
  etaMin: 5,
  etaMax: 240,
};

/** What the server sends and takes for one region. Money travels as text ("5.00"). */
export type ApiZone = {
  id?: string;
  name: string;
  cep_prefixes: string[];
  fee: string | number;
  min_order: string | number;
  eta_minutes: number | null;
  active: boolean;
};

export type ApiDelivery = {
  accepts_pickup: boolean;
  delivery_paused: boolean;
  zones: ApiZone[];
};

/** One region on screen: every field is the text the owner sees and types. */
export type DraftZone = {
  uid: string;
  id?: string;
  name: string;
  /** "30110, 30120": the starts of the CEPs. */
  ceps: string;
  fee: string;
  minOrder: string;
  /** Minutes, only digits. */
  eta: string;
  active: boolean;
};

export type Draft = {
  acceptsPickup: boolean;
  paused: boolean;
  zones: DraftZone[];
};

let counter = 0;
export function nextUid(): string {
  counter += 1;
  return `z${counter}`;
}

export const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** For comparing names: "Vila Nova" and "vila  nova" and "Vilã Nova" are the same region. */
export function sameName(a: string, b: string): boolean {
  const plain = (text: string) =>
    oneLine(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLocaleLowerCase("pt-BR");
  return plain(a) === plain(b);
}

/**
 * "5", "5,50", "R$ 5,50", "1.234,50" -> cents; "" -> 0 (free / no minimum); anything else -> null.
 * A comma makes the dots thousands marks, the same as the customer's cash field.
 */
export function parseMoneyCents(text: string, max: number): number | null {
  const cleaned = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) && cents <= max ? cents : null;
}

/** A server amount ("5.00") shown the way the owner types it: "5,00"; zero shows empty. */
export function moneyToInput(value: number | string | null | undefined): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return (Math.round(number * 100) / 100).toFixed(2).replace(".", ",");
}

export function centsToInput(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

export const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** "30110-000, 30120 30130" -> prefixes of 3 to 8 digits, without repeats; `bad` has the pieces that are not CEPs. */
export function parseCeps(text: string): { prefixes: string[]; bad: string[] } {
  const prefixes: string[] = [];
  const bad: string[] = [];
  for (const piece of text.split(/[,;\s]+/)) {
    if (!piece) continue;
    const digits = piece.replace(/\D/g, "");
    if (digits.length < 3 || digits.length > 8) {
      bad.push(piece);
      continue;
    }
    if (!prefixes.includes(digits)) prefixes.push(digits);
  }
  return { prefixes, bad };
}

/** ["30110", "30120"] -> "30110, 30120", the way it shows in the field. */
export function formatCeps(prefixes: string[]): string {
  return prefixes.join(", ");
}

export function blankZone(): DraftZone {
  return { uid: nextUid(), name: "", ceps: "", fee: "", minOrder: "", eta: "", active: true };
}

export function fromApi(data: Partial<ApiDelivery> | null | undefined): Draft {
  return {
    acceptsPickup: data?.accepts_pickup !== false,
    paused: data?.delivery_paused === true,
    zones: (Array.isArray(data?.zones) ? data.zones : []).map((zone) => ({
      uid: nextUid(),
      id: zone.id,
      name: zone.name ?? "",
      ceps: formatCeps(Array.isArray(zone.cep_prefixes) ? zone.cep_prefixes : []),
      fee: moneyToInput(zone.fee),
      minOrder: moneyToInput(zone.min_order),
      eta: zone.eta_minutes ? String(zone.eta_minutes) : "",
      active: zone.active !== false,
    })),
  };
}

/** What goes to the server. Call `validate` first: this assumes every field reads. */
export function toPayload(draft: Draft): ApiDelivery {
  return {
    accepts_pickup: draft.acceptsPickup,
    delivery_paused: draft.paused,
    zones: draft.zones.map((zone) => ({
      ...(zone.id ? { id: zone.id } : {}),
      name: oneLine(zone.name),
      cep_prefixes: parseCeps(zone.ceps).prefixes,
      fee: ((parseMoneyCents(zone.fee, LIMITS.maxFeeCents) ?? 0) / 100).toFixed(2),
      min_order: ((parseMoneyCents(zone.minOrder, LIMITS.maxMinOrderCents) ?? 0) / 100).toFixed(2),
      eta_minutes: zone.eta.trim() ? Number(zone.eta) : null,
      active: zone.active,
    })),
  };
}

/** Everything wrong, in words for the owner (the same rules the server applies). Empty list = can save. */
export function validate(draft: Draft): string[] {
  const problems: string[] = [];
  if (draft.zones.length > LIMITS.zones) problems.push(`Use no máximo ${LIMITS.zones} regiões.`);

  const seen: string[] = [];
  draft.zones.forEach((zone, index) => {
    const name = oneLine(zone.name);
    const label = name || `Região ${index + 1}`;

    if (!name) problems.push(`${label}: escreva o nome.`);
    else if (name.length > LIMITS.name) problems.push(`${label}: use até ${LIMITS.name} letras no nome.`);
    else if (seen.some((other) => sameName(other, name))) {
      problems.push(`Duas regiões com o nome ${name}. Use nomes diferentes.`);
    }
    seen.push(name);

    const { prefixes, bad } = parseCeps(zone.ceps);
    if (bad.length > 0) {
      problems.push(`${label}: "${bad[0]}" não é o começo de um CEP. Use de 3 a 8 números, como 30110.`);
    } else if (prefixes.length === 0) {
      problems.push(`${label}: escreva o começo dos CEPs que ela cobre, como 30110.`);
    } else if (prefixes.length > LIMITS.prefixes) {
      problems.push(`${label}: use no máximo ${LIMITS.prefixes} começos de CEP.`);
    }

    if (parseMoneyCents(zone.fee, LIMITS.maxFeeCents) === null) {
      problems.push(`${label}: taxa inválida. Escreva assim: 5,50 (até ${reais(LIMITS.maxFeeCents)}).`);
    }
    if (parseMoneyCents(zone.minOrder, LIMITS.maxMinOrderCents) === null) {
      problems.push(`${label}: pedido mínimo inválido. Escreva assim: 20,00 (até ${reais(LIMITS.maxMinOrderCents)}).`);
    }
    if (zone.eta.trim()) {
      const eta = /^\d+$/.test(zone.eta.trim()) ? Number(zone.eta) : NaN;
      if (!(eta >= LIMITS.etaMin && eta <= LIMITS.etaMax)) {
        problems.push(`${label}: o prazo é em minutos, entre ${LIMITS.etaMin} e ${LIMITS.etaMax}.`);
      }
    }
  });
  return problems;
}

/** The region in plain words, under it, so the owner sees what the customer will be told. */
export function sentence(zone: DraftZone): string {
  const { prefixes } = parseCeps(zone.ceps);
  const fee = parseMoneyCents(zone.fee, LIMITS.maxFeeCents) ?? 0;
  const min = parseMoneyCents(zone.minOrder, LIMITS.maxMinOrderCents) ?? 0;
  const parts = [
    prefixes.length === 0
      ? "Falta dizer os CEPs."
      : `CEP começando em ${prefixes.join(", ")}.`,
    fee === 0 ? "Entrega grátis." : `Taxa de ${reais(fee)}.`,
    min === 0 ? "Sem pedido mínimo." : `Pedido mínimo de ${reais(min)}.`,
  ];
  if (/^\d+$/.test(zone.eta.trim())) parts.push(`Prazo de ${Number(zone.eta)} minutos.`);
  if (!zone.active) parts.push("Desligada: o cliente não vê.");
  return parts.join(" ");
}

/** Short badge for the tab: "3 regiões", "entrega pausada", "sem entrega". */
export function summaryBadge(draft: Pick<Draft, "paused" | "zones">): string {
  const on = draft.zones.filter((zone) => zone.active).length;
  if (on === 0) return "Sem entrega";
  if (draft.paused) return "Entrega pausada";
  return on === 1 ? "1 região" : `${on} regiões`;
}

export type SpokenZone = {
  name: string;
  /** Only what was said; the rest stays as it was. */
  prefixes?: string[];
  feeCents?: number;
  minCents?: number;
  eta?: number;
};

/** A said region becomes a draft one. */
export function zoneFrom(spoken: SpokenZone): DraftZone {
  return {
    uid: nextUid(),
    name: spoken.name,
    ceps: formatCeps(spoken.prefixes ?? []),
    fee: centsToInput(spoken.feeCents ?? 0),
    minOrder: centsToInput(spoken.minCents ?? 0),
    eta: spoken.eta ? String(spoken.eta) : "",
    active: true,
  };
}

/**
 * Puts what was said into the regions on screen. A region with the same name is updated with the fields that were
 * said (what was not said stays); a new name is added at the end, up to the limit. Nothing is saved from here.
 */
export function mergeZones(current: DraftZone[], said: SpokenZone[]): DraftZone[] {
  const out = current.map((zone) => ({ ...zone }));
  for (const spoken of said) {
    const found = out.find((zone) => sameName(zone.name, spoken.name));
    if (found) {
      if (spoken.prefixes) found.ceps = formatCeps(spoken.prefixes);
      if (spoken.feeCents !== undefined) found.fee = centsToInput(spoken.feeCents);
      if (spoken.minCents !== undefined) found.minOrder = centsToInput(spoken.minCents);
      if (spoken.eta !== undefined) found.eta = String(spoken.eta);
      continue;
    }
    if (out.length < LIMITS.zones) out.push(zoneFrom(spoken));
  }
  return out;
}
