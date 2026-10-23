/**
 * O jeito de falar do Vem: o motor que faz as frases da voz não ficarem velhas nem cansativas.
 *
 * Três regras, todas puras (sem React, sem rede): tests/novo/phrasing.test.mjs roda isto no Node.
 *
 *  1. **Não repete.** Cada situação tem várias formas de dizer a mesma coisa. Elas saem numa "sacola embaralhada":
 *     todas passam uma vez antes de qualquer uma voltar, e a primeira da sacola nova nunca é a última da velha.
 *  2. **Encurta com o uso.** Uma explicação completa vale as primeiras vezes; depois que a pessoa já ouviu, vale a forma
 *     curta ("Pode falar." em vez de "Estou ouvindo. Diga a tela que você quer abrir."). Quem fica semanas sem usar
 *     ouve a explicação de novo (o contador esquece depois de `FORGET_DAYS` dias).
 *  3. **Só o que não é ordem muda.** Saudação, confirmação, "não entendi" e resumo do dia variam. Botão, instrução de
 *     como fazer e aviso de erro com remédio ("toque em Tentar de novo") ficam sempre iguais: quem aprendeu onde tocar
 *     não pode ter o nome do botão trocado de um dia para o outro.
 *
 * Os textos moram em `voiceCopy.ts` (um lugar só, com a data da última revisão). Nada aqui inventa fato: o motor só
 * escolhe entre formas que dizem a mesma coisa; os números e os nomes vêm de quem chama.
 */

/** Uma forma de dizer: texto pronto, ou uma conta que monta o texto com os dados da hora. */
export type Variant<A extends unknown[] = []> = string | ((...args: A) => string);

/** Uma situação com as suas formas de dizer. */
export type Bank<A extends unknown[] = []> = {
  /** Identifica a situação para contar quantas vezes a pessoa já ouviu (e para a sacola). */
  id: string;
  /** As formas completas. A PRIMEIRA é a de referência: é a que o modo "sem sorteio" (`plainPhraser`) sempre usa. */
  full: readonly [Variant<A>, ...Variant<A>[]];
  /** As formas curtas, para depois que a pessoa já ouviu a explicação `after` vezes. Lista vazia = calar. Sem a chave = sempre completa. */
  short?: readonly Variant<A>[];
  /** Depois de quantas vezes ouvidas a forma curta passa a valer. Padrão: 3. */
  after?: number;
};

export function bank<A extends unknown[] = []>(id: string, spec: Omit<Bank<A>, "id">): Bank<A> {
  return { id, ...spec };
}

export const DEFAULT_AFTER = 3;
/** Quantos dias sem ouvir uma frase até a pessoa voltar a ouvir a explicação completa. */
export const FORGET_DAYS = 21;
/** O contador para de crescer aqui (não precisa contar mais que isso). */
const COUNT_CAP = 99;

export type Moment = "manha" | "tarde" | "noite";

/** O momento do dia pela hora de Brasília (0 a 23), no mesmo corte do "Bom dia / Boa tarde / Boa noite". */
export function momentOf(hour: number): Moment {
  if (hour >= 5 && hour < 12) return "manha";
  if (hour >= 12 && hour < 18) return "tarde";
  return "noite";
}

/** Quem conta quantas vezes cada frase já foi dita a esta pessoa (neste celular). */
export type CountStore = {
  read(id: string): number;
  write(id: string, count: number): void;
};

/** Contador só na memória (some ao fechar a página). */
export function memoryStore(): CountStore {
  const counts = new Map<string, number>();
  return {
    read: (id) => counts.get(id) ?? 0,
    write: (id, count) => void counts.set(id, count),
  };
}

const STORE_KEY = "vem.frases.v1";
const DAY_MS = 86400000;

/**
 * Contador que guarda no próprio celular (localStorage), junto com o dia da última vez. Nada sai do aparelho.
 * Se o celular não deixa guardar (aba privada, armazenamento cheio), o contador simplesmente fica na memória.
 */
export function webStore(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined, now: () => number = Date.now): CountStore {
  const memory = memoryStore();
  const day = () => Math.floor(now() / DAY_MS);

  function load(): Record<string, [number, number]> {
    if (!storage) return {};
    try {
      const raw = storage.getItem(STORE_KEY);
      const data: unknown = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      const clean: Record<string, [number, number]> = {};
      for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
        if (Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1])) clean[id] = [Number(value[0]), Number(value[1])];
      }
      return clean;
    } catch {
      return {};
    }
  }

  return {
    read(id) {
      const kept = load()[id];
      if (!kept) return memory.read(id);
      // Muito tempo sem ouvir esta frase: a pessoa pode ter esquecido; volta a explicação completa.
      if (day() - kept[1] > FORGET_DAYS) return 0;
      return Math.max(0, Math.min(COUNT_CAP, Math.floor(kept[0])));
    },
    write(id, count) {
      const safe = Math.max(0, Math.min(COUNT_CAP, Math.floor(count)));
      memory.write(id, safe);
      if (!storage) return;
      try {
        const data = load();
        data[id] = [safe, day()];
        storage.setItem(STORE_KEY, JSON.stringify(data));
      } catch {
        // sem onde guardar: segue só na memória
      }
    },
  };
}

/** O contador do navegador. Acessar `localStorage` pode dar erro (aba privada); nesse caso vira só memória. */
export function browserStore(): CountStore {
  let storage: Storage | null = null;
  try {
    storage = typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    storage = null;
  }
  return webStore(storage);
}

export type Phraser = {
  /** Diz a situação de `bank` com os dados de `args`: escolhe a forma da vez e conta que a pessoa ouviu. */
  say<A extends unknown[]>(bank: Bank<A>, ...args: A): string;
  /** `size` itens de `items`, andando pela lista a cada chamada (para os exemplos não serem sempre os mesmos). */
  window<T>(id: string, items: readonly T[], size: number): T[];
};

type Bag = { size: number; left: number[]; last: number };

function shuffled(size: number, rand: () => number): number[] {
  const order = Array.from({ length: size }, (_, index) => index);
  for (let i = size - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(rand() * (i + 1))));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function draw(bags: Map<string, Bag>, key: string, size: number, rand: () => number): number {
  let bag = bags.get(key);
  if (!bag || bag.size !== size) {
    bag = { size, left: [], last: -1 };
    bags.set(key, bag);
  }
  if (bag.left.length === 0) {
    const order = shuffled(size, rand);
    // A primeira da sacola nova nunca é a última da sacola velha (senão a mesma frase sairia duas vezes seguidas).
    if (size > 1 && order[0] === bag.last) [order[0], order[size - 1]] = [order[size - 1], order[0]];
    bag.left = order;
  }
  const index = bag.left.shift() as number;
  bag.last = index;
  return index;
}

function render<A extends unknown[]>(variant: Variant<A>, args: A): string {
  return typeof variant === "function" ? variant(...args) : variant;
}

/** O falador de verdade: sorteia sem repetir e encurta com o uso. `rand` e `store` entram de fora para o teste mandar. */
export function createPhraser(options: { rand?: () => number; store?: CountStore } = {}): Phraser {
  const rand = options.rand ?? Math.random;
  const store = options.store ?? memoryStore();
  const bags = new Map<string, Bag>();
  const windows = new Map<string, number>();

  return {
    say(spec, ...args) {
      const heard = store.read(spec.id);
      const useShort = spec.short !== undefined && heard >= (spec.after ?? DEFAULT_AFTER);
      const pool: readonly Variant<typeof args>[] = useShort ? (spec.short as readonly Variant<typeof args>[]) : spec.full;
      store.write(spec.id, heard + 1);
      if (pool.length === 0) return "";
      const index = draw(bags, `${spec.id}:${useShort ? "short" : "full"}`, pool.length, rand);
      return render(pool[index], args);
    },
    window(id, items, size) {
      const total = items.length;
      if (total === 0 || size <= 0) return [];
      if (total <= size) return [...items];
      const start = windows.get(id) ?? 0;
      windows.set(id, (start + size) % total);
      return Array.from({ length: size }, (_, offset) => items[(start + offset) % total]);
    },
  };
}

/**
 * O falador "sem sorteio": sempre a forma de referência, sem contar nada. É o padrão de quem não recebe um falador
 * (os testes das contas puras) e a garantia de que, sem o motor, a frase é a mesma de sempre.
 */
export const plainPhraser: Phraser = {
  say(spec, ...args) {
    return render(spec.full[0], args);
  },
  window(_id, items, size) {
    return size <= 0 ? [] : items.slice(0, size);
  },
};
