/**
 * "Acabou o pastel de carne": marcar um prato como esgotado (ou de volta) falando. Só conta, sem React nem rede nem
 * microfone: tests/novo/voiceDishLogic.test.mjs roda isto no Node. Quem busca os pratos e manda ao servidor é
 * `painel/voiceDish.ts`; quem escuta é `useVoiceNav.ts`.
 *
 * Esta é a primeira coisa que a voz **muda** no painel, então as regras são mais duras que as de abrir telas:
 *  - **nunca muda na primeira frase.** A voz acha o prato, **diz o nome que entendeu** e pergunta; só depois de "sim"
 *    (falado ou no botão) vai ao servidor. "Não", outra frase ou 30 segundos de silêncio: nada muda;
 *  - **não adivinha.** Mais de um prato com a palavra ("açaí" com o de 300 e o de 500): lista os nomes e pede o nome
 *    inteiro. Nenhum prato: diz isso e abre os produtos;
 *  - **só para quem o servidor deixa** (dono, gerente e cozinha) e que abre Produtos: o garçom não ouve uma pergunta que o servidor vai recusar;
 *  - o que o servidor responder vale: a voz não afirma que marcou sem o servidor confirmar.
 * Vale também o contrário, "voltou o pastel de carne" (tira o esgotado), e cada resposta ensina como desfazer.
 */
import { isSoldOut } from "../customer/openness.ts";
import { plainPhraser, type Phraser } from "../novo/phrasing.ts";
import {
  SAY_DISH_ALREADY_BACK,
  SAY_DISH_ALREADY_SOLD,
  SAY_DISH_ASK_BACK,
  SAY_DISH_ASK_SOLD,
  SAY_DISH_MANY,
  SAY_DISH_NONE,
} from "../novo/voiceCopy.ts";

export type DishAction = "soldout" | "back";

/**
 * Quem o servidor deixa marcar prato esgotado (`admin_set_sold_out`): dono, gerente e cozinha. Quem vê Produtos no menu
 * mas não está aqui (garçom, caixa, entregador) não ouve pergunta nenhuma: a voz não oferece o que o servidor vai recusar.
 */
const DISH_ROLES: readonly string[] = ["OWNER", "MANAGER", "KITCHEN"];

export function canMarkDishes(role: string | null | undefined): boolean {
  return DISH_ROLES.includes(String(role ?? "").toUpperCase());
}

/** O prato como a voz precisa dele (o que o cardápio do cliente já traz). */
export type DishLite = { id: string; name: string; sold_out?: boolean | number | string | null };

/** As frases que dizem "acabou" (e parentes), em letras minúsculas, sem acento. A mais comprida ganha. */
const SOLD_SAYS: readonly string[] = [
  "acabou",
  "acabaram",
  "esgotou",
  "esgotaram",
  "esgotado",
  "esgotada",
  "terminou",
  "terminaram",
  "faltou",
  "nao tem mais",
  "ficou sem",
  "estamos sem",
  "estou sem",
  "ta sem",
];

/** As frases que dizem "voltou" (tirar o esgotado). "Tirar o esgotado" é mais comprida que "esgotado", então ganha dela. */
const BACK_SAYS: readonly string[] = [
  "voltou",
  "voltaram",
  "chegou",
  "chegaram",
  "tem de novo",
  "ja tem",
  "temos de novo",
  "ta de volta",
  "esta de volta",
  "tira o esgotado",
  "tirar o esgotado",
  "tira esgotado",
  "tirar esgotado",
  "desmarca",
  "desmarcar",
  "desmarque",
  "nao esta mais esgotado",
  "nao ta mais esgotado",
];

/** Palavras que só enchem a frase: não ajudam a achar o prato. */
const FILLER = new Set(
  (
    "o a os as um uma uns umas de do da dos das no na nos nas pra para por pelo pela que e meu minha nosso nossa ja mais tudo hoje agora aqui " +
    "favor gente ai novo novamente pode poderia posso quero queria preciso gostaria tem temos ok vem marca marcar marque como coloca colocar bota botar deixa deixar tira tirar esse essa isso prato pratos " +
    "produto produtos item cardapio lista pessoal esta estao foi sao ta"
  ).split(" "),
);

/**
 * Palavras de outras partes do painel. "O pedido chegou", "a entrega terminou" e "a mesa 4 chamou" são perguntas ou
 * avisos sobre o movimento, não um prato que acabou: com uma delas na frase, a voz não marca prato nenhum.
 */
const NOT_A_DISH = new Set(
  "pedido pedidos entrega entregas entregador entregadores motoboy motoboys cliente clientes mesa mesas garcom chamado chamados caixa conta contas venda vendas pagamento pagamentos pix mensagem mensagens equipe horario".split(" "),
);

const plain = (text: string): string =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const wordsOf = (text: string): string[] =>
  plain(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !FILLER.has(word));

/** Plural de quem fala ("pastéis", "limões") para o singular do cardápio ("pastel", "limao"). */
function stem(word: string): string {
  if (word.length > 4 && /(oes|aes)$/.test(word)) return `${word.slice(0, -3)}ao`;
  if (word.length > 4 && /eis$/.test(word)) return `${word.slice(0, -3)}el`;
  if (word.length > 4 && /ois$/.test(word)) return `${word.slice(0, -3)}ol`;
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Duas palavras são a mesma: iguais, uma começa a outra (de 3 letras para cima) ou o plural de uma é a outra. */
function sameWord(said: string, name: string): boolean {
  if (said === name) return true;
  if (said.length >= 3 && name.length >= 3 && (said.startsWith(name) || name.startsWith(said))) return true;
  return stem(said) === stem(name);
}

/**
 * O que a pessoa pediu: marcar (ou desmarcar) qual prato. `text` é a fala já normalizada (`normalizeSpeech`: sem acento,
 * sem pontuação, com espaço dos dois lados). **Sem nome de prato na frase não é pedido de prato** ("acabou" sozinho
 * continua só abrindo a tela de produtos), frase com "não" ("não acabou o pastel") não vira pedido nenhum e conversa de
 * movimento ("o pedido chegou") também não.
 */
export function parseDishCommand(text: string): { action: DishAction; words: string[] } | null {
  const spaced = ` ${text.trim()} `;
  const pick = (says: readonly string[]): string => says.reduce((best, phrase) => (phrase.length > best.length && spaced.includes(` ${phrase} `) ? phrase : best), "");
  const sold = pick(SOLD_SAYS);
  const back = pick(BACK_SAYS);
  if (!sold && !back) return null;
  const action: DishAction = back.length >= sold.length && back !== "" ? "back" : "soldout";
  const verb = action === "back" ? back : sold;
  const rest = spaced.replace(` ${verb} `, " ");
  // "Não acabou", "ainda não voltou": o contrário do pedido. Melhor não fazer nada do que marcar o prato errado.
  if (/ nao /.test(rest)) return null;
  const words = wordsOf(rest);
  if (words.some((word) => NOT_A_DISH.has(word))) return null;
  return words.length > 0 ? { action, words } : null;
}

export type DishFound =
  | { kind: "one"; dish: DishLite }
  | { kind: "many"; names: string[] }
  | { kind: "none" };

/** Acha o prato que a pessoa falou. Só vale se todas as palavras dela estão no nome; no empate não adivinha. */
export function findDish(products: readonly DishLite[], words: readonly string[]): DishFound {
  const said = words.map(plain);
  if (said.length === 0) return { kind: "none" };
  const candidates = products
    .map((dish) => ({ dish, named: wordsOf(dish.name) }))
    .filter(({ named }) => named.length > 0 && said.every((word) => named.some((name) => sameWord(word, name))));
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "one", dish: candidates[0].dish };
  // Vários: vale o que a pessoa falou inteiro (todas as palavras do nome foram ditas), se for um só.
  const whole = candidates.filter(({ named }) => named.every((name) => said.some((word) => sameWord(word, name))));
  if (whole.length === 1) return { kind: "one", dish: whole[0].dish };
  const names = [...new Set(candidates.map(({ dish }) => dish.name))];
  return { kind: "many", names };
}

/** "A, B ou C" (no máximo três nomes; com mais, diz quantos faltam). */
export function namesText(names: readonly string[]): string {
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} e mais ${extra}`;
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} ou ${shown[shown.length - 1]}`;
}

/** Depois da pergunta "marcar ... como esgotado?": o que a pessoa respondeu falando. Sem certeza, `null` (vale como frase nova). */
export function confirmationOf(text: string): "yes" | "no" | null {
  const words = plain(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const NO = ["nao", "cancela", "cancelar", "cancelei", "deixa", "esquece", "errado", "errou", "pare"];
  const YES = ["sim", "pode", "isso", "confirma", "confirmo", "confirmado", "certo", "correto", "ok", "claro", "fechou", "exato", "positivo"];
  // "Não" ganha de "sim": "não pode" é não.
  if (words.some((word) => NO.includes(word))) return "no";
  if (words.some((word) => YES.includes(word))) return "yes";
  return null;
}

/** O que a voz responde ao pedido, já com o que fazer a seguir. */
export type DishOffer =
  /** Achou o prato e pergunta antes de mudar. Só depois do "sim" é que o prato é marcado. */
  | { kind: "ask"; action: DishAction; dish: { id: string; name: string }; say: string }
  /** Só uma resposta (nenhum prato, mais de um, já estava assim). `open` leva à tela de produtos. */
  | { kind: "info"; say: string; open?: "produtos"; warn?: boolean };

export function offerFor(input: { action: DishAction; words: readonly string[]; products: readonly DishLite[]; phrase?: Phraser }): DishOffer {
  const phrase = input.phrase ?? plainPhraser;
  const found = findDish(input.products, input.words);
  if (found.kind === "none") return { kind: "info", say: phrase.say(SAY_DISH_NONE), open: "produtos", warn: true };
  if (found.kind === "many") return { kind: "info", say: phrase.say(SAY_DISH_MANY, namesText(found.names)), warn: true };
  const { dish } = found;
  const sold = isSoldOut(dish as Parameters<typeof isSoldOut>[0]);
  if (input.action === "soldout" && sold) return { kind: "info", say: phrase.say(SAY_DISH_ALREADY_SOLD, dish.name) };
  if (input.action === "back" && !sold) return { kind: "info", say: phrase.say(SAY_DISH_ALREADY_BACK, dish.name) };
  const ask = input.action === "soldout" ? SAY_DISH_ASK_SOLD : SAY_DISH_ASK_BACK;
  return { kind: "ask", action: input.action, dish: { id: dish.id, name: dish.name }, say: phrase.say(ask, dish.name) };
}

/** Quanto tempo a pergunta espera o "sim" antes de ser esquecida (nada muda). */
export const ASK_MS = 30000;
