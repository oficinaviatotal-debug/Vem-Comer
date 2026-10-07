/**
 * Mesa viva: as chamadas da mesa (garçom, conta, água, limpeza), do lado do cliente e do painel.
 *
 * Só regras, sem tela e sem rede, para testar com `node --test`. O que o cliente tocou fica guardado
 * neste celular (por restaurante e mesa) para a tela não esquecer, ao recarregar, que o garçom já foi
 * chamado. O armazenamento pode estar bloqueado (aba privada): tudo funciona sem ele.
 */

export type CallKind = "garcom" | "conta" | "agua" | "limpeza";
export type CallStatus = "open" | "answered";
export type Urgency = "normal" | "late" | "urgent";

export type CallOption = { kind: CallKind; label: string; hint: string };

/** Os dois botões grandes da tela da mesa. */
export const MAIN_CALLS: CallOption[] = [
  { kind: "garcom", label: "Chamar garçom", hint: "Preciso de ajuda" },
  { kind: "conta", label: "Pedir a conta", hint: "Quero pagar" },
];

/** Os dois pedidos pequenos, abaixo. */
export const SMALL_CALLS: CallOption[] = [
  { kind: "agua", label: "Água", hint: "Trazer água" },
  { kind: "limpeza", label: "Limpeza", hint: "Limpar a mesa" },
];

const ALL_KINDS: CallKind[] = ["garcom", "conta", "agua", "limpeza"];

export function isKind(value: unknown): value is CallKind {
  return typeof value === "string" && (ALL_KINDS as string[]).includes(value);
}

/** O servidor esquece chamada aberta depois de 2 horas (table_calls.OPEN_WINDOW_MINUTES). */
export const CALL_TTL_MS = 120 * 60 * 1000;
/** Antes disso, o botão fica em "Chamado" e não deixa tocar de novo à toa. */
export const CALL_AGAIN_AFTER_MS = 60 * 1000;
/** De quanto em quanto tempo a tela da mesa pergunta se já atenderam. */
export const CALL_POLL_MS = 8000;

export type MyCall = { id: string; kind: CallKind; status: CallStatus; savedAt: number };

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const memoryKey = (slug: string, tableId: string) => `vc_calls_${slug}_${tableId}`;

function isMyCall(value: unknown): value is MyCall {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    isKind(item.kind) &&
    (item.status === "open" || item.status === "answered") &&
    typeof item.savedAt === "number"
  );
}

export function createCallMemory(storage: StorageLike | null, now: () => number = Date.now) {
  const read = (key: string): string | null => {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  };

  const write = (key: string, value: string) => {
    try {
      storage?.setItem(key, value);
    } catch {
      /* sem armazenamento: a chamada só não é lembrada depois de recarregar */
    }
  };

  /** Uma chamada por tipo, só as recentes. */
  const stored = (slug: string, tableId: string): MyCall[] => {
    const raw = read(memoryKey(slug, tableId));
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const seen = new Set<CallKind>();
      return parsed.filter(isMyCall).filter((call) => {
        if (now() - call.savedAt > CALL_TTL_MS || seen.has(call.kind)) return false;
        seen.add(call.kind);
        return true;
      });
    } catch {
      return [];
    }
  };

  return {
    list: stored,

    /** Guarda (ou troca) a chamada daquele tipo. Devolve a lista nova. */
    put(slug: string, tableId: string, call: { id: string; kind: CallKind; status: CallStatus }): MyCall[] {
      const next = [
        { ...call, savedAt: now() },
        ...stored(slug, tableId).filter((item) => item.kind !== call.kind),
      ];
      write(memoryKey(slug, tableId), JSON.stringify(next));
      return next;
    },

    /** O servidor disse que mudou (atendida). Devolve a lista nova. */
    setStatus(slug: string, tableId: string, id: string, status: CallStatus): MyCall[] {
      const next = stored(slug, tableId).map((call) => (call.id === id ? { ...call, status } : call));
      write(memoryKey(slug, tableId), JSON.stringify(next));
      return next;
    },
  };
}

export type CallMemory = ReturnType<typeof createCallMemory>;

/** O botão do tipo, dado o que já foi chamado: o que escreve, se pode tocar e se já foi atendido. */
export function buttonState(
  option: CallOption,
  call: MyCall | undefined,
  now: number
): { label: string; note: string; disabled: boolean; answered: boolean } {
  if (!call) return { label: option.label, note: option.hint, disabled: false, answered: false };
  if (call.status === "answered") {
    return { label: option.label, note: "Atendido. Toque se precisar de novo.", disabled: false, answered: true };
  }
  if (now - call.savedAt < CALL_AGAIN_AFTER_MS) {
    return { label: "Chamado", note: "Aguarde um instante, já vai chegar.", disabled: true, answered: false };
  }
  return { label: "Chamar de novo", note: "Ainda não veio? Toque para avisar de novo.", disabled: false, answered: false };
}

/** O que o cliente lê quando o servidor responde ao toque. */
export function callErrorMessage(status: number | null, serverMessage: string | null | undefined): string {
  if (status === 429 && serverMessage) return serverMessage;
  if (status === 404) return "Não encontramos esta mesa. Chame o atendente com a mão.";
  return "Não deu para avisar. Confira a internet ou chame o atendente com a mão.";
}

/** "há 40 s", "há 3 min", "há 1 h 05": há quanto tempo a mesa espera. */
export function formatWaiting(seconds: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (total < 10) return "agora";
  if (total < 60) return `há ${Math.floor(total / 10) * 10} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

export type PanelCall = {
  id: string;
  table_number: number;
  kind: CallKind;
  label: string;
  text: string;
  waiting_seconds: number;
  repeats: number;
  urgency: Urgency;
};

/**
 * As chamadas que acabaram de chegar, para o painel avisar (vibrar e piscar).
 * `known` é null na primeira busca: o que já estava aberto ao abrir o painel não faz alarde.
 */
export function freshCalls(known: ReadonlySet<string> | null, calls: PanelCall[]): PanelCall[] {
  if (known === null) return [];
  return calls.filter((call) => !known.has(call.id));
}

/**
 * Chamadas já conhecidas que acabaram de virar urgentes (demorou, ou o cliente tocou de novo):
 * o painel avisa outra vez, uma só vez por chamada.
 */
export function becameUrgent(previous: ReadonlyMap<string, Urgency>, calls: PanelCall[]): PanelCall[] {
  return calls.filter((call) => {
    const before = previous.get(call.id);
    return before !== undefined && before !== "urgent" && call.urgency === "urgent";
  });
}

/** Título curto do aviso no painel: "2 mesas chamando". */
export function barTitle(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? "1 mesa chamando" : `${count} mesas chamando`;
}

/** Só entra na lista o que o servidor mandou direito; o resto é ignorado (a tela nunca quebra por isso). */
export function parsePanelCalls(raw: unknown): PanelCall[] {
  if (!Array.isArray(raw)) return [];
  const out: PanelCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const call = item as Record<string, unknown>;
    if (
      typeof call.id !== "string" ||
      !isKind(call.kind) ||
      typeof call.text !== "string" ||
      typeof call.label !== "string"
    ) {
      continue;
    }
    const urgency: Urgency = call.urgency === "late" || call.urgency === "urgent" ? call.urgency : "normal";
    out.push({
      id: call.id,
      table_number: Number(call.table_number) || 0,
      kind: call.kind,
      label: call.label,
      text: call.text,
      waiting_seconds: Math.max(0, Number(call.waiting_seconds) || 0),
      repeats: Math.max(0, Number(call.repeats) || 0),
      urgency,
    });
  }
  return out;
}

/** Só endereço https de verdade vira link ("Trabalhe aqui"); qualquer outra coisa some. */
export function safeJobsUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
